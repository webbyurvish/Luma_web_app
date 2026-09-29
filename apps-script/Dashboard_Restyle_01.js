/**
 * ============================================================================
 *  PERSONAL FINANCE TRACKER — VISUAL RESTYLE  (v2, FORMAT ONLY)
 * ============================================================================
 *
 *  WHAT THIS DOES
 *  --------------
 *  Applies a premium modern finance-SaaS look to the existing Google Sheet.
 *  It ONLY touches presentation: fonts, sizes, colours, number formats,
 *  backgrounds, borders, row heights, column widths, gridline visibility and
 *  chart appearance.
 *
 *  WHAT IT NEVER DOES
 *  ------------------
 *  No setValue / setFormula / setValues / setFormulas anywhere.
 *  No insert/delete of rows, columns, sheets or charts.
 *  No changes to data validation, dropdowns, chart data ranges, named ranges,
 *  merged-cell structure, Apps Script triggers, or the Form Responses link.
 *  Charts are NOT moved — only resized and restyled (see CFG.repositionCharts).
 *  Existing conditional-format rules are preserved; only rules this script
 *  itself adds get replaced, so re-running is safe and idempotent.
 *
 *  HOW TO RUN
 *  ----------
 *  1. Open your Google Sheet.
 *  2. Extensions -> Apps Script.
 *  3. Open the existing "Dashboard_Restyle" script file and replace its
 *     contents with this file. (Leave your other script files alone.)
 *  4. Save, pick  restyleWorkbook  in the function dropdown, click Run.
 *  5. Read the execution log. It prints a BEFORE/AFTER snapshot of every
 *     watched formula, the merge count, the chart count and the C5 dropdown
 *     rule, and throws if any of them drifted.
 *
 *  TO UNDO: File -> Version history -> Restore, in the Sheet (not the editor).
 *
 *  CHANGES IN v2
 *  -------------
 *  - New cohesive colour system with per-KPI accent + tint pairs.
 *  - KPI cards: tinted label band, thick coloured left accent, 22pt amounts.
 *  - Header divider rule, tighter vertical rhythm, less dead space.
 *  - Zebra striping on the three supporting tables and the ledger.
 *  - Charts stay where they are; only size, palette and labels change.
 *  - Safety net extended to merges, chart count and the month dropdown.
 * ============================================================================
 */

var CFG = {
  currency:         '₹',  // Indian Rupee. Change to '$', '£', '€' etc.
  font:             'Arial',

  // Charts keep their existing positions by default, exactly as asked.
  // Flip to true only if you want them auto-arranged below the ledger.
  repositionCharts: false,

  // Freezing rows 1-5 keeps the header and month filter pinned while you
  // scroll, which reads more like an app. Off by default because frozen
  // rows are arguably sheet structure rather than styling.
  freezeHeader:     false,

  styleDataSheets:  true
};

/* --- colour system -------------------------------------------------------- */
var C = {
  canvas:     '#F5F7FA',
  card:       '#FFFFFF',

  income:     '#059669',  incomeTint:  '#ECFDF5',
  expense:    '#DC2626',  expenseTint: '#FEF2F2',
  balance:    '#7C3AED',  balanceTint: '#F5F3FF',
  today:      '#2563EB',  todayTint:   '#EFF6FF',

  text:       '#111827',
  muted:      '#64748B',
  border:     '#E2E8F0',

  headerFill: '#F1F5F9',
  stripe:     '#F8FAFC'
};

// Extra hues used only to keep donut slices distinguishable.
var SLICE_COLORS = ['#2563EB','#059669','#DC2626','#7C3AED',
                    '#0891B2','#D97706','#64748B','#94A3B8'];

var MONEY   = CFG.currency + '#,##0.00';   // ledger — exact
var MONEY_0 = CFG.currency + '#,##0';      // KPIs and rollups — rounded

var SOLID       = SpreadsheetApp.BorderStyle.SOLID;
var SOLID_THICK = SpreadsheetApp.BorderStyle.SOLID_THICK;
var CLIP        = SpreadsheetApp.WrapStrategy.CLIP;

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
  report_(before, snapshot_(dash));
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
  // Every KPI card is exactly 220px wide, with 84-96px gutters between them.
  //   card 1 = B+C    card 2 = E+F+G    card 3 = I+J+K    card 4 = M+N+O+P
  // A and Q are the left/right page margins.
  var widths = {
    A: 22,  B: 120, C: 100, D: 96,  E: 78,  F: 90,  G: 52,  H: 84,
    I: 108, J: 56,  K: 56,  L: 84,  M: 55,  N: 55,  O: 55,  P: 55, Q: 22
  };
  for (var col in widths) sh.setColumnWidth(colNum_(col), widths[col]);

  // --- Row rhythm --------------------------------------------------------
  // Tight and even. Nothing past row 45 is touched, so the charts sitting in
  // the right-hand columns keep the vertical space they already occupy.
  var heights = {
    1: 12,   // top margin
    2: 34,   // title            (B2:P3 merged)
    3: 14,
    4: 20,   // subtitle         (B4:P4 merged)
    5: 30,   // month filter
    6: 14,   // header divider
    7: 26,   // KPI label band   (B7:C7 merged, etc.)
    8: 38,   // KPI amount       (B8:C10 merged, etc.)
    9: 14,
    10: 10,  // card bottom padding
    11: 18,  // gap
    12: 10,
    13: 26,  // supporting table header
    26: 12,
    27: 12,
    28: 26,  // "RECENT TRANSACTIONS"
    29: 8,
    30: 26,  // ledger header
    45: 12
  };
  var maxRow = sh.getMaxRows();
  for (var r in heights) {
    if (Number(r) <= maxRow) sh.setRowHeight(Number(r), heights[r]);
  }
  setRowHeightsSafe_(sh, 14, 12, 22);   // rows 14-25  supporting table bodies
  setRowHeightsSafe_(sh, 31, 14, 22);   // rows 31-44  ledger rows

  if (CFG.freezeHeader && sh.getFrozenRows() === 0) sh.setFrozenRows(5);
}

/* ========================================================================== */
/*  2. HEADER + MONTH FILTER                                                  */
/* ========================================================================== */

function styleDashboardHeader_(sh) {
  // Title — the sheet already reads "PERSONAL FINANCE", so only its look changes.
  sh.getRange('B2')
    .setFontSize(22).setFontWeight('bold')
    .setFontColor(C.text)
    .setHorizontalAlignment('left').setVerticalAlignment('bottom')
    .setWrapStrategy(CLIP);

  // Subtitle
  sh.getRange('B4')
    .setFontSize(10).setFontWeight('normal')
    .setFontColor(C.muted)
    .setHorizontalAlignment('left').setVerticalAlignment('top')
    .setWrapStrategy(CLIP);

  // "Period" label
  sh.getRange('B5')
    .setFontSize(9).setFontWeight('bold')
    .setFontColor(C.muted)
    .setHorizontalAlignment('left').setVerticalAlignment('middle');

  // The month selector, styled as a filter control.
  // NOTE: its number format is deliberately left alone. This cell holds a real
  // date that the SUMIFS formulas match against Transactions!J:J, and the
  // dropdown items render off that same format — reformatting it is the one
  // cosmetic change that could plausibly break the filter.
  sh.getRange('C5')
    .setBackground(C.card)
    .setFontSize(10).setFontWeight('bold').setFontColor(C.text)
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false, C.border, SOLID);

  // Hairline rule separating the header block from the KPI row.
  sh.getRange('B6:P6')
    .setBorder(null, null, true, null, null, null, C.border, SOLID);
}

/* ========================================================================== */
/*  3. KPI CARDS                                                              */
/* ========================================================================== */

function styleKpiCards_(sh) {
  var cards = [
    { box: 'B7:C10', label: 'B7', value: 'B8', accent: C.income,  tint: C.incomeTint  },
    { box: 'E7:G10', label: 'E7', value: 'E8', accent: C.expense, tint: C.expenseTint },
    { box: 'I7:K10', label: 'I7', value: 'I8', accent: C.balance, tint: C.balanceTint },
    { box: 'M7:P10', label: 'M7', value: 'M8', accent: C.today,   tint: C.todayTint   }
  ];

  cards.forEach(function (card) {
    var box = sh.getRange(card.box);

    // White body, hairline box, no inner rules.
    box.setBackground(C.card)
       .setBorder(true, true, true, true, false, false, C.border, SOLID);

    // Coloured accent down the left edge. Second call leaves the other three
    // sides untouched because they are passed as null.
    box.setBorder(null, true, null, null, null, null, card.accent, SOLID_THICK);

    // Tinted label band across the top of the card.
    sh.getRange(card.label)
      .setBackground(card.tint)
      .setFontSize(9).setFontWeight('bold')
      .setFontColor(C.muted)
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setWrapStrategy(CLIP);

    // The number is the hero: 22pt, bold, in the card's accent colour.
    sh.getRange(card.value)
      .setBackground(C.card)
      .setFontSize(22).setFontWeight('bold')
      .setFontColor(card.accent)
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
    { box: 'B13:C21', header: 'B13:C13', body: 'B14:C21',
      labels: 'B14:B21', values: 'C14:C21', valueHeader: 'C13' },
    { box: 'E13:F19', header: 'E13:F13', body: 'E14:F19',
      labels: 'E14:E19', values: 'F14:F19', valueHeader: 'F13' },
    { box: 'H13:I25', header: 'H13:I13', body: 'H14:I25',
      labels: 'H14:H25', values: 'I14:I25', valueHeader: 'I13' }
  ];

  tables.forEach(function (t) {
    sh.getRange(t.box).setBackground(C.card);

    sh.getRange(t.header)
      .setBackground(C.headerFill)
      .setFontSize(9).setFontWeight('bold').setFontColor(C.text)
      .setVerticalAlignment('middle').setWrapStrategy(CLIP)
      .setBorder(null, null, true, null, null, null, C.border, SOLID);

    // Zebra rows instead of row borders — lighter, easier to scan.
    zebra_(sh.getRange(t.body), C.card, C.stripe);

    sh.getRange(t.labels)
      .setFontSize(10).setFontWeight('normal').setFontColor(C.text)
      .setHorizontalAlignment('left').setVerticalAlignment('middle')
      .setWrapStrategy(CLIP);

    sh.getRange(t.values)
      .setFontSize(10).setFontWeight('bold').setFontColor(C.text)
      .setNumberFormat(MONEY_0)
      .setHorizontalAlignment('right').setVerticalAlignment('middle');

    sh.getRange(t.valueHeader).setHorizontalAlignment('right');

    // One hairline box around the whole table, no inner grid.
    sh.getRange(t.box)
      .setBorder(true, true, true, true, false, false, C.border, SOLID);
  });

  sh.getRange('B13').setHorizontalAlignment('left');
  sh.getRange('E13').setHorizontalAlignment('left');
  sh.getRange('H13').setHorizontalAlignment('left');

  // Month column reads as a month, not a full timestamp.
  sh.getRange('H14:H25').setNumberFormat('mmm yyyy').setHorizontalAlignment('left');
}

/* ========================================================================== */
/*  5. RECENT TRANSACTIONS                                                    */
/* ========================================================================== */

function styleRecentTransactions_(sh) {
  // Section header
  sh.getRange('B28')
    .setFontSize(12).setFontWeight('bold').setFontColor(C.text)
    .setHorizontalAlignment('left').setVerticalAlignment('middle')
    .setWrapStrategy(CLIP);

  // The body is a spilled SORT/FILTER array, so it grows and shrinks. Style a
  // 14-row band; formats are cell properties and never touch the formula.
  sh.getRange('B30:G44').setBackground(C.card);

  sh.getRange('B30:G30')
    .setBackground(C.headerFill)
    .setFontSize(9).setFontWeight('bold').setFontColor(C.text)
    .setVerticalAlignment('middle').setWrapStrategy(CLIP)
    .setBorder(null, null, true, null, null, null, C.border, SOLID);

  sh.getRange('B31:G44')
    .setFontSize(10).setFontWeight('normal').setFontColor(C.text)
    .setVerticalAlignment('middle').setWrapStrategy(CLIP);

  sh.getRange('B31:B44').setNumberFormat('dd mmm yyyy').setHorizontalAlignment('left');
  sh.getRange('C31:F44').setHorizontalAlignment('left');

  // Ledger amounts keep two decimals — this is the exact record.
  sh.getRange('G31:G44')
    .setNumberFormat(MONEY).setHorizontalAlignment('right').setFontWeight('bold');
  sh.getRange('G30').setHorizontalAlignment('right');

  // Muted secondary column, so the eye lands on category and amount.
  sh.getRange('D31:D44').setFontColor(C.muted);

  sh.getRange('B30:G44')
    .setBorder(true, true, true, true, false, false, C.border, SOLID);
}

/* ========================================================================== */
/*  6. CONDITIONAL FORMATTING                                                 */
/* ========================================================================== */

function applyConditionalFormats_(sh) {
  var balanceA1 = 'I8:K10';
  var stripeA1  = 'B31:G44';

  // Keep every rule that is not one of ours, so re-running stays idempotent
  // and any rule you added by hand survives.
  var rules = sh.getConditionalFormatRules().filter(function (rule) {
    return !rule.getRanges().some(function (r) {
      var a1 = r.getA1Notation();
      return a1 === balanceA1 || a1 === stripeA1;
    });
  });

  // A negative balance flips the KPI from purple to the expense red.
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .setRanges([sh.getRange(balanceA1)])
      .whenNumberLessThan(0)
      .setFontColor(C.expense)
      .build()
  );

  // Zebra striping that only paints rows the array formula actually filled,
  // so the empty tail of the ledger stays clean white.
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .setRanges([sh.getRange(stripeA1)])
      .whenFormulaSatisfied('=AND($B31<>"",ISEVEN(ROW()))')
      .setBackground(C.stripe)
      .build()
  );

  sh.setConditionalFormatRules(rules);
}

/* ========================================================================== */
/*  7. CHARTS — restyle and resize in place                                   */
/* ========================================================================== */

function styleCharts_(sh) {
  var charts = sh.getCharts();
  if (!charts.length) {
    Logger.log('NOTE: no charts found on Dashboard — chart styling skipped.');
    return;
  }

  var pieSeen = 0;
  var maxRow  = sh.getMaxRows();

  charts.forEach(function (chart) {
    var title = '';
    try { title = String(chart.getOptions().get('title') || ''); } catch (e) { title = ''; }
    var t = title.toLowerCase();
    var b = chart.modify();

    var isTrend    = /trend|month|spending/.test(t);
    var isPayment  = /payment/.test(t);
    var isCategory = /category/.test(t);

    // Fall back on encounter order if a chart carries no title.
    if (!isTrend && !isPayment && !isCategory) {
      if (pieSeen === 0)      isCategory = true;
      else if (pieSeen === 1) isPayment  = true;
      else                    isTrend    = true;
    }

    // ---- chrome shared by every chart ----
    b.setOption('fontName', CFG.font)
     .setOption('backgroundColor', { fill: C.card, stroke: C.border, strokeWidth: 1 })
     .setOption('titleTextStyle',  { color: C.text, fontSize: 12, bold: true, fontName: CFG.font })
     .setOption('tooltip',         { textStyle: { fontName: CFG.font, fontSize: 11 } });

    if (isTrend) {
      b.setOption('title', 'Monthly Spending Trend')
       .setOption('legend', { position: 'none' })
       .setOption('curveType', 'none')
       .setOption('series', { 0: { color: C.today, lineWidth: 3, pointSize: 5 } })
       .setOption('chartArea', { left: 68, top: 46, width: '84%', height: '68%' })
       .setOption('vAxis', {
          format: MONEY_0,
          gridlines:      { color: C.border, count: 5 },
          minorGridlines: { count: 0 },
          baselineColor:  C.border,
          textStyle:      { color: C.muted, fontSize: 10, fontName: CFG.font }
        })
       .setOption('hAxis', {
          gridlines:      { color: 'transparent' },
          minorGridlines: { count: 0 },
          baselineColor:  C.border,
          slantedText:    false,
          textStyle:      { color: C.muted, fontSize: 10, fontName: CFG.font }
        })
       .setOption('width', 720).setOption('height', 300);

      if (CFG.repositionCharts) b.setPosition(clampRow_(47, maxRow), 2, 0, 0);

    } else {
      pieSeen++;
      // Pie -> compact donut. The data range is never touched, only the hole.
      b.setOption('pieHole', 0.62)
       .setOption('title', isPayment ? 'Expense by Payment Method' : 'Expense by Category')
       .setOption('colors', SLICE_COLORS)
       .setOption('pieSliceText', 'percentage')
       .setOption('pieSliceTextStyle', { color: '#FFFFFF', fontSize: 10, fontName: CFG.font })
       .setOption('pieSliceBorderColor', '#FFFFFF')
       .setOption('chartArea', { left: 10, top: 44, width: '88%', height: '76%' })
       .setOption('legend', { position: 'right', alignment: 'center',
                              textStyle: { color: C.muted, fontSize: 10, fontName: CFG.font } })
       .setOption('width', 430).setOption('height', 260);

      if (CFG.repositionCharts) {
        b.setPosition(clampRow_(isPayment ? 30 : 13, maxRow), 11, 0, 0);
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

  zebra_(sh.getRange(2, 1, last - 1, 10), C.card, C.stripe);

  // Display formats only — stored values and formulas are untouched.
  sh.getRange('A2:A' + last).setNumberFormat('dd mmm yyyy hh:mm').setFontColor(C.muted);
  sh.getRange('B2:B' + last).setNumberFormat('dd mmm yyyy hh:mm');
  sh.getRange('C2:C' + last).setNumberFormat(MONEY)
    .setHorizontalAlignment('right').setFontWeight('bold');
  sh.getRange('J2:J' + last).setNumberFormat('mmm yyyy').setFontColor(C.muted);
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

  zebra_(sh.getRange(2, 1, last - 1, 2), C.card, C.stripe);

  sh.setColumnWidth(1, 160);
  sh.setColumnWidth(2, 200);
  if (sh.getFrozenRows() === 0) sh.setFrozenRows(1);
  sh.setRowHeight(1, 28);
}

/* ========================================================================== */
/*  9. SAFETY NET — before/after comparison                                   */
/* ========================================================================== */

var WATCH = [
  'B8','E8','I8','M8',                                               // KPI cards
  'C14','C15','C16','C17','C18','C19','C20','C21',                   // category totals
  'F14','F15','F16','F17','F18','F19',                               // payment totals
  'I14','I15','I16','I17','I18','I19',                               // monthly trend
  'I20','I21','I22','I23','I24','I25',
  'H14','H25',                                                       // trend axis keys
  'C5','B31','C31','G31'                                             // filter + array anchor
];

function snapshot_(sh) {
  var snap = { cells: {}, merges: 0, charts: 0, validation: 'none' };

  WATCH.forEach(function (a1) {
    var r = sh.getRange(a1);
    snap.cells[a1] = { v: String(r.getDisplayValue()), f: String(r.getFormula()) };
  });

  snap.merges = sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns())
                  .getMergedRanges().length;
  snap.charts = sh.getCharts().length;

  var dv = sh.getRange('C5').getDataValidation();
  if (dv) {
    snap.validation = String(dv.getCriteriaType()) + ' :: ' +
                      JSON.stringify(dv.getCriteriaValues());
  }
  return snap;
}

function report_(before, after) {
  var drift = [];

  Logger.log('--- VERIFICATION -------------------------------------------');

  WATCH.forEach(function (a1) {
    var b = before.cells[a1], a = after.cells[a1];
    var moved = b.f !== a.f;
    // A display value legitimately changes when a number format is applied,
    // so only a changed FORMULA counts as real drift.
    if (moved) drift.push(a1 + '  formula "' + b.f + '" -> "' + a.f + '"');
    Logger.log(a1 + '   ' + b.v + '  ->  ' + a.v + (moved ? '   *** FORMULA CHANGED ***' : ''));
  });

  if (before.merges !== after.merges) {
    drift.push('merged ranges ' + before.merges + ' -> ' + after.merges);
  }
  if (before.charts !== after.charts) {
    drift.push('chart count ' + before.charts + ' -> ' + after.charts);
  }
  if (before.validation !== after.validation) {
    drift.push('C5 dropdown rule "' + before.validation + '" -> "' + after.validation + '"');
  }

  Logger.log('merged ranges: ' + after.merges + '   charts: ' + after.charts);
  Logger.log('C5 dropdown:   ' + after.validation);

  if (drift.length) {
    Logger.log('!!! ' + drift.length + ' CHANGE(S) DETECTED — restore via File > Version history:');
    drift.forEach(function (d) { Logger.log('    ' + d); });
    throw new Error('Drift detected. See the log and restore from version history.');
  }

  Logger.log('OK — every watched formula is byte-identical, merges, charts and the');
  Logger.log('     month dropdown are unchanged. Only formatting was modified.');
  Logger.log('------------------------------------------------------------');
}

/* ========================================================================== */
/*  helpers                                                                   */
/* ========================================================================== */

/** Alternating row backgrounds across a whole range, in one API call. */
function zebra_(range, evenColor, oddColor) {
  var n = range.getNumRows(), m = range.getNumColumns();
  if (n < 1 || m < 1) return;
  var bg = [];
  for (var i = 0; i < n; i++) {
    var color = (i % 2 === 0) ? evenColor : oddColor;
    var row = [];
    for (var j = 0; j < m; j++) row.push(color);
    bg.push(row);
  }
  range.setBackgrounds(bg);
}

/** setRowHeights that never runs off the end of the sheet. */
function setRowHeightsSafe_(sh, start, count, px) {
  var maxRow = sh.getMaxRows();
  if (start > maxRow) return;
  sh.setRowHeights(start, Math.min(count, maxRow - start + 1), px);
}

function clampRow_(row, maxRow) {
  return Math.min(Math.max(1, row), Math.max(1, maxRow));
}

function colNum_(letter) {
  var n = 0;
  for (var i = 0; i < letter.length; i++) n = n * 26 + (letter.charCodeAt(i) - 64);
  return n;
}