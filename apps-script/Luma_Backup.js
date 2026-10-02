/**
 * ============================================================================
 *  LUMA BACKUP — nightly copies of the spreadsheet + a full Excel export
 * ============================================================================
 *
 *  Copies go to a "Luma Backups" folder in your Drive (outside Luma Documents,
 *  so they never show up in the app's Documents tree). The newest 30 are kept;
 *  older ones are moved to Drive's trash (recoverable for 30 days).
 *
 *  Routes (behind the passcode gate; the Shortcut key can't use them):
 *    GET  ?action=backupstatus
 *    POST { backupOp: 'now' | 'enable' | 'disable' | 'export' }
 *
 *  Editor: setupLumaBackups() switches the nightly backup on (and grants the
 *  permissions); removeLumaBackups() switches it off.
 * ============================================================================
 */

var LUMA_BACKUP_FOLDER_NAME = 'Luma Backups';
var LUMA_BACKUP_KEEP = 30;
var LUMA_BACKUP_HANDLER = 'lumaDailyBackup';

function lumaBackupProps_() {
  return PropertiesService.getScriptProperties();
}

function lumaBackupFolder_() {
  var props = lumaBackupProps_();
  var id = props.getProperty('LUMA_BACKUP_FOLDER_ID');
  if (id) {
    try {
      var existing = DriveApp.getFolderById(id);
      if (!existing.isTrashed()) return existing;
    } catch (err) { /* deleted — make a new one */ }
  }
  var folder = DriveApp.createFolder(LUMA_BACKUP_FOLDER_NAME);
  folder.setDescription('Automatic copies of your Luma spreadsheet. The newest ' + LUMA_BACKUP_KEEP + ' are kept.');
  props.setProperty('LUMA_BACKUP_FOLDER_ID', folder.getId());
  return folder;
}

function lumaBackupTriggerOn_() {
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === LUMA_BACKUP_HANDLER; });
}

/** Lists backups newest first: [{ id, name, createdAt, url }]. */
function lumaListBackups_(folder) {
  var out = [];
  var it = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
  while (it.hasNext()) {
    var f = it.next();
    if (f.isTrashed()) continue;
    out.push({ id: f.getId(), name: f.getName(), createdAt: f.getDateCreated().toISOString(), url: f.getUrl() });
  }
  return out.sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
}

/** Makes one copy now and trims the folder to the newest LUMA_BACKUP_KEEP. */
function lumaBackupNow_(reason) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var folder = lumaBackupFolder_();
  var stamp = Utilities.formatDate(new Date(), LUMA.timezone, 'yyyy-MM-dd HHmm');
  var copy = DriveApp.getFileById(ss.getId()).makeCopy('Luma backup ' + stamp + (reason === 'manual' ? ' (manual)' : ''), folder);

  var all = lumaListBackups_(folder);
  all.slice(LUMA_BACKUP_KEEP).forEach(function (b) {
    try { DriveApp.getFileById(b.id).setTrashed(true); } catch (err) { Logger.log('backup prune skipped: ' + err.message); }
  });

  var at = new Date().toISOString();
  lumaBackupProps_().setProperty('LUMA_BACKUP_LAST', at);
  return { name: copy.getName(), url: copy.getUrl(), at: at };
}

/** Trigger handler — runs nightly once enabled. */
function lumaDailyBackup() {
  lumaBackupNow_('daily');
}

function lumaEnableBackups_() {
  if (!lumaBackupTriggerOn_()) {
    ScriptApp.newTrigger(LUMA_BACKUP_HANDLER).timeBased().everyDays(1).atHour(2).inTimezone(LUMA.timezone).create();
  }
  // First copy straight away, so there's always at least one.
  if (!lumaBackupProps_().getProperty('LUMA_BACKUP_LAST')) lumaBackupNow_('daily');
}

function lumaDisableBackups_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === LUMA_BACKUP_HANDLER) ScriptApp.deleteTrigger(t);
  });
}

function lumaBackupStatus_() {
  var props = lumaBackupProps_();
  var folderId = props.getProperty('LUMA_BACKUP_FOLDER_ID');
  var backups = [];
  var folderUrl = '';
  if (folderId) {
    try {
      var folder = DriveApp.getFolderById(folderId);
      if (!folder.isTrashed()) {
        folderUrl = folder.getUrl();
        backups = lumaListBackups_(folder);
      }
    } catch (err) { /* folder gone */ }
  }
  return {
    enabled: lumaBackupTriggerOn_(),
    lastBackupAt: props.getProperty('LUMA_BACKUP_LAST') || null,
    count: backups.length,
    keep: LUMA_BACKUP_KEEP,
    folderUrl: folderUrl,
    recent: backups.slice(0, 5)
  };
}

/** The whole spreadsheet as an .xlsx file (base64), via Google's own export. */
function lumaExportXlsx_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx';
  var res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Google could not export the spreadsheet (' + res.getResponseCode() + '). Try again in a minute.');
  var bytes = res.getBlob().getBytes();
  if (bytes.length > 25 * 1024 * 1024) throw new Error('The export is too large to download here. Use File → Download in Google Sheets.');
  var stamp = Utilities.formatDate(new Date(), LUMA.timezone, 'yyyy-MM-dd');
  return { fileName: 'Luma export ' + stamp + '.xlsx', size: bytes.length, dataBase64: Utilities.base64Encode(bytes) };
}

/** A handful per hour is plenty; protects Drive quota if a button is hammered. */
function lumaBackupRateLimit_(op) {
  var cache = CacheService.getScriptCache();
  var key = 'luma_backup_' + op + '_' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHH');
  var used = Number(cache.get(key) || 0);
  if (used >= 10) throw new Error('That was done several times this hour already. Please try again later.');
  cache.put(key, String(used + 1), 3600);
}

/* --------------------------------------------------------------- routes */

function tryHandleLumaBackupGet_(e) {
  var action = String((e && e.parameter && e.parameter.action) || '').trim().toLowerCase();
  if (action !== 'backupstatus') return null;
  try {
    return lumaJson_({ success: true, backup: lumaBackupStatus_() });
  } catch (err) {
    return lumaJson_({ success: false, error: safeMessage_(err) });
  }
}

function tryHandleLumaBackup_(e) {
  var payload;
  try {
    payload = parseLumaPayload_(e);
  } catch (err) {
    return null;
  }
  if (!payload || !payload.backupOp) return null;
  try {
    var op = String(payload.backupOp);
    if (op === 'now') {
      lumaBackupRateLimit_(op);
      var made = lumaBackupNow_('manual');
      return lumaJson_({ success: true, backup: made, status: lumaBackupStatus_() });
    }
    if (op === 'enable') {
      lumaEnableBackups_();
      return lumaJson_({ success: true, status: lumaBackupStatus_() });
    }
    if (op === 'disable') {
      lumaDisableBackups_();
      return lumaJson_({ success: true, status: lumaBackupStatus_() });
    }
    if (op === 'export') {
      lumaBackupRateLimit_(op);
      var file = lumaExportXlsx_();
      file.success = true;
      return lumaJson_(file);
    }
    return lumaJson_({ success: false, error: 'Unknown backup operation.' });
  } catch (err) {
    return lumaJson_({ success: false, error: safeMessage_(err) });
  }
}

/* --------------------------------------------------------------- editor */

/** Run once from the editor: grants the permissions and switches nightly backups on. */
function setupLumaBackups() {
  lumaEnableBackups_();
  var s = lumaBackupStatus_();
  Logger.log('Nightly backups: ' + (s.enabled ? 'ON (around 2 AM)' : 'off') + ' · ' + s.count + ' copies · ' + s.folderUrl);
}

function removeLumaBackups() {
  lumaDisableBackups_();
  Logger.log('Nightly backups switched off. Existing copies stay in the Luma Backups folder.');
}
