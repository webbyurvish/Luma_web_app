/**
 * ============================================================================
 *  LUMA IMPORT — bulk-add transactions read from a Google Pay statement
 * ============================================================================
 *
 *  The app reads the Google Pay PDF on the phone and sends only the rows the
 *  user confirmed. Each row goes through the same path as any expense:
 *  Transaction ID + Status (lifecycle) and the account balance (ledger).
 *
 *  Duplicates: every row carries its UPI Transaction ID as "Reference"; a
 *  reference already in the sheet is skipped, so the same statement can be
 *  imported twice without double-counting.
 *
 *    GET  ?action=importstatus                         capability check
 *    POST { importOp: 'transactions', source, rows: [...] }
 * ============================================================================
 */

var LUMA_IMPORT_MAX_ROWS = 400;

function tryHandleLumaImportGet_(e) {
  var action = String((e && e.parameter && e.parameter.action) || '').trim().toLowerCase();
  if (action !== 'importstatus') return null;
  return lumaJson_({ success: true, import: { gpay: true, maxRows: LUMA_IMPORT_MAX_ROWS } });
}

function tryHandleLumaImport_(e) {
  var payload;
  try {
    payload = parseLumaPayload_(e);
  } catch (err) {
    return null;
  }
  if (!payload || !payload.importOp) return null;
  try {
    if (String(payload.importOp) !== 'transactions') throw new Error('Unknown import operation.');
    return lumaJson_(lumaImportTransactions_(payload));
  } catch (err) {
    return lumaJson_({ success: false, error: safeMessage_(err) });
  }
}

/** yyyy-MM-dd + optional "h:mm AM" → a Date in the script's timezone. */
function lumaImportDate_(iso, time) {
  var p = String(iso).split('-').map(Number);
  var h = 12;
  var m = 0;
  var t = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/.exec(String(time || '').trim());
  if (t) {
    h = Number(t[1]) % 12 + (t[3] && /p/i.test(t[3]) ? 12 : 0);
    if (!t[3]) h = Number(t[1]);
    m = Number(t[2]);
  }
  return new Date(p[0], p[1] - 1, p[2], h, m);
}

function lumaImportTransactions_(payload) {
  var rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (!rows.length) throw new Error('Nothing to import.');
  if (rows.length > LUMA_IMPORT_MAX_ROWS) throw new Error('Import at most ' + LUMA_IMPORT_MAX_ROWS + ' payments at a time.');
  var source = String(payload.source || 'Import').slice(0, 40);

  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Transactions');
  if (!sh) throw new Error('Sheet "Transactions" not found.');
  ensureColumns_(sh, [{ n: 'Reference' }]);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  var refCol = headers.indexOf('Reference') + 1;
  var sourceCol = headers.indexOf('Source') + 1;

  // References already in the sheet.
  var known = {};
  if (sh.getLastRow() > 1) {
    sh.getRange(2, refCol, sh.getLastRow() - 1, 1).getValues().forEach(function (r) {
      var v = String(r[0] || '').trim();
      if (v) known[v] = true;
    });
  }

  var imported = 0;
  var skipped = [];
  var failed = [];
  rows.forEach(function (raw, index) {
    try {
      var ref = String(raw.reference || '').replace(/[^\w-]/g, '').slice(0, 40);
      if (ref && known[ref]) {
        skipped.push(ref);
        return;
      }
      var amount = Number(raw.amount);
      if (!(amount > 0)) throw new Error('bad amount');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(raw.date || ''))) throw new Error('bad date');
      var type = String(raw.type) === 'Income' ? 'Income' : 'Expense';
      var when = lumaImportDate_(raw.date, raw.time);
      var data = {
        date: raw.date,
        amount: amount,
        type: type,
        category: String(raw.category || 'Other').slice(0, 60),
        subcategory: String(raw.subcategory || '').slice(0, 60),
        paymentMethod: String(raw.paymentMethod || 'UPI').slice(0, 40),
        merchant: String(raw.merchant || '').slice(0, 120),
        note: String(raw.note || '').slice(0, 500),
        accountId: String(raw.accountId || '')
      };
      // Columns A:J keep their meaning; A and B are the payment's own time, not the import time.
      sh.appendRow([when, when, data.amount, data.type, data.category, data.subcategory, data.paymentMethod, data.merchant, data.note, transactionMonth_(when, when)]);
      var newRow = sh.getLastRow();
      try { assignTransactionLifecycleFields_(sh, newRow); } catch (err) { Logger.log('import lifecycle skipped: ' + err.message); }
      if (data.accountId) {
        try { lumaLinkNewTransaction_(sh, newRow, data); } catch (err) { Logger.log('import ledger skipped: ' + err.message); }
      }
      if (ref) {
        sh.getRange(newRow, refCol).setValue(ref);
        known[ref] = true;
      }
      if (sourceCol) sh.getRange(newRow, sourceCol).setValue(source);
      imported++;
    } catch (err) {
      failed.push({ index: index, error: String(err && err.message ? err.message : err) });
    }
  });
  return { success: true, imported: imported, skipped: skipped.length, skippedRefs: skipped, failed: failed };
}
