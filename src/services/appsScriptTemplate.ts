import { ACTIVE_SPREADSHEET_ID } from './storage';

/**
 * Generates ready-to-paste Google Apps Script (Code.gs) bound to the target BookSwap Google Spreadsheet.
 * Handles atomic writes to Books (gid=229659620), Transactions (gid=104373978), and Settings tabs
 * with zero OAuth unverified-app warnings and zero 1-hour token expiration.
 */
export function getBookSwapAppsScriptCode(spreadsheetId = ACTIVE_SPREADSHEET_ID): string {
  const targetId = (spreadsheetId || ACTIVE_SPREADSHEET_ID).trim();
  return `// =====================================================================
// BookSwap Kiosk - Google Sheets Auto-Sync Web App (Code.gs)
// Spreadsheet ID: ${targetId}
// วิธีติดตั้ง:
// 1) เปิด Google Sheet -> เมนู Extensions (ส่วนขยาย) -> Apps Script
// 2) ลบโค้ดเดิมแล้ววางโค้ดนี้ทั้งหมด จากนั้นกด Save (Ctrl+S)
// 3) กด Deploy -> New deployment -> เลือกชนิด Web app
//    - Execute as: Me (บัญชีเจ้าของชีต)
//    - Who has access: Anyone (ทุกคน)
// 4) กด Deploy -> คัดลอก Web app URL (ลงท้ายด้วย /exec) ไปวางในหน้า "ตั้งค่าระบบ" ของแอป
// =====================================================================

const SPREADSHEET_ID = '${targetId}';

const BOOK_HEADERS = [
  'Code', 'Title', 'Category', 'Price', 'Status', 'Source', 'MemberType',
  'DriveFileId', 'CoverImage', 'CreatedAt', 'MatchedAt', 'MatchedWithCode',
  'ExchangeCount', 'TransactionId', 'ISBN', 'MatchedTransactionId'
];

const TRANSACTION_HEADERS = [
  'TransactionId', 'Timestamp', 'ParticipationHistory', 'VisitFrequencyThisYear',
  'MemberType', 'TotalBroughtCount', 'MatchedCount', 'DonatedCount',
  'CancelledCount', 'BooksBrought', 'BooksTaken'
];

const SETTINGS_HEADERS = ['Key', 'Value', 'UpdatedAt'];

function getSpreadsheet_(overrideId) {
  var id = (overrideId || SPREADSHEET_ID || '').trim();
  if (id) {
    return SpreadsheetApp.openById(id);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  var lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  } else {
    var existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
    var needsHeaderFix = false;
    for (var i = 0; i < headers.length; i++) {
      if (!existingHeaders[i]) {
        needsHeaderFix = true;
        break;
      }
    }
    if (needsHeaderFix) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  return sheet;
}

function bookToRow_(b) {
  return [
    String(b.code || '').trim().toUpperCase(),
    String(b.title || ''),
    String(b.category || 'หนังสือทั่วไป'),
    Number(b.price || 0),
    String(b.status || 'Available'),
    String(b.source || (String(b.code || '').toUpperCase().indexOf('U') === 0 ? 'User' : 'Library')),
    String(b.memberType || ''),
    String(b.driveFileId || ''),
    String(b.coverImage || ''),
    String(b.createdAt || new Date().toISOString()),
    String(b.matchedAt || ''),
    String(b.matchedWithCode || ''),
    Number(b.exchangeCount || 1),
    String(b.transactionId || ''),
    String(b.isbn || ''),
    String(b.matchedTransactionId || '')
  ];
}

function txToRow_(t) {
  var booksBrought = Array.isArray(t.booksBrought) ? t.booksBrought : [];
  var booksTaken = Array.isArray(t.booksTaken) ? t.booksTaken : [];
  var totalBrought = t.totalBroughtCount !== undefined
    ? Number(t.totalBroughtCount)
    : (t.booksBroughtCount !== undefined ? Number(t.booksBroughtCount) : booksBrought.length + Number(t.cancelledCount || 0));
  var matched = t.matchedCount !== undefined
    ? Number(t.matchedCount)
    : (t.booksTakenCount !== undefined ? Number(t.booksTakenCount) : booksTaken.length);
  var participant = t.participant || {};

  return [
    String(t.id || '').trim(),
    String(t.timestamp || new Date().toISOString()),
    String(participant.participationHistory || '-'),
    String(participant.visitFrequencyThisYear || '-'),
    String(participant.memberType || ''),
    totalBrought,
    matched,
    Number(t.donatedCount || 0),
    Number(t.cancelledCount || 0),
    booksBrought.join(', '),
    booksTaken.join(', ')
  ];
}

function upsertBooks_(ss, booksList) {
  if (!booksList || !booksList.length) return { updated: 0, appended: 0 };
  var sheet = getOrCreateSheet_(ss, 'Books', BOOK_HEADERS);
  var lastRow = sheet.getLastRow();
  var codeToRow = {};

  if (lastRow >= 2) {
    var codes = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < codes.length; i++) {
      var code = String(codes[i][0] || '').trim().toUpperCase();
      if (code && !codeToRow[code]) {
        codeToRow[code] = i + 2;
      }
    }
  }

  var updated = 0;
  var toAppend = [];
  var seenAppend = {};

  for (var j = 0; j < booksList.length; j++) {
    var b = booksList[j];
    var key = String(b && b.code ? b.code : '').trim().toUpperCase();
    if (!key) continue;
    var rowValues = bookToRow_(b);
    if (codeToRow[key]) {
      sheet.getRange(codeToRow[key], 1, 1, BOOK_HEADERS.length).setValues([rowValues]);
      updated++;
    } else if (!seenAppend[key]) {
      seenAppend[key] = true;
      toAppend.push(rowValues);
    }
  }

  if (toAppend.length > 0) {
    var startRow = Math.max(sheet.getLastRow() + 1, 2);
    sheet.getRange(startRow, 1, toAppend.length, BOOK_HEADERS.length).setValues(toAppend);
  }

  return { updated: updated, appended: toAppend.length };
}

function appendTransactions_(ss, txList) {
  if (!txList || !txList.length) return { appended: 0 };
  var sheet = getOrCreateSheet_(ss, 'Transactions', TRANSACTION_HEADERS);
  var lastRow = sheet.getLastRow();
  var existingIds = {};

  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      var id = String(ids[i][0] || '').trim();
      if (id) existingIds[id] = true;
    }
  }

  var toAppend = [];
  for (var j = 0; j < txList.length; j++) {
    var t = txList[j];
    var txId = String(t && t.id ? t.id : '').trim();
    if (!txId || existingIds[txId]) continue;
    existingIds[txId] = true;
    toAppend.push(txToRow_(t));
  }

  if (toAppend.length > 0) {
    var startRow = Math.max(sheet.getLastRow() + 1, 2);
    sheet.getRange(startRow, 1, toAppend.length, TRANSACTION_HEADERS.length).setValues(toAppend);
  }

  return { appended: toAppend.length };
}

function saveSettings_(ss, settingsObj) {
  if (!settingsObj) return;
  var sheet = getOrCreateSheet_(ss, 'Settings', SETTINGS_HEADERS);
  var now = new Date().toISOString();
  var rows = [
    ['exchangeTerms', String(settingsObj.exchangeTerms || ''), now],
    ['categories', JSON.stringify(settingsObj.categories || []), now],
    ['memberTypes', JSON.stringify(settingsObj.memberTypes || []), now],
    ['participationHistoryOptions', JSON.stringify(settingsObj.participationHistoryOptions || []), now],
    ['visitFrequencyOptions', JSON.stringify(settingsObj.visitFrequencyOptions || []), now],
    ['showWelcomeShelf', String(Boolean(settingsObj.showWelcomeShelf)), now],
    ['deadStockThresholdDays', String(Number(settingsObj.deadStockThresholdDays) || 30), now]
  ];
  if (settingsObj.appsScriptUrl) {
    rows.push(['appsScriptUrl', String(settingsObj.appsScriptUrl).trim(), now]);
  }
  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).clearContent();
  }
  sheet.getRange(2, 1, rows.length, 3).setValues(rows);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return jsonOut_({ ok: true, service: 'BookSwap Apps Script Bridge', spreadsheetId: SPREADSHEET_ID });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) ? e.postData.contents : '{}');
    var action = body.action || '';
    var ss = getSpreadsheet_(body.spreadsheetId);

    if (action === 'ping') {
      var booksSheet = getOrCreateSheet_(ss, 'Books', BOOK_HEADERS);
      var txSheet = getOrCreateSheet_(ss, 'Transactions', TRANSACTION_HEADERS);
      return jsonOut_({
        ok: true,
        title: ss.getName(),
        spreadsheetId: ss.getId(),
        booksCount: Math.max(booksSheet.getLastRow() - 1, 0),
        transactionsCount: Math.max(txSheet.getLastRow() - 1, 0)
      });
    }

    if (action === 'record_transaction') {
      var booksToWrite = []
        .concat(Array.isArray(body.updatedBooks) ? body.updatedBooks : [])
        .concat(Array.isArray(body.addedBooks) ? body.addedBooks : []);
      var txRes = appendTransactions_(ss, Array.isArray(body.transactions) ? body.transactions : []);
      var bookRes = upsertBooks_(ss, booksToWrite);
      SpreadsheetApp.flush();
      return jsonOut_({ ok: true, transactions: txRes, books: bookRes });
    }

    if (action === 'upsert_books') {
      var upsertRes = upsertBooks_(ss, Array.isArray(body.books) ? body.books : []);
      SpreadsheetApp.flush();
      return jsonOut_({ ok: true, books: upsertRes });
    }

    if (action === 'sync_settings') {
      saveSettings_(ss, body.settings);
      SpreadsheetApp.flush();
      return jsonOut_({ ok: true });
    }

    if (action === 'sync_all') {
      var allBooksRes = upsertBooks_(ss, Array.isArray(body.books) ? body.books : []);
      var allTxRes = appendTransactions_(ss, Array.isArray(body.transactions) ? body.transactions : []);
      if (body.settings) {
        saveSettings_(ss, body.settings);
      }
      SpreadsheetApp.flush();
      return jsonOut_({ ok: true, books: allBooksRes, transactions: allTxRes });
    }

    return jsonOut_({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}
`;
}
