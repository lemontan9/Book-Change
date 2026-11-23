import type { Book, TransactionRecord, SystemSettings } from '../types';

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
  await fetch(
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

  // Write Transactions headers (A1:K1, 11 columns - TransactionId is primary key, includes TotalBroughtCount, MatchedCount, DonatedCount, CancelledCount)
  await fetch(
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

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`ไม่สามารถบันทึกหนังสือลง Google Sheet ได้ (${res.status}): ${errText || res.statusText}`);
  }
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

  await fetch(
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
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Books!A2:Z1000:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (e) {
    console.warn('Clear books sheet range non-fatal:', e);
  }

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

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`ไม่สามารถอัปเดต Google Sheet ได้ (${res.status}): ${errText || res.statusText}`);
  }
}

export async function syncAllTransactionsToSheet(
  accessToken: string,
  spreadsheetId: string,
  transactions: TransactionRecord[]
): Promise<void> {
  // Clear existing rows in Transactions tab
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A2:Z1000:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (e) {
    console.warn('Clear transactions sheet range non-fatal:', e);
  }

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

  await fetch(
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
}
