/**
 * ============================================================================
 *  LUMA FAMILY — prepaid recharges and important dates
 * ============================================================================
 *
 *  Recharges        — every prepaid thing in the family (mobile, DTH, FASTag,
 *                     broadband…): whose it is, plan, amount, when it expires.
 *  Recharge History — one row per recharge done ("Recharged" in the app).
 *  Important Dates  — birthdays, anniversaries, death anniversaries, custom.
 *
 *  Same schema-driven machinery and safety rules as Luma_Planning (bills):
 *    GET  ?action=recharges | ?action=rechargehistory | ?action=importantdates
 *    POST { action: 'recharge' | 'importantdate', ... }                 create
 *    POST { action: 'recharge' | 'importantdate', operation: 'update' | 'delete', id }
 *    POST { action: 'recharge', operation: 'recharged', id, expectedExpiry, date, amount,
 *           plan?, validityDays?, recordExpense?, accountId?, paymentMethod? }
 *         → logs the recharge, moves the expiry forward, optionally records the expense.
 *  Sheets are created on first use.
 * ============================================================================
 */

var LUMA_FAMILY_SCHEMAS = {
  Recharges: {
    idPrefix: 'RCH',
    cols: [
      { n: 'Recharge ID', w: 110, a: 'left' },
      { n: 'Person', w: 140, a: 'left' },
      { n: 'Service', w: 120, a: 'left' },
      { n: 'Provider', w: 120, a: 'left' },
      { n: 'Number', w: 150, a: 'left', f: 'text' },
      { n: 'Plan', w: 200, a: 'left' },
      { n: 'Amount', w: 110, a: 'right', f: 'money' },
      { n: 'Validity Days', w: 110, a: 'center', f: 'int' },
      { n: 'Last Recharged On', w: 140, a: 'left', f: 'date' },
      { n: 'Expires On', w: 130, a: 'left', f: 'date' },
      { n: 'Remind Days Before', w: 140, a: 'center', f: 'int' },
      { n: 'Is Active', w: 90, a: 'center' },
      { n: 'Notes', w: 240, a: 'left', wrap: true },
      { n: 'Created At', w: 150, a: 'left', f: 'datetime' },
      { n: 'Updated At', w: 150, a: 'left', f: 'datetime' }
    ]
  },
  'Recharge History': {
    idPrefix: 'RLOG',
    cols: [
      { n: 'Log ID', w: 110, a: 'left' },
      { n: 'Recharge ID', w: 110, a: 'left' },
      { n: 'Person', w: 140, a: 'left' },
      { n: 'Service', w: 120, a: 'left' },
      { n: 'Provider', w: 120, a: 'left' },
      { n: 'Number', w: 150, a: 'left', f: 'text' },
      { n: 'Recharged On', w: 130, a: 'left', f: 'date' },
      { n: 'Amount', w: 110, a: 'right', f: 'money' },
      { n: 'Plan', w: 200, a: 'left' },
      { n: 'Validity Days', w: 110, a: 'center', f: 'int' },
      { n: 'Valid Until', w: 130, a: 'left', f: 'date' },
      { n: 'Paid Via', w: 120, a: 'left' },
      { n: 'Account ID', w: 110, a: 'left' },
      { n: 'Expense Recorded', w: 130, a: 'center' },
      { n: 'Created At', w: 150, a: 'left', f: 'datetime' },
      { n: 'Updated At', w: 150, a: 'left', f: 'datetime' }
    ]
  },
  'Important Dates': {
    idPrefix: 'DATE',
    cols: [
      { n: 'Date ID', w: 110, a: 'left' },
      { n: 'Person', w: 150, a: 'left' },
      { n: 'Occasion', w: 140, a: 'left' },
      { n: 'Title', w: 220, a: 'left' },
      { n: 'Date', w: 120, a: 'left', f: 'date' },
      { n: 'Year Known', w: 100, a: 'center' },
      { n: 'Remind Days Before', w: 140, a: 'center', f: 'int' },
      { n: 'Notes', w: 260, a: 'left', wrap: true },
      { n: 'Created At', w: 150, a: 'left', f: 'datetime' },
      { n: 'Updated At', w: 150, a: 'left', f: 'datetime' }
    ]
  }
};

var LUMA_FAMILY_ACTIONS = { recharge: 'Recharges', importantdate: 'Important Dates' };
var LUMA_FAMILY_LISTS = { recharges: 'Recharges', rechargehistory: 'Recharge History', importantdates: 'Important Dates' };
var LUMA_OCCASIONS = ['Birthday', 'Anniversary', 'Death Anniversary', 'Other'];

/** Registers the schema with Luma_Data at request time and creates the sheet if needed. */
function lumaFamilySheet_(sheetName) {
  if (!LUMA_SCHEMA[sheetName]) LUMA_SCHEMA[sheetName] = LUMA_FAMILY_SCHEMAS[sheetName];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  var cols = LUMA_FAMILY_SCHEMAS[sheetName].cols;
  if (!sh) {
    sh = ss.insertSheet(sheetName);
    sh.getRange(1, 1, 1, cols.length).setValues([cols.map(function (c) { return c.n; })]).setFontWeight('bold');
    sh.setFrozenRows(1);
    cols.forEach(function (c, i) {
      sh.setColumnWidth(i + 1, c.w);
      // Phone numbers / DTH / FASTag IDs stay text, so leading zeros survive.
      if (c.f === 'text') sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    });
  } else {
    ensureColumns_(sh, cols);
  }
  return sh;
}

function lumaAddDays_(iso, days) {
  var p = String(iso).slice(0, 10).split('-').map(Number);
  return lumaIso_(new Date(p[0], p[1] - 1, p[2] + Number(days || 0)));
}

/* ------------------------------------------------------------------ GET */

function tryHandleLumaFamilyGet_(e) {
  var action = String((e && e.parameter && e.parameter.action) || '').trim().toLowerCase();
  var sheetName = LUMA_FAMILY_LISTS[action];
  if (!sheetName) return null;
  try {
    lumaFamilySheet_(sheetName);
    var rows = readEntity_(sheetName, true);
    return lumaJson_({ success: true, count: rows.length, data: rows });
  } catch (err) {
    return lumaJson_({ success: false, error: safeMessage_(err) });
  }
}

/* ----------------------------------------------------------------- POST */

function tryHandleLumaFamily_(e) {
  var payload;
  try {
    payload = parseLumaPayload_(e);
  } catch (err) {
    return null;
  }
  var action = String(payload.action || '').trim().toLowerCase();
  var sheetName = LUMA_FAMILY_ACTIONS[action];
  if (!sheetName) return null;

  try {
    lumaFamilySheet_(sheetName);
    var operation = String(payload.operation || '').trim().toLowerCase();
    if (!operation) return lumaJson_(createEntity_(sheetName, lumaFamilyClean_(sheetName, payload, true)));
    if (!payload.id) throw new Error('id is required');
    if (operation === 'update') return lumaJson_(updateSchemaEntity_(sheetName, payload.id, lumaFamilyClean_(sheetName, payload, false)));
    if (operation === 'delete') return lumaJson_(deleteSchemaEntity_(sheetName, payload.id));
    if (operation === 'recharged' && sheetName === 'Recharges') return lumaJson_(lumaRecharged_(payload));
    throw new Error('Unknown operation: ' + operation);
  } catch (err) {
    return lumaJson_({ success: false, error: safeMessage_(err) });
  }
}

function lumaFamilyClean_(sheetName, payload, isCreate) {
  var p = {};
  Object.keys(payload).forEach(function (k) { p[k] = payload[k]; });
  var isoOk = function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); };

  if (sheetName === 'Recharges') {
    if (isCreate || 'person' in p) {
      p.person = String(p.person || '').trim();
      if (!p.person) throw new Error('Whose recharge is it?');
    }
    if (isCreate || 'service' in p) {
      p.service = String(p.service || '').trim();
      if (!p.service) throw new Error('Choose what it is (mobile, DTH…).');
    }
    if ('number' in p) p.number = String(p.number || '').trim();
    if (isCreate || 'amount' in p) {
      p.amount = Number(p.amount);
      if (!(p.amount >= 0)) throw new Error('Enter the plan amount.');
    }
    if (isCreate || 'validityDays' in p) {
      p.validityDays = Number(p.validityDays);
      if (!(p.validityDays >= 1 && p.validityDays <= 3660)) throw new Error('Enter the validity in days (e.g. 28, 84, 365).');
    }
    if (isCreate || 'expiresOn' in p) {
      if (!isoOk(p.expiresOn)) throw new Error('Pick when it expires.');
    }
    if ('lastRechargedOn' in p && p.lastRechargedOn && !isoOk(p.lastRechargedOn)) throw new Error('Invalid recharge date.');
    if (isCreate) {
      if (p.remindDaysBefore === undefined || p.remindDaysBefore === '') p.remindDaysBefore = 3;
      p.isActive = p.isActive === undefined ? true : p.isActive;
    }
  } else {
    if (isCreate || 'person' in p) {
      p.person = String(p.person || '').trim();
      if (!p.person) throw new Error('Whose date is it?');
    }
    if (isCreate || 'occasion' in p) {
      p.occasion = String(p.occasion || 'Birthday').trim();
      if (LUMA_OCCASIONS.indexOf(p.occasion) < 0) throw new Error('Unknown occasion: ' + p.occasion);
    }
    if (isCreate || 'date' in p) {
      if (!isoOk(p.date)) throw new Error('Pick the date.');
    }
    if (isCreate) {
      if (p.remindDaysBefore === undefined || p.remindDaysBefore === '') p.remindDaysBefore = 7;
      if (p.yearKnown === undefined) p.yearKnown = true;
    }
  }
  return p;
}

/**
 * Records a recharge: a history row, the new expiry (queued after the current plan when that's
 * still running, like Jio/Airtel advance recharges), and optionally the expense in the ledger.
 * `expectedExpiry` is the expiry the app showed; if it has already moved, nothing is recorded twice.
 */
function lumaRecharged_(payload) {
  var cache = CacheService.getScriptCache();
  var guard = 'luma_recharge_' + String(payload.id);
  if (cache.get(guard)) return { success: false, alreadyDone: true, error: 'This recharge is already being recorded.' };
  cache.put(guard, '1', 60);
  try {
    return lumaRechargedNow_(payload);
  } finally {
    cache.remove(guard);
  }
}

function lumaRechargedNow_(payload) {
  var sh = lumaFamilySheet_('Recharges');
  var found = findRowById_(sh, 'Recharge ID', payload.id);
  if (!found) throw new Error('That recharge no longer exists.');
  var headers = found.headers;
  var values = sh.getRange(found.row, 1, 1, headers.length).getValues()[0];
  var get = function (name) { var i = headers.indexOf(name); return i < 0 ? '' : values[i]; };

  var currentExpiry = lumaIsoOf_(get('Expires On'));
  if (payload.expectedExpiry && currentExpiry && String(payload.expectedExpiry) !== currentExpiry) {
    return { success: false, alreadyDone: true, error: 'This was already marked recharged — it now runs till ' + currentExpiry + '.' };
  }
  var date = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.date || '')) ? String(payload.date) : lumaIso_(new Date());
  var amount = Number(payload.amount !== undefined && payload.amount !== '' ? payload.amount : get('Amount'));
  if (!(amount >= 0)) throw new Error('Enter the amount paid.');
  var validity = Number(payload.validityDays || get('Validity Days'));
  if (!(validity >= 1)) throw new Error('Enter the validity in days.');
  var plan = String(payload.plan !== undefined ? payload.plan : get('Plan') || '');

  // A plan bought while the current one still runs starts after it; otherwise from the recharge date.
  var start = currentExpiry && currentExpiry > date ? currentExpiry : date;
  var validUntil = lumaAddDays_(start, validity);

  var expenseRecorded = false;
  if (payload.recordExpense && amount > 0) {
    var tx = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Transactions');
    if (!tx) throw new Error('Sheet "Transactions" not found.');
    var data = {
      date: date,
      amount: amount,
      type: 'Expense',
      category: 'Recharge',
      subcategory: String(get('Service') || ''),
      paymentMethod: String(payload.paymentMethod || 'UPI'),
      merchant: String(get('Provider') || get('Service') || 'Recharge'),
      note: 'Recharge · ' + String(get('Person') || '') + (get('Number') ? ' · ' + String(get('Number')) : '') + (plan ? ' · ' + plan : ''),
      accountId: String(payload.accountId || '')
    };
    var now = new Date();
    tx.appendRow([now, data.date, data.amount, data.type, data.category, data.subcategory, data.paymentMethod, data.merchant, data.note, transactionMonth_(data.date, now)]);
    var newRow = tx.getLastRow();
    try { assignTransactionLifecycleFields_(tx, newRow); } catch (err) { Logger.log('lifecycle fields skipped: ' + err.message); }
    try { lumaLinkNewTransaction_(tx, newRow, data); } catch (err) { Logger.log('ledger link skipped: ' + err.message); }
    expenseRecorded = true;
  }

  lumaFamilySheet_('Recharge History');
  createEntity_('Recharge History', {
    rechargeId: payload.id,
    person: get('Person'),
    service: get('Service'),
    provider: get('Provider'),
    number: get('Number'),
    rechargedOn: date,
    amount: amount,
    plan: plan,
    validityDays: validity,
    validUntil: validUntil,
    paidVia: String(payload.paymentMethod || ''),
    accountId: String(payload.accountId || ''),
    expenseRecorded: expenseRecorded
  });

  var change = { lastRechargedOn: date, expiresOn: validUntil, amount: amount, validityDays: validity, isActive: true };
  if (plan) change.plan = plan;
  updateSchemaEntity_('Recharges', payload.id, change);
  return { success: true, validUntil: validUntil, expenseRecorded: expenseRecorded };
}

/* ------------------------------------------------- digest contributions */

/** Lines for the daily email (Luma_Planning's lumaDailyDigest calls this when present). */
function lumaFamilyDigestLines_(today) {
  var lines = { recharges: [], dates: [] };
  try {
    lumaFamilySheet_('Recharges');
    readEntity_('Recharges', true).forEach(function (r) {
      if (r.isActive === false || String(r.isActive).toUpperCase() === 'FALSE') return;
      var exp = lumaIsoOf_(r.expiresOn);
      if (!exp) return;
      var remind = r.remindDaysBefore === null || r.remindDaysBefore === undefined ? 3 : Number(r.remindDaysBefore);
      var who = r.person + ' · ' + r.service + (r.number ? ' ' + r.number : '');
      if (exp < today) lines.recharges.push('EXPIRED ' + exp + ' — ' + who);
      else if (exp <= lumaAddDays_(today, remind)) lines.recharges.push((exp === today ? 'Expires TODAY' : 'Expires ' + exp) + ' — ' + who);
    });
  } catch (err) { Logger.log('digest recharges: ' + err.message); }
  try {
    lumaFamilySheet_('Important Dates');
    var year = Number(today.slice(0, 4));
    readEntity_('Important Dates', true).forEach(function (d) {
      var iso = lumaIsoOf_(d.date);
      if (!iso) return;
      var next = year + iso.slice(4);
      if (next < today) next = (year + 1) + iso.slice(4);
      var remind = d.remindDaysBefore === null || d.remindDaysBefore === undefined ? 7 : Number(d.remindDaysBefore);
      if (next > lumaAddDays_(today, remind)) return;
      var label = d.title || (d.person + "'s " + String(d.occasion || '').toLowerCase());
      lines.dates.push((next === today ? 'TODAY' : next) + ' — ' + label);
    });
  } catch (err) { Logger.log('digest dates: ' + err.message); }
  return lines;
}
