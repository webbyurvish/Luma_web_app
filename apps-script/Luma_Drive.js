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
    var cache = CacheService.getScriptCache();
    try {
      var existing = DriveApp.getFolderById(id);
      if (cache.get('luma_drive_root_ok_' + id)) return existing; // verified within the last 6h
      if (!existing.isTrashed()) {
        cache.put('luma_drive_root_ok_' + id, '1', 21600);
        return existing;
      }
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

/*
 * Every folder id seen in the last tree listing (and every folder created since), so create,
 * rename and move don't have to prove "inside Luma Documents" by climbing parents one slow
 * DriveApp call at a time. Unknown ids still get the full check.
 */
var LUMA_DRIVE_KNOWN_KEY = 'luma_drive_known_folders';

function lumaKnownFolders_() {
  try { return JSON.parse(CacheService.getScriptCache().get(LUMA_DRIVE_KNOWN_KEY) || '{}'); } catch (err) { return {}; }
}

function lumaRememberFolders_(ids) {
  var json = JSON.stringify(ids);
  // Short-lived: a folder moved out of Luma Documents in Drive is re-checked within the hour.
  if (json.length < 90000) CacheService.getScriptCache().put(LUMA_DRIVE_KNOWN_KEY, json, 3600);
}

function lumaForgetFolders_() {
  CacheService.getScriptCache().remove(LUMA_DRIVE_KNOWN_KEY);
}

function lumaFolderInRoot_(folderId, root, allowRoot) {
  var id = String(folderId || '');
  if (id === root.getId()) {
    if (!allowRoot) throw new Error("The Luma Documents folder itself can't be changed.");
    return root;
  }
  var folder;
  try { folder = DriveApp.getFolderById(id); } catch (err) { throw new Error('Folder not found.'); }
  if (lumaKnownFolders_()[id]) return folder;
  if (folder.isTrashed() || !lumaInsideRoot_(folder, root.getId(), allowRoot)) throw new Error('That folder is outside Luma Documents.');
  return folder;
}

function lumaFileInRoot_(fileId, root) {
  var file;
  try { file = DriveApp.getFileById(String(fileId || '')); } catch (err) { throw new Error('File not found.'); }
  var parents = file.getParents();
  var parentId = parents.hasNext() ? parents.next().getId() : '';
  if (parentId && (parentId === root.getId() || lumaKnownFolders_()[parentId])) return file;
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

var LUMA_DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
var LUMA_DRIVE_LIST_FIELDS = 'nextPageToken,files(id,name,mimeType,parents,size,createdTime,modifiedTime)';

/**
 * One Drive API files.list query, all pages. Uses the script's own OAuth token (the Drive
 * permission DriveApp already requires), so no extra setup. Far faster than DriveApp, whose
 * iterators cost a round trip per folder — slow enough for Google to drop the response.
 */
function lumaDriveList_(q) {
  var token = ScriptApp.getOAuthToken();
  var out = [];
  var pageToken = '';
  for (var page = 0; page < 20; page++) {
    var url = 'https://www.googleapis.com/drive/v3/files?pageSize=1000&spaces=drive' +
      '&fields=' + encodeURIComponent(LUMA_DRIVE_LIST_FIELDS) +
      '&q=' + encodeURIComponent(q) +
      (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    var response = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
      Logger.log('[LumaDrive] files.list ' + response.getResponseCode() + ': ' + response.getContentText().slice(0, 300));
      throw new Error('Google Drive did not return your documents (' + response.getResponseCode() + ').');
    }
    var body = JSON.parse(response.getContentText());
    out = out.concat(body.files || []);
    pageToken = body.nextPageToken || '';
    if (!pageToken) break;
  }
  return out;
}

/**
 * Every folder and file under the root, one Drive query per folder LEVEL (children of all
 * folders at that depth at once), instead of two DriveApp round trips per folder.
 */
function lumaDriveTree_() {
  var root = lumaDriveRoot_();
  var rootId = root.getId();
  var meta = lumaReadDriveMeta_();
  var folders = [{ id: rootId, name: root.getName(), parentId: null, createdAt: root.getDateCreated().toISOString() }];
  var files = [];
  var level = [rootId];

  for (var depth = 0; depth < 25 && level.length && folders.length < 2000; depth++) {
    var inLevel = {};
    level.forEach(function (id) { inLevel[id] = true; });
    var next = [];
    // Keep each query well under Drive's length limit.
    for (var i = 0; i < level.length; i += 40) {
      var chunk = level.slice(i, i + 40);
      var q = '(' + chunk.map(function (id) { return "'" + id + "' in parents"; }).join(' or ') + ') and trashed = false';
      lumaDriveList_(q).forEach(function (item) {
        var parentId = (item.parents || []).filter(function (pid) { return inLevel[pid]; })[0];
        if (!parentId) return;
        if (item.mimeType === LUMA_DRIVE_FOLDER_MIME) {
          folders.push({ id: item.id, name: item.name, parentId: parentId, createdAt: item.createdTime });
          next.push(item.id);
        } else if (files.length < 5000) {
          var m = meta[item.id] || {};
          files.push({
            id: item.id,
            name: item.name,
            folderId: parentId,
            mimeType: item.mimeType,
            kind: lumaFileKind_(item.mimeType),
            size: Number(item.size || 0),
            createdAt: item.createdTime,
            updatedAt: item.modifiedTime,
            url: 'https://drive.google.com/file/d/' + item.id + '/view',
            description: m.description || '',
            tags: m.tags || '',
            expiryDate: m.expiryDate || ''
          });
        }
      });
    }
    level = next;
  }

  var known = {};
  folders.forEach(function (f) { if (f.parentId) known[f.id] = 1; });
  lumaRememberFolders_(known);

  var complete = folders.length < 2000 && files.length < 5000;
  try {
    lumaSyncDriveSheet_(files, folders, complete);
  } catch (err) {
    // Keeping the sheet in step is a bonus — never fail the listing because of it.
    Logger.log('[LumaDrive] sheet sync skipped: ' + err.message);
  }
  return { success: true, rootId: rootId, rootUrl: 'https://drive.google.com/drive/folders/' + rootId, folders: folders, files: files };
}

/* ------------------------------------------------------------ sheet sync */

/**
 * Keeps the Documents sheet in step with Drive, so the sheet always lists every document with
 * its Drive link — including files dropped into the folders directly in Drive. One read, at most
 * one batched write for changed rows and one append for new ones; nothing is written when the
 * sheet is already current. Rows whose file is no longer in Drive are marked Is Archived.
 */
function lumaSyncDriveSheet_(files, folders, complete) {
  var sh = lumaMetaSheet_();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1500)) return; // busy — the next listing will catch up
  try {
    var lastCol = sh.getLastColumn();
    var lastRow = sh.getLastRow();
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
    var c = {};
    headers.forEach(function (h, i) { c[h] = i; });
    if (c['Drive File ID'] === undefined) return;

    var body = lastRow >= 2 ? sh.getRange(2, 1, lastRow - 1, lastCol).getValues() : [];
    var rowOf = {};
    body.forEach(function (row, i) { var id = String(row[c['Drive File ID']] || '').trim(); if (id) rowOf[id] = i; });

    var byId = {};
    folders.forEach(function (f) { byId[f.id] = f; });
    var pathOf = function (folderId) {
      var names = [];
      for (var f = byId[folderId], guard = 0; f && f.parentId && guard < 30; f = byId[f.parentId], guard++) names.unshift(f.name);
      return names;
    };

    var now = new Date();
    var changed = false;
    var fresh = [];
    var seen = {};
    files.forEach(function (file) {
      seen[file.id] = true;
      var path = pathOf(file.folderId);
      var want = {
        'Name': file.name,
        'Category': path[0] || '',
        'Folder': path.join(' / '),
        'Drive URL': file.url,
        'File Type': file.kind,
        'Size': file.size
      };
      if (rowOf[file.id] === undefined) {
        var row = headers.map(function () { return ''; });
        row[c['Drive File ID']] = file.id;
        Object.keys(want).forEach(function (k) { if (c[k] !== undefined) row[c[k]] = want[k]; });
        if (c['Created At'] !== undefined) row[c['Created At']] = now;
        if (c['Updated At'] !== undefined) row[c['Updated At']] = now;
        fresh.push(row);
        return;
      }
      var existing = body[rowOf[file.id]];
      Object.keys(want).forEach(function (k) {
        if (c[k] === undefined || String(existing[c[k]]) === String(want[k])) return;
        existing[c[k]] = want[k];
        changed = true;
      });
      if (c['Is Archived'] !== undefined && existing[c['Is Archived']] === true) {
        existing[c['Is Archived']] = false;
        changed = true;
      }
    });

    // Only trust "missing" when the listing wasn't cut short by its size limits.
    if (complete && c['Is Archived'] !== undefined) {
      body.forEach(function (row) {
        var id = String(row[c['Drive File ID']] || '').trim();
        if (id && !seen[id] && row[c['Is Archived']] !== true) {
          row[c['Is Archived']] = true;
          changed = true;
        }
      });
    }

    if (changed) sh.getRange(2, 1, body.length, lastCol).setValues(body);
    if (fresh.length) {
      if (c['Document ID'] !== undefined) {
        var ids = nextLumaIds_(sh, 'DOC', c['Document ID'] + 1, fresh.length);
        fresh.forEach(function (row, i) { row[c['Document ID']] = ids[i]; });
      }
      sh.getRange(lastRow + 1, 1, fresh.length, lastCol).setValues(fresh);
    }
  } finally {
    lock.releaseLock();
  }
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
    var known = lumaKnownFolders_();
    known[created.getId()] = 1;
    lumaRememberFolders_(known);
    return { success: true, folder: { id: created.getId(), name: created.getName(), parentId: parent.getId() } };
  }

  if (op === 'createTree') {
    // A whole folder structure in one request (e.g. the family template). Folders that already
    // exist are reused, so running it again only fills in what's missing — never duplicates.
    var base = lumaFolderInRoot_(p.parentId || root.getId(), root, true);
    var nodes = Array.isArray(p.tree) ? p.tree : [];
    var total = 0;
    (function count(list, depth) {
      if (depth > 8) throw new Error('The structure is nested too deeply.');
      list.forEach(function (n) { total++; count(Array.isArray(n && n.children) ? n.children : [], depth + 1); });
    })(nodes, 1);
    if (!total) throw new Error('Nothing to create.');
    if (total > 600) throw new Error('That is too many folders for one go (max 600).');

    var started = Date.now();
    var knownTree = lumaKnownFolders_();
    var result = { success: true, created: 0, existing: 0, incomplete: false, folders: [] };
    var findChild = function (parent, name) {
      var it = parent.getFoldersByName(name);
      while (it.hasNext()) {
        var f = it.next();
        if (!f.isTrashed()) return f;
      }
      return null;
    };
    var walk = function (parent, list) {
      for (var i = 0; i < list.length; i++) {
        // Apps Script stops at 6 minutes; leave in time so the caller can simply run it again.
        if (Date.now() - started > 270000) { result.incomplete = true; return; }
        var folderName = lumaCleanName_(list[i] && list[i].name, 'folder');
        var folder = findChild(parent, folderName);
        if (folder) result.existing++;
        else { folder = parent.createFolder(folderName); result.created++; }
        knownTree[folder.getId()] = 1;
        result.folders.push({ id: folder.getId(), name: folderName, parentId: parent.getId(), createdAt: new Date().toISOString() });
        var kids = Array.isArray(list[i].children) ? list[i].children : [];
        if (kids.length) walk(folder, kids);
        if (result.incomplete) return;
      }
    };
    walk(base, nodes);
    lumaRememberFolders_(knownTree);
    return result;
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
    lumaForgetFolders_(); // its sub-folders are gone too; the next listing rebuilds the cache
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
