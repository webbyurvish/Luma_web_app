/**
 * ============================================================================
 *  LUMA VAULT — storage for passwords, cards, bank details and IDs.
 * ============================================================================
 *
 *  Zero-knowledge: every item is encrypted IN THE BROWSER (AES-256-GCM, key
 *  derived from the vault master password with PBKDF2). This script only
 *  ever stores and returns opaque ciphertext — it never sees the master
 *  password, the key or a single plaintext field. Someone who opens the
 *  spreadsheet, or steals a session, still sees nothing readable.
 *
 *  Sheet "Vault" (hidden): ID | Data | Created At | Updated At
 *  Row with ID "__meta__" holds the key parameters (salt, iterations and an
 *  encrypted check value) so meta + items can be rewritten in ONE write when
 *  the master password changes.
 *
 *  Routes (all behind the passcode gate; the iPhone Shortcut key can't use them):
 *    GET  ?action=vaultstatus   capability check + whether a vault exists
 *    GET  ?action=vault         meta + all encrypted items
 *    POST { vaultOp: 'setup' | 'save' | 'delete' | 'rekey' | 'reset', ... }
 * ============================================================================
 */

var LUMA_VAULT_SHEET = 'Vault';
var LUMA_VAULT_HEADERS = ['ID', 'Data', 'Created At', 'Updated At'];
var LUMA_VAULT_META_ID = '__meta__';
var LUMA_VAULT_MAX_ITEMS = 2000;
var LUMA_VAULT_MAX_CIPHERTEXT = 45000;
/** base64url(iv) "." base64url(ciphertext) — anything else is refused. */
var LUMA_VAULT_BLOB_RE = /^[A-Za-z0-9_-]{16,24}\.[A-Za-z0-9_-]{16,}$/;

function lumaVaultSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(LUMA_VAULT_SHEET);
  if (!sh) {
    sh = ss.insertSheet(LUMA_VAULT_SHEET);
    sh.getRange(1, 1, 1, LUMA_VAULT_HEADERS.length).setValues([LUMA_VAULT_HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    try { sh.hideSheet(); } catch (err) { /* only sheet left visible — fine */ }
  }
  return sh;
}

/** All rows as {row, id, data, createdAt, updatedAt}; the meta row included. */
function lumaVaultRows_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 4).getValues().map(function (r, i) {
    return {
      row: i + 2,
      id: String(r[0] || ''),
      data: String(r[1] || ''),
      createdAt: r[2] instanceof Date ? r[2].toISOString() : String(r[2] || ''),
      updatedAt: r[3] instanceof Date ? r[3].toISOString() : String(r[3] || ''),
    };
  }).filter(function (r) { return r.id; });
}

function lumaVaultMetaOf_(rows) {
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === LUMA_VAULT_META_ID) {
      try { return JSON.parse(rows[i].data); } catch (err) { return null; }
    }
  }
  return null;
}

/** Only the documented shape gets stored, so nothing else can ride along. */
function lumaVaultCleanMeta_(meta) {
  if (!meta || typeof meta !== 'object') throw new Error('Missing vault settings.');
  var iterations = Number(meta.iterations);
  var clean = {
    v: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: iterations,
    salt: String(meta.salt || ''),
    check: String(meta.check || ''),
  };
  if (!(iterations >= 100000 && iterations <= 5000000)) throw new Error('Invalid key settings.');
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(clean.salt)) throw new Error('Invalid key settings.');
  if (!LUMA_VAULT_BLOB_RE.test(clean.check) || clean.check.length > 400) throw new Error('Invalid key settings.');
  return clean;
}

function lumaVaultCleanBlob_(data) {
  var text = String(data || '');
  if (!LUMA_VAULT_BLOB_RE.test(text) || text.length > LUMA_VAULT_MAX_CIPHERTEXT) throw new Error('Item is not valid encrypted data.');
  return text;
}

function lumaVaultNewId_() {
  return 'VLT-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
}

function lumaVaultLocked_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ------------------------------------------------------------------ GET */

function tryHandleLumaVaultGet_(e) {
  var action = String((e && e.parameter && e.parameter.action) || '').trim().toLowerCase();
  if (action !== 'vaultstatus' && action !== 'vault') return null;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(LUMA_VAULT_SHEET);
    var rows = sh ? lumaVaultRows_(sh) : [];
    var meta = lumaVaultMetaOf_(rows);
    if (action === 'vaultstatus') return lumaJson_({ success: true, vault: { available: true, ready: !!meta } });
    return lumaJson_({
      success: true,
      meta: meta,
      items: rows
        .filter(function (r) { return r.id !== LUMA_VAULT_META_ID; })
        .map(function (r) { return { id: r.id, data: r.data, createdAt: r.createdAt, updatedAt: r.updatedAt }; }),
    });
  } catch (err) {
    return lumaJson_({ success: false, error: String(err && err.message ? err.message : err) });
  }
}

/* ----------------------------------------------------------------- POST */

function tryHandleLumaVault_(e) {
  var payload;
  try {
    payload = parseLumaPayload_(e);
  } catch (err) {
    return null;
  }
  if (!payload || !payload.vaultOp) return null;
  try {
    return lumaJson_(lumaVaultLocked_(function () { return lumaVaultOp_(String(payload.vaultOp), payload); }));
  } catch (err) {
    return lumaJson_({ success: false, error: String(err && err.message ? err.message : err) });
  }
}

function lumaVaultOp_(op, payload) {
  var sh = lumaVaultSheet_();
  var rows = lumaVaultRows_(sh);
  var meta = lumaVaultMetaOf_(rows);
  var now = new Date();

  if (op === 'setup') {
    if (meta) return { success: false, error: 'A vault already exists.' };
    var clean = lumaVaultCleanMeta_(payload.meta);
    sh.appendRow([LUMA_VAULT_META_ID, JSON.stringify(clean), now, now]);
    return { success: true, meta: clean };
  }

  if (!meta) return { success: false, error: 'Set up the vault first.' };

  if (op === 'save') {
    var data = lumaVaultCleanBlob_(payload.data);
    var id = String(payload.id || '');
    if (id) {
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].id === id && id !== LUMA_VAULT_META_ID) {
          sh.getRange(rows[i].row, 2).setValue(data);
          sh.getRange(rows[i].row, 4).setValue(now);
          return { success: true, item: { id: id, data: data, createdAt: rows[i].createdAt, updatedAt: now.toISOString() } };
        }
      }
      return { success: false, error: 'That item no longer exists.' };
    }
    if (rows.length > LUMA_VAULT_MAX_ITEMS) return { success: false, error: 'The vault is full.' };
    var newId = lumaVaultNewId_();
    sh.appendRow([newId, data, now, now]);
    return { success: true, item: { id: newId, data: data, createdAt: now.toISOString(), updatedAt: now.toISOString() } };
  }

  if (op === 'delete') {
    var target = String(payload.id || '');
    for (var j = 0; j < rows.length; j++) {
      if (rows[j].id === target && target !== LUMA_VAULT_META_ID) {
        sh.deleteRow(rows[j].row);
        return { success: true };
      }
    }
    return { success: true }; // already gone
  }

  if (op === 'rekey') {
    // New master password: every item re-encrypted in the browser. All of them must be here,
    // and meta + items are written in ONE range write, so the vault is never half-converted.
    var nextMeta = lumaVaultCleanMeta_(payload.meta);
    var incoming = {};
    (payload.items || []).forEach(function (it) { incoming[String(it && it.id)] = lumaVaultCleanBlob_(it && it.data); });
    var changed = 'The vault changed while re-encrypting. Nothing was changed — try again.';
    var raw = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
    var converted = 0;
    var body = raw.map(function (r) {
      var rowId = String(r[0] || '');
      if (!rowId) return r;
      if (rowId === LUMA_VAULT_META_ID) return [rowId, JSON.stringify(nextMeta), r[2] || now, now];
      if (!incoming[rowId]) throw new Error(changed);
      converted++;
      return [rowId, incoming[rowId], r[2] || now, now];
    });
    if (converted !== Object.keys(incoming).length) throw new Error(changed);
    sh.getRange(2, 1, raw.length, 4).setValues(body); // one write: never half-converted
    return { success: true, meta: nextMeta };
  }

  if (op === 'reset') {
    if (payload.confirm !== 'ERASE VAULT') return { success: false, error: 'Type ERASE VAULT to confirm.' };
    if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
    return { success: true };
  }

  return { success: false, error: 'Unknown vault operation.' };
}
