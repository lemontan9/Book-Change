import type { Book, TransactionRecord, SystemSettings } from '../types';

export class SheetApiError extends Error {
  status: number;
  isAuthExpired: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SheetApiError';
    this.status = status;
    this.isAuthExpired = status === 401;
  }
}

async function assertSheetResponse(res: Response, actionLabel: string): Promise<void> {
  if (res.ok) return;
  const errText = await res.text().catch(() => '');
  if (res.status === 401) {
    throw new SheetApiError(
      'สิทธิ์การเชื่อมต่อ Google Sheet หมดอายุ (ครบ 1 ชั่วโมง) กรุณากดลงชื่อเข้าใช้ Google Mail ใหม่อีกครั้งเพื่อบันทึกข้อมูล',
      401
    );
  }
  if (res.status === 403) {
    throw new SheetApiError(
      `บัญชี Google นี้ไม่มีสิทธิ์แก้ไข (${actionLabel}) บน Google Sheet ที่ผูกไว้ กรุณาตรวจสอบสิทธิ์ Editor หรือติ๊กอนุญาตสิทธิ์ Google Sheets ให้ครบ`,
      403
    );
  }
  throw new SheetApiError(
    `ไม่สามารถ${actionLabel}บน Google Sheet ได้ (${res.status}): ${errText || res.statusText}`,
    res.status
  );
}

export const BOOK_HEADERS = [
  'Code',
  'Title',
  'Category',
  'Price',
  'Status',
  'Source',
  'MemberType',
  'DriveFileId',
  'CoverImage',
  'CreatedAt',
  'MatchedAt',
  'MatchedWithCode',
  'ExchangeCount',
  'TransactionId',
  'ISBN',
  'MatchedTransactionId',
];

export const TRANSACTION_HEADERS = [
  'TransactionId',
  'Timestamp',
  'ParticipationHistory',
  'VisitFrequencyThisYear',
  'MemberType',
  'TotalBroughtCount',
  'MatchedCount',
  'DonatedCount',
  'CancelledCount',
  'BooksBrought',
  'BooksTaken',
];

/**
 * Creates a brand new Google Spreadsheet with all required sheets & headers
 */
export async function createBookSwapSpreadsheet(accessToken: string): Promise<string> {
  const payload = {
    properties: {
      title: `BookSwap Library Database (${new Date().toLocaleDateString('th-TH')})`,
    },
    sheets: [
      { properties: { title: 'Books', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'Transactions', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'Settings', gridProperties: { frozenRowCount: 1 } } },
    ],
  };

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Failed to create Google Spreadsheet');
  }

  const data = await res.json();
  const spreadsheetId = data.spreadsheetId;

  // Initialize header rows
  await writeHeaders(accessToken, spreadsheetId);
  return spreadsheetId;
}

export async function writeHeaders(accessToken: string, spreadsheetId: string): Promise<void> {
  // Write Books headers (A1:P1, 16 columns - Code is primary key, includes MatchedTransactionId)
  const booksHeaderRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Books!A1:P1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [BOOK_HEADERS],
      }),
    }
  );
  await assertSheetResponse(booksHeaderRes, 'อัปเดตหัวตาราง Books');

  // Write Transactions headers (A1:K1, 11 columns - TransactionId is primary key, includes TotalBroughtCount, MatchedCount, DonatedCount, CancelledCount)
  const txHeaderRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A1:K1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [TRANSACTION_HEADERS],
      }),
    }
  );
  await assertSheetResponse(txHeaderRes, 'อัปเดตหัวตาราง Transactions');
}

function getSafeSheetCoverValue(book: Book): string {
  if (book.coverImage && !book.coverImage.startsWith('data:')) {
    return book.coverImage;
  }
  if (book.driveFileId) {
    return `https://drive.google.com/uc?export=view&id=${book.driveFileId}`;
  }
  if (book.coverImage && book.coverImage.length < 45000) {
    return book.coverImage;
  }
  return '';
}

export async function appendBookToSheet(
  accessToken: string,
  spreadsheetId: string,
  book: Book
): Promise<void> {
  const row = [
    book.code,
    book.title,
    book.category,
    book.price,
    book.status,
    book.source,
    book.memberType || '',
    book.driveFileId || '',
    getSafeSheetCoverValue(book),
    book.createdAt,
    book.matchedAt || '',
    book.matchedWithCode || '',
    book.exchangeCount || 1,
    book.transactionId || '',
    book.isbn || '',
    book.matchedTransactionId || '',
  ];

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Books!A:P:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [row],
      }),
    }
  );

  await assertSheetResponse(res, 'เพิ่มหนังสือในแท็บ Books');
}

export async function appendTransactionToSheet(
  accessToken: string,
  spreadsheetId: string,
  t: TransactionRecord
): Promise<void> {
  const totalBrought = t.totalBroughtCount !== undefined ? t.totalBroughtCount : (t.booksBroughtCount ?? (t.booksBrought.length + (t.cancelledCount || 0)));
  const matched = t.matchedCount !== undefined ? t.matchedCount : (t.booksTakenCount ?? t.booksTaken.length);

  const row = [
    t.id,
    t.timestamp,
    t.participant.participationHistory || '-',
    t.participant.visitFrequencyThisYear || '-',
    t.participant.memberType,
    totalBrought,
    matched,
    t.donatedCount,
    t.cancelledCount,
    t.booksBrought.join(', '),
    t.booksTaken.join(', '),
  ];

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A:K:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [row],
      }),
    }
  );

  await assertSheetResponse(res, 'บันทึกธุรกรรมในแท็บ Transactions');
}

/**
 * Robust CSV parser for Google Sheets gviz/tq export
 */
function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          cell += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(cell.trim());
        cell = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && nextChar === '\n') {
          i++; // skip \n
        }
        row.push(cell.trim());
        if (row.some((c) => c.length > 0)) {
          result.push(row);
        }
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((c) => c.length > 0)) {
      result.push(row);
    }
  }

  return result;
}

/**
 * Fetches public Google Spreadsheet data.
 * First calls the server proxy endpoint (/api/sheet-data) which bypasses browser CORS.
 * Falls back to direct client-side fetch if available.
 */
export async function fetchPublicSheetCSV(
  spreadsheetId: string,
  sheetName: string
): Promise<string[][]> {
  const cacheBuster = Date.now();

  // 1. Try server-side proxy route first (no browser CORS restrictions)
  try {
    const proxyUrl = `/api/sheet-data?id=${encodeURIComponent(spreadsheetId)}&sheet=${encodeURIComponent(
      sheetName
    )}&_t=${cacheBuster}`;
    const res = await fetch(proxyUrl, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      if (!text.startsWith('<!DOCTYPE') && !text.includes('<html')) {
        return parseCSV(text);
      }
    } else {
      const errJson = await res.json().catch(() => null);
      if (errJson?.error) {
        throw new Error(errJson.error);
      }
    }
  } catch (proxyErr: any) {
    if (proxyErr?.message && !proxyErr.message.includes('fetch')) {
      // Re-throw meaningful server errors (e.g. sheet permission warnings)
      throw proxyErr;
    }
    console.warn('Proxy fetch failed, attempting direct fetch:', proxyErr);
  }

  // 2. Direct fetch to Google gviz/tq export
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
      sheetName
    )}&_t=${cacheBuster}`;
    const res = await fetch(gvizUrl, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      if (!text.startsWith('<!DOCTYPE') && !text.includes('<html')) {
        return parseCSV(text);
      }
    }
  } catch (directErr) {
    console.warn('Direct gviz fetch failed:', directErr);
  }

  // 3. Direct fetch to Google export format=csv
  try {
    const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&sheet=${encodeURIComponent(
      sheetName
    )}&_t=${cacheBuster}`;
    const res = await fetch(exportUrl, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      if (!text.startsWith('<!DOCTYPE') && !text.includes('<html')) {
        return parseCSV(text);
      }
    }
  } catch (exportErr) {
    console.warn('Direct export fetch failed:', exportErr);
  }

  throw new Error(
    `ไม่สามารถเชื่อมต่อ Google Sheet (${sheetName}) ได้ โปรดตรวจสอบว่า Spreadsheet ID ถูกต้อง และตั้งค่าแชร์เป็น "Anyone with the link can edit/view"`
  );
}

function parseNumericPrice(raw: any): number {
  if (raw === undefined || raw === null) return 0;
  const cleaned = String(raw).replace(/,/g, '').replace(/[^0-9.-]/g, '').trim();
  if (!cleaned) return 0;
  const num = Number(cleaned);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

/**
 * Helper to dynamically map column positions from header names
 */
function getColumnIndexMap(headerRow: string[] | undefined, defaultHeaders: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  defaultHeaders.forEach((h, idx) => {
    map[h] = idx;
  });

  if (!headerRow || headerRow.length === 0) return map;

  const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/g, '');
  const normalizedHeaders = headerRow.map(normalize);

  const aliases: Record<string, string[]> = {
    Code: ['code', 'bookcode', 'รหัส', 'รหัสหนังสือ'],
    Title: ['title', 'booktitle', 'name', 'ชื่อเรื่อง', 'ชื่อหนังสือ'],
    Category: ['category', 'bookcategory', 'type', 'หมวดหมู่', 'ประเภทหนังสือ', 'ประเภท'],
    Price: ['price', 'bookprice', 'value', 'cost', 'ราคา', 'มูลค่า'],
    Status: ['status', 'สถานะ'],
    Source: ['source', 'ที่มา'],
    TotalBroughtCount: ['totalbroughtcount', 'booksbroughtcount', 'broughtcount', 'totalbrought'],
    MatchedCount: ['matchedcount', 'matchcount', 'bookstakencount', 'takencount'],
    MatchedTransactionId: ['matchedtransactionid', 'matchedtransaction', 'matchtransactionid', 'matchtxid'],
  };

  defaultHeaders.forEach((name) => {
    const target = normalize(name);
    let foundIdx = normalizedHeaders.findIndex((h) => h === target);
    if (foundIdx === -1 && aliases[name]) {
      foundIdx = normalizedHeaders.findIndex((h) => aliases[name].includes(h));
    }
    if (foundIdx !== -1) {
      map[name] = foundIdx;
    }
  });

  return map;
}

export async function fetchBooksFromSheet(
  accessToken: string | null | undefined,
  spreadsheetId: string
): Promise<Book[]> {
  let rows: any[][] = [];
  let headerRow: string[] | undefined;
  let fetchedSuccessfully = false;

  // 1. Try authenticated Google Sheets API v4 first if access token is available
  if (accessToken) {
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Books!A1:Z5000`,
        {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const allValues: any[][] = data.values || [];
        fetchedSuccessfully = true;
        if (allValues.length > 0) {
          headerRow = allValues[0];
          rows = allValues.slice(1);
        }
      }
    } catch (e) {
      console.warn('Authenticated Sheets API v4 fetch non-fatal, falling back to public link fetch:', e);
    }
  }

  // 2. If no token or API failed, fetch via public Google Sheet CSV endpoint (works for anyone with the link)
  if (!fetchedSuccessfully) {
    try {
      const csvData = await fetchPublicSheetCSV(spreadsheetId, 'Books');
      // Row 0 in CSV is headers ('Code', 'Title', ...), data starts from row 1
      if (csvData.length > 0) {
        headerRow = csvData[0];
        rows = csvData.length > 1 ? csvData.slice(1) : [];
      }
    } catch (csvErr: any) {
      console.error('Failed to fetch Books via public link:', csvErr);
      throw new Error(csvErr.message || 'Failed to fetch books from Google Sheets');
    }
  }

  const col = getColumnIndexMap(headerRow, BOOK_HEADERS);
  const seenCodes = new Set<string>();
  const parsedBooks: Book[] = [];

  rows.forEach((r, idx) => {
    const cellCode = String(r[col.Code] || '').trim();
    const cellTitle = String(r[col.Title] || '').trim();
    if (!cellCode && !cellTitle) {
      return; // Skip blank rows left after editing/deleting in Google Sheet
    }
    if (cellCode.toLowerCase() === 'code' && cellTitle.toLowerCase() === 'title') {
      return; // Skip duplicate header rows
    }

    const rawCode = (cellCode || `L${idx + 1}`).toUpperCase();
    if (seenCodes.has(rawCode)) {
      return; // Code is primary key (ห้ามซ้ำ)
    }
    seenCodes.add(rawCode);

    const rawStatus = String(r[col.Status] || '').trim();
    const rawSource = String(r[col.Source] || '').trim();

    parsedBooks.push({
      id: `sheet-${rawCode}`,
      code: rawCode,
      title: cellTitle || 'Untitled',
      category: String(r[col.Category] || '').trim() || 'หนังสือทั่วไป',
      price: parseNumericPrice(r[col.Price]),
      status: (rawStatus as any) || 'Available',
      source: (rawSource as any) || (rawCode.startsWith('U') ? 'User' : 'Library'),
      memberType: String(r[col.MemberType] || '').trim() || undefined,
      driveFileId: String(r[col.DriveFileId] || '').trim() || undefined,
      coverImage: String(r[col.CoverImage] || '').trim() || undefined,
      createdAt: String(r[col.CreatedAt] || '').trim() || new Date().toISOString(),
      matchedAt: String(r[col.MatchedAt] || '').trim() || undefined,
      matchedWithCode: String(r[col.MatchedWithCode] || '').trim() || undefined,
      exchangeCount: Number(r[col.ExchangeCount]) || 1,
      transactionId: String(r[col.TransactionId] || '').trim() || undefined,
      isbn: String(r[col.ISBN] || '').trim() || undefined,
      matchedTransactionId: String(r[col.MatchedTransactionId] || '').trim() || undefined,
    });
  });

  return parsedBooks;
}

export async function fetchTransactionsFromSheet(
  accessToken: string | null | undefined,
  spreadsheetId: string
): Promise<TransactionRecord[]> {
  let rows: any[][] = [];
  let headerRow: string[] | undefined;
  let fetchedSuccessfully = false;

  // 1. Try authenticated Google Sheets API v4 if access token available
  if (accessToken) {
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A1:K2000`,
        {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const allValues: any[][] = data.values || [];
        fetchedSuccessfully = true;
        if (allValues.length > 0) {
          headerRow = allValues[0];
          rows = allValues.slice(1);
        }
      }
    } catch (e) {
      console.warn('Authenticated Sheets API v4 transaction fetch non-fatal:', e);
    }
  }

  // 2. Fall back to public link fetch
  if (!fetchedSuccessfully) {
    try {
      const csvData = await fetchPublicSheetCSV(spreadsheetId, 'Transactions');
      if (csvData.length > 0) {
        headerRow = csvData[0];
        rows = csvData.length > 1 ? csvData.slice(1) : [];
      }
    } catch (csvErr: any) {
      console.error('Failed to fetch Transactions via public link:', csvErr);
      return [];
    }
  }

  const col = getColumnIndexMap(headerRow, TRANSACTION_HEADERS);
  const seenTxIds = new Set<string>();
  const parsedRecords: TransactionRecord[] = [];

  rows.forEach((r) => {
    const rawId = String(r[col.TransactionId] || '').trim();
    if (!rawId || rawId.toLowerCase() === 'transactionid' || seenTxIds.has(rawId)) {
      return; // Skip blank rows, header rows, or duplicate TransactionId
    }
    seenTxIds.add(rawId);

    const broughtStr = r[col.BooksBrought] || '';
    const takenStr = r[col.BooksTaken] || '';
    const booksBrought = broughtStr ? broughtStr.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
    const booksTaken = takenStr ? takenStr.split(',').map((s: string) => s.trim()).filter(Boolean) : [];

    const donatedCount = Number(r[col.DonatedCount]) || 0;
    const cancelledCount = Number(r[col.CancelledCount]) || 0;

    const matchedCountVal = r[col.MatchedCount];
    const matchedCount = matchedCountVal !== undefined && matchedCountVal !== '' && !isNaN(Number(matchedCountVal))
      ? Number(matchedCountVal)
      : booksTaken.length;

    const totalBroughtVal = r[col.TotalBroughtCount];
    const totalBroughtCount = totalBroughtVal !== undefined && totalBroughtVal !== '' && !isNaN(Number(totalBroughtVal))
      ? Number(totalBroughtVal)
      : (matchedCount + donatedCount + cancelledCount || booksBrought.length);

    parsedRecords.push({
      id: rawId,
      timestamp: r[col.Timestamp] || new Date().toISOString(),
      participant: {
        participationHistory: r[col.ParticipationHistory] || '',
        visitFrequencyThisYear: r[col.VisitFrequencyThisYear] || '',
        memberType: r[col.MemberType] || 'บุคคลทั่วไป/นักเรียน',
      },
      totalBroughtCount,
      matchedCount,
      donatedCount,
      cancelledCount,
      booksBrought,
      booksTaken,
      booksBroughtCount: totalBroughtCount,
      booksTakenCount: matchedCount,
    });
  });

  return parsedRecords;
}

export async function syncAllBooksToSheet(
  accessToken: string,
  spreadsheetId: string,
  books: Book[]
): Promise<void> {
  // Clear and rewrite books tab header (A1:P1, 16 columns)
  await writeHeaders(accessToken, spreadsheetId);

  // Clear existing rows in Books tab to prevent leftover ghost columns from previous versions
  const clearRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Books!A2:Z5000:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  await assertSheetResponse(clearRes, 'เตรียมพื้นที่อัปเดตแท็บ Books');

  // Deduplicate by Code (Primary Key of Books)
  const uniqueBooksMap = new Map<string, Book>();
  books.forEach((b) => {
    const key = (b.code || '').trim().toUpperCase();
    if (key && !uniqueBooksMap.has(key)) {
      uniqueBooksMap.set(key, b);
    }
  });

  const rows = Array.from(uniqueBooksMap.values()).map((b) => [
    b.code,
    b.title,
    b.category,
    b.price,
    b.status,
    b.source,
    b.memberType || '',
    b.driveFileId || '',
    getSafeSheetCoverValue(b),
    b.createdAt,
    b.matchedAt || '',
    b.matchedWithCode || '',
    b.exchangeCount || 1,
    b.transactionId || '',
    b.isbn || '',
    b.matchedTransactionId || '',
  ]);

  if (rows.length === 0) return;

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Books!A2:P${rows.length + 1}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  await assertSheetResponse(res, 'อัปเดตข้อมูลหนังสือในแท็บ Books');
}

export async function syncAllTransactionsToSheet(
  accessToken: string,
  spreadsheetId: string,
  transactions: TransactionRecord[]
): Promise<void> {
  // Ensure headers exist first
  const txHeaderRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A1:K1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [TRANSACTION_HEADERS],
      }),
    }
  );
  await assertSheetResponse(txHeaderRes, 'อัปเดตหัวตาราง Transactions');

  // Clear existing rows in Transactions tab
  const clearRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A2:Z5000:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  await assertSheetResponse(clearRes, 'เตรียมพื้นที่อัปเดตแท็บ Transactions');

  // Deduplicate transactions by TransactionId (Primary key of Transactions - ห้ามซ้ำ)
  const uniqueTxMap = new Map<string, TransactionRecord>();
  transactions.forEach((t) => {
    const key = (t.id || '').trim();
    if (key && !uniqueTxMap.has(key)) {
      uniqueTxMap.set(key, t);
    }
  });

  const rows = Array.from(uniqueTxMap.values()).map((t) => {
    const totalBrought = t.totalBroughtCount !== undefined
      ? t.totalBroughtCount
      : (t.booksBroughtCount ?? (t.booksBrought.length + (t.cancelledCount || 0)));
    const matched = t.matchedCount !== undefined
      ? t.matchedCount
      : (t.booksTakenCount ?? t.booksTaken.length);

    return [
      t.id,
      t.timestamp,
      t.participant.participationHistory || '-',
      t.participant.visitFrequencyThisYear || '-',
      t.participant.memberType,
      totalBrought,
      matched,
      t.donatedCount,
      t.cancelledCount,
      t.booksBrought.join(', '),
      t.booksTaken.join(', '),
    ];
  });

  if (rows.length === 0) return;

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A2:K${rows.length + 1}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  await assertSheetResponse(res, 'อัปเดตประวัติการแลกในแท็บ Transactions');
}

export const SETTINGS_HEADERS = ['Key', 'Value', 'UpdatedAt'];

function parseStringListSetting(raw: string): string[] | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.map((v) => String(v ?? '').trim()).filter(Boolean);
        return cleaned.length > 0 ? cleaned : null;
      }
    } catch {
      // Fallback to newline split
    }
  }
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : null;
}

/**
 * Fetches system settings from the "Settings" tab in Google Sheet.
 * Returns null if the Settings tab is empty or has no recognized keys.
 */
export async function fetchSettingsFromSheet(
  accessToken: string | null | undefined,
  spreadsheetId: string
): Promise<Partial<SystemSettings> | null> {
  let rows: any[][] = [];

  if (accessToken) {
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
          spreadsheetId
        )}/values/Settings!A1:C100`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        rows = data.values || [];
      }
    } catch (e) {
      console.warn('Authenticated Settings sheet fetch failed, trying public CSV:', e);
    }
  }

  if (rows.length === 0) {
    try {
      rows = await fetchPublicSheetCSV(spreadsheetId, 'Settings');
    } catch (e) {
      console.warn('Public Settings sheet fetch failed (non-fatal):', e);
      return null;
    }
  }

  if (!rows || rows.length === 0) return null;

  const firstCell = String(rows[0]?.[0] || '').trim().toLowerCase();
  const dataRows = firstCell === 'key' || firstCell === 'setting' ? rows.slice(1) : rows;
  if (dataRows.length === 0) return null;

  const patch: Partial<SystemSettings> = {};
  let hasAnyKey = false;

  dataRows.forEach((row) => {
    const key = String(row?.[0] || '').trim();
    const rawVal = row?.[1] !== undefined && row?.[1] !== null ? String(row[1]) : '';
    if (!key) return;

    switch (key) {
      case 'categories': {
        const list = parseStringListSetting(rawVal);
        if (list) {
          patch.categories = list;
          hasAnyKey = true;
        }
        break;
      }
      case 'exchangeTerms': {
        if (rawVal.trim().length > 0) {
          patch.exchangeTerms = rawVal;
          hasAnyKey = true;
        }
        break;
      }
      case 'memberTypes': {
        const list = parseStringListSetting(rawVal);
        if (list) {
          patch.memberTypes = list;
          hasAnyKey = true;
        }
        break;
      }
      case 'participationHistoryOptions': {
        const list = parseStringListSetting(rawVal);
        if (list) {
          patch.participationHistoryOptions = list;
          hasAnyKey = true;
        }
        break;
      }
      case 'visitFrequencyOptions': {
        const list = parseStringListSetting(rawVal);
        if (list) {
          patch.visitFrequencyOptions = list;
          hasAnyKey = true;
        }
        break;
      }
      case 'showWelcomeShelf': {
        const lower = rawVal.trim().toLowerCase();
        if (lower === 'true' || lower === 'false') {
          patch.showWelcomeShelf = lower === 'true';
          hasAnyKey = true;
        }
        break;
      }
      case 'deadStockThresholdDays': {
        const num = Number(rawVal.trim());
        if (Number.isFinite(num) && num > 0) {
          patch.deadStockThresholdDays = Math.round(num);
          hasAnyKey = true;
        }
        break;
      }
      default:
        break;
    }
  });

  return hasAnyKey ? patch : null;
}

/**
 * Syncs system settings to the "Settings" tab in Google Sheet so all devices and Vercel deployments share identical settings.
 */
export async function syncSettingsToSheet(
  accessToken: string,
  spreadsheetId: string,
  settings: SystemSettings
): Promise<void> {
  const now = new Date().toISOString();

  // Write headers (A1:C1)
  const headerRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/Settings!A1:C1?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [SETTINGS_HEADERS],
      }),
    }
  );

  if (!headerRes.ok) {
    const errText = await headerRes.text().catch(() => '');
    throw new Error(
      `ไม่สามารถบันทึกการตั้งค่าลงแท็บ Settings ได้ (${headerRes.status}): ${errText || headerRes.statusText}`
    );
  }

  // Clear existing setting rows
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/Settings!A2:C100:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (e) {
    console.warn('Clear settings sheet range non-fatal:', e);
  }

  const rows: string[][] = [
    ['exchangeTerms', settings.exchangeTerms || '', now],
    ['categories', JSON.stringify(settings.categories || []), now],
    ['memberTypes', JSON.stringify(settings.memberTypes || []), now],
    ['participationHistoryOptions', JSON.stringify(settings.participationHistoryOptions || []), now],
    ['visitFrequencyOptions', JSON.stringify(settings.visitFrequencyOptions || []), now],
    ['showWelcomeShelf', String(Boolean(settings.showWelcomeShelf)), now],
    ['deadStockThresholdDays', String(Number(settings.deadStockThresholdDays) || 30), now],
  ];

  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/Settings!A2:C${rows.length + 1}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  if (!writeRes.ok) {
    const errText = await writeRes.text().catch(() => '');
    throw new Error(
      `ไม่สามารถซิงค์การตั้งค่าลง Google Sheet ได้ (${writeRes.status}): ${errText || writeRes.statusText}`
    );
  }
}
