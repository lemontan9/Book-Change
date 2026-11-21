import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Download,
  BookOpen,
  Camera,
  Upload,
  X,
  ChevronDown,
  ChevronsUpDown,
  ArrowUpDown,
  DownloadCloud,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { Book, SystemSettings, TransactionRecord } from '../types';
import { StorageService } from '../services/storage';
import { BookCover } from '../components/BookCover';
import { CameraCaptureModal } from '../components/CameraCaptureModal';

interface AdminBookListProps {
  books: Book[];
  settings: SystemSettings;
  onUpdateBooks: (books: Book[]) => void;
  onSyncToGoogle?: (updatedBooks?: Book[]) => void;
  onPullFromGoogleSheet?: () => Promise<{ books: Book[]; transactions: TransactionRecord[] }>;
  onAddBookToGoogle?: (
    newBook: Book,
    updatedBooks: Book[]
  ) => Promise<{ synced: boolean; reason?: 'no_auth' | 'error'; error?: string }>;
  onSelectTab?: (tab: 'kiosk' | 'dashboard' | 'books' | 'settings') => void;
}

type SortColumn = 'code' | 'title' | 'category' | 'source' | 'status';
type SortDirection = 'asc' | 'desc';

export const AdminBookList: React.FC<AdminBookListProps> = ({
  books,
  settings,
  onUpdateBooks,
  onSyncToGoogle,
  onPullFromGoogleSheet,
  onAddBookToGoogle,
  onSelectTab,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn>('code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [isSavingBook, setIsSavingBook] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewingBook, setViewingBook] = useState<Book | null>(null);

  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookCategory, setNewBookCategory] = useState(settings.categories[0] || 'หนังสือทั่วไป');
  const [newBookPrice, setNewBookPrice] = useState<number>(200);
  const [newBookCover, setNewBookCover] = useState<string | undefined>(undefined);
  const [isCameraOpenForAdd, setIsCameraOpenForAdd] = useState(false);

  const nextLCode = StorageService.getNextLCode();

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const filteredBooks = useMemo(() => {
    return books.filter((b: Book) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        b.code.toLowerCase().includes(q) ||
        b.title.toLowerCase().includes(q) ||
        (b.memberType && b.memberType.toLowerCase().includes(q)) ||
        b.category.toLowerCase().includes(q);

      const matchStatus = statusFilter === 'all' || b.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [books, searchQuery, statusFilter]);

  const sortedBooks = useMemo(() => {
    const list = [...filteredBooks];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortColumn === 'code') {
        cmp = a.code.localeCompare(b.code, undefined, { numeric: true });
      } else if (sortColumn === 'title') {
        cmp = a.title.localeCompare(b.title);
      } else if (sortColumn === 'category') {
        cmp = a.category.localeCompare(b.category);
      } else if (sortColumn === 'source') {
        cmp = a.source.localeCompare(b.source);
      } else if (sortColumn === 'status') {
        cmp = a.status.localeCompare(b.status);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredBooks, sortColumn, sortDirection]);

  const handlePullFromGoogleSheet = async () => {
    if (!onPullFromGoogleSheet) return;
    setIsPulling(true);
    setSyncNotice(null);
    try {
      const result = await onPullFromGoogleSheet();
      setSyncNotice({
        type: 'success',
        text: `Sync ข้อมูลจาก Google Sheet สำเร็จ! ดึงข้อมูลล่าสุดทั้งหมด ${result.books.length.toLocaleString()} เล่ม เรียบร้อยแล้ว`,
      });
    } catch (err: any) {
      console.error('Pull from Google Sheet error:', err);
      setSyncNotice({
        type: 'error',
        text: `ไม่สามารถดึงข้อมูลจาก Google Sheet ได้: ${err?.message || 'โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือสิทธิ์แชร์ของชีต'}`,
      });
    } finally {
      setIsPulling(false);
    }
  };

  const handleCreateCentralBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookTitle.trim() || isSavingBook) return;

    setIsSavingBook(true);
    setSyncNotice(null);

    try {
      // Atomically allocate next unique L code that has never been used
      const assignedLCode = StorageService.allocateNextLCode();

      const newBook: Book = {
        id: `book-${Date.now()}-${assignedLCode}`,
        code: assignedLCode,
        title: newBookTitle.trim(),
        category: newBookCategory,
        price: newBookPrice,
        status: 'Available',
        source: 'Library',
        coverImage: newBookCover,
        createdAt: new Date().toISOString(),
        exchangeCount: 1,
      };

      const updated = StorageService.sortBooks([newBook, ...books]);
      StorageService.saveBooks(updated);
      onUpdateBooks(updated);

      if (onAddBookToGoogle) {
        const res = await onAddBookToGoogle(newBook, updated);
        if (res.synced) {
          setSyncNotice({
            type: 'success',
            text: `เพิ่มหนังสือ "${newBook.title}" (รหัส ${newBook.code}) และบันทึกลง Google Sheet ทันทีเรียบร้อยแล้ว!`,
          });
        } else if (res.reason === 'no_auth') {
          setSyncNotice({
            type: 'info',
            text: `เพิ่มหนังสือ "${newBook.title}" (รหัส ${newBook.code}) ในเครื่องแล้ว กรุณาลงชื่อเข้าใช้ด้วย Google เพื่อให้ระบบบันทึกลง Google Sheet`,
          });
        } else {
          setSyncNotice({
            type: 'error',
            text: `เพิ่มหนังสือรหัส ${newBook.code} ในเครื่องแล้ว แต่บันทึกขึ้น Google Sheet ไม่สำเร็จ: ${res.error || 'โปรดตรวจสอบสิทธิ์การแก้ไขชีต'}`,
          });
        }
      } else if (onSyncToGoogle) {
        await onSyncToGoogle(updated);
      }

      setNewBookTitle('');
      setNewBookPrice(200);
      setNewBookCover(undefined);
      setIsAddModalOpen(false);
    } finally {
      setIsSavingBook(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setNewBookCover(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleToggleStatus = (book: Book) => {
    const newStatus = book.status === 'Available' ? 'Matched' : 'Available';
    const updated = books.map((b) =>
      b.id === book.id
        ? {
            ...b,
            status: newStatus as any,
            matchedAt: newStatus === 'Matched' ? new Date().toISOString() : undefined,
          }
        : b
    );
    StorageService.saveBooks(updated);
    onUpdateBooks(updated);
    if (viewingBook?.id === book.id) {
      setViewingBook((prev) => (prev ? { ...prev, status: newStatus as any } : null));
    }
    if (onSyncToGoogle) onSyncToGoogle(updated);
  };

  const formatCategory = (cat: string) => {
    return cat.replace(/\/.*$/, '').trim();
  };

  const formatSource = (b: Book) => {
    if (b.source === 'Library') {
      return 'ส่วนกลาง (L)';
    }
    if (b.memberType) {
      return `User (${b.memberType})`;
    }
    return 'ผู้แลก (U)';
  };

  return (
    <div className="pb-24 pt-5 max-w-6xl mx-auto px-4 min-h-[calc(100vh-8rem)] font-sans space-y-4">
      {/* 1. Top Header Card */}
      <div className="bg-[#FFFCF7]/95 backdrop-blur-sm border border-[#EAE0D2] rounded-[28px] sm:rounded-[34px] p-5 sm:p-6 shadow-[0_18px_48px_rgba(92,58,33,0.09)]">
        <h1 className="text-lg sm:text-xl font-bold text-[#4E342E] tracking-tight">
          ระบบแลกเปลี่ยนหนังสือ สำนักหอสมุด
        </h1>
        <p className="text-xs text-[#7E7369] font-medium mt-1">
          ส่วนการจัดการสำหรับเจ้าหน้าที่ (Book List)
        </p>
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
            className="text-[#4E342E] hover:bg-[#F8F2E7] px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => onSelectTab?.('books')}
            className="bg-[#7D502E] text-white px-5 py-2 rounded-full text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
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

        {/* Action Button: เพิ่มหนังสือ */}
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="bg-gradient-to-r from-[#875835] to-[#744829] hover:from-[#754B2B] hover:to-[#603A1F] active:scale-[0.98] text-white px-5 py-2 rounded-full text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer"
        >
          + เพิ่มหนังสือ
        </button>
      </div>

      {/* 3. Main Card: รายการหนังสือทั้งหมดในระบบ */}
      <div className="bg-[#FFFCF7]/95 backdrop-blur-sm border border-[#EAE0D2] rounded-[28px] sm:rounded-[34px] p-5 sm:p-6 shadow-[0_18px_48px_rgba(92,58,33,0.09)] space-y-4">
        {/* Card Header & Controls Strip */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-1">
          <h2 className="text-[#4E342E] font-bold text-base sm:text-lg">
            รายการหนังสือทั้งหมดในระบบ
          </h2>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Status Dropdown */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none bg-white border border-[#E5D8C8] rounded-full pl-3.5 pr-8 py-2 text-xs text-[#3E2723] font-medium shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#7D502E] cursor-pointer"
              >
                <option value="all">สถานะทั้งหมด</option>
                <option value="Available">Available (พร้อมแลก)</option>
                <option value="Matched">Matched (แลกแล้ว)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#7E7369] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:flex-initial">
              <input
                type="text"
                placeholder="ค้นหารหัส หรือ ชื่อเรื่อง..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-52 bg-white border border-[#E5D8C8] rounded-full px-4 py-2 text-xs text-[#3E2723] placeholder-[#9E9185] shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#7D502E]"
              />
            </div>

            {/* Sync from Google Sheet Button */}
            {onPullFromGoogleSheet && (
              <button
                type="button"
                disabled={isPulling}
                onClick={handlePullFromGoogleSheet}
                className="bg-[#DCE7C4] hover:bg-[#CEDEB0] text-[#4B5E26] border border-[#C3D3A6] rounded-full px-4 py-2 text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                title="ดึงข้อมูลหนังสือล่าสุดจาก Google Sheet เข้ามาแสดงในระบบ"
              >
                {isPulling ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <DownloadCloud className="w-3.5 h-3.5 text-[#4B5E26]" />
                )}
                <span>{isPulling ? 'กำลัง Sync...' : 'Sync จาก Google Sheet'}</span>
              </button>
            )}

            {/* Export .xls Button */}
            <button
              type="button"
              onClick={() => StorageService.exportBooksToExcel(books)}
              className="bg-[#F8F2E7] hover:bg-[#EFE2CA] text-[#5C3A21] border border-[#E5D8C8] rounded-full px-4 py-2 text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              title="ดาวน์โหลดไฟล์ Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .xls</span>
            </button>
          </div>
        </div>

        {/* Sync Feedback Banner */}
        {syncNotice && (
          <div
            className={`p-3 rounded-2xl text-xs flex items-center gap-2 shadow-2xs ${
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

        {/* Data Table */}
        <div className="overflow-x-auto rounded-2xl">
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead>
              <tr className="border-b border-[#EAE0D2] text-[#4E342E] text-xs font-semibold">
                <th className="py-3 px-3 w-16 text-center">หน้าปก</th>
                <th
                  onClick={() => handleSort('code')}
                  style={{ width: '122.583px' }}
                  className="py-3 px-3 cursor-pointer hover:text-[#7D502E] transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>รหัสหนังสือ</span>
                    <ChevronsUpDown className="w-3 h-3 text-[#8E8176]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('title')}
                  className="py-3 px-3 cursor-pointer hover:text-[#7D502E] transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>ชื่อเรื่อง</span>
                    <ChevronsUpDown className="w-3 h-3 text-[#8E8176]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('category')}
                  className="py-3 px-3 cursor-pointer hover:text-[#7D502E] transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>หมวดหมู่</span>
                    <ChevronsUpDown className="w-3 h-3 text-[#8E8176]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('source')}
                  className="py-3 px-3 cursor-pointer hover:text-[#7D502E] transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>ที่มา</span>
                    <ChevronsUpDown className="w-3 h-3 text-[#8E8176]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-[#7D502E] transition-colors select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>สถานะ</span>
                    <ChevronsUpDown className="w-3 h-3 text-[#8E8176]" />
                  </div>
                </th>
                <th className="py-3 px-3 text-center">จัดการ</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#EAE0D2]/70 text-xs text-[#3E2723]">
              {sortedBooks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#7E7369]">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30 text-[#7E7369]" />
                    <span>ไม่พบข้อมูลหนังสือตามเงื่อนไขที่เลือก</span>
                  </td>
                </tr>
              ) : (
                sortedBooks.map((book) => {
                  const isAvailable = book.status === 'Available';
                  const isMatched = book.status === 'Matched';

                  return (
                    <tr
                      key={book.id}
                      className="hover:bg-white/40 transition-colors"
                    >
                      {/* หน้าปก */}
                      <td className="py-3.5 px-3 text-center">
                        <div
                          onClick={() => setViewingBook(book)}
                          className="w-10 h-13 rounded-xl bg-white border border-[#EAE0D2] shadow-xs flex flex-col items-center justify-center overflow-hidden cursor-pointer mx-auto transition-transform hover:scale-105"
                          title="ดูหน้าปก / ข้อมูล"
                        >
                          {book.coverImage ? (
                            <img
                              src={book.coverImage}
                              alt={book.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-[9px] text-[#7E7369] leading-tight text-center font-medium">
                              เพิ่ม
                              <br />
                              รูป
                            </div>
                          )}
                        </div>
                      </td>

                      {/* รหัสหนังสือ */}
                      <td
                        style={{ width: '122.583px', height: '76.8889px' }}
                        className="py-3.5 px-3 font-bold font-mono text-[#4E342E] text-xs sm:text-sm"
                      >
                        {book.code}
                      </td>

                      {/* ชื่อเรื่อง */}
                      <td className="py-3.5 px-3 font-medium text-[#3E2723] max-w-[220px]">
                        <span className="truncate block" title={book.title}>
                          {book.title}
                        </span>
                      </td>

                      {/* หมวดหมู่ */}
                      <td className="py-3.5 px-3 text-[#4E342E] font-normal">
                        {formatCategory(book.category)}
                      </td>

                      {/* ที่มา */}
                      <td className="py-3.5 px-3 text-[#7E7369] font-normal whitespace-nowrap">
                        {formatSource(book)}
                      </td>

                      {/* สถานะ */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {isAvailable ? (
                          <span className="bg-[#DCE7C4] text-[#3B4C1D] border border-[#CBD6A6] font-semibold text-xs px-3.5 py-1 rounded-full inline-block shadow-2xs">
                            Available
                          </span>
                        ) : isMatched ? (
                          <div className="inline-flex flex-col items-center gap-1">
                            <span className="bg-[#EFE2CA] text-[#7D502E] border border-[#DFCEB2] font-semibold text-xs px-3.5 py-1 rounded-full inline-block shadow-2xs">
                              Matched
                            </span>
                            {book.matchedTransactionId && (
                              <span
                                className="font-mono text-[10px] text-[#5C3A21] bg-[#F8F2E7] border border-[#E5D8C8] px-2 py-0.5 rounded-full font-medium"
                                title="รหัส Transaction ที่ Match รายการนี้"
                              >
                                {book.matchedTransactionId}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="bg-[#F3E7D3] text-[#5C3A21] font-semibold text-xs px-3.5 py-1 rounded-full inline-block">
                            {book.status}
                          </span>
                        )}
                      </td>

                      {/* จัดการ */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setViewingBook(book)}
                          className="text-xs text-[#7D502E] hover:text-[#5C3A21] underline underline-offset-3 cursor-pointer font-semibold"
                        >
                          ดูรายละเอียด
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Central Book (L) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-[#FFFCF7] rounded-t-[28px] sm:rounded-[28px] w-full max-w-lg p-6 shadow-2xl border border-[#EAE0D2]">
            <div className="flex items-center justify-between pb-3 border-b border-[#EFE6D8] mb-4">
              <div>
                <h3 className="font-bold text-[#4E342E] text-base">
                  เพิ่มหนังสือสู่คลังส่วนกลาง
                </h3>
                <p className="text-xs text-[#7E7369] mt-0.5">
                  รหัสอัตโนมัติ: <strong className="font-mono text-[#4B5E26]">{nextLCode}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white border border-[#E5D8C8] flex items-center justify-center text-[#7E7369] hover:text-[#3E2723] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCentralBook} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#4E342E] mb-1.5">
                  ชื่อเรื่องหนังสือ <span className="text-[#D32F2F]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น Atomic Habits"
                  value={newBookTitle}
                  onChange={(e) => setNewBookTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-[#DDD0BF] text-xs bg-white text-[#3A2D26] focus:outline-none focus:ring-2 focus:ring-[#7D502E]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4E342E] mb-1.5">
                    หมวดหมู่
                  </label>
                  <select
                    value={newBookCategory}
                    onChange={(e) => setNewBookCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-[#DDD0BF] text-xs bg-white text-[#3A2D26] font-medium focus:outline-none focus:ring-2 focus:ring-[#7D502E]"
                  >
                    {settings.categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4E342E] mb-1.5">
                    ราคา (บาท)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newBookPrice}
                    onChange={(e) => setNewBookPrice(Number(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-[#DDD0BF] text-xs font-mono text-[#3A2D26] bg-white focus:outline-none focus:ring-2 focus:ring-[#7D502E]"
                  />
                </div>
              </div>

              {/* Cover photo */}
              <div>
                <label className="block text-xs font-semibold text-[#4E342E] mb-1.5">
                  รูปหน้าปก
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-16 rounded-xl border border-[#DDD0BF] overflow-hidden bg-white flex items-center justify-center shrink-0 shadow-2xs">
                    {newBookCover ? (
                      <img src={newBookCover} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen className="w-5 h-5 text-[#7E7369] opacity-40" />
                    )}
                  </div>
                  <div className="flex gap-2 flex-1">
                    <button
                      type="button"
                      onClick={() => setIsCameraOpenForAdd(true)}
                      className="flex-1 py-2 text-xs font-semibold text-[#5C3A21] bg-[#F8F2E7] hover:bg-[#EFE2CA] rounded-full flex items-center justify-center gap-1 border border-[#E5D8C8] cursor-pointer transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      กล้อง
                    </button>
                    <label className="flex-1 py-2 text-xs font-semibold text-[#4E342E] bg-white border border-[#E5D8C8] rounded-full flex items-center justify-center gap-1 cursor-pointer hover:bg-[#F8F2E7] transition-colors">
                      <Upload className="w-3.5 h-3.5 text-[#7D502E]" />
                      ไฟล์
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#EFE6D8]">
                <button
                  type="button"
                  disabled={isSavingBook}
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs text-[#6D5C50] hover:text-[#3E2723] font-medium cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingBook}
                  className="px-6 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#875835] to-[#744829] hover:from-[#754B2B] hover:to-[#603A1F] rounded-full shadow-xs transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                >
                  {isSavingBook && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSavingBook ? 'กำลังบันทึกลง Google Sheet...' : 'บันทึกหนังสือ'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Details */}
      {viewingBook && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-[#FFFCF7] rounded-t-[28px] sm:rounded-[28px] w-full max-w-md p-6 shadow-2xl border border-[#EAE0D2]">
            <div className="flex items-center justify-between pb-3 border-b border-[#EFE6D8] mb-4">
              <span
                className={`font-mono font-bold text-xs text-white px-3 py-1 rounded-full ${
                  viewingBook.code.startsWith('L') ? 'bg-[#7D502E]' : 'bg-[#4B5E26]'
                }`}
              >
                {viewingBook.code}
              </span>
              <button
                type="button"
                onClick={() => setViewingBook(null)}
                className="w-8 h-8 rounded-full bg-white border border-[#E5D8C8] flex items-center justify-center text-[#7E7369] hover:text-[#3E2723] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-4 mb-4">
              <div className="w-20 h-28 rounded-2xl overflow-hidden border border-[#EAE0D2] shrink-0 bg-white shadow-xs">
                <BookCover
                  title={viewingBook.title}
                  category={viewingBook.category}
                  code={viewingBook.code}
                  coverImage={viewingBook.coverImage}
                />
              </div>
              <div className="flex-1 text-xs space-y-1.5">
                <h4 className="font-bold text-sm text-[#4E342E] line-clamp-2">
                  {viewingBook.title}
                </h4>
                <div className="text-xs text-[#7E7369]">
                  หมวด: <strong className="text-[#4E342E] font-medium">{viewingBook.category}</strong>
                </div>
                <div className="text-xs text-[#7E7369]">
                  ราคา: <span className="font-mono font-bold text-[#4B5E26]">฿{viewingBook.price}</span>
                </div>
                <div className="text-xs text-[#7E7369]">
                  แหล่งที่มา: <span className="font-medium text-[#4E342E]">{viewingBook.source === 'Library' ? 'ส่วนกลาง (L)' : 'ผู้แลก (U)'}</span>
                </div>
                {viewingBook.memberType && (
                  <div className="text-xs text-[#7E7369]">
                    กลุ่มผู้แลก: <span className="font-medium text-[#4E342E]">{viewingBook.memberType}</span>
                  </div>
                )}
                <div className="text-xs text-[#7E7369]">
                  สถานะ:{' '}
                  {viewingBook.status === 'Available' ? (
                    <span className="bg-[#DCE7C4] text-[#3B4C1D] border border-[#CBD6A6] font-semibold text-[11px] px-2.5 py-0.5 rounded-full inline-block">
                      Available
                    </span>
                  ) : viewingBook.status === 'Matched' ? (
                    <span className="bg-[#EFE2CA] text-[#7D502E] border border-[#DFCEB2] font-semibold text-[11px] px-2.5 py-0.5 rounded-full inline-block">
                      Matched
                    </span>
                  ) : (
                    <span className="bg-[#F3E7D3] text-[#5C3A21] font-semibold text-[11px] px-2.5 py-0.5 rounded-full inline-block">
                      {viewingBook.status}
                    </span>
                  )}
                </div>

                {viewingBook.matchedTransactionId && (
                  <div className="text-xs text-[#7E7369]">
                    Transaction ที่ Match:{' '}
                    <span className="font-mono font-bold text-[#5C3A21] bg-[#F8F2E7] border border-[#E5D8C8] px-2 py-0.5 rounded-full">
                      {viewingBook.matchedTransactionId}
                    </span>
                  </div>
                )}
                {viewingBook.matchedWithCode && (
                  <div className="text-xs text-[#7E7369]">
                    แลกคู่กับรหัส:{' '}
                    <span className="font-mono font-bold text-[#7D502E]">
                      {viewingBook.matchedWithCode}
                    </span>
                  </div>
                )}
                {viewingBook.matchedAt && (
                  <div className="text-[11px] text-[#8E8176]">
                    เวลาที่แลก:{' '}
                    <span>
                      {new Date(viewingBook.matchedAt).toLocaleString('th-TH')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Toggle Status Action */}
            <div className="bg-[#F8F2E7] border border-[#E5D8C8] rounded-2xl p-3.5 text-xs space-y-2 mb-4 shadow-xs">
              <div className="text-[11px] text-[#7E7369]">
                สลับสถานะหนังสือ:
              </div>
              <button
                type="button"
                onClick={() => handleToggleStatus(viewingBook)}
                className={`w-full py-2.5 rounded-full text-xs font-semibold shadow-xs transition-colors cursor-pointer ${
                  viewingBook.status === 'Available'
                    ? 'bg-[#EFE2CA] hover:bg-[#E5D3B3] text-[#5C3A21] border border-[#DFCEB2]'
                    : 'bg-[#DCE7C4] hover:bg-[#CEDDA9] text-[#3B4C1D] border border-[#CBD6A6]'
                }`}
              >
                {viewingBook.status === 'Available'
                  ? 'เปลี่ยนสถานะเป็น Matched (แลกแล้ว)'
                  : 'เปลี่ยนสถานะเป็น Available (พร้อมแลก)'}
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setViewingBook(null)}
                className="px-5 py-2 text-xs font-semibold text-[#5C3A21] hover:bg-[#F8F2E7] bg-white border border-[#E5D8C8] rounded-full cursor-pointer shadow-xs"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
      {isCameraOpenForAdd && (
        <CameraCaptureModal
          isOpen={isCameraOpenForAdd}
          onClose={() => setIsCameraOpenForAdd(false)}
          onCapture={(dataUrl) => {
            setNewBookCover(dataUrl);
            setIsCameraOpenForAdd(false);
          }}
          bookCode={nextLCode}
        />
      )}
    </div>
  );
};
