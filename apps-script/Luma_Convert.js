/**
 * ============================================================================
 *  LUMA CONVERT — Office files through the user's own Google Drive
 * ============================================================================
 *
 *  Word / Excel / PowerPoint (and PDF or a photo, via Drive's text reading)
 *  are uploaded as a temporary Google Doc / Sheet / Slides file, exported in
 *  the format asked for, and the temporary file is deleted straight away.
 *  Nothing is kept. Everything else in File tools runs on the phone.
 *
 *    GET  ?action=convertstatus                       capability check
 *    POST { convertOp: 'convert', fileName, mimeType, dataBase64, to, ocrLanguage? }
 *         → { fileName, mimeType, size, dataBase64 }
 * ============================================================================
 */

var LUMA_CONVERT_MAX_BYTES = 10 * 1024 * 1024;
var LUMA_CONVERT_MAX_PER_HOUR = 60;

/** Source extensions → which Google editor reads them. */
var LUMA_CONVERT_SOURCES = {
  docx: 'doc', doc: 'doc', odt: 'doc', rtf: 'doc', txt: 'doc', html: 'doc', htm: 'doc',
  pdf: 'doc', jpg: 'doc', jpeg: 'doc', png: 'doc',
  xlsx: 'sheet', xls: 'sheet', ods: 'sheet', csv: 'sheet',
  pptx: 'slides', ppt: 'slides', odp: 'slides'
};

var LUMA_CONVERT_GOOGLE_TYPES = {
  doc: 'application/vnd.google-apps.document',
  sheet: 'application/vnd.google-apps.spreadsheet',
  slides: 'application/vnd.google-apps.presentation'
};

/** What each editor can export, by the extension the user picks. */
var LUMA_CONVERT_TARGETS = {
  doc: {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    odt: 'application/vnd.oasis.opendocument.text',
    rtf: 'application/rtf',
    txt: 'text/plain',
    html: 'application/zip', // Google returns HTML zipped with its images
    epub: 'application/epub+zip'
  },
  sheet: {
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ods: 'application/x-vnd.oasis.opendocument.spreadsheet',
    csv: 'text/csv'
  },
  slides: {
    pdf: 'application/pdf',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    odp: 'application/vnd.oasis.opendocument.presentation',
    txt: 'text/plain'
  }
};

var LUMA_OCR_LANGUAGES = ['en', 'hi', 'gu', 'mr', 'ta', 'te', 'kn', 'ml', 'bn', 'pa'];

function tryHandleLumaConvertGet_(e) {
  var action = String((e && e.parameter && e.parameter.action) || '').trim().toLowerCase();
  if (action !== 'convertstatus') return null;
  var targets = {};
  Object.keys(LUMA_CONVERT_TARGETS).forEach(function (k) { targets[k] = Object.keys(LUMA_CONVERT_TARGETS[k]); });
  return lumaJson_({ success: true, convert: { maxBytes: LUMA_CONVERT_MAX_BYTES, sources: LUMA_CONVERT_SOURCES, targets: targets } });
}

function tryHandleLumaConvert_(e) {
  var payload;
  try {
    payload = parseLumaPayload_(e);
  } catch (err) {
    return null;
  }
  if (!payload || !payload.convertOp) return null;
  try {
    if (String(payload.convertOp) !== 'convert') throw new Error('Unknown convert operation.');
    lumaConvertRateLimit_();
    return lumaJson_(lumaConvert_(payload));
  } catch (err) {
    return lumaJson_({ success: false, error: safeMessage_(err) });
  }
}

function lumaConvertRateLimit_() {
  var cache = CacheService.getScriptCache();
  var key = 'luma_convert_' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHH');
  var used = Number(cache.get(key) || 0);
  if (used >= LUMA_CONVERT_MAX_PER_HOUR) throw new Error('Lots of conversions this hour already. Please try again later.');
  cache.put(key, String(used + 1), 3600);
}

function lumaConvert_(p) {
  var name = String(p.fileName || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').trim().slice(0, 150);
  var ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1];
  ext = ext ? ext.toLowerCase() : '';
  var family = LUMA_CONVERT_SOURCES[ext];
  if (!family) throw new Error('Luma can convert Word, Excel, PowerPoint, PDF and photo files here.');
  var to = String(p.to || '').toLowerCase();
  var targetMime = LUMA_CONVERT_TARGETS[family][to];
  if (!targetMime) throw new Error('A .' + ext + ' file can be turned into: ' + Object.keys(LUMA_CONVERT_TARGETS[family]).join(', ') + '.');

  var bytes = Utilities.base64Decode(String(p.dataBase64 || ''));
  if (!bytes.length) throw new Error('The file is empty.');
  if (bytes.length > LUMA_CONVERT_MAX_BYTES) throw new Error('Files up to 10 MB can be converted here.');

  var ocr = LUMA_OCR_LANGUAGES.indexOf(String(p.ocrLanguage || 'en')) >= 0 ? String(p.ocrLanguage || 'en') : 'en';
  var token = ScriptApp.getOAuthToken();
  var root = lumaDriveRoot_();
  var boundary = 'luma' + Utilities.getUuid().replace(/-/g, '');
  var meta = { name: 'Luma conversion (temporary) ' + name, mimeType: LUMA_CONVERT_GOOGLE_TYPES[family], parents: [root.getId()] };
  var head = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) +
    '\r\n--' + boundary + '\r\nContent-Type: ' + lumaConvertSourceMime_(ext) + '\r\n\r\n';
  var body = Utilities.newBlob(head).getBytes().concat(bytes).concat(Utilities.newBlob('\r\n--' + boundary + '--').getBytes());

  var created = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id&ocrLanguage=' + ocr, {
    method: 'post',
    contentType: 'multipart/related; boundary=' + boundary,
    payload: body,
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  if (created.getResponseCode() !== 200) {
    Logger.log('[LumaConvert] upload ' + created.getResponseCode() + ': ' + created.getContentText().slice(0, 300));
    throw new Error(ext === 'pdf' ? 'Google could not read this PDF (it may be password-protected or damaged).' : 'Google could not open this file (' + created.getResponseCode() + ').');
  }
  var tempId = JSON.parse(created.getContentText()).id;
  try {
    var out = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(tempId) + '/export?mimeType=' + encodeURIComponent(targetMime), {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    if (out.getResponseCode() !== 200) {
      Logger.log('[LumaConvert] export ' + out.getResponseCode() + ': ' + out.getContentText().slice(0, 300));
      throw new Error(out.getResponseCode() === 403 ? 'The converted file is too large for Google to export (over 10 MB).' : 'Google could not convert this file (' + out.getResponseCode() + ').');
    }
    var result = out.getBlob().getBytes();
    var base = name.replace(/\.[a-z0-9]+$/i, '');
    var outExt = to === 'html' ? 'zip' : to;
    return { success: true, fileName: base + '.' + outExt, mimeType: targetMime, size: result.length, dataBase64: Utilities.base64Encode(result) };
  } finally {
    // The temporary Google file is removed whatever happens; nothing is kept.
    try {
      UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(tempId), { method: 'delete', headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    } catch (err) {
      Logger.log('[LumaConvert] temp cleanup failed for ' + tempId + ': ' + err);
    }
  }
}

function lumaConvertSourceMime_(ext) {
  return {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    odt: 'application/vnd.oasis.opendocument.text',
    rtf: 'application/rtf',
    txt: 'text/plain',
    html: 'text/html',
    htm: 'text/html',
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    ods: 'application/vnd.oasis.opendocument.spreadsheet',
    csv: 'text/csv',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ppt: 'application/vnd.ms-powerpoint',
    odp: 'application/vnd.oasis.opendocument.presentation'
  }[ext] || 'application/octet-stream';
}
