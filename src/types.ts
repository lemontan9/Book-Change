export type BookStatus = 'Available' | 'Matched' | 'Donated' | 'Not Match';
export type BookSource = 'Library' | 'User';

export type MemberType =
  | 'CMU นักศึกษา'
  | 'CMU Staff'
  | 'CMU ศิษย์เก่า'
  | 'บุคคลทั่วไป/นักเรียน'
  | string;

export interface Book {
  id: string; // Internal unique ID
  code: string; // e.g. L1, L2, U101, U102
  title: string;
  category: string;
  price: number;
  isbn?: string;
  status: BookStatus;
  source: BookSource;
  transactionId?: string; // Associated transaction ID if brought in exchange
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  memberType?: string;
  coverImage?: string; // Base64 data URL or Google Drive Web link
  driveFileId?: string; // Google Drive file ID
  createdAt: string; // ISO date string
  matchedAt?: string;
  matchedWithCode?: string; // The code of the book this was exchanged for
  exchangeCount?: number; // How many times recirculated
}

export interface ParticipantInfo {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  memberType: MemberType;
  participationHistory: string; // การร่วมกิจกรรม (เช่น 'เคยเข้าร่วมกิจกรรมในปีที่ผ่านมา' | 'ปีนี้เป็นครั้งแรก')
  visitFrequencyThisYear: string; // ในปีนี้ ท่านมาร่วมกิจกรรมแล้วกี่ครั้ง (เช่น 'ครั้งที่ 1', 'ครั้งที่ 2', ...)
}

export interface KioskBookEntry {
  tempId: string;
  code: string; // Generated U code
  title: string;
  price?: number;
  isbn?: string;
  category: string;
  coverImage?: string;
  matchTargetCode?: string; // Code of book desired, or 'DONATION'
  isCancelled?: boolean; // If user chose to cancel this slot ('Not Match')
}

export interface TransactionRecord {
  id: string;
  timestamp: string;
  participant: ParticipantInfo;
  booksBrought: string[]; // Codes of books brought (U...)
  booksTaken: string[]; // Codes of books taken (L... or U...)
  donatedCount: number;
  cancelledCount: number;
  booksBroughtCount?: number; // จำนวนหนังสือที่นำมาร่วมกิจกรรมในรอบนี้
  booksTakenCount?: number; // จำนวนหนังสือที่รับกลับไปในรอบนี้
}

export interface StaffAccount {
  username: string;
  password?: string;
  name?: string;
  role: 'superadmin' | 'staff';
  createdAt: string;
}

export interface SystemSettings {
  categories: string[];
  exchangeTerms: string;
  memberTypes: string[];
  participationHistoryOptions: string[]; // ตัวเลือก 'การร่วมกิจกรรม' แก้ไขได้ใน backend
  visitFrequencyOptions: string[]; // ตัวเลือก 'ในปีนี้ ท่านมาร่วมกิจกรรมแล้วกี่ครั้ง' แก้ไขได้ใน backend
  showWelcomeShelf: boolean;
  deadStockThresholdDays: number;
  connectedSpreadsheetId?: string;
  connectedDriveFolderId?: string;
  lastSyncTime?: string;
}

export interface ExchangeChainNode {
  originalBookCode: string;
  title: string;
  category: string;
  chainLength: number;
  history: {
    code: string;
    title: string;
    date: string;
    action: string;
    userType?: string;
  }[];
}
