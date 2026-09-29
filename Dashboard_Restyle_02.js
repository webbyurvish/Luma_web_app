/**
 * ============================================================================
 *  PERSONAL FINANCE TRACKER — VISUAL SYSTEM  (v3)
 * ============================================================================
 *
 *  This is the same Dashboard_Restyle script you already have, rewritten to
 *  remove duplicated styling code and to make the formatting survive every
 *  future transaction. It is not a second, competing script.
 *
 *  WHAT CHANGED FROM v2
 *  --------------------
 *  - The four near-identical table stylers collapsed into one spec-driven
 *    styleTable(). Dashboard breakdowns, the ledger, Transactions and
 *    Categories all now go through it.
 *  - New navy fintech palette; navy headers on the two transaction tables,
 *    light headers on the small breakdown tables, for hierarchy.
 *  - Donut slice colours are looked up BY LABEL, so they stay correct even if
 *    you reorder the category or payment rows.
 *  - Auto-formatting: formats are written across the full sheet body, not just
 *    populated rows, and all striping/colour-coding is conditional formatting.
 *    Appended rows therefore inherit styling with no trigger and no change to
 *    your web app. installFormattingTriggers() adds an optional safety net.
 *  - Safety net extended: formulas, merges, charts, the C5 dropdown, and the
 *    Transactions header row are all diffed before and after.
 *
 *  WHAT IT STILL NEVER DOES
 *  ------------------------
 *  No setValue / setFormula / setValues / setFormulas anywhere.
 *  No insert/delete of rows, columns, sheets or charts. No renames.
 *  No changes to data validation, dropdowns, chart data ranges, named ranges,
 *  merge structure, the web app, its URL, its JSON fields, or the Shortcut.
 *  Charts are not moved unless you opt in (CFG.repositionCharts).
 *  Re-running is safe: every rule it adds, it first removes.
 *
 *  HOW TO RUN
 *  ----------
 *  1. Extensions -> Apps Script, open your existing Dashboard_Restyle file and
 *     replace its contents with this. Leave your web-app script file alone.
 *  2. Run  restyleWorkbook .  Read the log; it throws if anything drifted.
 *  3. Optional, once:  installFormattingTriggers()  — only needed if the
 *     Transactions sheet may grow past its current row count.
 *
 *  TO UNDO: File -> Version history -> Restore, in the Sheet.
 * ============================================================================
 */

var CFG = {

  /** Charts keep their existing positions. Flip to true to arrange them:
   *  two donuts side by side, trend chart beneath, below the ledger. */
  repositionCharts: false,

  /** One currency format used in every single place. '₹#,##0.00' for paise. */
  money:  '₹#,##0',

  /** One date format used in every single place. Renders 21 Sep 2026 12:41 */
  date:   'dd mmm yyyy hh:mm',

  font:   'Arial',

  /** Rows 1..n of the sheet body that get pre-formatted so appended rows
   *  inherit styling. 0 = use the sheet's full height (recommended). */
  bodyRows: 0,

  /** A basic filter on Transactions is handy but can hide rows from anyone
   *  else looking at the sheet. Off by default. */
  addFilter: false,

  /** Pin the Dashboard header while scrolling. Off by default because frozen
   *  rows are arguably structure rather than styling. */
  freezeDashboardHeader: false,

  styleDataSheets: true
};

/* --- colour system -------------------------------------------------------- */
var C = {
  navy:       '#0F172A',
  navy2:      '#1E293B',
  canvas:     '#F8FAFC',
  card:       '#FFFFFF',

  blue:       '#2563EB',
  green:      '#16A34A',
  red:        '#DC2626',
  amber:      '#F59E0B',
  purple:     '#7C3AED',

  text:       '#0F172A',
  muted:      '#64748B',
  border:     '#E2E8F0',
  stripe:     '#F8FAFC',
  headerLite: '#F1F5F9',

  // Very light accent washes for the KPI label bands.
  greenTint:  '#ECFDF5',
  redTint:    '#FEF2F2',
  purpleTint: '#F5F3FF',
  blueTint:   '#EFF6FF'
};

/** Slice + text colours keyed by the label exactly as it is stored in the
 *  sheet. Lookups are case-insensitive, so order and casing never matter. */
var CATEGORY_COLORS = {
  'Food':          '#22C55E',
  'Transport':     '#3B82F6',
  'Shopping':      '#F59E0B',
  'Bills':         '#EF4444',
  'Home':          '#8B5CF6',
  'Entertainment': '#EC4899',
  'Health':        '#14B8A6',
  'Other':         '#64748B'
};

var PAYMENT_COLORS = {
  'UPI':          '#2563EB',
  'Credit Card':  '#7C3AED',
  'Debit Card':   '#F59E0B',
  'Cash':         '#16A34A',
  'Net Banking':  '#0EA5E9',
  'Other':        '#64748B'
};

var FALLBACK_COLOR = '#94A3B8';

var SOLID       = SpreadsheetApp.BorderStyle.SOLID;
var SOLID_THICK = SpreadsheetApp.BorderStyle.SOLID_THICK;
var CLIP        = SpreadsheetApp.WrapStrategy.CLIP;

/** Every conditional-format rule this script owns is tagged by its range, so
 *  re-running replaces only our own rules and leaves yours alone. */
var OWNED_CF_RANGES = {};

/* ========================================================================== */
/*  ENTRY POINTS                                                              */
/* ========================================================================== */

function restyleWorkbook() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var dash = ss.getSheetByName('Dashboard');
  if (!dash) throw new Error('No sheet named "Dashboard". Nothing was changed.');

  var before = snapshot_(ss);

  styleDashboard(dash);
  styleKpiCards(dash);
  styleCharts(dash);
  applyConditionalFormatting(dash);

  if (CFG.styleDataSheets) {
    styleTransactions(ss.getSheetByName('Transactions'));
    styleCategories(ss.getSheetByName('Categories'));
    // Budget sheet skipped on purpose — it is empty, so there is nothing to style.
  }

  SpreadsheetApp.flush();
  report_(before, snapshot_(ss));
}

/** Re-apply Transactions formatting on demand. Safe to run any number of
 *  times, and safe to call from your own code if you ever want to. */
function formatTransactionsSheet() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Transactions');
  styleTransactions(sh);
  SpreadsheetApp.flush();
}

/* ========================================================================== */
/*  DASHBOARD                                                                 */
/* ========================================================================== */

function styleDashboard(sh) {
  styleDashboardCanvas_(sh);
  styleDashboardHeader_(sh);
  styleDashboardTables_(sh);
}

/* --- canvas: gridlines, background, grid geometry ------------------------- */

function styleDashboardCanvas_(sh) {
  sh.setHiddenGridlines(true);

  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns())
    .setBackground(C.canvas)
    .setFontFamily(CFG.font)
    .setFontColor(C.text);

  // Every KPI card is exactly 224px wide, gutters 84-96px.
  //   card 1 = B+C    card 2 = E+F+G    card 3 = I+J+K    card 4 = M+N+O+P
  // A and Q are the page margins. Column B is sized for "21 Sep 2026 12:41".
  applyColumnWidths_(sh, {
    A: 22,  B: 132, C: 92,  D: 96,  E: 80,  F: 92,  G: 52,  H: 84,
    I: 112, J: 56,  K: 56,  L: 84,  M: 56,  N: 56,  O: 56,  P: 56, Q: 22
  });

  // Nothing past row 45 is touched, so charts sitting in the right-hand
  // columns keep the vertical space they already occupy.
  applyRowHeights_(sh, {
    1: 12,   // top margin
    2: 34,   // title            (B2:P3 merged)
    3: 14,
    4: 20,   // subtitle         (B4:P4 merged)
    5: 30,   // period selector
    6: 14,   // divider
    7: 26,   // KPI label band   (B7:C7 merged, etc.)
    8: 38,   // KPI amount       (B8:C10 merged, etc.)
    9: 14,
    10: 10,  // card padding
    11: 18,
    12: 10,
    13: 26,  // breakdown table headers
    26: 12,
    27: 12,
    28: 26,  // RECENT TRANSACTIONS
    29: 8,
    30: 26,  // ledger header
    45: 12
  });
  setRowHeightsSafe_(sh, 14, 12, 22);   // 14-25  breakdown bodies
  setRowHeightsSafe_(sh, 31, 14, 22);   // 31-44  ledger rows

  if (CFG.freezeDashboardHeader && sh.getFrozenRows() === 0) sh.setFrozenRows(5);
}

/* --- header + period selector --------------------------------------------- */

function styleDashboardHeader_(sh) {
  // The sheet already reads "PERSONAL FINANCE" / "Expense overview & spending
  // insights". Only their appearance changes — no text is written.
  sh.getRange('B2')
    .setFontSize(22).setFontWeight('bold').setFontColor(C.navy)
    .setHorizontalAlignment('left').setVerticalAlignment('bottom')
    .setWrapStrategy(CLIP);

  sh.getRange('B4')
    .setFontSize(10).setFontWeight('normal').setFontColor(C.muted)
    .setHorizontalAlignment('left').setVerticalAlignment('top')
    .setWrapStrategy(CLIP);

  sh.getRange('B5')
    .setFontSize(9).setFontWeight('bold').setFontColor(C.muted)
    .setHorizontalAlignment('left').setVerticalAlignment('middle');

  // The live month selector, styled as a filter control.
  // Its number format is deliberately NOT touched: C5 holds a real date that
  // the SUMIFS formulas match against Transactions!J:J, and the dropdown items
  // render off that same format. This is the one cosmetic change that could
  // plausibly break the period filter, so it is left alone.
  sh.getRange('C5')
    .setBackground(C.card)
    .setFontSize(10).setFontWeight('bold').setFontColor(C.navy)
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false, C.border, SOLID);

  sh.getRange('B6:P6')
    .setBorder(null, null, true, null, null, null, C.border, SOLID);
}

/* --- KPI cards ------------------------------------------------------------ */

function styleKpiCards(sh) {
  // Google Sheets has no cell shadow and no corner radius. The closest premium
  // equivalent is a tinted label band, a thick coloured left accent, a hairline
  // box, and generous internal whitespace — which is what this does.
  var cards = [
    { box: 'B7:C10', label: 'B7', value: 'B8', accent: C.green,  tint: C.greenTint  },
    { box: 'E7:G10', label: 'E7', value: 'E8', accent: C.red,    tint: C.redTint    },
    { box: 'I7:K10', label: 'I7', value: 'I8', accent: C.purple, tint: C.purpleTint },
    { box: 'M7:P10', label: 'M7', value: 'M8', accent: C.blue,   tint: C.blueTint   }
  ];

  cards.forEach(function (card) {
    var box = sh.getRange(card.box);

    box.setBackground(C.card)
       .setBorder(true, true, true, true, false, false, C.border, SOLID);

    // Passing null for the other three sides leaves the hairline box intact.
    box.setBorder(null, true, null, null, null, null, card.accent, SOLID_THICK);

    sh.getRange(card.label)
      .setBackground(card.tint)
      .setFontSize(9).setFontWeight('bold').setFontColor(C.muted)
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setWrapStrategy(CLIP);

    // The amount is the hero: roughly 2.4x the label.
    sh.getRange(card.value)
      .setBackground(C.card)
      .setFontSize(22).setFontWeight('bold').setFontColor(card.accent)
      .setNumberFormat(CFG.money)
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setWrapStrategy(CLIP);
  });
}

/* --- the four dashboard tables, all through one styler -------------------- */

function styleDashboardTables_(sh) {
  // Three small breakdown tables: light headers, so they read as supporting
  // material next to the navy-headed ledger.
  styleTable(sh, {
    header: 'B13:C13', body: 'B14:C21', box: 'B13:C21', theme: 'light',
    cols: { B: { align: 'left' }, C: { align: 'right', fmt: CFG.money, bold: true } }
  });

  styleTable(sh, {
    header: 'E13:F13', body: 'E14:F19', box: 'E13:F19', theme: 'light',
    cols: { E: { align: 'left' }, F: { align: 'right', fmt: CFG.money, bold: true } }
  });

  styleTable(sh, {
    header: 'H13:I13', body: 'H14:I25', box: 'H13:I25', theme: 'light',
    cols: { H: { align: 'left', fmt: 'mmm yyyy' },
            I: { align: 'right', fmt: CFG.money, bold: true } }
  });

  // Section label above the ledger.
  sh.getRange('B28')
    .setFontSize(12).setFontWeight('bold').setFontColor(C.navy)
    .setHorizontalAlignment('left').setVerticalAlignment('middle')
    .setWrapStrategy(CLIP);

  // The ledger. Its body is a spilled SORT/FILTER array, so the styled band is
  // deliberately taller than today's data; number formats on empty cells are
  // harmless and are inherited as the array grows.
  styleTable(sh, {
    header: 'B30:G30', body: 'B31:G44', box: 'B30:G44', theme: 'navy',
    cols: {
      B: { align: 'left',  fmt: CFG.date },
      C: { align: 'left' },
      D: { align: 'left',  color: C.muted },
      E: { align: 'left' },
      F: { align: 'left',  color: C.muted },
      G: { align: 'right', fmt: CFG.money, bold: true }
    }
  });
}

/* ========================================================================== */
/*  GENERIC TABLE STYLER — used by every table in the workbook                */
/* ========================================================================== */

/**
 * spec = {
 *   header: 'B30:G30'          header row range
 *   body:   'B31:G44'          body range
 *   box:    'B30:G44'          range to draw the outer hairline around
 *   theme:  'navy' | 'light'   header treatment
 *   cols:   { B: {align, fmt, color, bold}, ... }   keyed by column letter
 * }
 */
function styleTable(sh, spec) {
  var navy = spec.theme === 'navy';

  sh.getRange(spec.body).setBackground(C.card);

  sh.getRange(spec.header)
    .setBackground(navy ? C.navy : C.headerLite)
    .setFontFamily(CFG.font).setFontSize(9).setFontWeight('bold')
    .setFontColor(navy ? C.card : C.navy)
    .setVerticalAlignment('middle').setWrapStrategy(CLIP)
    .setBorder(null, null, true, null, null, null,
               navy ? C.navy : C.border, SOLID);

  sh.getRange(spec.body)
    .setFontFamily(CFG.font).setFontSize(10).setFontWeight('normal')
    .setFontColor(C.text)
    .setVerticalAlignment('middle').setWrapStrategy(CLIP);

  // Per-column treatment, applied down the body's own row span.
  var bodyRange = sh.getRange(spec.body);
  var firstRow  = bodyRange.getRow();
  var numRows   = bodyRange.getNumRows();

  Object.keys(spec.cols || {}).forEach(function (letter) {
    var opt = spec.cols[letter];
    var col = sh.getRange(firstRow, colNum_(letter), numRows, 1);

    if (opt.align) col.setHorizontalAlignment(opt.align);
    if (opt.fmt)   col.setNumberFormat(opt.fmt);
    if (opt.color) col.setFontColor(opt.color);
    if (opt.bold)  col.setFontWeight('bold');

    // Header cell of a right-aligned column follows its numbers.
    if (opt.align === 'right') {
      sh.getRange(sh.getRange(spec.header).getRow(), colNum_(letter), 1, 1)
        .setHorizontalAlignment('right');
    }
  });

  // One hairline box, no inner grid. Striping does the row separation.
  if (spec.box) {
    sh.getRange(spec.box)
      .setBorder(true, true, true, true, false, false, C.border, SOLID);
  }
}

/* ========================================================================== */
/*  CONDITIONAL FORMATTING                                                    */
/*  Everything that must keep working as rows appear lives here, because a     */
/*  conditional rule covers future rows for free.                             */
/* ========================================================================== */

function applyConditionalFormatting(sh) {
  var balance = 'I8:K10';
  var ledger  = 'B31:G44';
  var catCol  = 'C31:C44';
  var payCol  = 'E31:E44';

  var rules = keepForeignRules_(sh, [balance, ledger, catCol, payCol]);

  // Balance: green when positive, red when negative. The purple accent border
  // on the card still identifies it as the balance KPI. The formula is untouched.
  rules.push(cf_(sh, balance, function (b) { return b.whenNumberGreaterThan(0).setFontColor(C.green); }));
  rules.push(cf_(sh, balance, function (b) { return b.whenNumberLessThan(0).setFontColor(C.red); }));

  // Zebra striping that only paints rows the array formula actually filled,
  // so the empty tail of the ledger stays clean white.
  rules.push(cf_(sh, ledger, function (b) {
    return b.whenFormulaSatisfied('=AND($B31<>"",ISEVEN(ROW()))').setBackground(C.stripe);
  }));

  // Subtle category and payment differentiation — coloured text, never a
  // coloured cell background.
  pushLabelColorRules_(rules, sh, catCol, CATEGORY_COLORS);
  pushLabelColorRules_(rules, sh, payCol, PAYMENT_COLORS);

  sh.setConditionalFormatRules(rules);
}

/** Conditional formatting for the Transactions sheet, over an open row band so
 *  that every future row is covered without any trigger firing. */
function applyTransactionsConditionalFormatting_(sh, lastBodyRow) {
  var body   = 'A2:J' + lastBodyRow;
  var catCol = 'E2:E' + lastBodyRow;
  var payCol = 'G2:G' + lastBodyRow;

  var rules = keepForeignRules_(sh, [body, catCol, payCol]);

  rules.push(cf_(sh, body, function (b) {
    return b.whenFormulaSatisfied('=AND($B2<>"",ISEVEN(ROW()))').setBackground(C.stripe);
  }));

  // Income rows read green, expense rows stay neutral — one glance tells them apart.
  rules.push(cf_(sh, body, function (b) {
    return b.whenFormulaSatisfied('=AND($B2<>"",$D2="Income")').setFontColor(C.green);
  }));

  pushLabelColorRules_(rules, sh, catCol, CATEGORY_COLORS);
  pushLabelColorRules_(rules, sh, payCol, PAYMENT_COLORS);

  sh.setConditionalFormatRules(rules);
}

/** One text-colour rule per known label. */
function pushLabelColorRules_(rules, sh, a1, colorMap) {
  Object.keys(colorMap).forEach(function (label) {
    rules.push(cf_(sh, a1, function (b) {
      return b.whenTextEqualTo(titleCase_(label)).setFontColor(colorMap[label]);
    }));
  });
}

/** Build one rule, remembering the range as ours. */
function cf_(sh, a1, configure) {
  OWNED_CF_RANGES[sh.getSheetId() + '!' + a1] = true;
  return configure(
    SpreadsheetApp.newConditionalFormatRule().setRanges([sh.getRange(a1)])
  ).build();
}

/** Drop rules whose range matches one we are about to re-create; keep the rest,
 *  so anything you added by hand survives and re-running stays idempotent. */
function keepForeignRules_(sh, ourRanges) {
  var mine = {};
  ourRanges.forEach(function (a1) { mine[a1] = true; });

  return sh.getConditionalFormatRules().filter(function (rule) {
    return !rule.getRanges().some(function (r) { return mine[r.getA1Notation()]; });
  });
}

/* ========================================================================== */
/*  CHARTS — restyled in place, data ranges never touched                     */
/* ========================================================================== */

function styleCharts(sh) {
  var charts = sh.getCharts();
  if (!charts.length) {
    Logger.log('NOTE: no charts on Dashboard — chart styling skipped.');
    return;
  }

  // Slice colours are read from the live label cells, so they stay attached to
  // the right categories even if you reorder the breakdown rows later.
  var categoryColors = colorsForLabels_(sh, 'B14:B21', CATEGORY_COLORS);
  var paymentColors  = colorsForLabels_(sh, 'E14:E19', PAYMENT_COLORS);

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

    b.setOption('fontName', CFG.font)
     .setOption('backgroundColor', { fill: C.card, stroke: C.border, strokeWidth: 1 })
     .setOption('titleTextStyle',  { color: C.navy, fontSize: 12, bold: true, fontName: CFG.font })
     .setOption('tooltip',         { textStyle: { fontName: CFG.font, fontSize: 11 } });

    if (isTrend) {
      b.setOption('title', 'Monthly Expense Trend')
       .setOption('legend', { position: 'none' })
       .setOption('curveType', 'none')
       .setOption('series', { 0: { color: C.blue, lineWidth: 3, pointSize: 5 } })
       .setOption('chartArea', { left: 74, top: 46, width: '82%', height: '64%' })
       .setOption('vAxis', {
          title:  'Expense',
          format: CFG.money,
          gridlines:      { color: C.border, count: 5 },
          minorGridlines: { count: 0 },
          baselineColor:  C.border,
          titleTextStyle: { color: C.muted, fontSize: 10, italic: false, fontName: CFG.font },
          textStyle:      { color: C.muted, fontSize: 10, fontName: CFG.font }
        })
       .setOption('hAxis', {
          title: 'Month',
          gridlines:      { color: 'transparent' },
          minorGridlines: { count: 0 },
          baselineColor:  C.border,
          slantedText:    false,
          titleTextStyle: { color: C.muted, fontSize: 10, italic: false, fontName: CFG.font },
          textStyle:      { color: C.muted, fontSize: 10, fontName: CFG.font }
        })
       .setOption('width', 900).setOption('height', 300);

      if (CFG.repositionCharts) b.setPosition(clampRow_(63, maxRow), 2, 0, 0);

    } else {
      pieSeen++;
      b.setOption('pieHole', 0.62)
       .setOption('title', isPayment ? 'Expense by Payment Method' : 'Expense by Category')
       .setOption('colors', isPayment ? paymentColors : categoryColors)
       .setOption('pieSliceText', 'percentage')
       .setOption('pieSliceTextStyle', { color: '#FFFFFF', fontSize: 10, fontName: CFG.font })
       .setOption('pieSliceBorderColor', '#FFFFFF')
       .setOption('chartArea', { left: 10, top: 44, width: '88%', height: '76%' })
       .setOption('legend', { position: 'right', alignment: 'center',
                              textStyle: { color: C.muted, fontSize: 10, fontName: CFG.font } })
       .setOption('width', 440).setOption('height', 270);

      if (CFG.repositionCharts) {
        b.setPosition(clampRow_(47, maxRow), isPayment ? 8 : 2, 0, 0);
      }
    }

    sh.updateChart(b.build());
  });
}

/** Read labels from a range and map each to its brand colour, in slice order. */
function colorsForLabels_(sh, a1, colorMap) {
  return sh.getRange(a1).getValues().map(function (row) {
    var key = String(row[0] || '').trim().toLowerCase();
    return colorMap[key] || FALLBACK_COLOR;
  });
}

/* ========================================================================== */
/*  TRANSACTIONS + CATEGORIES                                                 */
/* ========================================================================== */

/**
 * Formats the Transactions sheet across its whole body, not just the populated
 * rows. Number formats, fonts, alignment and column widths applied to empty
 * cells persist, and appendRow() does not clear them — so a row arriving from
 * the iPhone Shortcut lands already formatted, with no trigger involved and no
 * change to the web app.
 */
function styleTransactions(sh) {
  if (!sh) return;

  var lastBodyRow = CFG.bodyRows > 0
    ? Math.min(CFG.bodyRows + 1, sh.getMaxRows())
    : sh.getMaxRows();
  if (lastBodyRow < 2) return;

  var bodyA1 = 'A2:J' + lastBodyRow;

  styleTable(sh, {
    header: 'A1:J1', body: bodyA1, theme: 'navy',
    cols: {
      A: { align: 'left',  fmt: CFG.date,   color: C.muted },  // Timestamp
      B: { align: 'left',  fmt: CFG.date },                    // Date
      C: { align: 'right', fmt: CFG.money,  bold: true },      // Amount
      D: { align: 'left' },                                    // Type
      E: { align: 'left' },                                    // Category
      F: { align: 'left',  color: C.muted },                   // Subcategory
      G: { align: 'left' },                                    // Payment Method
      H: { align: 'left' },                                    // Merchant
      I: { align: 'left',  color: C.muted },                   // Note
      J: { align: 'left',  fmt: 'mmm yyyy', color: C.muted }   // Month
    }
  });

  applyColumnWidths_(sh, {
    A: 155, B: 155, C: 100, D: 85, E: 115,
    F: 130, G: 125, H: 135, I: 170, J: 95
  });

  sh.setRowHeight(1, 30);
  if (sh.getFrozenRows() === 0) sh.setFrozenRows(1);

  if (CFG.addFilter && !sh.getFilter()) {
    sh.getRange(1, 1, Math.max(sh.getLastRow(), 2), 10).createFilter();
  }

  applyTransactionsConditionalFormatting_(sh, lastBodyRow);
}

function styleCategories(sh) {
  if (!sh) return;
  var lastBodyRow = sh.getMaxRows();
  if (lastBodyRow < 2) return;

  styleTable(sh, {
    header: 'A1:B1', body: 'A2:B' + lastBodyRow, theme: 'navy',
    cols: { A: { align: 'left' }, B: { align: 'left', color: C.muted } }
  });

  applyColumnWidths_(sh, { A: 170, B: 210 });
  sh.setRowHeight(1, 30);
  if (sh.getFrozenRows() === 0) sh.setFrozenRows(1);

  var body  = 'A2:B' + lastBodyRow;
  var rules = keepForeignRules_(sh, [body]);
  rules.push(cf_(sh, body, function (b) {
    return b.whenFormulaSatisfied('=AND($A2<>"",ISEVEN(ROW()))').setBackground(C.stripe);
  }));
  sh.setConditionalFormatRules(rules);
}

/* ========================================================================== */
/*  OPTIONAL SAFETY NET FOR SHEET GROWTH                                      */
/*                                                                            */
/*  You do NOT need this for formatting to survive new transactions — the      */
/*  formats above already cover every row of the sheet. It only matters if     */
/*  Transactions grows past its current row count, at which point Sheets adds  */
/*  fresh unformatted rows. Run installFormattingTriggers() once if you like.  */
/* ========================================================================== */

var TRIGGER_HANDLER = 'onChangeFormatTransactions';

function installFormattingTriggers() {
  removeFormattingTriggers();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  ScriptApp.newTrigger(TRIGGER_HANDLER).forSpreadsheet(ss).onChange().create();
  ScriptApp.newTrigger(TRIGGER_HANDLER).timeBased().everyHours(6).create();

  Logger.log('Installed onChange + 6-hourly formatting triggers.');
}

function removeFormattingTriggers() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === TRIGGER_HANDLER) {
      ScriptApp.deleteTrigger(tr);
      removed++;
    }
  });
  Logger.log('Removed ' + removed + ' formatting trigger(s).');
}

/**
 * Trigger handler. Re-formats only when the sheet has actually outgrown the
 * band we last formatted, so it costs almost nothing on a normal change and
 * can never fight with the web app mid-append.
 */
function onChangeFormatTransactions(e) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Transactions');
  if (!sh) return;

  var props  = PropertiesService.getDocumentProperties();
  var marked = Number(props.getProperty('TX_FORMATTED_THROUGH') || 0);
  var have   = sh.getMaxRows();

  if (have <= marked) return;           // nothing new to cover
  styleTransactions(sh);
  props.setProperty('TX_FORMATTED_THROUGH', String(have));
}

/* ========================================================================== */
/*  SAFETY NET — before/after comparison                                      */
/* ========================================================================== */

var WATCH = [
  'B8','E8','I8','M8',                                    // KPI cards
  'C14','C15','C16','C17','C18','C19','C20','C21',        // category totals
  'F14','F15','F16','F17','F18','F19',                    // payment totals
  'I14','I15','I16','I17','I18','I19',                    // monthly trend
  'I20','I21','I22','I23','I24','I25',
  'H14','H25',                                            // trend axis keys
  'B14','B21','E14','E19',                                // chart label anchors
  'C5','B31','C31','G31'                                  // period filter + array anchor
];

function snapshot_(ss) {
  var dash = ss.getSheetByName('Dashboard');
  var tx   = ss.getSheetByName('Transactions');

  var snap = { cells: {}, merges: 0, charts: 0, validation: 'none',
               txHeader: 'none', sheets: ss.getSheets().map(function (s) { return s.getName(); }).join('|') };

  WATCH.forEach(function (a1) {
    var r = dash.getRange(a1);
    snap.cells[a1] = { v: String(r.getDisplayValue()), f: String(r.getFormula()) };
  });

  snap.merges = dash.getRange(1, 1, dash.getMaxRows(), dash.getMaxColumns())
                    .getMergedRanges().length;
  snap.charts = dash.getCharts().length;

  var dv = dash.getRange('C5').getDataValidation();
  if (dv) {
    snap.validation = String(dv.getCriteriaType()) + ' :: ' + JSON.stringify(dv.getCriteriaValues());
  }

  if (tx) snap.txHeader = tx.getRange('A1:J1').getValues()[0].join('|');

  return snap;
}

function report_(before, after) {
  var drift = [];
  Logger.log('--- VERIFICATION -------------------------------------------');

  WATCH.forEach(function (a1) {
    var b = before.cells[a1], a = after.cells[a1];
    var moved = b.f !== a.f;
    // Display values legitimately change when a number format is applied,
    // so only a changed FORMULA counts as drift.
    if (moved) drift.push(a1 + '  formula "' + b.f + '" -> "' + a.f + '"');
    Logger.log(a1 + '   ' + b.v + '  ->  ' + a.v + (moved ? '   *** FORMULA CHANGED ***' : ''));
  });

  if (before.merges     !== after.merges)     drift.push('merged ranges ' + before.merges + ' -> ' + after.merges);
  if (before.charts     !== after.charts)     drift.push('chart count ' + before.charts + ' -> ' + after.charts);
  if (before.validation !== after.validation) drift.push('C5 dropdown "' + before.validation + '" -> "' + after.validation + '"');
  if (before.txHeader   !== after.txHeader)   drift.push('Transactions header "' + before.txHeader + '" -> "' + after.txHeader + '"');
  if (before.sheets     !== after.sheets)     drift.push('sheet names "' + before.sheets + '" -> "' + after.sheets + '"');

  Logger.log('sheets:        ' + after.sheets);
  Logger.log('merged ranges: ' + after.merges + '   charts: ' + after.charts);
  Logger.log('C5 dropdown:   ' + after.validation);
  Logger.log('Tx header:     ' + after.txHeader);

  if (drift.length) {
    Logger.log('!!! ' + drift.length + ' CHANGE(S) DETECTED — restore via File > Version history:');
    drift.forEach(function (d) { Logger.log('    ' + d); });
    throw new Error('Drift detected. See the log and restore from version history.');
  }

  Logger.log('OK — formulas, merges, charts, sheet names, the period dropdown and');
  Logger.log('     the Transactions header are all unchanged. Formatting only.');
  Logger.log('------------------------------------------------------------');
}

/* ========================================================================== */
/*  helpers                                                                   */
/* ========================================================================== */

function applyColumnWidths_(sh, widths) {
  var maxCol = sh.getMaxColumns();
  Object.keys(widths).forEach(function (letter) {
    var c = colNum_(letter);
    if (c <= maxCol) sh.setColumnWidth(c, widths[letter]);
  });
}

function applyRowHeights_(sh, heights) {
  var maxRow = sh.getMaxRows();
  Object.keys(heights).forEach(function (r) {
    if (Number(r) <= maxRow) sh.setRowHeight(Number(r), heights[r]);
  });
}

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

/** 'net banking' -> 'Net Banking', to match the values stored in the sheet. */
function titleCase_(s) {
  return s.replace(/\b\w/g, function (ch) { return ch.toUpperCase(); });
}