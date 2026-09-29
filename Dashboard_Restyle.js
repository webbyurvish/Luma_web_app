/**
 * ============================================================================
 *  PERSONAL FINANCE TRACKER — VISUAL RESTYLE (FORMAT ONLY)
 * ============================================================================
 *
 *  WHAT THIS DOES
 *  --------------
 *  Applies a modern SaaS/finance dashboard look to your existing Google Sheet.
 *  It ONLY touches presentation: fonts, sizes, colours, number formats,
 *  backgrounds, borders, row heights, column widths, gridline visibility,
 *  frozen rows, and chart appearance.
 *
 *  WHAT IT NEVER DOES
 *  ------------------
 *  No setValue / setFormula / setValues / setFormulas anywhere.
 *  No insert/delete of rows, columns, sheets or charts.
 *  No changes to data validation, dropdowns, chart data ranges, named ranges,
 *  Apps Script triggers, or the Form Responses link.
 *  Existing conditional formatting rules are preserved (only rules this script
 *  previously added are replaced, so it is safe to re-run).
 *
 *  HOW TO RUN
 *  ----------
 *  1. Open your Google Sheet.
 *  2. Extensions -> Apps Script.
 *  3. File -> New -> Script file, name it "Dashboard_Restyle".
 *     (Add it as a NEW file — do not paste over your existing script.)
 *  4. Paste this whole file in and Save.
 *  5. In the function dropdown pick  restyleWorkbook  and click Run.
 *  6. Approve the authorisation prompt the first time.
 *  7. Read the execution log. It prints a BEFORE/AFTER snapshot of every KPI
 *     value and formula and will shout if anything moved.
 *
 *  TO UNDO: File -> Version history -> Restore, in the Sheet (not the editor).
 *
 *  TWEAK THESE IF YOU WANT
 *  -----------------------
 *  CFG.currency        currency symbol used in number formats
 *  CFG.repositionCharts  set false to leave charts exactly where you put them
 *  CFG.styleDataSheets   set false to leave Transactions/Categories untouched
 * ============================================================================
 */

var CFG = {
  currency:         '₹',   // Indian Rupee. Change to '$', '£', '€' etc.
  repositionCharts: true,
  styleDataSheets:  true,
  font:             'Arial'
};

var C = {
  canvas:     '#F5F7FA',
  card:       '#FFFFFF',
  blue:       '#2563EB',
  green:      '#16A34A',
  red:        '#EF4444',
  purple:     '#7C3AED',
  text:       '#111827',
  muted:      '#64748B',
  border:     '#E5E7EB',
  grid:       '#E2E8F0',
  headerFill: '#F1F5F9',
  stripe:     '#F8FAFC'
};

// Extra hues only for slice differentiation, as the brief allows.
var SLICE_COLORS = ['#2563EB','#16A34A','#EF4444','#7C3AED',
                    '#0891B2','#F59E0B','#64748B','#94A3B8'];

var MONEY   = CFG.currency + '#,##0.00';
var MONEY_0 = CFG.currency + '#,##0';
var SOLID   = SpreadsheetApp.BorderStyle.SOLID;
var CLIP    = SpreadsheetApp.WrapStrategy.CLIP;

/* ========================================================================== */
/*  ENTRY POINT                                                               */
/* ========================================================================== */

function restyleWorkbook() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dash = ss.getSheetByName('Dashboard');
  if (!dash) throw new Error('No sheet named "Dashboard" found. Nothing was changed.');

  var before = snapshot_(dash);

  styleDashboardCanvas_(dash);
  styleDashboardHeader_(dash);
  styleKpiCards_(dash);
  styleSupportingTables_(dash);
  styleRecentTransactions_(dash);
  applyConditionalFormats_(dash);
  styleCharts_(dash);

  if (CFG.styleDataSheets) {
    styleTransactionsSheet_(ss.getSheetByName('Transactions'));
    styleCategoriesSheet_(ss.getSheetByName('Categories'));
    // Budget sheet intentionally skipped — it is empty; nothing to style.
  }

  SpreadsheetApp.flush();
  var after = snapshot_(dash);
  report_(before, after);
}

/* ========================================================================== */
/*  1. CANVAS — gridlines, page background, grid geometry                     */
/* ========================================================================== */

function styleDashboardCanvas_(sh) {
  sh.setHiddenGridlines(true);

  // Flood the whole sheet so there is no white edge past the content.
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns())
    .setBackground(C.canvas)
    .setFontFamily(CFG.font)
    .setFontColor(C.text);

  // --- Column grid -------------------------------------------------------
  // Each KPI card is exactly 220px wide, with ~85-100px gutters between them.
  //   card 1 = B+C   card 2 = E+F+G   card 3 = I+J+K   card 4 = M+N+O+P
  // A and Q act as the left/right page margins.
  var widths = {
    A: 24,  B: 120, C: 100, D: 100, E: 80,  F: 90,  G: 50,  H: 85,
    I: 110, J: 55,  K: 55,  L: 85,  M: 55,  N: 55,  O: 55,  P: 55, Q: 24
  };
  for (var col in widths) {
    sh.setColumnWidth(colNum_(col), widths[col]);
  }

  // --- Row rhythm --------------------------------------------------------
  var heights = {
    1: 14,   // top margin
    2: 32,   // title  (B2:P3 merged)
    3: 16,
    4: 22,   // subtitle
    5: 32,   // period filter
    6: 16,   // gap
    7: 24,   // KPI label row
    8: 32,   // KPI value row  (B8:C10 merged)
    9: 16,
    10: 12,  // card bottom padding
    11: 20,  // gap
    12: 12,
    13: 26,  // table header row
    26: 12, 27: 12,
    28: 26,  // "RECENT TRANSACTIONS"
    29: 10,
    30: 26,  // transaction table header
    45: 14,
    46: 14
  };
  var maxRow = sh.getMaxRows();
  for (var r in heights) {
    if (Number(r) <= maxRow) sh.setRowHeight(Number(r), heights[r]);
  }
  setRowHeightsSafe_(sh, 14, 12, 22);   // rows 14-25  supporting table bodies
  setRowHeightsSafe_(sh, 31, 14, 22);   // rows 31-44  transaction rows
  setRowHeightsSafe_(sh, 47, 40, 21);   // rows 47-86  chart zone, predictable height
}

/** setRowHeights that never runs off the end of the sheet. */
function setRowHeightsSafe_(sh, start, count, px) {
  var maxRow = sh.getMaxRows();
  if (start > maxRow) return;
  sh.setRowHeights(start, Math.min(count, maxRow - start + 1), px);
}

/* ========================================================================== */
/*  2. HEADER + MONTH FILTER                                                  */
/* ========================================================================== */

function styleDashboardHeader_(sh) {
  // Title — already reads "PERSONAL FINANCE" in the sheet, so only its look changes.
  sh.getRange('B2')
    .setFontSize(20).setFontWeight('bold')
    .setFontColor(C.text)
    .setHorizontalAlignment('left').setVerticalAlignment('bottom');

  // Subtitle
  sh.getRange('B4')
    .setFontSize(10).setFontWeight('normal')
    .setFontColor(C.muted)
    .setHorizontalAlignment('left').setVerticalAlignment('top');

  // "Period" label
  sh.getRange('B5')
    .setFontSize(9).setFontWeight('bold')
    .setFontColor(C.muted)
    .setHorizontalAlignment('left').setVerticalAlignment('middle');

  // The month selector itself — styled as a filter control.
  // NOTE: its number format is deliberately left alone. The dropdown items are
  // matched against this cell's underlying date by the SUMIFS formulas, and
  // reformatting it is the one cosmetic change that could confuse that match.
  sh.getRange('C5')
    .setBackground(C.card)
    .setFontSize(10).setFontWeight('bold').setFontColor(C.text)
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false, C.border, SOLID);
}

/* ========================================================================== */
/*  3. KPI CARDS                                                              */
/* ========================================================================== */

function styleKpiCards_(sh) {
  var cards = [
    { box: 'B7:C10', label: 'B7', value: 'B8', color: C.green  },  // TOTAL INCOME
    { box: 'E7:G10', label: 'E7', value: 'E8', color: C.red    },  // TOTAL EXPENSE
    { box: 'I7:K10', label: 'I7', value: 'I8', color: C.purple },  // BALANCE
    { box: 'M7:P10', label: 'M7', value: 'M8', color: C.blue   }   // TODAY'S EXPENSE
  ];

  cards.forEach(function (card) {
    // White card body with one hairline border — no heavy rules, no inner lines.
    sh.getRange(card.box)
      .setBackground(C.card)
      .setBorder(true, true, true, true, false, false, C.border, SOLID);

    sh.getRange(card.label)
      .setFontSize(9).setFontWeight('bold')
      .setFontColor(C.muted)
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setWrapStrategy(CLIP);

    sh.getRange(card.value)
      .setFontSize(18).setFontWeight('bold')
      .setFontColor(card.color)
      .setNumberFormat(MONEY_0)
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setWrapStrategy(CLIP);
  });
}

/* ========================================================================== */
/*  4. SUPPORTING TABLES — Category / Payment Method / Month                  */
/* ========================================================================== */

function styleSupportingTables_(sh) {
  var tables = [
    { header: 'B13:C13', body: 'B14:C21', labels: 'B14:B21', values: 'C14:C21', box: 'B13:C21' },
    { header: 'E13:F13', body: 'E14:F19', labels: 'E14:E19', values: 'F14:F19', box: 'E13:F19' },
    { header: 'H13:I13', body: 'H14:I25', labels: 'H14:H25', values: 'I14:I25', box: 'H13:I25' }
  ];

  tables.forEach(function (t) {
    sh.getRange(t.box).setBackground(C.card);

    sh.getRange(t.header)
      .setBackground(C.headerFill)
      .setFontSize(9).setFontWeight('bold').setFontColor(C.text)
      .setVerticalAlignment('middle').setWrapStrategy(CLIP);

    sh.getRange(t.labels)
      .setFontSize(10).setFontWeight('normal').setFontColor(C.text)
      .setHorizontalAlignment('left').setVerticalAlignment('middle')
      .setWrapStrategy(CLIP);

    sh.getRange(t.values)
      .setFontSize(10).setFontWeight('normal').setFontColor(C.text)
      .setNumberFormat(MONEY)
      .setHorizontalAlignment('right').setVerticalAlignment('middle');

    // Hairline separators between rows, hairline box around the table.
    sh.getRange(t.box)
      .setBorder(true, true, true, true, false, true, C.border, SOLID);
  });

  // Header alignment: value columns right, to match their numbers.
  sh.getRange('C13').setHorizontalAlignment('right');
  sh.getRange('F13').setHorizontalAlignment('right');
  sh.getRange('I13').setHorizontalAlignment('right');
  sh.getRange('B13').setHorizontalAlignment('left');
  sh.getRange('E13').setHorizontalAlignment('left');
  sh.getRange('H13').setHorizontalAlignment('left');

  // Month column reads as a month, not a full date.
  sh.getRange('H14:H25').setNumberFormat('mmm yyyy').setHorizontalAlignment('left');
}

/* ========================================================================== */
/*  5. RECENT TRANSACTIONS                                                    */
/* ========================================================================== */

function styleRecentTransactions_(sh) {
  // Section title
  sh.getRange('B28')
    .setFontSize(12).setFontWeight('bold').setFontColor(C.text)
    .setHorizontalAlignment('left').setVerticalAlignment('middle');

  // The table body is a spilled SORT/FILTER array, so it grows. Style a band
  // of 14 rows; formats are cell properties and never touch the formula.
  var body = 'B31:G44';

  sh.getRange('B30:G44').setBackground(C.card);

  sh.getRange('B30:G30')
    .setBackground(C.headerFill)
    .setFontSize(9).setFontWeight('bold').setFontColor(C.text)
    .setVerticalAlignment('middle').setWrapStrategy(CLIP);

  sh.getRange(body)
    .setFontSize(10).setFontWeight('normal').setFontColor(C.text)
    .setVerticalAlignment('middle').setWrapStrategy(CLIP);

  sh.getRange('B31:B44').setNumberFormat('dd mmm yyyy').setHorizontalAlignment('left');
  sh.getRange('C31:F44').setHorizontalAlignment('left');
  sh.getRange('G31:G44').setNumberFormat(MONEY).setHorizontalAlignment('right');
  sh.getRange('G30').setHorizontalAlignment('right');

  sh.getRange('B30:G44')
    .setBorder(true, true, true, true, false, false, C.border, SOLID);
  sh.getRange('B30:G30')
    .setBorder(null, null, true, null, null, null, C.border, SOLID);
}

/* ========================================================================== */
/*  6. CONDITIONAL FORMATTING                                                 */
/* ========================================================================== */

function applyConditionalFormats_(sh) {
  var balanceA1 = 'I8:K10';
  var stripeA1  = 'B31:G44';

  // Keep every rule that isn't one of ours, so re-running is safe.
  var kept = sh.getConditionalFormatRules().filter(function (rule) {
    return !rule.getRanges().some(function (r) {
      var a1 = r.getA1Notation();
      return a1 === balanceA1 || a1 === stripeA1;
    });
  });

  // Negative balance turns red. The KPI spec keeps a positive balance purple,
  // which is set as the static font colour in styleKpiCards_.
  kept.push(
    SpreadsheetApp.newConditionalFormatRule()
      .setRanges([sh.getRange(balanceA1)])
      .whenNumberLessThan(0)
      .setFontColor(C.red)
      .build()
  );

  // Zebra striping that only paints rows the array formula actually filled.
  kept.push(
    SpreadsheetApp.newConditionalFormatRule()
      .setRanges([sh.getRange(stripeA1)])
      .whenFormulaSatisfied('=AND($B31<>"",ISEVEN(ROW()))')
      .setBackground(C.stripe)
      .build()
  );

  sh.setConditionalFormatRules(kept);
}

/* ========================================================================== */
/*  7. CHARTS                                                                 */
/* ========================================================================== */

function styleCharts_(sh) {
  var charts = sh.getCharts();
  if (!charts.length) {
    Logger.log('NOTE: no charts found on Dashboard — chart styling skipped.');
    return;
  }

  var pieSeen = 0;
  var maxRow  = sh.getMaxRows();
  var pieRow   = Math.min(47, Math.max(1, maxRow - 30));
  var trendRow = Math.min(63, Math.max(1, maxRow - 15));

  charts.forEach(function (chart) {
    var title = '';
    try { title = String(chart.getOptions().get('title') || ''); } catch (e) { title = ''; }
    var t = title.toLowerCase();
    var b = chart.modify();

    var isTrend    = /trend|month/.test(t);
    var isPayment  = /payment/.test(t);
    var isCategory = /category/.test(t);

    // Fall back on ordering if a chart has no title.
    if (!isTrend && !isPayment && !isCategory) {
      if (pieSeen === 0)      { isCategory = true; }
      else if (pieSeen === 1) { isPayment  = true; }
      else                    { isTrend    = true; }
    }

    // ---- shared chrome ----
    b.setOption('fontName', CFG.font)
     .setOption('backgroundColor', { fill: C.card, stroke: C.border, strokeWidth: 1 })
     .setOption('titleTextStyle',  { color: C.text, fontSize: 12, bold: true, fontName: CFG.font })
     .setOption('chartArea',       { left: 16, top: 48, width: '86%', height: '74%' });

    if (isTrend) {
      b.setOption('title', 'Monthly Spending Trend')
       .setOption('legend', { position: 'none' })
       .setOption('curveType', 'none')
       .setOption('series', { 0: { color: C.blue, lineWidth: 3, pointSize: 5 } })
       .setOption('vAxis', {
          format: MONEY_0,
          gridlines:      { color: C.grid, count: 5 },
          minorGridlines: { count: 0 },
          baselineColor:  C.grid,
          textStyle:      { color: C.muted, fontSize: 10, fontName: CFG.font }
        })
       .setOption('hAxis', {
          gridlines:      { color: 'transparent' },
          minorGridlines: { count: 0 },
          baselineColor:  C.grid,
          slantedText:    false,
          textStyle:      { color: C.muted, fontSize: 10, fontName: CFG.font }
        })
       .setOption('width', 1040).setOption('height', 300);
      if (CFG.repositionCharts) b.setPosition(trendRow, 2, 0, 0);

    } else {
      pieSeen++;
      // Pie -> donut. Data range is untouched; only the hole is added.
      b.setOption('pieHole', 0.6)
       .setOption('title', isPayment ? 'Expense by Payment Method' : 'Expense by Category')
       .setOption('colors', SLICE_COLORS)
       .setOption('pieSliceText', 'percentage')
       .setOption('pieSliceTextStyle', { color: '#FFFFFF', fontSize: 10, fontName: CFG.font })
       .setOption('pieSliceBorderColor', '#FFFFFF')
       .setOption('legend', { position: 'right', alignment: 'center',
                              textStyle: { color: C.muted, fontSize: 10, fontName: CFG.font } })
       .setOption('width', 500).setOption('height', 300);
      if (CFG.repositionCharts) {
        // Side by side, below the transaction table, clear of every cell range.
        b.setPosition(pieRow, isPayment ? 8 : 2, 0, 0);
      }
    }

    sh.updateChart(b.build());
  });
}

/* ========================================================================== */
/*  8. DATA SHEETS — cosmetic only                                            */
/* ========================================================================== */

function styleTransactionsSheet_(sh) {
  if (!sh) return;
  var last = Math.max(sh.getLastRow(), 2);

  sh.getRange(1, 1, 1, 10)
    .setBackground(C.headerFill)
    .setFontFamily(CFG.font).setFontSize(10).setFontWeight('bold').setFontColor(C.text)
    .setVerticalAlignment('middle')
    .setBorder(null, null, true, null, null, null, C.border, SOLID);

  sh.getRange(2, 1, last - 1, 10)
    .setFontFamily(CFG.font).setFontSize(10).setFontColor(C.text)
    .setVerticalAlignment('middle');

  // Display formats only — the stored values and formulas are untouched.
  sh.getRange('A2:A' + last).setNumberFormat('dd mmm yyyy hh:mm');
  sh.getRange('B2:B' + last).setNumberFormat('dd mmm yyyy hh:mm');
  sh.getRange('C2:C' + last).setNumberFormat(MONEY).setHorizontalAlignment('right');
  sh.getRange('J2:J' + last).setNumberFormat('mmm yyyy');
  sh.getRange('C1').setHorizontalAlignment('right');

  var w = [150, 150, 100, 85, 110, 130, 120, 130, 160, 95];
  for (var i = 0; i < w.length; i++) sh.setColumnWidth(i + 1, w[i]);

  if (sh.getFrozenRows() === 0) sh.setFrozenRows(1);
  sh.setRowHeight(1, 28);
}

function styleCategoriesSheet_(sh) {
  if (!sh) return;
  var last = Math.max(sh.getLastRow(), 2);

  sh.getRange(1, 1, 1, 2)
    .setBackground(C.headerFill)
    .setFontFamily(CFG.font).setFontSize(10).setFontWeight('bold').setFontColor(C.text)
    .setVerticalAlignment('middle')
    .setBorder(null, null, true, null, null, null, C.border, SOLID);

  sh.getRange(2, 1, last - 1, 2)
    .setFontFamily(CFG.font).setFontSize(10).setFontColor(C.text)
    .setVerticalAlignment('middle');

  sh.setColumnWidth(1, 160);
  sh.setColumnWidth(2, 200);
  if (sh.getFrozenRows() === 0) sh.setFrozenRows(1);
  sh.setRowHeight(1, 28);
}

/* ========================================================================== */
/*  9. SAFETY NET — before/after comparison                                   */
/* ========================================================================== */

var WATCH = [
  'B8','E8','I8','M8',                       // KPI cards
  'C14','C15','C16','C17','C18','C19','C20','C21',   // category totals
  'F14','F15','F16','F17','F18','F19',               // payment totals
  'I14','I15','I16','I17','I18','I19','I20','I21','I22','I23','I24','I25', // trend
  'C5','B31','C31','G31'                     // month filter + array formula anchor
];

function snapshot_(sh) {
  var snap = {};
  WATCH.forEach(function (a1) {
    var r = sh.getRange(a1);
    snap[a1] = { v: String(r.getDisplayValue()), f: String(r.getFormula()) };
  });
  return snap;
}

function report_(before, after) {
  var drift = [];
  Logger.log('--- VERIFICATION -------------------------------------------');
  WATCH.forEach(function (a1) {
    var b = before[a1], a = after[a1];
    var formulaMoved = b.f !== a.f;
    // Display value legitimately changes when a number format is applied,
    // so only a changed FORMULA counts as real drift.
    if (formulaMoved) drift.push(a1 + '  formula "' + b.f + '" -> "' + a.f + '"');
    Logger.log(a1 + '   ' + b.v + '  ->  ' + a.v + (formulaMoved ? '   *** FORMULA CHANGED ***' : ''));
  });

  if (drift.length) {
    Logger.log('!!! ' + drift.length + ' FORMULA(S) CHANGED — restore via File > Version history:');
    drift.forEach(function (d) { Logger.log('    ' + d); });
    throw new Error('Formula drift detected. See the log and restore from version history.');
  }
  Logger.log('OK — every watched formula is byte-identical. Only formatting changed.');
  Logger.log('------------------------------------------------------------');
}

/* ========================================================================== */
/*  helpers                                                                   */
/* ========================================================================== */

function colNum_(letter) {
  var n = 0;
  for (var i = 0; i < letter.length; i++) {
    n = n * 26 + (letter.charCodeAt(i) - 64);
  }
  return n;
}