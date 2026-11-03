import React from 'react';
import type { Book, SystemSettings, TransactionRecord } from '../types';

interface AdminDashboardProps {
  books: Book[];
  settings: SystemSettings;
  transactions: TransactionRecord[];
  onSelectTab?: (tab: 'kiosk' | 'dashboard' | 'books' | 'settings') => void;
  onOpenAddBook?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  books,
  settings,
  transactions,
  onSelectTab,
  onOpenAddBook,
}) => {
  // Live additions calculated on top of the established library benchmark
  const liveTransactions = transactions.length;
  const liveNewBooks = Math.max(0, books.length - 6);
  const liveAvailableDelta = books.filter((b) => b.status === 'Available').length - 4;

  const totalParticipants = 1204 + liveTransactions;
  const totalBooksCount = 3450 + liveNewBooks;
  const availableBooksCount = Math.max(0, 842 + liveAvailableDelta);

  const matchedLCount = 1200 + books.filter((b) => b.status === 'Matched' && b.source === 'Library').length;
  const matchedUCount = 1408 + books.filter((b) => b.status === 'Matched' && b.source === 'User').length;

  // Bar Chart Data (Category breakdown)
  const categoryBarData = [
    { label: 'ทั่วไป', value: 240, color: '#9ED8EB' },
    { label: 'เรียน', value: 180, color: '#FFB7A5' },
    { label: 'เยาวชน', value: 95, color: '#A8E6CF' },
    { label: 'การ์ตูน', value: 150, color: '#7CA992' },
    { label: 'เรื่องสั้น', value: 77, color: '#B4A7D6' },
    { label: 'นวนิยาย', value: 100, color: '#FFE58F' },
  ];

  const yTicks = [260, 195, 130, 65, 0];
  const maxY = 260;

  // Donut chart math
  // Circumference for r=46: 2 * PI * 46 = 289.02
  const r = 46;
  const c = 2 * Math.PI * r; // ~289.02
  const pStudents = 0.45; // 45% Sky Blue
  const pGeneral = 0.27; // 27% Lavender
  const pAlumni = 0.10; // 10% Sage Green
  const pStaff = 0.18; // 18% (to round nicely to 100) Coral

  const sStudents = pStudents * c;
  const sGeneral = pGeneral * c;
  const sAlumni = pAlumni * c;
  const sStaff = pStaff * c;

  // Offsets
  const offsetStudents = 0;
  const offsetGeneral = -sStudents;
  const offsetAlumni = -(sStudents + sGeneral);
  const offsetStaff = -(sStudents + sGeneral + sAlumni);

  // Exchange frequency counts
  const chainFrequency = [
    { label: '2 ครั้ง', count: 142 },
    { label: '3 ครั้ง', count: 56 },
    { label: '4 ครั้ง', count: 12 },
    { label: '5 ครั้งขึ้นไป', count: 3 },
  ];

  // Longest chain items matching layout
  const longestChainList = [
    { step: 1, title: 'Atomic Habits', code: 'L7' },
    { step: 2, title: 'The Great Gatsby', code: 'U15' },
    { step: 3, title: 'Sapiens', code: 'U17' },
    { step: 4, title: 'Thinking Fast and Slow', code: 'U25' },
    { step: 5, title: 'Steve Jobs', code: 'U42' },
  ];

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

      {/* 3. Three Metric Banner Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Sky Blue Card: ผู้เข้าร่วมกิจกรรมทั้งหมด */}
        <div
          style={{ height: '94px', width: '340.267px', maxWidth: '100%' }}
          className="bg-[#9ED8EB] border border-white/60 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between"
        >
          <span className="text-xs sm:text-sm font-semibold text-[#1F4B5B]">
            ผู้เข้าร่วมกิจกรรมทั้งหมด
          </span>
          <div className="text-2xl sm:text-3xl font-bold text-[#184E60] tracking-tight">
            {totalParticipants.toLocaleString()}
          </div>
        </div>

        {/* Coral Pink Card: หนังสือที่ถูกเพิ่มในระบบ */}
        <div
          style={{ height: '94px' }}
          className="bg-[#FFB7A5] border border-white/60 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between"
        >
          <span className="text-xs sm:text-sm font-semibold text-[#8B3A2B]">
            หนังสือที่ถูกเพิ่มในระบบ
          </span>
          <div className="text-2xl sm:text-3xl font-bold text-[#883122] tracking-tight">
            {totalBooksCount.toLocaleString()}
          </div>
        </div>

        {/* Sage Green Card: หนังสือคงเหลือ (Available) */}
        <div
          style={{ height: '94px' }}
          className="bg-[#7CA992] border border-white/60 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between"
        >
          <span className="text-xs sm:text-sm font-semibold text-[#143B2B]">
            หนังสือคงเหลือ (Available)
          </span>
          <div className="text-2xl sm:text-3xl font-bold text-[#0F3524] tracking-tight">
            {availableBooksCount.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 4. Middle Section (2 Columns: Left Chart 58%, Right 2 Cards 42%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left Column: หมวดหมู่หนังสือที่คงเหลือ (Bar Chart) */}
        <div
          style={{
            height: '437.111px',
            paddingTop: '21px',
            paddingBottom: '20px',
            paddingLeft: '19px',
            paddingRight: '19px',
          }}
          className="lg:col-span-7 bg-[#FAF5EE] border border-[#EADBCC] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[#263238] font-bold text-sm sm:text-base">
              หมวดหมู่หนังสือที่คงเหลือ
            </h2>
            <span className="text-[11px] text-[#717171] font-mono bg-[#EFE5D6] px-2.5 py-1 rounded-lg">
              รวม {categoryBarData.reduce((acc, c) => acc + c.value, 0).toLocaleString()} เล่ม
            </span>
          </div>

          <div
            style={{ width: '541.222px', height: '348.833px', maxWidth: '100%' }}
            className="flex-1 flex flex-col justify-end pt-4"
          >
            {/* Chart Area with Headroom for value labels */}
            <div className="relative pt-6">
              {/* Plot Frame (Y-axis + Bars) */}
              <div className="relative h-56 sm:h-60 flex">
                {/* Y Axis Column: exactly aligns with grid lines */}
                <div className="relative w-10 h-full select-none pr-2">
                  {yTicks.map((tick, i) => {
                    const topPct = (i / (yTicks.length - 1)) * 100;
                    return (
                      <span
                        key={tick}
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
                        key={tick}
                        style={{ top: `${topPct}%` }}
                        className="absolute left-0 right-0 border-t border-dashed border-[#E5DDD2] pointer-events-none"
                      />
                    );
                  })}

                  {/* Bars Container */}
                  <div className="absolute inset-0 flex items-end justify-around px-2 sm:px-4">
                    {categoryBarData.map((item) => {
                      const barHeightPercent = Math.min(100, Math.max(0, (item.value / maxY) * 100));

                      return (
                        <div
                          key={item.label}
                          className="relative flex flex-col items-center justify-end h-full w-8 sm:w-10 group"
                        >
                          {/* The Bar with exact mathematical height */}
                          <div
                            className="w-full relative rounded-t-lg sm:rounded-t-xl transition-all duration-500 shadow-xs group-hover:brightness-95"
                            style={{
                              height: `${barHeightPercent}%`,
                              backgroundColor: item.color,
                            }}
                          >
                            {/* Value Label positioned floating directly above the bar */}
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
                {categoryBarData.map((item, index) => {
                  let styleObj: React.CSSProperties | undefined;
                  if (index === 0) {
                    styleObj = { width: '65px', height: '15.9861px' };
                  } else if (index === 1) {
                    styleObj = { width: '50px', fontSize: '12px' };
                  } else if (index === 4) {
                    styleObj = { width: '54px' };
                  } else if (index === 5) {
                    styleObj = {
                      width: '52px',
                      height: '15.9861px',
                      paddingTop: '0px',
                      paddingLeft: '0px',
                    };
                  }

                  return (
                    <span
                      key={item.label}
                      style={styleObj}
                      className={`${styleObj?.width ? '' : 'w-10 '}text-center truncate`}
                    >
                      {item.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: 2 Stacked Cards */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Top Card: สถิติการแลกออก */}
          <div className="bg-[#FAF5EE] border border-[#EADBCC] rounded-2xl sm:rounded-3xl p-5 shadow-xs space-y-3">
            <h3 className="text-[#263238] font-bold text-sm sm:text-base">
              สถิติการแลกออก
            </h3>

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
                  หนังสือจากผู้เข้าร่วม (ตัวเลข)
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#263238] font-mono">
                  {matchedUCount.toLocaleString()} เล่ม
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Card: ประเภทสมาชิก */}
          <div className="bg-[#FAF5EE] border border-[#EADBCC] rounded-2xl sm:rounded-3xl p-5 shadow-xs flex-1 flex flex-col justify-between">
            <h3 className="text-[#263238] font-bold text-sm sm:text-base mb-2">
              ประเภทสมาชิก
            </h3>

            <div className="flex items-center justify-between gap-2 py-1">
              {/* Donut Chart with Surrounding Percentage Tags */}
              <div className="relative w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center shrink-0">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 120 120">
                  {/* Background Circle Track */}
                  <circle
                    cx="60"
                    cy="60"
                    r={r}
                    fill="none"
                    stroke="#F1E7D9"
                    strokeWidth="14"
                  />

                  {/* 1. CMU นักศึกษา (45% - Sky Blue) */}
                  <circle
                    cx="60"
                    cy="60"
                    r={r}
                    fill="none"
                    stroke="#9ED8EB"
                    strokeWidth="14"
                    strokeDasharray={`${sStudents} ${c}`}
                    strokeDashoffset={offsetStudents}
                  />

                  {/* 2. บุคคลทั่วไป (27% - Lavender) */}
                  <circle
                    cx="60"
                    cy="60"
                    r={r}
                    fill="none"
                    stroke="#B4A7D6"
                    strokeWidth="14"
                    strokeDasharray={`${sGeneral} ${c}`}
                    strokeDashoffset={offsetGeneral}
                  />

                  {/* 3. CMU ศิษย์เก่า (10% - Sage Green) */}
                  <circle
                    cx="60"
                    cy="60"
                    r={r}
                    fill="none"
                    stroke="#7CA992"
                    strokeWidth="14"
                    strokeDasharray={`${sAlumni} ${c}`}
                    strokeDashoffset={offsetAlumni}
                  />

                  {/* 4. CMU Staff (18% - Coral Pink) */}
                  <circle
                    cx="60"
                    cy="60"
                    r={r}
                    fill="none"
                    stroke="#FFB7A5"
                    strokeWidth="14"
                    strokeDasharray={`${sStaff} ${c}`}
                    strokeDashoffset={offsetStaff}
                  />
                </svg>

                {/* Percentage Overlay Labels around Donut */}
                <span className="absolute top-0 text-[10px] sm:text-[11px] font-bold text-[#1F4B5B]">
                  45%
                </span>
                <span
                  style={{ color: '#4e3532' }}
                  className="absolute left-1 text-[10px] sm:text-[11px] font-bold"
                >
                  18%
                </span>
                <span className="absolute bottom-1 left-7 text-[10px] sm:text-[11px] font-bold text-[#143B2B]">
                  10%
                </span>
                <span className="absolute bottom-1 right-5 text-[10px] sm:text-[11px] font-bold text-[#553C7B]">
                  27%
                </span>
              </div>

              {/* Legend Items */}
              <div className="space-y-2 text-xs text-[#4D4D4D] pr-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#9ED8EB] shrink-0" />
                    <span className="font-medium text-[11px] text-[#263238]">CMU นักศึกษา</span>
                  </div>
                  <span className="text-[11px] font-bold text-[#1F4B5B] font-mono">45%</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#B4A7D6] shrink-0" />
                    <span className="font-medium text-[11px] text-[#263238]">บุคคลทั่วไป</span>
                  </div>
                  <span className="text-[11px] font-bold text-[#553C7B] font-mono">27%</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FFB7A5] shrink-0" />
                    <span className="font-medium text-[11px] text-[#263238]">CMU Staff</span>
                  </div>
                  <span
                    style={{ color: '#433734' }}
                    className="text-[11px] font-bold font-mono"
                  >
                    18%
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#7CA992] shrink-0" />
                    <span className="font-medium text-[11px] text-[#263238]">CMU ศิษย์เก่า</span>
                  </div>
                  <span className="text-[11px] font-bold text-[#143B2B] font-mono">10%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Bottom Card: สถิติความถี่การส่งต่อหนังสือ (Exchange Chains) */}
      <div className="bg-[#FAF5EE] border border-[#EADBCC] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xs">
        <h2 className="text-[#263238] font-bold text-sm sm:text-base mb-5">
          สถิติความถี่การส่งต่อหนังสือ (Exchange Chains)
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Left Sub-column: จำนวนครั้งที่เกิดการแลกเปลี่ยนต่อเนื่อง */}
          <div>
            <h3 className="text-xs font-semibold text-[#263238] mb-3">
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
                  <span className="bg-[#6B9F87] text-white font-medium text-xs px-3.5 py-1 rounded-full shadow-xs">
                    {item.count} การส่งต่อ
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Sub-column: เส้นทางที่มีการส่งต่อสูงสุด (Longest Chain) */}
          <div>
            <h3 className="text-xs font-semibold text-[#263238] mb-3">
              เส้นทางที่มีการส่งต่อสูงสุด (Longest Chain)
            </h3>

            <div className="relative space-y-2.5">
              {/* Vertical dotted connector line running behind the numbered circles */}
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
                    <span className="font-mono text-xs font-semibold text-[#7CA992] shrink-0">
                      {item.code}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
