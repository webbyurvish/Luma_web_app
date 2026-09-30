/**
 * ============================================================================
 *  UDHAAR / MONEY LENT — NEW MODULE
 * ============================================================================
 *
 *  A self-contained addition to the existing expense tracker. Add this as a
 *  NEW script file called "Udhaar". Do not paste it over Dashboard_Restyle or
 *  over your web-app file.
 *
 *  ## THIS FILE DOES NOT DEFINE doPost()
 *
 *  That is deliberate and it is the most important thing to understand here.
 *  Apps Script shares one global namespace across every .gs file in a project,
 *  so if this file declared doPost() it would silently override yours and your
 *  iPhone expense Shortcut would stop working. Instead it exposes
 *  tryHandleUdhaar_(e), and you add exactly two lines to your own doPost.
 *  See "STEP 2 — PATCH YOUR doPost" below.
 *
 *  ## DEPENDENCY
 *
 *  Reuses the palette (C), config (CFG) and styleTable() already defined in
 *  Dashboard_Restyle.gs, so the Udhaar section matches the rest of the
 *  dashboard exactly and no styling logic is duplicated. assertDependencies_()
 *  gives a clear error if that file is missing.
 *
 *  ## WHAT IT TOUCHES
 *
 *  Creates : the "Udhaar" sheet (only if absent).
 *  Writes  : Dashboard rows 47-95 only, and only into cells that are empty or
 *            already hold this module's own content. It refuses to start if
 *            anything unexpected is there.
 *  Never   : touches Transactions, Categories, Budget, Form Responses 1, the
 *            Dashboard above row 46, any existing formula, chart, merge, named
 *            range, the web app URL, its JSON fields, or the expense Shortcut.
 *
 *  ## SETUP
 *
 *  STEP 1 — run  setupUdhaar()  once from the editor.
 *  STEP 2 — patch your doPost (two lines, see below).
 *  STEP 3 — build the "Add Udhaar" Shortcut.
 *
 *  From then on use  restyleEverything()  rather than restyleWorkbook(),
 *  because restyleWorkbook() repaints the Dashboard background and would leave
 *  the Udhaar cards on grey if run on its own.
 *
 *  ### STEP 2 — PATCH YOUR doPost
 *
 *  Open your existing web-app file and make the first two statements of
 *  doPost(e) these:
 *
 *      function doPost(e) {
 *        var udhaar = tryHandleUdhaar_(e);        // <-- ADD
 *        if (udhaar) return udhaar;               // <-- ADD
 *
 *        ... your existing code, completely unchanged ...
 *      }
 *
 *  tryHandleUdhaar_ returns null for anything that is not an Udhaar payload,
 *  so every existing request falls straight through to your code on the very
 *  next line. It cannot throw: any internal failure is caught and returned as
 *  JSON. Re-deploy the web app afterwards (same URL if you deploy as a new
 *  version of the existing deployment).
 * ============================================================================
 */

var UDHAAR = {
  sheet: 'Udhaar',

  headers: ['Timestamp', 'Date', 'Person', 'Type', 'Amount', 'Description',
            'Due Date', 'Payment Method', 'Note', 'Month', 'Outstanding', 'Status'],

  TYPE_GIVEN:     'Given',
  TYPE_REPAYMENT: 'Repayment',

  dueSoonDays: 7,

  // Dashboard block. Everything here is below the existing content, which
  // ends at row 45. Nothing above row 47 is ever written.
  dash: {
    titleRow:        48,
    subtitleRow:     49,
    kpiLabelRow:     51,
    kpiValueRow:     52,   // merged 52:54, mirroring the existing cards
    kpiValueRowEnd:  54,
    owesTitleRow:    56,
    owesHeaderRow:   58,
    owesFirstRow:    59,
    owesMaxRows:     18,   // 59-76
    upcomingTitleRow:   79,
    upcomingHeaderRow:  81,
    upcomingFirstRow:   82,
    upcomingMaxRows:    12, // 82-93
    lastRow:         95
  },

  /** Bar chart of outstanding per person. Off by default: its source has to be
   *  a fixed range, so unused rows show as blank categories. Turn on only if
   *  you keep a steady set of debtors. */
  addChart: false
};

/* ========================================================================== */
/*  SETUP — idempotent, safe to re-run                                        */
/* ========================================================================== */

/**
 * Run this instead of restyleWorkbook() from now on.
 *
 * restyleWorkbook() repaints the whole Dashboard background before restyling
 * rows 1-45, which would leave the Udhaar cards below sitting on grey. Running
 * the two in this order keeps both sections correct, and both are idempotent.
 */
function restyleEverything() {
  restyleWorkbook();
  setupUdhaar();
}

function setupUdhaar() {
  assertDependencies_();

  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var sh   = ensureUdhaarSheet_(ss);
  var dash = ss.getSheetByName('Dashboard');
  if (!dash) throw new Error('No "Dashboard" sheet. Nothing was changed.');

  writeUdhaarHeaders_(sh);
  applyUdhaarValidation_(ss, sh);
  styleUdhaarSheet_(sh);
  backfillUdhaarFormulas_(sh);
  buildUdhaarDashboard_(dash);

  SpreadsheetApp.flush();
  Logger.log('Udhaar module ready. Next: patch doPost with the two lines in this file\'s header.');
}

/** The module leans on Dashboard_Restyle.gs. Fail loudly rather than half-style. */
function assertDependencies_() {
  var missing = [];
  if (typeof C === 'undefined')          missing.push('C (palette)');
  if (typeof CFG === 'undefined')        missing.push('CFG (config)');
  if (typeof styleTable !== 'function')  missing.push('styleTable()');
  if (missing.length) {
    throw new Error('Udhaar needs Dashboard_Restyle.gs in this project. Missing: ' +
                    missing.join(', '));
  }
}

/** Create the sheet only if it is genuinely absent. Never a duplicate. */
function ensureUdhaarSheet_(ss) {
  var sh = ss.getSheetByName(UDHAAR.sheet);
  if (sh) return sh;

  sh = ss.insertSheet(UDHAAR.sheet);
  Logger.log('Created "' + UDHAAR.sheet + '" sheet.');
  return sh;
}

/** Headers are written only into an empty row 1, so an existing sheet with its
 *  own header row is never overwritten. */
function writeUdhaarHeaders_(sh) {
  var row1 = sh.getRange(1, 1, 1, UDHAAR.headers.length);
  if (row1.isBlank()) {
    row1.setValues([UDHAAR.headers]);
    return;
  }

  var found = row1.getValues()[0].map(function (v) { return String(v).trim(); });
  var want  = UDHAAR.headers;
  var diff  = [];
  for (var i = 0; i < want.length; i++) {
    if (found[i] !== want[i]) diff.push(colLetter_(i + 1) + '1 is "' + found[i] + '", expected "' + want[i] + '"');
  }
  if (diff.length) {
    throw new Error('The "Udhaar" sheet already exists with a different header row, so ' +
                    'nothing was changed. Fix or rename it first:\n  ' + diff.join('\n  '));
  }
}

/** Type list, plus payment methods read from the dashboard so they always match
 *  whatever the expense system already uses. Person stays a free text field. */
function applyUdhaarValidation_(ss, sh) {
  var lastRow = sh.getMaxRows();
  if (lastRow < 2) return;

  var typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList([UDHAAR.TYPE_GIVEN, UDHAAR.TYPE_REPAYMENT], true)
    .setAllowInvalid(false)
    .build();
  sh.getRange(2, 4, lastRow - 1, 1).setDataValidation(typeRule);

  var methods = readPaymentMethods_(ss);
  if (methods.length) {
    var payRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(methods, true)
      .setAllowInvalid(true)   // permissive: the API must never be rejected by a dropdown
      .build();
    sh.getRange(2, 8, lastRow - 1, 1).setDataValidation(payRule);
  }
}

/** Payment methods as the dashboard already lists them (E14:E19). */
function readPaymentMethods_(ss) {
  var dash = ss.getSheetByName('Dashboard');
  if (!dash) return [];
  return dash.getRange('E14:E19').getValues()
    .map(function (r) { return String(r[0]).trim(); })
    .filter(function (v) { return v !== ''; });
}

/* ========================================================================== */
/*  UDHAAR SHEET STYLING — reuses styleTable() from Dashboard_Restyle.gs      */
/* ========================================================================== */

function styleUdhaarSheet_(sh) {
  var lastRow = sh.getMaxRows();
  if (lastRow < 2) return;

  var dateOnly = 'dd mmm yyyy';

  styleTable(sh, {
    header: 'A1:L1',
    body:   'A2:L' + lastRow,
    theme:  'navy',
    cols: {
      A: { align: 'left',  fmt: CFG.date,  color: C.muted },   // Timestamp
      B: { align: 'left',  fmt: CFG.date },                    // Date
      C: { align: 'left' },                                    // Person
      D: { align: 'left' },                                    // Type
      E: { align: 'right', fmt: CFG.money, bold: true },       // Amount
      F: { align: 'left',  color: C.muted },                   // Description
      G: { align: 'left',  fmt: dateOnly },                    // Due Date
      H: { align: 'left' },                                    // Payment Method
      I: { align: 'left',  color: C.muted },                   // Note
      J: { align: 'left',  fmt: 'mmm yyyy', color: C.muted },  // Month
      K: { align: 'right', fmt: CFG.money, bold: true },       // Outstanding
      L: { align: 'left',  bold: true }                        // Status
    }
  });

  applyColumnWidths_(sh, {
    A: 150, B: 150, C: 120, D: 95, E: 100, F: 150,
    G: 120, H: 125, I: 150, J: 95, K: 110, L: 100
  });

  sh.setRowHeight(1, 30);
  if (sh.getFrozenRows() === 0) sh.setFrozenRows(1);

  applyUdhaarSheetConditionalFormatting_(sh, lastRow);
}

function applyUdhaarSheetConditionalFormatting_(sh, lastRow) {
  var body      = 'A2:L' + lastRow;
  var statusCol = 'L2:L' + lastRow;
  var typeCol   = 'D2:D' + lastRow;

  var rules = keepForeignRules_(sh, [body, statusCol, typeCol]);

  rules.push(cf_(sh, body, function (b) {
    return b.whenFormulaSatisfied('=AND($C2<>"",ISEVEN(ROW()))').setBackground(C.stripe);
  }));

  pushStatusColorRules_(rules, sh, statusCol);

  // Repayments read green, so incoming money is visible at a glance.
  rules.push(cf_(sh, typeCol, function (b) {
    return b.whenTextEqualTo(UDHAAR.TYPE_REPAYMENT).setFontColor(C.green);
  }));

  sh.setConditionalFormatRules(rules);
}

/** One colour per status, reused by the sheet and by both dashboard tables. */
function pushStatusColorRules_(rules, sh, a1) {
  var map = {
    'Overdue':  C.red,
    'Due Soon': C.amber,
    'Settled':  C.green,
    'Overpaid': C.purple,
    'Pending':  C.muted
  };
  Object.keys(map).forEach(function (status) {
    rules.push(cf_(sh, a1, function (b) {
      return b.whenTextEqualTo(status).setFontColor(map[status]);
    }));
  });
}

/* ========================================================================== */
/*  ROW FORMULAS — Month, Outstanding, Status                                 */
/* ========================================================================== */

/**
 * Status, as a spreadsheet expression.
 * @param o  expression yielding the person's CURRENT outstanding
 * @param d  expression yielding the person's earliest due date, 0 if none
 */
function statusExpr_(o, d) {
  return 'IF(ROUND(' + o + ',2)<0,"Overpaid",' +
          'IF(ROUND(' + o + ',2)=0,"Settled",' +
           'IF(' + d + '=0,"Pending",' +
            'IF(' + d + '<TODAY(),"Overdue",' +
             'IF(' + d + '<=TODAY()+' + UDHAAR.dueSoonDays + ',"Due Soon","Pending")))))';
}

/**
 * The three computed cells for one Udhaar row.
 *
 * Outstanding (K) is the person's running balance AS OF THAT ROW, so the
 * history reads correctly: a 5,000 Given row keeps showing 5,000 even after a
 * later repayment drops the person to 4,000.
 *
 * Status (L) reflects the person's CURRENT position, so every row for someone
 * who has settled flips to Settled at once.
 */
function udhaarRowFormulas_(row) {
  var r = String(row);

  var month = '=IF($B' + r + '="","",DATE(YEAR($B' + r + '),MONTH($B' + r + '),1))';

  var outstanding =
    '=IF($C' + r + '="","",' +
      'SUMIFS($E$2:$E' + r + ',$C$2:$C' + r + ',$C' + r + ',$D$2:$D' + r + ',"' + UDHAAR.TYPE_GIVEN + '")-' +
      'SUMIFS($E$2:$E' + r + ',$C$2:$C' + r + ',$C' + r + ',$D$2:$D' + r + ',"' + UDHAAR.TYPE_REPAYMENT + '"))';

  var status =
    '=IF($C' + r + '="","",LET(' +
      'o,SUMIFS($E:$E,$C:$C,$C' + r + ',$D:$D,"' + UDHAAR.TYPE_GIVEN + '")-' +
        'SUMIFS($E:$E,$C:$C,$C' + r + ',$D:$D,"' + UDHAAR.TYPE_REPAYMENT + '"),' +
      'e,MINIFS($G:$G,$C:$C,$C' + r + ',$G:$G,">0"),' +
      statusExpr_('o', 'e') + '))';

  return [[month, outstanding, status]];
}

/** Write J:L for one row. */
function applyUdhaarRowFormulas_(sh, row) {
  sh.getRange(row, 10, 1, 3).setFormulas(udhaarRowFormulas_(row));
}

/** Fill in J:L wherever a data row is missing them. Never overwrites a row that
 *  already has all three, so manual edits survive. */
function backfillUdhaarFormulas_(sh) {
  sh = sh || SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UDHAAR.sheet);
  if (!sh) return 0;

  var last = sh.getLastRow();
  if (last < 2) return 0;

  var people   = sh.getRange(2, 3, last - 1, 1).getValues();
  var computed = sh.getRange(2, 10, last - 1, 3).getFormulas();
  var filled   = 0;

  for (var i = 0; i < people.length; i++) {
    if (String(people[i][0]).trim() === '') continue;
    var row = i + 2;
    if (computed[i][0] && computed[i][1] && computed[i][2]) continue;
    applyUdhaarRowFormulas_(sh, row);
    filled++;
  }

  if (filled) Logger.log('Backfilled formulas on ' + filled + ' Udhaar row(s).');
  return filled;
}

/* ========================================================================== */
/*  WEB API — additive, never replaces doPost                                 */
/* ========================================================================== */

/**
 * Call this as the first thing inside your existing doPost(e).
 * Returns a JSON ContentService response when the payload is an Udhaar record,
 * and null for absolutely everything else, so existing requests are unaffected.
 * It never throws.
 */
function tryHandleUdhaar_(e) {
  var data;
  try {
    data = parseRequestPayload_(e);
    if (!isUdhaarPayload_(data)) return null;
  } catch (err) {
    return null;   // unparseable: not ours, let the existing handler decide
  }

  try {
    var check = validateUdhaarData_(data);
    if (!check.ok) {
      return jsonOut_({ success: false, error: 'Validation failed', details: check.errors });
    }
    return jsonOut_(saveUdhaarTransaction_(check.value));
  } catch (err) {
    return jsonOut_({ success: false, error: String(err && err.message ? err.message : err) });
  }
}

/** Accepts a JSON body or form-encoded parameters; merges both. */
function parseRequestPayload_(e) {
  var out = {};
  if (!e) return out;

  if (e.postData && e.postData.contents) {
    try {
      var parsed = JSON.parse(e.postData.contents);
      if (parsed && typeof parsed === 'object') out = parsed;
    } catch (ignored) { /* not JSON — fall through to parameters */ }
  }

  if (e.parameter) {
    Object.keys(e.parameter).forEach(function (k) {
      if (!(k in out)) out[k] = e.parameter[k];
    });
  }
  return out;
}

function isUdhaarPayload_(data) {
  return !!data && String(data.recordType || '').trim().toLowerCase() === 'udhaar';
}

/** Defensive validation. Returns {ok, errors, value}. */
function validateUdhaarData_(data) {
  var errors = [];

  var person = String(data.person || '').trim();
  if (!person) errors.push('person is required');

  var type = normalizeUdhaarType_(data.type);
  if (!type) errors.push('type must be "Given" or "Repayment"');

  var amount = toAmount_(data.amount);
  if (!isFinite(amount) || amount <= 0) errors.push('amount must be a positive number');

  var date = toDate_(data.date) || new Date();

  var dueDate = toDate_(data.dueDate);
  if (data.dueDate && !dueDate) errors.push('dueDate could not be read as a date');

  if (errors.length) return { ok: false, errors: errors };

  return {
    ok: true,
    errors: [],
    value: {
      person:        person,
      type:          type,
      amount:        amount,
      date:          date,
      dueDate:       type === UDHAAR.TYPE_REPAYMENT ? null : dueDate,
      description:   String(data.description || '').trim(),
      paymentMethod: String(data.paymentMethod || data.payment || '').trim(),
      note:          String(data.note || '').trim(),
      accountId:     String(data.accountId || '').trim()
    }
  };
}

function normalizeUdhaarType_(raw) {
  var t = String(raw || '').trim().toLowerCase();
  if (t === 'given' || t === 'give' || t === 'lent' || t === 'loan')   return UDHAAR.TYPE_GIVEN;
  if (t === 'repayment' || t === 'repaid' || t === 'return' || t === 'received') return UDHAAR.TYPE_REPAYMENT;
  return null;
}

/**
 * Appends one Udhaar row, applies formulas and formatting, and reports the
 * person's new balance. Over-repayment is recorded, never silently dropped,
 * and comes back as an explicit warning.
 */
function saveUdhaarTransaction_(v) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(UDHAAR.sheet);
  if (!sh) throw new Error('The "Udhaar" sheet does not exist. Run setupUdhaar() once.');

  var before = personTotals_(sh, v.person);

  var row = Math.max(sh.getLastRow() + 1, 2);
  sh.getRange(row, 1, 1, 9).setValues([[
    new Date(), v.date, v.person, v.type, v.amount,
    v.description, v.dueDate || '', v.paymentMethod, v.note
  ]]);
  applyUdhaarRowFormulas_(sh, row);
  applyUdhaarRowFormat_(sh, row);
  var lifecycleId = assignUdhaarLifecycleFields_(sh, row);
  try {
    lumaLinkNewUdhaar_(sh, row, v.accountId); // Luma_Ledger: record the account + update its balance
  } catch (ledgerError) {
    Logger.log('lumaLinkNewUdhaar_ skipped: ' + ledgerError.message);
  }

  var delta       = v.type === UDHAAR.TYPE_GIVEN ? v.amount : -v.amount;
  var outstanding = round2_(before.outstanding + delta);

  var result = {
    success: true,
    message: 'Udhaar saved successfully',
    id: lifecycleId,
    person: v.person,
    type: v.type,
    amount: v.amount,
    outstanding: outstanding,
    status: statusFor_(outstanding, v.dueDate)
  };

  if (outstanding < 0) {
    result.warning = 'Repayment exceeds outstanding by ' + Math.abs(outstanding) +
                     '. The record was saved and ' + v.person +
                     ' now shows as Overpaid rather than a negative receivable.';
  }
  return result;
}

/** Given/Repayment totals for one person, straight from the sheet. */
function personTotals_(sh, person) {
  var last = sh.getLastRow();
  var totals = { given: 0, repaid: 0, outstanding: 0 };
  if (last < 2) return totals;

  var rows = sh.getRange(2, 3, last - 1, 3).getValues();   // C:E — Person, Type, Amount
  var key  = String(person).trim().toLowerCase();

  rows.forEach(function (r) {
    if (String(r[0]).trim().toLowerCase() !== key) return;
    var amt = Number(r[2]) || 0;
    if (r[1] === UDHAAR.TYPE_GIVEN)            totals.given  += amt;
    else if (r[1] === UDHAAR.TYPE_REPAYMENT)   totals.repaid += amt;
  });

  totals.given       = round2_(totals.given);
  totals.repaid      = round2_(totals.repaid);
  totals.outstanding = round2_(totals.given - totals.repaid);
  return totals;
}

/** The same status ladder as statusExpr_, in JavaScript, for API responses. */
function statusFor_(outstanding, dueDate) {
  if (outstanding < 0)  return 'Overpaid';
  if (outstanding === 0) return 'Settled';
  if (!dueDate)          return 'Pending';

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var due   = new Date(dueDate); due.setHours(0, 0, 0, 0);
  var days  = Math.round((due - today) / 86400000);

  if (days < 0)                        return 'Overdue';
  if (days <= UDHAAR.dueSoonDays)      return 'Due Soon';
  return 'Pending';
}

/** Formats a freshly appended row. Belt and braces: styleUdhaarSheet_ already
 *  formats the whole sheet body, so an appended row inherits formatting even if
 *  this never ran. */
function applyUdhaarRowFormat_(sh, row) {
  sh.getRange(row, 1, 1, 2).setNumberFormat(CFG.date);
  sh.getRange(row, 5, 1, 1).setNumberFormat(CFG.money).setHorizontalAlignment('right');
  sh.getRange(row, 7, 1, 1).setNumberFormat('dd mmm yyyy');
  sh.getRange(row, 10, 1, 1).setNumberFormat('mmm yyyy');
  sh.getRange(row, 11, 1, 1).setNumberFormat(CFG.money).setHorizontalAlignment('right');
  sh.getRange(row, 1, 1, 12)
    .setFontFamily(CFG.font).setFontSize(10).setVerticalAlignment('middle');
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}

/* ========================================================================== */
/*  DASHBOARD SECTION — rows 47-95 only                                       */
/* ========================================================================== */

/** Shared LET preamble for every person-level dashboard formula. */
function udhaarLetPreamble_() {
  var q = UDHAAR.sheet;
  return 'p,' + q + '!$C$2:$C,t,' + q + '!$D$2:$D,a,' + q + '!$E$2:$E,d,' + q + '!$G$2:$G,' +
         'ppl,UNIQUE(FILTER(p,p<>"")),' +
         'gv,MAP(ppl,LAMBDA(x,SUMIFS(a,p,x,t,"' + UDHAAR.TYPE_GIVEN + '"))),' +
         'rp,MAP(ppl,LAMBDA(x,SUMIFS(a,p,x,t,"' + UDHAAR.TYPE_REPAYMENT + '"))),' +
         'ot,MAP(ppl,LAMBDA(x,SUMIFS(a,p,x,t,"' + UDHAAR.TYPE_GIVEN + '")-' +
                             'SUMIFS(a,p,x,t,"' + UDHAAR.TYPE_REPAYMENT + '"))),' +
         'dd,MAP(ppl,LAMBDA(x,MINIFS(d,p,x,d,">0"))),' +
         'st,MAP(ppl,LAMBDA(x,LET(' +
             'o,SUMIFS(a,p,x,t,"' + UDHAAR.TYPE_GIVEN + '")-SUMIFS(a,p,x,t,"' + UDHAAR.TYPE_REPAYMENT + '"),' +
             'e,MINIFS(d,p,x,d,">0"),' + statusExpr_('o', 'e') + '))),';
}

function buildUdhaarDashboard_(dash) {
  var D = UDHAAR.dash;

  if (dash.getMaxRows() < D.lastRow) {
    throw new Error('The Dashboard sheet has only ' + dash.getMaxRows() + ' rows. ' +
                    'Add rows until it has at least ' + D.lastRow +
                    ', then run setupUdhaar() again. No rows were inserted for you.');
  }

  var plan = udhaarDashboardPlan_();
  assertBlockSafe_(dash, plan);

  // --- section heading ---------------------------------------------------
  dash.getRange(D.titleRow, 2).setValue('🤝 UDHAAR OVERVIEW')
      .setFontSize(12).setFontWeight('bold').setFontColor(C.navy)
      .setVerticalAlignment('middle');

  dash.getRange(D.subtitleRow, 2)
      .setValue('Given & Repaid follow the Period selector above · To Receive and Overdue are current balances')
      .setFontSize(9).setFontColor(C.muted).setVerticalAlignment('middle');

  buildUdhaarKpiCards_(dash);
  buildWhoOwesMeTable_(dash);
  buildUpcomingTable_(dash);
  styleUdhaarDashboardRows_(dash);
  applyUdhaarDashboardConditionalFormatting_(dash);

  if (UDHAAR.addChart) buildUdhaarChart_(dash);
}

/** Every cell this module writes on the Dashboard, with its expected content.
 *  Used both to write and to verify the block is safe to touch. */
function udhaarDashboardPlan_() {
  var D = UDHAAR.dash;
  var cells = {};

  cells['B' + D.titleRow]    = '🤝 UDHAAR OVERVIEW';
  cells['B' + D.subtitleRow] = null;   // null = "must be empty or ours", content not pinned

  ['B', 'E', 'I', 'M'].forEach(function (col) {
    cells[col + D.kpiLabelRow] = null;
    cells[col + D.kpiValueRow] = null;
  });

  cells['B' + D.owesTitleRow]     = 'WHO OWES ME';
  cells['B' + D.upcomingTitleRow] = 'UPCOMING / OVERDUE';

  ['B', 'C', 'D', 'E', 'F'].forEach(function (col) { cells[col + D.owesHeaderRow] = null; });
  ['B', 'C', 'D', 'E'].forEach(function (col) { cells[col + D.upcomingHeaderRow] = null; });

  cells['B' + D.owesFirstRow]     = null;
  cells['B' + D.upcomingFirstRow] = null;

  return cells;
}

/**
 * Refuses to write if the target block holds anything that is not either empty
 * or this module's own previous output. This is what makes setupUdhaar() safe
 * to re-run and impossible to run over your own notes.
 */
function assertBlockSafe_(dash, plan) {
  var D = UDHAAR.dash;
  var ours = { 'WHO OWES ME': 1, 'UPCOMING / OVERDUE': 1, 'Person': 1, 'Given': 1,
               'Repaid': 1, 'Outstanding': 1, 'Status': 1, 'Amount': 1, 'Due Date': 1,
               'TOTAL GIVEN (MONTH)': 1, 'TOTAL REPAID (MONTH)': 1,
               'TO RECEIVE (CURRENT)': 1, 'OVERDUE (CURRENT)': 1 };

  var conflicts = [];
  var block = dash.getRange(D.titleRow, 2, D.lastRow - D.titleRow + 1, 15); // B..P
  var values = block.getValues();

  for (var r = 0; r < values.length; r++) {
    for (var c = 0; c < values[r].length; c++) {
      var v = String(values[r][c]).trim();
      if (v === '') continue;
      if (ours[v]) continue;
      if (v.indexOf('UDHAAR OVERVIEW') !== -1) continue;
      if (v.indexOf('Period selector') !== -1) continue;
      // Anything else here is either our spilled data or something unexpected.
      // Spilled data always sits under one of our table anchors, so only flag
      // content in the structural rows.
      var absRow = D.titleRow + r;
      if (absRow === D.titleRow || absRow === D.subtitleRow ||
          absRow === D.kpiLabelRow || absRow === D.owesTitleRow ||
          absRow === D.owesHeaderRow || absRow === D.upcomingTitleRow ||
          absRow === D.upcomingHeaderRow) {
        conflicts.push(colLetter_(c + 2) + absRow + ' = "' + v + '"');
      }
    }
  }

  if (conflicts.length) {
    throw new Error('Dashboard rows ' + D.titleRow + '-' + D.lastRow +
                    ' already contain content that is not part of the Udhaar module, ' +
                    'so nothing was written. Clear or move these first:\n  ' +
                    conflicts.join('\n  '));
  }
}

function buildUdhaarKpiCards_(dash) {
  var D = UDHAAR.dash;
  var q = UDHAAR.sheet;
  var pre = udhaarLetPreamble_();

  var cards = [
    { col: 'B', span: 'C', label: 'TOTAL GIVEN (MONTH)',  accent: C.blue,   tint: C.blueTint,
      formula: '=SUMIFS(' + q + '!$E:$E,' + q + '!$D:$D,"' + UDHAAR.TYPE_GIVEN + '",' + q + '!$J:$J,$C$5)' },

    { col: 'E', span: 'G', label: 'TOTAL REPAID (MONTH)', accent: C.green,  tint: C.greenTint,
      formula: '=SUMIFS(' + q + '!$E:$E,' + q + '!$D:$D,"' + UDHAAR.TYPE_REPAYMENT + '",' + q + '!$J:$J,$C$5)' },

    { col: 'I', span: 'K', label: 'TO RECEIVE (CURRENT)', accent: C.purple, tint: C.purpleTint,
      formula: '=IFERROR(LET(' + pre + 'SUMPRODUCT(ot,--(ot>0))),0)' },

    { col: 'M', span: 'P', label: 'OVERDUE (CURRENT)',    accent: C.red,    tint: C.redTint,
      formula: '=IFERROR(LET(' + pre + 'SUMPRODUCT(ot,--(ot>0),--(dd>0),--(dd<TODAY()))),0)' }
  ];

  cards.forEach(function (card) {
    var labelA1 = card.col + D.kpiLabelRow + ':' + card.span + D.kpiLabelRow;
    var valueA1 = card.col + D.kpiValueRow + ':' + card.span + D.kpiValueRowEnd;
    var boxA1   = card.col + D.kpiLabelRow + ':' + card.span + D.kpiValueRowEnd;

    mergeIfNeeded_(dash.getRange(labelA1));
    mergeIfNeeded_(dash.getRange(valueA1));

    var box = dash.getRange(boxA1);
    box.setBackground(C.card)
       .setBorder(true, true, true, true, false, false, C.border, SOLID);
    box.setBorder(null, true, null, null, null, null, card.accent, SOLID_THICK);

    dash.getRange(card.col + D.kpiLabelRow)
        .setValue(card.label)
        .setBackground(card.tint)
        .setFontSize(9).setFontWeight('bold').setFontColor(C.muted)
        .setHorizontalAlignment('center').setVerticalAlignment('middle')
        .setWrapStrategy(CLIP);

    dash.getRange(card.col + D.kpiValueRow)
        .setFormula(card.formula)
        .setBackground(C.card)
        .setFontSize(20).setFontWeight('bold').setFontColor(card.accent)
        .setNumberFormat(CFG.money)
        .setHorizontalAlignment('center').setVerticalAlignment('middle')
        .setWrapStrategy(CLIP);
  });
}

function buildWhoOwesMeTable_(dash) {
  var D = UDHAAR.dash;

  dash.getRange(D.owesTitleRow, 2).setValue('WHO OWES ME')
      .setFontSize(11).setFontWeight('bold').setFontColor(C.navy)
      .setVerticalAlignment('middle');

  dash.getRange(D.owesHeaderRow, 2, 1, 5)
      .setValues([['Person', 'Given', 'Repaid', 'Outstanding', 'Status']]);

  // One spilled array: aggregate by person, keep only debtors, sort by
  // outstanding descending, capped so it can never collide with the section
  // below it.
  dash.getRange(D.owesFirstRow, 2).setFormula(
    '=IFERROR(ARRAY_CONSTRAIN(LET(' + udhaarLetPreamble_() +
      'tbl,FILTER(HSTACK(ppl,gv,rp,ot,st),ROUND(ot,2)>0),' +
      'SORT(tbl,4,FALSE)),' + D.owesMaxRows + ',5),"")'
  );

  styleTable(dash, {
    header: 'B' + D.owesHeaderRow + ':F' + D.owesHeaderRow,
    body:   'B' + D.owesFirstRow  + ':F' + (D.owesFirstRow + D.owesMaxRows - 1),
    box:    'B' + D.owesHeaderRow + ':F' + (D.owesFirstRow + D.owesMaxRows - 1),
    theme:  'navy',
    cols: {
      B: { align: 'left' },
      C: { align: 'right', fmt: CFG.money },
      D: { align: 'right', fmt: CFG.money },
      E: { align: 'right', fmt: CFG.money, bold: true },
      F: { align: 'left',  bold: true }
    }
  });
}

function buildUpcomingTable_(dash) {
  var D = UDHAAR.dash;

  dash.getRange(D.upcomingTitleRow, 2).setValue('UPCOMING / OVERDUE')
      .setFontSize(11).setFontWeight('bold').setFontColor(C.navy)
      .setVerticalAlignment('middle');

  dash.getRange(D.upcomingHeaderRow, 2, 1, 4)
      .setValues([['Person', 'Amount', 'Due Date', 'Status']]);

  // Debtors who have a due date, soonest first.
  dash.getRange(D.upcomingFirstRow, 2).setFormula(
    '=IFERROR(ARRAY_CONSTRAIN(LET(' + udhaarLetPreamble_() +
      'tbl,FILTER(HSTACK(ppl,ot,dd,st),(ROUND(ot,2)>0)*(dd>0)),' +
      'SORT(tbl,3,TRUE)),' + D.upcomingMaxRows + ',4),"")'
  );

  styleTable(dash, {
    header: 'B' + D.upcomingHeaderRow + ':E' + D.upcomingHeaderRow,
    body:   'B' + D.upcomingFirstRow  + ':E' + (D.upcomingFirstRow + D.upcomingMaxRows - 1),
    box:    'B' + D.upcomingHeaderRow + ':E' + (D.upcomingFirstRow + D.upcomingMaxRows - 1),
    theme:  'navy',
    cols: {
      B: { align: 'left' },
      C: { align: 'right', fmt: CFG.money, bold: true },
      D: { align: 'left',  fmt: 'dd mmm yyyy' },
      E: { align: 'left',  bold: true }
    }
  });
}

/** Row heights for the Udhaar block only. Rows 1-46 are never touched. */
function styleUdhaarDashboardRows_(dash) {
  var D = UDHAAR.dash;

  applyRowHeights_(dash, (function () {
    var h = {};
    h[D.titleRow - 1]      = 20;
    h[D.titleRow]          = 26;
    h[D.subtitleRow]       = 18;
    h[D.titleRow + 2]      = 10;
    h[D.kpiLabelRow]       = 26;
    h[D.kpiValueRow]       = 34;
    h[D.kpiValueRow + 1]   = 14;
    h[D.kpiValueRowEnd]    = 10;
    h[D.owesTitleRow - 1]  = 16;
    h[D.owesTitleRow]      = 24;
    h[D.owesHeaderRow]     = 26;
    h[D.upcomingTitleRow]  = 24;
    h[D.upcomingHeaderRow] = 26;
    return h;
  })());

  setRowHeightsSafe_(dash, D.owesFirstRow, D.owesMaxRows, 22);
  setRowHeightsSafe_(dash, D.upcomingFirstRow, D.upcomingMaxRows, 22);
}

function applyUdhaarDashboardConditionalFormatting_(dash) {
  var D = UDHAAR.dash;

  var owesBody     = 'B' + D.owesFirstRow     + ':F' + (D.owesFirstRow + D.owesMaxRows - 1);
  var owesStatus   = 'F' + D.owesFirstRow     + ':F' + (D.owesFirstRow + D.owesMaxRows - 1);
  var upBody       = 'B' + D.upcomingFirstRow + ':E' + (D.upcomingFirstRow + D.upcomingMaxRows - 1);
  var upStatus     = 'E' + D.upcomingFirstRow + ':E' + (D.upcomingFirstRow + D.upcomingMaxRows - 1);

  var rules = keepForeignRules_(dash, [owesBody, owesStatus, upBody, upStatus]);

  rules.push(cf_(dash, owesBody, function (b) {
    return b.whenFormulaSatisfied('=AND($B' + D.owesFirstRow + '<>"",ISEVEN(ROW()))')
            .setBackground(C.stripe);
  }));
  rules.push(cf_(dash, upBody, function (b) {
    return b.whenFormulaSatisfied('=AND($B' + D.upcomingFirstRow + '<>"",ISEVEN(ROW()))')
            .setBackground(C.stripe);
  }));

  pushStatusColorRules_(rules, dash, owesStatus);
  pushStatusColorRules_(rules, dash, upStatus);

  dash.setConditionalFormatRules(rules);
}

/** Optional bar chart. Off by default — see UDHAAR.addChart. */
function buildUdhaarChart_(dash) {
  var D = UDHAAR.dash;
  var lastRow = D.owesFirstRow + D.owesMaxRows - 1;

  // Never add a second copy.
  var existing = dash.getCharts().filter(function (ch) {
    try { return String(ch.getOptions().get('title') || '') === 'Udhaar by Person'; }
    catch (e) { return false; }
  });
  if (existing.length) return;

  var chart = dash.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(dash.getRange('B' + D.owesFirstRow + ':B' + lastRow))
    .addRange(dash.getRange('E' + D.owesFirstRow + ':E' + lastRow))
    .setOption('title', 'Udhaar by Person')
    .setOption('fontName', CFG.font)
    .setOption('backgroundColor', { fill: C.card, stroke: C.border, strokeWidth: 1 })
    .setOption('titleTextStyle', { color: C.navy, fontSize: 12, bold: true, fontName: CFG.font })
    .setOption('legend', { position: 'none' })
    .setOption('colors', [C.purple])
    .setOption('hAxis', { format: CFG.money, gridlines: { color: C.border },
                          textStyle: { color: C.muted, fontSize: 10 } })
    .setOption('vAxis', { textStyle: { color: C.muted, fontSize: 10 } })
    .setOption('width', 440).setOption('height', 300)
    .setPosition(D.owesTitleRow, 8, 0, 0)
    .build();

  dash.insertChart(chart);
}

/* ========================================================================== */
/*  helpers                                                                   */
/* ========================================================================== */

function mergeIfNeeded_(range) {
  if (!range.isPartOfMerge()) range.merge();
}

function toAmount_(raw) {
  if (typeof raw === 'number') return raw;
  var cleaned = String(raw == null ? '' : raw).replace(/[^0-9.\-]/g, '');
  return cleaned === '' ? NaN : Number(cleaned);
}

/** Handles Date objects, yyyy-MM-dd without timezone drift, and common strings. */
function toDate_(raw) {
  if (!raw) return null;
  if (Object.prototype.toString.call(raw) === '[object Date]') {
    return isNaN(raw.getTime()) ? null : raw;
  }

  var s = String(raw).trim();
  if (s === '') return null;

  var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  var parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function round2_(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function colLetter_(n) {
  var s = '';
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = (n - m - 1) / 26;
  }
  return s;
}