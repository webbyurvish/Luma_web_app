/**
 * ============================================================================
 *  LUMA PLANNING — recurring bills, monthly budgets, daily reminder email
 * ============================================================================
 *
 *  Two new entity sheets on the same schema-driven machinery as Accounts &co
 *  (createEntity_ / readEntity_ / updateSchemaEntity_ / deleteSchemaEntity_):
 *
 *    Bills    — rent, EMIs, subscriptions, insurance premiums… with a next due
 *               date that rolls forward when you mark one paid.
 *    Budgets  — a monthly limit per expense category, with an alert threshold.
 *
 *  Routes (behind the passcode gate; the Shortcut key can't reach them):
 *    GET  ?action=bills | ?action=budgets
 *    POST { action: 'bill' | 'budget', ... }                       create
 *    POST { action: 'bill' | 'budget', operation: 'update' | 'delete', id }
 *    POST { action: 'bill', operation: 'pay', id, dueDate, amount?, date?, accountId? }
 *         → records the payment as a transaction (moving the linked account's
 *           balance like any other expense) and rolls Next Due Date forward.
 *
 *  The sheets are created on first use; setupLumaSheets() is not required.
 *  Optional: run setupLumaDailyDigest() once to get a morning email listing
 *  bills due, tasks due, budgets near their limit and documents expiring.
 * ============================================================================
 */

var LUMA_PLANNING_SCHEMAS = {
  Bills: {
    idPrefix: 'BILL',
    cols: [
      { n: 'Bill ID', w: 110, a: 'left' },
      { n: 'Name', w: 200, a: 'left' },
      { n: 'Amount', w: 120, a: 'right', f: 'money' },
      { n: 'Category', w: 130, a: 'left' },
      { n: 'Payment Method', w: 130, a: 'left' },
      { n: 'Account ID', w: 110, a: 'left' },
      { n: 'Frequency', w: 110, a: 'left' },
      { n: 'Next Due Date', w: 130, a: 'left', f: 'date' },
      { n: 'Due Day', w: 80, a: 'center', f: 'int' },
      { n: 'Remind Days Before', w: 140, a: 'center', f: 'int' },
      { n: 'Is Active', w: 90, a: 'center' },
      { n: 'Last Paid Date', w: 130, a: 'left', f: 'date' },
      { n: 'Notes', w: 240, a: 'left', wrap: true },
      { n: 'Created At', w: 150, a: 'left', f: 'datetime' },
      { n: 'Updated At', w: 150, a: 'left', f: 'datetime' }
    ]
  },
  Budgets: {
    idPrefix: 'BUD',
    cols: [
      { n: 'Budget ID', w: 110, a: 'left' },
      { n: 'Category', w: 160, a: 'left' },
      { n: 'Monthly Limit', w: 130, a: 'right', f: 'money' },
      { n: 'Alert At Percent', w: 130, a: 'center', f: 'int' },
      { n: 'Is Active', w: 90, a: 'center' },
      { n: 'Notes', w: 240, a: 'left', wrap: true },
      { n: 'Created At', w: 150, a: 'left', f: 'datetime' },
      { n: 'Updated At', w: 150, a: 'left', f: 'datetime' }
    ]
  }
};

var LUMA_PLANNING_ACTIONS = { bill: 'Bills', budget: 'Budgets' };
var LUMA_PLANNING_LISTS = { bills: 'Bills', budgets: 'Budgets' };
var LUMA_BILL_FREQUENCIES = { 'weekly': 0, 'monthly': 1, 'quarterly': 3, 'half-yearly': 6, 'yearly': 12, 'one-time': -1 };

/**
 * Registers the schemas with Luma_Data at request time (never at file load: Apps Script
 * evaluates files in an order we don't control) and makes sure the sheet exists.
 */
function lumaPlanningSheet_(sheetName) {
  if (!LUMA_SCHEMA[sheetName]) LUMA_SCHEMA[sheetName] = LUMA_PLANNING_SCHEMAS[sheetName];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) {
    sh = ss.insertSheet(sheetName);
    var cols = LUMA_PLANNING_SCHEMAS[sheetName].cols;
    sh.getRange(1, 1, 1, cols.length).setValues([cols.map(function (c) { return c.n; })]).setFontWeight('bold');
    sh.setFrozenRows(1);
    cols.forEach(function (c, i) { sh.setColumnWidth(i + 1, c.w); });
  } else {
    ensureColumns_(sh, LUMA_PLANNING_SCHEMAS[sheetName].cols);
  }
  return sh;
}

/* ------------------------------------------------------------------ GET */

function tryHandleLumaPlanningGet_(e) {
  var action = String((e && e.parameter && e.parameter.action) || '').trim().toLowerCase();
  var sheetName = LUMA_PLANNING_LISTS[action];
  if (!sheetName) return null;
  try {
    lumaPlanningSheet_(sheetName);
    var rows = readEntity_(sheetName, true);
    return lumaJson_({ success: true, count: rows.length, data: rows });
  } catch (err) {
    return lumaJson_({ success: false, error: safeMessage_(err) });
  }
}

/* ----------------------------------------------------------------- POST */

function tryHandleLumaPlanning_(e) {
  var payload;
  try {
    payload = parseLumaPayload_(e);
  } catch (err) {
    return null;
  }
  var action = String(payload.action || '').trim().toLowerCase();
  var sheetName = LUMA_PLANNING_ACTIONS[action];
  if (!sheetName) return null;

  try {
    lumaPlanningSheet_(sheetName);
    var operation = String(payload.operation || '').trim().toLowerCase();
    if (!operation) return lumaJson_(createEntity_(sheetName, lumaPlanningClean_(sheetName, payload, true)));
    if (!payload.id) throw new Error('id is required');
    if (operation === 'update') return lumaJson_(updateSchemaEntity_(sheetName, payload.id, lumaPlanningClean_(sheetName, payload, false)));
    if (operation === 'delete') return lumaJson_(deleteSchemaEntity_(sheetName, payload.id));
    if (operation === 'pay' && sheetName === 'Bills') return lumaJson_(lumaPayBill_(payload));
    throw new Error('Unknown operation: ' + operation);
  } catch (err) {
    return lumaJson_({ success: false, error: safeMessage_(err) });
  }
}

/** Validates the fields that matter; on create, fills sensible defaults. */
function lumaPlanningClean_(sheetName, payload, isCreate) {
  var p = {};
  Object.keys(payload).forEach(function (k) { p[k] = payload[k]; });
  if (sheetName === 'Bills') {
    if (isCreate || 'name' in p) {
      p.name = String(p.name || '').trim();
      if (!p.name) throw new Error('Give the bill a name.');
    }
    if (isCreate || 'amount' in p) {
      p.amount = Number(p.amount);
      if (!(p.amount > 0)) throw new Error('Enter an amount above 0.');
    }
    if (isCreate || 'frequency' in p) {
      var f = String(p.frequency || 'Monthly').trim();
      if (!(f.toLowerCase() in LUMA_BILL_FREQUENCIES)) throw new Error('Unknown frequency: ' + f);
      p.frequency = f;
    }
    if (isCreate || 'nextDueDate' in p) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.nextDueDate || ''))) throw new Error('Pick the next due date.');
      if (isCreate || !('dueDay' in p)) p.dueDay = Number(String(p.nextDueDate).slice(8, 10));
    }
    if (isCreate) {
      if (p.remindDaysBefore === undefined || p.remindDaysBefore === '') p.remindDaysBefore = 3;
      p.isActive = p.isActive === undefined ? true : p.isActive;
    }
  } else {
    if (isCreate || 'category' in p) {
      p.category = String(p.category || '').trim();
      if (!p.category) throw new Error('Choose a category.');
    }
    if (isCreate || 'monthlyLimit' in p) {
      p.monthlyLimit = Number(p.monthlyLimit);
      if (!(p.monthlyLimit > 0)) throw new Error('Enter a monthly limit above 0.');
    }
    if (isCreate) {
      if (!p.alertAtPercent) p.alertAtPercent = 80;
      p.isActive = p.isActive === undefined ? true : p.isActive;
      lumaAssertUniqueBudget_(p.category);
    }
  }
  return p;
}

function lumaAssertUniqueBudget_(category) {
  var rows = readEntity_('Budgets', true);
  var want = String(category).trim().toLowerCase();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].category || '').trim().toLowerCase() === want) throw new Error('There is already a budget for ' + category + ' — edit that one instead.');
  }
}

/* ------------------------------------------------------------ bill dates */

function lumaIso_(d) {
  return Utilities.formatDate(d, LUMA.timezone, 'yyyy-MM-dd');
}

function lumaIsoOf_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') return lumaIso_(value);
  return String(value).slice(0, 10);
}

/** The due date after `iso` for this frequency, keeping the bill's day of month (31 → 30/28…). */
function lumaNextDue_(iso, frequency, dueDay) {
  var step = LUMA_BILL_FREQUENCIES[String(frequency || 'Monthly').toLowerCase()];
  var parts = iso.split('-').map(Number);
  if (step === 0) return lumaIso_(new Date(parts[0], parts[1] - 1, parts[2] + 7));
  if (step === -1 || step === undefined) return '';
  var day = Number(dueDay) || parts[2];
  var month = parts[1] - 1 + step;
  var lastDay = new Date(parts[0], month + 1, 0).getDate();
  return lumaIso_(new Date(parts[0], month, Math.min(day, lastDay)));
}

/**
 * Records the payment and rolls the bill forward. `dueDate` is the due date the app showed:
 * if the bill has already moved past it (paid from another tab or device), nothing happens.
 */
function lumaPayBill_(payload) {
  // Two taps (or two devices) at once must not record the payment twice. The ledger takes the
  // script lock itself (not re-entrant), so this guard is a short cache flag per bill instead.
  var cache = CacheService.getScriptCache();
  var guard = 'luma_pay_' + String(payload.id);
  if (cache.get(guard)) return { success: false, alreadyPaid: true, error: 'This bill is already being marked paid.' };
  cache.put(guard, '1', 60);
  try {
    return lumaPayBillNow_(payload);
  } finally {
    cache.remove(guard);
  }
}

function lumaPayBillNow_(payload) {
  var sh = lumaPlanningSheet_('Bills');
  var found = findRowById_(sh, 'Bill ID', payload.id);
  if (!found) throw new Error('That bill no longer exists.');
  var headers = found.headers;
  var values = sh.getRange(found.row, 1, 1, headers.length).getValues()[0];
  var get = function (name) { var i = headers.indexOf(name); return i < 0 ? '' : values[i]; };

  var due = lumaIsoOf_(get('Next Due Date'));
  if (payload.dueDate && due && String(payload.dueDate) !== due) {
    return { success: false, alreadyPaid: true, error: 'This bill was already marked paid — its next due date is ' + due + '.' };
  }
  var amount = Number(payload.amount || get('Amount'));
  if (!(amount > 0)) throw new Error('Enter the amount paid.');
  var paidOn = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.date || '')) ? String(payload.date) : lumaIso_(new Date());

  // 1. The payment, through the same path as any other expense (IDs + account balance).
  var tx = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Transactions');
  if (!tx) throw new Error('Sheet "Transactions" not found.');
  var data = {
    date: paidOn,
    amount: amount,
    type: 'Expense',
    category: String(get('Category') || 'Bills'),
    subcategory: '',
    paymentMethod: String(payload.paymentMethod || get('Payment Method') || ''),
    merchant: String(get('Name') || ''),
    note: 'Bill payment' + (due ? ' (due ' + due + ')' : ''),
    accountId: String(payload.accountId !== undefined ? payload.accountId : get('Account ID') || '')
  };
  var now = new Date();
  tx.appendRow([now, data.date, data.amount, data.type, data.category, data.subcategory, data.paymentMethod, data.merchant, data.note, transactionMonth_(data.date, now)]);
  var newRow = tx.getLastRow();
  try { assignTransactionLifecycleFields_(tx, newRow); } catch (err) { Logger.log('lifecycle fields skipped: ' + err.message); }
  try { lumaLinkNewTransaction_(tx, newRow, data); } catch (err) { Logger.log('ledger link skipped: ' + err.message); }

  // 2. Roll the bill forward (one-time bills switch off instead).
  var next = lumaNextDue_(due || paidOn, get('Frequency'), get('Due Day'));
  var change = { lastPaidDate: paidOn };
  if (next) change.nextDueDate = next;
  else change.isActive = false;
  updateSchemaEntity_('Bills', payload.id, change);

  return { success: true, paidOn: paidOn, nextDueDate: next || null, amount: amount };
}

/* ---------------------------------------------------------- daily digest */

/** Run once from the editor: a reminder email every morning around 8 (only when something is due). */
function setupLumaDailyDigest() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'lumaDailyDigest') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('lumaDailyDigest').timeBased().everyDays(1).atHour(8).inTimezone(LUMA.timezone).create();
  Logger.log('Daily digest scheduled for ~8 AM. Sending a test now…');
  lumaDailyDigest(true);
}

function removeLumaDailyDigest() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'lumaDailyDigest') ScriptApp.deleteTrigger(t);
  });
  Logger.log('Daily digest switched off.');
}

function lumaDailyDigest(force) {
  var today = lumaIso_(new Date());
  var addDays = function (iso, n) { var p = iso.split('-').map(Number); return lumaIso_(new Date(p[0], p[1] - 1, p[2] + n)); };
  var money = function (n) { return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN'); };
  var lines = { bills: [], tasks: [], budgets: [], documents: [] };

  try {
    lumaPlanningSheet_('Bills');
    readEntity_('Bills', true).forEach(function (b) {
      if (b.isActive === false || String(b.isActive).toUpperCase() === 'FALSE') return;
      var due = lumaIsoOf_(b.nextDueDate);
      if (!due) return;
      var remind = b.remindDaysBefore === null || b.remindDaysBefore === undefined ? 3 : Number(b.remindDaysBefore);
      if (due < today) lines.bills.push('OVERDUE since ' + due + ' — ' + b.name + ' ' + money(b.amount));
      else if (due <= addDays(today, remind)) lines.bills.push((due === today ? 'Due TODAY' : 'Due ' + due) + ' — ' + b.name + ' ' + money(b.amount));
    });
  } catch (err) { Logger.log('digest bills: ' + err.message); }

  try {
    readEntity_('Tasks', false).forEach(function (t) {
      var due = lumaIsoOf_(t.dueDate);
      if (!due || t.isCompleted === true || /completed|cancelled/i.test(String(t.status || ''))) return;
      if (due <= today) lines.tasks.push((due < today ? 'Overdue (' + due + ')' : 'Today') + ' — ' + t.title);
    });
  } catch (err) { Logger.log('digest tasks: ' + err.message); }

  try {
    lumaPlanningSheet_('Budgets');
    var budgets = readEntity_('Budgets', true).filter(function (b) { return !(b.isActive === false || String(b.isActive).toUpperCase() === 'FALSE'); });
    if (budgets.length) {
      var month = today.slice(0, 7);
      var spent = {};
      (readTransactions_(SpreadsheetApp.getActiveSpreadsheet(), false) || []).forEach(function (t) {
        if (String(t.type).toLowerCase() !== 'expense' || String(t.date).slice(0, 7) !== month) return;
        var key = String(t.category || '').trim().toLowerCase();
        spent[key] = (spent[key] || 0) + Number(t.amount || 0);
      });
      budgets.forEach(function (b) {
        var used = spent[String(b.category || '').trim().toLowerCase()] || 0;
        var pct = b.monthlyLimit ? Math.round((used / b.monthlyLimit) * 100) : 0;
        if (pct >= (Number(b.alertAtPercent) || 80)) lines.budgets.push(b.category + ': ' + money(used) + ' of ' + money(b.monthlyLimit) + ' (' + pct + '%)');
      });
    }
  } catch (err) { Logger.log('digest budgets: ' + err.message); }

  try {
    var meta = lumaReadDriveMeta_();
    var docs = readEntity_('Documents', true);
    var names = {};
    docs.forEach(function (d) { if (d.driveFileId) names[d.driveFileId] = d.name; });
    Object.keys(meta).forEach(function (id) {
      var exp = meta[id].expiryDate;
      if (exp && exp <= addDays(today, 30)) lines.documents.push((exp < today ? 'EXPIRED ' : 'Expires ') + exp + ' — ' + (names[id] || 'a document'));
    });
  } catch (err) { Logger.log('digest documents: ' + err.message); }

  var family = typeof lumaFamilyDigestLines_ === 'function' ? lumaFamilyDigestLines_(today) : { recharges: [], dates: [] };
  lines.recharges = family.recharges;
  lines.dates = family.dates;
  var life = typeof lumaLifeDigestLines_ === 'function' ? lumaLifeDigestLines_(today) : { vehicles: [], reminders: [] };
  lines.vehicles = life.vehicles;
  lines.reminders = life.reminders;

  var total = lines.bills.length + lines.tasks.length + lines.budgets.length + lines.documents.length + lines.recharges.length + lines.dates.length + lines.vehicles.length + lines.reminders.length;
  if (!total && !force) return;

  var section = function (title, list) { return list.length ? title + '\n' + list.map(function (l) { return '  • ' + l; }).join('\n') + '\n\n' : ''; };
  var body =
    (total ? '' : 'Nothing needs your attention today. (Test email.)\n\n') +
    section('Birthdays and important dates', lines.dates) +
    section('Bills', lines.bills) +
    section('Recharges', lines.recharges) +
    section('Vehicles', lines.vehicles) +
    section('Tasks', lines.tasks) +
    section('Budgets near or over the limit', lines.budgets) +
    section('Documents expiring', lines.documents) +
    section('Reminders', lines.reminders) +
    'Open Luma to act on these.\n— Luma';
  // Only ever to the script owner: nothing in a request can choose the recipient.
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Luma · ' + (total ? total + ' thing' + (total > 1 ? 's' : '') + ' need attention' : 'daily digest is on'), body);
}
