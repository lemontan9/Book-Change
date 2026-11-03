import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  BookOpen,
  Users,
  Repeat,
  Layers,
} from 'lucide-react';
import type { Book, SystemSettings, TransactionRecord } from '../types';
import { fetchBooksFromSheet, fetchTransactionsFromSheet } from '../services/googleSheets';
import { getAccessToken } from '../services/firebaseAuth';

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
  settings,
  googleConnected,
  onConnectGoogle,
  onSelectTab,
  onOpenAddBook,
}) => {
  const spreadsheetId = settings.connectedSpreadsheetId?.trim();

  // Real Google Sheets data states
  const [sheetBooks, setSheetBooks] = useState<Book[]>([]);
  const [sheetTransactions, setSheetTransactions] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [isFetched, setIsFetched] = useState<boolean>(false);

  // Fetch real data exclusively from Google Spreadsheet
  const loadDataFromGoogleSheet = useCallback(async () => {
    if (!spreadsheetId) {
      setSheetBooks([]);
      setSheetTransactions([]);
      setIsFetched(true);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('ยังไม่ได้ลงชื่อเข้าใช้ด้วย Google หรือบัญชีหมดอายุ กรุณาเชื่อมต่อ Google');
      }

      // Fetch Books and Transactions sheets concurrently
      const [fetchedBooks, fetchedTransactions] = await Promise.all([
        fetchBooksFromSheet(token, spreadsheetId),
        fetchTransactionsFromSheet(token, spreadsheetId).catch(() => []),
      ]);

      setSheetBooks(fetchedBooks);
      setSheetTransactions(fetchedTransactions);
      setLastFetchedAt(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setIsFetched(true);
    } catch (err: any) {
      console.error('Failed to load Dashboard data from Google Sheet:', err);
      setErrorMsg(err.message || 'ไม่สามารถโหลดข้อมูลจาก Google Sheet ได้');
      // On error, keep data strictly 0 (no fake benchmark)
      setSheetBooks([]);
      setSheetTransactions([]);
      setIsFetched(true);
    } finally {
      setIsLoading(false);
    }
  }, [spreadsheetId]);

  // Load from Google Sheet automatically on mount or when spreadsheetId changes
  useEffect(() => {
    loadDataFromGoogleSheet();
  }, [loadDataFromGoogleSheet]);

  // 1. Metric Counts strictly from Google Sheet
  const totalParticipants = sheetTransactions.length;
  const totalBooksCount = sheetBooks.length;
  const availableBooksCount = sheetBooks.filter((b) => b.status === 'Available').length;

  const matchedLCount = sheetBooks.filter(
    (b) => b.status === 'Matched' && (b.code.toUpperCase().startsWith('L') || b.source === 'Library')
  ).length;

  const matchedUCount = sheetBooks.filter(
    (b) => b.status === 'Matched' && (b.code.toUpperCase().startsWith('U') || b.source === 'User')
  ).length;

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

      {/* 3. Google Spreadsheet Real Data Status Banner */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-[#E8ECF2] shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E8F5E9] border border-[#4CAF4F]/20 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-[#2E7D32]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-semibold text-[#263238]">
                  แหล่งข้อมูลสถิติ: Google Spreadsheet
                </span>
                {spreadsheetId ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2E7D32] bg-[#E8F5E9] px-2.5 py-0.5 rounded-full border border-[#4CAF4F]/30">
                    <CheckCircle2 className="w-3 h-3" />
                    เชื่อมต่อสด (Live Sheet)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#D32F2F] bg-[#FFEBEE] px-2.5 py-0.5 rounded-full border border-[#FFCDD2]">
                    <AlertCircle className="w-3 h-3" />
                    ยังไม่ได้เชื่อมต่อ Sheet
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#717171] mt-0.5">
                {spreadsheetId ? (
                  <>
                    Spreadsheet ID:{' '}
                    <span className="font-mono text-[#2A3B4C] bg-[#F5F7FA] px-1.5 py-0.5 rounded border border-[#E8ECF2]">
                      {spreadsheetId.slice(0, 16)}...{spreadsheetId.slice(-6)}
                    </span>
                    {lastFetchedAt && (
                      <span className="ml-2 text-[#2E7D32]">
                        (อัปเดตล่าสุด {lastFetchedAt})
                      </span>
                    )}
                  </>
                ) : (
                  'ไม่มีการใช้ข้อมูลจำลอง Dashboard คำนวณจากแถวข้อมูลจริงใน Google Sheet เท่านั้น'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {spreadsheetId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                target="_blank"
                rel="noreferrer"
                className="py-1.5 px-3 rounded-xl border border-[#E8ECF2] text-xs font-medium text-[#4D4D4D] hover:bg-[#F5F7FA] flex items-center gap-1.5 transition-colors cursor-pointer"
                title="เปิดดูไฟล์ Google Sheet บน Google Drive"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#717171]" />
                <span className="hidden sm:inline">เปิดดู Google Sheet</span>
              </a>
            )}

            <button
              type="button"
              disabled={isLoading || !spreadsheetId}
              onClick={loadDataFromGoogleSheet}
              className="flex-1 sm:flex-none py-1.5 px-3.5 rounded-xl bg-[#2A3B4C] hover:bg-[#1E2B38] disabled:opacity-50 text-white text-xs font-medium flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'กำลังดึงข้อมูลสด...' : 'รีเฟรชข้อมูลจาก Sheet'}</span>
            </button>
          </div>
        </div>

        {/* Warning if no sheet connected */}
        {!spreadsheetId && (
          <div className="mt-3 p-3 bg-[#FFF9E6] border border-[#FFE082] rounded-xl text-xs text-[#8D6E14] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#F57C00] shrink-0" />
              <span>
                ยังไม่ได้ระบุ Google Spreadsheet ID ในระบบ ข้อมูลสถิติจะแสดงเป็น 0 จนกว่าจะเชื่อมต่อ
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onSelectTab) onSelectTab('settings');
              }}
              className="px-3 py-1 bg-[#F57C00] hover:bg-[#E65100] text-white text-xs font-medium rounded-lg shadow-xs cursor-pointer"
            >
              ไปหน้าตั้งค่าเพื่อเชื่อมต่อ Sheet
            </button>
          </div>
        )}

        {/* Error notification if fetch failed */}
        {errorMsg && (
          <div className="mt-3 p-3 bg-[#FFEBEE] border border-[#FFCDD2] rounded-xl text-xs text-[#D32F2F] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#D32F2F] shrink-0" />
              <span>ข้อผิดพลาด: {errorMsg}</span>
            </div>
            {!googleConnected && onConnectGoogle && (
              <button
                type="button"
                onClick={onConnectGoogle}
                className="px-3 py-1 bg-[#D32F2F] hover:bg-[#B71C1C] text-white text-xs font-medium rounded-lg shadow-xs cursor-pointer"
              >
                ลงชื่อเข้าใช้ Google อีกครั้ง
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. Three Metric Banner Cards (Computed 100% from Google Sheet) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Sky Blue Card: ผู้เข้าร่วมกิจกรรมทั้งหมด */}
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
          <div className="text-2xl sm:text-3xl font-bold text-[#184E60] tracking-tight">
            {totalParticipants.toLocaleString()}
            <span className="text-xs font-normal text-[#1F4B5B] ml-2">คน</span>
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
