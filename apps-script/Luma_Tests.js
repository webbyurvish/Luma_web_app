/**
 * ============================================================================
 *  LUMA PERSONAL OS — LIFECYCLE TESTS
 * ============================================================================
 *
 *  Exercises create -> verify -> update -> verify -> archive/void/deactivate
 *  -> verify excluded by default -> verify included with includeArchived ->
 *  verify original data intact / Updated At changed / Created At unchanged,
 *  for every mutable entity, through the real functions in Luma_Lifecycle.gs.
 *
 *  Every record this file creates is tagged "TEST - API CRUD" in a visible
 *  text field. Never run these against anything else, and never widen the
 *  cleanup function below to match anything less specific than that exact
 *  string.
 *
 *  Run runAllLumaLifecycleTests() once from the editor, after:
 *    backupLumaSpreadsheet() -> setupLumaSheets() -> setupLumaLifecycle()
 *  and read the Execution log for the PASS/FAIL summary.
 *
 *  No test here ever hard-deletes a row. Each test's own last step already
 *  archives/voids/deactivates the record it created, so by design no cleanup
 *  is required afterwards — archiveLumaTestRecords() is a separate safety
 *  net only, for the case a test failed partway through and left a record
 *  active.
 * ============================================================================
 */

var LUMA_TEST_MARKER = 'TEST - API CRUD';

/* ========================================================================== */
/*  SCHEMA-DRIVEN ENTITIES                                                    */
/* ========================================================================== */

function testSchemaEntityLifecycle_(sheetName, createFields, updateFields) {
  var schema = LUMA_SCHEMA[sheetName];
  if (!schema) throw new Error('No schema for ' + sheetName);
  var idKey = camelKey_(schema.cols[0].n);

  var id;
  var created = createEntity_(sheetName, createFields);
  if (!created.success || !created.id) throw new Error('create failed: ' + JSON.stringify(created));
  id = created.id;

  function findBy(includeArchived) {
    return readEntity_(sheetName, includeArchived).filter(function (r) { return r[idKey] === id; })[0];
  }

  var afterCreate = findBy(false);
  if (!afterCreate) throw new Error('created record not found in default GET');
  if (!afterCreate.createdAt) throw new Error('createdAt missing after create');

  // Updated At is serialized to whole-second precision (see serializeCell_ in
  // Luma_Data), so create and update need to land in different wall-clock
  // seconds for the "did Updated At change" check below to be meaningful.
  Utilities.sleep(1100);

  var updated = updateSchemaEntity_(sheetName, id, updateFields);
  if (!updated.success) throw new Error('update failed: ' + JSON.stringify(updated));

  var afterUpdate = findBy(false);
  if (!afterUpdate) throw new Error('updated record not found in default GET');
  Object.keys(updateFields).forEach(function (key) {
    if (String(afterUpdate[key]) !== String(updateFields[key])) {
      throw new Error('field "' + key + '" not applied: expected ' + updateFields[key] + ', got ' + afterUpdate[key]);
    }
  });
  if (afterUpdate.createdAt !== afterCreate.createdAt) throw new Error('createdAt changed on update — must never change');
  if (afterUpdate.updatedAt === afterCreate.updatedAt) throw new Error('updatedAt did not change on update');

  // Updated At is serialized to whole-second precision (see serializeCell_ in
  // Luma_Data), so update and archive need to land in different wall-clock
  // seconds for the "did Updated At change" check below to be meaningful.
  Utilities.sleep(1100);

  var archived = archiveSchemaEntity_(sheetName, id);
  if (!archived.success) throw new Error('archive failed: ' + JSON.stringify(archived));

  var stillDefault = findBy(false);
  if (stillDefault) throw new Error('archived record still appears in default GET');

  var afterArchive = findBy(true);
  if (!afterArchive) throw new Error('archived record missing from includeArchived=true GET');
  Object.keys(updateFields).forEach(function (key) {
    if (String(afterArchive[key]) !== String(updateFields[key])) {
      throw new Error('field "' + key + '" lost after archive: expected ' + updateFields[key] + ', got ' + afterArchive[key]);
    }
  });
  if (afterArchive.createdAt !== afterCreate.createdAt) throw new Error('createdAt changed on archive — must never change');
  if (afterArchive.updatedAt === afterUpdate.updatedAt) throw new Error('updatedAt did not change on archive');

  Logger.log('[Luma][test] ' + sheetName + ' lifecycle: PASS (id=' + id + ')');
  return { entity: sheetName, id: id };
}

/* ========================================================================== */
/*  TRANSACTIONS — VOID-specific sequence                                    */
/* ========================================================================== */

function testTransactionLifecycle_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Transactions');
  if (!sh) throw new Error('No Transactions sheet.');

  var now = new Date();
  sh.appendRow([now, now, 111, 'Expense', 'Other', 'TEST', 'Cash', LUMA_TEST_MARKER, LUMA_TEST_MARKER, transactionMonth_(now, now)]);
  var rowIndex = sh.getLastRow();

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  var idCol = headers.indexOf('Transaction ID') + 1;
  if (!idCol) throw new Error('Transaction ID column missing — run setupLumaSheets() first.');
  var id = withLumaLock_(function () { return nextLumaIds_(sh, 'TXN', idCol, 1)[0]; });
  sh.getRange(rowIndex, idCol).setValue(id);

  function getTx(includeVoided) {
    var params = { action: 'transactions' };
    if (includeVoided) params.includeVoided = 'true';
    var resp = JSON.parse(doGet({ parameter: params }).getContent());
    return resp.transactions.filter(function (t) { return t.id === id; })[0];
  }

  var before = getTx(false);
  if (!before) throw new Error('created test transaction not found in default GET');

  var updated = updateTransaction_(id, { amount: 222, note: LUMA_TEST_MARKER + ' updated' });
  if (!updated.success) throw new Error('transaction update failed');

  var afterUpdate = getTx(false);
  if (!afterUpdate || afterUpdate.amount !== 222) throw new Error('amount not updated');
  if (afterUpdate.note !== LUMA_TEST_MARKER + ' updated') throw new Error('note not updated');

  var voided = voidTransaction_(id);
  if (!voided.success) throw new Error('void failed');

  var afterVoidDefault = getTx(false);
  if (afterVoidDefault) throw new Error('voided transaction still appears in default GET');

  var afterVoidIncluded = getTx(true);
  if (!afterVoidIncluded) throw new Error('voided transaction missing from includeVoided=true GET');
  if (afterVoidIncluded.status !== 'Voided') throw new Error('status is not "Voided"');
  if (afterVoidIncluded.amount !== 222) throw new Error('amount lost after void — should still read 222');

  Logger.log('[Luma][test] Transactions lifecycle: PASS (id=' + id + ')');
  return { entity: 'Transactions', id: id };
}

/* ========================================================================== */
/*  UDHAAR — ARCHIVE must never disturb Outstanding/Status formulas          */
/* ========================================================================== */

function testUdhaarLifecycle_() {
  var payload = {
    person: LUMA_TEST_MARKER, type: 'Given', amount: 500,
    description: LUMA_TEST_MARKER, note: LUMA_TEST_MARKER
  };
  var check = validateUdhaarData_(payload);
  if (!check.ok) throw new Error('validation failed: ' + check.errors.join(', '));
  var created = saveUdhaarTransaction_(check.value);
  if (!created.success) throw new Error('udhaar create failed');
  var id = created.id;
  if (!id) throw new Error('udhaar create returned no id — run setupLumaSheets() so the Udhaar ID column exists, then re-run');

  function getUdhaar(includeArchived) {
    return readEntity_('Udhaar', includeArchived).filter(function (r) { return r.udhaarId === id; })[0];
  }

  var before = getUdhaar(false);
  if (!before) throw new Error('created udhaar record not found in default GET');
  var outstandingBefore = before.outstanding;

  var updated = updateUdhaarRecord_(id, { note: LUMA_TEST_MARKER + ' updated' });
  if (!updated.success) throw new Error('udhaar update failed');

  var afterUpdate = getUdhaar(false);
  if (afterUpdate.note !== LUMA_TEST_MARKER + ' updated') throw new Error('note not updated');
  if (afterUpdate.outstanding !== outstandingBefore) throw new Error('outstanding changed from a non-amount update — the formula must be untouched');

  var archived = archiveUdhaarRecord_(id);
  if (!archived.success) throw new Error('udhaar archive failed');

  var stillDefault = getUdhaar(false);
  if (stillDefault) throw new Error('archived udhaar record still appears in default GET');

  var afterArchive = getUdhaar(true);
  if (!afterArchive) throw new Error('archived udhaar record missing from includeArchived=true GET');
  if (afterArchive.outstanding !== outstandingBefore) throw new Error('outstanding formula affected by archiving — must never change');

  Logger.log('[Luma][test] Udhaar lifecycle: PASS (id=' + id + ')');
  return { entity: 'Udhaar', id: id };
}

/* ========================================================================== */
/*  CATEGORIES — deactivate must never affect a historical transaction's     */
/*  category label                                                           */
/* ========================================================================== */

function testCategoryLifecycle_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Categories');
  if (!sh) throw new Error('No Categories sheet.');

  var category = LUMA_TEST_MARKER;
  // Unique per run so this can never collide with a leftover row from an
  // earlier test run — category+subcategory is the lookup key, so two rows
  // sharing one would make the lookup silently operate on the wrong row.
  var subcategory = 'Sub-' + new Date().getTime();

  var lastRow = sh.getLastRow();
  var width = Math.max(sh.getLastColumn(), 2);
  var row = blankRow_(width);
  row[0] = category;
  row[1] = subcategory;
  var target = Math.max(lastRow + 1, 2);
  if (sh.getMaxRows() < target) sh.insertRowsAfter(sh.getMaxRows(), target - sh.getMaxRows());
  sh.getRange(target, 1, 1, width).setValues([row]);

  // A historical transaction referencing this category, to prove deactivating
  // the category never touches transactions that already point at it. Gets its
  // own Transaction ID immediately so it can be voided once the test is done —
  // otherwise it would sit in the sheet as a real, un-cleanable Active row.
  var txSh = ss.getSheetByName('Transactions');
  var now = new Date();
  txSh.appendRow([now, now, 50, 'Expense', category, subcategory, 'Cash', LUMA_TEST_MARKER, LUMA_TEST_MARKER, transactionMonth_(now, now)]);
  var txRow = txSh.getLastRow();
  var txHeaders = txSh.getRange(1, 1, 1, txSh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  var txIdCol = txHeaders.indexOf('Transaction ID') + 1;
  var txId = null;
  if (txIdCol) {
    txId = withLumaLock_(function () { return nextLumaIds_(txSh, 'TXN', txIdCol, 1)[0]; });
    txSh.getRange(txRow, txIdCol).setValue(txId);
  }

  var updated = handleCategoryLifecycle_('update', { category: category, subcategory: subcategory, active: true, sortOrder: 999 });
  if (!updated.success) throw new Error('category update failed');

  var deactivated = handleCategoryLifecycle_('deactivate', { category: category, subcategory: subcategory });
  if (!deactivated.success) throw new Error('category deactivate failed');

  var stillDefault = readEntity_('Categories', false).filter(function (r) { return r.category === category && r.subcategory === subcategory; })[0];
  if (stillDefault) throw new Error('deactivated category still appears in default GET');

  var included = readEntity_('Categories', true).filter(function (r) { return r.category === category && r.subcategory === subcategory; })[0];
  if (!included) throw new Error('deactivated category missing from includeArchived=true GET');

  var txData = JSON.parse(doGet({ parameter: { action: 'transactions' } }).getContent());
  var histTx = txData.transactions.filter(function (t) { return t.category === category && t.merchant === LUMA_TEST_MARKER; })[0];
  if (!histTx) throw new Error('historical transaction referencing the deactivated category is missing');
  if (histTx.category !== category) throw new Error('historical transaction lost its category label after deactivation');

  // Clean up the test transaction itself — void, never delete.
  if (txId) voidTransaction_(txId);

  Logger.log('[Luma][test] Categories lifecycle: PASS');
  return { entity: 'Categories', category: category, subcategory: subcategory };
}

/* ========================================================================== */
/*  RUN EVERYTHING                                                            */
/* ========================================================================== */

function runAllLumaLifecycleTests() {
  var summary = [];

  var schemaEntities = [
    ['Accounts',
      { accountName: LUMA_TEST_MARKER, accountType: 'Bank', institution: 'Test Bank', currency: 'INR' },
      { institution: 'Test Bank Updated', currentBalance: 1000 }],
    ['Investments',
      { investmentName: LUMA_TEST_MARKER, investmentType: 'Stock', platform: 'Test Platform', investedAmount: 1000, currentValue: 1000, currency: 'INR', status: 'Active' },
      { platform: 'Test Platform Updated', currentValue: 1200 }],
    ['SIPs',
      { sipName: LUMA_TEST_MARKER, fundName: 'Test Fund', investmentType: 'Mutual Fund', platform: 'Test Platform', amount: 500, frequency: 'Monthly', isActive: true },
      { amount: 600 }],
    ['Notes',
      { title: LUMA_TEST_MARKER, content: 'test content', category: 'Other' },
      { content: 'updated content' }],
    ['Documents',
      { name: LUMA_TEST_MARKER, description: 'test doc', category: 'Other' },
      { description: 'updated doc description' }],
    ['Tasks',
      { title: LUMA_TEST_MARKER, status: 'Todo', priority: 'Low' },
      { priority: 'High' }],
    ['Liabilities',
      { name: LUMA_TEST_MARKER, type: 'Personal Loan', originalAmount: 10000, outstandingAmount: 10000, status: 'Active' },
      { outstandingAmount: 8000 }]
  ];

  schemaEntities.forEach(function (cfg) {
    try {
      var res = testSchemaEntityLifecycle_(cfg[0], cfg[1], cfg[2]);
      summary.push(cfg[0] + ': PASS (id=' + res.id + ')');
    } catch (err) {
      summary.push(cfg[0] + ': FAIL — ' + err.message);
    }
  });

  try {
    var t = testTransactionLifecycle_();
    summary.push('Transactions: PASS (id=' + t.id + ')');
  } catch (err) {
    summary.push('Transactions: FAIL — ' + err.message);
  }

  try {
    var u = testUdhaarLifecycle_();
    summary.push('Udhaar: PASS (id=' + u.id + ')');
  } catch (err) {
    summary.push('Udhaar: FAIL — ' + err.message);
  }

  try {
    testCategoryLifecycle_();
    summary.push('Categories: PASS');
  } catch (err) {
    summary.push('Categories: FAIL — ' + err.message);
  }

  Logger.log('===== Luma lifecycle test summary =====');
  summary.forEach(function (line) { Logger.log(line); });
  Logger.log('Every test record ends ARCHIVED/VOIDED/DEACTIVATED by the test itself (never deleted). ' +
             'archiveLumaTestRecords() is only a safety net for a test that failed partway through.');
  return summary;
}

/* ========================================================================== */
/*  CLEANUP — safety net only. Archives, never hard-deletes. Matches ONLY    */
/*  the exact marker string, never a broad pattern like "today's rows."      */
/* ========================================================================== */

function archiveLumaTestRecords() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var report = {};

  var schemaTargets = {
    Accounts: 'accountName', Investments: 'investmentName', SIPs: 'sipName',
    Notes: 'title', Documents: 'name', Tasks: 'title', Liabilities: 'name'
  };

  Object.keys(schemaTargets).forEach(function (sheetName) {
    var field = schemaTargets[sheetName];
    var schema = LUMA_SCHEMA[sheetName];
    var idKey = camelKey_(schema.cols[0].n);
    var count = 0;
    readEntity_(sheetName, false).forEach(function (r) {
      if (r[field] === LUMA_TEST_MARKER) { archiveSchemaEntity_(sheetName, r[idKey]); count++; }
    });
    if (count) report[sheetName] = count;
  });

  if (ss.getSheetByName('Transactions')) {
    var txData = JSON.parse(doGet({ parameter: { action: 'transactions' } }).getContent()).transactions;
    var voided = 0;
    txData.forEach(function (t) {
      if (t.id && (t.merchant === LUMA_TEST_MARKER || t.note === LUMA_TEST_MARKER)) { voidTransaction_(t.id); voided++; }
    });
    if (voided) report.Transactions = voided;
  }

  if (ss.getSheetByName('Udhaar')) {
    var udhaarCount = 0;
    readEntity_('Udhaar', false).forEach(function (r) {
      if (r.person === LUMA_TEST_MARKER && r.udhaarId) { archiveUdhaarRecord_(r.udhaarId); udhaarCount++; }
    });
    if (udhaarCount) report.Udhaar = udhaarCount;
  }

  if (ss.getSheetByName('Categories')) {
    var catCount = 0;
    readEntity_('Categories', false).forEach(function (r) {
      if (r.category === LUMA_TEST_MARKER) {
        handleCategoryLifecycle_('deactivate', { category: r.category, subcategory: r.subcategory || '' });
        catCount++;
      }
    });
    if (catCount) report.Categories = catCount;
  }

  Logger.log('archiveLumaTestRecords: ' + (Object.keys(report).length ? JSON.stringify(report) : 'nothing matched — nothing to archive'));
  return report;
}
