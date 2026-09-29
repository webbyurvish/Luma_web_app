/**
 * ============================================================================
 *  LUMA DRIVE — documents stored in Google Drive, organised in nested folders.
 * ============================================================================
 *
 *  Drive is the source of truth for files and folders: everything lives under
 *  one root folder, "Luma Documents" (category → subcategory → any depth).
 *  Files dropped into that folder directly in Drive show up in the app too.
 *  The "Documents" sheet only holds what Drive doesn't: description, tags and
 *  an expiry date, keyed by Drive File ID.
 *
 *  SAFETY — the web app is reachable by anyone with its URL, so:
 *   - every operation is confined to the Luma Documents tree; any file or
 *     folder outside it is refused (checked by walking up its parents);
 *   - "delete" moves items to Drive's Trash (recoverable for 30 days) — this
 *     module never erases anything permanently;
 *   - operations are rate-limited per hour.
 *
 *  Routes (additive — null for anything that isn't theirs):
 *    GET  ?action=drivestatus         capability check (the app calls it before any POST)
 *    GET  ?action=drivetree           all folders + files + metadata
 *    POST ?action=drive { driveOp: "createFolder" | "renameFolder" | "moveFolder" |
 *                         "trashFolder" | "upload" | "updateFile" | "moveFile" | "trashFile", ... }
 *
 *  First deploy asks Google for Drive permission once (run checkLumaDrive()).
 * ============================================================================
 */

var LUMA_DRIVE_ROOT_NAME = 'Luma Documents';
var LUMA_DRIVE_ROOT_PROP = 'LUMA_DRIVE_ROOT_ID';
var LUMA_DRIVE_DEFAULT_FOLDERS = ['Insurance', 'Tax', 'Finance', 'Medical', 'Property', 'Personal', 'Work', 'Other'];
var LUMA_DRIVE_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
var LUMA_DRIVE_MAX_OPS_PER_HOUR = 300;
var LUMA_DRIVE_META_SHEET = 'Documents';

/* ------------------------------------------------------------------ root */

/** The Luma Documents folder, created (with starter category folders) on first use. */
function lumaDriveRoot_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(LUMA_DRIVE_ROOT_PROP);
  if (id) {
    try {
      var existing = DriveApp.getFolderById(id);
      if (!existing.isTrashed()) return existing;
    } catch (err) { /* deleted or inaccessible — create a new one below */ }
  }
  return withLumaLock_(function () {
    var again = props.getProperty(LUMA_DRIVE_ROOT_PROP);
    if (again && again !== id) return DriveApp.getFolderById(again);
    var root = DriveApp.createFolder(LUMA_DRIVE_ROOT_NAME);
    root.setDescription('Documents managed by Luma. Folders here are your categories; nest as deep as you like.');
    LUMA_DRIVE_DEFAULT_FOLDERS.forEach(function (name) { root.createFolder(name); });
    props.setProperty(LUMA_DRIVE_ROOT_PROP, root.getId());
    return root;
  });
}

/** True when `item` (File or Folder) sits inside the root tree (or is the root, if allowRoot). */
function lumaInsideRoot_(item, rootId, allowRoot) {
  if (item.getId() === rootId) return !!allowRoot;
  var queue = [item];
  for (var depth = 0; depth < 25 && queue.length; depth++) {
    var next = [];
    for (var q = 0; q < queue.length; q++) {
      var parents = queue[q].getParents();
      while (parents.hasNext()) {
        var parent = parents.next();
        if (parent.getId() === rootId) return true;
        next.push(parent);
      }
    }
    queue = next;
  }
  return false;
}

function lumaFolderInRoot_(folderId, root, allowRoot) {
  var folder;
  try { folder = DriveApp.getFolderById(String(folderId || '')); } catch (err) { throw new Error('Folder not found.'); }
  if (!allowRoot && folder.getId() === root.getId()) throw new Error("The Luma Documents folder itself can't be changed.");
  if (folder.isTrashed() || !lumaInsideRoot_(folder, root.getId(), allowRoot)) throw new Error('That folder is outside Luma Documents.');
  return folder;
}

function lumaFileInRoot_(fileId, root) {
  var file;
  try { file = DriveApp.getFileById(String(fileId || '')); } catch (err) { throw new Error('File not found.'); }
  if (file.isTrashed() || !lumaInsideRoot_(file, root.getId(), false)) throw new Error('That file is outside Luma Documents.');
  return file;
}

function lumaCleanName_(raw, what) {
  var name = String(raw || '').replace(/[\\/\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
  if (!name) throw new Error('Give the ' + what + ' a name.');
  return name;
}

function lumaDriveRateLimit_() {
  var cache = CacheService.getScriptCache();
  var key = 'luma_drive_ops_' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHH');
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var used = Number(cache.get(key) || 0);
    if (used >= LUMA_DRIVE_MAX_OPS_PER_HOUR) throw new Error('Too many document changes this hour. Please try again later.');
    cache.put(key, String(used + 1), 3600);
  } finally {
    lock.releaseLock();
  }
}

/* -------------------------------------------------------------- metadata */

var LUMA_DRIVE_META_EXTRA_COLS = [{ n: 'Expiry Date', w: 120, a: 'left', f: 'date' }];

function lumaMetaSheet_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LUMA_DRIVE_META_SHEET);
  if (!sh) throw new Error('Sheet not found: ' + LUMA_DRIVE_META_SHEET + '. Run setupLumaSheets().');
  ensureColumns_(sh, LUMA_DRIVE_META_EXTRA_COLS);
  return sh;
}

function lumaMetaHeaders_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
}

/** { driveFileId: { description, tags, expiryDate } } for every metadata row. */
function lumaReadDriveMeta_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LUMA_DRIVE_META_SHEET);
  var out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  var values = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var h = values[0].map(function (x) { return String(x).trim(); });
  var col = function (name) { return h.indexOf(name); };
  var idC = col('Drive File ID'), descC = col('Description'), tagsC = col('Tags'), expC = col('Expiry Date');
  if (idC < 0) return out;
  for (var r = 1; r < values.length; r++) {
    var fid = String(values[r][idC] || '').trim();
    if (!fid) continue;
    var exp = expC >= 0 ? values[r][expC] : '';
    out[fid] = {
      description: descC >= 0 ? String(values[r][descC] || '') : '',
      tags: tagsC >= 0 ? String(values[r][tagsC] || '') : '',
      expiryDate: exp instanceof Date ? Utilities.formatDate(exp, 'Asia/Kolkata', 'yyyy-MM-dd') : String(exp || '')
    };
  }
  return out;
}

/**
 * Creates or updates the metadata row for one Drive file. Only keys present in `fields` are
 * written. Keeps the sheet's Name/Category/Folder/URL columns in step with Drive for readability.
 */
function lumaUpsertDriveMeta_(file, fields, root) {
  var sh = lumaMetaSheet_();
  return withLumaLock_(function () {
    var h = lumaMetaHeaders_(sh);
    var col = function (name) { return h.indexOf(name) + 1; };
    var idCol = col('Drive File ID');
    if (!idCol) throw new Error('Documents sheet has no "Drive File ID" column.');

    var row = 0;
    var last = sh.getLastRow();
    if (last >= 2) {
      var ids = sh.getRange(2, idCol, last - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) if (String(ids[i][0]).trim() === file.getId()) { row = i + 2; break; }
    }
    var now = new Date();
    if (!row) {
      row = Math.max(last + 1, 2);
      var docIdCol = col('Document ID');
      if (docIdCol) sh.getRange(row, docIdCol).setValue(nextLumaIds_(sh, 'DOC', docIdCol, 1)[0]);
      if (col('Created At')) sh.getRange(row, col('Created At')).setValue(now);
      sh.getRange(row, idCol).setValue(file.getId());
    }

    var path = lumaPathOf_(file, root);
    var set = function (name, value) { var c = col(name); if (c) sh.getRange(row, c).setValue(value); };
    set('Name', file.getName());
    set('Category', path[0] || '');
    set('Folder', path.join(' / '));
    set('Drive URL', file.getUrl());
    set('File Type', lumaFileKind_(file.getMimeType()));
    set('Size', file.getSize());
    if ('description' in fields) set('Description', String(fields.description || '').slice(0, 2000));
    if ('tags' in fields) set('Tags', String(fields.tags || '').slice(0, 500));
    if ('expiryDate' in fields) set('Expiry Date', toDate_(fields.expiryDate) || '');
    set('Updated At', now);
    return row;
  });
}

function lumaDeleteDriveMeta_(fileIds) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LUMA_DRIVE_META_SHEET);
  if (!sh || sh.getLastRow() < 2 || !fileIds.length) return;
  withLumaLock_(function () {
    var h = lumaMetaHeaders_(sh);
    var idCol = h.indexOf('Drive File ID') + 1;
    if (!idCol) return;
    var wanted = {};
    fileIds.forEach(function (id) { wanted[id] = true; });
    var ids = sh.getRange(2, idCol, sh.getLastRow() - 1, 1).getValues();
    for (var i = ids.length - 1; i >= 0; i--) {  // bottom-up so row numbers stay valid
      var id = String(ids[i][0]).trim();
      if (!wanted[id]) continue;
      copyRowToDeletedRecords_(sh, i + 2, h, id);
      sh.deleteRow(i + 2);
    }
  });
}

/** Folder names from just below the root down to the item's folder, e.g. ["Insurance", "Car"]. */
function lumaPathOf_(item, root) {
  var names = [];
  var current = item.getParents().hasNext() ? item.getParents().next() : null;
  for (var depth = 0; current && depth < 25 && current.getId() !== root.getId(); depth++) {
    names.unshift(current.getName());
    var parents = current.getParents();
    current = parents.hasNext() ? parents.next() : null;
  }
  return names;
}

function lumaFileKind_(mime) {
  mime = String(mime || '');
  if (mime === 'application/pdf') return 'PDF';
  if (mime.indexOf('image/') === 0) return 'Image';
  if (/spreadsheet|excel|csv/.test(mime)) return 'Sheet';
  if (/document|word|text\//.test(mime)) return 'Doc';
  if (/presentation|powerpoint/.test(mime)) return 'Slides';
  if (/zip|compressed|archive/.test(mime)) return 'Archive';
  return 'File';
}

/* ------------------------------------------------------------------ tree */

function lumaFileJson_(file, folderId, meta) {
  var m = meta[file.getId()] || {};
  return {
    id: file.getId(),
    name: file.getName(),
    folderId: folderId,
    mimeType: file.getMimeType(),
    kind: lumaFileKind_(file.getMimeType()),
    size: file.getSize(),
    createdAt: file.getDateCreated().toISOString(),
    updatedAt: file.getLastUpdated().toISOString(),
    url: file.getUrl(),
    description: m.description || '',
    tags: m.tags || '',
    expiryDate: m.expiryDate || ''
  };
}

/** Every folder and file under the root, breadth-first. Trashed items are skipped by Drive. */
function lumaDriveTree_() {
  var root = lumaDriveRoot_();
  var meta = lumaReadDriveMeta_();
  var folders = [];
  var files = [];
  var queue = [{ folder: root, parentId: null }];
  while (queue.length && folders.length < 2000) {
    var entry = queue.shift();
    var f = entry.folder;
    folders.push({ id: f.getId(), name: f.getName(), parentId: entry.parentId, createdAt: f.getDateCreated().toISOString() });
    var sub = f.getFolders();
    while (sub.hasNext()) queue.push({ folder: sub.next(), parentId: f.getId() });
    var it = f.getFiles();
    while (it.hasNext() && files.length < 5000) files.push(lumaFileJson_(it.next(), f.getId(), meta));
  }
  return { success: true, rootId: root.getId(), rootUrl: root.getUrl(), folders: folders, files: files };
}

/* ------------------------------------------------------------ operations */

function lumaDriveOp_(p) {
  var root = lumaDriveRoot_();
  var op = String(p.driveOp || '');

  if (op === 'createFolder') {
    var parent = lumaFolderInRoot_(p.parentId || root.getId(), root, true);
    var name = lumaCleanName_(p.name, 'folder');
    var dupes = parent.getFoldersByName(name);
    if (dupes.hasNext()) throw new Error('A folder named "' + name + '" already exists here.');
    var created = parent.createFolder(name);
    return { success: true, folder: { id: created.getId(), name: created.getName(), parentId: parent.getId() } };
  }

  if (op === 'renameFolder') {
    var folder = lumaFolderInRoot_(p.folderId, root, false);
    folder.setName(lumaCleanName_(p.name, 'folder'));
    return { success: true };
  }

  if (op === 'moveFolder') {
    var moving = lumaFolderInRoot_(p.folderId, root, false);
    var target = lumaFolderInRoot_(p.targetId || root.getId(), root, true);
    if (target.getId() === moving.getId() || lumaInsideRoot_(target, moving.getId(), false)) throw new Error("A folder can't be moved inside itself.");
    moving.moveTo(target);
    return { success: true };
  }

  if (op === 'trashFolder') {
    var doomed = lumaFolderInRoot_(p.folderId, root, false);
    // Collect the files first so their metadata rows can be cleaned up too.
    var ids = [];
    var stack = [doomed];
    while (stack.length) {
      var cur = stack.pop();
      var fi = cur.getFiles();
      while (fi.hasNext()) ids.push(fi.next().getId());
      var fo = cur.getFolders();
      while (fo.hasNext()) stack.push(fo.next());
    }
    doomed.setTrashed(true); // recoverable from Drive's Trash for 30 days
    lumaDeleteDriveMeta_(ids);
    return { success: true, trashedFiles: ids.length };
  }

  if (op === 'upload') {
    var into = lumaFolderInRoot_(p.folderId || root.getId(), root, true);
    var fileName = lumaCleanName_(p.name, 'file');
    var bytes = Utilities.base64Decode(String(p.dataBase64 || ''));
    if (!bytes.length) throw new Error('The file is empty.');
    if (bytes.length > LUMA_DRIVE_MAX_UPLOAD_BYTES) throw new Error('Files up to 10 MB can be uploaded here. Upload bigger files in Google Drive directly.');
    var blob = Utilities.newBlob(bytes, String(p.mimeType || 'application/octet-stream'), fileName);
    var file = into.createFile(blob);
    lumaUpsertDriveMeta_(file, { description: p.description || '', tags: p.tags || '', expiryDate: p.expiryDate || '' }, root);
    return { success: true, file: lumaFileJson_(file, into.getId(), lumaReadDriveMeta_()) };
  }

  if (op === 'updateFile') {
    var target2 = lumaFileInRoot_(p.fileId, root);
    if ('name' in p) target2.setName(lumaCleanName_(p.name, 'file'));
    var fields = {};
    ['description', 'tags', 'expiryDate'].forEach(function (k) { if (k in p) fields[k] = p[k]; });
    lumaUpsertDriveMeta_(target2, fields, root);
    return { success: true };
  }

  if (op === 'moveFile') {
    var mover = lumaFileInRoot_(p.fileId, root);
    var dest = lumaFolderInRoot_(p.folderId || root.getId(), root, true);
    mover.moveTo(dest);
    lumaUpsertDriveMeta_(mover, {}, root);
    return { success: true };
  }

  if (op === 'trashFile') {
    var bin = lumaFileInRoot_(p.fileId, root);
    bin.setTrashed(true); // recoverable from Drive's Trash for 30 days
    lumaDeleteDriveMeta_([bin.getId()]);
    return { success: true };
  }

  throw new Error('Unknown document operation: ' + op);
}

/* --------------------------------------------------------------- routers */

/** Call early in doGet. Claims only ?action=drivestatus and ?action=drivetree. */
function tryHandleLumaDriveGet_(e) {
  var action = String((e && e.parameter && e.parameter.action) || '').trim().toLowerCase();
  if (action !== 'drivestatus' && action !== 'drivetree') return null;
  try {
    if (action === 'drivestatus') return lumaJson_({ success: true, drive: true });
    return lumaJson_(lumaDriveTree_());
  } catch (err) {
    return lumaJson_({ success: false, error: safeMessage_(err) });
  }
}

/** Call early in doPost. Claims only requests that carry a driveOp. */
function tryHandleLumaDrive_(e) {
  var payload;
  try {
    payload = parseLumaPayload_(e);
    if (!payload.driveOp) return null;
  } catch (err) {
    return null;
  }
  try {
    lumaDriveRateLimit_();
    return lumaJson_(lumaDriveOp_(payload));
  } catch (err) {
    return lumaJson_({ success: false, error: safeMessage_(err) });
  }
}

/** Run once from the editor after deploying: grants Drive permission and creates the root. */
function checkLumaDrive() {
  var root = lumaDriveRoot_();
  Logger.log('Luma Documents: ' + root.getUrl());
}
