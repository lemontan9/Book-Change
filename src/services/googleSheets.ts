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
    book.coverImage || '',
    book.createdAt,
    book.matchedAt || '',
    book.matchedWithCode || '',
    book.exchangeCount || 1,
    book.transactionId || '',
    book.isbn || '',
    book.matchedTransactionId || '',
  ];

  await fetch(
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
  // 1. Try server-side proxy route first (no browser CORS restrictions)
  try {
    const proxyUrl = `/api/sheet-data?id=${encodeURIComponent(spreadsheetId)}&sheet=${encodeURIComponent(
      sheetName
    )}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const text = await res.text();
      if (text && !text.startsWith('<!DOCTYPE') && !text.includes('<html')) {
        const parsed = parseCSV(text);
        if (parsed.length > 0) {
          return parsed;
        }
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
    )}`;
    const res = await fetch(gvizUrl);
    if (res.ok) {
      const text = await res.text();
      if (!text.startsWith('<!DOCTYPE') && !text.includes('<html')) {
        const parsed = parseCSV(text);
        if (parsed.length > 0) return parsed;
      }
    }
  } catch (directErr) {
    console.warn('Direct gviz fetch failed:', directErr);
  }

  // 3. Direct fetch to Google export format=csv
  try {
    const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&sheet=${encodeURIComponent(
      sheetName
    )}`;
    const res = await fetch(exportUrl);
    if (res.ok) {
      const text = await res.text();
      if (!text.startsWith('<!DOCTYPE') && !text.includes('<html')) {
        const parsed = parseCSV(text);
        if (parsed.length > 0) return parsed;
      }
    }
  } catch (exportErr) {
    console.warn('Direct export fetch failed:', exportErr);
  }

  throw new Error(
    `ไม่สามารถเชื่อมต่อ Google Sheet (${sheetName}) ได้ โปรดตรวจสอบว่า Spreadsheet ID ถูกต้อง และตั้งค่าแชร์เป็น "Anyone with the link can edit/view"`
  );
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

  const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedHeaders = headerRow.map(normalize);

  const aliases: Record<string, string[]> = {
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

  // 1. Try authenticated Google Sheets API v4 first if access token is available
  if (accessToken) {
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Books!A1:P2000`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const allValues: any[][] = data.values || [];
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
  if (rows.length === 0) {
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
    const rawCode = (r[col.Code] || `L${idx + 1}`).trim().toUpperCase();
    if (seenCodes.has(rawCode)) {
      return; // Code is primary key (ห้ามซ้ำ)
    }
    seenCodes.add(rawCode);

    parsedBooks.push({
      id: `sheet-${rawCode}`,
      code: rawCode,
      title: r[col.Title] || 'Untitled',
      category: r[col.Category] || 'หนังสือทั่วไป',
      price: Number(r[col.Price]) || 0,
      status: (r[col.Status] as any) || 'Available',
      source: (r[col.Source] as any) || 'Library',
      memberType: r[col.MemberType] || undefined,
      driveFileId: r[col.DriveFileId] || undefined,
      coverImage: r[col.CoverImage] || undefined,
      createdAt: r[col.CreatedAt] || new Date().toISOString(),
      matchedAt: r[col.MatchedAt] || undefined,
      matchedWithCode: r[col.MatchedWithCode] || undefined,
      exchangeCount: Number(r[col.ExchangeCount]) || 1,
      transactionId: r[col.TransactionId] || undefined,
      isbn: r[col.ISBN] || undefined,
      matchedTransactionId: r[col.MatchedTransactionId] || undefined,
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

  // 1. Try authenticated Google Sheets API v4 if access token available
  if (accessToken) {
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A1:K2000`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const allValues: any[][] = data.values || [];
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
  if (rows.length === 0) {
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

  rows.forEach((r, idx) => {
    const rawId = (r[col.TransactionId] || `tx-${idx + 1}`).trim();
    if (seenTxIds.has(rawId)) {
      return; // TransactionId is primary key (ห้ามซ้ำ)
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
    b.coverImage || '',
    b.createdAt,
    b.matchedAt || '',
    b.matchedWithCode || '',
    b.exchangeCount || 1,
    b.transactionId || '',
    b.isbn || '',
    b.matchedTransactionId || '',
  ]);

  if (rows.length === 0) return;

  await fetch(
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
