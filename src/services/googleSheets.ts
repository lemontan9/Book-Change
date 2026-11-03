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
];

export const TRANSACTION_HEADERS = [
  'TransactionId',
  'Timestamp',
  'ParticipationHistory',
  'VisitFrequencyThisYear',
  'MemberType',
  'BooksBrought',
  'BooksTaken',
  'DonatedCount',
  'CancelledCount',
  'BooksBroughtCount',
  'BooksTakenCount',
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
  // Write Books headers (A1:O1, 15 columns - includes TransactionId & ISBN, no phone/email for PDPA)
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Books!A1:O1?valueInputOption=USER_ENTERED`,
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

  // Write Transactions headers (A1:K1, 11 columns - includes BooksBroughtCount & BooksTakenCount)
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
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Books!A:O:append?valueInputOption=USER_ENTERED`,
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
  const broughtCount = t.booksBroughtCount !== undefined ? t.booksBroughtCount : t.booksBrought.length;
  const takenCount = t.booksTakenCount !== undefined ? t.booksTakenCount : t.booksTaken.length;

  const row = [
    t.id,
    t.timestamp,
    t.participant.participationHistory || '-',
    t.participant.visitFrequencyThisYear || '-',
    t.participant.memberType,
    t.booksBrought.join(', '),
    t.booksTaken.join(', '),
    t.donatedCount,
    t.cancelledCount,
    broughtCount,
    takenCount,
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

  defaultHeaders.forEach((name) => {
    const target = normalize(name);
    const foundIdx = normalizedHeaders.findIndex((h) => h === target);
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
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Books!A1:O2000`,
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

  return rows.map((r, idx) => ({
    id: `sheet-${r[col.Code] || idx}`,
    code: r[col.Code] || `L${idx + 1}`,
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
  }));
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

  return rows.map((r, idx) => {
    const broughtStr = r[col.BooksBrought] || '';
    const takenStr = r[col.BooksTaken] || '';
    const booksBrought = broughtStr ? broughtStr.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
    const booksTaken = takenStr ? takenStr.split(',').map((s: string) => s.trim()).filter(Boolean) : [];

    const broughtCountVal = r[col.BooksBroughtCount];
    const takenCountVal = r[col.BooksTakenCount];
    const booksBroughtCount = broughtCountVal !== undefined && broughtCountVal !== '' && !isNaN(Number(broughtCountVal))
      ? Number(broughtCountVal)
      : booksBrought.length;
    const booksTakenCount = takenCountVal !== undefined && takenCountVal !== '' && !isNaN(Number(takenCountVal))
      ? Number(takenCountVal)
      : booksTaken.length;

    return {
      id: r[col.TransactionId] || `tx-${idx + 1}`,
      timestamp: r[col.Timestamp] || new Date().toISOString(),
      participant: {
        participationHistory: r[col.ParticipationHistory] || '',
        visitFrequencyThisYear: r[col.VisitFrequencyThisYear] || '',
        memberType: r[col.MemberType] || 'บุคคลทั่วไป/นักเรียน',
      },
      booksBrought,
      booksTaken,
      donatedCount: Number(r[col.DonatedCount]) || 0,
      cancelledCount: Number(r[col.CancelledCount]) || 0,
      booksBroughtCount,
      booksTakenCount,
    };
  });
}

export async function syncAllBooksToSheet(
  accessToken: string,
  spreadsheetId: string,
  books: Book[]
): Promise<void> {
  // Clear and rewrite books tab header (A1:O1, 15 columns)
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

  const rows = books.map((b) => [
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
  ]);

  if (rows.length === 0) return;

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Books!A2:O${rows.length + 1}?valueInputOption=USER_ENTERED`,
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

  const rows = transactions.map((t) => [
    t.id,
    t.timestamp,
    t.participant.participationHistory || '-',
    t.participant.visitFrequencyThisYear || '-',
    t.participant.memberType,
    t.booksBrought.join(', '),
    t.booksTaken.join(', '),
    t.donatedCount,
    t.cancelledCount,
    t.booksBroughtCount !== undefined ? t.booksBroughtCount : t.booksBrought.length,
    t.booksTakenCount !== undefined ? t.booksTakenCount : t.booksTaken.length,
  ]);

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
