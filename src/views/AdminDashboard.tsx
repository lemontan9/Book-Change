import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RefreshCw,
  ExternalLink,
  BookOpen,
  Users,
  Repeat,
  Layers,
  BookMarked,
  Hash,
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import type { Book, SystemSettings, TransactionRecord } from '../types';
import {
  fetchBooksFromSheet,
  fetchTransactionsFromSheet,
  syncAllBooksToSheet,
  syncAllTransactionsToSheet,
} from '../services/googleSheets';
import { StorageService } from '../services/storage';
import { getAccessToken, ALLOWED_GOOGLE_ADMIN_EMAIL } from '../services/firebaseAuth';

interface AdminDashboardProps {
  books: Book[];
  settings: SystemSettings;
  transactions: TransactionRecord[];
  googleConnected?: boolean;
  onConnectGoogle?: () => void;
  onSelectTab?: (tab: 'kiosk' | 'dashboard' | 'books' | 'settings') => void;
  onOpenAddBook?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  books,
  transactions,
  settings,
  googleConnected,
  onConnectGoogle,
  onSelectTab,
  onOpenAddBook,
}) => {
  const spreadsheetId =
    (settings.connectedSpreadsheetId && !settings.connectedSpreadsheetId.startsWith('172FuZL2')
      ? settings.connectedSpreadsheetId.trim()
      : '') || '1ppG2ExLSTl5pb1TS47pW2aNvqMVID8qvXwrB3_uOSm0';

  // Real Google Sheets data states (with fallback to local storage if network is offline)
  const [sheetBooks, setSheetBooks] = useState<Book[]>(books || []);
  const [sheetTransactions, setSheetTransactions] = useState<TransactionRecord[]>(transactions || []);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [isFetched, setIsFetched] = useState<boolean>(false);
  const [isUsingFallback, setIsUsingFallback] = useState<boolean>(false);
  const [unsyncedBooksList, setUnsyncedBooksList] = useState<Book[]>([]);
  const [unsyncedTxList, setUnsyncedTxList] = useState<TransactionRecord[]>([]);
  const [isDismissedUnsynced, setIsDismissedUnsynced] = useState<boolean>(false);

  // Fetch real data from Google Spreadsheet with Smart Merge of local items
  const loadDataFromGoogleSheet = useCallback(async () => {
    if (!spreadsheetId) {
      setSheetBooks(books || []);
      setSheetTransactions(transactions || []);
      setIsFetched(true);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const token = await getAccessToken().catch(() => null);

      // Fetch Books and Transactions sheets concurrently without requiring Google login
      const [fetchedBooks, fetchedTransactions] = await Promise.all([
        fetchBooksFromSheet(token, spreadsheetId),
        fetchTransactionsFromSheet(token, spreadsheetId).catch(() => []),
      ]);

      // Smart Merge: Google Sheet + Local System Database
      // Books or transactions added locally (e.g. U10, U11, U12, U13) that are not yet on Google Sheet
      // are seamlessly merged into Dashboard metrics
      const mergedBooksMap = new Map<string, Book>();
      fetchedBooks.forEach((b) => {
        if (b.code) mergedBooksMap.set(b.code.toUpperCase(), b);
      });

      const localBooks = books && books.length > 0 ? books : StorageService.getBooks();
      const localTx = transactions && transactions.length > 0 ? transactions : StorageService.getTransactions();

      const pendingBooks: Book[] = [];
      localBooks.forEach((b) => {
        const key = b.code?.toUpperCase();
        if (!key) return;
        if (!mergedBooksMap.has(key)) {
          mergedBooksMap.set(key, b);
          pendingBooks.push(b);
        } else {
          // If local book has Matched status while sheet still has Available, use local match
          const existing = mergedBooksMap.get(key)!;
          if (b.status === 'Matched' && existing.status !== 'Matched') {
            mergedBooksMap.set(key, {
              ...existing,
              status: 'Matched',
              matchedAt: b.matchedAt,
              matchedWithCode: b.matchedWithCode,
            });
          }
        }
      });

      const mergedTransactionsMap = new Map<string, TransactionRecord>();
      fetchedTransactions.forEach((t) => {
        if (t.id) mergedTransactionsMap.set(t.id, t);
      });

      const pendingTx: TransactionRecord[] = [];
      localTx.forEach((t) => {
        if (t.id && !mergedTransactionsMap.has(t.id)) {
          mergedTransactionsMap.set(t.id, t);
          pendingTx.push(t);
        }
      });

      const finalBooks = Array.from(mergedBooksMap.values());
      const finalTransactions = Array.from(mergedTransactionsMap.values());

      setSheetBooks(finalBooks);
      setSheetTransactions(finalTransactions);
      setUnsyncedBooksList(pendingBooks);
      setUnsyncedTxList(pendingTx);

      // If Google token is active and there are pending items, automatically push them to Google Sheet!
      if (token && (pendingBooks.length > 0 || pendingTx.length > 0)) {
        try {
          await syncAllBooksToSheet(token, spreadsheetId, finalBooks);
          await syncAllTransactionsToSheet(token, spreadsheetId, finalTransactions);
          setUnsyncedBooksList([]);
          setUnsyncedTxList([]);
          setSyncNotice({
            type: 'success',
            text: `ระบบทำการซิงค์หนังสือใหม่ ${pendingBooks.length} เล่ม และธุรกรรม ${pendingTx.length} รายการขึ้น Google Sheet อัตโนมัติเรียบร้อย!`,
          });
        } catch (autoSyncErr) {
          console.warn('Background auto-push non-fatal:', autoSyncErr);
        }
      }

      setIsUsingFallback(false);
      setLastFetchedAt(
        new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setErrorMsg(null);
      setIsFetched(true);
    } catch (err: any) {
      console.warn('Failed to load Dashboard data from Google Sheet, using system local cache:', err);
      // Gracefully fall back to local system database
      const fallbackBooks = books && books.length > 0 ? books : StorageService.getBooks();
      const fallbackTx = transactions && transactions.length > 0 ? transactions : StorageService.getTransactions();
      setSheetBooks(fallbackBooks);
      setSheetTransactions(fallbackTx);
      setIsUsingFallback(true);
      setErrorMsg(
        err.message ||
          'ไม่สามารถดึงข้อมูลสดจาก Google Sheet ได้ โปรดตรวจสอบว่า Spreadsheet เปิดสิทธิ์แชร์เป็น "Anyone with the link can edit/view" หรือตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'
      );
      setIsFetched(true);
    } finally {
      setIsLoading(false);
    }
  }, [spreadsheetId, books, transactions]);

  const handleManualSyncToGoogleSheet = async () => {
    setIsSyncing(true);
    setSyncNotice(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        if (onConnectGoogle) {
          onConnectGoogle();
        }
        setSyncNotice({
          type: 'info',
          text: `กรุณาลงชื่อเข้าใช้ด้วย Google บัญชี ${ALLOWED_GOOGLE_ADMIN_EMAIL} เพื่ออนุญาตให้ระบบส่งข้อมูลขึ้น Google Sheet`,
        });
        return;
      }

      const allLocalBooks = books && books.length > 0 ? books : StorageService.getBooks();
      const allLocalTx = transactions && transactions.length > 0 ? transactions : StorageService.getTransactions();

      await syncAllBooksToSheet(token, spreadsheetId, allLocalBooks);
      await syncAllTransactionsToSheet(token, spreadsheetId, allLocalTx);

      setSyncNotice({
        type: 'success',
        text: `ซิงค์ข้อมูลหนังสือทั้งหมด (${allLocalBooks.length} เล่ม) และธุรกรรม (${allLocalTx.length} รายการ) ขึ้น Google Sheet สำเร็จเรียบร้อย!`,
      });
      setUnsyncedBooksList([]);
      setUnsyncedTxList([]);

      // Reload fresh data from sheet
      await loadDataFromGoogleSheet();
    } catch (err: any) {
      console.error('Manual sync error:', err);
      setSyncNotice({
        type: 'error',
        text: `เกิดข้อผิดพลาดในการซิงค์: ${err.message || 'โปรดตรวจสอบการเชื่อมต่อ'}`,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Load from Google Sheet automatically on mount or when spreadsheetId changes
  useEffect(() => {
    loadDataFromGoogleSheet();
  }, [loadDataFromGoogleSheet]);

  // 1. Metric Counts strictly from Google Sheet
  // Map distinct transactions by Transaction ID (Count Distinct)
  const distinctTransactionMap = useMemo(() => {
    const map = new Map<string, TransactionRecord>();
    sheetTransactions.forEach((t) => {
      const rawId = (t.id || '').trim();
      if (rawId) {
        if (!map.has(rawId)) {
          map.set(rawId, t);
        }
      }
    });
    return map;
  }, [sheetTransactions]);

  // Distinct count of transaction ID (Count Distinct)
  const totalParticipants = distinctTransactionMap.size || sheetTransactions.length;
  const totalBooksCount = sheetBooks.length;
  const availableBooksCount = sheetBooks.filter((b) => b.status === 'Available').length;

  const matchedLCount = sheetBooks.filter(
    (b) => b.status === 'Matched' && (b.code.toUpperCase().startsWith('L') || b.source === 'Library')
  ).length;

  const matchedUCount = sheetBooks.filter(
    (b) => b.status === 'Matched' && (b.code.toUpperCase().startsWith('U') || b.source === 'User')
  ).length;

  // Statistics of books brought per transaction
  const booksPerTransactionStats = useMemo(() => {
    const buckets = {
      one: 0, // 1 เล่ม
      two: 0, // 2 เล่ม
      three: 0, // 3 เล่ม
      fourPlus: 0, // 4 เล่มขึ้นไป
    };

    let totalBrought = 0;
    const list = Array.from(distinctTransactionMap.values());
    const totalTx = list.length;

    list.forEach((t) => {
      const count =
        t.totalBroughtCount !== undefined
          ? t.totalBroughtCount
          : (t.booksBroughtCount ?? (Array.isArray(t.booksBrought) ? t.booksBrought.length : 0));
      totalBrought += count;
      if (count === 1) {
        buckets.one++;
      } else if (count === 2) {
        buckets.two++;
      } else if (count === 3) {
        buckets.three++;
      } else if (count >= 4) {
        buckets.fourPlus++;
      }
    });

    const avgPerTx = totalTx > 0 ? (totalBrought / totalTx).toFixed(1) : '0';

    return {
      totalTx,
      totalBrought,
      avgPerTx,
      buckets: [
        {
          label: 'นำมา 1 เล่ม',
          count: buckets.one,
          percentage: totalTx > 0 ? Math.round((buckets.one / totalTx) * 100) : 0,
          color: '#9ED8EB',
        },
        {
          label: 'นำมา 2 เล่ม',
          count: buckets.two,
          percentage: totalTx > 0 ? Math.round((buckets.two / totalTx) * 100) : 0,
          color: '#7CA992',
        },
        {
          label: 'นำมา 3 เล่ม',
          count: buckets.three,
          percentage: totalTx > 0 ? Math.round((buckets.three / totalTx) * 100) : 0,
          color: '#FFB7A5',
        },
        {
          label: 'นำมา 4 เล่มขึ้นไป',
          count: buckets.fourPlus,
          percentage: totalTx > 0 ? Math.round((buckets.fourPlus / totalTx) * 100) : 0,
          color: '#B4A7D6',
        },
      ],
      recentTransactions: list.slice(0, 8).map((t) => {
        const totalBrought =
          t.totalBroughtCount !== undefined
            ? t.totalBroughtCount
            : (t.booksBroughtCount ?? (Array.isArray(t.booksBrought) ? t.booksBrought.length : 0));
        const matched =
          t.matchedCount !== undefined
            ? t.matchedCount
            : (t.booksTakenCount ?? (Array.isArray(t.booksTaken) ? t.booksTaken.length : 0));

        return {
          id: t.id,
          timestamp: t.timestamp,
          memberType: t.participant.memberType,
          totalBroughtCount: totalBrought,
          matchedCount: matched,
          donatedCount: t.donatedCount || 0,
          cancelledCount: t.cancelledCount || 0,
          broughtCodes: t.booksBrought || [],
          takenCodes: t.booksTaken || [],
        };
      }),
    };
  }, [distinctTransactionMap]);

  // 2. Bar Chart Data (Category breakdown of Available books strictly from Google Sheet)
  const categoryBarData = useMemo(() => {
    const availableBooks = sheetBooks.filter((b) => b.status === 'Available');
    const countsMap = new Map<string, number>();

    // Seed configured categories
    const baseCats = settings.categories && settings.categories.length > 0
      ? settings.categories
      : ['หนังสือทั่วไป', 'หนังสือเรียน/วิชาการ', 'วรรณกรรมเยาวชน', 'การ์ตูน/มังงะ', 'เรื่องสั้น/รวมเรื่อง', 'นวนิยาย/วรรณกรรม'];

    baseCats.forEach((cat) => countsMap.set(cat, 0));

    // Count actual available books from sheet
    availableBooks.forEach((b) => {
      const cat = b.category || 'หนังสือทั่วไป';
      countsMap.set(cat, (countsMap.get(cat) || 0) + 1);
    });

    const colors = ['#9ED8EB', '#FFB7A5', '#A8E6CF', '#7CA992', '#B4A7D6', '#FFE58F', '#D7CCC8', '#CFD8DC'];

    const result = Array.from(countsMap.entries()).map(([fullLabel, count], idx) => {
      // Shorten label for axis
      const shortLabel = fullLabel.replace(/\/.*$/, '').replace('หนังสือ', '').trim() || fullLabel.slice(0, 6);
      return {
        fullLabel,
        label: shortLabel,
        value: count,
        color: colors[idx % colors.length],
      };
    });

    return result;
  }, [sheetBooks, settings.categories]);

  // Dynamic Y-axis scale based on actual maximum value
  const maxCategoryVal = Math.max(0, ...categoryBarData.map((d) => d.value));
  const maxY = maxCategoryVal > 0 ? (maxCategoryVal <= 5 ? 5 : Math.ceil(maxCategoryVal / 5) * 5) : 5;
  const yTicks = [
    maxY,
    Math.round(maxY * 0.75),
    Math.round(maxY * 0.5),
    Math.round(maxY * 0.25),
    0,
  ];

  // 3. Member Type Distribution (Strictly from sheetTransactions participants)
  const memberTypeStats = useMemo(() => {
    const total = sheetTransactions.length;
    const counts = {
      students: 0, // CMU นักศึกษา
      general: 0, // บุคคลทั่วไป/นักเรียน
      staff: 0, // CMU Staff
      alumni: 0, // CMU ศิษย์เก่า
    };

    sheetTransactions.forEach((t) => {
      const m = t.participant.memberType || '';
      if (m.includes('นักศึกษา')) {
        counts.students++;
      } else if (m.includes('Staff') || m.includes('บุคลากร')) {
        counts.staff++;
      } else if (m.includes('ศิษย์เก่า')) {
        counts.alumni++;
      } else {
        counts.general++;
      }
    });

    const pStudents = total > 0 ? counts.students / total : 0;
    const pGeneral = total > 0 ? counts.general / total : 0;
    const pStaff = total > 0 ? counts.staff / total : 0;
    const pAlumni = total > 0 ? counts.alumni / total : 0;

    const r = 46;
    const c = 2 * Math.PI * r; // ~289.02

    const sStudents = pStudents * c;
    const sGeneral = pGeneral * c;
    const sStaff = pStaff * c;
    const sAlumni = pAlumni * c;

    return {
      total,
      counts,
      percentages: {
        students: Math.round(pStudents * 100),
        general: Math.round(pGeneral * 100),
        staff: Math.round(pStaff * 100),
        alumni: Math.round(pAlumni * 100),
      },
      donut: {
        r,
        c,
        sStudents,
        sGeneral,
        sStaff,
        sAlumni,
        offsetStudents: 0,
        offsetGeneral: -sStudents,
        offsetStaff: -(sStudents + sGeneral),
        offsetAlumni: -(sStudents + sGeneral + sStaff),
      },
    };
  }, [sheetTransactions]);

  // 4. Exchange Frequency Counts strictly from Google Sheet books exchangeCount
  const chainFrequency = useMemo(() => {
    const c2 = sheetBooks.filter((b) => b.exchangeCount === 2).length;
    const c3 = sheetBooks.filter((b) => b.exchangeCount === 3).length;
    const c4 = sheetBooks.filter((b) => b.exchangeCount === 4).length;
    const c5plus = sheetBooks.filter((b) => (b.exchangeCount || 1) >= 5).length;

    return [
      { label: '2 ครั้ง', count: c2 },
      { label: '3 ครั้ง', count: c3 },
      { label: '4 ครั้ง', count: c4 },
      { label: '5 ครั้งขึ้นไป', count: c5plus },
    ];
  }, [sheetBooks]);

  // 5. Longest Chain: Books with highest exchangeCount in Google Sheet
  const longestChainList = useMemo(() => {
    const circulated = sheetBooks
      .filter((b) => (b.exchangeCount || 1) >= 2)
      .sort((a, b) => (b.exchangeCount || 1) - (a.exchangeCount || 1))
      .slice(0, 5);

    return circulated.map((b, idx) => ({
      step: idx + 1,
      title: b.title,
      code: b.code,
      count: b.exchangeCount || 1,
    }));
  }, [sheetBooks]);

  return (
    <div className="pb-24 pt-3 max-w-5xl mx-auto px-4 min-h-[calc(100vh-8rem)] font-sans space-y-4">
      {/* 1. Top Header Card */}
      <div className="bg-[#FAF5EE] border border-[#EADBCC] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-[0_4px_24px_rgba(122,75,48,0.04)]">
        <h1 className="text-lg sm:text-xl font-bold text-[#263238] tracking-tight">
          ระบบแลกเปลี่ยนหนังสือ สำนักหอสมุด
        </h1>
        <p className="text-xs text-[#8A7E74] font-medium mt-1">
          ส่วนการจัดการสำหรับเจ้าหน้าที่ (Admin)
        </p>
      </div>

      {/* 2. Sub-header Navigation Pill Bar + Action Button */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Navigation Tabs Pill */}
        <div className="bg-white/95 border border-[#EADBCC] rounded-2xl p-1 flex items-center shadow-xs">
          <button
            type="button"
            onClick={() => onSelectTab?.('dashboard')}
            className="bg-[#2A3B4C] text-white px-5 py-2 rounded-xl text-xs sm:text-sm font-medium shadow-xs transition-colors cursor-pointer"
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => onSelectTab?.('books')}
            className="text-[#4D4D4D] hover:text-[#2A3B4C] px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer"
          >
            Book List
          </button>
          <button
            type="button"
            onClick={() => onSelectTab?.('settings')}
            className="text-[#4D4D4D] hover:text-[#2A3B4C] px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer"
          >
            ตั้งค่าระบบ
          </button>
        </div>

        {/* Action Button: เพิ่มหนังสือ */}
        <button
          type="button"
          onClick={() => {
            if (onOpenAddBook) {
              onOpenAddBook();
            } else if (onSelectTab) {
              onSelectTab('books');
            }
          }}
          className="bg-[#2A3B4C] hover:bg-[#1E2B38] active:scale-[0.98] text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-medium shadow-xs transition-all cursor-pointer tracking-tight"
        >
          เพิ่มหนังสือ
        </button>
      </div>

      {/* 3. Action Buttons: Open Google Sheet & Refresh */}
      <div className="flex items-center justify-end gap-2.5 flex-wrap">

        {spreadsheetId && (
          <a
            href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
            target="_blank"
            rel="noreferrer"
            className="py-2 px-3.5 rounded-xl border border-[#EADBCC] bg-white hover:bg-[#F5F7FA] text-xs font-medium text-[#4D4D4D] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="เปิดดูไฟล์ Google Sheet บน Google Drive"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#717171]" />
            <span>เปิดดู Google Sheet</span>
          </a>
        )}

        <button
          type="button"
          disabled={isLoading || !spreadsheetId}
          onClick={loadDataFromGoogleSheet}
          className="py-2 px-4 rounded-xl bg-[#2A3B4C] hover:bg-[#1E2B38] disabled:opacity-50 text-white text-xs font-medium flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'กำลังดึงข้อมูลสด...' : 'รีเฟรชข้อมูล'}</span>
        </button>
      </div>

      {/* Unsynced Items Notification Banner (เฉพาะเมื่อ Super Admin เข้าสู่ระบบ เพื่อป้องกันความสับสนสำหรับเจ้าหน้าที่ทั่วไป) */}
      {googleConnected && !isDismissedUnsynced && unsyncedBooksList.length > 0 && (
        <div className="bg-[#FFF8E1] border border-[#FFE082] rounded-2xl p-3.5 text-xs text-[#8D6E63] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#F57C00] shrink-0" />
            <span>
              <strong className="text-[#E65100]">มีข้อมูลใหม่ในระบบที่ยังไม่ได้ส่งขึ้น Google Sheet:</strong> หนังสือ {unsyncedBooksList.length} เล่ม ({unsyncedBooksList.map((b) => b.code).join(', ')})
              {unsyncedTxList.length > 0 && ` และธุรกรรม ${unsyncedTxList.length} รายการ`}
              <span className="text-[#6D4C41] block sm:inline sm:ml-1">
                (ข้อมูลรวมแสดงใน Dashboard ให้เรียบร้อยแล้ว)
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleManualSyncToGoogleSheet}
              className="bg-[#2A3B4C] hover:bg-[#1E2B38] text-white px-3 py-1.5 rounded-xl font-medium text-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>ซิงค์ขึ้น Sheet ทันที</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDismissedUnsynced(true)}
              className="text-[#8D6E63] hover:text-[#5D4037] p-1 cursor-pointer font-bold"
              title="ปิดการแจ้งเตือนนี้"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Sync Status Feedback Toast */}
      {syncNotice && (
        <div
          className={`p-3 rounded-2xl text-xs flex items-center gap-2 shadow-xs ${
            syncNotice.type === 'success'
              ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#4CAF4F]/30'
              : syncNotice.type === 'info'
              ? 'bg-[#EBF3FB] text-[#1E5C8B] border border-[#BBD8F5]'
              : 'bg-[#FFEBEE] text-[#D32F2F] border border-[#FFCDD2]'
          }`}
        >
          {syncNotice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2E7D32]" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span className="flex-1">{syncNotice.text}</span>
          <button
            type="button"
            onClick={() => setSyncNotice(null)}
            className="text-xs opacity-60 hover:opacity-100 cursor-pointer ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* 4. Three Metric Banner Cards (Computed 100% from Google Sheet) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Sky Blue Card: ผู้เข้าร่วมกิจกรรมทั้งหมด (Count Distinct Transaction ID) */}
        <div
          style={{ minHeight: '94px' }}
          className="bg-[#9ED8EB] border border-white/60 rounded-2xl sm:rounded-3xl p-4 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-[#1F4B5B]">
              ผู้เข้าร่วมกิจกรรมทั้งหมด
            </span>
            <Users className="w-4 h-4 text-[#1F4B5B]/60" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-[#184E60] tracking-tight">
              {totalParticipants.toLocaleString()}
              <span className="text-xs font-normal text-[#1F4B5B] ml-2">คน (Distinct Transaction)</span>
            </div>
            <div className="text-[11px] text-[#1F4B5B]/85 font-medium mt-0.5">
              รวมนำหนังสือมา {booksPerTransactionStats.totalBrought} เล่ม (เฉลี่ย {booksPerTransactionStats.avgPerTx} เล่ม/ครั้ง)
            </div>
          </div>
        </div>

        {/* Coral Pink Card: หนังสือที่ถูกเพิ่มในระบบ */}
        <div
          style={{ minHeight: '94px' }}
          className="bg-[#FFB7A5] border border-white/60 rounded-2xl sm:rounded-3xl p-4 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-[#8B3A2B]">
              หนังสือที่ถูกเพิ่มในระบบ
            </span>
            <BookOpen className="w-4 h-4 text-[#8B3A2B]/60" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#883122] tracking-tight">
            {totalBooksCount.toLocaleString()}
            <span className="text-xs font-normal text-[#8B3A2B] ml-2">เล่ม</span>
          </div>
        </div>

        {/* Sage Green Card: หนังสือคงเหลือ (Available) */}
        <div
          style={{ minHeight: '94px' }}
          className="bg-[#7CA992] border border-white/60 rounded-2xl sm:rounded-3xl p-4 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-[#143B2B]">
              หนังสือคงเหลือ (Available)
            </span>
            <Layers className="w-4 h-4 text-[#143B2B]/60" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#0F3524] tracking-tight">
            {availableBooksCount.toLocaleString()}
            <span className="text-xs font-normal text-[#143B2B] ml-2">เล่ม</span>
          </div>
        </div>
      </div>

      {/* 5. Middle Section (2 Columns: Left Chart, Right 2 Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left Column: หมวดหมู่หนังสือที่คงเหลือ (Bar Chart strictly from Google Sheet) */}
        <div className="lg:col-span-7 bg-[#FAF5EE] border border-[#EADBCC] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-[#263238] font-bold text-sm sm:text-base">
                หมวดหมู่หนังสือที่คงเหลือ
              </h2>
              <p className="text-[10px] text-[#8A7E74]">
                ข้อมูลจริงจากคอลัมน์ Category และ Status ใน Google Sheet
              </p>
            </div>
            <span className="text-[11px] text-[#717171] font-mono bg-[#EFE5D6] px-2.5 py-1 rounded-lg">
              รวม {availableBooksCount.toLocaleString()} เล่ม
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-end pt-4 min-h-[300px]">
            {availableBooksCount === 0 && isFetched ? (
              <div className="h-56 flex flex-col items-center justify-center text-center p-4">
                <BookOpen className="w-8 h-8 text-[#B0A396] mb-2 opacity-50" />
                <p className="text-xs font-medium text-[#717171]">
                  ยังไม่มีหนังสือสถานะ Available ใน Google Sheet
                </p>
                <p className="text-[11px] text-[#8A7E74] mt-1">
                  เมื่อมีการเพิ่มหนังสือ หรือซิงค์ข้อมูลจาก Kiosk สถิติจะปรากฏที่นี่
                </p>
              </div>
            ) : (
              <div className="relative pt-6">
                {/* Plot Frame (Y-axis + Bars) */}
                <div className="relative h-56 sm:h-60 flex">
                  {/* Y Axis Column: aligns with grid lines */}
                  <div className="relative w-10 h-full select-none pr-2">
                    {yTicks.map((tick, i) => {
                      const topPct = (i / (yTicks.length - 1)) * 100;
                      return (
                        <span
                          key={i}
                          style={{ top: `${topPct}%` }}
                          className="absolute right-2 -translate-y-1/2 text-[11px] text-[#717171] font-mono leading-none"
                        >
                          {tick}
                        </span>
                      );
                    })}
                  </div>

                  {/* Plot Area */}
                  <div className="relative flex-1 h-full border-l border-b border-[#D8CABE]">
                    {/* Horizontal dotted grid lines */}
                    {yTicks.map((tick, i) => {
                      const topPct = (i / (yTicks.length - 1)) * 100;
                      if (i === yTicks.length - 1) return null; // Baseline is border-b
                      return (
                        <div
                          key={i}
                          style={{ top: `${topPct}%` }}
                          className="absolute left-0 right-0 border-t border-dashed border-[#E5DDD2] pointer-events-none"
                        />
                      );
                    })}

                    {/* Bars Container */}
                    <div className="absolute inset-0 flex items-end justify-around px-2 sm:px-4">
                      {categoryBarData.map((item) => {
                        const barHeightPercent =
                          maxY > 0 ? Math.min(100, Math.max(0, (item.value / maxY) * 100)) : 0;

                        return (
                          <div
                            key={item.fullLabel}
                            className="relative flex flex-col items-center justify-end h-full w-8 sm:w-10 group"
                            title={`${item.fullLabel}: ${item.value} เล่ม`}
                          >
                            {/* The Bar */}
                            <div
                              className="w-full relative rounded-t-lg sm:rounded-t-xl transition-all duration-500 shadow-xs group-hover:brightness-95"
                              style={{
                                height: `${Math.max(barHeightPercent, item.value > 0 ? 4 : 0)}%`,
                                backgroundColor: item.color,
                              }}
                            >
                              {/* Value Label floating above */}
                              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] sm:text-[11px] font-bold text-[#4D4D4D] font-mono whitespace-nowrap transition-transform group-hover:scale-110">
                                {item.value}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* X Axis Labels */}
                <div className="flex justify-around pl-10 pr-2 pt-2.5 text-xs text-[#4D4D4D] font-medium">
                  {categoryBarData.map((item) => (
                    <span
                      key={item.fullLabel}
                      title={item.fullLabel}
                      className="w-10 sm:w-12 text-center truncate text-[11px]"
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: 2 Stacked Cards */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Top Card: สถิติการแลกออก */}
          <div className="bg-[#FAF5EE] border border-[#EADBCC] rounded-2xl sm:rounded-3xl p-5 shadow-xs space-y-3">
            <div>
              <h3 className="text-[#263238] font-bold text-sm sm:text-base">
                สถิติการแลกออก
              </h3>
              <p className="text-[10px] text-[#8A7E74]">
                จำนวนหนังสือสถานะ Matched ใน Google Sheet
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="bg-white/90 border border-[#EADBCC]/60 rounded-xl px-4 py-3 flex items-center justify-between shadow-xs">
                <span className="text-xs text-[#4D4D4D] font-medium">
                  หนังสือส่วนกลาง (L)
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#263238] font-mono">
                  {matchedLCount.toLocaleString()} เล่ม
                </span>
              </div>

              <div className="bg-white/90 border border-[#EADBCC]/60 rounded-xl px-4 py-3 flex items-center justify-between shadow-xs">
                <span className="text-xs text-[#4D4D4D] font-medium">
                  หนังสือจากผู้เข้าร่วม (U)
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#263238] font-mono">
                  {matchedUCount.toLocaleString()} เล่ม
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Card: ประเภทสมาชิก */}
          <div className="bg-[#FAF5EE] border border-[#EADBCC] rounded-2xl sm:rounded-3xl p-5 shadow-xs flex-1 flex flex-col justify-between">
            <div>
              <h3 className="text-[#263238] font-bold text-sm sm:text-base">
                ประเภทสมาชิก
              </h3>
              <p className="text-[10px] text-[#8A7E74]">
                สัดส่วนจากคอลัมน์ MemberType ในตาราง Transactions
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 py-2 flex-wrap sm:flex-nowrap">
              {/* Donut Chart */}
              <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center shrink-0 mx-auto sm:mx-0">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 120 120">
                  {/* Background Track */}
                  <circle
                    cx="60"
                    cy="60"
                    r={memberTypeStats.donut.r}
                    fill="none"
                    stroke="#F1E7D9"
                    strokeWidth="14"
                  />

                  {memberTypeStats.total > 0 && (
                    <>
                      {/* 1. CMU นักศึกษา (Sky Blue) */}
                      {memberTypeStats.donut.sStudents > 0 && (
                        <circle
                          cx="60"
                          cy="60"
                          r={memberTypeStats.donut.r}
                          fill="none"
                          stroke="#9ED8EB"
                          strokeWidth="14"
                          strokeDasharray={`${memberTypeStats.donut.sStudents} ${memberTypeStats.donut.c}`}
                          strokeDashoffset={memberTypeStats.donut.offsetStudents}
                        />
                      )}

                      {/* 2. บุคคลทั่วไป (Lavender) */}
                      {memberTypeStats.donut.sGeneral > 0 && (
                        <circle
                          cx="60"
                          cy="60"
                          r={memberTypeStats.donut.r}
                          fill="none"
                          stroke="#B4A7D6"
                          strokeWidth="14"
                          strokeDasharray={`${memberTypeStats.donut.sGeneral} ${memberTypeStats.donut.c}`}
                          strokeDashoffset={memberTypeStats.donut.offsetGeneral}
                        />
                      )}

                      {/* 3. CMU Staff (Coral Pink) */}
                      {memberTypeStats.donut.sStaff > 0 && (
                        <circle
                          cx="60"
                          cy="60"
                          r={memberTypeStats.donut.r}
                          fill="none"
                          stroke="#FFB7A5"
                          strokeWidth="14"
                          strokeDasharray={`${memberTypeStats.donut.sStaff} ${memberTypeStats.donut.c}`}
                          strokeDashoffset={memberTypeStats.donut.offsetStaff}
                        />
                      )}

                      {/* 4. CMU ศิษย์เก่า (Sage Green) */}
                      {memberTypeStats.donut.sAlumni > 0 && (
                        <circle
                          cx="60"
                          cy="60"
                          r={memberTypeStats.donut.r}
                          fill="none"
                          stroke="#7CA992"
                          strokeWidth="14"
                          strokeDasharray={`${memberTypeStats.donut.sAlumni} ${memberTypeStats.donut.c}`}
                          strokeDashoffset={memberTypeStats.donut.offsetAlumni}
                        />
                      )}
                    </>
                  )}
                </svg>

                {/* Center Label inside Donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-bold text-[#263238] font-mono">
                    {memberTypeStats.total}
                  </span>
                  <span className="text-[9px] text-[#717171]">คน</span>
                </div>
              </div>

              {/* Legend Items */}
              <div className="space-y-2 text-xs text-[#4D4D4D] pr-1 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#9ED8EB] shrink-0" />
                    <span className="font-medium text-[11px] text-[#263238] truncate">
                      CMU นักศึกษา
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-[#1F4B5B] font-mono shrink-0">
                    {memberTypeStats.percentages.students}% ({memberTypeStats.counts.students})
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#B4A7D6] shrink-0" />
                    <span className="font-medium text-[11px] text-[#263238] truncate">
                      บุคคลทั่วไป/นักเรียน
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-[#553C7B] font-mono shrink-0">
                    {memberTypeStats.percentages.general}% ({memberTypeStats.counts.general})
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FFB7A5] shrink-0" />
                    <span className="font-medium text-[11px] text-[#263238] truncate">
                      CMU Staff
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-[#883122] font-mono shrink-0">
                    {memberTypeStats.percentages.staff}% ({memberTypeStats.counts.staff})
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#7CA992] shrink-0" />
                    <span className="font-medium text-[11px] text-[#263238] truncate">
                      CMU ศิษย์เก่า
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-[#143B2B] font-mono shrink-0">
                    {memberTypeStats.percentages.alumni}% ({memberTypeStats.counts.alumni})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. NEW: สถิติจำนวนหนังสือที่นำมาร่วมกิจกรรม ต่อครั้งการแลก (Books Brought per Transaction) */}
      <div className="bg-[#FAF5EE] border border-[#EADBCC] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[#263238] font-bold text-sm sm:text-base">
                สถิติจำนวนหนังสือที่นำมาร่วมกิจกรรม ต่อครั้งการแลก
              </h2>
              <span className="text-[11px] font-medium bg-[#E8F5E9] text-[#2E7D32] px-2.5 py-0.5 rounded-full border border-[#4CAF4F]/20">
                Transaction Count
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-[#8A7E74] mt-0.5">
              วิเคราะห์จำนวนเล่มที่ผู้เข้าร่วมแต่ละคนนำมาร่วมกิจกรรมในแต่ละธุรกรรม (นับจาก Transaction ID)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold bg-white/95 text-[#1F4B5B] border border-[#EADBCC] px-3 py-1 rounded-xl shadow-xs font-mono">
              เฉลี่ย {booksPerTransactionStats.avgPerTx} เล่ม/ครั้ง
            </span>
            <span className="text-xs font-semibold bg-[#2A3B4C] text-white px-3 py-1 rounded-xl shadow-xs font-mono">
              รวม {booksPerTransactionStats.totalBrought} เล่ม ({booksPerTransactionStats.totalTx} ธุรกรรม)
            </span>
          </div>
        </div>

        {/* 4 Distribution Bucket Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {booksPerTransactionStats.buckets.map((b) => (
            <div
              key={b.label}
              className="bg-white/95 border border-[#EADBCC]/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all hover:border-[#7A4B30]/30"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#4D4D4D]">{b.label}</span>
                <span
                  className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${b.color}35`, color: '#263238' }}
                >
                  {b.percentage}%
                </span>
              </div>

              <div className="my-2.5 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-bold text-[#263238] font-mono tracking-tight">
                  {b.count}
                </span>
                <span className="text-xs text-[#8A7E74]">ครั้งการแลก</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#EFE5D6] h-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(b.percentage, b.count > 0 ? 5 : 0)}%`,
                    backgroundColor: b.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Recent Transactions Breakdown Table */}
        {booksPerTransactionStats.recentTransactions.length > 0 ? (
          <div className="mt-2 pt-3 border-t border-[#EADBCC]/60">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold text-[#263238] flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-[#7A4B30]" />
                รายการ Transaction ล่าสุด (แยกตามจำนวนเล่มที่นำมาร่วม)
              </h3>
              <span className="text-[10px] text-[#8A7E74]">
                ข้อมูลจริงจาก Google Sheet
              </span>
            </div>

            <div className="space-y-2">
              {booksPerTransactionStats.recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-white/90 border border-[#EADBCC]/70 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs flex-wrap gap-2 shadow-2xs hover:border-[#D8CABE] transition-colors"
                >
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono font-bold text-xs text-[#2A3B4C] bg-[#F5F7FA] px-2.5 py-1 rounded-lg border border-[#E8ECF2]">
                      {tx.id}
                    </span>
                    <span className="text-[#332D29] font-medium text-xs">
                      {tx.memberType}
                    </span>
                    {tx.timestamp && (
                      <span className="text-[10px] text-[#8A7E74]">
                        • {new Date(tx.timestamp).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* นำมา X เล่ม */}
                    <span className="inline-flex items-center gap-1 font-semibold bg-[#E8F5E9] text-[#2E7D32] border border-[#4CAF4F]/25 px-2.5 py-1 rounded-lg text-xs" title={`รหัสหนังสือที่นำมา: ${tx.broughtCodes.join(', ') || '-'}`}>
                      <BookOpen className="w-3 h-3 shrink-0" />
                      นำมา {tx.totalBroughtCount} เล่ม {tx.broughtCodes.length > 0 && `(${tx.broughtCodes.join(', ')})`}
                    </span>

                    {/* Match count */}
                    <span className="inline-flex items-center font-semibold bg-[#E3F2FD] text-[#1565C0] border border-[#90CAF9]/40 px-2 py-0.5 rounded-lg text-[11px]" title="จำนวนที่จับคู่สำเร็จ">
                      Match = {tx.matchedCount}
                    </span>

                    {/* Donate count */}
                    {tx.donatedCount > 0 && (
                      <span className="inline-flex items-center font-medium bg-[#FFF3E0] text-[#E65100] border border-[#FFE082]/60 px-2 py-0.5 rounded-lg text-[11px]" title="บริจาค">
                        Donate = {tx.donatedCount}
                      </span>
                    )}

                    {/* Cancelled count */}
                    {tx.cancelledCount > 0 && (
                      <span className="inline-flex items-center font-medium bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]/60 px-2 py-0.5 rounded-lg text-[11px]" title="ยกเลิกการจับคู่">
                        Cancelled = {tx.cancelledCount}
                      </span>
                    )}

                    {/* Books taken from central */}
                    {tx.takenCodes.length > 0 && (
                      <span className="text-[11px] bg-[#FAF5EE] text-[#7A4B30] border border-[#EADBCC] px-2 py-0.5 rounded-lg font-medium" title="หนังสือส่วนกลางที่หยิบไป">
                        แลกออก: <span className="font-mono font-bold text-[#502F1D]">{tx.takenCodes.join(', ')}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-[#8A7E74] bg-white/50 rounded-xl border border-dashed border-[#EADBCC]">
            ยังไม่มีข้อมูล Transaction ในระบบ เมื่อมีผู้เข้าร่วมกิจกรรมนำหนังสือมาแลก ข้อมูลจะปรากฏที่นี่โดยอัตโนมัติ
          </div>
        )}
      </div>

      {/* 6. Bottom Card: สถิติความถี่การส่งต่อหนังสือ (Exchange Chains strictly from Google Sheet) */}
      <div className="bg-[#FAF5EE] border border-[#EADBCC] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-[#263238] font-bold text-sm sm:text-base">
              สถิติความถี่การส่งต่อหนังสือ (Exchange Chains)
            </h2>
            <p className="text-[10px] text-[#8A7E74]">
              คำนวณจากคอลัมน์ ExchangeCount ในตาราง Books จาก Google Sheet
            </p>
          </div>
          <span className="text-[11px] text-[#2E7D32] bg-[#E8F5E9] px-2.5 py-1 rounded-lg border border-[#4CAF4F]/20 font-medium">
            ข้อมูลจาก Sheet เท่านั้น
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Left Sub-column: จำนวนครั้งที่เกิดการแลกเปลี่ยนต่อเนื่อง */}
          <div>
            <h3 className="text-xs font-semibold text-[#263238] mb-3 flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5 text-[#4CAF4F]" />
              จำนวนครั้งที่เกิดการแลกเปลี่ยนต่อเนื่อง
            </h3>

            <div className="space-y-2.5">
              {chainFrequency.map((item) => (
                <div
                  key={item.label}
                  className="bg-white/85 border border-[#EADBCC]/60 rounded-xl px-4 py-3 flex items-center justify-between shadow-xs"
                >
                  <span className="text-xs font-medium text-[#332D29]">
                    {item.label}
                  </span>
                  <span
                    className={`font-medium text-xs px-3.5 py-1 rounded-full shadow-xs ${
                      item.count > 0
                        ? 'bg-[#6B9F87] text-white'
                        : 'bg-[#E0E0E0] text-[#717171]'
                    }`}
                  >
                    {item.count} การส่งต่อ
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Sub-column: เส้นทางที่มีการส่งต่อสูงสุด (Longest Chain) */}
          <div>
            <h3 className="text-xs font-semibold text-[#263238] mb-3 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#4CAF4F]" />
              เล่มที่มีการส่งต่อสูงสุดใน Google Sheet
            </h3>

            {longestChainList.length === 0 ? (
              <div className="bg-white/85 border border-[#EADBCC]/60 rounded-xl p-5 text-center">
                <p className="text-xs text-[#717171] font-medium">
                  ยังไม่มีหนังสือที่ผ่านการแลกเปลี่ยนซ้ำ (ExchangeCount &ge; 2) ใน Google Sheet
                </p>
                <p className="text-[11px] text-[#8A7E74] mt-1">
                  เมื่อผู้ใช้นำหนังสือ U มาแลกเปลี่ยนหมุนเวียนต่อเนื่อง ข้อมูลจะปรากฏที่นี่โดยอัตโนมัติ
                </p>
              </div>
            ) : (
              <div className="relative space-y-2.5">
                {/* Vertical dotted connector line running behind numbered circles */}
                <div className="absolute left-[15px] top-4 bottom-4 w-0.5 border-l-2 border-dashed border-[#A7D8E8] pointer-events-none z-0" />

                {longestChainList.map((item) => (
                  <div key={item.step} className="flex items-center gap-3 relative z-10">
                    {/* Number Circle Badge */}
                    <div className="w-8 h-8 rounded-full bg-[#9ED8EB] text-[#184E60] font-bold text-xs flex items-center justify-center shrink-0 shadow-xs border border-white">
                      {item.step}
                    </div>

                    {/* Card Container */}
                    <div className="flex-1 bg-white/85 border border-[#EADBCC]/60 rounded-xl px-4 py-2.5 flex items-center justify-between shadow-xs">
                      <span className="text-xs font-medium text-[#263238] truncate pr-2">
                        {item.title}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs font-semibold text-[#7CA992]">
                          {item.code}
                        </span>
                        <span className="text-[10px] bg-[#E8F5E9] text-[#2E7D32] px-2 py-0.5 rounded-full font-medium">
                          ส่งต่อ {item.count} ครั้ง
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
