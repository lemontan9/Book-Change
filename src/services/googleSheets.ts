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

export async function fetchBooksFromSheet(
  accessToken: string,
  spreadsheetId: string
): Promise<Book[]> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Books!A2:M500`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    throw new Error('Failed to fetch books from Google Sheets');
  }

  const data = await res.json();
  const rows: any[][] = data.values || [];

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
