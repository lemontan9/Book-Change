import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  RefreshCw,
  ExternalLink,
  BookOpen,
  Users,
  Repeat,
  Layers,
  Gift,
  CalendarDays,
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
import { StorageService, normalizeCategory } from '../services/storage';
import { getAccessToken } from '../services/firebaseAuth';

interface AdminDashboardProps {
  books: Book[];
  settings: SystemSettings;
  transactions: TransactionRecord[];
  googleConnected?: boolean;
  onConnectGoogle?: () => void;
  onSelectTab?: (tab: 'kiosk' | 'dashboard' | 'books' | 'settings') => void;
  onOpenAddBook?: () => void;
  onSheetDataSynced?: (books: Book[], transactions: TransactionRecord[]) => void;
}

const parseTransactionDate = (raw?: string): Date | null => {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  // Handle DD/MM/YYYY or D/M/YYYY (Gregorian or Thai Buddhist Era) with optional time
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[\s,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10) - 1;
    let year = parseInt(slashMatch[3], 10);
    if (year > 2400) year -= 543;
    const hour = slashMatch[4] ? parseInt(slashMatch[4], 10) : 0;
    const minute = slashMatch[5] ? parseInt(slashMatch[5], 10) : 0;
    const second = slashMatch[6] ? parseInt(slashMatch[6], 10) : 0;
    const d = new Date(year, month, day, hour, minute, second);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    if (parsed.getFullYear() > 2400) {
      parsed.setFullYear(parsed.getFullYear() - 543);
    }
    return parsed;
  }

  return null;
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  books,
  transactions,
  settings,
  googleConnected,
  onConnectGoogle,
  onSelectTab,
  onOpenAddBook,
  onSheetDataSynced,
}) => {
  const booksRef = useRef(books);
  const transactionsRef = useRef(transactions);
  const onSheetDataSyncedRef = useRef(onSheetDataSynced);
  booksRef.current = books;
  transactionsRef.current = transactions;
  onSheetDataSyncedRef.current = onSheetDataSynced;
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
  const [dailyRange, setDailyRange] = useState<'7' | '14' | 'all'>('14');
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  // Authoritative Fetch: pulls exact latest data directly from Google Sheet (never resurrects deleted rows or overwrites the sheet)
  const loadDataFromGoogleSheet = useCallback(async (isManualTrigger = false) => {
    if (!spreadsheetId) {
      setSheetBooks(booksRef.current || []);
      setSheetTransactions(transactionsRef.current || []);
      setIsFetched(true);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    if (isManualTrigger) {
      setSyncNotice(null);
    }

    try {
      const token = await getAccessToken().catch(() => null);

      // Fetch Books and Transactions sheets concurrently (authoritative source of truth)
      const [fetchedBooks, fetchedTransactions] = await Promise.all([
        fetchBooksFromSheet(token, spreadsheetId),
        fetchTransactionsFromSheet(token, spreadsheetId),
      ]);

      const sortedBooks = StorageService.sortBooks(fetchedBooks);

      setSheetBooks(sortedBooks);
      setSheetTransactions(fetchedTransactions);
      setUnsyncedBooksList([]);
      setUnsyncedTxList([]);
      onSheetDataSyncedRef.current?.(sortedBooks, fetchedTransactions);

      setIsUsingFallback(false);
      setLastFetchedAt(
        new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setErrorMsg(null);
      setIsFetched(true);

      if (isManualTrigger) {
        setSyncNotice({
          type: 'success',
          text: `Sync ข้อมูลล่าสุดจาก Google Sheet สำเร็จ! (หนังสือ ${sortedBooks.length.toLocaleString()} เล่ม, ธุรกรรม ${fetchedTransactions.length.toLocaleString()} รายการ)`,
        });
      }
    } catch (err: any) {
      console.warn('Failed to load Dashboard data from Google Sheet, using system local cache:', err);
      // Gracefully fall back to local system database only on actual network/permission errors
      const fallbackBooks =
        booksRef.current && booksRef.current.length > 0 ? booksRef.current : StorageService.getBooks();
      const fallbackTx =
        transactionsRef.current && transactionsRef.current.length > 0
          ? transactionsRef.current
          : StorageService.getTransactions();
      setSheetBooks(fallbackBooks);
      setSheetTransactions(fallbackTx);
      setIsUsingFallback(true);
      const message =
        err?.message ||
        'ไม่สามารถดึงข้อมูลสดจาก Google Sheet ได้ โปรดตรวจสอบว่า Spreadsheet เปิดสิทธิ์แชร์เป็น "Anyone with the link can edit/view" หรือตรวจสอบการเชื่อมต่ออินเทอร์เน็ต';
      setErrorMsg(message);
      if (isManualTrigger) {
        setSyncNotice({
          type: 'error',
          text: message,
        });
      }
      setIsFetched(true);
    } finally {
      setIsLoading(false);
    }
  }, [spreadsheetId]);

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
          text: 'กรุณาลงชื่อเข้าใช้ด้วยบัญชี Google ที่มีสิทธิ์เข้าถึง (Editor) บน Google Sheet ที่ผูกกับระบบ เพื่ออนุญาตให้ระบบส่งข้อมูลขึ้น Google Sheet',
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

  const matchedBooks = sheetBooks.filter((b) => b.status === 'Matched');
  const totalMatchedCount = matchedBooks.length;

  const matchedLCount = matchedBooks.filter((b) => {
    const code = (b.code || '').trim().toUpperCase();
    if (code.startsWith('L')) return true;
    if (code.startsWith('U')) return false;
    return b.source === 'Library';
  }).length;

  const matchedUCount = totalMatchedCount - matchedLCount;

  // Donated books summary (from Transactions donatedCount + fallback check for Donated status in Books)
  const donatedBooksStats = useMemo(() => {
    let txDonatedTotal = 0;
    let donatedTxCount = 0;

    Array.from(distinctTransactionMap.values()).forEach((t) => {
      const donated = Number(t.donatedCount) || 0;
      if (donated > 0) {
        txDonatedTotal += donated;
        donatedTxCount += 1;
      }
    });

    const bookStatusDonatedCount = sheetBooks.filter((b) => b.status === 'Donated').length;
    const totalDonated = Math.max(txDonatedTotal, bookStatusDonatedCount);

    return {
      totalDonated,
      donatedTxCount,
    };
  }, [distinctTransactionMap, sheetBooks]);

  // Daily Book Exchange & Donation Statistics grouped by calendar date
  const dailyExchangeStats = useMemo(() => {
    const dayMap = new Map<
      string,
      {
        dateKey: string;
        shortLabel: string;
        fullLabel: string;
        transactions: number;
        matched: number;
        donated: number;
        brought: number;
      }
    >();

    Array.from(distinctTransactionMap.values()).forEach((t) => {
      const parsedDate = parseTransactionDate(t.timestamp);
      if (!parsedDate) return;

      const yyyy = parsedDate.getFullYear();
      const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(parsedDate.getDate()).padStart(2, '0');
      const dateKey = `${yyyy}-${mm}-${dd}`;

      const existing = dayMap.get(dateKey) || {
        dateKey,
        shortLabel: parsedDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
        fullLabel: parsedDate.toLocaleDateString('th-TH', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        transactions: 0,
        matched: 0,
        donated: 0,
        brought: 0,
      };

      const matched =
        t.matchedCount !== undefined
          ? Number(t.matchedCount) || 0
          : (t.booksTakenCount ?? (Array.isArray(t.booksTaken) ? t.booksTaken.length : 0));
      const donated = Number(t.donatedCount) || 0;
      const brought =
        t.totalBroughtCount !== undefined
          ? Number(t.totalBroughtCount) || 0
          : (t.booksBroughtCount ?? (Array.isArray(t.booksBrought) ? t.booksBrought.length : 0));

      existing.transactions += 1;
      existing.matched += matched;
      existing.donated += donated;
      existing.brought += brought;

      dayMap.set(dateKey, existing);
    });

    const allDays = Array.from(dayMap.values())
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
      .map((d) => ({
        ...d,
        totalActivity: d.matched + d.donated,
      }));

    const displayedDays =
      dailyRange === '7'
        ? allDays.slice(-7)
        : dailyRange === '14'
          ? allDays.slice(-14)
          : allDays;

    const maxVal = Math.max(0, ...displayedDays.flatMap((d) => [d.matched, d.donated]));
    const maxYAxis = maxVal <= 4 ? 4 : Math.ceil(maxVal / 4) * 4;
    const ticks = [
      maxYAxis,
      Math.round(maxYAxis * 0.75),
      Math.round(maxYAxis * 0.5),
      Math.round(maxYAxis * 0.25),
      0,
    ];

    const windowMatched = displayedDays.reduce((acc, d) => acc + d.matched, 0);
    const windowDonated = displayedDays.reduce((acc, d) => acc + d.donated, 0);
    const windowTx = displayedDays.reduce((acc, d) => acc + d.transactions, 0);

    return {
      allDaysCount: allDays.length,
      displayedDays,
      maxYAxis,
      ticks,
      windowMatched,
      windowDonated,
      windowTx,
    };
  }, [distinctTransactionMap, dailyRange]);

  const activeDailyItem = useMemo(() => {
    if (dailyExchangeStats.displayedDays.length === 0) return null;
    if (selectedDayKey) {
      const found = dailyExchangeStats.displayedDays.find((d) => d.dateKey === selectedDayKey);
      if (found) return found;
    }
    return dailyExchangeStats.displayedDays[dailyExchangeStats.displayedDays.length - 1];
  }, [dailyExchangeStats.displayedDays, selectedDayKey]);

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
          color: '#6A8852',
        },
        {
          label: 'นำมา 2 เล่ม',
          count: buckets.two,
          percentage: totalTx > 0 ? Math.round((buckets.two / totalTx) * 100) : 0,
          color: '#4B5E26',
        },
        {
          label: 'นำมา 3 เล่ม',
          count: buckets.three,
          percentage: totalTx > 0 ? Math.round((buckets.three / totalTx) * 100) : 0,
          color: '#C69553',
        },
        {
          label: 'นำมา 4 เล่มขึ้นไป',
          count: buckets.fourPlus,
          percentage: totalTx > 0 ? Math.round((buckets.fourPlus / totalTx) * 100) : 0,
          color: '#7D502E',
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

    // Count actual available books from sheet using normalized categories
    availableBooks.forEach((b) => {
      const cat = normalizeCategory(b.category || 'หนังสือทั่วไป');
      countsMap.set(cat, (countsMap.get(cat) || 0) + 1);
    });

    const colors = ['#6A8852', '#7D502E', '#97B368', '#C69553', '#4B5E26', '#B3885E', '#8CA76C', '#A67B51'];

    // Filter out categories with count = 0 to remove redundant/empty slots ("ลบช่องนี้")
    // and sort descending so higher available categories display cleanly
    const result = Array.from(countsMap.entries())
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([fullLabel, count], idx) => {
        let shortLabel = fullLabel;
        if (fullLabel === 'หนังสือทั่วไป') shortLabel = 'ทั่วไป';
        else if (fullLabel.includes('เรียน') || fullLabel.includes('วิชาการ')) shortLabel = 'เรียน/วิชาการ';
        else if (fullLabel.includes('การ์ตูน') || fullLabel.includes('มังงะ')) shortLabel = 'การ์ตูน/มังงะ';
        else if (fullLabel.includes('นวนิยาย') || fullLabel.includes('วรรณกรรม')) shortLabel = 'นวนิยาย';
        else if (fullLabel.includes('เยาวชน')) shortLabel = 'เยาวชน';
        else if (fullLabel.includes('พัฒนาตนเอง') || fullLabel.includes('จิตวิ')) shortLabel = 'พัฒนาตนเอง';
        else if (fullLabel.includes('เรื่องสั้น')) shortLabel = 'เรื่องสั้น';
        else shortLabel = fullLabel.replace(/\/.*$/, '').replace('หนังสือ', '').trim() || fullLabel.slice(0, 8);

        return {
          fullLabel,
          label: shortLabel,
          value: count,
          color: colors[idx % colors.length],
        };
      });

    return result;
  }, [sheetBooks]);

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
    <div className="pb-24 pt-5 max-w-6xl mx-auto px-4 min-h-[calc(100vh-8rem)] font-sans space-y-4">
      {/* 1. Top Header Card */}
      <div className="bg-[#FFFCF7]/95 backdrop-blur-sm border border-[#EAE0D2] rounded-[28px] sm:rounded-[34px] p-5 sm:p-6 shadow-[0_18px_48px_rgba(92,58,33,0.09)] flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[#4E342E] tracking-tight">
            ระบบแลกเปลี่ยนหนังสือ สำนักหอสมุด
          </h1>
          <p className="text-xs text-[#7E7369] font-medium mt-1">
            ส่วนการจัดการสำหรับเจ้าหน้าที่ (Admin Dashboard)
          </p>
        </div>
        {lastFetchedAt && (
          <span className="text-[11px] text-[#4B5E26] bg-[#E9EBC8] border border-[#D4DAA8] px-3 py-1 rounded-full font-medium tabular-nums">
            อัปเดตล่าสุด {lastFetchedAt}
          </span>
        )}
      </div>

      {/* 2. Sub-header Navigation Pill Bar + Action Button */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Navigation Tabs Pill */}
        <div className="bg-[#FFFCF7]/95 border border-[#EAE0D2] rounded-full p-1.5 flex items-center gap-1 shadow-xs flex-wrap">
          <button
            type="button"
            onClick={() => onSelectTab?.('kiosk')}
            className="text-[#3B4C1D] bg-[#E9EBC8]/70 hover:bg-[#DCE7C4] px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span>แลกเปลี่ยนหนังสือ</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTab?.('dashboard')}
            className="bg-[#7D502E] text-white px-5 py-2 rounded-full text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => onSelectTab?.('books')}
            className="text-[#4E342E] hover:bg-[#F8F2E7] px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            Book List
          </button>
          <button
            type="button"
            onClick={() => onSelectTab?.('settings')}
            className="text-[#4E342E] hover:bg-[#F8F2E7] px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            ตั้งค่าระบบ
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {spreadsheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
              target="_blank"
              rel="noreferrer"
              className="py-2 px-4 rounded-full border border-[#E5D8C8] bg-[#FFFCF7] hover:bg-[#F8F2E7] text-xs font-semibold text-[#5C3A21] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="เปิดดูไฟล์ Google Sheet บน Google Drive"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#7D502E]" />
              <span>เปิดดู Google Sheet</span>
            </a>
          )}

          <button
            type="button"
            disabled={isLoading || !spreadsheetId}
            onClick={() => loadDataFromGoogleSheet(true)}
            className="py-2 px-4 rounded-full bg-[#4B5E26] hover:bg-[#3B4B1D] disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'กำลัง Sync...' : 'Sync จาก Google Sheet'}</span>
          </button>
        </div>
      </div>

      {/* Unsynced Items Notification Banner (เฉพาะเมื่อ Super Admin เข้าสู่ระบบ เพื่อป้องกันความสับสนสำหรับเจ้าหน้าที่ทั่วไป) */}
      {googleConnected && !isDismissedUnsynced && unsyncedBooksList.length > 0 && (
        <div className="bg-[#FBF3DF] border border-[#E8D09B] rounded-2xl p-3.5 text-xs text-[#6B471C] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#9E6F38] shrink-0" />
            <span>
              <strong className="text-[#5C3A21]">มีข้อมูลใหม่ในระบบที่ยังไม่ได้ส่งขึ้น Google Sheet:</strong> หนังสือ {unsyncedBooksList.length} เล่ม ({unsyncedBooksList.map((b) => b.code).join(', ')})
              {unsyncedTxList.length > 0 && ` และธุรกรรม ${unsyncedTxList.length} รายการ`}
              <span className="text-[#7E7369] block sm:inline sm:ml-1">
                (ข้อมูลรวมแสดงใน Dashboard ให้เรียบร้อยแล้ว)
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleManualSyncToGoogleSheet}
              className="bg-[#7D502E] hover:bg-[#653F22] text-white px-3.5 py-1.5 rounded-full font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>ซิงค์ขึ้น Sheet ทันที</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDismissedUnsynced(true)}
              className="text-[#7E7369] hover:text-[#4E342E] p-1 cursor-pointer font-bold"
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
              ? 'bg-[#DCE7C4]/80 text-[#3B4C1D] border border-[#CBD6A6]'
              : syncNotice.type === 'info'
              ? 'bg-[#F8F2E7] text-[#5C3A21] border border-[#E5D8C8]'
              : 'bg-[#FADBD2] text-[#8B3A2B] border border-[#F0BFB2]'
          }`}
        >
          {syncNotice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#4B5E26]" />
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

      {/* 4. Five Metric Banner Cards (Unified with First-Page Pastel Eco Theme) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Warm Wheat Card: ผู้เข้าร่วมกิจกรรมทั้งหมด */}
        <div
          style={{ minHeight: '94px' }}
          className="bg-[#EFE2CA] border border-[#DFCEB2] rounded-[24px] p-4 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-[#5C3A21]">
              ผู้เข้าร่วมกิจกรรมทั้งหมด
            </span>
            <Users className="w-4 h-4 text-[#7D502E]/70 shrink-0" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-[#4E342E] tracking-tight tabular-nums">
              {totalParticipants.toLocaleString()}
              <span className="text-xs font-normal text-[#6D5C50] ml-1.5">คน</span>
            </div>
            <div className="text-[11px] text-[#6D5C50] font-medium mt-0.5">
              นำหนังสือมา {booksPerTransactionStats.totalBrought} เล่ม
              <br />
              (เฉลี่ย {booksPerTransactionStats.avgPerTx} เล่ม/ครั้ง)
            </div>
          </div>
        </div>

        {/* Soft Parchment Card: หนังสือทั้งหมดในระบบ */}
        <div
          style={{ minHeight: '94px' }}
          className="bg-[#F4EDE0] border border-[#E5D8C8] rounded-[24px] p-4 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-[#5C3A21]">
              หนังสือทั้งหมดในระบบ
            </span>
            <BookOpen className="w-4 h-4 text-[#7D502E]/70 shrink-0" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-[#4E342E] tracking-tight tabular-nums">
              {totalBooksCount.toLocaleString()}
              <span className="text-xs font-normal text-[#6D5C50] ml-1.5">เล่ม</span>
            </div>
            <div className="text-[11px] text-[#7E7369] font-medium mt-0.5">
              รวมหนังสือทั้งหมดที่บันทึกไว้
            </div>
          </div>
        </div>

        {/* Soft Warm Clay Card: หนังสือที่ถูกแลกออกแล้ว */}
        <div
          style={{ minHeight: '94px' }}
          className="bg-[#F4E6DA] border border-[#E2CBB7] rounded-[24px] p-4 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-[#5C3A21]">
              หนังสือที่ถูกแลกออกแล้ว
            </span>
            <Repeat className="w-4 h-4 text-[#8B5530]/80 shrink-0" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-[#4E342E] tracking-tight tabular-nums">
              {totalMatchedCount.toLocaleString()}
              <span className="text-xs font-normal text-[#6D5C50] ml-1.5">เล่ม</span>
            </div>
            <div className="text-[11px] text-[#7E614E] font-medium mt-0.5">
              ส่วนกลาง (L) {matchedLCount.toLocaleString()} · ผู้เข้าร่วม (U) {matchedUCount.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Soft Eco Sage Card: หนังสือพร้อมแลก */}
        <div
          style={{ minHeight: '94px' }}
          className="bg-[#DCE7C4] border border-[#CBD6A6] rounded-[24px] p-4 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-[#3B4C1D]">
              หนังสือพร้อมแลก
            </span>
            <Layers className="w-4 h-4 text-[#4B5E26]/75 shrink-0" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-[#2F4216] tracking-tight tabular-nums">
              {availableBooksCount.toLocaleString()}
              <span className="text-xs font-normal text-[#4B5E26] ml-1.5">เล่ม</span>
            </div>
            <div className="text-[11px] text-[#4B5E26]/90 font-medium mt-0.5">
              พร้อมแลกเปลี่ยนบนชั้นหนังสือ
            </div>
          </div>
        </div>

        {/* Soft Warm Amber Card: หนังสือที่ได้รับบริจาค */}
        <div
          style={{ minHeight: '94px' }}
          className="bg-[#FBF0D9] border border-[#E7CFA2] rounded-[24px] p-4 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-[#7A4B14]">
              หนังสือที่ได้รับบริจาค
            </span>
            <Gift className="w-4 h-4 text-[#B06F1E] shrink-0" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-[#5C360B] tracking-tight tabular-nums">
              {donatedBooksStats.totalDonated.toLocaleString()}
              <span className="text-xs font-normal text-[#8B5A1F] ml-1.5">เล่ม</span>
            </div>
            <div className="text-[11px] text-[#8B5A1F] font-medium mt-0.5">
              {donatedBooksStats.donatedTxCount > 0
                ? `จากผู้ร่วมบริจาค ${donatedBooksStats.donatedTxCount.toLocaleString()} ครั้ง`
                : 'นับจากรายการบริจาคในระบบ'}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Middle Section (2 Columns: Left Chart, Right 2 Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left Column: หมวดหมู่หนังสือที่คงเหลือ */}
        <div className="lg:col-span-7 bg-[#FFFCF7]/95 backdrop-blur-sm border border-[#EAE0D2] rounded-[28px] p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-[#4E342E] font-bold text-[21px]">
                หมวดหมู่หนังสือที่คงเหลือ
              </h2>
            </div>
            <span className="text-[11px] text-[#4B5E26] font-semibold font-mono bg-[#E9EBC8] border border-[#D4DAA8] px-3 py-1 rounded-full tabular-nums">
              รวม {availableBooksCount.toLocaleString()} เล่ม
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-center pt-3 min-h-[300px] overflow-x-auto">
            {availableBooksCount === 0 && isFetched ? (
              <div className="h-56 flex flex-col items-center justify-center text-center p-4">
                <BookOpen className="w-8 h-8 text-[#B0A396] mb-2 opacity-50" />
                <p className="text-xs font-medium text-[#6D5C50]">
                  ยังไม่มีหนังสือสถานะ Available ใน Google Sheet
                </p>
                <p className="text-[11px] text-[#7E7369] mt-1">
                  เมื่อมีการเพิ่มหนังสือ หรือซิงค์ข้อมูลจาก Kiosk สถิติจะปรากฏที่นี่
                </p>
              </div>
            ) : (
              (() => {
                const xTicks = [...yTicks].reverse();
                return (
                  <div className="w-full py-2">
                    <div className="grid grid-cols-[max-content_1fr] gap-x-3 items-stretch">
                      {/* Left Column: Full Single-Line Category Labels (No Wrap) */}
                      <div className="flex flex-col justify-around py-2 gap-3">
                        {categoryBarData.map((item) => (
                          <div
                            key={item.fullLabel}
                            title={item.fullLabel}
                            className="h-7 sm:h-8 flex items-center justify-end text-right text-[15px] font-medium text-[#4E342E] whitespace-nowrap"
                          >
                            {item.fullLabel}
                          </div>
                        ))}
                      </div>

                      {/* Right Column: Horizontal Plot Area with Vertical Dashed Grid Lines */}
                      <div className="relative border-l border-b border-[#D8CABE] py-2 pr-14 min-w-[180px]">
                        {/* Vertical Dashed Grid Lines */}
                        <div className="pointer-events-none absolute inset-y-0 left-0 right-14">
                          {xTicks.map((tick, i) => {
                            if (i === 0) return null; // Baseline is border-l
                            const leftPct = (i / (xTicks.length - 1)) * 100;
                            return (
                              <div
                                key={`${tick}-${i}`}
                                style={{ left: `${leftPct}%` }}
                                className="absolute top-0 bottom-0 border-l border-dashed border-[#E5DDD2]"
                              />
                            );
                          })}
                        </div>

                        {/* Horizontal Bars */}
                        <div className="relative flex flex-col justify-around gap-3">
                          {categoryBarData.map((item) => {
                            const barWidthPercent =
                              maxY > 0 ? Math.min(100, Math.max(0, (item.value / maxY) * 100)) : 0;

                            return (
                              <div
                                key={item.fullLabel}
                                className="h-7 sm:h-8 flex items-center group"
                                title={`${item.fullLabel}: ${item.value} เล่ม`}
                              >
                                <div
                                  className="h-6 sm:h-7 rounded-r-lg sm:rounded-r-xl transition-all duration-500 shadow-xs group-hover:brightness-95 shrink-0"
                                  style={{
                                    width: `${Math.max(barWidthPercent, item.value > 0 ? 4 : 0)}%`,
                                    backgroundColor: item.color,
                                  }}
                                />
                                <span className="ml-2 text-[14px] font-normal text-[#4E342E] font-mono tabular-nums whitespace-nowrap transition-transform group-hover:scale-105">
                                  {item.value} เล่ม
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Bottom Left Spacer */}
                      <div />

                      {/* Bottom Right: X-Axis Numeric Scale */}
                      <div className="relative h-5 mt-1.5 mr-14 select-none">
                        {xTicks.map((tick, i) => {
                          const leftPct = (i / (xTicks.length - 1)) * 100;
                          return (
                            <span
                              key={`${tick}-${i}`}
                              style={{ left: `${leftPct}%` }}
                              className={`absolute top-0 text-[11px] text-[#7E7369] font-mono tabular-nums leading-none ${
                                i === 0
                                  ? 'translate-x-0'
                                  : i === xTicks.length - 1
                                    ? '-translate-x-full'
                                    : '-translate-x-1/2'
                              }`}
                            >
                              {tick}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>

        {/* Right Column: 2 Stacked Cards */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Top Card: สถิติการแลกออก */}
          <div className="bg-[#FFFCF7]/95 backdrop-blur-xs border border-[#EAE0D2] rounded-[28px] p-5 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-[#4E342E] font-bold text-[21px]">
                  สถิติการแลกออก
                </h3>
                <p className="text-[10px] text-[#7E7369]">
                  จำนวนหนังสือที่ถูกแลกออกแล้ว (Status = Matched) แยกตามรหัส L / U
                </p>
              </div>
              <span className="text-[11px] text-[#5C3A21] font-semibold font-mono bg-[#F3E7D3] border border-[#E0CEB5] px-2.5 py-0.5 rounded-full tabular-nums shrink-0">
                รวม {totalMatchedCount.toLocaleString()} เล่ม
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="h-[35px] bg-[#F8F2E7] border border-[#EAE0D2] rounded-2xl px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-[#4E342E] font-medium">
                  หนังสือส่วนกลาง (L)
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#5C3A21] font-mono tabular-nums">
                  {matchedLCount.toLocaleString()} เล่ม
                </span>
              </div>

              <div className="h-[35px] bg-[#F8F2E7] border border-[#EAE0D2] rounded-2xl px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-[#4E342E] font-medium">
                  หนังสือจากผู้เข้าร่วม (U)
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#4B5E26] font-mono tabular-nums">
                  {matchedUCount.toLocaleString()} เล่ม
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Card: ประเภทสมาชิก */}
          <div className="bg-[#FFFCF7]/95 backdrop-blur-xs border border-[#EAE0D2] rounded-[28px] p-5 shadow-xs flex-1 flex flex-col justify-between">
            <div>
              <h3 className="text-[#4E342E] font-bold text-[21px]">
                ประเภทสมาชิก
              </h3>
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
                      {/* 1. CMU นักศึกษา (Fresh Leaf Green) */}
                      {memberTypeStats.donut.sStudents > 0 && (
                        <circle
                          cx="60"
                          cy="60"
                          r={memberTypeStats.donut.r}
                          fill="none"
                          stroke="#6A8852"
                          strokeWidth="14"
                          strokeDasharray={`${memberTypeStats.donut.sStudents} ${memberTypeStats.donut.c}`}
                          strokeDashoffset={memberTypeStats.donut.offsetStudents}
                        />
                      )}

                      {/* 2. บุคคลทั่วไป (Warm Honey Wheat) */}
                      {memberTypeStats.donut.sGeneral > 0 && (
                        <circle
                          cx="60"
                          cy="60"
                          r={memberTypeStats.donut.r}
                          fill="none"
                          stroke="#C69553"
                          strokeWidth="14"
                          strokeDasharray={`${memberTypeStats.donut.sGeneral} ${memberTypeStats.donut.c}`}
                          strokeDashoffset={memberTypeStats.donut.offsetGeneral}
                        />
                      )}

                      {/* 3. CMU Staff (Earth Brown) */}
                      {memberTypeStats.donut.sStaff > 0 && (
                        <circle
                          cx="60"
                          cy="60"
                          r={memberTypeStats.donut.r}
                          fill="none"
                          stroke="#7D502E"
                          strokeWidth="14"
                          strokeDasharray={`${memberTypeStats.donut.sStaff} ${memberTypeStats.donut.c}`}
                          strokeDashoffset={memberTypeStats.donut.offsetStaff}
                        />
                      )}

                      {/* 4. CMU ศิษย์เก่า (Soft Sage Olive) */}
                      {memberTypeStats.donut.sAlumni > 0 && (
                        <circle
                          cx="60"
                          cy="60"
                          r={memberTypeStats.donut.r}
                          fill="none"
                          stroke="#A8C078"
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
                  <span className="text-[23px] font-bold text-[#4E342E] font-mono">
                    {memberTypeStats.total}
                  </span>
                  <span className="text-[15px] -mt-[10px] text-[#7E7369]">คน</span>
                </div>
              </div>

              {/* Legend Items */}
              <div className="space-y-2 text-[12px] text-[#4E342E] pr-1 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#6A8852] shrink-0" />
                    <span className="font-medium text-[17px] text-[#3E2723] truncate">
                      CMU นักศึกษา
                    </span>
                  </div>
                  <span className="text-[17px] font-bold text-[#3B4C1D] font-mono shrink-0">
                    {memberTypeStats.percentages.students}% ({memberTypeStats.counts.students})
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#C69553] shrink-0" />
                    <span className="font-medium text-[17px] text-[#3E2723] truncate">
                      บุคคลทั่วไป/นักเรียน
                    </span>
                  </div>
                  <span className="text-[17px] font-bold text-[#7D502E] font-mono shrink-0">
                    {memberTypeStats.percentages.general}% ({memberTypeStats.counts.general})
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#7D502E] shrink-0" />
                    <span className="font-medium text-[17px] text-[#3E2723] truncate">
                      CMU Staff
                    </span>
                  </div>
                  <span className="text-[17px] font-bold text-[#5C3A21] font-mono shrink-0">
                    {memberTypeStats.percentages.staff}% ({memberTypeStats.counts.staff})
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#A8C078] shrink-0" />
                    <span className="font-medium text-[17px] text-[#3E2723] truncate">
                      CMU ศิษย์เก่า
                    </span>
                  </div>
                  <span className="text-[17px] font-bold text-[#4B5E26] font-mono shrink-0">
                    {memberTypeStats.percentages.alumni}% ({memberTypeStats.counts.alumni})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5.5 Daily Book Exchange & Donation Statistics Chart */}
      <div className="bg-[#FFFCF7]/95 backdrop-blur-sm border border-[#EAE0D2] rounded-[28px] p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <CalendarDays className="w-4 h-4 text-[#4B5E26] shrink-0" />
              <h2 className="text-[#4E342E] font-bold text-sm sm:text-base">
                สถิติการแลกหนังสือประจำวัน
              </h2>
              <span className="text-[11px] font-semibold bg-[#E9EBC8] text-[#4B5E26] px-2.5 py-0.5 rounded-full border border-[#D4DAA8]">
                Daily Activity
              </span>
            </div>
          </div>

          {/* Range Filter Pills */}
          <div className="flex items-center gap-1 bg-[#F8F2E7] border border-[#EAE0D2] p-1 rounded-full">
            {[
              { id: '7' as const, label: '7 วันล่าสุด' },
              { id: '14' as const, label: '14 วันล่าสุด' },
              { id: 'all' as const, label: 'ทั้งหมด' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDailyRange(opt.id)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  dailyRange === opt.id
                    ? 'bg-[#4B5E26] text-white shadow-2xs'
                    : 'text-[#5C3A21] hover:bg-[#EFE5D6]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Legend & Window Totals */}
        <div className="flex items-center justify-between gap-3 flex-wrap bg-[#FAF5EC] border border-[#ECE2D3] rounded-2xl px-4 py-2.5">
          <div className="flex items-center gap-4 flex-wrap text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#4B5E26] shrink-0" />
              <span className="font-medium text-[#3E2723]">แลกเปลี่ยนสำเร็จ</span>
              <span className="font-mono font-bold text-[#3B4C1D] tabular-nums">
                {dailyExchangeStats.windowMatched.toLocaleString()} เล่ม
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#D9943B] shrink-0" />
              <span className="font-medium text-[#3E2723]">ได้รับบริจาค</span>
              <span className="font-mono font-bold text-[#8B5A1F] tabular-nums">
                {dailyExchangeStats.windowDonated.toLocaleString()} เล่ม
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#6D5C50] font-medium tabular-nums">
            <span>
              แสดง {dailyExchangeStats.displayedDays.length} วัน ({dailyExchangeStats.windowTx.toLocaleString()} ครั้งการแลก)
            </span>
          </div>
        </div>

        {/* Chart Area */}
        {dailyExchangeStats.displayedDays.length === 0 ? (
          <div className="h-52 flex flex-col items-center justify-center text-center p-4 bg-white/60 rounded-2xl border border-dashed border-[#E5D8C8]">
            <CalendarDays className="w-8 h-8 text-[#B0A396] mb-2 opacity-60" />
            <p className="text-xs font-medium text-[#6D5C50]">
              ยังไม่มีข้อมูลสถิติรายวันใน Google Sheet
            </p>
            <p className="text-[11px] text-[#7E7369] mt-1">
              เมื่อมีการแลกเปลี่ยนหรือบริจาคหนังสือผ่านระบบ Kiosk กราฟประจำวันจะแสดงที่นี่โดยอัตโนมัติ
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto pb-1">
              <div className="min-w-[360px] pt-6">
                <div className="flex items-stretch gap-2">
                  {/* Y-Axis Labels */}
                  <div className="flex flex-col justify-between h-52 sm:h-56 pr-2 text-right select-none shrink-0 w-9">
                    {dailyExchangeStats.ticks.map((tick, idx) => (
                      <span
                        key={`${tick}-${idx}`}
                        className="text-[11px] text-[#7E7369] font-mono tabular-nums leading-none"
                      >
                        {tick}
                      </span>
                    ))}
                  </div>

                  {/* Plot Area */}
                  <div className="flex-1 flex flex-col">
                    <div className="relative h-52 sm:h-56 border-l border-b border-[#D8CABE]">
                      {/* Horizontal Dashed Grid Lines */}
                      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                        {dailyExchangeStats.ticks.map((tick, idx) => (
                          <div
                            key={`grid-${tick}-${idx}`}
                            className={`w-full ${
                              idx === dailyExchangeStats.ticks.length - 1
                                ? ''
                                : 'border-t border-dashed border-[#E5DDD2]'
                            }`}
                          />
                        ))}
                      </div>

                      {/* Grouped Side-by-Side Vertical Bars (Exchanged vs Donated) */}
                      <div className="relative z-10 h-full flex items-end justify-around gap-2 px-2 sm:px-4">
                        {dailyExchangeStats.displayedDays.map((day) => {
                          const matchedPct =
                            dailyExchangeStats.maxYAxis > 0
                              ? (day.matched / dailyExchangeStats.maxYAxis) * 100
                              : 0;
                          const donatedPct =
                            dailyExchangeStats.maxYAxis > 0
                              ? (day.donated / dailyExchangeStats.maxYAxis) * 100
                              : 0;
                          const isSelected = activeDailyItem?.dateKey === day.dateKey;

                          return (
                            <button
                              key={day.dateKey}
                              type="button"
                              onMouseEnter={() => setSelectedDayKey(day.dateKey)}
                              onFocus={() => setSelectedDayKey(day.dateKey)}
                              onClick={() => setSelectedDayKey(day.dateKey)}
                              title={`${day.fullLabel}: แลกเปลี่ยนสำเร็จ ${day.matched} เล่ม | ได้รับบริจาค ${day.donated} เล่ม (${day.transactions} ครั้ง)`}
                              className="group relative flex-1 min-w-[60px] max-w-[92px] h-full flex items-end justify-center gap-1.5 px-1.5 rounded-t-xl bg-transparent transition-colors cursor-pointer focus:outline-none"
                            >
                              {/* Bar 1: แลกเปลี่ยนสำเร็จ (Forest Green) */}
                              <div className="h-full flex items-end">
                                <div
                                  className={`relative w-5 sm:w-6 rounded-t-lg transition-all duration-500 ${
                                    day.matched > 0
                                      ? 'bg-[#4B5E26] shadow-2xs group-hover:brightness-105'
                                      : 'bg-[#DCE7C4]/80'
                                  } ${isSelected && day.matched > 0 ? 'ring-2 ring-[#4B5E26]/35 ring-offset-1 ring-offset-[#FFFCF7]' : ''}`}
                                  style={{
                                    height: day.matched > 0 ? `${Math.max(matchedPct, 4)}%` : '3px',
                                  }}
                                >
                                  <span
                                    className={`absolute -top-4.5 left-1/2 -translate-x-1/2 text-[10px] sm:text-[11px] font-mono font-bold tabular-nums leading-none whitespace-nowrap ${
                                      day.matched > 0 ? 'text-[#3B4C1D]' : 'text-[#A89E92]'
                                    }`}
                                  >
                                    {day.matched}
                                  </span>
                                </div>
                              </div>

                              {/* Bar 2: ได้รับบริจาค (Warm Amber) */}
                              <div className="h-full flex items-end">
                                <div
                                  className={`relative w-5 sm:w-6 rounded-t-lg transition-all duration-500 ${
                                    day.donated > 0
                                      ? 'bg-[#D9943B] shadow-2xs group-hover:brightness-105'
                                      : 'bg-[#F2DEC0]/85'
                                  } ${isSelected && day.donated > 0 ? 'ring-2 ring-[#D9943B]/40 ring-offset-1 ring-offset-[#FFFCF7]' : ''}`}
                                  style={{
                                    height: day.donated > 0 ? `${Math.max(donatedPct, 4)}%` : '3px',
                                  }}
                                >
                                  <span
                                    className={`absolute -top-4.5 left-1/2 -translate-x-1/2 text-[10px] sm:text-[11px] font-mono font-bold tabular-nums leading-none whitespace-nowrap ${
                                      day.donated > 0 ? 'text-[#8B5A1F]' : 'text-[#B8AB9C]'
                                    }`}
                                  >
                                    {day.donated}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* X-Axis Single-Line Date Labels */}
                    <div className="flex items-start justify-around gap-2 px-2 sm:px-4 pt-2">
                      {dailyExchangeStats.displayedDays.map((day) => {
                        const isSelected = activeDailyItem?.dateKey === day.dateKey;
                        return (
                          <button
                            key={`x-${day.dateKey}`}
                            type="button"
                            onClick={() => setSelectedDayKey(day.dateKey)}
                            className="flex-1 min-w-[60px] max-w-[92px] flex flex-col items-center cursor-pointer focus:outline-none"
                          >
                            <span
                              className={`text-[11px] whitespace-nowrap leading-tight ${
                                isSelected
                                  ? 'font-bold text-[#3B4C1D]'
                                  : 'font-medium text-[#5C4B41]'
                              }`}
                            >
                              {day.shortLabel}
                            </span>
                            <span className="text-[10px] text-[#8E8176] font-mono tabular-nums whitespace-nowrap mt-0.5">
                              {day.transactions} ครั้ง
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Active / Hovered Day Breakdown Strip */}
            {activeDailyItem && (
              <div className="bg-white/90 border border-[#EAE0D2] rounded-2xl px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#4E342E]">
                    รายละเอียดวันที่ {activeDailyItem.fullLabel}
                  </span>
                  <span className="text-[11px] bg-[#F8F2E7] text-[#5C3A21] border border-[#E5D8C8] px-2.5 py-0.5 rounded-full font-medium tabular-nums">
                    ผู้ร่วมกิจกรรม {activeDailyItem.transactions.toLocaleString()} ครั้ง
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 bg-[#DCE7C4] text-[#3B4C1D] border border-[#CBD6A6] px-2.5 py-0.5 rounded-full text-[11px] font-semibold tabular-nums">
                    <span className="w-2 h-2 rounded-full bg-[#4B5E26]" />
                    แลกเปลี่ยนสำเร็จ {activeDailyItem.matched.toLocaleString()} เล่ม
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-[#FBF0D9] text-[#7A4B14] border border-[#E7CFA2] px-2.5 py-0.5 rounded-full text-[11px] font-semibold tabular-nums">
                    <span className="w-2 h-2 rounded-full bg-[#D9943B]" />
                    ได้รับบริจาค {activeDailyItem.donated.toLocaleString()} เล่ม
                  </span>
                  <span className="text-[11px] text-[#7E7369] font-medium tabular-nums">
                    (นำมาร่วมทั้งหมด {activeDailyItem.brought.toLocaleString()} เล่ม)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. สถิติจำนวนหนังสือที่นำมาร่วมกิจกรรม ต่อครั้งการแลก */}
      <div className="bg-[#FFFCF7]/95 backdrop-blur-xs border border-[#EAE0D2] rounded-[28px] p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[#4E342E] font-bold text-sm sm:text-base">
                สถิติจำนวนหนังสือที่นำมาร่วมกิจกรรม ต่อครั้งการแลก
              </h2>
              <span className="text-[11px] font-semibold bg-[#E9EBC8] text-[#4B5E26] px-2.5 py-0.5 rounded-full border border-[#D4DAA8]">
                Transaction Count
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold bg-white text-[#5C3A21] border border-[#E5D8C8] px-3 py-1 rounded-full shadow-2xs font-mono tabular-nums">
              เฉลี่ย {booksPerTransactionStats.avgPerTx} เล่ม/ครั้ง
            </span>
            <span className="text-xs font-semibold bg-[#7D502E] text-white px-3.5 py-1 rounded-full shadow-2xs font-mono tabular-nums">
              รวม {booksPerTransactionStats.totalBrought} เล่ม ({booksPerTransactionStats.totalTx} ธุรกรรม)
            </span>
          </div>
        </div>

        {/* 4 Distribution Bucket Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {booksPerTransactionStats.buckets.map((b) => (
            <div
              key={b.label}
              className="bg-white/95 border border-[#EAE0D2] rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all hover:border-[#7D502E]/35"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#4E342E]">{b.label}</span>
                <span
                  className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${b.color}35`, color: '#3E2723' }}
                >
                  {b.percentage}%
                </span>
              </div>

              <div className="my-2.5 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-bold text-[#3E2723] font-mono tracking-tight">
                  {b.count}
                </span>
                <span className="text-xs text-[#7E7369]">ครั้งการแลก</span>
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
      </div>

      {/* 7. Bottom Card: สถิติความถี่การส่งต่อหนังสือ */}
      <div className="bg-[#FFFCF7]/95 backdrop-blur-xs border border-[#EAE0D2] rounded-[28px] p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-[#4E342E] font-bold text-sm sm:text-base">
              สถิติความถี่การส่งต่อหนังสือ (Exchange Chains)
            </h2>
          </div>
          <span className="text-[11px] text-[#4B5E26] bg-[#E9EBC8] px-3 py-1 rounded-full border border-[#D4DAA8] font-semibold">
            ข้อมูลจาก Sheet เท่านั้น
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Left Sub-column: จำนวนครั้งที่เกิดการแลกเปลี่ยนต่อเนื่อง */}
          <div>
            <h3 className="text-xs font-semibold text-[#4E342E] mb-3 flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5 text-[#4B5E26]" />
              จำนวนครั้งที่เกิดการแลกเปลี่ยนต่อเนื่อง
            </h3>

            <div className="space-y-2.5">
              {chainFrequency.map((item) => (
                <div
                  key={item.label}
                  className="bg-white/90 border border-[#EAE0D2] rounded-2xl px-4 py-3 flex items-center justify-between shadow-xs"
                >
                  <span className="text-xs font-medium text-[#3E2723]">
                    {item.label}
                  </span>
                  <span
                    className={`font-semibold text-xs px-3.5 py-1 rounded-full shadow-xs ${
                      item.count > 0
                        ? 'bg-[#4B5E26] text-white'
                        : 'bg-[#EDE6DA] text-[#7E7369]'
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
            <h3 className="text-xs font-semibold text-[#4E342E] mb-3 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#4B5E26]" />
              เล่มที่มีการส่งต่อสูงสุดใน Google Sheet
            </h3>

            {longestChainList.length === 0 ? (
              <div className="bg-white/90 border border-[#EAE0D2] rounded-2xl p-5 text-center">
                <p className="text-xs text-[#6D5C50] font-medium">
                  ยังไม่มีหนังสือที่ผ่านการแลกเปลี่ยนซ้ำ (ExchangeCount &ge; 2) ใน Google Sheet
                </p>
                <p className="text-[11px] text-[#7E7369] mt-1">
                  เมื่อผู้ใช้นำหนังสือ U มาแลกเปลี่ยนหมุนเวียนต่อเนื่อง ข้อมูลจะปรากฏที่นี่โดยอัตโนมัติ
                </p>
              </div>
            ) : (
              <div className="relative space-y-2.5">
                {/* Vertical dotted connector line running behind numbered circles */}
                <div className="absolute left-[15px] top-4 bottom-4 w-0.5 border-l-2 border-dashed border-[#CBD6A6] pointer-events-none z-0" />

                {longestChainList.map((item) => (
                  <div key={item.step} className="flex items-center gap-3 relative z-10">
                    {/* Number Circle Badge */}
                    <div className="w-8 h-8 rounded-full bg-[#DCE7C4] text-[#3B4C1D] font-bold text-xs flex items-center justify-center shrink-0 shadow-xs border border-white">
                      {item.step}
                    </div>

                    {/* Card Container */}
                    <div className="flex-1 bg-white/90 border border-[#EAE0D2] rounded-2xl px-4 py-2.5 flex items-center justify-between shadow-xs">
                      <span className="text-xs font-medium text-[#3E2723] truncate pr-2">
                        {item.title}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs font-bold text-[#4B5E26]">
                          {item.code}
                        </span>
                        <span className="text-[10px] bg-[#DCE7C4] text-[#3B4C1D] px-2.5 py-0.5 rounded-full font-semibold">
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
