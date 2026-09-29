/**
 * ============================================================================
 *  LUMA PERSONAL OS — LIFECYCLE LAYER (update / archive / void / deactivate)
 * ============================================================================
 *
 *  Adds safe UPDATE and soft-delete (never hard-delete) to every entity on top
 *  of the existing GET/POST APIs from Luma_Data (newscript.gs), Udhaar.gs and
 *  Code.gs. Add this as a NEW script file. Do not paste it over any of those.
 *
 *  ## THIS FILE DOES NOT DEFINE doGet() OR doPost()
 *
 *  Same reasoning as the other modules: one shared namespace, so a second
 *  doPost() here would silently replace yours. Instead this file exposes
 *  tryHandleLumaLifecyclePost_(e), wired into Code.gs's doPost with two lines,
 *  ahead of tryHandleLumaPost_ so lifecycle payloads are claimed before the
 *  plain-create router sees them. It returns null for anything without an
 *  "operation" field, so every existing create/append request is unaffected.
 *
 *  ## API SHAPE
 *
 *    POST { action: "account",  operation: "update",  id: "ACC-000001", ... }
 *    POST { action: "account",  operation: "archive",  id: "ACC-000001" }
 *    POST { action: "investment", operation: "archive", id: "INV-000001" }
 *    POST { action: "sip",       operation: "deactivate", id: "SIP-000001" }
 *    POST { action: "note",      operation: "archive", id: "NOTE-000001" }
 *    POST { action: "document",  operation: "archive", id: "DOC-000001" }
 *    POST { action: "task",      operation: "archive", id: "TASK-000001" }
 *    POST { action: "liability", operation: "close",   id: "LIA-000001" }
 *    POST { action: "transaction", operation: "void",   id: "TXN-000001" }
 *    POST { action: "transaction", operation: "update", id: "TXN-000001", amount: 250 }
 *    POST { action: "udhaar",    operation: "update",  id: "UDH-000001", ... }
 *    POST { action: "udhaar",    operation: "archive", id: "UDH-000001" }
 *    POST { action: "settings",  operation: "update",  setting: "Currency", value: "USD" }
 *    POST { action: "category",  operation: "update",     category: "Food", subcategory: "Restaurant", active: false }
 *    POST { action: "category",  operation: "deactivate", category: "Food", subcategory: "Restaurant" }
 *
 *  UPDATE is always partial: a field is only touched when its key is present
 *  in the payload. A field never sent is left exactly as it was — this API
 *  never blanks a column just because a request omitted it.
 *
 *  ARCHIVE/DEACTIVATE/CLOSE/VOID/SETTLE never delete a row. They flip one
 *  existing or newly-added flag/status column and refresh Updated At. GET
 *  still returns archived rows via ?action=<entity>&includeArchived=true
 *  (Transactions uses includeVoided=true instead, wired in Code.gs).
 *
 *  ## SETUP ORDER (run once from the editor, after backupLumaSpreadsheet())
 *
 *    1. setupLumaSheets()        — from Luma_Data, if you have not already.
 *    2. setupLumaLifecycle()     — adds the handful of new lifecycle columns
 *                                  this file needs (Is Archived / Status /
 *                                  Voided At). Idempotent, append-only.
 *    3. backfillLumaSchemaIds()  — fills blank IDs on Accounts/Investments/
 *                                  SIPs/Notes/Documents/Tasks/Liabilities rows
 *                                  that were added outside the API.
 *    4. backfillTransactionIds() — from Luma_Data (requires LUMA.extendTransactions).
 *    5. backfillUdhaarIds()      — this file.
 *    6. backfillLumaTimestamps() — this file. Fills blank Created At / Updated
 *                                  At with "now", since the true original
 *                                  creation time of a pre-existing row is not
 *                                  recoverable. Documented limitation, not a
 *                                  bug: only ever touches blanks.
 *
 *  Every step above only fills blanks or appends columns. None of them can
 *  overwrite an existing id, timestamp, or any other value, and none of them
 *  run automatically — they are ordinary functions you run once from the
 *  Apps Script editor.
 * ============================================================================
 */

/* ========================================================================== */
/*  CONCURRENCY — every id-generation, update, archive and backfill goes      */
/*  through this so two simultaneous requests can never race each other.     */
/* ========================================================================== */

function withLumaLock_(fn) {
  var lock = LockService.getScriptLock();
  var acquired = lock.tryLock(10000);
  if (!acquired) throw new Error('System is busy, please try again in a moment.');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/* ========================================================================== */
/*  ARCHIVE CONFIG — which existing/added field marks a record archived,     */
/*  and what value means "archived". Drives both GET filtering and the       */
/*  generic archive operation for the seven schema-driven entities.          */
/* ========================================================================== */

var LUMA_ARCHIVE_CONFIG = {
  Accounts:    { field: 'Is Active',   archivedValue: false, opName: 'archive'     }, // reuses existing field
  Investments: { field: 'Is Archived', archivedValue: true,  opName: 'archive'     }, // new field — Status is domain data (Active/Sold/...), not archival
  SIPs:        { field: 'Is Active',   archivedValue: false, opName: 'deactivate'  }, // reuses existing field
  Notes:       { field: 'Is Archived', archivedValue: true,  opName: 'archive'     }, // reuses existing field
  Documents:   { field: 'Is Archived', archivedValue: true,  opName: 'archive'     }, // reuses existing field
  Tasks:       { field: 'Is Archived', archivedValue: true,  opName: 'archive'     }, // new field — distinct from Status=Completed, which is not archival
  Liabilities: { field: 'Status',      archivedValue: 'Closed', opName: 'close'    }, // reuses existing field; Defaulted stays visible
  Udhaar:      { field: 'Is Archived', archivedValue: true,  opName: 'archive'     }, // new field — never affects the Outstanding/Status formulas
  Categories:  { field: 'Active',      archivedValue: false, opName: 'deactivate'  }  // reuses existing field
};

/** True only on an exact match to the configured archived value. A blank or
 *  missing cell is never treated as archived, so pre-existing rows that never
 *  set the field keep showing up in default GET exactly as before this file
 *  existed. */
function isLumaArchived_(sheetName, obj) {
  var cfg = LUMA_ARCHIVE_CONFIG[sheetName];
  if (!cfg) return false;
  var val = obj[camelKey_(cfg.field)];
  var want = cfg.archivedValue;
  if (typeof want === 'boolean') {
    return val === want || String(val).trim().toUpperCase() === String(want).toUpperCase();
  }
  return String(val).trim() === String(want);
}

/* ========================================================================== */
/*  MIGRATION — idempotent, append-only, safe to re-run                       */
/* ========================================================================== */

var LUMA_LIFECYCLE_EXTENSIONS = {
  // Investments/Tasks/Udhaar get a dedicated archive flag because none of
  // their existing fields mean "hidden from the default view" without also
  // changing real domain meaning (Investment Status, Task Status).
  Investments:  [{ n: 'Is Archived', w: 105, a: 'center', list: 'Yes/No' }],
  Tasks:        [{ n: 'Is Archived', w: 105, a: 'center', list: 'Yes/No' }],
  Udhaar:       [{ n: 'Is Archived', w: 105, a: 'center', list: 'Yes/No' }],
  // Transactions needs its own lifecycle trio: Status for VOID, Voided At for
  // audit, Updated At because transactions can now be edited, not just
  // appended. Transaction ID / Account ID / Source are Luma_Data's own
  // extension (LUMA.extendTransactions) and are left to setupLumaSheets().
  Transactions: [
    { n: 'Status',     w: 100, a: 'left' },
    { n: 'Voided At',  w: 150, a: 'left', f: 'datetime' },
    { n: 'Updated At', w: 150, a: 'left', f: 'datetime' }
  ]
};

/**
 * Adds only the columns this file needs, and only where they are missing.
 * Reuses ensureColumns_ from Luma_Data, so the same append-after-last-used-
 * column guarantee applies: existing columns are never reordered, renamed or
 * cleared. Safe to run multiple times — a second run adds nothing.
 */
function setupLumaLifecycle() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var report = { extended: [] };

  Object.keys(LUMA_LIFECYCLE_EXTENSIONS).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) { Logger.log('setupLumaLifecycle: skipping ' + name + ' — sheet not found.'); return; }

    var added = ensureColumns_(sh, LUMA_LIFECYCLE_EXTENSIONS[name]);
    if (added.length) {
      report.extended.push(name + ' (+' + added.join(', ') + ')');
      // Cosmetic only — never let a styling failure block the migration.
      try { styleAppendedColumns_(ss, sh, LUMA_LIFECYCLE_EXTENSIONS[name]); }
      catch (err) { Logger.log('setupLumaLifecycle: styling skipped for ' + name + ': ' + err.message); }
    }
  });

  SpreadsheetApp.flush();
  Logger.log('setupLumaLifecycle: ' + (report.extended.join(', ') || 'nothing to add — already up to date'));
  return report;
}

/* ========================================================================== */
/*  BACKFILL — fills blanks only, batched writes, never overwrites, safe to  */
/*  re-run. None of these run automatically.                                 */
/* ========================================================================== */

/** Blank "<Entity> ID" cells on the seven schema-driven sheets (Accounts,
 *  Investments, SIPs, Notes, Documents, Tasks, Liabilities) — only relevant
 *  for rows added by hand in the spreadsheet UI, since createEntity_ always
 *  assigns an id through the API. */
function backfillLumaSchemaIds() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var report = {};

  Object.keys(LUMA_SCHEMA).forEach(function (name) {
    var schema = LUMA_SCHEMA[name];
    if (!schema.idPrefix) return; // Settings has no id concept
    var sh = ss.getSheetByName(name);
    if (!sh) return;

    var lastRow = sh.getLastRow();
    if (lastRow < 2) return;
    var idHeader = schema.cols[0].n;
    var lastCol  = sh.getLastColumn();
    var headers  = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
    var idCol    = headers.indexOf(idHeader) + 1;
    if (!idCol) return;

    withLumaLock_(function () {
      var n = lastRow - 1;
      var existing = sh.getRange(2, idCol, n, 1).getValues();
      // Second column is always the record's human-readable name/title in
      // this schema — used only to skip genuinely blank trailing rows.
      var names = sh.getRange(2, 2, n, 1).getValues();
      var blanks = [];
      existing.forEach(function (r, i) {
        if (String(r[0]).trim() === '' && String(names[i][0]).trim() !== '') blanks.push(i);
      });
      if (!blanks.length) return;

      var ids = nextLumaIds_(sh, schema.idPrefix, idCol, blanks.length);
      blanks.forEach(function (rowIdx, k) { existing[rowIdx][0] = ids[k]; });
      sh.getRange(2, idCol, existing.length, 1).setValues(existing);   // one write
      report[name] = blanks.length;
    });
  });

  Logger.log('backfillLumaSchemaIds: ' + (Object.keys(report).length ? JSON.stringify(report) : 'nothing to backfill'));
  return report;
}

/** Blank "Udhaar ID" cells. New rows get one automatically going forward via
 *  assignUdhaarLifecycleFields_ in saveUdhaarTransaction_ (Udhaar.gs). */
function backfillUdhaarIds() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Udhaar');
  if (!sh) throw new Error('No Udhaar sheet.');

  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  var idCol = headers.indexOf('Udhaar ID') + 1;
  if (!idCol) throw new Error('No "Udhaar ID" column. Run setupLumaSheets() first.');

  return withLumaLock_(function () {
    var last = sh.getLastRow();
    if (last < 2) return 0;

    var existing = sh.getRange(2, idCol, last - 1, 1).getValues();
    var people   = sh.getRange(2, 3, last - 1, 1).getValues(); // Person — skips blank trailing rows
    var blanks = [];
    existing.forEach(function (r, i) {
      if (String(r[0]).trim() === '' && String(people[i][0]).trim() !== '') blanks.push(i);
    });
    if (!blanks.length) { Logger.log('backfillUdhaarIds: nothing to backfill.'); return 0; }

    var ids = nextLumaIds_(sh, 'UDH', idCol, blanks.length);
    blanks.forEach(function (rowIdx, k) { existing[rowIdx][0] = ids[k]; });
    sh.getRange(2, idCol, existing.length, 1).setValues(existing);   // one write
    Logger.log('backfillUdhaarIds: filled ' + blanks.length + ' id(s).');
    return blanks.length;
  });
}

/** Blank Created At / Updated At on every schema sheet plus Udhaar. Filled
 *  value is "now" — the true original creation time of a pre-existing row is
 *  not recoverable from the sheet, so this is an explicit, documented
 *  approximation, not a bug. Only ever touches blank cells. */
function backfillLumaTimestamps() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var report = {};
  var sheetNames = Object.keys(LUMA_SCHEMA).filter(function (n) { return n !== 'Settings'; }).concat(['Udhaar']);

  sheetNames.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) return;
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return;
    var lastCol = sh.getLastColumn();
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
    var createdCol = headers.indexOf('Created At') + 1;
    var updatedCol = headers.indexOf('Updated At') + 1;
    if (!createdCol && !updatedCol) return;

    withLumaLock_(function () {
      var n = lastRow - 1;
      var created = createdCol ? sh.getRange(2, createdCol, n, 1).getValues() : null;
      var updated = updatedCol ? sh.getRange(2, updatedCol, n, 1).getValues() : null;
      var firstCol = sh.getRange(2, 1, n, 1).getValues(); // skips genuinely blank trailing rows

      var now = new Date();
      var filled = 0;
      for (var i = 0; i < n; i++) {
        if (String(firstCol[i][0]).trim() === '') continue;
        var touched = false;
        if (created && String(created[i][0]).trim() === '') { created[i][0] = now; touched = true; }
        if (updated && String(updated[i][0]).trim() === '') { updated[i][0] = now; touched = true; }
        if (touched) filled++;
      }
      if (created) sh.getRange(2, createdCol, n, 1).setValues(created);   // one write
      if (updated) sh.getRange(2, updatedCol, n, 1).setValues(updated);   // one write
      if (filled) report[name] = filled;
    });
  });

  Logger.log('backfillLumaTimestamps: ' + (Object.keys(report).length ? JSON.stringify(report) : 'nothing to backfill'));
  return report;
}

/* ========================================================================== */
/*  ROW LOOKUP — by id only, never by row number/name                        */
/* ========================================================================== */

function findRowById_(sh, idHeader, id) {
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2) return null;

  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  var idCol = headers.indexOf(idHeader) + 1;
  if (!idCol) throw new Error('Column "' + idHeader + '" not found on ' + sh.getName() + ' — run setupLumaLifecycle()/setupLumaSheets() first.');

  var ids = sh.getRange(2, idCol, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === String(id).trim()) {
      return { row: i + 2, headers: headers };
    }
  }
  return null;
}

function lumaNamedCol_(headers, name) {
  var i = headers.indexOf(name);
  return i < 0 ? 0 : i + 1;
}

/* ========================================================================== */
/*  SCHEMA-DRIVEN ENTITIES — Accounts, Investments, SIPs, Notes, Documents,  */
/*  Tasks, Liabilities. Generic update + archive, driven by LUMA_SCHEMA.     */
/* ========================================================================== */

var LUMA_LIFECYCLE_ROUTES = {
  'account':    'Accounts',
  'investment': 'Investments',
  'sip':        'SIPs',
  'note':       'Notes',
  'document':   'Documents',
  'task':       'Tasks',
  'liability':  'Liabilities'
};

/**
 * Partial update, id-based only. A payload key is applied only when present;
 * every other column is left untouched. The id column, Created At, Updated
 * At and any formula column (e.g. Investments' Realized/Unrealized Gain) can
 * never be set this way.
 */
function updateSchemaEntity_(sheetName, id, payload) {
  var schema = LUMA_SCHEMA[sheetName];
  if (!schema) throw new Error('No schema for ' + sheetName);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Sheet not found: ' + sheetName);
  var idHeader = schema.cols[0].n;

  return withLumaLock_(function () {
    var found = findRowById_(sh, idHeader, id);
    if (!found) throw new Error(sheetName + ' record not found: ' + id);

    var updatedFields = [];
    schema.cols.forEach(function (c, i) {
      if (i === 0) return;                                   // id — never updated
      if (c.n === 'Created At' || c.n === 'Updated At') return; // discipline fields — never set directly
      if (typeof c.formula === 'function') return;            // computed cell — never overwritten

      var key = camelKey_(c.n);
      if (!(key in payload)) return;                          // not sent — leave untouched

      var col = found.headers.indexOf(c.n) + 1;
      if (!col) return;
      var raw = payload[key];
      var value = (raw === null || raw === '') ? '' : coerceValue_(raw, c.f);
      sh.getRange(found.row, col).setValue(value);
      updatedFields.push(c.n);
    });

    var updatedAtCol = lumaNamedCol_(found.headers, 'Updated At');
    if (updatedAtCol) sh.getRange(found.row, updatedAtCol).setValue(new Date());

    Logger.log('[Luma][update] ' + sheetName + ' ' + id + ' fields=[' + updatedFields.join(',') + '] success');
    return { success: true, message: sheetName + ' updated', id: id, updatedFields: updatedFields };
  });
}

/** Sets the configured archive field to its "archived" value and refreshes
 *  Updated At. Never touches any other column, never deletes the row. */
function archiveSchemaEntity_(sheetName, id) {
  var cfg = LUMA_ARCHIVE_CONFIG[sheetName];
  if (!cfg) throw new Error('No archive configuration for ' + sheetName);
  var schema = LUMA_SCHEMA[sheetName];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Sheet not found: ' + sheetName);
  var idHeader = schema.cols[0].n;

  return withLumaLock_(function () {
    var found = findRowById_(sh, idHeader, id);
    if (!found) throw new Error(sheetName + ' record not found: ' + id);

    var fieldCol = lumaNamedCol_(found.headers, cfg.field);
    if (!fieldCol) throw new Error('Column "' + cfg.field + '" not found on ' + sheetName + ' — run setupLumaLifecycle() first.');
    sh.getRange(found.row, fieldCol).setValue(cfg.archivedValue);

    var updatedAtCol = lumaNamedCol_(found.headers, 'Updated At');
    if (updatedAtCol) sh.getRange(found.row, updatedAtCol).setValue(new Date());

    Logger.log('[Luma][' + cfg.opName + '] ' + sheetName + ' ' + id + ' success');
    return { success: true, message: sheetName + ' ' + cfg.opName + 'd', id: id };
  });
}

/* ========================================================================== */
/*  PERMANENT DELETE — the one operation that removes a row. For records     */
/*  added by mistake or for testing. Every deleted row is first copied,      */
/*  whole, to the "Deleted Records" sheet, so a wrong delete can still be    */
/*  restored by hand. Archive/void remain the everyday way to hide records.  */
/* ========================================================================== */

var LUMA_DELETED_SHEET = 'Deleted Records';

/** Appends the full row (headers + values as JSON) to the Deleted Records
 *  sheet, creating it on first use. Must run inside withLumaLock_. */
function copyRowToDeletedRecords_(sh, row, headers, recordId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var bin = ss.getSheetByName(LUMA_DELETED_SHEET);
  if (!bin) {
    bin = ss.insertSheet(LUMA_DELETED_SHEET);
    bin.appendRow(['Deleted At', 'Sheet', 'Record ID', 'Row Data (JSON)']);
    bin.setFrozenRows(1);
    bin.getRange(1, 1, 1, 4).setFontWeight('bold');
  }
  var values = sh.getRange(row, 1, 1, headers.length).getValues()[0];
  var record = {};
  headers.forEach(function (h, i) { if (h) record[h] = values[i] instanceof Date ? values[i].toISOString() : values[i]; });
  bin.appendRow([new Date(), sh.getName(), recordId, JSON.stringify(record)]);
}

/** Sheets whose rows can point at an account through an "Account ID" column,
 *  with the rule for "this row no longer counts" (archived/closed/voided). */
var LUMA_ACCOUNT_REFERENCES = [
  { sheet: 'Investments',  label: 'investment',  inactive: { field: 'Is Archived', value: true } },
  { sheet: 'SIPs',         label: 'SIP',         inactive: { field: 'Is Active',   value: false } },
  { sheet: 'Liabilities',  label: 'liability',   inactive: { field: 'Status',      value: 'Closed' } },
  { sheet: 'Transactions', label: 'transaction', inactive: { field: 'Status',      value: 'Voided' } },
  { sheet: 'Udhaar',       label: 'udhaar entry', inactive: { field: 'Is Archived', value: true } }
];

/** Human-readable list of live records still pointing at accountId, e.g.
 *  ["2 SIPs", "1 investment"]. Archived/closed/voided rows don't count. */
function liveAccountReferences_(accountId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var found = [];
  LUMA_ACCOUNT_REFERENCES.forEach(function (ref) {
    var sh = ss.getSheetByName(ref.sheet);
    if (!sh || sh.getLastRow() < 2) return;
    var values = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    var headers = values[0].map(function (h) { return String(h).trim(); });
    var accCol = headers.indexOf('Account ID');
    if (accCol < 0) return;
    var inactiveCol = headers.indexOf(ref.inactive.field);
    var count = 0;
    for (var r = 1; r < values.length; r++) {
      if (String(values[r][accCol]).trim() !== String(accountId).trim()) continue;
      if (inactiveCol >= 0 && values[r][inactiveCol] === ref.inactive.value) continue;
      count++;
    }
    if (count) found.push(count + ' ' + ref.label + (count > 1 ? 's' : ''));
  });
  return found;
}

function deleteSchemaEntity_(sheetName, id) {
  var schema = LUMA_SCHEMA[sheetName];
  if (!schema) throw new Error('No schema for ' + sheetName);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sh) throw new Error('Sheet not found: ' + sheetName);
  var idHeader = schema.cols[0].n;

  return withLumaLock_(function () {
    var found = findRowById_(sh, idHeader, id);
    if (!found) throw new Error(sheetName + ' record not found: ' + id);

    if (sheetName === 'Accounts') {
      var refs = liveAccountReferences_(id);
      if (refs.length) {
        throw new Error("Can't delete this account: it's still linked to " + refs.join(', ') + '. Delete or archive those first.');
      }
    }

    copyRowToDeletedRecords_(sh, found.row, found.headers, id);
    sh.deleteRow(found.row);

    Logger.log('[Luma][delete] ' + sheetName + ' ' + id + ' success (copied to ' + LUMA_DELETED_SHEET + ')');
    return { success: true, message: sheetName + ' record deleted', id: id };
  });
}

function deleteTransaction_(id) {
  return withLumaLock_(function () {
    var found = findTransactionRow_(id);
    if (!found) throw new Error('Transaction not found: ' + id);

    copyRowToDeletedRecords_(found.sh, found.row, found.headers, id);
    found.sh.deleteRow(found.row);

    Logger.log('[Luma][delete] Transaction ' + id + ' success (copied to ' + LUMA_DELETED_SHEET + ')');
    return { success: true, message: 'Transaction deleted', id: id };
  });
}

/* ========================================================================== */
/*  TRANSACTIONS — VOID (never delete), plus UPDATE                          */
/* ========================================================================== */

/** Column A:J stay fixed-index, exactly like every other Transactions
 *  handler in Code.gs — the sheet's own header text was never load-bearing
 *  there (data[0] is read but never used) so header lookup would be unsafe.
 *  Transaction ID / Status / Voided At / Updated At are looked up by header
 *  because this file is the one that created them, so it controls the text. */
var LUMA_TRANSACTION_FIXED_COLS = {
  date: 2, amount: 3, type: 4, category: 5, subcategory: 6,
  paymentMethod: 7, merchant: 8, note: 9
};

function findTransactionRow_(id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Transactions');
  if (!sh) throw new Error('Sheet not found: Transactions');
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2) return null;

  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  var idCol = headers.indexOf('Transaction ID') + 1;
  if (!idCol) throw new Error('Transaction ID column not found — run setupLumaSheets() then backfillTransactionIds() first.');

  var ids = sh.getRange(2, idCol, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === String(id).trim()) return { sh: sh, row: i + 2, headers: headers };
  }
  return null;
}

function voidTransaction_(id) {
  return withLumaLock_(function () {
    var found = findTransactionRow_(id);
    if (!found) throw new Error('Transaction not found: ' + id);

    var statusCol    = lumaNamedCol_(found.headers, 'Status');
    var voidedAtCol  = lumaNamedCol_(found.headers, 'Voided At');
    var updatedAtCol = lumaNamedCol_(found.headers, 'Updated At');
    if (!statusCol || !voidedAtCol) throw new Error('Lifecycle columns missing on Transactions — run setupLumaLifecycle() first.');

    var now = new Date();
    found.sh.getRange(found.row, statusCol).setValue('Voided');
    found.sh.getRange(found.row, voidedAtCol).setValue(now);
    if (updatedAtCol) found.sh.getRange(found.row, updatedAtCol).setValue(now);

    Logger.log('[Luma][void] Transaction ' + id + ' success');
    return { success: true, message: 'Transaction voided', id: id };
  });
}

function updateTransaction_(id, payload) {
  return withLumaLock_(function () {
    var found = findTransactionRow_(id);
    if (!found) throw new Error('Transaction not found: ' + id);
    var sh = found.sh, row = found.row;
    var updatedFields = [];

    Object.keys(LUMA_TRANSACTION_FIXED_COLS).forEach(function (key) {
      if (!(key in payload)) return;
      var col = LUMA_TRANSACTION_FIXED_COLS[key];
      var raw = payload[key];
      var value = raw;
      if (key === 'date') value = coerceTransactionDate_(raw) || raw;
      if (key === 'amount') value = Number(raw) || 0;
      sh.getRange(row, col).setValue(value);
      updatedFields.push(key);
    });

    // Timestamp (A, the creation record) is never touched by update.
    if ('date' in payload) {
      var newDate = sh.getRange(row, 2).getValue();
      sh.getRange(row, 10).setValue(transactionMonth_(newDate, new Date()));
      updatedFields.push('month');
    }

    var updatedAtCol = lumaNamedCol_(found.headers, 'Updated At');
    if (updatedAtCol) sh.getRange(row, updatedAtCol).setValue(new Date());

    Logger.log('[Luma][update] Transaction ' + id + ' fields=[' + updatedFields.join(',') + '] success');
    return { success: true, message: 'Transaction updated', id: id, updatedFields: updatedFields };
  });
}

/** Called from doPost right after a new transaction row is appended (app or
 *  iPhone Shortcut), so every new row is editable/deletable by id from day
 *  one. Only fills blanks, only in columns that exist. The caller wraps this
 *  in try/catch: a lifecycle problem must never fail the save itself. */
function assignTransactionLifecycleFields_(sh, row) {
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  var idCol      = lumaNamedCol_(headers, 'Transaction ID');
  var statusCol  = lumaNamedCol_(headers, 'Status');
  var updatedCol = lumaNamedCol_(headers, 'Updated At');

  if (idCol && String(sh.getRange(row, idCol).getValue()).trim() === '') {
    var id = withLumaLock_(function () { return nextLumaIds_(sh, 'TXN', idCol, 1)[0]; });
    sh.getRange(row, idCol).setValue(id);
  }
  if (statusCol && String(sh.getRange(row, statusCol).getValue()).trim() === '') sh.getRange(row, statusCol).setValue('Active');
  if (updatedCol) sh.getRange(row, updatedCol).setValue(new Date());
}

function handleTransactionLifecycle_(operation, payload) {
  if (!payload.id) throw new Error('id is required for transaction ' + operation);
  if (operation === 'void') return voidTransaction_(payload.id);
  if (operation === 'update') return updateTransaction_(payload.id, payload);
  if (operation === 'delete') return deleteTransaction_(payload.id);
  throw new Error('Unsupported transaction operation: ' + operation);
}

/* ========================================================================== */
/*  UDHAAR — stable ids on write, UPDATE (never touches formula cells J:L),  */
/*  ARCHIVE (never affects the Outstanding/Status calculations)              */
/* ========================================================================== */

/** Called once per new row from saveUdhaarTransaction_ in Udhaar.gs. Wrapped
 *  in its own try/catch there so a lifecycle-column problem can never break
 *  the live "Add Udhaar" Shortcut — it only degrades to id: null. */
function assignUdhaarLifecycleFields_(sh, row) {
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  var idCol      = headers.indexOf('Udhaar ID') + 1;
  var createdCol = headers.indexOf('Created At') + 1;
  var updatedCol = headers.indexOf('Updated At') + 1;

  var newId = null;
  if (idCol) {
    newId = withLumaLock_(function () { return nextLumaIds_(sh, 'UDH', idCol, 1)[0]; });
    sh.getRange(row, idCol).setValue(newId);
  }
  var now = new Date();
  if (createdCol) sh.getRange(row, createdCol).setValue(now);
  if (updatedCol) sh.getRange(row, updatedCol).setValue(now);
  return newId;
}

/** Person/Type/Amount are editable because Month (J), Outstanding (K) and
 *  Status (L) are live formulas that recompute from them automatically —
 *  never set directly here. */
var LUMA_UDHAAR_EDITABLE_FIXED = {
  date: 2, person: 3, type: 4, amount: 5, description: 6, dueDate: 7, paymentMethod: 8, note: 9
};

function findUdhaarRow_(id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Udhaar');
  if (!sh) throw new Error('Sheet not found: Udhaar');
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2) return null;

  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  var idCol = headers.indexOf('Udhaar ID') + 1;
  if (!idCol) throw new Error('Udhaar ID column not found — run setupLumaSheets() then backfillUdhaarIds() first.');

  var ids = sh.getRange(2, idCol, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === String(id).trim()) return { sh: sh, row: i + 2, headers: headers };
  }
  return null;
}

function updateUdhaarRecord_(id, payload) {
  return withLumaLock_(function () {
    var found = findUdhaarRow_(id);
    if (!found) throw new Error('Udhaar record not found: ' + id);
    var sh = found.sh, row = found.row;
    var updatedFields = [];

    Object.keys(LUMA_UDHAAR_EDITABLE_FIXED).forEach(function (key) {
      if (!(key in payload)) return;
      var col = LUMA_UDHAAR_EDITABLE_FIXED[key];
      var raw = payload[key];
      var value = raw;
      if (key === 'date' || key === 'dueDate') value = toDate_(raw) || raw;
      if (key === 'amount') value = Number(raw) || 0;
      sh.getRange(row, col).setValue(value);
      updatedFields.push(key);
    });

    var updatedAtCol = lumaNamedCol_(found.headers, 'Updated At');
    if (updatedAtCol) sh.getRange(row, updatedAtCol).setValue(new Date());

    Logger.log('[Luma][update] Udhaar ' + id + ' fields=[' + updatedFields.join(',') + '] success');
    return { success: true, message: 'Udhaar record updated', id: id, updatedFields: updatedFields };
  });
}

function archiveUdhaarRecord_(id) {
  return withLumaLock_(function () {
    var found = findUdhaarRow_(id);
    if (!found) throw new Error('Udhaar record not found: ' + id);

    var archCol = lumaNamedCol_(found.headers, 'Is Archived');
    if (!archCol) throw new Error('Is Archived column missing on Udhaar — run setupLumaLifecycle() first.');
    found.sh.getRange(found.row, archCol).setValue(true);

    var updatedAtCol = lumaNamedCol_(found.headers, 'Updated At');
    if (updatedAtCol) found.sh.getRange(found.row, updatedAtCol).setValue(new Date());

    Logger.log('[Luma][archive] Udhaar ' + id + ' success');
    return { success: true, message: 'Udhaar record archived', id: id };
  });
}

/** Removes one Udhaar ledger row (copied to Deleted Records first). The
 *  per-row Outstanding/Status formulas use ranges that Sheets re-anchors when
 *  a row above them is removed, so every remaining balance stays correct. */
function deleteUdhaarRecord_(id) {
  return withLumaLock_(function () {
    var found = findUdhaarRow_(id);
    if (!found) throw new Error('Udhaar record not found: ' + id);

    copyRowToDeletedRecords_(found.sh, found.row, found.headers, id);
    found.sh.deleteRow(found.row);

    Logger.log('[Luma][delete] Udhaar ' + id + ' success (copied to ' + LUMA_DELETED_SHEET + ')');
    return { success: true, message: 'Udhaar record deleted', id: id };
  });
}

function handleUdhaarLifecycle_(operation, payload) {
  if (!payload.id) throw new Error('id is required for udhaar ' + operation);
  if (operation === 'update') return updateUdhaarRecord_(payload.id, payload);
  if (operation === 'delete') return deleteUdhaarRecord_(payload.id);
  if (operation === 'archive' || operation === 'settle') return archiveUdhaarRecord_(payload.id);
  throw new Error('Unsupported udhaar operation: ' + operation);
}

/* ========================================================================== */
/*  SETTINGS — UPDATE only, keyed by setting name (no id concept, no delete) */
/* ========================================================================== */

function handleSettingsLifecycle_(operation, payload) {
  if (operation !== 'update') throw new Error('Settings only supports operation=update');
  var key = String(payload.setting || payload.id || '').trim();
  if (!key) throw new Error('setting is required');

  return withLumaLock_(function () {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Settings');
    if (!sh) throw new Error('Sheet not found: Settings');
    var last = sh.getLastRow();
    if (last < 2) throw new Error('Setting not found: ' + key);

    var names = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < names.length; i++) {
      if (String(names[i][0]).trim().toLowerCase() !== key.toLowerCase()) continue;
      var row = i + 2;
      var updatedFields = [];
      if ('value' in payload)       { sh.getRange(row, 2).setValue(payload.value);       updatedFields.push('value'); }
      if ('description' in payload) { sh.getRange(row, 3).setValue(payload.description); updatedFields.push('description'); }
      Logger.log('[Luma][update] Settings "' + key + '" fields=[' + updatedFields.join(',') + '] success');
      return { success: true, message: 'Setting updated', id: key, updatedFields: updatedFields };
    }
    throw new Error('Setting not found: ' + key);
  });
}

/* ========================================================================== */
/*  CATEGORIES — deactivate via existing Active field, never delete. Keyed   */
/*  by {category, subcategory}, the same natural key Transactions already    */
/*  reference by text — not a row number, and Category/Subcategory text      */
/*  itself is never editable here (would orphan historical transactions).    */
/* ========================================================================== */

function handleCategoryLifecycle_(operation, payload) {
  var category = String(payload.category || '').trim();
  var subcategory = String(payload.subcategory || '').trim();
  if (!category) throw new Error('category is required');

  return withLumaLock_(function () {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Categories');
    if (!sh) throw new Error('Sheet not found: Categories');
    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    if (lastRow < 2) throw new Error('Category not found: ' + category);

    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
    var typeCol   = headers.indexOf('Type') + 1;
    var activeCol = headers.indexOf('Active') + 1;
    var sortCol   = headers.indexOf('Sort Order') + 1;

    var data = sh.getRange(2, 1, lastRow - 1, 2).getValues();
    var label = category + (subcategory ? '/' + subcategory : '');

    for (var i = 0; i < data.length; i++) {
      var rowCat = String(data[i][0]).trim();
      var rowSub = String(data[i][1]).trim();
      if (rowCat.toLowerCase() !== category.toLowerCase()) continue;
      if (subcategory ? rowSub.toLowerCase() !== subcategory.toLowerCase() : rowSub !== '') continue;

      var row = i + 2;

      if (operation === 'update') {
        // category/subcategory in the payload identify which row to update, not
        // fields to write — only Type/Active/Sort Order are ever set below, so
        // the category/subcategory text itself can never be renamed through
        // this path (which would orphan historical transaction references).
        var updatedFields = [];
        if ('type' in payload && typeCol)       { sh.getRange(row, typeCol).setValue(payload.type);            updatedFields.push('type'); }
        if ('active' in payload && activeCol)   { sh.getRange(row, activeCol).setValue(coerceValue_(payload.active)); updatedFields.push('active'); }
        if ('sortOrder' in payload && sortCol)  { sh.getRange(row, sortCol).setValue(Number(payload.sortOrder));      updatedFields.push('sortOrder'); }
        Logger.log('[Luma][update] Category ' + label + ' fields=[' + updatedFields.join(',') + '] success');
        return { success: true, message: 'Category updated', id: label, updatedFields: updatedFields };
      }

      if (operation === 'deactivate' || operation === 'archive') {
        if (!activeCol) throw new Error('Active column missing on Categories — run setupLumaSheets() then backfillCategoryMetadata() first.');
        sh.getRange(row, activeCol).setValue(false);
        Logger.log('[Luma][deactivate] Category ' + label + ' success');
        return { success: true, message: 'Category deactivated', id: label };
      }

      throw new Error('Unsupported category operation: ' + operation);
    }
    throw new Error('Category not found: ' + label);
  });
}

/* ========================================================================== */
/*  ROUTER — additive, never replaces doPost                                 */
/* ========================================================================== */

/**
 * Call after tryHandleUdhaar_ and before tryHandleLumaPost_ in doPost(e).
 * Returns null for any payload without an "operation" field, or whose action
 * matches nothing here, so every existing create/append request reaches the
 * code after it completely unchanged. Never throws.
 */
function tryHandleLumaLifecyclePost_(e) {
  var payload;
  try {
    payload = parseLumaPayload_(e);
  } catch (err) {
    return null;
  }

  var action = String(payload.action || '').trim().toLowerCase();
  var operation = String(payload.operation || '').trim().toLowerCase();
  if (!operation) return null; // not a lifecycle request — let create/append handle it

  try {
    if (action === 'transaction') return lumaJson_(handleTransactionLifecycle_(operation, payload));
    if (action === 'udhaar')      return lumaJson_(handleUdhaarLifecycle_(operation, payload));
    if (action === 'settings' || action === 'setting') return lumaJson_(handleSettingsLifecycle_(operation, payload));
    if (action === 'category' || action === 'categories') return lumaJson_(handleCategoryLifecycle_(operation, payload));

    var sheetName = LUMA_LIFECYCLE_ROUTES[action];
    if (!sheetName) return null; // unrecognised action — not ours

    if (operation === 'update') {
      if (!payload.id) throw new Error('id is required for update');
      return lumaJson_(updateSchemaEntity_(sheetName, payload.id, payload));
    }
    if (operation === 'delete') {
      if (!payload.id) throw new Error('id is required for delete');
      return lumaJson_(deleteSchemaEntity_(sheetName, payload.id));
    }
    if (['archive', 'deactivate', 'close', 'void', 'settle'].indexOf(operation) >= 0) {
      if (!payload.id) throw new Error('id is required for ' + operation);
      return lumaJson_(archiveSchemaEntity_(sheetName, payload.id));
    }
    throw new Error('Unknown operation: ' + operation);
  } catch (err) {
    return lumaJson_({ success: false, error: safeMessage_(err) });
  }
}
