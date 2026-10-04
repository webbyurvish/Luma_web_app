/**
 * ============================================================================
 *  LUMA AUTH — a passcode in front of the whole API.
 * ============================================================================
 *
 *  The web app is deployed "Anyone", so without this anyone holding its URL
 *  could read and change everything. With it, every request must carry a
 *  signed token (from logging in with your passcode) or, for the iPhone
 *  Shortcut only, a device key that can do nothing but add entries.
 *
 *  Apps Script can't read request headers, so the token travels as the `t`
 *  query parameter. It's an HMAC-signed, expiring token — never the passcode.
 *
 *  SETUP (in this order, so nothing breaks midway)
 *    1. Script Properties → add LUMA_PASSCODE (at least 8 characters).
 *    2. Run setupLumaAuth() once — it creates the signing secret and the
 *       Shortcut key, and prints the key in the execution log.
 *    3. Deploy a new version, open the app and sign in.
 *    4. Add  "key": "<that key>"  to the iPhone Shortcut's JSON.
 *    5. That's it: once LUMA_PASSCODE is set, every request without a valid
 *       token/key is refused. (Emergency only: LUMA_AUTH_ENFORCE = false
 *       switches the check off again.)
 *
 *  Sessions last at most 2 hours, on every device, then the passcode is
 *  needed again.
 *
 *  Changing LUMA_PASSCODE doesn't end existing sessions; use "Sign out
 *  everywhere" in the app (or run lumaSignOutEverywhere()) for that.
 * ============================================================================
 */

/** Hard limit for every session. Tokens promising more (older 30-day ones) are refused. */
var LUMA_AUTH_SESSION_MS = 2 * 60 * 60 * 1000;
var LUMA_AUTH_CLOCK_SLACK_MS = 5 * 60 * 1000;
var LUMA_AUTH_MAX_FAILURES = 10;
var LUMA_AUTH_LOCKOUT_SECONDS = 15 * 60;

function lumaAuthProps_() {
  return PropertiesService.getScriptProperties();
}

function lumaAuthConfigured_() {
  return String(lumaAuthProps_().getProperty('LUMA_PASSCODE') || '').length >= 8;
}

/** Fail-closed: a configured passcode protects everything unless explicitly switched off. */
function lumaAuthEnforced_() {
  return lumaAuthConfigured_() && String(lumaAuthProps_().getProperty('LUMA_AUTH_ENFORCE') || '').trim().toLowerCase() !== 'false';
}

function lumaAuthSecret_() {
  var props = lumaAuthProps_();
  var secret = props.getProperty('LUMA_AUTH_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('LUMA_AUTH_SECRET', secret);
  }
  return secret;
}

function lumaAuthVersion_() {
  return Number(lumaAuthProps_().getProperty('LUMA_AUTH_VERSION') || 1);
}

function lumaB64Url_(value) {
  return Utilities.base64EncodeWebSafe(value).replace(/=+$/, '');
}

function lumaFromB64Url_(text) {
  var padded = text + '===='.slice((text.length + 3) % 4);
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(padded)).getDataAsString();
}

function lumaHmac_(text) {
  return lumaB64Url_(Utilities.computeHmacSha256Signature(text, lumaAuthSecret_()));
}

/** Equal-time string comparison, so response timing doesn't leak how much matched. */
function lumaSafeEquals_(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function lumaIssueToken_() {
  var expiresAt = Date.now() + LUMA_AUTH_SESSION_MS;
  var body = lumaB64Url_(JSON.stringify({ exp: expiresAt, v: lumaAuthVersion_() }));
  return { token: body + '.' + lumaHmac_(body), expiresAt: expiresAt };
}

function lumaTokenValid_(token) {
  var parts = String(token || '').split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  if (!lumaSafeEquals_(lumaHmac_(parts[0]), parts[1])) return false;
  try {
    var payload = JSON.parse(lumaFromB64Url_(parts[0]));
    var exp = Number(payload.exp);
    var now = Date.now();
    return exp > now && exp - now <= LUMA_AUTH_SESSION_MS + LUMA_AUTH_CLOCK_SLACK_MS && Number(payload.v) === lumaAuthVersion_();
  } catch (err) {
    return false;
  }
}

/** The Shortcut key may only add a transaction (the no-action append path) or an udhaar entry. */
function lumaShortcutKeyAllowed_(e, payload) {
  var key = lumaAuthProps_().getProperty('LUMA_SHORTCUT_KEY');
  if (!key || !lumaSafeEquals_(payload.key, key)) return false;
  if (payload.operation || payload.aiTask || payload.driveOp || payload.vaultOp || payload.backupOp || payload.importOp || payload.convertOp || payload.deviceOp || payload.deviceLogin || payload.authLogin || payload.authLogoutAll) return false;
  if (String(payload.recordType || '').toLowerCase() === 'udhaar') return true;
  // Both places an action can hide (query and body) must say "add a transaction".
  var addOnly = function (value) {
    var action = String(value || '').trim().toLowerCase();
    return !action || action === 'transaction';
  };
  return addOnly(e.parameter && e.parameter.action) && addOnly(payload.action);
}

function lumaAuthDenied_() {
  return lumaJson_({ success: false, authRequired: true, error: 'Please sign in to Luma.' });
}

/* --------------------------------------------------------------- routes */

/** Call FIRST in doGet. Returns a response to send, or null to carry on. */
function lumaAuthGateGet_(e) {
  var action = String((e && e.parameter && e.parameter.action) || '').trim().toLowerCase();
  if (action === 'authstatus') {
    return lumaJson_({ success: true, auth: { configured: lumaAuthConfigured_(), enforced: lumaAuthEnforced_(), sessionMinutes: LUMA_AUTH_SESSION_MS / 60000, devices: true } });
  }
  if (!lumaAuthEnforced_() || action === 'health' || action === '') return null;
  return lumaTokenValid_(e.parameter.t) ? null : lumaAuthDenied_();
}

/** Call FIRST in doPost. Handles login / sign-out-everywhere; otherwise gates the request. */
function lumaAuthGatePost_(e) {
  var payload = {};
  try { payload = parseLumaPayload_(e); } catch (err) { payload = {}; }

  if (payload.authLogin !== undefined) return lumaJson_(lumaLogin_(payload));
  // Face ID / fingerprint sign-in: proves possession of a device secret instead of the passcode.
  if (payload.deviceLogin !== undefined) return lumaJson_(lumaDeviceLogin_(payload));

  var tokenOk = lumaTokenValid_((e && e.parameter && e.parameter.t) || payload.authToken);
  if (payload.authLogoutAll) {
    if (!tokenOk) return lumaAuthDenied_();
    lumaSignOutEverywhere();
    return lumaJson_({ success: true });
  }
  // Registering or removing devices needs a signed-in session.
  if (payload.deviceOp) {
    if (!tokenOk) return lumaAuthDenied_();
    return lumaJson_(lumaDeviceOp_(payload));
  }

  if (!lumaAuthEnforced_() || tokenOk || lumaShortcutKeyAllowed_(e || {}, payload)) return null;
  return lumaAuthDenied_();
}

function lumaLogin_(payload) {
  if (!lumaAuthConfigured_()) return { success: false, error: 'No passcode is set yet. Add LUMA_PASSCODE in Script Properties.' };

  var cache = CacheService.getScriptCache();
  var failures = Number(cache.get('luma_auth_failures') || 0);
  if (failures >= LUMA_AUTH_MAX_FAILURES) {
    return { success: false, locked: true, error: 'Too many wrong attempts. Try again in 15 minutes.' };
  }

  var ok = lumaSafeEquals_(lumaHmac_(String(payload.authLogin || '')), lumaHmac_(lumaAuthProps_().getProperty('LUMA_PASSCODE')));
  if (!ok) {
    // The app may send one attempt twice when Google's redirect stalls; count it once.
    var attemptId = String(payload.attemptId || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
    var counted = attemptId && cache.get('luma_auth_attempt_' + attemptId);
    if (attemptId && !counted) cache.put('luma_auth_attempt_' + attemptId, '1', LUMA_AUTH_LOCKOUT_SECONDS);
    if (!counted) cache.put('luma_auth_failures', String(failures + 1), LUMA_AUTH_LOCKOUT_SECONDS);
    Utilities.sleep(600); // slows guessing a little more
    var left = LUMA_AUTH_MAX_FAILURES - failures - 1;
    return { success: false, error: left > 0 ? "That passcode isn't right." : 'Too many wrong attempts. Try again in 15 minutes.', locked: left <= 0 };
  }

  cache.remove('luma_auth_failures');
  var issued = lumaIssueToken_();
  return { success: true, token: issued.token, expiresAt: issued.expiresAt };
}

/* ------------------------------------------------------- editor helpers */

/** Run once from the editor. Creates the signing secret and the Shortcut key, and prints the key. */
function setupLumaAuth() {
  lumaAuthSecret_();
  var props = lumaAuthProps_();
  var key = props.getProperty('LUMA_SHORTCUT_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty('LUMA_SHORTCUT_KEY', key);
  }
  Logger.log('Passcode set: ' + (lumaAuthConfigured_() ? 'yes' : 'NO — add LUMA_PASSCODE (8+ characters) in Script Properties'));
  Logger.log('Enforced: ' + (lumaAuthEnforced_() ? 'yes' : 'NO — add LUMA_PASSCODE (and remove LUMA_AUTH_ENFORCE = false if present)'));
  Logger.log('iPhone Shortcut key (add "key": "<this>" to the Shortcut JSON): ' + key);
}

/** Invalidates every issued token and every Face ID / fingerprint device (all must sign in again). */
function lumaSignOutEverywhere() {
  lumaAuthProps_().setProperty('LUMA_AUTH_VERSION', String(lumaAuthVersion_() + 1));
  lumaAuthProps_().deleteProperty('LUMA_DEVICES');
}

/* ------------------------------------------------- Face ID / fingerprint */
/*
 * A device that turned on biometric sign-in holds a long random secret, kept in the browser
 * ENCRYPTED with a key only its passkey (Face ID / fingerprint, WebAuthn PRF) can produce.
 * Here we keep just an HMAC of each secret. Presenting the secret earns a normal 2-hour
 * session; wrong attempts count towards the same lockout as wrong passcodes.
 */

var LUMA_DEVICE_MAX = 10;

function lumaDevices_() {
  try { return JSON.parse(lumaAuthProps_().getProperty('LUMA_DEVICES') || '[]'); } catch (err) { return []; }
}

function lumaSaveDevices_(list) {
  lumaAuthProps_().setProperty('LUMA_DEVICES', JSON.stringify(list));
}

function lumaDeviceHash_(secret) {
  return lumaHmac_('luma-device:' + String(secret || ''));
}

function lumaDeviceLocked_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function lumaDeviceOp_(payload) {
  var op = String(payload.deviceOp);
  if (op === 'enroll') {
    return lumaDeviceLocked_(function () {
      var list = lumaDevices_();
      if (list.length >= LUMA_DEVICE_MAX) return { success: false, error: 'Too many devices. Remove one in Settings → Security first.' };
      var secret = [Utilities.getUuid(), Utilities.getUuid(), Utilities.getUuid()].join('').replace(/-/g, '');
      var id = 'DEV-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
      var name = String(payload.deviceName || 'This device').replace(/[\x00-\x1f<>]/g, '').trim().slice(0, 60) || 'This device';
      var now = new Date().toISOString();
      list.push({ id: id, name: name, hash: lumaDeviceHash_(secret), v: lumaAuthVersion_(), createdAt: now, lastUsedAt: now });
      lumaSaveDevices_(list);
      return { success: true, deviceId: id, secret: secret };
    });
  }
  if (op === 'list') {
    var v = lumaAuthVersion_();
    return {
      success: true,
      devices: lumaDevices_()
        .filter(function (d) { return d.v === v; })
        .map(function (d) { return { id: d.id, name: d.name, createdAt: d.createdAt, lastUsedAt: d.lastUsedAt }; })
    };
  }
  if (op === 'revoke') {
    var target = String(payload.deviceId || '');
    return lumaDeviceLocked_(function () {
      lumaSaveDevices_(lumaDevices_().filter(function (d) { return d.id !== target; }));
      return { success: true };
    });
  }
  return { success: false, error: 'Unknown device operation.' };
}

function lumaDeviceLogin_(payload) {
  if (!lumaAuthConfigured_()) return { success: false, error: 'No passcode is set yet.' };
  var cache = CacheService.getScriptCache();
  var failures = Number(cache.get('luma_auth_failures') || 0);
  if (failures >= LUMA_AUTH_MAX_FAILURES) return { success: false, locked: true, error: 'Too many wrong attempts. Try again in 15 minutes.' };

  var id = String(payload.deviceId || '');
  var secret = String(payload.deviceLogin || '');
  var version = lumaAuthVersion_();
  var device = null;
  lumaDevices_().forEach(function (d) { if (d.id === id) device = d; });
  // Always hash, so timing doesn't reveal whether the device id exists.
  var ok = lumaSafeEquals_(lumaDeviceHash_(secret), device ? device.hash : lumaDeviceHash_('no-device')) && !!device && device.v === version;
  if (!ok) {
    cache.put('luma_auth_failures', String(failures + 1), LUMA_AUTH_LOCKOUT_SECONDS);
    Utilities.sleep(600);
    // The app forgets this device's Face ID setup when it sees "revoked".
    return { success: false, revoked: !device || device.v !== version, error: 'This device is no longer allowed to sign in with Face ID. Use your passcode.' };
  }

  lumaDeviceLocked_(function () {
    var list = lumaDevices_();
    list.forEach(function (d) { if (d.id === id) d.lastUsedAt = new Date().toISOString(); });
    lumaSaveDevices_(list);
  });
  var issued = lumaIssueToken_();
  return { success: true, token: issued.token, expiresAt: issued.expiresAt };
}
