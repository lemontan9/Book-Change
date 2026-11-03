import type { Book, SystemSettings, TransactionRecord, StaffAccount } from '../types';
import { appendBookToSheet, appendTransactionToSheet, syncAllBooksToSheet } from './googleSheets';

const STORAGE_KEYS = {
  BOOKS: 'bookswap_books_v1',
  SETTINGS: 'bookswap_settings_v1',
  TRANSACTIONS: 'bookswap_transactions_v1',
  STAFF: 'bookswap_staff_v1',
  U_COUNTER: 'bookswap_u_counter_v1',
  L_COUNTER: 'bookswap_l_counter_v1',
  USED_CODES: 'bookswap_used_codes_v1',
};

export const ACTIVE_SPREADSHEET_ID = '1ppG2ExLSTl5pb1TS47pW2aNvqMVID8qvXwrB3_uOSm0';

export const INITIAL_SETTINGS: SystemSettings = {
  categories: [
    'หนังสือทั่วไป',
    'หนังสือเรียน',
    'หนังสือเยาวชน',
    'การ์ตูน',
    'เรื่องสั้น',
    'นวนิยาย',
  ],
  exchangeTerms: `1. หนังสือที่นำมาแลกต้องอยู่ในสภาพดี ไม่ฉีกขาด
2. สามารถแลกหนังสือได้ตามจำนวนที่นำมาเท่านั้น
3. หนังสือที่นำมาแลกแล้ว จะถือเป็นการส่งต่อให้ผู้อื่น ไม่สามารถขอคืนได้
4. หากรหัสหนังสือที่ท่านเลือกถูกผู้อื่นแลกไปแล้ว จะต้องเลือกรหัสใหม่
5. หนังสือที่ไม่ประสงค์จะแลกเปลี่ยน หรือแลกไม่ครบตามจำนวน สามารถระบุให้เป็น "หนังสือบริจาค" ได้`,
  memberTypes: [
    'CMU นักศึกษา',
    'CMU Staff',
    'CMU ศิษย์เก่า',
    'บุคคลทั่วไป/นักเรียน',
  ],
  participationHistoryOptions: [
    'เคยเข้าร่วมกิจกรรมในปีที่ผ่านมา',
    'ปีนี้เป็นครั้งแรก',
  ],
  visitFrequencyOptions: [
    'ครั้งที่ 1',
    'ครั้งที่ 2',
    'ครั้งที่ 3',
    'ครั้งที่ 4',
    'ครั้งที่ 5',
    'มากกว่า 5 ครั้ง',
  ],
  showWelcomeShelf: true,
  deadStockThresholdDays: 30,
  connectedSpreadsheetId: ACTIVE_SPREADSHEET_ID,
};

export const INITIAL_STAFF: StaffAccount[] = [
  {
    username: 'admin',
    password: 'admin',
    role: 'superadmin',
    createdAt: '2026-01-15T08:00:00.000Z',
  },
  {
    username: 'library_staff',
    password: '1234',
    role: 'staff',
    createdAt: '2026-02-01T09:00:00.000Z',
  },
];

// Seed initial catalog with real titles and historical turnover to demonstrate chain tracking
export const INITIAL_BOOKS: Book[] = [
  {
    id: 'b-l1',
    code: 'L1',
    title: 'Atomic Habits เพราะชีวิตดีได้กว่าที่เป็น',
    category: 'พัฒนาตนเอง/จิตวิทยา',
    price: 320,
    status: 'Matched',
    source: 'Library',
    createdAt: '2026-08-10T10:00:00.000Z',
    matchedAt: '2026-08-25T14:30:00.000Z',
    matchedWithCode: 'U1',
    exchangeCount: 5,
  },
  {
    id: 'b-l2',
    code: 'L2',
    title: 'The Great Gatsby (แด่รักและฝันร้าย)',
    category: 'นวนิยาย/วรรณกรรม',
    price: 280,
    status: 'Matched',
    source: 'Library',
    createdAt: '2026-08-12T11:00:00.000Z',
    matchedAt: '2026-09-02T16:00:00.000Z',
    matchedWithCode: 'U2',
    exchangeCount: 4,
  },
  {
    id: 'b-l3',
    code: 'L3',
    title: 'Sapiens ประวัติย่อมนุษยชาติ',
    category: 'หนังสือทั่วไป',
    price: 495,
    status: 'Available',
    source: 'Library',
    createdAt: '2026-09-10T09:30:00.000Z',
    exchangeCount: 2,
  },
  {
    id: 'b-l4',
    code: 'L4',
    title: 'เจ้าชายน้อย (The Little Prince)',
    category: 'หนังสือเยาวชน',
    price: 180,
    status: 'Available',
    source: 'Library',
    createdAt: '2026-09-15T13:00:00.000Z',
    exchangeCount: 3,
  },
  {
    id: 'b-l5',
    code: 'L5',
    title: 'ดาบพิฆาตอสูร เล่ม 1 (Kimetsu no Yaiba)',
    category: 'การ์ตูน/มังงะ',
    price: 95,
    status: 'Available',
    source: 'Library',
    createdAt: '2026-09-20T10:15:00.000Z',
    exchangeCount: 1,
  },
  {
    id: 'b-l6',
    code: 'L6',
    title: 'แคลคูลัส 1 สำหรับวิศวกรรมศาสตร์',
    category: 'หนังสือเรียน/วิชาการ',
    price: 350,
    status: 'Available',
    source: 'Library',
    createdAt: '2026-07-01T08:00:00.000Z', // Long on shelf for dead stock test
    exchangeCount: 1,
  },
  {
    id: 'b-l7',
    code: 'L7',
    title: 'ปาฏิหาริย์ร้านชำของคุณนามิยะ',
    category: 'นวนิยาย/วรรณกรรม',
    price: 295,
    status: 'Available',
    source: 'Library',
    createdAt: '2026-10-01T11:20:00.000Z',
    exchangeCount: 2,
  },
  {
    id: 'b-l8',
    code: 'L8',
    title: 'Thinking, Fast and Slow',
    category: 'พัฒนาตนเอง/จิตวิทยา',
    price: 450,
    status: 'Available',
    source: 'Library',
    createdAt: '2026-10-05T14:40:00.000Z',
    exchangeCount: 1,
  },
  {
    id: 'b-u1',
    code: 'U1',
    title: 'กล้าที่จะถูกเกลียด (Courage to be Disliked)',
    category: 'พัฒนาตนเอง/จิตวิทยา',
    price: 250,
    status: 'Available',
    source: 'User',
    memberType: 'CMU นักศึกษา',
    createdAt: '2026-08-25T14:30:00.000Z',
    exchangeCount: 3,
  },
  {
    id: 'b-u2',
    code: 'U2',
    title: 'หนึ่งร้อยปีแห่งความโดดเดี่ยว (One Hundred Years of Solitude)',
    category: 'นวนิยาย/วรรณกรรม',
    price: 395,
    status: 'Matched',
    source: 'User',
    memberType: 'CMU Staff',
    createdAt: '2026-09-02T16:00:00.000Z',
    matchedAt: '2026-09-18T10:15:00.000Z',
    matchedWithCode: 'L4',
    exchangeCount: 2,
  },
  {
    id: 'b-u3',
    code: 'U3',
    title: 'สไปเดอร์แมน รวมเล่มพิเศษ',
    category: 'การ์ตูน/มังงะ',
    price: 150,
    status: 'Available',
    source: 'User',
    memberType: 'บุคคลทั่วไป/นักเรียน',
    createdAt: '2026-10-12T09:00:00.000Z',
    exchangeCount: 1,
  },
  {
    id: 'b-u4',
    code: 'U4',
    title: 'ฟิสิกส์พื้นฐาน 1 (General Physics)',
    category: 'หนังสือเรียน/วิชาการ',
    price: 320,
    status: 'Available',
    source: 'User',
    memberType: 'CMU นักศึกษา',
    createdAt: '2026-10-18T15:20:00.000Z',
    exchangeCount: 1,
  },
];

export class StorageService {
  static getSettings(): SystemSettings {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS));
      return INITIAL_SETTINGS;
    }
    try {
      const parsed = JSON.parse(raw);
      const currentId = parsed.connectedSpreadsheetId?.trim();
      const connectedSpreadsheetId =
        !currentId || currentId.startsWith('172FuZL2')
          ? ACTIVE_SPREADSHEET_ID
          : currentId;

      const merged: SystemSettings = {
        ...INITIAL_SETTINGS,
        ...parsed,
        connectedSpreadsheetId,
        participationHistoryOptions:
          Array.isArray(parsed.participationHistoryOptions) && parsed.participationHistoryOptions.length > 0
            ? parsed.participationHistoryOptions
            : INITIAL_SETTINGS.participationHistoryOptions,
        visitFrequencyOptions:
          Array.isArray(parsed.visitFrequencyOptions) && parsed.visitFrequencyOptions.length > 0
            ? parsed.visitFrequencyOptions
            : INITIAL_SETTINGS.visitFrequencyOptions,
      };

      if (parsed.connectedSpreadsheetId !== connectedSpreadsheetId) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
      }
      return merged;
    } catch {
      return INITIAL_SETTINGS;
    }
  }

  static saveSettings(settings: SystemSettings): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  /**
   * Sorts books sequentially: Library books first (L1, L2, L3...), then User books (U1, U2, U3...)
   */
  static sortBooks(books: Book[]): Book[] {
    return [...books].sort((a, b) => {
      const aPrefix = a.code.charAt(0).toUpperCase();
      const bPrefix = b.code.charAt(0).toUpperCase();
      if (aPrefix !== bPrefix) {
        if (aPrefix === 'L') return -1;
        if (bPrefix === 'L') return 1;
        if (aPrefix === 'U') return -1;
        if (bPrefix === 'U') return 1;
        return aPrefix.localeCompare(bPrefix);
      }
      const aNum = parseInt(a.code.substring(1), 10);
      const bNum = parseInt(b.code.substring(1), 10);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      return a.code.localeCompare(b.code, undefined, { numeric: true });
    });
  }

  static getBooks(): Book[] {
    const raw = localStorage.getItem(STORAGE_KEYS.BOOKS);
    let books: Book[];
    if (!raw) {
      books = INITIAL_BOOKS;
      localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(this.sortBooks(INITIAL_BOOKS)));
    } else {
      try {
        books = JSON.parse(raw);
      } catch {
        books = INITIAL_BOOKS;
      }
    }
    // Strictly sanitize legacy data to ensure no phone, email, or name exists
    const cleaned = books.map((b) => {
      const copy = { ...b };
      delete copy.ownerPhone;
      delete copy.ownerEmail;
      delete copy.ownerName;
      return copy;
    });
    return this.sortBooks(cleaned);
  }

  /**
   * Retrieves all unique codes that have ever been allocated or used in the system.
   * This guarantees codes are never recycled, even if books are deleted or removed.
   */
  static getUsedCodesSet(): Set<string> {
    const raw = localStorage.getItem(STORAGE_KEYS.USED_CODES);
    const set = new Set<string>();

    // Seed initial baseline catalog codes (L1-L8, U1-U4)
    INITIAL_BOOKS.forEach((b) => {
      if (b.code) set.add(b.code.toUpperCase());
      if (b.matchedWithCode) set.add(b.matchedWithCode.toUpperCase());
    });

    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach((c) => {
            if (typeof c === 'string' && c.trim()) set.add(c.trim().toUpperCase());
          });
        }
      } catch {
        // ignore parse error
      }
    }

    // Include any active stored books
    try {
      const booksRaw = localStorage.getItem(STORAGE_KEYS.BOOKS);
      if (booksRaw) {
        const books = JSON.parse(booksRaw);
        if (Array.isArray(books)) {
          books.forEach((b: any) => {
            if (b?.code) set.add(String(b.code).trim().toUpperCase());
            if (b?.matchedWithCode) set.add(String(b.matchedWithCode).trim().toUpperCase());
          });
        }
      }
    } catch {
      // ignore
    }

    // Include historical transactions
    try {
      const txRaw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (txRaw) {
        const txs = JSON.parse(txRaw);
        if (Array.isArray(txs)) {
          txs.forEach((t: any) => {
            if (Array.isArray(t?.booksBrought)) {
              t.booksBrought.forEach((c: any) => set.add(String(c).trim().toUpperCase()));
            }
            if (Array.isArray(t?.booksTaken)) {
              t.booksTaken.forEach((c: any) => set.add(String(c).trim().toUpperCase()));
            }
          });
        }
      }
    } catch {
      // ignore
    }

    return set;
  }

  /**
   * Permanently marks a code as used in persistent storage so it can NEVER be reused again.
   * Monotonically increases the respective counter for L or U.
   */
  static registerUsedCode(code: string): void {
    if (!code) return;
    const clean = code.trim().toUpperCase();
    if (!clean || clean === 'DONATION') return;

    const set = this.getUsedCodesSet();
    set.add(clean);
    localStorage.setItem(STORAGE_KEYS.USED_CODES, JSON.stringify(Array.from(set)));

    // Update monotonic high-water mark counters so numbers never regress
    if (clean.startsWith('L')) {
      const num = parseInt(clean.substring(1), 10);
      if (!isNaN(num)) {
        const curr = parseInt(localStorage.getItem(STORAGE_KEYS.L_COUNTER) || '0', 10);
        if (num > curr) {
          localStorage.setItem(STORAGE_KEYS.L_COUNTER, num.toString());
        }
      }
    } else if (clean.startsWith('U')) {
      const num = parseInt(clean.substring(1), 10);
      if (!isNaN(num)) {
        const curr = parseInt(localStorage.getItem(STORAGE_KEYS.U_COUNTER) || '0', 10);
        if (num > curr) {
          localStorage.setItem(STORAGE_KEYS.U_COUNTER, num.toString());
        }
      }
    }
  }

  static registerUsedCodes(codes: string[]): void {
    codes.forEach((c) => this.registerUsedCode(c));
  }

  /**
   * Checks if a code has already been used in current or past system history
   */
  static isCodeUsed(code: string): boolean {
    if (!code) return false;
    const clean = code.trim().toUpperCase();
    return this.getUsedCodesSet().has(clean);
  }

  static saveBooks(books: Book[]): void {
    const sorted = this.sortBooks(books);
    localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(sorted));
    // Immediately register all saved book codes into the permanent non-recyclable registry
    sorted.forEach((b) => {
      if (b.code) this.registerUsedCode(b.code);
      if (b.matchedWithCode) this.registerUsedCode(b.matchedWithCode);
    });
  }

  static getStaff(): StaffAccount[] {
    const raw = localStorage.getItem(STORAGE_KEYS.STAFF);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(INITIAL_STAFF));
      return INITIAL_STAFF;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_STAFF;
    }
  }

  static saveStaff(staff: StaffAccount[]): void {
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staff));
  }

  static getTransactions(): TransactionRecord[] {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.map((t) => {
        const p = { ...t.participant };
        delete p.phone;
        delete p.email;
        delete p.firstName;
        delete p.lastName;
        delete p.fullName;
        return {
          ...t,
          participant: p,
        };
      });
    } catch {
      return [];
    }
  }

  static saveTransaction(t: TransactionRecord): void {
    const all = this.getTransactions();
    all.unshift(t);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(all));
    // Immediately register all involved codes permanently
    if (t.booksBrought) this.registerUsedCodes(t.booksBrought);
    if (t.booksTaken) this.registerUsedCodes(t.booksTaken);
  }

  /**
   * Generates next batch of strictly unique, non-reusable U codes for kiosk visitor.
   * Scans stored high-water mark, all historical codes, transactions, and active books.
   */
  static generateNextUCodes(count: number): string[] {
    const usedSet = this.getUsedCodesSet();
    const storedCounter = parseInt(localStorage.getItem(STORAGE_KEYS.U_COUNTER) || '0', 10);

    let maxU = storedCounter;
    usedSet.forEach((code) => {
      if (code.startsWith('U')) {
        const num = parseInt(code.substring(1), 10);
        if (!isNaN(num) && num > maxU) maxU = num;
      }
    });

    const codes: string[] = [];
    let candidate = maxU + 1;
    while (codes.length < count) {
      const code = `U${candidate}`;
      if (!usedSet.has(code)) {
        codes.push(code);
      }
      candidate++;
    }
    return codes;
  }

  /**
   * Commits U codes/counters permanently so they are never reused under any circumstances.
   */
  static commitUCounter(highestCodeOrList: string | string[]): void {
    if (Array.isArray(highestCodeOrList)) {
      this.registerUsedCodes(highestCodeOrList);
    } else if (typeof highestCodeOrList === 'string') {
      this.registerUsedCode(highestCodeOrList);
    }
  }

  static commitUCodes(codes: string[]): void {
    this.registerUsedCodes(codes);
  }

  /**
   * Computes the next single L code for central library.
   * Strictly guarantees the number has NEVER been used, avoiding duplication permanently.
   */
  static getNextLCode(): string {
    const usedSet = this.getUsedCodesSet();
    const storedCounter = parseInt(localStorage.getItem(STORAGE_KEYS.L_COUNTER) || '0', 10);

    let maxL = storedCounter;
    usedSet.forEach((code) => {
      if (code.startsWith('L')) {
        const num = parseInt(code.substring(1), 10);
        if (!isNaN(num) && num > maxL) maxL = num;
      }
    });

    let candidate = maxL + 1;
    while (usedSet.has(`L${candidate}`)) {
      candidate++;
    }
    return `L${candidate}`;
  }

  /**
   * Allocates and permanently locks the next L code in persistent storage.
   */
  static allocateNextLCode(): string {
    const code = this.getNextLCode();
    this.registerUsedCode(code);
    return code;
  }

  static commitLCode(code: string): void {
    this.registerUsedCode(code);
  }

  /**
   * Returns statistics about current book code sequences for both L and U
   */
  static getCodeStats() {
    const usedSet = this.getUsedCodesSet();
    let lCount = 0;
    let uCount = 0;
    usedSet.forEach((c) => {
      if (c.startsWith('L')) lCount++;
      else if (c.startsWith('U')) uCount++;
    });

    return {
      nextLCode: this.getNextLCode(),
      nextUCode: this.generateNextUCodes(1)[0] || 'U1',
      totalUsedCodes: usedSet.size,
      usedLCodesCount: lCount,
      usedUCodesCount: uCount,
    };
  }

  /**
   * Exports data to CSV/Excel (.xls compatible formatted text)
   */
  static exportBooksToExcel(books: Book[]): void {
    const headers = [
      'รหัสหนังสือ',
      'ชื่อเรื่อง',
      'หมวดหมู่',
      'ราคา (บาท)',
      'สถานะ',
      'แหล่งที่มา',
      'กลุ่มสมาชิกผู้แลก',
      'วันที่เพิ่มเข้าระบบ',
      'วันที่แลกเปลี่ยน',
      'แลกกับรหัส',
      'จำนวนรอบแลกเปลี่ยน',
      'รหัสธุรกรรม (TransactionId)',
      'ISBN',
    ];

    const rows = books.map((b) => [
      b.code,
      `"${b.title.replace(/"/g, '""')}"`,
      `"${b.category}"`,
      b.price,
      b.status,
      b.source === 'Library' ? 'ส่วนกลาง (L)' : 'ผู้เข้าร่วม (U)',
      b.memberType || '-',
      new Date(b.createdAt).toLocaleDateString('th-TH'),
      b.matchedAt ? new Date(b.matchedAt).toLocaleDateString('th-TH') : '-',
      b.matchedWithCode || '-',
      b.exchangeCount || 1,
      b.transactionId || '-',
      b.isbn || '-',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BookSwap_Library_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
