/**
 * ============================================================================
 *  LUMA LEDGER — keeps account balances in step with linked entries.
 * ============================================================================
 *
 *  A transaction or udhaar entry can name the account the money moved
 *  through ("Account ID", plus "To Account ID" for transfers). Every create,
 *  edit, void and delete applies — or reverses — that entry's effect on the
 *  account's "Current Balance", in the same locked execution as the write,
 *  so the sheet's balances are always current (iPhone Shortcut included).
 *
 *  Effect rules (a = amount):
 *    Bank / cash / wallet accounts hold money:  expense −a, income +a,
 *      transfer out −a, transfer in +a, udhaar given −a, udhaar repaid +a.
 *    Credit cards hold what you OWE (balance = outstanding):  every sign
 *      flips — a card expense raises the outstanding, paying the card
 *      (a transfer INTO it) lowers it.
 *  Voided transactions have no effect.
 *
 *  None of these functions take the script lock — callers already hold it
 *  (Apps Script's lock isn't re-entrant: a nested release would free the
 *  outer holder early).
 * ============================================================================
 */

var LUMA_TXN_ACCOUNT_COLS = [
  { n: 'Account ID', w: 110, a: 'left' },
  { n: 'To Account ID', w: 120, a: 'left' }
];

/** Makes sure Transactions has both account columns (appends only, never reorders). */
function lumaEnsureTxnAccountCols_(sh) {
  ensureColumns_(sh, LUMA_TXN_ACCOUNT_COLS);
}

/** { accountId: { row, isCard } } plus the Current Balance / Updated At columns. */
function lumaAccountIndex_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Accounts');
  if (!sh || sh.getLastRow() < 2) return null;
  var values = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var h = values[0].map(function (x) { return String(x).trim(); });
  var idC = h.indexOf('Account ID'), typeC = h.indexOf('Account Type'), balC = h.indexOf('Current Balance');
  if (idC < 0 || balC < 0) return null;
  var byId = {};
  for (var r = 1; r < values.length; r++) {
    var id = String(values[r][idC] || '').trim();
    if (!id) continue;
    byId[id] = { row: r + 1, isCard: /credit/i.test(String(values[r][typeC] || '')), balance: Number(values[r][balC]) || 0 };
  }
  return { sh: sh, byId: byId, balCol: balC + 1, updatedCol: h.indexOf('Updated At') + 1 };
}

/**
 * The balance effects of one entry: [{ id, delta }]. `entry` is
 * { kind: 'transaction' | 'udhaar', type, amount, accountId, toAccountId, voided }.
 */
function lumaEntryEffects_(entry, accounts) {
  if (!accounts || entry.voided) return [];
  var amount = Math.abs(Number(entry.amount) || 0);
  if (!amount) return [];
  var type = String(entry.type || '').trim().toLowerCase();
  var from = String(entry.accountId || '').trim();
  var to = String(entry.toAccountId || '').trim();
  var effects = [];
  // `delta` is for a money-holding account; credit cards (balance = what you owe) flip it.
  var add = function (id, delta) {
    var acc = id && accounts.byId[id];
    if (acc) effects.push({ id: id, delta: acc.isCard ? -delta : delta });
  };

  if (entry.kind === 'udhaar') {
    if (type === 'given') add(from, -amount);
    else if (type === 'repayment') add(from, amount);
  } else if (type === 'expense') {
    add(from, -amount);
  } else if (type === 'income') {
    add(from, amount);
  } else if (type === 'transfer') {
    if (from && to && from !== to) {
      add(from, -amount);
      add(to, amount);
    }
  }
  return effects;
}

/** Adds factor × each effect to the accounts' Current Balance (one write per touched account). */
function lumaApplyEffects_(effects, factor, accounts) {
  if (!effects.length || !accounts) return;
  var totals = {};
  effects.forEach(function (e) { totals[e.id] = (totals[e.id] || 0) + factor * e.delta; });
  var now = new Date();
  Object.keys(totals).forEach(function (id) {
    var acc = accounts.byId[id];
    if (!acc || !totals[id]) return;
    acc.balance = Math.round((acc.balance + totals[id]) * 100) / 100;
    accounts.sh.getRange(acc.row, accounts.balCol).setValue(acc.balance);
    if (accounts.updatedCol) accounts.sh.getRange(acc.row, accounts.updatedCol).setValue(now);
  });
}

/** Reverses `before` and applies `after` in one pass (edits, voids, deletes). */
function lumaRebalance_(before, after) {
  var accounts = lumaAccountIndex_();
  if (!accounts) return;
  var effects = lumaEntryEffects_(before || {}, accounts)
    .map(function (e) { return { id: e.id, delta: -e.delta }; })
    .concat(lumaEntryEffects_(after || {}, accounts));
  lumaApplyEffects_(effects, 1, accounts);
}

/* ------------------------------------------------------ row <-> entry */

function lumaTxnEntry_(sh, row, headers) {
  // One read of the whole row instead of a call per cell.
  var values = sh.getRange(row, 1, 1, Math.max(headers.length, 4)).getValues()[0];
  var get = function (name) { var c = headers.indexOf(name); return c < 0 ? '' : values[c]; };
  return {
    kind: 'transaction',
    type: values[3],
    amount: values[2],
    accountId: get('Account ID'),
    toAccountId: get('To Account ID'),
    voided: String(get('Status')).trim() === 'Voided'
  };
}

function lumaUdhaarEntry_(sh, row, headers) {
  var c = headers.indexOf('Account ID');
  var values = sh.getRange(row, 1, 1, Math.max(headers.length, 5)).getValues()[0];
  return {
    kind: 'udhaar',
    type: values[3],
    amount: values[4],
    accountId: c < 0 ? '' : values[c]
  };
}

function lumaHeaders_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
}

/** Writes the account ids a payload carries (only keys present are touched). */
function lumaWriteTxnAccounts_(sh, row, payload) {
  if (!('accountId' in payload) && !('toAccountId' in payload)) return;
  lumaEnsureTxnAccountCols_(sh);
  var headers = lumaHeaders_(sh);
  if ('accountId' in payload) sh.getRange(row, headers.indexOf('Account ID') + 1).setValue(String(payload.accountId || '').trim());
  if ('toAccountId' in payload) sh.getRange(row, headers.indexOf('To Account ID') + 1).setValue(String(payload.toAccountId || '').trim());
}

/* ------------------------------------------------------- entry points */

/** New transaction row (app or Shortcut): record its accounts and apply its effect. Takes the lock itself. */
function lumaLinkNewTransaction_(sh, row, payload) {
  if (!payload.accountId && !payload.toAccountId) return;
  withLumaLock_(function () {
    lumaWriteTxnAccounts_(sh, row, payload);
    // The row was written from this payload a moment ago (type defaults to Expense, amount to 0,
    // exactly as doPost writes them), so its entry comes from here — no read-back of cells,
    // which would force Google to flush the writes first.
    lumaRebalance_(null, {
      kind: 'transaction',
      type: payload.type || 'Expense',
      amount: payload.amount || 0,
      accountId: String(payload.accountId || '').trim(),
      toAccountId: String(payload.toAccountId || '').trim(),
      voided: false
    });
  });
}

/** New udhaar row: record its account and apply its effect. Takes the lock itself. */
function lumaLinkNewUdhaar_(sh, row, accountId) {
  if (!accountId) return;
  withLumaLock_(function () {
    var headers = lumaHeaders_(sh);
    var c = headers.indexOf('Account ID');
    if (c < 0) return;
    sh.getRange(row, c + 1).setValue(String(accountId).trim());
    lumaRebalance_(null, lumaUdhaarEntry_(sh, row, headers));
  });
}
