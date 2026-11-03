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
  // Write Books headers (A1:M1, 13 columns - no phone/email/ownerName for PDPA)
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Books!A1:M1?valueInputOption=USER_ENTERED`,
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

  // Write Transactions headers (A1:I1, 9 columns)
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A1:I1?valueInputOption=USER_ENTERED`,
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
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Books!A:M:append?valueInputOption=USER_ENTERED`,
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
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A:I:append?valueInputOption=USER_ENTERED`,
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

export async function fetchBooksFromSheet(
  accessToken: string | null | undefined,
  spreadsheetId: string
): Promise<Book[]> {
  let rows: any[][] = [];

  // 1. Try authenticated Google Sheets API v4 first if access token is available
  if (accessToken) {
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Books!A2:M2000`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        rows = data.values || [];
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
      rows = csvData.length > 1 ? csvData.slice(1) : [];
    } catch (csvErr: any) {
      console.error('Failed to fetch Books via public link:', csvErr);
      throw new Error(csvErr.message || 'Failed to fetch books from Google Sheets');
    }
  }

  return rows.map((r, idx) => ({
    id: `sheet-${r[0] || idx}`,
    code: r[0] || `L${idx + 1}`,
    title: r[1] || 'Untitled',
    category: r[2] || 'หนังสือทั่วไป',
    price: Number(r[3]) || 0,
    status: (r[4] as any) || 'Available',
    source: (r[5] as any) || 'Library',
    memberType: r[6] || undefined,
    driveFileId: r[7] || undefined,
    coverImage: r[8] || undefined,
    createdAt: r[9] || new Date().toISOString(),
    matchedAt: r[10] || undefined,
    matchedWithCode: r[11] || undefined,
    exchangeCount: Number(r[12]) || 1,
  }));
}

export async function fetchTransactionsFromSheet(
  accessToken: string | null | undefined,
  spreadsheetId: string
): Promise<TransactionRecord[]> {
  let rows: any[][] = [];

  // 1. Try authenticated Google Sheets API v4 if access token available
  if (accessToken) {
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A2:I2000`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        rows = data.values || [];
      }
    } catch (e) {
      console.warn('Authenticated Sheets API v4 transaction fetch non-fatal:', e);
    }
  }

  // 2. Fall back to public link fetch
  if (rows.length === 0) {
    try {
      const csvData = await fetchPublicSheetCSV(spreadsheetId, 'Transactions');
      rows = csvData.length > 1 ? csvData.slice(1) : [];
    } catch (csvErr: any) {
      console.error('Failed to fetch Transactions via public link:', csvErr);
      return [];
    }
  }

  return rows.map((r, idx) => ({
    id: r[0] || `tx-${idx + 1}`,
    timestamp: r[1] || new Date().toISOString(),
    participant: {
      participationHistory: r[2] || '',
      visitFrequencyThisYear: r[3] || '',
      memberType: r[4] || 'บุคคลทั่วไป/นักเรียน',
    },
    booksBrought: r[5] ? r[5].split(',').map((s: string) => s.trim()).filter(Boolean) : [],
    booksTaken: r[6] ? r[6].split(',').map((s: string) => s.trim()).filter(Boolean) : [],
    donatedCount: Number(r[7]) || 0,
    cancelledCount: Number(r[8]) || 0,
  }));
}

export async function syncAllBooksToSheet(
  accessToken: string,
  spreadsheetId: string,
  books: Book[]
): Promise<void> {
  // Clear and rewrite books tab header
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
  ]);

  if (rows.length === 0) return;

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Books!A2:M${rows.length + 1}?valueInputOption=USER_ENTERED`,
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
  ]);

  if (rows.length === 0) return;

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A2:I${rows.length + 1}?valueInputOption=USER_ENTERED`,
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
