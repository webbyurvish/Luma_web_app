/**
 * ============================================================================
 *  LUMA LIFE — vehicles and medical bills
 * ============================================================================
 *
 *  Vehicles      — each car / bike: registration, insurance and PUC expiry,
 *                  next service (date and/or km).
 *  Vehicle Logs  — fuel fills, services, repairs, odometer readings. A log can
 *                  point at the transaction it came from (Transaction ID).
 *  Medical Bills — doctor, hospital, lab and pharmacy bills per family member,
 *                  with insurance-claim tracking and an optional bill photo.
 *
 *  Same schema-driven machinery and safety rules as Luma_Family:
 *    GET  ?action=vehicles | vehiclelogs | medicalbills
 *    POST { action: 'vehicle' | 'vehiclelog' | 'medicalbill', ... }               create
 *    POST { action, operation: 'update' | 'delete', id, ... }
 *    POST { action: 'vehiclelog' | 'medicalbill', operation: 'bulk', rows: [...] } many creates
 *  Money never moves here: the app records expenses/refunds through the normal
 *  transaction path. Sheets are created on first use.
 * ============================================================================
 */

var LUMA_LIFE_SCHEMAS = {
  Vehicles: {
    idPrefix: 'VEH',
    cols: [
      { n: 'Vehicle ID', w: 110, a: 'left' },
      { n: 'Name', w: 160, a: 'left' },
      { n: 'Type', w: 100, a: 'left' },
      { n: 'Registration Number', w: 150, a: 'left', f: 'text' },
      { n: 'Fuel', w: 90, a: 'left' },
      { n: 'Owner', w: 120, a: 'left' },
      { n: 'Insurance Expiry', w: 130, a: 'left', f: 'date' },
      { n: 'PUC Expiry', w: 120, a: 'left', f: 'date' },
      { n: 'Next Service Date', w: 140, a: 'left', f: 'date' },
      { n: 'Next Service Km', w: 120, a: 'right', f: 'int' },
      { n: 'Remind Days Before', w: 140, a: 'center', f: 'int' },
      { n: 'Is Active', w: 90, a: 'center' },
      { n: 'Notes', w: 240, a: 'left', wrap: true },
      { n: 'Created At', w: 150, a: 'left', f: 'datetime' },
      { n: 'Updated At', w: 150, a: 'left', f: 'datetime' }
    ]
  },
  'Vehicle Logs': {
    idPrefix: 'VLOG',
    cols: [
      { n: 'Log ID', w: 110, a: 'left' },
      { n: 'Vehicle ID', w: 110, a: 'left' },
      { n: 'Date', w: 120, a: 'left', f: 'date' },
      { n: 'Kind', w: 110, a: 'left' },
      { n: 'Amount', w: 110, a: 'right', f: 'money' },
      { n: 'Odometer', w: 110, a: 'right', f: 'int' },
      { n: 'Quantity', w: 100, a: 'right' },
      { n: 'Full Tank', w: 90, a: 'center' },
      { n: 'Place', w: 180, a: 'left' },
      { n: 'Transaction ID', w: 130, a: 'left' },
      { n: 'Note', w: 240, a: 'left', wrap: true },
      { n: 'Created At', w: 150, a: 'left', f: 'datetime' },
      { n: 'Updated At', w: 150, a: 'left', f: 'datetime' }
    ]
  },
  'Medical Bills': {
    idPrefix: 'MED',
    cols: [
      { n: 'Bill ID', w: 110, a: 'left' },
      { n: 'Person', w: 140, a: 'left' },
      { n: 'Date', w: 120, a: 'left', f: 'date' },
      { n: 'Kind', w: 130, a: 'left' },
      { n: 'Provider', w: 200, a: 'left' },
      { n: 'Amount', w: 110, a: 'right', f: 'money' },
      { n: 'Transaction ID', w: 130, a: 'left' },
      { n: 'Claim Status', w: 130, a: 'left' },
      { n: 'Insurer', w: 150, a: 'left' },
      { n: 'Claim Number', w: 150, a: 'left', f: 'text' },
      { n: 'Claimed Amount', w: 130, a: 'right', f: 'money' },
      { n: 'Reimbursed Amount', w: 140, a: 'right', f: 'money' },
      { n: 'Drive File ID', w: 160, a: 'left' },
      { n: 'File URL', w: 200, a: 'left' },
      { n: 'Notes', w: 240, a: 'left', wrap: true },
      { n: 'Created At', w: 150, a: 'left', f: 'datetime' },
      { n: 'Updated At', w: 150, a: 'left', f: 'datetime' }
    ]
  }
};

var LUMA_LIFE_ACTIONS = { vehicle: 'Vehicles', vehiclelog: 'Vehicle Logs', medicalbill: 'Medical Bills' };
var LUMA_LIFE_LISTS = { vehicles: 'Vehicles', vehiclelogs: 'Vehicle Logs', medicalbills: 'Medical Bills' };
var LUMA_VEHICLE_TYPES = ['Car', 'Bike', 'Scooter', 'Auto', 'Other'];
var LUMA_VEHICLE_LOG_KINDS = ['Fuel', 'Service', 'Repair', 'Insurance', 'PUC', 'Tyres', 'Wash', 'Toll & parking', 'Odometer', 'Other'];
var LUMA_MEDICAL_KINDS = ['Doctor', 'Hospital', 'Lab test', 'Medicines', 'Health check-up', 'Insurance premium', 'Dental', 'Eye', 'Other'];
var LUMA_CLAIM_STATUSES = ['Not claimed', 'Claim filed', 'Reimbursed', 'Partly reimbursed', 'Rejected', 'Not claimable'];
var LUMA_LIFE_BULK_MAX = 100;

function lumaLifeSheet_(sheetName) {
  if (!LUMA_SCHEMA[sheetName]) LUMA_SCHEMA[sheetName] = LUMA_LIFE_SCHEMAS[sheetName];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  var cols = LUMA_LIFE_SCHEMAS[sheetName].cols;
  if (!sh) {
    sh = ss.insertSheet(sheetName);
    sh.getRange(1, 1, 1, cols.length).setValues([cols.map(function (c) { return c.n; })]).setFontWeight('bold');
    sh.setFrozenRows(1);
    cols.forEach(function (c, i) {
      sh.setColumnWidth(i + 1, c.w);
      // Registration and claim numbers stay text.
      if (c.f === 'text') sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    });
  } else {
    ensureColumns_(sh, cols);
  }
  return sh;
}

/* ------------------------------------------------------------------ GET */

function tryHandleLumaLifeGet_(e) {
  var action = String((e && e.parameter && e.parameter.action) || '').trim().toLowerCase();
  var sheetName = LUMA_LIFE_LISTS[action];
  if (!sheetName) return null;
  try {
    lumaLifeSheet_(sheetName);
    var rows = readEntity_(sheetName, true);
    return lumaJson_({ success: true, count: rows.length, data: rows });
  } catch (err) {
    return lumaJson_({ success: false, error: safeMessage_(err) });
  }
}

/* ----------------------------------------------------------------- POST */

function tryHandleLumaLife_(e) {
  var payload;
  try {
    payload = parseLumaPayload_(e);
  } catch (err) {
    return null;
  }
  var action = String(payload.action || '').trim().toLowerCase();
  var sheetName = LUMA_LIFE_ACTIONS[action];
  if (!sheetName) return null;

  try {
    lumaLifeSheet_(sheetName);
    var operation = String(payload.operation || '').trim().toLowerCase();
    if (!operation) return lumaJson_(createEntity_(sheetName, lumaLifeClean_(sheetName, payload, true)));
    if (operation === 'bulk') return lumaJson_(lumaLifeBulk_(sheetName, payload.rows));
    if (!payload.id) throw new Error('id is required');
    if (operation === 'update') return lumaJson_(updateSchemaEntity_(sheetName, payload.id, lumaLifeClean_(sheetName, payload, false)));
    if (operation === 'delete') return lumaJson_(deleteSchemaEntity_(sheetName, payload.id));
    throw new Error('Unknown operation: ' + operation);
  } catch (err) {
    return lumaJson_({ success: false, error: safeMessage_(err) });
  }
}

/** Several logs/bills in one request (e.g. "log all fuel payments"). Each row is validated alone. */
function lumaLifeBulk_(sheetName, rows) {
  if (sheetName === 'Vehicles') throw new Error('Add vehicles one at a time.');
  if (!Array.isArray(rows) || !rows.length) throw new Error('Nothing to save.');
  if (rows.length > LUMA_LIFE_BULK_MAX) throw new Error('Save at most ' + LUMA_LIFE_BULK_MAX + ' at a time.');
  var created = [];
  var failed = [];
  rows.forEach(function (raw, index) {
    try {
      var res = createEntity_(sheetName, lumaLifeClean_(sheetName, raw || {}, true));
      created.push(res.id);
    } catch (err) {
      failed.push({ index: index, error: safeMessage_(err) });
    }
  });
  return { success: true, created: created.length, ids: created, failed: failed };
}

function lumaLifeClean_(sheetName, payload, isCreate) {
  var p = {};
  // Only plain fields; routing keys never land in a sheet.
  Object.keys(payload).forEach(function (k) {
    if (k === 'action' || k === 'operation' || k === 'id' || k === 'rows' || k === 't' || k === 'key') return;
    p[k] = payload[k];
  });
  var isoOk = function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); };
  var optionalDate = function (k, label) {
    if (k in p && p[k] !== '' && p[k] !== null && !isoOk(p[k])) throw new Error('Invalid ' + label + '.');
    if (k in p && !p[k]) p[k] = '';
  };
  var optionalNumber = function (k, label) {
    if (!(k in p) || p[k] === '' || p[k] === null) { if (k in p) p[k] = ''; return; }
    p[k] = Number(p[k]);
    if (!(p[k] >= 0)) throw new Error('Invalid ' + label + '.');
  };
  var oneOf = function (k, list, fallback, label) {
    if (!(k in p) && !isCreate) return;
    p[k] = String(p[k] || fallback).trim();
    if (list.indexOf(p[k]) < 0) throw new Error('Unknown ' + label + ': ' + p[k]);
  };

  if (sheetName === 'Vehicles') {
    if (isCreate || 'name' in p) {
      p.name = String(p.name || '').trim();
      if (!p.name) throw new Error('Give the vehicle a name (e.g. "Swift" or "Activa").');
    }
    oneOf('type', LUMA_VEHICLE_TYPES, 'Car', 'vehicle type');
    if ('registrationNumber' in p) p.registrationNumber = String(p.registrationNumber || '').toUpperCase().replace(/\s+/g, ' ').trim();
    optionalDate('insuranceExpiry', 'insurance expiry');
    optionalDate('pucExpiry', 'PUC expiry');
    optionalDate('nextServiceDate', 'service date');
    optionalNumber('nextServiceKm', 'service km');
    if (isCreate) {
      if (p.remindDaysBefore === undefined || p.remindDaysBefore === '') p.remindDaysBefore = 15;
      p.isActive = p.isActive === undefined ? true : p.isActive;
    }
  } else if (sheetName === 'Vehicle Logs') {
    if (isCreate || 'vehicleId' in p) {
      p.vehicleId = String(p.vehicleId || '').trim();
      if (!p.vehicleId) throw new Error('Choose the vehicle.');
    }
    if (isCreate || 'date' in p) {
      if (!isoOk(p.date)) throw new Error('Pick the date.');
    }
    oneOf('kind', LUMA_VEHICLE_LOG_KINDS, 'Fuel', 'entry type');
    if (isCreate || 'amount' in p) {
      p.amount = p.amount === '' || p.amount === undefined || p.amount === null ? 0 : Number(p.amount);
      if (!(p.amount >= 0)) throw new Error('Enter the amount.');
    }
    optionalNumber('odometer', 'odometer reading');
    optionalNumber('quantity', 'quantity');
    if ('transactionId' in p) p.transactionId = String(p.transactionId || '').trim();
  } else {
    if (isCreate || 'person' in p) {
      p.person = String(p.person || '').trim();
      if (!p.person) throw new Error('Whose bill is it?');
    }
    if (isCreate || 'date' in p) {
      if (!isoOk(p.date)) throw new Error('Pick the bill date.');
    }
    oneOf('kind', LUMA_MEDICAL_KINDS, 'Doctor', 'bill type');
    if (isCreate || 'amount' in p) {
      p.amount = Number(p.amount);
      if (!(p.amount >= 0)) throw new Error('Enter the bill amount.');
    }
    oneOf('claimStatus', LUMA_CLAIM_STATUSES, 'Not claimed', 'claim status');
    optionalNumber('claimedAmount', 'claimed amount');
    optionalNumber('reimbursedAmount', 'reimbursed amount');
    if ('transactionId' in p) p.transactionId = String(p.transactionId || '').trim();
    if ('fileUrl' in p && p.fileUrl && !/^https:\/\/(drive|docs)\.google\.com\//.test(String(p.fileUrl))) throw new Error('Only Google Drive links can be attached.');
  }
  return p;
}

/* ------------------------------------------------- digest contributions */

/** Lines for the daily email: vehicle papers/service due, and the monthly import nudge. */
function lumaLifeDigestLines_(today) {
  var lines = { vehicles: [], reminders: [] };
  try {
    lumaLifeSheet_('Vehicles');
    readEntity_('Vehicles', true).forEach(function (v) {
      if (v.isActive === false || String(v.isActive).toUpperCase() === 'FALSE') return;
      var remind = v.remindDaysBefore === null || v.remindDaysBefore === undefined || v.remindDaysBefore === '' ? 15 : Number(v.remindDaysBefore);
      var limit = lumaAddDays_(today, remind);
      [['insuranceExpiry', 'insurance'], ['pucExpiry', 'PUC'], ['nextServiceDate', 'service']].forEach(function (pair) {
        var d = lumaIsoOf_(v[pair[0]]);
        if (!d || d > limit) return;
        var what = v.name + ' ' + pair[1];
        lines.vehicles.push(d < today ? what + ' OVERDUE since ' + d : d === today ? what + ' due TODAY' : what + ' due ' + d);
      });
    });
  } catch (err) { Logger.log('digest vehicles: ' + err.message); }

  // On the 1st and 5th: nudge to import last month's Google Pay statement if nothing came in yet.
  try {
    var day = Number(today.slice(8, 10));
    if (day === 1 || day === 5) {
      var y = Number(today.slice(0, 4));
      var m = Number(today.slice(5, 7)) - 1;
      if (m === 0) { m = 12; y--; }
      var prev = y + '-' + (m < 10 ? '0' : '') + m;
      var imported = (readTransactions_(SpreadsheetApp.getActiveSpreadsheet(), false) || []).some(function (t) {
        return t.reference && String(t.date).slice(0, 7) === prev;
      });
      if (!imported) {
        var name = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1];
        lines.reminders.push('Import ' + name + "'s Google Pay statement (Transactions → Import) so every payment is in Luma.");
      }
    }
  } catch (err) { Logger.log('digest import: ' + err.message); }
  return lines;
}
