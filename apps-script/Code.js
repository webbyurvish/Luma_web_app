/**
 * Luma Personal OS — web app entry points.
 *
 * PATCHED 2026-09-23. Three changes, nothing else:
 *   1. The duplicate doPost() declaration was removed. There is now exactly one.
 *   2. doGet()/doPost() dispatch to the Luma and Udhaar modules first, and fall
 *      through to the original logic for everything else.
 *   3. Column J (Month) is now derived from the transaction's own date and
 *      written as a real Date value. See transactionMonth_() below.
 *
 * The ?action=health and ?action=transactions responses are byte-identical to
 * before, and the iPhone Shortcut payload is unchanged — it needs no "action"
 * field, and a payload without one always reaches the original code path.
 */

function doGet(e) {
  // Passcode gate (Luma_Auth): answers authstatus, refuses unauthenticated reads once enforced.
  var gate = lumaAuthGateGet_(e);
  if (gate) return gate;

  // Luma Documents in Google Drive (Luma_Drive). Null for every other action.
  var driveGet = tryHandleLumaDriveGet_(e);
  if (driveGet) return driveGet;

  // Speech tokens for the mic button (Luma_AI). Null for every other action.
  var aiGet = tryHandleLumaAIGet_(e);
  if (aiGet) return aiGet;

  // Luma read routes (accounts, notes, tasks, ...). Returns null for health,
  // transactions, a missing action, and anything it does not recognise, so the
  // original logic below is reached unchanged. Never throws.
  var luma = tryHandleLumaGet_(e);
  if (luma) return luma;

  try {
    const action = e?.parameter?.action || "health";

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    // Health check
    if (action === "health") {
      return jsonResponse({
        success: true,
        message: "Expense Tracker API is running"
      });
    }

    // Get transactions
    if (action === "transactions") {
      const includeVoided = String(e?.parameter?.includeVoided || "").trim().toLowerCase() === "true";
      const transactions = readTransactions_(spreadsheet, includeVoided);

      // An empty sheet has always answered without a count; kept byte-identical.
      if (transactions === null) {
        return jsonResponse({
          success: true,
          transactions: []
        });
      }

      return jsonResponse({
        success: true,
        count: transactions.length,
        transactions: transactions
      });
    }

    // Everything the web app needs on first paint, in ONE execution: one cold
    // start, one redirect, one spreadsheet open — instead of five parallel
    // requests that Apps Script queues behind each other. Each collection is
    // read independently, so one missing sheet can't blank the others; its
    // error is reported under errors[key] and the client falls back to the
    // single-collection route for just that key.
    if (action === "bootstrap") {
      const data = {};
      const errors = {};
      const lumaKeys = ["accounts", "investments", "sips", "liabilities", "udhaar"];

      lumaKeys.forEach(key => {
        try {
          data[key] = readEntity_(LUMA_GET_ROUTES[key], false);
        } catch (err) {
          errors[key] = safeMessage_(err);
        }
      });

      try {
        data.transactions = readTransactions_(spreadsheet, false) || [];
      } catch (err) {
        errors.transactions = safeMessage_(err);
      }

      return jsonResponse({
        success: true,
        data: data,
        errors: errors
      });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message
    });
  }
}


// ---------- Helper Functions ----------

/**
 * Transactions sheet as the API's transaction objects. Shared by
 * ?action=transactions and ?action=bootstrap so both return identical rows.
 * Returns null (not []) for a sheet with only a header, because the
 * transactions route has always answered that case without a count.
 */
function readTransactions_(spreadsheet, includeVoided) {
  const sheet = spreadsheet.getSheetByName("Transactions");

  if (!sheet) {
    throw new Error('Sheet "Transactions" not found.');
  }

  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return null;

  // Column J stays index 9 exactly as before. Any lifecycle columns
  // (Transaction ID / Status / Voided At / Updated At) are looked up by
  // header text, since they only exist once setupLumaLifecycle() has run
  // — so this whole block degrades gracefully before that migration too.
  const rawHeaders = data[0].map(h => String(h).trim());
  const idCol = rawHeaders.indexOf("Transaction ID");
  const statusCol = rawHeaders.indexOf("Status");
  const voidedAtCol = rawHeaders.indexOf("Voided At");
  const accountCol = rawHeaders.indexOf("Account ID");
  const toAccountCol = rawHeaders.indexOf("To Account ID");

  // Fields 0-9 are read by fixed index, so any column beyond J is ignored
  // and the response shape for existing fields cannot change when the
  // sheet is widened. id/status/voidedAt below are new, additive fields.
  return data.slice(1)
    .filter(row => row[1] !== "" || row[2] !== "")
    .filter(row => includeVoided || statusCol < 0 || row[statusCol] !== "Voided")
    .map(row => ({
      timestamp: formatDate(row[0]),
      date: formatDate(row[1]),
      amount: Number(row[2]) || 0,
      type: row[3] || "Expense",
      category: row[4] || "Other",
      subcategory: row[5] || "",
      paymentMethod: row[6] || "",
      merchant: row[7] || "",
      note: row[8] || "",
      month: row[9] || "",
      id: idCol >= 0 ? (row[idCol] || "") : "",
      status: statusCol >= 0 ? (row[statusCol] || "Active") : "Active",
      voidedAt: voidedAtCol >= 0 && row[voidedAtCol] ? formatDate(row[voidedAtCol]) : null,
      accountId: accountCol >= 0 ? String(row[accountCol] || "") : "",
      toAccountId: toAccountCol >= 0 ? String(row[toAccountCol] || "") : ""
    }));
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


function formatDate(value) {
  if (!value) return "";

  if (value instanceof Date) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd'T'HH:mm:ss"
    );
  }

  return String(value);
}


/**
 * Column J for a new transaction: the first of the transaction's own month,
 * as a real Date value.
 *
 * Previously this was Utilities.formatDate(now, tz, "MMM-yyyy") — a string
 * built from the server clock. Two problems: a back-dated entry was filed
 * under the wrong month, and "Sep-2026" is text that only became a date
 * because Sheets happened to parse it, which is locale-dependent.
 *
 * A Date built here lands on exact midnight because the script timezone
 * (Asia/Kolkata) and the spreadsheet timezone (Asia/Calcutta, the legacy alias
 * for the same zone) are the same UTC+05:30. That matches the existing rows
 * exactly, so the Dashboard's SUMIFS(..., Transactions!J:J, $C$5) keeps
 * matching. Verified against the existing data: J holds midnight-on-the-1st.
 *
 * Backward compatible: with no usable data.date it falls back to `now`, which
 * is what every request the Shortcut sends today already does.
 */
function transactionMonth_(rawDate, now) {
  const d = coerceTransactionDate_(rawDate) || now;
  return new Date(d.getFullYear(), d.getMonth(), 1);
}


/** Date objects, ISO yyyy-MM-dd (parsed without timezone drift), or anything
 *  the Date constructor understands. Returns null when unusable. */
function coerceTransactionDate_(raw) {
  if (!raw) return null;

  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? null : raw;
  }

  const s = String(raw).trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
}


function doPost(e) {
  // Passcode gate (Luma_Auth): handles sign-in, refuses unauthenticated writes once enforced.
  var gate = lumaAuthGatePost_(e);
  if (gate) return gate;

  // Document operations (Luma_Drive) carry a "driveOp" field; everything else gets null.
  var drive = tryHandleLumaDrive_(e);
  if (drive) return drive;

  // AI requests (Luma_AI) carry an "aiTask" field; everything else gets null.
  var ai = tryHandleLumaAI_(e);
  if (ai) return ai;

  // Udhaar records (recordType: "Udhaar"). Returns null for anything else.
  var udhaar = tryHandleUdhaar_(e);
  if (udhaar) return udhaar;

  // Lifecycle operations (action + operation: "update" | "archive" |
  // "deactivate" | "void" | "settle" | "close"). Returns null when the
  // payload carries no operation field, so plain creates fall through
  // unchanged to the router below.
  var lifecycle = tryHandleLumaLifecyclePost_(e);
  if (lifecycle) return lifecycle;

  // Luma entity records (action: "account" | "note" | "task" | ...).
  // Returns null when the payload carries no matching action.
  var luma = tryHandleLumaPost_(e);
  if (luma) return luma;

  // Both routers sit above the try block, so a non-transaction POST never even
  // looks up the Transactions sheet. A payload with neither discriminator —
  // which is exactly what the iPhone Shortcut sends — reaches the line below
  // with nothing changed.
  try {
    const sheet = SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName("Transactions");

    if (!sheet) {
      throw new Error('Sheet "Transactions" not found.');
    }

    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No POST data received.");
    }

    const data = JSON.parse(e.postData.contents);

    const now = new Date();

    // Columns A:J keep their existing meanings and order. Column B still
    // receives data.date || now exactly as before; only column J changed.
    sheet.appendRow([
      now,
      data.date || now,
      data.amount || 0,
      data.type || "Expense",
      data.category || "Other",
      data.subcategory || "",
      data.paymentMethod || "",
      data.merchant || "",
      data.note || "",
      transactionMonth_(data.date, now)
    ]);

    // Give the new row its Transaction ID / Status so it can be edited and
    // deleted from the app. Additive and isolated: any failure here is only
    // logged, so the save and the response the Shortcut sees are unchanged.
    var newRow = sheet.getLastRow();
    try {
      assignTransactionLifecycleFields_(sheet, newRow);
    } catch (lifecycleError) {
      Logger.log('assignTransactionLifecycleFields_ skipped: ' + lifecycleError.message);
    }
    // Link the account(s) the money moved through and update their balances (Luma_Ledger).
    // Isolated like the above: a problem here never fails the save.
    try {
      lumaLinkNewTransaction_(sheet, newRow, data);
    } catch (ledgerError) {
      Logger.log('lumaLinkNewTransaction_ skipped: ' + ledgerError.message);
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: "Expense saved successfully"
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {

    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// TEMPORARY TEST FUNCTION
function testDoPost() {

  const testData = {
    amount: 250,
    type: "Expense",
    category: "Food",
    subcategory: "Restaurant",
    paymentMethod: "UPI",
    merchant: "Test Restaurant",
    note: "Test expense"
  };

  const mockEvent = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };

  const response = doPost(mockEvent);

  Logger.log(response.getContent());
}