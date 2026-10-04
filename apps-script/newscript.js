/**
 * ============================================================================
 *  LUMA PERSONAL OS — DATA LAYER
 * ============================================================================
 *
 *  Turns the spreadsheet into a small relational store: one sheet per entity,
 *  one schema object driving every sheet's columns, widths, formats,
 *  validation and conditional formatting.
 *
 *  Add this as a NEW script file named "Luma_Data". Do not paste it over
 *  Dashboard_Restyle.gs, Udhaar.gs, or your web-app file.
 *
 *  ## THIS FILE DEFINES NEITHER doGet() NOR doPost()
 *
 *  Apps Script shares one global namespace across every .gs file. A second
 *  doGet() here would silently override yours and break ?action=transactions
 *  for the React app; a second doPost() would break the iPhone Shortcut. So
 *  this file exposes two routers you call from your own handlers, and both
 *  return null for anything they do not own. See "WIRING" below.
 *
 *  ## WHAT IT TOUCHES
 *
 *  Creates : Accounts, Investments, SIPs, Notes, Documents, Tasks,
 *            Liabilities, Settings, Lists — only if absent.
 *  Extends : Udhaar and Categories, by APPENDING columns to the right.
 *            Existing columns are never reordered, renamed or cleared.
 *  Ignores : Transactions, unless you opt in via LUMA.extendTransactions.
 *  Never   : deletes a sheet, row, column or value; changes a formula;
 *            changes the web app URL or its JSON contract.
 *
 *  ## SETUP ORDER
 *
 *    1. backupLumaSpreadsheet()   — timestamped copy in Drive. Run this first.
 *    2. setupLumaSheets()         — create/extend, style, validate. Idempotent.
 *    3. Wire the two routers (below), then re-deploy the web app.
 *
 *  ## WIRING
 *
 *  In your web-app file, make these the first statements of each handler:
 *
 *      function doGet(e) {
 *        var luma = tryHandleLumaGet_(e);     // <-- ADD
 *        if (luma) return luma;               // <-- ADD
 *        ... your existing code, unchanged ...   // health + transactions live here
 *      }
 *
 *      function doPost(e) {
 *        var udhaar = tryHandleUdhaar_(e);    // <-- from Udhaar.gs, if installed
 *        if (udhaar) return udhaar;
 *        var luma = tryHandleLumaPost_(e);    // <-- ADD
 *        if (luma) return luma;
 *        ... your existing code, unchanged ...   // expense/income POST lives here
 *      }
 *
 *  tryHandleLumaGet_ returns null for action=health, action=transactions, a
 *  missing action, and any action it does not recognise — so every existing
 *  request reaches your code on the very next line, byte for byte.
 *  tryHandleLumaPost_ returns null unless the body names one of its own
 *  entities, so a payload with no "action" is always yours.
 *  Neither can throw; internal failures come back as JSON.
 * ============================================================================
 */

var LUMA = {
  timezone: 'Asia/Kolkata',

  /** Indian digit grouping: 500 / 5,000 / 50,000 / 1,00,000 / 10,00,000.
   *  Cells stay numeric — the symbol lives in the format, never in the value. */
  money:    '₹#,##,##0',
  money2:   '₹#,##,##0.00',
  date:     'dd mmm yyyy',
  datetime: 'dd mmm yyyy hh:mm',
  rate:     '0.00"%"',

  /**
   * ON as of the 2026-09-23 audit of Code.gs. getTransactions() declares
   * `const headers = data[0]` and never uses it; every field is read by fixed
   * index row[0]..row[9], and index 9 is the highest referenced anywhere in
   * the file. Columns K:M are therefore loaded and ignored, and the
   * ?action=transactions response shape cannot change.
   */
  extendTransactions: true,

  /** Basic filters on the new entity sheets. */
  addFilters: true
};

/* ========================================================================== */
/*  LOOKUP LISTS — the single source of truth for every dropdown              */
/* ========================================================================== */

var LUMA_LISTS = {
  'Transaction Types':   ['Expense', 'Income', 'Transfer', 'Investment', 'Udhaar', 'Repayment'],
  'Account Types':       ['Bank', 'Cash', 'Wallet', 'Credit Card', 'Demat', 'Other'],
  'Payment Methods':     ['UPI', 'Credit Card', 'Debit Card', 'Cash', 'Net Banking', 'Other'],
  'Investment Types':    ['Stock', 'Mutual Fund', 'IPO', 'FD', 'Gold', 'Bond', 'Other'],
  'Investment Statuses': ['Active', 'Partially Sold', 'Sold', 'Matured', 'Closed'],
  'SIP Frequencies':     ['Monthly', 'Quarterly'],
  'Udhaar Types':        ['Given', 'Repayment'],
  'Udhaar Statuses':     ['Pending', 'Due Soon', 'Overdue', 'Partially Repaid', 'Settled', 'Overpaid'],
  'Task Statuses':       ['Todo', 'In Progress', 'Completed', 'Cancelled'],
  'Task Priorities':     ['Low', 'Medium', 'High', 'Urgent'],
  'Note Categories':     ['Personal', 'Work', 'Finance', 'Ideas', 'Learning', 'Important', 'Other'],
  'Document Categories': ['Personal', 'Finance', 'Insurance', 'Tax', 'Work', 'Medical', 'Property', 'Other'],
  'Liability Types':     ['Credit Card', 'Personal Loan', 'Home Loan', 'Car Loan', 'Education Loan', 'Other'],
  'Liability Statuses':  ['Active', 'Closed', 'Defaulted'],
  'Category Types':      ['Expense', 'Income'],
  'Currencies':          ['INR'],
  'Yes/No':              ['TRUE', 'FALSE']
};

var LUMA_SETTINGS = [
  ['Currency',                 'INR',                'Default application currency'],
  ['Timezone',                 'Asia/Kolkata',       'Application timezone'],
  ['Date Format',              'DD/MM/YYYY',         'Display format used by the React app'],
  ['Default Account',          '',                   'Account ID used when a payload omits one'],
  ['Default Expense Category', 'Other',              'Fallback category'],
  ['Udhaar Due Soon Days',     '7',                  'Days before a due date that counts as Due Soon'],
  ['App Name',                 'Luma Personal OS',   'Display name']
];

/* ========================================================================== */
/*  SCHEMA — one entry per entity sheet, drives everything downstream         */
/*                                                                            */
/*  col spec: { n: header, w: width, a: align, f: format key, list: lookup,    */
/*              wrap: true, formula: fn(row) }                                */
/* ========================================================================== */

var LUMA_SCHEMA = {

  Accounts: {
    idPrefix: 'ACC',
    cols: [
      { n: 'Account ID',            w: 110, a: 'left'   },
      { n: 'Account Name',          w: 190, a: 'left'   },
      { n: 'Account Type',          w: 120, a: 'left',   list: 'Account Types' },
      { n: 'Institution',           w: 160, a: 'left'   },
      { n: 'Account Number Last 4', w: 140, a: 'center', f: 'text' },
      { n: 'Opening Balance',       w: 130, a: 'right',  f: 'money' },
      { n: 'Current Balance',       w: 130, a: 'right',  f: 'money' },
      { n: 'Currency',              w: 90,  a: 'center', list: 'Currencies' },
      { n: 'Is Active',             w: 90,  a: 'center', list: 'Yes/No' },
      { n: 'Notes',                 w: 240, a: 'left',   wrap: true },
      { n: 'Created At',            w: 150, a: 'left',   f: 'datetime' },
      { n: 'Updated At',            w: 150, a: 'left',   f: 'datetime' }
    ],
    cf: [{ col: 'Is Active', equals: 'FALSE', color: 'muted' }]
  },

  Investments: {
    idPrefix: 'INV',
    cols: [
      { n: 'Investment ID',    w: 110, a: 'left'   },
      { n: 'Investment Name',  w: 200, a: 'left'   },
      { n: 'Investment Type',  w: 130, a: 'left',   list: 'Investment Types' },
      { n: 'Platform',         w: 150, a: 'left'   },
      { n: 'Account ID',       w: 110, a: 'left'   },
      { n: 'Invested Amount',  w: 130, a: 'right',  f: 'money' },
      { n: 'Current Value',    w: 130, a: 'right',  f: 'money' },
      { n: 'Quantity',         w: 100, a: 'right',  f: 'qty' },
      { n: 'Average Price',    w: 120, a: 'right',  f: 'money2' },
      { n: 'Current Price',    w: 120, a: 'right',  f: 'money2' },
      { n: 'Purchase Date',    w: 120, a: 'left',   f: 'date' },
      // Sale Value is not in your column list but the IPO example needs it:
      // without it Realized Gain has nothing to subtract from.
      { n: 'Sale Value',       w: 120, a: 'right',  f: 'money' },
      { n: 'Realized Gain',    w: 120, a: 'right',  f: 'money',
        formula: function (r) { return '=IF($L' + r + '="","",$L' + r + '-$F' + r + ')'; } },
      { n: 'Unrealized Gain',  w: 130, a: 'right',  f: 'money',
        formula: function (r) { return '=IF(OR($G' + r + '="",$F' + r + '=""),"",$G' + r + '-$F' + r + ')'; } },
      { n: 'Currency',         w: 90,  a: 'center', list: 'Currencies' },
      { n: 'Status',           w: 120, a: 'left',   list: 'Investment Statuses' },
      { n: 'Notes',            w: 240, a: 'left',   wrap: true },
      { n: 'Created At',       w: 150, a: 'left',   f: 'datetime' },
      { n: 'Updated At',       w: 150, a: 'left',   f: 'datetime' }
    ],
    cf: [
      { col: 'Status', equals: 'Sold',   color: 'muted' },
      { col: 'Status', equals: 'Closed', color: 'muted' },
      { col: 'Status', equals: 'Active', color: 'green' }
    ]
  },

  SIPs: {
    idPrefix: 'SIP',
    cols: [
      { n: 'SIP ID',            w: 110, a: 'left'   },
      { n: 'SIP Name',          w: 190, a: 'left'   },
      { n: 'Fund Name',         w: 210, a: 'left'   },
      { n: 'Investment Type',   w: 130, a: 'left',   list: 'Investment Types' },
      { n: 'Platform',          w: 150, a: 'left'   },
      { n: 'Account ID',        w: 110, a: 'left'   },
      { n: 'Amount',            w: 120, a: 'right',  f: 'money' },
      { n: 'Frequency',         w: 110, a: 'left',   list: 'SIP Frequencies' },
      { n: 'Debit Day',         w: 95,  a: 'center', f: 'int' },
      { n: 'Start Date',        w: 120, a: 'left',   f: 'date' },
      { n: 'End Date',          w: 120, a: 'left',   f: 'date' },
      { n: 'Category',          w: 130, a: 'left'   },
      { n: 'Is Active',         w: 90,  a: 'center', list: 'Yes/No' },
      { n: 'Last Payment Date', w: 140, a: 'left',   f: 'date' },
      { n: 'Next Payment Date', w: 140, a: 'left',   f: 'date' },
      { n: 'Notes',             w: 240, a: 'left',   wrap: true },
      { n: 'Created At',        w: 150, a: 'left',   f: 'datetime' },
      { n: 'Updated At',        w: 150, a: 'left',   f: 'datetime' }
    ],
    cf: [
      { col: 'Is Active', equals: 'TRUE',  color: 'green' },
      { col: 'Is Active', equals: 'FALSE', color: 'muted' }
    ]
  },

  Notes: {
    idPrefix: 'NOTE',
    cols: [
      { n: 'Note ID',     w: 110, a: 'left'   },
      { n: 'Title',       w: 220, a: 'left'   },
      { n: 'Content',     w: 420, a: 'left',   wrap: true },
      { n: 'Category',    w: 130, a: 'left',   list: 'Note Categories' },
      { n: 'Tags',        w: 190, a: 'left'   },
      { n: 'Is Pinned',   w: 95,  a: 'center', list: 'Yes/No' },
      { n: 'Is Archived', w: 105, a: 'center', list: 'Yes/No' },
      { n: 'Created At',  w: 150, a: 'left',   f: 'datetime' },
      { n: 'Updated At',  w: 150, a: 'left',   f: 'datetime' }
    ],
    cf: [
      { col: 'Is Pinned',   equals: 'TRUE', color: 'amber' },
      { col: 'Is Archived', equals: 'TRUE', color: 'muted' }
    ]
  },

  Documents: {
    idPrefix: 'DOC',
    cols: [
      { n: 'Document ID',         w: 115, a: 'left'   },
      { n: 'Name',                w: 220, a: 'left'   },
      { n: 'Description',         w: 280, a: 'left',   wrap: true },
      { n: 'Category',            w: 130, a: 'left',   list: 'Document Categories' },
      { n: 'File Type',           w: 100, a: 'center' },
      { n: 'Drive File ID',       w: 200, a: 'left',   f: 'text' },
      { n: 'Drive URL',           w: 240, a: 'left'   },
      { n: 'Folder',              w: 160, a: 'left'   },
      { n: 'Tags',                w: 180, a: 'left'   },
      { n: 'Size',                w: 100, a: 'right'  },
      { n: 'Related Entity Type', w: 150, a: 'left'   },
      { n: 'Related Entity ID',   w: 140, a: 'left'   },
      { n: 'Is Archived',         w: 105, a: 'center', list: 'Yes/No' },
      { n: 'Created At',          w: 150, a: 'left',   f: 'datetime' },
      { n: 'Updated At',          w: 150, a: 'left',   f: 'datetime' }
    ],
    cf: [{ col: 'Is Archived', equals: 'TRUE', color: 'muted' }]
  },

  Tasks: {
    idPrefix: 'TASK',
    cols: [
      { n: 'Task ID',      w: 110, a: 'left'   },
      { n: 'Title',        w: 250, a: 'left'   },
      { n: 'Description',  w: 320, a: 'left',   wrap: true },
      { n: 'Status',       w: 120, a: 'left',   list: 'Task Statuses' },
      { n: 'Priority',     w: 100, a: 'center', list: 'Task Priorities' },
      { n: 'Due Date',     w: 120, a: 'left',   f: 'date' },
      { n: 'Category',     w: 130, a: 'left'   },
      { n: 'Tags',         w: 180, a: 'left'   },
      { n: 'Is Completed', w: 110, a: 'center', list: 'Yes/No' },
      { n: 'Created At',   w: 150, a: 'left',   f: 'datetime' },
      { n: 'Updated At',   w: 150, a: 'left',   f: 'datetime' },
      { n: 'Completed At', w: 150, a: 'left',   f: 'datetime' }
    ],
    cf: [
      { col: 'Status',   equals: 'Completed', color: 'muted' },
      { col: 'Status',   equals: 'Cancelled', color: 'muted' },
      { col: 'Priority', equals: 'Urgent',    color: 'red'   },
      { col: 'Priority', equals: 'High',      color: 'amber' }
    ]
  },

  Liabilities: {
    idPrefix: 'LIA',
    cols: [
      { n: 'Liability ID',       w: 115, a: 'left'   },
      { n: 'Name',               w: 210, a: 'left'   },
      { n: 'Type',               w: 140, a: 'left',   list: 'Liability Types' },
      { n: 'Institution',        w: 170, a: 'left'   },
      { n: 'Original Amount',    w: 140, a: 'right',  f: 'money' },
      { n: 'Outstanding Amount', w: 150, a: 'right',  f: 'money' },
      { n: 'Interest Rate',      w: 115, a: 'right',  f: 'rate' },
      { n: 'EMI Amount',         w: 120, a: 'right',  f: 'money' },
      { n: 'Due Date',           w: 120, a: 'left',   f: 'date' },
      { n: 'Account ID',         w: 110, a: 'left'   },
      { n: 'Status',             w: 110, a: 'left',   list: 'Liability Statuses' },
      { n: 'Notes',              w: 240, a: 'left',   wrap: true },
      { n: 'Created At',         w: 150, a: 'left',   f: 'datetime' },
      { n: 'Updated At',         w: 150, a: 'left',   f: 'datetime' }
    ],
    cf: [
      { col: 'Status', equals: 'Closed',    color: 'muted' },
      { col: 'Status', equals: 'Defaulted', color: 'red'   },
      { col: 'Status', equals: 'Active',    color: 'navy'  }
    ]
  },

  Settings: {
    cols: [
      { n: 'Setting',     w: 220, a: 'left' },
      { n: 'Value',       w: 220, a: 'left' },
      { n: 'Description', w: 420, a: 'left', wrap: true }
    ]
  }
};

/** Columns APPENDED to sheets that already exist. Never reorders or renames. */
var LUMA_EXTENSIONS = {
  // Udhaar.gs owns A:L (Timestamp..Status). These go to the right of it, so
  // every existing Udhaar formula and the running-balance logic are untouched.
  Udhaar: [
    { n: 'Udhaar ID',        w: 115, a: 'left' },
    { n: 'Account ID',       w: 110, a: 'left' },
    { n: 'Parent Udhaar ID', w: 140, a: 'left' },
    { n: 'Created At',       w: 150, a: 'left', f: 'datetime' },
    { n: 'Updated At',       w: 150, a: 'left', f: 'datetime' }
  ],

  // Categories currently is A=Category, B=Subcategory. Your target schema puts
  // Type first; reordering would risk the Shortcut's category list, so Type is
  // appended as C instead. Values are NOT written — see backfillCategoryMetadata().
  Categories: [
    { n: 'Type',       w: 110, a: 'left',   list: 'Category Types' },
    { n: 'Active',     w: 90,  a: 'center', list: 'Yes/No' },
    { n: 'Sort Order', w: 100, a: 'right',  f: 'int' }
  ],

  // Off by default — see LUMA.extendTransactions.
  Transactions: [
    { n: 'Transaction ID', w: 130, a: 'left' },
    { n: 'Account ID',     w: 110, a: 'left' },
    { n: 'Source',         w: 110, a: 'left' }
  ]
};

var LUMA_LISTS_SHEET = 'Lists';

/* ========================================================================== */
/*  BACKUP                                                                    */
/* ========================================================================== */

/** Timestamped copy in the same Drive folder. Run before structural changes. */
function backupLumaSpreadsheet() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var file = DriveApp.getFileById(ss.getId());
  var name = ss.getName() + ' — backup ' +
             Utilities.formatDate(new Date(), LUMA.timezone, 'yyyy-MM-dd HHmm');

  var parents = file.getParents();
  var copy = parents.hasNext() ? file.makeCopy(name, parents.next()) : file.makeCopy(name);

  Logger.log('Backup created: ' + copy.getUrl());
  return copy.getUrl();
}

/* ========================================================================== */
/*  SETUP — idempotent                                                        */
/* ========================================================================== */

function setupLumaSheets() {
  assertLumaDependencies_();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var report = { created: [], extended: [], styled: [] };

  // Asia/Calcutta is the legacy IANA alias for Asia/Kolkata — same UTC+05:30,
  // same rules. Rewriting one to the other would change nothing, so don't.
  if (!sameTimeZone_(ss.getSpreadsheetTimeZone(), LUMA.timezone)) {
    ss.setSpreadsheetTimeZone(LUMA.timezone);
    Logger.log('Spreadsheet timezone set to ' + LUMA.timezone +
               '. Also set "timeZone" in appsscript.json to match.');
  }

  buildListsSheet_(ss);

  // New entity sheets.
  Object.keys(LUMA_SCHEMA).forEach(function (name) {
    var schema  = LUMA_SCHEMA[name];
    var existed = !!ss.getSheetByName(name);
    var sh      = ensureLumaSheet_(ss, name);

    ensureColumns_(sh, schema.cols);
    styleEntitySheet_(ss, sh, schema);

    (existed ? report.extended : report.created).push(name);
    report.styled.push(name);
  });

  seedSettings_(ss);

  // Existing sheets: append-only extensions.
  Object.keys(LUMA_EXTENSIONS).forEach(function (name) {
    if (name === 'Transactions' && !LUMA.extendTransactions) return;
    var sh = ss.getSheetByName(name);
    if (!sh) return;

    var added = ensureColumns_(sh, LUMA_EXTENSIONS[name]);
    if (added.length) {
      report.extended.push(name + ' (+' + added.join(', ') + ')');
      styleAppendedColumns_(ss, sh, LUMA_EXTENSIONS[name]);
    }
  });

  SpreadsheetApp.flush();
  Logger.log('Created:  ' + (report.created.join(', ')  || 'none'));
  Logger.log('Extended: ' + (report.extended.join(', ') || 'none'));
  return report;
}

function assertLumaDependencies_() {
  var missing = [];
  if (typeof C === 'undefined')         missing.push('C (palette)');
  if (typeof CFG === 'undefined')       missing.push('CFG (config)');
  if (typeof styleTable !== 'function') missing.push('styleTable()');
  if (typeof cf_ !== 'function')        missing.push('cf_()');
  if (typeof keepForeignRules_ !== 'function') missing.push('keepForeignRules_()');
  if (missing.length) {
    throw new Error('Luma_Data needs Dashboard_Restyle.gs in this project. Missing: ' +
                    missing.join(', '));
  }
}

function ensureLumaSheet_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (sh) return sh;
  sh = ss.insertSheet(name);
  Logger.log('Created sheet: ' + name);
  return sh;
}

/**
 * Makes sure every column in `cols` exists, matching on header text.
 * Missing ones are APPENDED to the right. Nothing is reordered, renamed,
 * moved or cleared. Returns the list of headers it added.
 */
function ensureColumns_(sh, cols) {
  var width   = Math.max(sh.getLastColumn(), 1);
  var headers = sh.getRange(1, 1, 1, width).getValues()[0]
                  .map(function (h) { return String(h).trim(); });

  var have = {};
  headers.forEach(function (h) { if (h) have[h.toLowerCase()] = true; });

  // Append after the last NON-EMPTY header, not after the count of them, so a
  // gap in the header row can never cause an existing column to be overwritten.
  var lastUsed = 0;
  for (var i = 0; i < headers.length; i++) {
    if (headers[i] !== '') lastUsed = i + 1;
  }

  var addedHeaders = [];
  var nextCol = lastUsed + 1;

  cols.forEach(function (c) {
    if (have[c.n.toLowerCase()]) return;
    if (nextCol > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), 1);
    sh.getRange(1, nextCol).setValue(c.n);
    addedHeaders.push(c.n);
    nextCol++;
  });

  return addedHeaders;
}

/* ========================================================================== */
/*  STYLING — schema driven, reuses styleTable() from Dashboard_Restyle.gs    */
/* ========================================================================== */

function numberFormatFor_(key) {
  switch (key) {
    case 'money':    return LUMA.money;
    case 'money2':   return LUMA.money2;
    case 'date':     return LUMA.date;
    case 'datetime': return LUMA.datetime;
    case 'rate':     return LUMA.rate;
    case 'int':      return '0';
    case 'qty':      return '#,##0.####';
    case 'text':     return '@';   // keeps "0042" and long Drive IDs intact
    default:         return null;
  }
}

function styleEntitySheet_(ss, sh, schema) {
  var cols    = schema.cols;
  var lastRow = sh.getMaxRows();
  if (lastRow < 2) return;

  var colSpec = {};
  var widths  = {};

  cols.forEach(function (c, i) {
    var letter = colLetterL_(i + 1);
    widths[letter] = c.w;

    var spec = { align: c.a || 'left' };
    var fmt = numberFormatFor_(c.f);
    if (fmt) spec.fmt = fmt;
    if (/(^| )ID$/.test(c.n) || c.n === 'Created At' || c.n === 'Updated At') spec.color = C.muted;
    colSpec[letter] = spec;
  });

  styleTable(sh, {
    header: 'A1:' + colLetterL_(cols.length) + '1',
    body:   'A2:' + colLetterL_(cols.length) + lastRow,
    theme:  'navy',
    cols:   colSpec
  });

  applyColumnWidths_(sh, widths);
  sh.setRowHeight(1, 30);
  if (sh.getFrozenRows() === 0) sh.setFrozenRows(1);

  // Wrapped columns have to be re-applied: styleTable clips the whole body.
  cols.forEach(function (c, i) {
    if (!c.wrap) return;
    sh.getRange(2, i + 1, lastRow - 1, 1)
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  });

  applyEntityValidation_(ss, sh, schema);
  applyEntityConditionalFormatting_(sh, schema);

  if (LUMA.addFilters && !sh.getFilter()) {
    sh.getRange(1, 1, Math.max(sh.getLastRow(), 2), cols.length).createFilter();
  }
}

/** Format/validate only the columns just appended to an existing sheet. */
function styleAppendedColumns_(ss, sh, cols) {
  var lastRow = sh.getMaxRows();
  if (lastRow < 2) return;

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
                  .map(function (h) { return String(h).trim().toLowerCase(); });

  cols.forEach(function (c) {
    var idx = headers.indexOf(c.n.toLowerCase());
    if (idx < 0) return;
    var col = idx + 1;

    sh.setColumnWidth(col, c.w);

    var header = sh.getRange(1, col);
    header.setBackground(C.navy).setFontColor(C.card)
          .setFontFamily(CFG.font).setFontSize(9).setFontWeight('bold')
          .setVerticalAlignment('middle');

    var body = sh.getRange(2, col, lastRow - 1, 1);
    body.setFontFamily(CFG.font).setFontSize(10)
        .setHorizontalAlignment(c.a || 'left')
        .setVerticalAlignment('middle');

    var fmt = numberFormatFor_(c.f);
    if (fmt) body.setNumberFormat(fmt);
    if (/(^| )ID$/.test(c.n) || c.n === 'Created At' || c.n === 'Updated At') {
      body.setFontColor(C.muted);
    }
    if (c.list) body.setDataValidation(listValidation_(ss, c.list));
  });
}

function applyEntityValidation_(ss, sh, schema) {
  var lastRow = sh.getMaxRows();
  if (lastRow < 2) return;

  schema.cols.forEach(function (c, i) {
    if (!c.list) return;
    var rule = listValidation_(ss, c.list);
    if (rule) sh.getRange(2, i + 1, lastRow - 1, 1).setDataValidation(rule);
  });
}

/** Validation that points at the Lists sheet, so lists stay centralised and
 *  the user can edit them without touching code. Permissive on purpose: the
 *  API must never be rejected by a dropdown. */
function listValidation_(ss, listName) {
  var lists = ss.getSheetByName(LUMA_LISTS_SHEET);
  if (!lists) return null;

  var headers = lists.getRange(1, 1, 1, Math.max(lists.getLastColumn(), 1))
                     .getValues()[0].map(function (h) { return String(h).trim(); });
  var idx = headers.indexOf(listName);
  if (idx < 0) return null;

  return SpreadsheetApp.newDataValidation()
    .requireValueInRange(lists.getRange(2, idx + 1, Math.max(lists.getMaxRows() - 1, 1), 1), true)
    .setAllowInvalid(true)
    .build();
}

function applyEntityConditionalFormatting_(sh, schema) {
  if (!schema.cf || !schema.cf.length) return;

  var lastRow = sh.getMaxRows();
  var nCols   = schema.cols.length;
  var body    = 'A2:' + colLetterL_(nCols) + lastRow;

  var ranges = [body];
  schema.cf.forEach(function (rule) {
    var idx = indexOfCol_(schema.cols, rule.col);
    if (idx >= 0) ranges.push(colLetterL_(idx + 1) + '2:' + colLetterL_(idx + 1) + lastRow);
  });

  var rules = keepForeignRules_(sh, ranges);

  rules.push(cf_(sh, body, function (b) {
    return b.whenFormulaSatisfied('=AND($A2<>"",ISEVEN(ROW()))').setBackground(C.stripe);
  }));

  var palette = { red: C.red, green: C.green, amber: C.amber,
                  muted: C.muted, navy: C.navy, purple: C.purple, blue: C.blue };

  schema.cf.forEach(function (rule) {
    var idx = indexOfCol_(schema.cols, rule.col);
    if (idx < 0) return;
    var a1 = colLetterL_(idx + 1) + '2:' + colLetterL_(idx + 1) + lastRow;
    rules.push(cf_(sh, a1, function (b) {
      return b.whenTextEqualTo(rule.equals).setFontColor(palette[rule.color] || C.text);
    }));
  });

  sh.setConditionalFormatRules(rules);
}

/* ========================================================================== */
/*  LISTS + SETTINGS                                                          */
/* ========================================================================== */

function buildListsSheet_(ss) {
  var sh    = ensureLumaSheet_(ss, LUMA_LISTS_SHEET);
  var names = Object.keys(LUMA_LISTS);

  if (sh.getMaxColumns() < names.length) {
    sh.insertColumnsAfter(sh.getMaxColumns(), names.length - sh.getMaxColumns());
  }

  var existing = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0]
                   .map(function (h) { return String(h).trim(); });

  names.forEach(function (name, i) {
    var col    = i + 1;
    var values = LUMA_LISTS[name];

    if (existing[i] !== name) sh.getRange(1, col).setValue(name);

    // Only fill a column that is empty, so edits to a list are never clobbered.
    var height  = Math.max(sh.getMaxRows() - 1, 1);
    var current = sh.getRange(2, col, height, 1).getValues()
                    .filter(function (r) { return String(r[0]).trim() !== ''; });
    if (current.length) return;

    if (sh.getMaxRows() < values.length + 1) {
      sh.insertRowsAfter(sh.getMaxRows(), values.length + 1 - sh.getMaxRows());
    }
    sh.getRange(2, col, values.length, 1)
      .setValues(values.map(function (v) { return [v]; }));
  });

  styleTable(sh, {
    header: 'A1:' + colLetterL_(names.length) + '1',
    body:   'A2:' + colLetterL_(names.length) + sh.getMaxRows(),
    theme:  'navy',
    cols:   {}
  });
  names.forEach(function (n, i) { sh.setColumnWidth(i + 1, Math.max(120, n.length * 9)); });
  sh.setRowHeight(1, 30);
  if (sh.getFrozenRows() === 0) sh.setFrozenRows(1);
}

/** Writes a setting row only when that setting is absent. Never overwrites. */
function seedSettings_(ss) {
  var sh = ss.getSheetByName('Settings');
  if (!sh) return;

  var last    = sh.getLastRow();
  var present = {};
  if (last >= 2) {
    sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (r) {
      var k = String(r[0]).trim();
      if (k) present[k.toLowerCase()] = true;
    });
  }

  var toAdd = LUMA_SETTINGS.filter(function (row) { return !present[row[0].toLowerCase()]; });
  if (!toAdd.length) return;

  var start = Math.max(sh.getLastRow() + 1, 2);
  if (sh.getMaxRows() < start + toAdd.length - 1) {
    sh.insertRowsAfter(sh.getMaxRows(), start + toAdd.length - 1 - sh.getMaxRows());
  }
  sh.getRange(start, 1, toAdd.length, 3).setValues(toAdd);
}

/* ========================================================================== */
/*  IDs — stable, never derived from row position                             */
/* ========================================================================== */

/**
 * Next N ids for a sheet. Takes the highest of (a) the largest suffix already
 * present and (b) a stored high-water mark, so deleting or sorting rows can
 * never cause an id to be reused.
 */
function nextLumaIds_(sh, prefix, idCol, count) {
  var props = PropertiesService.getDocumentProperties();
  var key   = 'LUMA_SEQ_' + prefix;
  var high  = Number(props.getProperty(key) || 0);

  var last = sh.getLastRow();
  if (last >= 2) {
    var re = new RegExp('^' + prefix + '-(\\d+)$');
    sh.getRange(2, idCol, last - 1, 1).getValues().forEach(function (r) {
      var m = re.exec(String(r[0]).trim());
      if (m) high = Math.max(high, Number(m[1]));
    });
  }

  var ids = [];
  for (var i = 1; i <= (count || 1); i++) {
    ids.push(prefix + '-' + padLeft_(high + i, 6));
  }
  props.setProperty(key, String(high + (count || 1)));
  return ids;
}

/** Fills empty Transaction ID cells in one batched write. Opt-in, never
 *  touches a row that already has an id, never changes any other column. */
function backfillTransactionIds() {
  if (!LUMA.extendTransactions) {
    throw new Error('Set LUMA.extendTransactions = true and re-run setupLumaSheets() first.');
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Transactions');
  if (!sh) throw new Error('No Transactions sheet.');

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
                  .map(function (h) { return String(h).trim().toLowerCase(); });
  var idCol = headers.indexOf('transaction id') + 1;
  if (!idCol) throw new Error('No "Transaction ID" column. Run setupLumaSheets() first.');

  var last = sh.getLastRow();
  if (last < 2) return 0;

  var existing = sh.getRange(2, idCol, last - 1, 1).getValues();
  var blanks   = [];
  existing.forEach(function (r, i) { if (String(r[0]).trim() === '') blanks.push(i); });
  if (!blanks.length) return 0;

  return withLumaLock_(function () {
    var ids = nextLumaIds_(sh, 'TXN', idCol, blanks.length);
    blanks.forEach(function (rowIdx, k) { existing[rowIdx][0] = ids[k]; });

    sh.getRange(2, idCol, existing.length, 1).setValues(existing);   // one write
    Logger.log('Backfilled ' + blanks.length + ' transaction id(s).');
    return blanks.length;
  });
}

/** Opt-in: marks existing Categories rows as Expense/Active and appends the
 *  income categories from your spec. Writes only into blank cells. */
function backfillCategoryMetadata() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Categories');
  if (!sh) throw new Error('No Categories sheet.');

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
                  .map(function (h) { return String(h).trim().toLowerCase(); });
  var typeCol   = headers.indexOf('type') + 1;
  var activeCol = headers.indexOf('active') + 1;
  var sortCol   = headers.indexOf('sort order') + 1;
  if (!typeCol) throw new Error('Run setupLumaSheets() first.');

  var last = sh.getLastRow();
  if (last < 2) return 0;

  var n    = last - 1;
  var type = sh.getRange(2, typeCol, n, 1).getValues();
  var act  = activeCol ? sh.getRange(2, activeCol, n, 1).getValues() : null;
  var srt  = sortCol   ? sh.getRange(2, sortCol,   n, 1).getValues() : null;
  var cats = sh.getRange(2, 1, n, 1).getValues();

  for (var i = 0; i < n; i++) {
    if (String(cats[i][0]).trim() === '') continue;
    if (String(type[i][0]).trim() === '') type[i][0] = 'Expense';
    if (act && String(act[i][0]).trim() === '') act[i][0] = true;
    if (srt && String(srt[i][0]).trim() === '') srt[i][0] = (i + 1) * 10;
  }

  sh.getRange(2, typeCol, n, 1).setValues(type);
  if (act) sh.getRange(2, activeCol, n, 1).setValues(act);
  if (srt) sh.getRange(2, sortCol,   n, 1).setValues(srt);

  appendIncomeCategories_(sh, typeCol, activeCol, sortCol);
  return n;
}

function appendIncomeCategories_(sh, typeCol, activeCol, sortCol) {
  var income = [
    ['Income', 'Salary'], ['Income', 'Freelance'], ['Income', 'Business'],
    ['Income', 'Investment Gain'], ['Income', 'Interest'], ['Income', 'Dividend'],
    ['Income', 'Refund'], ['Income', 'Cashback'], ['Income', 'Other'],
    ['Investment Gain', 'IPO'], ['Investment Gain', 'Stock'],
    ['Investment Gain', 'Mutual Fund'], ['Investment Gain', 'Gold'],
    ['Investment Gain', 'Other']
  ];

  var last    = sh.getLastRow();
  var present = {};
  if (last >= 2) {
    sh.getRange(2, 1, last - 1, 2).getValues().forEach(function (r) {
      present[(String(r[0]) + '|' + String(r[1])).toLowerCase()] = true;
    });
  }

  var rows = income.filter(function (r) {
    return !present[(r[0] + '|' + r[1]).toLowerCase()];
  });
  if (!rows.length) return 0;

  var start = last + 1;
  var width = sh.getLastColumn();
  if (sh.getMaxRows() < start + rows.length - 1) {
    sh.insertRowsAfter(sh.getMaxRows(), start + rows.length - 1 - sh.getMaxRows());
  }

  var block = rows.map(function (r) {
    var row = blankRow_(width);
    row[0] = r[0];
    row[1] = r[1];
    if (typeCol)   row[typeCol - 1]   = 'Income';
    if (activeCol) row[activeCol - 1] = true;
    return row;
  });

  sh.getRange(start, 1, block.length, width).setValues(block);   // one write
  Logger.log('Appended ' + block.length + ' income category row(s).');
  return block.length;
}

/* ========================================================================== */
/*  READ API — additive router, never defines doGet                           */
/* ========================================================================== */

/** Actions that belong to the existing web app. Always handed straight back. */
var LUMA_RESERVED_ACTIONS = { 'health': 1, 'transactions': 1 };

var LUMA_GET_ROUTES = {
  'accounts':    'Accounts',
  'investments': 'Investments',
  'sips':        'SIPs',
  'udhaar':      'Udhaar',
  'notes':       'Notes',
  'documents':   'Documents',
  'tasks':       'Tasks',
  'liabilities': 'Liabilities',
  'settings':    'Settings',
  'categories':  'Categories',
  'lists':       'Lists'
};

/**
 * Call as the first statement of your doGet(e).
 * Returns null for health, transactions, a missing action and anything it does
 * not recognise, so existing routes are untouched. Never throws.
 */
function tryHandleLumaGet_(e) {
  var action;
  try {
    action = String((e && e.parameter && e.parameter.action) || '').trim().toLowerCase();
    if (!action) return null;
    if (LUMA_RESERVED_ACTIONS[action]) return null;
    if (!LUMA_GET_ROUTES[action]) return null;
  } catch (err) {
    return null;
  }

  try {
    // includeArchived=true opts into archived/inactive records too (audit use).
    // Default (param absent) is unchanged from before archiving existed: every
    // row comes back, since no row can yet be flagged archived unless someone
    // has explicitly archived it through the new lifecycle API.
    var includeArchived = String((e && e.parameter && e.parameter.includeArchived) || '')
      .trim().toLowerCase() === 'true';
    var rows = readEntity_(LUMA_GET_ROUTES[action], includeArchived);
    return lumaJson_({ success: true, count: rows.length, data: rows });
  } catch (err) {
    return lumaJson_({ success: false, error: safeMessage_(err) });
  }
}

/**
 * Whole sheet as objects keyed by camelCased header. One read, no per-cell
 * calls. Numbers stay numbers; dates become ISO strings in Asia/Kolkata;
 * formatting stays in the UI where it belongs.
 */
function readEntity_(sheetName, includeArchived) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sh) throw new Error('Sheet not found: ' + sheetName);

  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  var values  = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0].map(function (h) { return camelKey_(String(h)); });

  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row   = values[r];
    var empty = row.every(function (v) { return v === '' || v === null; });
    if (empty) continue;

    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      obj[headers[c]] = serializeCell_(row[c]);
    }
    if (!includeArchived && isLumaArchived_(sheetName, obj)) continue;
    out.push(obj);
  }
  return out;
}

function serializeCell_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, LUMA.timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
  }
  return v === '' ? null : v;
}

/* ========================================================================== */
/*  WRITE API — additive router, never defines doPost                         */
/* ========================================================================== */

/**
 * Udhaar is deliberately absent: its writes go through tryHandleUdhaar_ in
 * Udhaar.gs, which also applies the running-balance and status formulas.
 * Routing it here would bypass that.
 */
var LUMA_POST_ROUTES = {
  'account':     'Accounts',
  'investment':  'Investments',
  'sip':         'SIPs',
  'note':        'Notes',
  'document':    'Documents',
  'task':        'Tasks',
  'liability':   'Liabilities'
};

/**
 * Call after tryHandleUdhaar_ and before your existing POST code.
 * Returns null unless the body names one of the entities above, so a payload
 * with no "action" always falls through to the current transaction behaviour.
 * Never throws.
 */
function tryHandleLumaPost_(e) {
  var payload, sheetName;
  try {
    payload   = parseLumaPayload_(e);
    var action = String(payload.action || '').trim().toLowerCase();
    if (!action) return null;
    sheetName = LUMA_POST_ROUTES[action];
    if (!sheetName) return null;
  } catch (err) {
    return null;
  }

  try {
    return lumaJson_(createEntity_(sheetName, payload));
  } catch (err) {
    return lumaJson_({ success: false, error: safeMessage_(err) });
  }
}

function parseLumaPayload_(e) {
  var out = {};
  if (!e) return out;

  // Every router asks for the payload; parse the body once per request (it can be MBs for
  // uploads) and hand each caller its own shallow copy, so one can't change another's view.
  if (e.postData && e.postData.contents) {
    if (e.__lumaParsed === undefined) {
      e.__lumaParsed = null;
      try {
        var parsed = JSON.parse(e.postData.contents);
        if (parsed && typeof parsed === 'object') e.__lumaParsed = parsed;
      } catch (ignored) { /* not JSON */ }
    }
    if (e.__lumaParsed) {
      Object.keys(e.__lumaParsed).forEach(function (k) { out[k] = e.__lumaParsed[k]; });
    }
  }
  if (e.parameter) {
    Object.keys(e.parameter).forEach(function (k) {
      if (!(k in out)) out[k] = e.parameter[k];
    });
  }
  return out;
}

/**
 * Appends one row to an entity sheet: generates the id, stamps Created At and
 * Updated At, maps camelCase payload keys onto headers, and writes once.
 */
function createEntity_(sheetName, payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Sheet not found: ' + sheetName + '. Run setupLumaSheets().');

  var schema = LUMA_SCHEMA[sheetName];
  if (!schema) throw new Error('No schema for ' + sheetName);

  var lastCol = Math.max(sh.getLastColumn(), schema.cols.length);
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0]
                  .map(function (h) { return String(h).trim(); });

  var row = blankRow_(lastCol);
  var now = new Date();

  var idCol = headers.indexOf(schema.cols[0].n) + 1;
  var newId = schema.idPrefix
    ? withLumaLock_(function () { return nextLumaIds_(sh, schema.idPrefix, idCol || 1, 1)[0]; })
    : '';

  headers.forEach(function (header, i) {
    if (!header) return;

    if (schema.idPrefix && i === idCol - 1) { row[i] = newId; return; }
    if (header === 'Created At' || header === 'Updated At') { row[i] = now; return; }

    var spec = schema.cols[indexOfCol_(schema.cols, header)];
    var raw  = payload[camelKey_(header)];
    if (raw === undefined || raw === null || raw === '') return;

    row[i] = coerceValue_(raw, spec && spec.f);
  });

  var target = Math.max(sh.getLastRow() + 1, 2);
  if (sh.getMaxRows() < target) sh.insertRowsAfter(sh.getMaxRows(), target - sh.getMaxRows());
  sh.getRange(target, 1, 1, lastCol).setValues([row]);   // one write

  applyRowFormulas_(sh, schema, target);

  return { success: true, message: sheetName + ' record saved', id: newId, row: target };
}

/** Per-row derived columns declared in the schema (e.g. investment gains). */
function applyRowFormulas_(sh, schema, row) {
  schema.cols.forEach(function (c, i) {
    if (typeof c.formula !== 'function') return;
    sh.getRange(row, i + 1).setFormula(c.formula(row));
  });
}

/** Keeps numbers numeric and dates as real dates. Currency symbols never
 *  enter the value — they live in the number format. */
function coerceValue_(raw, fmtKey) {
  if (fmtKey === 'money' || fmtKey === 'money2' || fmtKey === 'qty' ||
      fmtKey === 'int'   || fmtKey === 'rate') {
    if (typeof raw === 'number') return raw;
    var n = Number(String(raw).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : raw;
  }

  if (fmtKey === 'date' || fmtKey === 'datetime') {
    var d = parseLumaDate_(raw);
    return d || raw;
  }

  if (typeof raw === 'string') {
    var t = raw.trim();
    if (t.toLowerCase() === 'true')  return true;
    if (t.toLowerCase() === 'false') return false;
    return t;
  }
  return raw;
}

function parseLumaDate_(raw) {
  if (!raw) return null;
  if (Object.prototype.toString.call(raw) === '[object Date]') {
    return isNaN(raw.getTime()) ? null : raw;
  }
  var s = String(raw).trim();
  var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function lumaJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}

/** Never leaks a stack trace to the client. */
function safeMessage_(err) {
  var msg = String((err && err.message) || err || 'Unknown error');
  return msg.split('\n')[0].slice(0, 300);
}

/* ========================================================================== */
/*  helpers                                                                   */
/* ========================================================================== */

/** 'Account Number Last 4' -> 'accountNumberLast4' */
function camelKey_(header) {
  var parts = String(header).replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/);
  if (!parts.length || parts[0] === '') return '';
  return parts.map(function (w, i) {
    var lower = w.toLowerCase();
    return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join('');
}

function indexOfCol_(cols, name) {
  var target = String(name).trim().toLowerCase();
  for (var i = 0; i < cols.length; i++) {
    if (cols[i].n.toLowerCase() === target) return i;
  }
  return -1;
}

function colLetterL_(n) {
  var s = '';
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = (n - m - 1) / 26;
  }
  return s;
}

/** True for zones that are the same zone under different IANA names. */
function sameTimeZone_(a, b) {
  var aliases = { 'asia/calcutta': 'asia/kolkata', 'asia/kolkata': 'asia/kolkata' };
  var x = String(a || '').toLowerCase();
  var y = String(b || '').toLowerCase();
  return (aliases[x] || x) === (aliases[y] || y);
}

/** new Array(n).fill('') without relying on the V8 runtime. */
function blankRow_(n) {
  var a = [];
  for (var i = 0; i < n; i++) a.push('');
  return a;
}

function padLeft_(n, width) {
  var s = String(n);
  while (s.length < width) s = '0' + s;
  return s;
}