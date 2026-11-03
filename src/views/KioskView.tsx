import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  Camera,
  Upload,
  HeartHandshake,
  Search,
  Check,
  Printer,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  X,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Book, SystemSettings, ParticipantInfo, KioskBookEntry, TransactionRecord } from '../types';
import { StorageService } from '../services/storage';
import { BookCover, MockBookCover } from '../components/BookCover';
import { CameraCaptureModal } from '../components/CameraCaptureModal';

interface KioskViewProps {
  settings: SystemSettings;
  books: Book[];
  onTransactionComplete: (newBooks: Book[], transaction: TransactionRecord) => void;
  onOpenAdminLogin?: () => void;
}

export const KioskView: React.FC<KioskViewProps> = ({
  settings,
  books,
  onTransactionComplete,
  onOpenAdminLogin,
}) => {
  // Step 0: Welcome, 1: เงื่อนไข, 2: ลงทะเบียน, 3: หนังสือ, 4: ติดเลข, 5: จับคู่, 6: สิ้นสุด
  const [step, setStep] = useState<number>(0);

  // Participant form (PDPA compliant - no personal name or contact collection)
  const [participant, setParticipant] = useState<ParticipantInfo>({
    memberType: '',
    participationHistory: '',
    visitFrequencyThisYear: '',
  });
  const [participantErrors, setParticipantErrors] = useState<{
    participationHistory?: string;
    visitFrequencyThisYear?: string;
    memberType?: string;
  }>({});

  // Book entries
  const [bookCount, setBookCount] = useState<number>(1);
  const [bookEntries, setBookEntries] = useState<KioskBookEntry[]>([]);
  const [bookValidationErrors, setBookValidationErrors] = useState<Record<number, string>>({});

  // Matching state & verification feedback
  const [matchVerificationFeedback, setMatchVerificationFeedback] = useState<
    Record<number, { success: boolean; message: string; book?: Book }>
  >({});
  const [matchErrors, setMatchErrors] = useState<Record<number, string>>({});

  // Shelf browse drawer / modal for matching
  const [shelfSearchQuery, setShelfSearchQuery] = useState('');
  const [isBrowsingShelfForIdx, setIsBrowsingShelfForIdx] = useState<number | null>(null);

  // Camera modal
  const [cameraActiveIdx, setCameraActiveIdx] = useState<number | null>(null);

  // Completed transaction data
  const [completedTransaction, setCompletedTransaction] = useState<{
    transaction: TransactionRecord;
    userBooks: Book[];
    takenBooks: Book[];
  } | null>(null);

  // Home Welcome Shelf controls (Side-scrolling & criteria)
  const [homeCategory, setHomeCategory] = useState<string>('all');
  const [homeSortOrder, setHomeSortOrder] = useState<'newest' | 'code' | 'popular'>('newest');
  const [previewBook, setPreviewBook] = useState<Book | null>(null);
  const homeCarouselRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkHomeCarouselScroll = () => {
    if (homeCarouselRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = homeCarouselRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const handleScrollCarousel = (direction: 'left' | 'right') => {
    if (homeCarouselRef.current) {
      const scrollAmount = homeCarouselRef.current.clientWidth * 0.75;
      homeCarouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      setTimeout(checkHomeCarouselScroll, 350);
    }
  };

  // Initialize book entries when entering step 3 or when book count changes
  useEffect(() => {
    if (step === 3 && bookEntries.length === 0) {
      initBookEntries(bookCount);
    }
  }, [step]);

  const initBookEntries = (count: number) => {
    const codes = StorageService.generateNextUCodes(count);
    const entries: KioskBookEntry[] = [];
    for (let i = 0; i < count; i++) {
      entries.push({
        tempId: `entry-${Date.now()}-${i}`,
        code: codes[i],
        title: '',
        isbn: '',
        price: undefined,
        category: '',
        coverImage: undefined,
        matchTargetCode: '',
        isCancelled: false,
      });
    }
    setBookEntries(entries);
  };

  const handleUpdateBookCount = (newCount: number) => {
    if (newCount < 1 || newCount > 10) return;
    setBookCount(newCount);
    const codes = StorageService.generateNextUCodes(newCount);
    setBookEntries((prev) => {
      const updated: KioskBookEntry[] = [];
      for (let i = 0; i < newCount; i++) {
        const existing = prev[i];
        updated.push({
          tempId: existing?.tempId || `entry-${Date.now()}-${i}`,
          code: codes[i],
          title: existing?.title || '',
          isbn: existing?.isbn || '',
          price: existing?.price,
          category: existing?.category || '',
          coverImage: existing?.coverImage,
          matchTargetCode: existing?.matchTargetCode || '',
          isCancelled: existing?.isCancelled || false,
        });
      }
      return updated;
    });
  };

  const handleBookEntryChange = (idx: number, field: keyof KioskBookEntry, value: any) => {
    setBookEntries((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });

    if (
      (field === 'title' && value.trim()) ||
      (field === 'category' && value) ||
      (field === 'price' && value !== undefined && !isNaN(value) && Number(value) > 0)
    ) {
      setBookValidationErrors((prev) => {
        const copy = { ...prev };
        delete copy[idx];
        return copy;
      });
    }
  };

  const handleFileUpload = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      handleBookEntryChange(idx, 'coverImage', result);
    };
    reader.readAsDataURL(file);
  };

  // Step 2 validation (PDPA compliant)
  const validateParticipant = (): boolean => {
    const errors: {
      participationHistory?: string;
      visitFrequencyThisYear?: string;
      memberType?: string;
    } = {};

    if (!participant.participationHistory) {
      errors.participationHistory = 'กรุณาเลือกการร่วมกิจกรรม';
    }

    if (!participant.visitFrequencyThisYear) {
      errors.visitFrequencyThisYear = 'กรุณาเลือกว่าในปีนี้มาร่วมกิจกรรมแล้วกี่ครั้ง';
    }

    if (!participant.memberType || participant.memberType === 'เลือกกลุ่มสมาชิก') {
      errors.memberType = 'กรุณาเลือกกลุ่มสมาชิก';
    }

    setParticipantErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Step 3 validation
  const validateBooksBrought = (): boolean => {
    const errors: Record<number, string> = {};
    bookEntries.forEach((entry, idx) => {
      if (!entry.title.trim()) {
        errors[idx] = `กรุณากรอกชื่อเรื่องของเล่มที่ ${idx + 1}`;
      } else if (entry.price === undefined || entry.price === null || isNaN(entry.price) || Number(entry.price) <= 0) {
        errors[idx] = `กรุณากรอกราคาของเล่มที่ ${idx + 1} (หากไม่มีโปรดประมาณมูลค่า)`;
      } else if (!entry.category) {
        errors[idx] = `กรุณาเลือกประเภทหนังสือของเล่มที่ ${idx + 1}`;
      }
    });
    setBookValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Step 5 verify single book code
  const handleCheckCode = (idx: number, overrideTarget?: string) => {
    const entry = bookEntries[idx];
    const target = (overrideTarget !== undefined ? overrideTarget : entry?.matchTargetCode)?.trim().toUpperCase();

    if (!target) {
      setMatchVerificationFeedback((prev) => ({
        ...prev,
        [idx]: { success: false, message: 'กรุณากรอกรหัสหนังสือก่อนกดตรวจ' },
      }));
      return;
    }

    // Check duplicate in other slots
    const isDuplicate = bookEntries.some(
      (other, otherIdx) =>
        otherIdx !== idx &&
        !other.isCancelled &&
        other.matchTargetCode?.trim().toUpperCase() === target
    );

    if (isDuplicate) {
      setMatchVerificationFeedback((prev) => ({
        ...prev,
        [idx]: { success: false, message: `รหัส ${target} ถูกเลือกในรายการอื่นแล้ว` },
      }));
      return;
    }

    // Look up book in catalog
    const found = books.find((b) => b.code.toUpperCase() === target);
    if (!found) {
      setMatchVerificationFeedback((prev) => ({
        ...prev,
        [idx]: { success: false, message: `ไม่พบรหัส "${target}" ในฐานข้อมูลห้องสมุด` },
      }));
    } else if (found.status !== 'Available') {
      setMatchVerificationFeedback((prev) => ({
        ...prev,
        [idx]: {
          success: false,
          message: `หนังสือ "${found.title}" (${target}) ไม่พร้อมแลก (${found.status})`,
        },
      }));
    } else {
      setMatchVerificationFeedback((prev) => ({
        ...prev,
        [idx]: {
          success: true,
          message: `พบหนังสือ: "${found.title}" (${found.category}) พร้อมแลก!`,
          book: found,
        },
      }));
      setMatchErrors((prev) => {
        const copy = { ...prev };
        delete copy[idx];
        return copy;
      });
    }
  };

  // Step 5 set donation
  const handleSetDonation = (idx: number) => {
    handleBookEntryChange(idx, 'isCancelled', false);
    handleBookEntryChange(idx, 'matchTargetCode', 'DONATION');
    setMatchVerificationFeedback((prev) => ({
      ...prev,
      [idx]: { success: true, message: 'ระบุเป็น "หนังสือบริจาค" เพื่อส่งต่อให้ผู้อื่น' },
    }));
    setMatchErrors((prev) => {
      const copy = { ...prev };
      delete copy[idx];
      return copy;
    });
  };

  // Step 5 set not match (cancel)
  const handleSetNotMatch = (idx: number) => {
    handleBookEntryChange(idx, 'isCancelled', true);
    handleBookEntryChange(idx, 'matchTargetCode', '');
    setMatchVerificationFeedback((prev) => ({
      ...prev,
      [idx]: { success: false, message: 'เปลี่ยนใจ ไม่แลกแล้ว (Not Match - รับเล่มเดิมกลับ)' },
    }));
    setMatchErrors((prev) => {
      const copy = { ...prev };
      delete copy[idx];
      return copy;
    });
  };

  // Step 5 validate all matches before finishing
  const validateAllMatches = (): boolean => {
    const errors: Record<number, string> = {};
    const usedCodes: string[] = [];

    bookEntries.forEach((entry, idx) => {
      if (entry.isCancelled) return;

      const target = entry.matchTargetCode?.trim().toUpperCase();
      if (!target) {
        errors[idx] = 'กรุณากรอกรหัสหนังสือ หรือเลือกบริจาค / ไม่แลกแล้ว';
        return;
      }

      if (target === 'DONATION') return;

      if (usedCodes.includes(target)) {
        errors[idx] = `รหัส ${target} ถูกเลือกซ้ำแล้ว`;
        return;
      }
      usedCodes.push(target);

      const found = books.find((b) => b.code.toUpperCase() === target);
      if (!found) {
        errors[idx] = `ไม่พบรหัส "${target}" ในฐานข้อมูลห้องสมุด`;
      } else if (found.status !== 'Available') {
        errors[idx] = `หนังสือ "${target}" (${found.title}) ไม่พร้อมแลก`;
      }
    });

    setMatchErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleConfirmExchange = () => {
    if (!validateAllMatches()) return;

    const now = new Date().toISOString();
    const booksToAdd: Book[] = [];
    const booksToUpdate: Book[] = [];
    const broughtCodes: string[] = [];
    const takenCodes: string[] = [];
    let donatedCount = 0;
    let cancelledCount = 0;

    let highestU = 'U0';

    bookEntries.forEach((entry) => {
      highestU = entry.code;

      if (entry.isCancelled) {
        cancelledCount++;
        booksToAdd.push({
          id: `book-${Date.now()}-${entry.code}`,
          code: entry.code,
          title: entry.title || 'ยกเลิกการแลก (Not Match)',
          isbn: entry.isbn,
          category: entry.category,
          price: entry.price ?? 0,
          status: 'Not Match',
          source: 'User',
          ownerPhone: participant.phone,
          ownerEmail: participant.email,
          memberType: participant.memberType,
          coverImage: entry.coverImage,
          createdAt: now,
          exchangeCount: 0,
        });
        return;
      }

      const targetCode = entry.matchTargetCode?.trim().toUpperCase();
      const isDonation = targetCode === 'DONATION';

      if (isDonation) {
        donatedCount++;
        broughtCodes.push(entry.code);
        booksToAdd.push({
          id: `book-${Date.now()}-${entry.code}`,
          code: entry.code,
          title: entry.title || 'หนังสือบริจาค',
          isbn: entry.isbn,
          category: entry.category,
          price: entry.price ?? 0,
          status: 'Available',
          source: 'Library',
          ownerName: participant.memberType ? `ผู้แลก (${participant.memberType})` : 'ผู้เข้าร่วม',
          ownerPhone: undefined,
          ownerEmail: undefined,
          memberType: participant.memberType,
          coverImage: entry.coverImage,
          createdAt: now,
          exchangeCount: 1,
        });
      } else {
        broughtCodes.push(entry.code);
        takenCodes.push(targetCode!);

        booksToAdd.push({
          id: `book-${Date.now()}-${entry.code}`,
          code: entry.code,
          title: entry.title,
          isbn: entry.isbn,
          category: entry.category,
          price: entry.price ?? 0,
          status: 'Available',
          source: 'User',
          ownerName: participant.memberType ? `ผู้แลก (${participant.memberType})` : 'ผู้เข้าร่วม',
          ownerPhone: undefined,
          ownerEmail: undefined,
          memberType: participant.memberType,
          coverImage: entry.coverImage,
          createdAt: now,
          exchangeCount: 1,
        });

        const shelfBook = books.find((b) => b.code.toUpperCase() === targetCode);
        if (shelfBook) {
          booksToUpdate.push({
            ...shelfBook,
            status: 'Matched',
            matchedAt: now,
            matchedWithCode: entry.code,
            exchangeCount: (shelfBook.exchangeCount || 1) + 1,
          });
        }
      }
    });

    // Permanently commit and lock all assigned U codes so they can never be reused
    StorageService.commitUCodes(bookEntries.map((e) => e.code));

    const transactionRecord: TransactionRecord = {
      id: `TX-${Date.now().toString().slice(-6)}`,
      timestamp: now,
      participant,
      booksBrought: broughtCodes,
      booksTaken: takenCodes,
      donatedCount,
      cancelledCount,
    };

    const currentBooks = StorageService.getBooks();
    const updatedBooks = currentBooks.map((b) => {
      const matchUpdate = booksToUpdate.find((u) => u.code === b.code);
      return matchUpdate || b;
    });
    const finalBooks = [...booksToAdd, ...updatedBooks];

    StorageService.saveBooks(finalBooks);
    StorageService.saveTransaction(transactionRecord);

    onTransactionComplete(finalBooks, transactionRecord);

    setCompletedTransaction({
      transaction: transactionRecord,
      userBooks: booksToAdd.filter((b) => b.status !== 'Not Match'),
      takenBooks: booksToUpdate,
    });

    setStep(6);
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#7A4B30', '#2A3B4C', '#F0DCB8', '#EADBCC'],
    });
  };

  const handleResetKiosk = () => {
    setStep(0);
    setParticipant({
      memberType: '',
      participationHistory: '',
      visitFrequencyThisYear: '',
    });
    setParticipantErrors({});
    setBookCount(1);
    setBookEntries([]);
    setBookValidationErrors({});
    setMatchVerificationFeedback({});
    setMatchErrors({});
    setCompletedTransaction(null);
  };

  const availableBooks = StorageService.sortBooks(
    books.filter((b) => b.status === 'Available')
  );

  // Filter and sort for the home screen shelf
  const homeAvailableBooks = React.useMemo(() => {
    let result = books.filter((b) => b.status === 'Available');

    if (homeCategory !== 'all') {
      result = result.filter((b) => b.category.toLowerCase().includes(homeCategory.toLowerCase()));
    }

    if (homeSortOrder === 'newest') {
      result = [...result].sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
    } else if (homeSortOrder === 'popular') {
      result = [...result].sort((a, b) => (b.exchangeCount || 1) - (a.exchangeCount || 1));
    } else {
      // 'code' (L first then U)
      result = StorageService.sortBooks(result);
    }

    return result;
  }, [books, homeCategory, homeSortOrder]);

  useEffect(() => {
    if (step === 0) {
      checkHomeCarouselScroll();
    }
  }, [step, homeAvailableBooks]);
  const filteredShelf = availableBooks.filter((b) => {
    const q = shelfSearchQuery.toLowerCase();
    return (
      b.code.toLowerCase().includes(q) ||
      b.title.toLowerCase().includes(q) ||
      b.category.toLowerCase().includes(q)
    );
  });

  const categoryOptions =
    settings.categories && settings.categories.length > 0
      ? settings.categories
      : [
          'หนังสือทั่วไป',
          'หนังสือเรียน',
          'หนังสือเยาวชน',
          'การ์ตูน',
          'เรื่องสั้น',
          'นวนิยาย',
        ];

  const stepsList = [
    { num: 1, label: 'เงื่อนไข' },
    { num: 2, label: 'ข้อมูลการเข้าร่วมกิจกรรม' },
    { num: 3, label: 'หนังสือ' },
    { num: 4, label: 'ติดเลข' },
    { num: 5, label: 'จับคู่' },
    { num: 6, label: 'สิ้นสุด' },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F8F3EA] py-6 sm:py-10 px-4 flex flex-col items-center justify-start font-sans select-none">
      {/* Centered Main Card */}
      <div className="w-full max-w-3xl bg-[#FAF5EE] rounded-[32px] sm:rounded-[36px] shadow-[0_12px_40px_rgba(122,75,48,0.08)] border border-[#EADBCC] p-6 sm:p-10 transition-all">
        {/* Step Indicator Header (Screens 1 to 6) */}
        {step >= 1 && step <= 6 && (
          <div className="mb-8">
            <div className="flex items-center justify-between relative px-2 sm:px-6">
              {/* Connecting line */}
              <div className="absolute left-6 right-6 top-4 sm:top-5 h-0.5 -translate-y-1/2 z-0 bg-[#E2D9CE]">
                <div
                  className="h-full bg-[#7A4B30] transition-all duration-300"
                  style={{
                    width: `${((Math.min(step, 6) - 1) / 5) * 100}%`,
                  }}
                />
              </div>

              {stepsList.map((s) => {
                const isPassed = step > s.num;
                const isActive = step === s.num;

                return (
                  <div key={s.num} className="flex flex-col items-center z-10 relative">
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-[#7A4B30] text-white ring-4 ring-[#7A4B30]/20 shadow-md scale-105'
                          : isPassed
                            ? 'bg-[#7A4B30] text-white'
                            : 'bg-white border-2 border-[#D9CEBF] text-[#8A7E74]'
                      }`}
                    >
                      {s.num}
                    </div>
                    <span
                      className={`text-[11px] sm:text-xs mt-2 transition-colors ${
                        isActive || isPassed
                          ? 'text-[#7A4B30] font-medium'
                          : 'text-[#8A7E74] font-normal'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 0: WELCOME SCREEN (Mockup 1) */}
        {step === 0 && (
          <div className="space-y-6">
            {/* Header: Logo Badge + Title */}
            <div className="flex items-center justify-center gap-4 sm:gap-6 pt-2">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[#EFE5D6] border border-[#E0D2BE] rounded-3xl flex items-center justify-center shadow-inner shrink-0 p-2 relative overflow-hidden">
                {/* 3D Stack of books with arrow icon */}
                <div className="relative flex flex-col items-center justify-center">
                  <div className="w-12 h-3.5 bg-[#4A6782] rounded-xs shadow-xs mb-0.5 text-[8px] text-white/90 text-center font-bold tracking-tight flex items-center justify-center">
                    READ
                  </div>
                  <div className="w-13 h-3.5 bg-[#B97A4A] rounded-xs shadow-xs mb-0.5 text-[8px] text-white/90 text-center font-bold tracking-tight flex items-center justify-center">
                    SHARE
                  </div>
                  <div className="w-14 h-4 bg-[#6A8852] rounded-xs shadow-xs text-[8px] text-white/90 text-center font-bold tracking-tight flex items-center justify-center">
                    GROW
                  </div>
                  {/* Circular cycle arrow overlay */}
                  <div className="absolute -inset-2 border-2 border-[#7A4B30]/30 rounded-full pointer-events-none" />
                </div>
              </div>

              <div className="text-left">
                <h1
                  style={{ fontSize: '20px' }}
                  className="text-[20px] font-bold text-[#7A4B30] leading-tight"
                >
                  เปลี่ยนเล่ม เปลี่ยนโลก
                </h1>
                <p
                  style={{ lineHeight: '20px', fontSize: '19px' }}
                  className="text-[19px] leading-[20px] text-[#7A4B30]/80 font-medium mt-1"
                >
                  สำนักหอสมุด มหาวิทยาลัยเชียงใหม่
                </p>
              </div>
            </div>

            {/* Section: หนังสือที่พร้อมแลกในขณะนี้ (ควบคุมด้วย showWelcomeShelf จากการตั้งค่า) */}
            {settings.showWelcomeShelf !== false && (
              <div className="pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-[#263238] text-left">
                    หนังสือที่พร้อมแลกในขณะนี้
                  </h2>
                  <span className="text-xs bg-[#EFE5D6] text-[#7A4B30] font-semibold px-2.5 py-0.5 rounded-full">
                    พร้อมแลก {homeAvailableBooks.length} เล่ม
                  </span>
                </div>

                {/* Side Scrolling Nav Buttons (< >) */}
                <div className="flex items-center gap-1 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => handleScrollCarousel('left')}
                    disabled={!canScrollLeft}
                    className="w-8 h-8 rounded-xl bg-white border border-[#EADBCC] flex items-center justify-center text-[#7A4B30] hover:bg-[#FAF5EE] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer active:scale-95"
                    aria-label="เลื่อนซ้าย"
                    title="เลื่อนซ้าย"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScrollCarousel('right')}
                    disabled={!canScrollRight}
                    className="w-8 h-8 rounded-xl bg-white border border-[#EADBCC] flex items-center justify-center text-[#7A4B30] hover:bg-[#FAF5EE] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer active:scale-95"
                    aria-label="เลื่อนขวา"
                    title="เลื่อนขวา"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 text-xs">
                <button
                  type="button"
                  onClick={() => setHomeCategory('all')}
                  className={`px-3 py-1 rounded-full shrink-0 font-medium transition-all cursor-pointer ${
                    homeCategory === 'all'
                      ? 'bg-[#7A4B30] text-white shadow-xs'
                      : 'bg-white/80 text-[#8A7E74] hover:bg-white hover:text-[#263238] border border-[#EADBCC]'
                  }`}
                >
                  ทั้งหมด ({books.filter((b) => b.status === 'Available').length})
                </button>
                {categoryOptions.map((cat) => {
                  const shortLabel = cat.replace('หนังสือ', '');
                  const count = books.filter((b) => b.status === 'Available' && b.category.includes(cat)).length;
                  const isActive = homeCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setHomeCategory(cat)}
                      className={`px-3 py-1 rounded-full shrink-0 font-medium transition-all cursor-pointer flex items-center gap-1 ${
                        isActive
                          ? 'bg-[#7A4B30] text-white shadow-xs'
                          : 'bg-white/80 text-[#8A7E74] hover:bg-white hover:text-[#263238] border border-[#EADBCC]'
                      }`}
                    >
                      <span>{shortLabel}</span>
                      {count > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-[#EFE5D6] text-[#7A4B30]'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Side Scrolling Container (Horizontal Carousel with snap) */}
              <div
                ref={homeCarouselRef}
                onScroll={checkHomeCarouselScroll}
                className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 pt-1 px-1 scroll-smooth snap-x snap-mandatory focus:outline-none"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#D8CABE transparent',
                }}
              >
                {homeAvailableBooks.length > 0 ? (
                  homeAvailableBooks.map((book) => {
                    const cover = book.coverImage;
                    return (
                      <div
                        key={book.id || book.code}
                        onClick={() => setPreviewBook(book)}
                        className="w-36 sm:w-44 shrink-0 snap-start bg-[#FAF5EE] border border-[#EADBCC] rounded-3xl p-3 text-center shadow-xs hover:shadow-md hover:border-[#7A4B30]/40 transition-all flex flex-col items-center cursor-pointer group select-none active:scale-[0.98]"
                      >
                        {/* Cover Area */}
                        <div className="w-full aspect-square rounded-2xl bg-[#C8C3BC] flex items-center justify-center overflow-hidden relative shadow-inner group-hover:shadow-md transition-shadow">
                          {cover ? (
                            <img
                              src={cover}
                              alt={book.title}
                              className="w-full h-full object-cover rounded-2xl group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <MockBookCover
                              title={book.title}
                              category={book.category}
                              code={book.code}
                              seed={book.code || book.title}
                            />
                          )}

                          {/* Code Badge */}
                          <span className="absolute top-2 left-2 bg-[#2A3B4C]/90 backdrop-blur-xs text-white text-[10px] font-bold font-mono px-2 py-0.5 rounded-md shadow-xs z-20">
                            {book.code}
                          </span>

                          {/* Source Tag */}
                          <span className="absolute bottom-2 right-2 bg-white/90 text-[#7A4B30] text-[9px] font-medium px-1.5 py-0.5 rounded-md shadow-xs z-20">
                            {book.source === 'Library' ? 'ส่วนกลาง' : 'ผู้ร่วมกิจกรรม'}
                          </span>
                        </div>

                        {/* Title & Category */}
                        <p
                          style={{ fontSize: '16px' }}
                          className="text-[16px] font-medium text-[#332D29] mt-2.5 line-clamp-1 w-full text-center group-hover:text-[#7A4B30] transition-colors"
                        >
                          {book.title}
                        </p>
                        <span className="text-[10px] text-[#8A7E74] truncate max-w-full mt-0.5 font-medium">
                          {book.category}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="w-full py-8 text-center text-[#8A7E74] text-sm bg-white/40 rounded-2xl border border-dashed border-[#EADBCC]">
                    ไม่พบหนังสือในหมวดนี้
                  </div>
                )}
              </div>

              {/* Mobile side-scroll hint */}
              <div className="flex sm:hidden items-center justify-center gap-1.5 text-[11px] text-[#8A7E74] pt-0.5 pb-1">
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>เลื่อนซ้าย-ขวาเพื่อดูหนังสือ ({homeAvailableBooks.length} เล่ม)</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
              </div>
            )}

            {/* Primary Navy Button: เริ่มต้นการแลกเปลี่ยน */}
            <button
              onClick={() => {
                initBookEntries(1);
                setStep(1);
              }}
              style={{ marginTop: '0.75rem' }}
              className="w-full py-2.5 sm:py-3 px-6 bg-[#2A3B4C] hover:bg-[#1E2B38] active:scale-[0.99] text-white font-medium text-base sm:text-lg rounded-2xl shadow-md transition-all cursor-pointer text-center !mt-3 tracking-tight"
            >
              เริ่มต้นการแลกเปลี่ยน
            </button>

            {onOpenAdminLogin && (
              <div
                style={{
                  width: '686.222px',
                  height: '35px',
                  paddingTop: '0px',
                  paddingBottom: '0px',
                }}
                className="text-center max-w-full flex items-center justify-center mx-auto"
              >
                <button
                  type="button"
                  onClick={onOpenAdminLogin}
                  className="text-xs text-[#8A7E74] hover:text-[#7A4B30] underline underline-offset-4 transition-colors cursor-pointer"
                >
                  เข้าสู่ระบบสำหรับเจ้าหน้าที่
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 1: เงื่อนไขการเข้าร่วมกิจกรรม (Mockup 2) */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#7A4B30] text-center">
              เงื่อนไขการเข้าร่วมกิจกรรม
            </h2>

            {/* White/Cream Content Box with Dynamic Rules from settings.exchangeTerms */}
            <div className="bg-white/80 border border-[#EADBCC] rounded-3xl p-6 sm:p-8 space-y-4 text-sm sm:text-base text-[#332D29] leading-relaxed shadow-xs text-left">
              {(settings.exchangeTerms || '')
                .split('\n')
                .filter((line) => line.trim() !== '')
                .map((line, idx) => {
                  const numMatch = line.match(/^(\d+[\.\)]\s*)(.*)$/);
                  const bulletMatch = line.match(/^([-•*]\s*)(.*)$/);
                  if (numMatch) {
                    return (
                      <p key={idx} className="flex items-start gap-2.5">
                        <span className="font-semibold text-[#7A4B30] shrink-0 min-w-[20px]">
                          {numMatch[1]}
                        </span>
                        <span className="flex-1">{numMatch[2]}</span>
                      </p>
                    );
                  }
                  if (bulletMatch) {
                    return (
                      <p key={idx} className="flex items-start gap-2.5">
                        <span className="font-semibold text-[#7A4B30] shrink-0 min-w-[16px]">
                          {bulletMatch[1]}
                        </span>
                        <span className="flex-1">{bulletMatch[2]}</span>
                      </p>
                    );
                  }
                  return (
                    <p key={idx} className="leading-relaxed">
                      {line}
                    </p>
                  );
                })}
            </div>

            {/* Primary Navy Button: ยืนยันรับทราบการเข้าร่วมกิจกรรม */}
            <button
              onClick={() => setStep(2)}
              className="w-full py-2.5 sm:py-3 px-6 bg-[#2A3B4C] hover:bg-[#1E2B38] active:scale-[0.99] text-white font-medium text-base sm:text-lg rounded-2xl shadow-md transition-all cursor-pointer text-center tracking-tight"
            >
              ยืนยันรับทราบการเข้าร่วมกิจกรรม
            </button>
          </div>
        )}

        {/* STEP 2: ข้อมูลการเข้าร่วมกิจกรรม (Select Boxes) */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#7A4B30]">
                ข้อมูลการเข้าร่วมกิจกรรม
              </h2>
            </div>

            <div className="space-y-5 text-left">
              {/* Select Box Group 1: การร่วมกิจกรรม */}
              <div>
                <label className="block text-sm sm:text-base font-semibold text-[#332D29] mb-2">
                  การร่วมกิจกรรม <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(settings.participationHistoryOptions && settings.participationHistoryOptions.length > 0
                    ? settings.participationHistoryOptions
                    : ['เคยเข้าร่วมกิจกรรมในปีที่ผ่านมา', 'ปีนี้เป็นครั้งแรก']
                  ).map((opt) => {
                    const isSelected = participant.participationHistory === opt;
                    return (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => {
                          setParticipant((p) => ({ ...p, participationHistory: opt }));
                          if (participantErrors.participationHistory) {
                            setParticipantErrors((p) => ({ ...p, participationHistory: undefined }));
                          }
                        }}
                        className={`flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#F5ECE1] border-[#7A4B30] text-[#7A4B30] font-semibold shadow-xs ring-2 ring-[#7A4B30]/20'
                            : participantErrors.participationHistory
                              ? 'bg-white border-red-300 text-[#4D4D4D] hover:border-[#7A4B30]/40'
                              : 'bg-white border-[#D8CABE] text-[#332D29] hover:bg-[#FAF5EE] hover:border-[#7A4B30]/40'
                        }`}
                      >
                        <span className="text-sm sm:text-base font-medium">{opt}</span>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-2 transition-colors ${
                            isSelected
                              ? 'border-[#7A4B30] bg-[#7A4B30] text-white'
                              : 'border-[#C8B8A6] bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {participantErrors.participationHistory && (
                  <p className="text-xs text-red-500 mt-1.5 pl-1">
                    {participantErrors.participationHistory}
                  </p>
                )}
              </div>

              {/* Select Box Group 2: ในปีนี้ ท่านมาร่วมกิจกรรมแล้วกี่ครั้ง */}
              <div>
                <label className="block text-sm sm:text-base font-semibold text-[#332D29] mb-2">
                  ในปีนี้ ท่านมาร่วมกิจกรรมแล้วกี่ครั้ง <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {(settings.visitFrequencyOptions && settings.visitFrequencyOptions.length > 0
                    ? settings.visitFrequencyOptions
                    : ['ครั้งที่ 1', 'ครั้งที่ 2', 'ครั้งที่ 3', 'ครั้งที่ 4', 'ครั้งที่ 5', 'มากกว่า 5 ครั้ง']
                  ).map((opt, optIdx) => {
                    const isSelected = participant.visitFrequencyThisYear === opt;

                    let btnStyle: React.CSSProperties = {};
                    if (optIdx === 0) {
                      btnStyle = { width: '100px', paddingLeft: '7px', paddingRight: '12px' };
                    } else if (optIdx >= 1 && optIdx <= 4) {
                      btnStyle = { width: '100px', paddingLeft: '7px' };
                    } else if (optIdx === 5) {
                      btnStyle = { width: '140px', paddingLeft: '7px' };
                    }

                    return (
                      <button
                        type="button"
                        key={opt}
                        style={btnStyle}
                        onClick={() => {
                          setParticipant((p) => ({ ...p, visitFrequencyThisYear: opt }));
                          if (participantErrors.visitFrequencyThisYear) {
                            setParticipantErrors((p) => ({ ...p, visitFrequencyThisYear: undefined }));
                          }
                        }}
                        className={`flex items-center justify-between p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#F5ECE1] border-[#7A4B30] text-[#7A4B30] font-semibold shadow-xs ring-2 ring-[#7A4B30]/20'
                            : participantErrors.visitFrequencyThisYear
                              ? 'bg-white border-red-300 text-[#4D4D4D] hover:border-[#7A4B30]/40'
                              : 'bg-white border-[#D8CABE] text-[#332D29] hover:bg-[#FAF5EE] hover:border-[#7A4B30]/40'
                        }`}
                      >
                        <span className="text-xs sm:text-sm font-medium whitespace-nowrap">{opt}</span>
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ml-1.5 transition-colors ${
                            isSelected
                              ? 'border-[#7A4B30] bg-[#7A4B30] text-white'
                              : 'border-[#C8B8A6] bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {participantErrors.visitFrequencyThisYear && (
                  <p className="text-xs text-red-500 mt-1.5 pl-1">
                    {participantErrors.visitFrequencyThisYear}
                  </p>
                )}
              </div>

              {/* Select Box Group 3: กลุ่มสมาชิก */}
              <div>
                <label className="block text-sm sm:text-base font-semibold text-[#332D29] mb-2">
                  กลุ่มสมาชิก <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(settings.memberTypes && settings.memberTypes.length > 0
                    ? settings.memberTypes
                    : [
                        'CMU นักศึกษา',
                        'CMU Staff',
                        'CMU ศิษย์เก่า',
                        'บุคคลทั่วไป/นักเรียน',
                      ]
                  ).map((type) => {
                    const isSelected = participant.memberType === type;
                    return (
                      <button
                        type="button"
                        key={type}
                        onClick={() => {
                          setParticipant((p) => ({ ...p, memberType: type }));
                          if (participantErrors.memberType) {
                            setParticipantErrors((p) => ({ ...p, memberType: undefined }));
                          }
                        }}
                        className={`flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#F5ECE1] border-[#7A4B30] text-[#7A4B30] font-semibold shadow-xs ring-2 ring-[#7A4B30]/20'
                            : participantErrors.memberType
                              ? 'bg-white border-red-300 text-[#4D4D4D] hover:border-[#7A4B30]/40'
                              : 'bg-white border-[#D8CABE] text-[#332D29] hover:bg-[#FAF5EE] hover:border-[#7A4B30]/40'
                        }`}
                      >
                        <span className="text-sm sm:text-base font-medium">{type}</span>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-2 transition-colors ${
                            isSelected
                              ? 'border-[#7A4B30] bg-[#7A4B30] text-white'
                              : 'border-[#C8B8A6] bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {participantErrors.memberType && (
                  <p className="text-xs text-red-500 mt-1.5 pl-1">{participantErrors.memberType}</p>
                )}
              </div>
            </div>

            {/* Primary Navy Button: ถัดไป */}
            <button
              onClick={() => {
                if (validateParticipant()) {
                  if (bookEntries.length === 0) {
                    initBookEntries(bookCount);
                  }
                  setStep(3);
                }
              }}
              className="w-full py-2.5 sm:py-3 px-6 bg-[#2A3B4C] hover:bg-[#1E2B38] active:scale-[0.99] text-white font-medium text-base sm:text-lg rounded-2xl shadow-md transition-all cursor-pointer text-center tracking-tight"
            >
              ถัดไป
            </button>
          </div>
        )}

        {/* STEP 3: หนังสือที่นำมาแลก (Mockup 4 & 5) */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#7A4B30] text-center">
              หนังสือที่นำมาแลก
            </h2>

            {/* Stepper: [-]  2  [+] */}
            <div className="flex items-center justify-center gap-6 py-2">
              <button
                type="button"
                onClick={() => handleUpdateBookCount(bookCount - 1)}
                disabled={bookCount <= 1}
                className="w-12 h-9 rounded-xl bg-[#2A3B4C] hover:bg-[#1E2B38] disabled:opacity-40 text-white text-xl flex items-center justify-center font-bold shadow active:scale-95 transition-transform cursor-pointer"
              >
                <Minus className="w-5 h-5" />
              </button>

              <span className="text-3xl font-bold text-[#332D29] min-w-[40px] text-center">
                {bookCount}
              </span>

              <button
                type="button"
                onClick={() => handleUpdateBookCount(bookCount + 1)}
                disabled={bookCount >= 10}
                className="w-12 h-9 rounded-xl bg-[#2A3B4C] hover:bg-[#1E2B38] disabled:opacity-40 text-white text-xl flex items-center justify-center font-bold shadow active:scale-95 transition-transform cursor-pointer"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Book Cards Grid: 1 col on mobile, 2 cols on tablet/desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 text-left">
              {bookEntries.map((entry, idx) => (
                <div
                  key={entry.tempId || idx}
                  style={{ paddingTop: '15px', paddingBottom: '15px' }}
                  className="border border-[#EADBCC] rounded-3xl px-5 sm:px-6 py-[15px] bg-[#FAF5EE]/90 space-y-3.5 shadow-xs transition-all relative"
                >
                  {/* Card Header: "เล่มที่ 1" + badge "รหัส: U1" */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#EADBCC]/60">
                    <span className="text-base sm:text-lg font-medium text-[#332D29]">
                      เล่มที่ {idx + 1}
                    </span>
                    <span className="bg-[#F5E2CC] text-[#7A4B30] text-xs font-semibold px-3 py-1 rounded-full font-mono">
                      รหัส: {entry.code}
                    </span>
                  </div>

                  {/* Input: ชื่อเรื่อง * */}
                  <div>
                    <input
                      type="text"
                      value={entry.title}
                      onChange={(e) => handleBookEntryChange(idx, 'title', e.target.value)}
                      placeholder="ชื่อเรื่อง *"
                      style={{ paddingTop: '6px', paddingBottom: '6px' }}
                      className={`w-full bg-white border ${
                        bookValidationErrors[idx]?.includes('ชื่อเรื่อง') ? 'border-red-500' : 'border-[#D8CABE]'
                      } rounded-2xl px-4 py-[6px] text-sm text-[#332D29] placeholder-[#9A9188] focus:outline-none focus:ring-2 focus:ring-[#7A4B30] transition-all`}
                    />
                    {bookValidationErrors[idx]?.includes('ชื่อเรื่อง') && (
                      <p className="text-xs text-red-500 mt-1 pl-1">{bookValidationErrors[idx]}</p>
                    )}
                  </div>

                  {/* Input: ISBN Barcode (ถ้ามี) */}
                  <div>
                    <input
                      type="text"
                      value={entry.isbn || ''}
                      onChange={(e) => handleBookEntryChange(idx, 'isbn', e.target.value)}
                      placeholder="ISBN Barcode (ถ้ามี)"
                      style={{ paddingTop: '6px', paddingBottom: '6px' }}
                      className="w-full bg-white border border-[#D8CABE] rounded-2xl px-4 py-[6px] text-sm text-[#332D29] placeholder-[#9A9188] focus:outline-none focus:ring-2 focus:ring-[#7A4B30] transition-all"
                    />
                  </div>

                  {/* Input: ราคา (หากไม่มีโปรดประมาณมูลค่า) */}
                  <div>
                    <input
                      type="number"
                      min="1"
                      required
                      value={entry.price !== undefined && entry.price !== null ? entry.price : ''}
                      onChange={(e) =>
                        handleBookEntryChange(
                          idx,
                          'price',
                          e.target.value === '' ? undefined : Number(e.target.value)
                        )
                      }
                      placeholder="ราคา (หากไม่มีโปรดประมาณมูลค่า)"
                      style={{ paddingTop: '6px', paddingBottom: '6px' }}
                      className={`w-full bg-white border ${
                        bookValidationErrors[idx]?.includes('ราคา') ? 'border-red-500 bg-red-50/20' : 'border-[#D8CABE]'
                      } rounded-2xl px-4 py-[6px] text-sm text-[#332D29] placeholder-[#9A9188] focus:outline-none focus:ring-2 focus:ring-[#7A4B30] transition-all`}
                    />
                    {bookValidationErrors[idx]?.includes('ราคา') && (
                      <p className="text-xs text-red-500 mt-1 pl-1">{bookValidationErrors[idx]}</p>
                    )}
                  </div>

                  {/* Dropdown: ประเภทหนังสือ: * */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-[#332D29] mb-2">
                      ประเภทหนังสือ: <span className="text-red-500">*</span>
                    </label>

                    <div className="relative">
                      <select
                        value={entry.category || ''}
                        onChange={(e) => handleBookEntryChange(idx, 'category', e.target.value)}
                        style={{ paddingTop: '6px', paddingBottom: '6px' }}
                        className={`w-full bg-white border rounded-2xl px-4 py-[6px] text-sm transition-all appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7A4B30] ${
                          !entry.category ? 'text-[#9A9188]' : 'text-[#332D29] font-medium'
                        } ${
                          bookValidationErrors[idx]?.includes('ประเภทหนังสือ')
                            ? 'border-red-400 bg-red-50/20'
                            : 'border-[#D8CABE]'
                        }`}
                      >
                        <option value="" disabled className="text-[#9A9188]">
                          -- เลือกประเภทหนังสือ --
                        </option>
                        {categoryOptions.map((cat) => (
                          <option key={cat} value={cat} className="text-[#332D29]">
                            {cat}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#7A4B30]">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                    {bookValidationErrors[idx]?.includes('ประเภทหนังสือ') && (
                      <p className="text-xs text-red-500 mt-1 pl-1">{bookValidationErrors[idx]}</p>
                    )}
                  </div>

                  {/* Optional Camera Snapshot / File Upload for Cover */}
                  <div className="pt-2 border-t border-[#EADBCC]/60 flex items-center justify-between text-xs text-[#7A4B30]">
                    <span className="font-normal">รูปภาพหน้าปก:</span>
                    <div className="flex items-center gap-2">
                      {entry.coverImage ? (
                        <div className="flex items-center gap-1.5 bg-[#F5E2CC] px-2.5 py-1 rounded-xl">
                          <span className="text-[11px] font-medium">มีรูปแล้ว</span>
                          <button
                            type="button"
                            onClick={() => handleBookEntryChange(idx, 'coverImage', undefined)}
                            className="text-red-500 hover:text-red-700 ml-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setCameraActiveIdx(idx)}
                            className="inline-flex items-center gap-1 bg-white border border-[#D8CABE] px-2.5 py-1.5 rounded-xl hover:bg-[#F9F4EB] text-[#7A4B30] font-medium transition-colors"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>กล้อง</span>
                          </button>
                          <label className="inline-flex items-center gap-1 bg-white border border-[#D8CABE] px-2.5 py-1.5 rounded-xl hover:bg-[#F9F4EB] text-[#7A4B30] font-medium cursor-pointer transition-colors">
                            <Upload className="w-3.5 h-3.5" />
                            <span>ไฟล์</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileUpload(idx, e)}
                              className="hidden"
                            />
                          </label>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Primary Navy Button: ถัดไป */}
            <button
              onClick={() => {
                if (validateBooksBrought()) {
                  setStep(4);
                }
              }}
              className="w-full py-2.5 sm:py-3 px-6 bg-[#2A3B4C] hover:bg-[#1E2B38] active:scale-[0.99] text-white font-medium text-base sm:text-lg rounded-2xl shadow-md transition-all cursor-pointer text-center tracking-tight"
            >
              ถัดไป
            </button>
          </div>
        )}

        {/* STEP 4: ขั้นตอนการติด Sticker บนหนังสือที่นำมา เพื่อเตรียมขึ้นชั้นแลก (Mockup 6) */}
        {step === 4 && (
          <div className="space-y-6 text-center">
            <h2 className="text-lg sm:text-2xl font-bold text-[#7A4B30] leading-snug">
              ขั้นตอนการติด Sticker บนหนังสือที่นำมา เพื่อเตรียมขึ้นชั้นแลก
            </h2>

            {/* 3D Realistic Book Illustration with Sticker */}
            <div className="w-48 h-48 sm:w-56 sm:h-56 mx-auto bg-gradient-to-b from-[#F2E5D5] to-[#E5D4C0] rounded-3xl p-6 flex items-center justify-center shadow-inner relative overflow-hidden border border-[#D8CABE]">
              {/* Perspective Book Spine and Cover */}
              <div className="relative w-32 h-40 bg-[#9A5B32] rounded-r-xl rounded-l-xs shadow-2xl flex flex-col justify-between p-3 transform -rotate-3 transition-transform hover:rotate-0 duration-300 border-l-4 border-[#783F1A]">
                {/* Book Embossed Title */}
                <div className="text-center pt-3">
                  <span className="text-[11px] font-bold tracking-widest text-[#F8E3C5] block font-serif">
                    STORIES
                  </span>
                  <span className="text-[8px] text-[#F8E3C5]/80 block mt-0.5">★</span>
                </div>

                {/* Sticker badge on top right */}
                <div className="absolute top-3 right-2 w-9 h-9 rounded-full bg-[#E5C282] border border-[#CBA054] shadow-md flex items-center justify-center animate-bounce">
                  <div className="w-3.5 h-3.5 rounded-full bg-[#9A5B32]/30 flex items-center justify-center text-[8px] font-bold text-[#623214]">
                    ♥
                  </div>
                </div>

                {/* Pages edge illusion */}
                <div className="absolute -bottom-2 left-2 right-1 h-2 bg-[#F7F2EB] rounded-b-xs border-t border-[#D9D1C7]" />
              </div>
            </div>

            {/* Instruction Headline */}
            <div>
              <p className="text-lg sm:text-xl font-bold text-[#7A4B30] leading-snug">
                กรุณานำ Sticker หมายเลข ไปติดบนหนังสือจริง
                <br />
                ตำแหน่งมุมขวาบน ของหนังสือ
              </p>
            </div>


            {/* Sticker Assignments List */}
            <div className="max-w-md mx-auto space-y-2 text-left">
              {bookEntries.map((b, i) => (
                <div
                  key={b.tempId}
                  className="bg-white/80 border border-[#EADBCC] rounded-2xl p-3 flex items-center justify-between text-xs sm:text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#7A4B30] text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {i + 1}
                    </span>
                    <span className="font-medium text-[#332D29] line-clamp-1">
                      {b.title || `เล่มที่ ${i + 1}`}
                    </span>
                  </div>
                  <span
                    className="text-[#7A4B30] font-mono font-semibold px-2.5 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: '#fff732', fontSize: '14px' }}
                  >
                    ติด Sticker หมายเลข : {b.code}
                  </span>
                </div>
              ))}
            </div>

            {/* Primary Navy Button: ยืนยันการติดสติกเกอร์ */}
            <button
              onClick={() => setStep(5)}
              className="w-full py-2.5 sm:py-3 px-6 bg-[#2A3B4C] hover:bg-[#1E2B38] active:scale-[0.99] text-white font-medium text-base sm:text-lg rounded-2xl shadow-md transition-all cursor-pointer text-center tracking-tight"
            >
              ยืนยันการติดสติกเกอร์
            </button>
          </div>
        )}

        {/* STEP 5: จับคู่การแลกเปลี่ยน (Mockup 7) */}
        {step === 5 && (
          <div className="space-y-6">
            {/* Header: Book Swap Badge + Title + Subtitle */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#EFE5D6] border border-[#E0D2BE] rounded-3xl flex items-center justify-center shadow-inner mx-auto p-2">
                {/* Two swapping books icon */}
                <div className="relative flex items-center justify-center w-full h-full">
                  <div className="w-6 h-8 bg-[#9A5B32] rounded-r-xs shadow-xs -rotate-12 absolute -left-1" />
                  <div className="w-6 h-8 bg-[#526B85] rounded-l-xs shadow-xs rotate-12 absolute -right-1" />
                  <div className="w-6 h-6 rounded-full bg-white/80 border border-[#7A4B30] flex items-center justify-center z-10">
                    <RotateCcw className="w-3.5 h-3.5 text-[#7A4B30]" />
                  </div>
                </div>
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold text-[#7A4B30]">
                จับคู่การแลกเปลี่ยน
              </h2>
              <p className="text-xs sm:text-sm text-[#71675E] font-medium">
                ท่านนำหนังสือมาแลก {bookEntries.length} เล่ม
              </p>
            </div>

            {/* Quick helper button to open shelf browser */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsBrowsingShelfForIdx(0)}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-[#7A4B30] bg-[#F5E2CC]/60 hover:bg-[#F5E2CC] px-3.5 py-1.5 rounded-full font-medium transition-colors cursor-pointer tracking-tight"
              >
                <Search className="w-4 h-4" />
                <span>คลิกดูหนังสือพร้อมแลกบนชั้น ({availableBooks.length} เล่ม)</span>
              </button>
            </div>

            {/* Book Matching Cards: 1 col on mobile, 2 cols on tablet/desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 text-left">
              {bookEntries.map((entry, idx) => {
                const isCancelled = entry.isCancelled;
                const isDonation = entry.matchTargetCode === 'DONATION';
                const feedback = matchVerificationFeedback[idx];
                const error = matchErrors[idx];

                return (
                  <div
                    key={entry.tempId || idx}
                    style={{
                      paddingLeft: '20px',
                      paddingRight: '20px',
                      paddingTop: '17px',
                      paddingBottom: '17px',
                    }}
                    className="border border-[#EADBCC] rounded-3xl bg-[#FAF5EE]/90 space-y-4 shadow-xs"
                  >
                    {/* Header: หนังสือที่นำมา รหัส U1 จะ Match เล่มไหน */}
                    <div>
                      <h3
                        className="font-medium text-[#263238] text-[15px] leading-[24px]"
                        style={{ fontSize: '15px', lineHeight: '24px' }}
                      >
                        หนังสือที่นำมา รหัส {entry.code} จะ Match เล่มไหน
                      </h3>
                      <p className="text-xs text-[#71675E] mt-0.5 truncate">
                        {entry.title ? `${entry.title} (เล่มที่ ${idx + 1})` : `เล่มที่ ${idx + 1}`}
                      </p>
                    </div>

                    {/* Row: Input + Match Check on the same line */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-nowrap">
                        <input
                          type="text"
                          disabled={isCancelled || isDonation}
                          value={isDonation ? 'DONATION (บริจาค)' : isCancelled ? 'NOT MATCH (ยกเลิก)' : entry.matchTargetCode || ''}
                          onChange={(e) => {
                            handleBookEntryChange(idx, 'isCancelled', false);
                            handleBookEntryChange(idx, 'matchTargetCode', e.target.value.toUpperCase());
                          }}
                          placeholder="กรอกรหัส (เช่น L1, U1)"
                          style={{ width: '176.646px', paddingTop: '6px', paddingBottom: '6px' }}
                          className="w-[176.646px] max-w-[62%] bg-white border border-[#D8CABE] disabled:bg-[#F0EBE3] rounded-2xl px-4 py-[6px] text-sm text-[#332D29] placeholder-[#9A9188] focus:outline-none focus:ring-2 focus:ring-[#7A4B30] uppercase shrink-0"
                        />
                        <button
                          type="button"
                          disabled={isCancelled || isDonation}
                          onClick={() => handleCheckCode(idx)}
                          style={{ paddingLeft: '14px', paddingTop: '6px', paddingBottom: '6px' }}
                          className="bg-[#6a8853] hover:bg-[#5a7446] active:scale-95 disabled:opacity-40 text-white rounded-xl pl-[14px] pr-3.5 py-[6px] text-xs sm:text-sm font-medium transition-all cursor-pointer shrink-0 shadow-xs tracking-tight whitespace-nowrap"
                        >
                          Match Check
                        </button>
                      </div>

                      {/* Verification / Match Feedback */}
                      {feedback && (
                        <div
                          style={{ paddingTop: '6px', paddingBottom: '6px', paddingLeft: '10px', paddingRight: '10px' }}
                          className={`rounded-2xl text-xs flex items-start gap-2 ${
                            feedback.success
                              ? 'bg-[#EBF5EE] text-[#2E7D32] border border-[#A7D7B5]'
                              : 'bg-[#FFF0F0] text-[#D32F2F] border border-[#FFCDCD]'
                          }`}
                        >
                          {feedback.success ? (
                            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          )}
                          <span>{feedback.message}</span>
                        </div>
                      )}

                      {error && !feedback && (
                        <div
                          style={{ paddingTop: '6px', paddingBottom: '6px', paddingLeft: '10px', paddingRight: '10px' }}
                          className="rounded-2xl text-xs bg-[#FFF0F0] text-[#D32F2F] border border-[#FFCDCD] flex items-center gap-1.5"
                        >
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{error}</span>
                        </div>
                      )}

                      {/* Button 1: Search available books button */}
                      <button
                        type="button"
                        disabled={isCancelled || isDonation}
                        onClick={() => {
                          setShelfSearchQuery('');
                          setIsBrowsingShelfForIdx(idx);
                        }}
                        style={{
                          backgroundColor: '#213b76',
                          fontSize: '13px',
                          paddingTop: '6px',
                          paddingBottom: '6px',
                          paddingLeft: '10px',
                          paddingRight: '10px',
                        }}
                        className="w-full bg-[#213b76] hover:bg-[#1a2f5e] active:scale-[0.99] border border-[#213b76] disabled:opacity-40 text-[#fff4ee] rounded-xl text-[13px] font-medium transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5 tracking-tight"
                        title="ค้นหาและเลือกหนังสือพร้อมแลกบนชั้น"
                      >
                        <Search className="w-3.5 h-3.5 shrink-0" style={{ color: '#fff8f2' }} />
                        <span style={{ fontSize: '13px', color: '#fff4ee' }}>
                          ค้นหาหนังสือพร้อมแลกบนชั้น (Available)
                        </span>
                      </button>

                      {/* Button 2: Secondary Action 1: ไม่พบหนังสือที่ต้องการ ต้องการบริจาค */}
                      <button
                        type="button"
                        onClick={() => handleSetDonation(idx)}
                        style={{
                          fontSize: '13px',
                          paddingTop: '6px',
                          paddingBottom: '6px',
                          paddingLeft: '10px',
                          paddingRight: '10px',
                        }}
                        className={`w-full rounded-xl text-[13px] font-medium border transition-colors cursor-pointer flex items-center justify-center text-center tracking-tight shadow-xs ${
                          isDonation
                            ? 'bg-[#EAD4B4] border-[#9E6F38] text-[#6E4211] ring-2 ring-[#9E6F38]/30 font-semibold'
                            : 'bg-[#F7EAD7] hover:bg-[#EEDBC3] text-[#9E6F38] border-[#E5CA9E]'
                        }`}
                      >
                        <span style={{ fontSize: '13px' }}>
                          {isDonation
                            ? '✓ เลือก: ต้องการบริจาค (ขอบคุณสำหรับน้ำใจ)'
                            : 'ไม่พบหนังสือที่ต้องการ ต้องการบริจาค'}
                        </span>
                      </button>

                      {/* Button 3: Secondary Action 2: เปลี่ยนใจ ไม่แลกแล้ว (Not Match) */}
                      <button
                        type="button"
                        onClick={() => handleSetNotMatch(idx)}
                        style={{
                          fontSize: '13px',
                          paddingTop: '6px',
                          paddingBottom: '6px',
                          paddingLeft: '10px',
                          paddingRight: '10px',
                        }}
                        className={`w-full rounded-xl text-[13px] font-medium border transition-colors cursor-pointer flex items-center justify-center text-center tracking-tight shadow-xs ${
                          isCancelled
                            ? 'bg-[#FFD9D9] border-[#E03A3A] text-[#B01717] ring-2 ring-[#E03A3A]/30 font-semibold'
                            : 'bg-[#FFF0F0] hover:bg-[#FEE5E5] text-[#E03A3A] border-[#FFCDCD]'
                        }`}
                      >
                        <span style={{ fontSize: '13px' }}>
                          {isCancelled
                            ? '✓ เลือก: เปลี่ยนใจ ไม่แลกแล้ว (Not Match)'
                            : 'เปลี่ยนใจ ไม่แลกแล้ว (Not Match)'}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Primary Navy Button: สรุปการทำรายการ */}
            <button
              onClick={handleConfirmExchange}
              className="w-full py-2.5 sm:py-3 px-6 bg-[#2A3B4C] hover:bg-[#1E2B38] active:scale-[0.99] text-white font-medium text-base sm:text-lg rounded-2xl shadow-md transition-all cursor-pointer text-center tracking-tight"
            >
              สรุปการทำรายการ
            </button>
          </div>
        )}

        {/* STEP 6: สิ้นสุด / สรุปรายการ (Slip / Summary) */}
        {step === 6 && completedTransaction && (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[#EBF5EE] text-[#2E7D32] border-2 border-[#A7D7B5] flex items-center justify-center mx-auto shadow-sm">
              <Check className="w-8 h-8" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-[#7A4B30]">
              ทำรายการแลกเปลี่ยนสำเร็จ
            </h2>
            <p
              className="text-[#71675E] text-[17px] font-bold"
              style={{ fontSize: '17px', fontWeight: 'bold' }}
            >
              ขอขอบคุณที่ร่วมส่งต่อหนังสือและการอ่านในชุมชนห้องสมุด
            </p>

            {/* Receipt Slip Container */}
            <div
              className="bg-white border-2 border-dashed border-[#D8CABE] rounded-3xl text-left space-y-5 max-w-lg mx-auto shadow-sm pl-[19px] pr-[32px] py-[20px]"
              style={{
                paddingLeft: '19px',
                paddingRight: '32px',
                paddingTop: '20px',
                paddingBottom: '20px',
              }}
            >
              {/* Slip Header */}
              <div className="border-b border-[#EADBCC] pb-3 text-center">
                <div
                  className="font-bold text-[#7A4B30] text-[18px] pl-0 ml-0"
                  style={{ paddingLeft: '0px', marginLeft: '0px', fontSize: '18px' }}
                >
                  สำนักหอสมุด มหาวิทยาลัยเชียงใหม่
                </div>
                <div className="text-[11px] font-mono text-[#9A9188] mt-1">
                  รหัสรายการ: {completedTransaction.transaction.id} | วันที่:{' '}
                  {new Date(completedTransaction.transaction.timestamp).toLocaleDateString('th-TH')}{' '}
                  {new Date(completedTransaction.transaction.timestamp).toLocaleTimeString('th-TH', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              {/* Participant info (PDPA Compliant) */}
              <div className="text-xs text-[#332D29] space-y-1.5 bg-[#F9F4EB] p-3 rounded-2xl border border-[#EADBCC]">
                <div className="flex justify-between">
                  <span className="text-[#71675E]">การร่วมกิจกรรม:</span>{' '}
                  <span className="font-medium text-[#263238]">{participant.participationHistory || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71675E]">การมาร่วมในปีนี้:</span>{' '}
                  <span className="font-medium text-[#263238]">{participant.visitFrequencyThisYear || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71675E]">กลุ่มสมาชิก:</span>{' '}
                  <span className="font-medium text-[#263238]">{participant.memberType || '-'}</span>
                </div>
              </div>

              {/* Transactions Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-[#7A4B30] uppercase tracking-wide">
                  รายละเอียดรายการ
                </h4>

                {/* Books Brought & Matched */}
                {bookEntries.map((entry, idx) => {
                  const targetCode = entry.matchTargetCode?.trim().toUpperCase();
                  const isDonation = targetCode === 'DONATION';
                  const isCancelled = entry.isCancelled;

                  return (
                    <div
                      key={entry.tempId || idx}
                      className="border border-[#EADBCC] rounded-2xl p-3 text-xs bg-[#FAF5EE]/50 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="font-medium text-[#332D29] text-[15px]"
                          style={{ fontSize: '15px' }}
                        >
                          เล่มที่ {idx + 1}: {entry.title}
                        </span>
                        <span
                          className="font-mono text-[#7A4B30] font-semibold text-[15px]"
                          style={{ fontSize: '15px' }}
                        >
                          รหัส {entry.code}
                        </span>
                      </div>

                      <div className="text-[13px] pt-1 border-t border-[#EADBCC]/60 flex items-center justify-between">
                        <span className="text-[#71675E] text-[15px]" style={{ fontSize: '15px' }}>
                          สถานะ:
                        </span>
                        {isDonation ? (
                          <span
                            className="text-[#9E6F38] font-medium bg-[#F7EAD7] px-2 py-0.5 rounded-full text-[15px]"
                            style={{ fontSize: '15px' }}
                          >
                            บริจาคให้ห้องสมุด
                          </span>
                        ) : isCancelled ? (
                          <span
                            className="text-[#E03A3A] font-medium bg-[#FFF0F0] px-2 py-0.5 rounded-full text-[15px]"
                            style={{ fontSize: '15px' }}
                          >
                            เปลี่ยนใจ ไม่แลกแล้ว (รับเล่มเดิมกลับ)
                          </span>
                        ) : (
                          <span
                            className="text-[#2E7D32] font-medium bg-[#EBF5EE] px-2 py-0.5 rounded-full text-[15px]"
                            style={{ fontSize: '15px' }}
                          >
                            แลกกับรหัส {targetCode}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Physical Instructions / Thank You Note */}
              <div
                style={{
                  backgroundColor: '#333f33',
                  width: '457.444px',
                  height: '107.528px',
                }}
                className="border border-[#2a342a] p-4 rounded-2xl text-xs space-y-1 max-w-full mx-auto flex items-center justify-center"
              >
                <p
                  className="text-center text-[23px] font-medium leading-relaxed"
                  style={{ textAlign: 'center', fontSize: '23px', color: '#ffdddd' }}
                >
                  โปรดนำตัวเล่มที่นำมาแลก ไปวางไว้บนชั้น เพื่อรอผู้ร่วมกิจกรรมท่านอื่น มาเลือกต่อไป
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleResetKiosk}
                className="w-full py-2.5 sm:py-3 px-6 bg-[#2A3B4C] hover:bg-[#1E2B38] text-white font-medium text-base sm:text-lg rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 tracking-tight"
              >
                <span>เสร็จสิ้นและกลับสู่หน้าแรก</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>



      {/* Back button when inside steps 1 to 5 */}
      {step >= 1 && step <= 5 && (
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-[#8A7E74] hover:text-[#7A4B30] font-medium transition-colors mt-4 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>ย้อนกลับขั้นตอนก่อนหน้า</span>
        </button>
      )}

      {/* Camera Capture Modal */}
      {cameraActiveIdx !== null && (
        <CameraCaptureModal
          isOpen={true}
          onClose={() => setCameraActiveIdx(null)}
          onCapture={(dataUrl) => {
            handleBookEntryChange(cameraActiveIdx, 'coverImage', dataUrl);
            setCameraActiveIdx(null);
          }}
        />
      )}

      {/* Shelf Browser Drawer/Modal for Step 5 */}
      {isBrowsingShelfForIdx !== null && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FAF5EE] rounded-3xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-[#EADBCC]">
            <div className="flex items-center justify-between pb-3 border-b border-[#EADBCC]">
              <div>
                <h3 className="font-bold text-lg text-[#7A4B30]">
                  เลือกหนังสือบนชั้นที่พร้อมแลก
                </h3>
                <p className="text-xs text-[#71675E]">
                  คลิกที่เล่มที่ต้องการเพื่อเลือกแลกในรายการ No. {isBrowsingShelfForIdx + 1}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBrowsingShelfForIdx(null)}
                className="w-8 h-8 rounded-full bg-white border border-[#D8CABE] flex items-center justify-center text-[#71675E] hover:text-[#332D29]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="py-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A9188]" />
                <input
                  type="text"
                  value={shelfSearchQuery}
                  onChange={(e) => setShelfSearchQuery(e.target.value)}
                  placeholder="ค้นหาชื่อเรื่อง รหัส หรือหมวดหมู่..."
                  className="w-full bg-white border border-[#D8CABE] rounded-2xl pl-10 pr-4 py-2.5 text-sm text-[#332D29] placeholder-[#9A9188] focus:outline-none focus:ring-2 focus:ring-[#7A4B30]"
                />
              </div>
            </div>

            {/* Books List Grid */}
            <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredShelf.length === 0 ? (
                <div className="col-span-full py-12 text-center text-[#71675E] space-y-1">
                  <p className="font-medium text-sm">ไม่พบหนังสือพร้อมแลก</p>
                  <p className="text-xs text-[#9A9188]">
                    {shelfSearchQuery ? `ไม่พบหนังสือที่ตรงกับ "${shelfSearchQuery}"` : 'ขณะนี้ยังไม่มีหนังสือพร้อมแลกในระบบ'}
                  </p>
                </div>
              ) : (
                filteredShelf.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => {
                      handleBookEntryChange(isBrowsingShelfForIdx, 'isCancelled', false);
                      handleBookEntryChange(isBrowsingShelfForIdx, 'matchTargetCode', b.code);
                      handleCheckCode(isBrowsingShelfForIdx, b.code);
                      setIsBrowsingShelfForIdx(null);
                    }}
                    className="group bg-white border border-[#EADBCC] hover:border-[#7A4B30] rounded-2xl p-3 flex flex-col justify-between hover:shadow-md cursor-pointer transition-all relative"
                  >
                    <div className="aspect-square rounded-xl bg-[#C8C3BC] overflow-hidden mb-2 relative">
                      {b.coverImage ? (
                        <img src={b.coverImage} alt={b.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <MockBookCover
                          title={b.title}
                          category={b.category}
                          code={b.code}
                          seed={b.code || b.title}
                          size="sm"
                        />
                      )}
                      <span className="absolute top-1.5 left-1.5 bg-[#2A3B4C] text-white text-[10px] font-mono px-2 py-0.5 rounded-md font-bold z-20 shadow-xs">
                        {b.code}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-medium text-xs text-[#332D29] line-clamp-1 group-hover:text-[#7A4B30] transition-colors">
                        {b.title}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#71675E]">
                        <span className="truncate">{b.category}</span>
                        <span className="text-[10px] font-semibold text-[#6a8853] bg-[#EBF5EE] px-1.5 py-0.5 rounded-md shrink-0">
                          คลิกเพื่อเลือก
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Book Preview Modal (from Home Welcome Shelf) */}
      {previewBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#FAF5EE] border border-[#EADBCC] rounded-3xl p-6 max-w-sm w-full shadow-2xl relative space-y-4">
            <button
              type="button"
              onClick={() => setPreviewBook(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/80 border border-[#EADBCC] flex items-center justify-center text-[#717171] hover:text-[#263238] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Cover image or fallback */}
            <div className="w-36 h-36 mx-auto rounded-2xl bg-[#C8C3BC] overflow-hidden shadow-inner flex items-center justify-center relative">
              {previewBook.coverImage ? (
                <img
                  src={previewBook.coverImage}
                  alt={previewBook.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <MockBookCover
                  title={previewBook.title}
                  category={previewBook.category}
                  code={previewBook.code}
                  seed={previewBook.code || previewBook.title}
                  size="lg"
                />
              )}
              <span className="absolute top-2 left-2 bg-[#2A3B4C] text-white text-xs font-bold font-mono px-2 py-0.5 rounded-md shadow-xs z-20">
                {previewBook.code}
              </span>
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="font-bold text-[#263238] text-base leading-snug">
                {previewBook.title}
              </h3>
              <p className="text-xs text-[#7A4B30] font-medium bg-[#EFE5D6] inline-block px-3 py-1 rounded-full">
                {previewBook.category}
              </p>
              <div className="flex items-center justify-center gap-3 text-xs text-[#8A7E74] pt-1">
                <span>ที่มา: {previewBook.source === 'Library' ? 'ส่วนกลาง (L)' : 'ผู้ร่วมกิจกรรม (U)'}</span>
                <span>•</span>
                <span>แลกแล้ว {previewBook.exchangeCount || 1} ครั้ง</span>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setPreviewBook(null)}
                className="flex-1 py-2.5 px-4 bg-white border border-[#EADBCC] text-[#717171] hover:text-[#263238] font-medium text-sm rounded-xl transition-all cursor-pointer"
              >
                ปิด
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewBook(null);
                  initBookEntries(1);
                  setStep(1);
                }}
                className="flex-1 py-2.5 px-4 bg-[#2A3B4C] hover:bg-[#1E2B38] text-white font-medium text-sm rounded-xl transition-all shadow-xs cursor-pointer text-center"
              >
                เริ่มแลกเล่มนี้
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
