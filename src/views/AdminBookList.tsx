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
} from 'lucide-react';
import type { Book, SystemSettings } from '../types';
import { StorageService } from '../services/storage';
import { BookCover } from '../components/BookCover';
import { CameraCaptureModal } from '../components/CameraCaptureModal';

interface AdminBookListProps {
  books: Book[];
  settings: SystemSettings;
  onUpdateBooks: (books: Book[]) => void;
  onSyncToGoogle?: (updatedBooks?: Book[]) => void;
  onSelectTab?: (tab: 'kiosk' | 'dashboard' | 'books' | 'settings') => void;
}

type SortColumn = 'code' | 'title' | 'category' | 'source' | 'status';
type SortDirection = 'asc' | 'desc';

export const AdminBookList: React.FC<AdminBookListProps> = ({
  books,
  settings,
  onUpdateBooks,
  onSyncToGoogle,
  onSelectTab,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn>('code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

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
        (b.ownerName && b.ownerName.toLowerCase().includes(q)) ||
        (b.ownerPhone && b.ownerPhone.includes(q)) ||
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

  const handleCreateCentralBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookTitle.trim()) return;

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

    setNewBookTitle('');
    setNewBookPrice(200);
    setNewBookCover(undefined);
    setIsAddModalOpen(false);

    if (onSyncToGoogle) onSyncToGoogle(updated);
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
    const phone = b.ownerPhone ? b.ownerPhone.replace(/\D/g, '') : '';
    if (phone.length >= 3) {
      return `User (${phone.slice(0, 3)}-xxx)`;
    }
    return 'User (081-xxx)';
  };

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
            className="text-[#4D4D4D] hover:text-[#2A3B4C] px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer"
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => onSelectTab?.('books')}
            className="bg-[#2A3B4C] text-white px-5 py-2 rounded-xl text-xs sm:text-sm font-medium shadow-xs transition-colors cursor-pointer"
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
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#2A3B4C] hover:bg-[#1E2B38] active:scale-[0.98] text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-medium shadow-xs transition-all cursor-pointer tracking-tight"
        >
          เพิ่มหนังสือ
        </button>
      </div>

      {/* 3. Main Card: รายการหนังสือทั้งหมดในระบบ */}
      <div
        style={{
          paddingTop: '20px',
          paddingBottom: '20px',
          paddingLeft: '20px',
          paddingRight: '20px',
        }}
        className="bg-[#FAF5EE] border border-[#EADBCC] rounded-2xl sm:rounded-3xl shadow-xs space-y-4"
      >
        {/* Card Header & Controls Strip */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-1">
          <h2 className="text-[#263238] font-bold text-base sm:text-lg">
            รายการหนังสือทั้งหมดในระบบ
          </h2>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Status Dropdown */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none bg-white border border-[#EADBCC] rounded-xl pl-3 pr-8 py-2 text-xs text-[#263238] font-medium shadow-xs focus:outline-none focus:ring-1 focus:ring-[#7A4B30] cursor-pointer"
              >
                <option value="all">สถานะทั้งหมด</option>
                <option value="Available">Available (พร้อมแลก)</option>
                <option value="Matched">Matched (แลกแล้ว)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#717171] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:flex-initial">
              <input
                type="text"
                placeholder="ค้นหารหัส หรือ ชื่อเรื่อง..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-56 bg-white border border-[#EADBCC] rounded-xl px-3.5 py-2 text-xs text-[#263238] placeholder-[#9A9188] shadow-xs focus:outline-none focus:ring-1 focus:ring-[#7A4B30]"
              >
              </input>
            </div>

            {/* Export .xls Button */}
            <button
              type="button"
              onClick={() => StorageService.exportBooksToExcel(books)}
              className="bg-[#BEE5D3] hover:bg-[#A9DAC1] text-[#1E5C3B] border border-[#A2D4BB] rounded-xl px-3.5 py-2 text-xs font-medium shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              title="ดาวน์โหลดไฟล์ Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .xls</span>
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-xl">
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead>
              <tr className="border-b border-[#EADBCC]/60 text-[#263238] text-xs font-semibold">
                <th className="py-3 px-3 w-16 text-center">หน้าปก</th>
                <th
                  onClick={() => handleSort('code')}
                  style={{ width: '122.583px' }}
                  className="py-3 px-3 cursor-pointer hover:text-[#7A4B30] transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>รหัสหนังสือ</span>
                    <ChevronsUpDown className="w-3 h-3 text-[#8A7E74]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('title')}
                  className="py-3 px-3 cursor-pointer hover:text-[#7A4B30] transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>ชื่อเรื่อง</span>
                    <ChevronsUpDown className="w-3 h-3 text-[#8A7E74]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('category')}
                  className="py-3 px-3 cursor-pointer hover:text-[#7A4B30] transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>หมวดหมู่</span>
                    <ChevronsUpDown className="w-3 h-3 text-[#8A7E74]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('source')}
                  className="py-3 px-3 cursor-pointer hover:text-[#7A4B30] transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>ที่มา</span>
                    <ChevronsUpDown className="w-3 h-3 text-[#8A7E74]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-[#7A4B30] transition-colors select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>สถานะ</span>
                    <ChevronsUpDown className="w-3 h-3 text-[#8A7E74]" />
                  </div>
                </th>
                <th className="py-3 px-3 text-center">จัดการ</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#EADBCC]/40 text-xs text-[#263238]">
              {sortedBooks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#717171]">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30 text-[#717171]" />
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
                          className="w-10 h-13 rounded-lg bg-white border border-[#EADBCC] shadow-xs flex flex-col items-center justify-center overflow-hidden cursor-pointer mx-auto transition-transform hover:scale-105"
                          title="ดูหน้าปก / ข้อมูล"
                        >
                          {book.coverImage ? (
                            <img
                              src={book.coverImage}
                              alt={book.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-[9px] text-[#8A7E74] leading-tight text-center font-medium">
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
                        className="py-3.5 px-3 font-bold font-mono text-[#263238] text-xs sm:text-sm"
                      >
                        {book.code}
                      </td>

                      {/* ชื่อเรื่อง */}
                      <td className="py-3.5 px-3 font-medium text-[#263238] max-w-[220px]">
                        <span className="truncate block" title={book.title}>
                          {book.title}
                        </span>
                      </td>

                      {/* หมวดหมู่ */}
                      <td className="py-3.5 px-3 text-[#263238] font-normal">
                        {formatCategory(book.category)}
                      </td>

                      {/* ที่มา */}
                      <td className="py-3.5 px-3 text-[#717171] font-normal whitespace-nowrap">
                        {formatSource(book)}
                      </td>

                      {/* สถานะ */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {isAvailable ? (
                          <span className="bg-[#A2D9C3] text-[#1E5C3B] font-semibold text-xs px-3.5 py-1 rounded-full inline-block shadow-2xs">
                            Available
                          </span>
                        ) : isMatched ? (
                          <span className="bg-[#FFB7A5] text-[#8B3A2B] font-semibold text-xs px-3.5 py-1 rounded-full inline-block shadow-2xs">
                            Matched
                          </span>
                        ) : (
                          <span className="bg-[#EADBCC] text-[#7A4B30] font-semibold text-xs px-3.5 py-1 rounded-full inline-block">
                            {book.status}
                          </span>
                        )}
                      </td>

                      {/* จัดการ */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setViewingBook(book)}
                          className="text-xs text-[#7A4B30] hover:text-[#502F1D] underline underline-offset-3 cursor-pointer font-medium"
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
          <div className="bg-[#FAF5EE] rounded-t-3xl sm:rounded-3xl w-full max-w-lg p-6 shadow-xl border border-[#EADBCC] animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#EADBCC] mb-4">
              <div>
                <h3 className="font-bold text-[#263238] text-base">
                  เพิ่มหนังสือสู่คลังส่วนกลาง
                </h3>
                <p className="text-xs text-[#8A7E74] mt-0.5">
                  รหัสอัตโนมัติ: <strong className="font-mono text-[#2E7D32]">{nextLCode}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#8A7E74] hover:text-[#263238] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCentralBook} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#263238] mb-1.5">
                  ชื่อเรื่องหนังสือ <span className="text-[#E53935]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น Atomic Habits"
                  value={newBookTitle}
                  onChange={(e) => setNewBookTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8CABE] text-xs bg-white text-[#263238] focus:outline-none focus:ring-1 focus:ring-[#7A4B30]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#263238] mb-1.5">
                    หมวดหมู่
                  </label>
                  <select
                    value={newBookCategory}
                    onChange={(e) => setNewBookCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D8CABE] text-xs bg-white text-[#263238] font-medium focus:outline-none focus:ring-1 focus:ring-[#7A4B30]"
                  >
                    {settings.categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#263238] mb-1.5">
                    ราคา (บาท)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newBookPrice}
                    onChange={(e) => setNewBookPrice(Number(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8CABE] text-xs font-mono text-[#263238] bg-white focus:outline-none focus:ring-1 focus:ring-[#7A4B30]"
                  />
                </div>
              </div>

              {/* Cover photo */}
              <div>
                <label className="block text-xs font-semibold text-[#263238] mb-1.5">
                  รูปหน้าปก
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-16 rounded-xl border border-[#D8CABE] overflow-hidden bg-white flex items-center justify-center shrink-0 shadow-xs">
                    {newBookCover ? (
                      <img src={newBookCover} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen className="w-5 h-5 text-[#8A7E74] opacity-40" />
                    )}
                  </div>
                  <div className="flex gap-2 flex-1">
                    <button
                      type="button"
                      onClick={() => setIsCameraOpenForAdd(true)}
                      className="flex-1 py-2 text-xs font-medium text-[#7A4B30] bg-[#EFE5D6] hover:bg-[#E4D8C5] rounded-xl flex items-center justify-center gap-1 border border-[#D8CABE] cursor-pointer transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      กล้อง
                    </button>
                    <label className="flex-1 py-2 text-xs font-medium text-[#4D4D4D] bg-white border border-[#D8CABE] rounded-xl flex items-center justify-center gap-1 cursor-pointer hover:bg-[#F9F4EB] transition-colors">
                      <Upload className="w-3.5 h-3.5 text-[#717171]" />
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

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#EADBCC]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs text-[#717171] hover:text-[#263238] cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-medium text-white bg-[#2A3B4C] hover:bg-[#1E2B38] rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  บันทึกหนังสือ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Details */}
      {viewingBook && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-[#FAF5EE] rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 shadow-xl border border-[#EADBCC] animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#EADBCC] mb-4">
              <span className="font-mono font-bold text-xs bg-[#2A3B4C] text-white px-2.5 py-1 rounded-lg">
                {viewingBook.code}
              </span>
              <button
                type="button"
                onClick={() => setViewingBook(null)}
                className="text-[#8A7E74] hover:text-[#263238] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-4 mb-4">
              <div className="w-20 h-28 rounded-xl overflow-hidden border border-[#D8CABE] shrink-0 bg-white shadow-xs">
                <BookCover
                  title={viewingBook.title}
                  category={viewingBook.category}
                  code={viewingBook.code}
                  coverImage={viewingBook.coverImage}
                />
              </div>
              <div className="flex-1 text-xs space-y-1.5">
                <h4 className="font-bold text-sm text-[#263238] line-clamp-2">
                  {viewingBook.title}
                </h4>
                <div className="text-xs text-[#717171]">
                  หมวด: <strong className="text-[#263238] font-medium">{viewingBook.category}</strong>
                </div>
                <div className="text-xs text-[#717171]">
                  ราคา: <span className="font-mono font-bold text-[#2E7D32]">฿{viewingBook.price}</span>
                </div>
                <div className="text-xs text-[#717171]">
                  แหล่งที่มา: <span className="font-medium text-[#263238]">{viewingBook.source === 'Library' ? 'ส่วนกลาง (L)' : 'ผู้แลก (U)'}</span>
                </div>
                {(viewingBook.ownerName || viewingBook.ownerPhone) && (
                  <div className="text-xs text-[#717171]">
                    ผู้แลก: <span className="font-medium text-[#263238]">{viewingBook.ownerName || viewingBook.ownerPhone}</span>
                  </div>
                )}
                <div className="text-xs text-[#717171]">
                  สถานะ:{' '}
                  {viewingBook.status === 'Available' ? (
                    <span className="bg-[#A2D9C3] text-[#1E5C3B] font-semibold text-[11px] px-2.5 py-0.5 rounded-full inline-block">
                      Available
                    </span>
                  ) : viewingBook.status === 'Matched' ? (
                    <span className="bg-[#FFB7A5] text-[#8B3A2B] font-semibold text-[11px] px-2.5 py-0.5 rounded-full inline-block">
                      Matched
                    </span>
                  ) : (
                    <span className="bg-[#EADBCC] text-[#7A4B30] font-semibold text-[11px] px-2.5 py-0.5 rounded-full inline-block">
                      {viewingBook.status}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Toggle Status Action */}
            <div className="bg-white/90 border border-[#EADBCC] rounded-2xl p-3.5 text-xs space-y-2 mb-4 shadow-xs">
              <div className="text-[11px] text-[#717171]">
                สลับสถานะหนังสือ:
              </div>
              <button
                type="button"
                onClick={() => handleToggleStatus(viewingBook)}
                className={`w-full py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer ${
                  viewingBook.status === 'Available'
                    ? 'bg-[#FFB7A5] hover:bg-[#FFA590] text-[#8B3A2B]'
                    : 'bg-[#A2D9C3] hover:bg-[#90CFB5] text-[#1E5C3B]'
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
                className="px-4 py-2 text-xs font-medium text-[#4D4D4D] hover:text-[#263238] bg-white border border-[#D8CABE] rounded-xl cursor-pointer shadow-xs"
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
