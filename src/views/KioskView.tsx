import React, { useState, useEffect } from 'react';
import {
  Plus,
  Minus,
  Search,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Tag,
  Layers,
  Package,
  Heart,
  ClipboardList,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Book, SystemSettings, ParticipantInfo, KioskBookEntry, TransactionRecord } from '../types';
import { StorageService, normalizeCategory } from '../services/storage';
import { MockBookCover } from '../components/BookCover';
import {
  HeroBookStackIllustration,
  HeroBookMascotIllustration,
  BookCardEcoArtwork,
  getEcoCardTheme,
  EcoLeafSprig,
  TermsTitleOpenBookIllustration,
  TermsChecklistMascotIllustration,
  ParticipantClipboardBadgeIllustration,
  ParticipantBookMascotIllustration,
  ParticipantOptionIcon,
  Step3LeftBookStackIllustration,
  Step3RightOpenBookIllustration,
  Step3CardMiniBookIllustration,
  Step4StickerBookSceneIllustration,
  Step4MiniOpenBookIllustration,
  Step5BookSearchMascotIllustration,
  Step6LeftBookPlantIllustration,
  Step6RightHeartMascotIllustration,
} from '../components/EcoIllustrations';

interface KioskViewProps {
  settings: SystemSettings;
  books: Book[];
  onTransactionComplete: (newBooks: Book[], transaction: TransactionRecord) => void;
  onOpenAdminLogin?: () => void;
  onRefreshBooks?: () => Promise<Book[]>;
}

export const KioskView: React.FC<KioskViewProps> = ({
  settings,
  books,
  onTransactionComplete,
  onRefreshBooks,
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

  // Completed transaction data
  const [completedTransaction, setCompletedTransaction] = useState<{
    transaction: TransactionRecord;
    userBooks: Book[];
    takenBooks: Book[];
  } | null>(null);

  // Home Welcome Shelf controls (Side-scrolling & criteria)
  const [homeCategory, setHomeCategory] = useState<string>('all');
  const [homeSortOrder] = useState<'newest' | 'code' | 'popular'>('newest');
  const [previewBook, setPreviewBook] = useState<Book | null>(null);
  const homeCarouselRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0.35);

  const checkHomeCarouselScroll = () => {
    if (homeCarouselRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = homeCarouselRef.current;
      setCanScrollLeft(scrollLeft > 8);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 8);
      const maxScroll = Math.max(1, scrollWidth - clientWidth);
      const ratio = scrollWidth <= clientWidth ? 1 : Math.min(1, Math.max(0.25, 0.25 + (scrollLeft / maxScroll) * 0.75));
      setScrollProgress(ratio);
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

  // Initialize book entries when entering step 3 and reconcile codes with freshest Google Sheet Books
  useEffect(() => {
    if (step !== 3) return;
    let cancelled = false;

    if (bookEntries.length === 0) {
      initBookEntries(bookCount, books);
    }

    if (onRefreshBooks) {
      onRefreshBooks()
        .then((latestBooks) => {
          if (cancelled) return;
          setBookEntries((prev) => {
            const count = prev.length || bookCount;
            const freshCodes = StorageService.generateNextUCodes(count, latestBooks);
            if (prev.length === 0) {
              return freshCodes.map((code, i) => ({
                tempId: `entry-${Date.now()}-${i}`,
                code,
                title: '',
                isbn: '',
                price: undefined,
                category: '',
                coverImage: undefined,
                matchTargetCode: '',
                isCancelled: false,
              }));
            }
            return prev.map((entry, idx) => ({
              ...entry,
              code: freshCodes[idx] || entry.code,
            }));
          });
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [step]);

  const initBookEntries = (count: number, overrideBooks?: Book[]) => {
    const codes = StorageService.generateNextUCodes(count, overrideBooks ?? books);
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
    const codes = StorageService.generateNextUCodes(newCount, books);
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
    const currentBooks = StorageService.getBooks();
    const existingCodeSet = new Set(
      currentBooks.map((b) => (b.code || '').trim().toUpperCase()).filter(Boolean)
    );
    const allocatedInTx = new Set<string>();

    // Final non-duplication safeguard: guarantee every assigned U code is unique against currentBooks & within this transaction
    const resolveUniqueUCode = (preferredCode: string): string => {
      const clean = (preferredCode || '').trim().toUpperCase();
      if (clean && !existingCodeSet.has(clean) && !allocatedInTx.has(clean)) {
        allocatedInTx.add(clean);
        return clean;
      }
      const tempBooks: Book[] = [
        ...currentBooks,
        ...Array.from(allocatedInTx).map((c) => ({ code: c } as Book)),
      ];
      const nextCode = StorageService.generateNextUCodes(1, tempBooks)[0];
      allocatedInTx.add(nextCode);
      return nextCode;
    };

    const booksToAdd: Book[] = [];
    const booksToUpdate: Book[] = [];
    const broughtCodes: string[] = [];
    const takenCodes: string[] = [];
    const committedCodes: string[] = [];
    let donatedCount = 0;
    let cancelledCount = 0;
    let matchedCount = 0;

    const txId = `TX-${Date.now().toString().slice(-6)}`;

    bookEntries.forEach((entry) => {
      const finalCode = resolveUniqueUCode(entry.code);
      committedCodes.push(finalCode);

      if (entry.isCancelled) {
        cancelledCount++;
        booksToAdd.push({
          id: `book-${Date.now()}-${finalCode}`,
          code: finalCode,
          title: entry.title || 'ยกเลิกการแลก (Not Match)',
          isbn: entry.isbn,
          category: entry.category,
          price: entry.price ?? 0,
          status: 'Not Match',
          source: 'User',
          transactionId: txId,
          matchedTransactionId: '',
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
        broughtCodes.push(finalCode);
        booksToAdd.push({
          id: `book-${Date.now()}-${finalCode}`,
          code: finalCode,
          title: entry.title || 'หนังสือบริจาค',
          isbn: entry.isbn,
          category: entry.category,
          price: entry.price ?? 0,
          status: 'Available',
          source: 'Library',
          transactionId: txId,
          matchedTransactionId: '',
          memberType: participant.memberType,
          coverImage: entry.coverImage,
          createdAt: now,
          exchangeCount: 1,
        });
      } else {
        matchedCount++;
        broughtCodes.push(finalCode);
        takenCodes.push(targetCode!);

        booksToAdd.push({
          id: `book-${Date.now()}-${finalCode}`,
          code: finalCode,
          title: entry.title,
          isbn: entry.isbn,
          category: entry.category,
          price: entry.price ?? 0,
          status: 'Available',
          source: 'User',
          transactionId: txId,
          matchedTransactionId: txId,
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
            matchedWithCode: finalCode,
            matchedTransactionId: txId,
            exchangeCount: (shelfBook.exchangeCount || 1) + 1,
          });
        }
      }
    });

    StorageService.commitUCodes(committedCodes);

    const totalBroughtCount = bookEntries.length;

    const transactionRecord: TransactionRecord = {
      id: txId,
      timestamp: now,
      participant,
      totalBroughtCount,
      matchedCount,
      donatedCount,
      cancelledCount,
      booksBrought: broughtCodes,
      booksTaken: takenCodes,
      booksBroughtCount: totalBroughtCount,
      booksTakenCount: takenCodes.length,
    };

    const updatedBooks = currentBooks.map((b) => {
      const matchUpdate = booksToUpdate.find((u) => u.code === b.code);
      return matchUpdate || b;
    });
    const finalBooks = StorageService.sortBooks([...booksToAdd, ...updatedBooks]);

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
      colors: ['#7D502E', '#4B5E26', '#6A8852', '#E5A93B'],
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

  // Exact categories present in Available books from Google Sheet
  const homeSheetCategories = React.useMemo(() => {
    const counts = new Map<string, number>();
    books
      .filter((b) => b.status === 'Available')
      .forEach((b) => {
        const exactCat = (b.category || '').trim() || 'หนังสือทั่วไป';
        counts.set(exactCat, (counts.get(exactCat) || 0) + 1);
      });

    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category, 'th'));
  }, [books]);

  useEffect(() => {
    if (
      homeCategory !== 'all' &&
      !homeSheetCategories.some((item) => item.category === homeCategory)
    ) {
      setHomeCategory('all');
    }
  }, [homeCategory, homeSheetCategories]);

  // Filter and sort for the home screen shelf
  const homeAvailableBooks = React.useMemo(() => {
    let result = books.filter((b) => b.status === 'Available');

    if (homeCategory !== 'all') {
      result = result.filter(
        (b) => ((b.category || '').trim() || 'หนังสือทั่วไป') === homeCategory
      );
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

  const categoryOptions = React.useMemo(
    () =>
      (settings.categories || [])
        .map((cat) => String(cat || '').trim())
        .filter((cat, idx, arr) => cat !== '' && arr.indexOf(cat) === idx),
    [settings.categories]
  );

  const getShortCatLabel = (cat: string) => {
    const norm = normalizeCategory(cat);
    if (norm === 'หนังสือทั่วไป') return 'ทั่วไป';
    if (norm.includes('เรียน')) return 'วิชาการ';
    if (norm.includes('การ์ตูน')) return 'การ์ตูน';
    if (norm.includes('นวนิยาย')) return 'นวนิยาย';
    if (norm.includes('เยาวชน')) return 'เยาวชน';
    if (norm.includes('พัฒนาตนเอง')) return 'จิตวิทยา';
    if (norm.includes('เรื่องสั้น')) return 'เรื่องสั้น';
    return cat.replace(/\/.*$/, '').replace('หนังสือ', '').trim() || cat;
  };

  const stepsList = [
    { num: 1, label: 'เงื่อนไข' },
    { num: 2, label: 'ข้อมูลผู้ร่วม' },
    { num: 3, label: 'หนังสือ' },
    { num: 4, label: 'ติดเลข' },
    { num: 5, label: 'จับคู่' },
    { num: 6, label: 'สิ้นสุด' },
  ];

  const renderBackButton = () => (
    <button
      type="button"
      onClick={() => setStep((s) => Math.max(0, s - 1))}
      className="w-full sm:w-auto py-3.5 px-6 sm:px-7 rounded-full bg-[#FFFDF9] hover:bg-[#F8F2E7] border border-[#E2D4C0] hover:border-[#7D502E] active:scale-[0.99] text-[#4E342E] font-bold text-sm sm:text-base transition-all cursor-pointer flex items-center justify-center gap-2.5 shrink-0 shadow-[0_4px_14px_rgba(92,58,33,0.06)]"
    >
      <ArrowLeft className="w-4 h-4 shrink-0 stroke-[2.25]" />
      <span>ย้อนกลับขั้นตอนก่อนหน้า</span>
    </button>
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] py-5 sm:py-8 px-3 sm:px-6 flex flex-col items-center justify-start font-sans select-none">
      {/* Main Floating Eco-Library Card Container */}
      <div
        className="w-full max-w-6xl bg-[#FFFCF7]/95 backdrop-blur-sm rounded-[28px] sm:rounded-[34px] shadow-[0_18px_48px_rgba(92,58,33,0.09)] border border-[#EAE0D2] p-5 sm:p-8 lg:p-10 transition-all"
      >
        {/* Step Indicator Header (Steps 1 to 6) */}
        {step >= 1 && step <= 6 && (
          <div className="-mt-[20px] mb-7 bg-[#FFFDF9]/95 border border-[#EAE0D2] rounded-[24px] px-4 sm:px-8 py-4 shadow-[0_6px_20px_rgba(92,58,33,0.05)] relative overflow-visible">
            {/* Subtle Golden 4-point Sparkles on Top Left */}
            <svg
              viewBox="0 0 36 28"
              fill="none"
              className="w-7 h-6 absolute -top-2 left-1 sm:left-3 pointer-events-none"
              aria-hidden="true"
            >
              <path d="M10 2L12.3 8.7L19 11L12.3 13.3L10 20L7.7 13.3L1 11L7.7 8.7L10 2Z" fill="#FBC02D" />
              <path d="M27 11L28.5 15.5L33 17L28.5 18.5L27 23L25.5 18.5L21 17L25.5 15.5L27 11Z" fill="#F59E0B" />
            </svg>

            <div className="flex items-center justify-between relative">
              <div className="absolute left-7 right-7 top-4.5 sm:top-5 h-[1.5px] -translate-y-1/2 z-0 bg-[#DFCEB8]">
                <div
                  className="h-full bg-[#6A8852] transition-all duration-300 rounded-full"
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
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-bold transition-all tabular-nums relative ${
                        isActive
                          ? 'bg-gradient-to-b from-[#8D5B34] to-[#6E4425] text-white ring-4 ring-[#7D502E]/15 shadow-md scale-105'
                          : isPassed
                            ? 'bg-[#6A8852] text-white shadow-xs'
                            : 'bg-white border border-[#E2D4C0] text-[#5C3A21] shadow-2xs'
                      }`}
                    >
                      {isPassed ? <Check className="w-4 h-4 stroke-[2.75]" /> : s.num}
                      {isActive && (
                        <svg
                          viewBox="0 0 18 18"
                          fill="none"
                          className="w-4 h-4 absolute -top-2.5 -right-3 pointer-events-none"
                          aria-hidden="true"
                        >
                          <path d="M3 7L7 2" stroke="#F59E0B" strokeWidth="2.4" strokeLinecap="round" />
                          <path d="M7 10L13 7" stroke="#F59E0B" strokeWidth="2.4" strokeLinecap="round" />
                          <path d="M8 14L14 13" stroke="#F59E0B" strokeWidth="2.4" strokeLinecap="round" />
                        </svg>
                      )}
                    </div>
                    <span
                      className={`text-[11px] sm:text-xs mt-1.5 transition-all whitespace-nowrap ${
                        isActive
                          ? 'bg-[#F7E5B8] text-[#5C3A21] font-bold px-3 py-0.5 rounded-full shadow-2xs'
                          : isPassed
                            ? 'text-[#4B5E26] font-semibold px-1'
                            : 'text-[#5C3A21]/85 font-medium px-1'
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

        {/* STEP 0: WELCOME SCREEN (Exact Match to Mockup Layout) */}
        {step === 0 && (
          <div className="-mt-[20px] space-y-6">
            {/* Hero Banner: Left Stack Books | Center Slogan | Right Book Mascot */}
            <div className="-mt-[36px] flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 px-2 sm:px-4 pt-1 pb-2">
              {/* Left Hero Stack + Center Text */}
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                <HeroBookStackIllustration className="w-36 h-26 sm:w-42 sm:h-30 shrink-0 drop-shadow-xs" />

                <div className="hidden sm:block w-px h-20 bg-[#D8CBB8] shrink-0" />

                <div className="text-center sm:text-left">
                  <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold text-[#5C3A21] leading-tight tracking-tight text-balance">
                    เปลี่ยนเล่ม เปลี่ยนโลก
                  </h1>
                  <p className="text-base sm:text-lg lg:text-xl font-semibold text-[#6D4C41] mt-1">
                    สำนักหอสมุด มหาวิทยาลัยเชียงใหม่
                  </p>
                </div>
              </div>

              {/* Right Cute Green Book Mascot */}
              <div className="hidden md:block shrink-0">
                <HeroBookMascotIllustration className="w-44 h-30 lg:w-48 lg:h-32 drop-shadow-xs" />
              </div>
            </div>

            {/* Books Available Section */}
            {settings.showWelcomeShelf !== false && (
              <div className="space-y-3.5">
                {/* Title Row */}
                <div className="-mt-[27px] flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold text-[#3E2723]">
                      หนังสือที่พร้อมแลกในขณะนี้
                    </h2>
                    <span className="text-xs bg-[#E9EBC8] text-[#4B5E26] font-semibold px-3 py-1 rounded-full border border-[#D4DAA8]">
                      พร้อมแลก {homeAvailableBooks.length} เล่ม
                    </span>
                  </div>
                </div>

                {/* Category Filter Pills + Carousel Arrows */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 text-xs flex-1">
                    <button
                      type="button"
                      onClick={() => setHomeCategory('all')}
                      className={`px-4 py-1.5 rounded-full shrink-0 font-semibold transition-all cursor-pointer whitespace-nowrap ${
                        homeCategory === 'all'
                          ? 'bg-[#7D502E] text-white shadow-xs'
                          : 'bg-white text-[#4E342E] hover:bg-[#F8F2E7] border border-[#E5D8C8]'
                      }`}
                    >
                      ทั้งหมด ({books.filter((b) => b.status === 'Available').length})
                    </button>
                    {homeSheetCategories.map(({ category, count }) => {
                      const isActive = homeCategory === category;
                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setHomeCategory(category)}
                          className={`px-3.5 py-1.5 rounded-full shrink-0 font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                            isActive
                              ? 'bg-[#7D502E] text-white shadow-xs'
                              : 'bg-white text-[#4E342E] hover:bg-[#F8F2E7] border border-[#E5D8C8]'
                          }`}
                        >
                          <span>{category}</span>
                          <span
                            className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full tabular-nums ${
                              isActive ? 'bg-white/25 text-white' : 'bg-[#F2EAE0] text-[#7D502E]'
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Circular Carousel Controls (< >) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleScrollCarousel('left')}
                      disabled={!canScrollLeft}
                      className="w-9 h-9 rounded-full bg-white border border-[#E5D8C8] flex items-center justify-center text-[#4E342E] hover:bg-[#F8F2E7] disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer active:scale-95"
                      aria-label="เลื่อนซ้าย"
                      title="เลื่อนซ้าย"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScrollCarousel('right')}
                      disabled={!canScrollRight}
                      className="w-9 h-9 rounded-full bg-white border border-[#E5D8C8] flex items-center justify-center text-[#4E342E] hover:bg-[#F8F2E7] disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer active:scale-95"
                      aria-label="เลื่อนขวา"
                      title="เลื่อนขวา"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 5-Card Book Showcase Carousel */}
                <div
                  ref={homeCarouselRef}
                  onScroll={checkHomeCarouselScroll}
                  className="flex gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar pb-1 pt-0.5 scroll-smooth snap-x snap-mandatory focus:outline-none"
                >
                  {homeAvailableBooks.length > 0 ? (
                    homeAvailableBooks.map((book) => {
                      const cover = book.coverImage;
                      const ecoTheme = getEcoCardTheme(book.code || book.title || 'cmu');
                      const exactCat = (book.category || '').trim() || 'หนังสือทั่วไป';

                      return (
                        <div
                          key={book.id || book.code}
                          onClick={() => setPreviewBook(book)}
                          className="w-[180px] sm:w-[calc(33.333%-11px)] md:w-[calc(25%-12px)] lg:w-[calc(20%-12.8px)] min-w-[170px] shrink-0 snap-start bg-white border border-[#EAE0D2] rounded-2xl p-2.5 text-center shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:border-[#C5B197] transition-all flex flex-col cursor-pointer group select-none"
                        >
                          {/* Inner Pastel Artwork Frame */}
                          <div
                            style={{ backgroundColor: ecoTheme.bg }}
                            className="w-full aspect-[4/3.5] rounded-xl relative overflow-hidden flex flex-col items-center justify-between p-2.5"
                          >
                            {/* Top-Left Olive Forest Code Badge */}
                            <div className="w-full flex items-center justify-start z-20">
                              <span
                                className={`text-[11px] font-bold font-mono px-2.5 py-0.5 rounded-full shadow-2xs ${
                                  book.code.startsWith('L')
                                    ? 'bg-[#7D502E] text-white'
                                    : 'bg-[#4B5E26] text-white'
                                }`}
                              >
                                {book.code}
                              </span>
                            </div>

                            {cover ? (
                              <img
                                src={cover}
                                alt={book.title}
                                referrerPolicy="no-referrer"
                                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 z-10"
                              />
                            ) : (
                              <>
                                <div className="my-auto flex flex-col items-center justify-center z-10 w-full px-1">
                                  <BookCardEcoArtwork
                                    variant={ecoTheme.variant}
                                    className="w-22 h-16 sm:w-24 sm:h-17 group-hover:scale-105 transition-transform duration-300"
                                  />
                                </div>
                              </>
                            )}

                            {/* Detail Action Pill */}
                            <div className="z-20 w-full flex justify-center">
                              <span className="inline-flex items-center gap-1 bg-white/95 group-hover:bg-white text-[#4E342E] border border-[#EAE0D2] text-[11px] font-semibold px-3 py-0.5 rounded-full shadow-xs">
                                <Search className="w-3 h-3 text-[#7D502E]" />
                                <span>ดูรายละเอียด</span>
                              </span>
                            </div>
                          </div>

                          {/* Card Footer Metadata */}
                          <div className="pt-2.5 pb-0.5 px-1 text-center">
                            <p className="text-sm font-bold text-[#3E2723] line-clamp-1 group-hover:text-[#7D502E] transition-colors">
                              {book.title}
                            </p>
                            <p className="text-[11px] text-[#7E7369] mt-0.5 truncate font-medium" title={exactCat}>
                              {exactCat}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="w-full py-10 text-center text-[#7E7369] text-sm bg-white/70 rounded-2xl border border-dashed border-[#E5D8C8]">
                      ไม่พบหนังสือในหมวดนี้
                    </div>
                  )}
                </div>

                {/* Carousel Scroll Progress Bar */}
                {homeAvailableBooks.length > 0 && (
                  <div className="pt-1 flex items-center justify-between gap-4">
                    <div className="w-48 sm:w-64 h-1.5 bg-[#EAE0D2] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#6A8852] rounded-full transition-all duration-300"
                        style={{ width: `${Math.round(scrollProgress * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-[#8E8175] sm:hidden">
                      เลื่อนดูหนังสือ →
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Primary Pill CTA Button: เริ่มต้นการแลกเปลี่ยน (>) */}
            <button
              type="button"
              onClick={() => {
                setBookCount(1);
                setBookEntries([]);
                setStep(1);
              }}
              className="w-full py-3.5 px-8 rounded-full bg-gradient-to-r from-[#875835] to-[#744829] hover:from-[#754B2B] hover:to-[#603A1F] active:scale-[0.99] text-white font-bold text-base sm:text-lg shadow-[0_10px_28px_rgba(116,72,41,0.25)] transition-all cursor-pointer flex items-center justify-center gap-3"
            >
              <span>เริ่มต้นการแลกเปลี่ยน</span>
              <span className="w-6 h-6 rounded-full bg-white text-[#744829] flex items-center justify-center shrink-0">
                <ChevronRight className="w-4 h-4 stroke-[2.75]" />
              </span>
            </button>
          </div>
        )}

        {/* STEP 1: เงื่อนไขการเข้าร่วมกิจกรรม */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Decorative Sage-Green Title Ribbon with Open Book & Leaf Sprigs */}
            <div className="-mt-[17px] flex items-center justify-center pt-1 pb-1">
              <div className="relative inline-flex items-center justify-center">
                <EcoLeafSprig className="hidden sm:block w-11 h-9 -mr-3 z-0 pointer-events-none" />
                <TermsTitleOpenBookIllustration className="w-20 h-16 sm:w-24 sm:h-18 -mr-7 sm:-mr-9 -mt-2 z-20 shrink-0 pointer-events-none drop-shadow-xs" />

                <div className="bg-gradient-to-r from-[#E6F1D0] via-[#DCECC0] to-[#E6F1D0] border border-[#CFE2AD] rounded-full pl-9 sm:pl-12 pr-8 sm:pr-12 py-2.5 sm:py-3 shadow-[0_4px_14px_rgba(106,136,82,0.12)] relative z-10">
                  <h2 className="text-lg sm:text-2xl md:text-[26px] font-bold text-[#5C3A21] tracking-tight whitespace-nowrap">
                    เงื่อนไขการเข้าร่วมกิจกรรม
                  </h2>
                </div>

                <EcoLeafSprig flip className="hidden sm:block w-11 h-9 -ml-2 z-0 pointer-events-none" />
              </div>
            </div>

            {/* Terms List Card with Right Checklist Mascot */}
            <div className="-mt-[11px] bg-[#FFFDF9] border border-[#EAE0D2] rounded-[28px] p-5 sm:p-8 lg:px-10 lg:py-8 shadow-[0_6px_24px_rgba(92,58,33,0.05)] relative overflow-visible">
              <div className="space-y-3.5 sm:space-y-4 text-sm sm:text-[15px] text-[#3A2D26] leading-relaxed text-left md:pr-52 lg:pr-60">
                {(() => {
                  const thaiDigitsToArabic = (str: string) =>
                    str.replace(/[๐-๙]/g, (d) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d)));

                  const rawLines = (settings.exchangeTerms || '')
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter((line) => line !== '');

                  const hasExplicitNumberedLine = rawLines.some((line) =>
                    /^([0-9๐-๙]+)\s*(?:[.):]|-\s+)\s*/.test(line)
                  );

                  let itemCounter = 0;
                  return rawLines.map((trimmedLine, idx) => {
                    const numMatch = trimmedLine.match(/^([0-9๐-๙]+)\s*(?:[.):]|-\s+)\s*(.*)$/);
                    const bulletMatch = trimmedLine.match(/^[-•*–—]\s+(.*)$/);

                    if (numMatch) {
                      const parsedNum = parseInt(thaiDigitsToArabic(numMatch[1]), 10);
                      itemCounter = Number.isFinite(parsedNum) ? parsedNum : itemCounter + 1;
                      const content = numMatch[2].trim();
                      return (
                        <div key={idx} className="flex items-start gap-3.5">
                          <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FCEBBF] border border-[#F2D99B] text-[#5C3A21] font-bold text-xs sm:text-sm flex items-center justify-center shrink-0 tabular-nums shadow-2xs mt-0.5">
                            {numMatch[1]}
                          </span>
                          <p className="flex-1 pt-0.5 sm:pt-1 font-medium text-[#3A2D26] leading-relaxed">
                            {content || trimmedLine}
                          </p>
                        </div>
                      );
                    }

                    if (bulletMatch && hasExplicitNumberedLine) {
                      return (
                        <div key={idx} className="flex items-start gap-3 pl-9 sm:pl-11">
                          <span className="w-2 h-2 rounded-full bg-[#7D502E] shrink-0 mt-2.5" />
                          <p className="flex-1 font-medium text-[#3A2D26] leading-relaxed">
                            {bulletMatch[1].trim()}
                          </p>
                        </div>
                      );
                    }

                    itemCounter += 1;
                    const textContent = bulletMatch ? bulletMatch[1].trim() : trimmedLine;
                    return (
                      <div key={idx} className="flex items-start gap-3.5">
                        <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FCEBBF] border border-[#F2D99B] text-[#5C3A21] font-bold text-xs sm:text-sm flex items-center justify-center shrink-0 tabular-nums shadow-2xs mt-0.5">
                          {itemCounter}
                        </span>
                        <p className="flex-1 pt-0.5 sm:pt-1 font-medium text-[#3A2D26] leading-relaxed">
                          {textContent}
                        </p>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Cute Eco Book Mascot + Checklist Clipboard */}
              <TermsChecklistMascotIllustration className="w-40 sm:w-48 md:w-52 lg:w-56 mx-auto mt-5 md:mt-0 md:absolute md:right-4 lg:right-8 md:top-1/2 md:-translate-y-1/2 pointer-events-none drop-shadow-xs" />
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3.5 pt-1">
              {renderBackButton()}
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full sm:flex-1 py-3.5 px-8 rounded-full bg-gradient-to-b from-[#8D5B34] to-[#6F4424] hover:from-[#7B4E2B] hover:to-[#5D381C] active:scale-[0.99] text-white font-bold text-base sm:text-lg shadow-[0_8px_24px_rgba(111,68,36,0.26)] transition-all cursor-pointer flex items-center justify-center gap-3 relative overflow-hidden"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-[4px] rounded-full border border-dashed border-[#E6C59C]/40"
                />
                <span className="relative z-10">ยืนยันรับทราบการเข้าร่วมกิจกรรม</span>
                <span className="relative z-10 flex items-center gap-1.5">
                  <span className="w-6 h-6 rounded-full bg-white text-[#6F4424] flex items-center justify-center shrink-0 shadow-xs">
                    <ChevronRight className="w-4 h-4 stroke-[2.75]" />
                  </span>
                  <svg
                    viewBox="0 0 18 22"
                    fill="none"
                    className="w-4 h-5 hidden sm:block"
                    aria-hidden="true"
                  >
                    <path d="M2 5L9 1" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M4 11L14 10" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M2 17L9 21" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: ข้อมูลการเข้าร่วมกิจกรรม */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Decorative Title Ribbon with Tilted Checklist Clipboard & Leaf Sprigs */}
            <div className="-mt-[17px] flex items-center justify-center pt-1 pb-1">
              <div className="relative inline-flex items-center justify-center">
                <EcoLeafSprig className="hidden sm:block w-11 h-9 -mr-3 z-0 pointer-events-none" />
                <ParticipantClipboardBadgeIllustration className="w-16 h-16 sm:w-19 sm:h-18 -mr-5 sm:-mr-7 -mt-1 z-20 shrink-0 pointer-events-none drop-shadow-xs" />

                <div className="bg-gradient-to-r from-[#E6F1D0] via-[#F2E9CC] to-[#E6F1D0] border border-[#CFE2AD] rounded-full pl-8 sm:pl-11 pr-8 sm:pr-12 py-2.5 sm:py-3 shadow-[0_4px_14px_rgba(106,136,82,0.12)] relative z-10">
                  <h2 className="text-lg sm:text-2xl md:text-[26px] font-bold text-[#5C3A21] tracking-tight whitespace-nowrap">
                    ข้อมูลการเข้าร่วมกิจกรรม
                  </h2>
                </div>

                <EcoLeafSprig flip className="hidden sm:block w-11 h-9 -ml-2 z-0 pointer-events-none" />
              </div>
            </div>

            <div className="-mt-[8px] space-y-3 text-left">
              {/* Top Section with Groups 1 & 2 on Left and Cute Pencil Book Mascot on Right */}
              <div className="relative -mt-[15px] pt-0">
                <div className="space-y-2.5 md:pr-44 lg:pr-48">
                  {/* Group 1: การร่วมกิจกรรม */}
                  <div>
                    <label className="flex items-center gap-2 text-sm sm:text-base font-bold text-[#3E2723] mb-1.5">
                      <ParticipantOptionIcon kind="users-badge" className="w-6 h-5 shrink-0" />
                      <span>
                        การร่วมกิจกรรม <span className="text-[#D32F2F]">*</span>
                      </span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(settings.participationHistoryOptions && settings.participationHistoryOptions.length > 0
                        ? settings.participationHistoryOptions
                        : ['เคยเข้าร่วมกิจกรรมในปีที่ผ่านมา', 'ปีนี้เป็นครั้งแรก']
                      ).map((opt, idx) => {
                        const isSelected = participant.participationHistory === opt;
                        const iconKind =
                          opt.includes('ครั้งแรก') || opt.includes('ยังไม่เคย')
                            ? 'book-sprout'
                            : idx === 1 && !opt.includes('เคยเข้าร่วม')
                              ? 'book-sprout'
                              : 'book-trio';
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
                            className={`flex items-center justify-between px-4 py-2.5 rounded-full border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#4B5E26] border-[#4B5E26] text-white font-semibold shadow-sm'
                                : participantErrors.participationHistory
                                  ? 'bg-[#FFFDF9] border-red-300 text-[#4E342E] hover:bg-[#F8F2E7] shadow-[0_3px_10px_rgba(92,58,33,0.04)]'
                                  : 'bg-[#FFFDF9] border-[#E5D8C8] text-[#3A2D26] hover:bg-[#F8F2E7] hover:border-[#7D502E] shadow-[0_3px_10px_rgba(92,58,33,0.04)]'
                            }`}
                          >
                            <span className="flex items-center gap-2.5 min-w-0">
                              <ParticipantOptionIcon kind={iconKind} className="w-5 h-5 shrink-0" />
                              <span className="text-sm sm:text-[15px] font-medium truncate">{opt}</span>
                            </span>
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ml-2 transition-colors ${
                                isSelected
                                  ? 'border-white bg-white text-[#4B5E26]'
                                  : 'border-[#C8B8A6] bg-white'
                              }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {participantErrors.participationHistory && (
                      <p className="text-xs text-[#D32F2F] mt-1 pl-2">
                        {participantErrors.participationHistory}
                      </p>
                    )}
                  </div>

                  {/* Group 2: ความถี่ในปีนี้ */}
                  <div>
                    <label className="flex items-center gap-2 text-sm sm:text-base font-bold text-[#3E2723] mb-1.5">
                      <ParticipantOptionIcon kind="calendar-rays" className="w-6 h-6 shrink-0" />
                      <span>
                        ในปีนี้ ท่านมาร่วมกิจกรรมแล้วกี่ครั้ง <span className="text-[#D32F2F]">*</span>
                      </span>
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {(settings.visitFrequencyOptions && settings.visitFrequencyOptions.length > 0
                        ? settings.visitFrequencyOptions
                        : ['ครั้งที่ 1', 'ครั้งที่ 2', 'ครั้งที่ 3', 'ครั้งที่ 4', 'ครั้งที่ 5', 'มากกว่า 5 ครั้ง']
                      ).map((opt) => {
                        const isSelected = participant.visitFrequencyThisYear === opt;
                        return (
                          <button
                            type="button"
                            key={opt}
                            onClick={() => {
                              setParticipant((p) => ({ ...p, visitFrequencyThisYear: opt }));
                              if (participantErrors.visitFrequencyThisYear) {
                                setParticipantErrors((p) => ({ ...p, visitFrequencyThisYear: undefined }));
                              }
                            }}
                            className={`flex items-center justify-between px-3.5 py-2 rounded-full border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#4B5E26] border-[#4B5E26] text-white font-semibold shadow-sm'
                                : participantErrors.visitFrequencyThisYear
                                  ? 'bg-[#FFFDF9] border-red-300 text-[#4E342E] hover:bg-[#F8F2E7] shadow-[0_3px_10px_rgba(92,58,33,0.04)]'
                                  : 'bg-[#FFFDF9] border-[#E5D8C8] text-[#3A2D26] hover:bg-[#F8F2E7] hover:border-[#7D502E] shadow-[0_3px_10px_rgba(92,58,33,0.04)]'
                            }`}
                          >
                            <span className="text-xs sm:text-sm font-medium whitespace-nowrap">{opt}</span>
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ml-2 transition-colors ${
                                isSelected
                                  ? 'border-white bg-white text-[#4B5E26]'
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
                      <p className="text-xs text-[#D32F2F] mt-1 pl-2">
                        {participantErrors.visitFrequencyThisYear}
                      </p>
                    )}
                  </div>
                </div>

                {/* Cute Green Book Mascot holding Pencil & Checklist on Right */}
                <ParticipantBookMascotIllustration className="hidden md:block md:w-36 lg:w-40 md:absolute md:right-0 lg:right-2 md:top-1/2 md:-translate-y-1/2 pointer-events-none drop-shadow-xs" />
              </div>

              {/* Group 3: กลุ่มสมาชิก */}
              <div>
                <label className="flex items-center gap-2 text-sm sm:text-base font-bold text-[#3E2723] mb-1.5">
                  <ParticipantOptionIcon kind="users-badge" className="w-6 h-5 shrink-0" />
                  <span>
                    กลุ่มสมาชิก <span className="text-[#D32F2F]">*</span>
                  </span>
                </label>
                <div className="flex flex-wrap items-center gap-2.5">
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
                    const memberIconKind = type.includes('นักศึกษา')
                      ? 'student-cap'
                      : type.toLowerCase().includes('staff') || type.includes('บุคลากร')
                        ? 'staff-briefcase'
                        : type.includes('ศิษย์เก่า')
                          ? 'alumni-building'
                          : 'public-people';
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
                        className={`flex-auto flex items-center justify-between px-3.5 py-2.5 rounded-full border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#4B5E26] border-[#4B5E26] text-white font-semibold shadow-sm'
                            : participantErrors.memberType
                              ? 'bg-[#FFFDF9] border-red-300 text-[#4E342E] hover:bg-[#F8F2E7] shadow-[0_3px_10px_rgba(92,58,33,0.04)]'
                              : 'bg-[#FFFDF9] border-[#E5D8C8] text-[#3A2D26] hover:bg-[#F8F2E7] hover:border-[#7D502E] shadow-[0_3px_10px_rgba(92,58,33,0.04)]'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <ParticipantOptionIcon kind={memberIconKind} className="w-5 h-5 shrink-0" />
                          <span className="text-xs sm:text-sm font-medium whitespace-nowrap">{type}</span>
                        </span>
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ml-2 transition-colors ${
                            isSelected
                              ? 'border-white bg-white text-[#4B5E26]'
                              : 'border-[#C8B8A6] bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {participantErrors.memberType && (
                  <p className="text-xs text-[#D32F2F] mt-1.5 pl-2">{participantErrors.memberType}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3.5 pt-1">
              {renderBackButton()}
              <button
                type="button"
                onClick={() => {
                  if (validateParticipant()) {
                    setStep(3);
                  }
                }}
                className="w-full sm:flex-1 py-3.5 px-8 rounded-full bg-gradient-to-b from-[#8D5B34] to-[#6F4424] hover:from-[#7B4E2B] hover:to-[#5D381C] active:scale-[0.99] text-white font-bold text-base sm:text-lg shadow-[0_8px_24px_rgba(111,68,36,0.26)] transition-all cursor-pointer flex items-center justify-center gap-3 relative overflow-hidden"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-[4px] rounded-full border border-dashed border-[#E6C59C]/40"
                />
                <span className="relative z-10">ถัดไป</span>
                <span className="relative z-10 flex items-center gap-1.5">
                  <span className="w-6 h-6 rounded-full bg-white text-[#6F4424] flex items-center justify-center shrink-0 shadow-xs">
                    <ChevronRight className="w-4 h-4 stroke-[2.75]" />
                  </span>
                  <svg
                    viewBox="0 0 18 22"
                    fill="none"
                    className="w-4 h-5 hidden sm:block"
                    aria-hidden="true"
                  >
                    <path d="M2 5L9 1" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M4 11L14 10" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M2 17L9 21" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: หนังสือที่นำมาแลก */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Decorative Title Ribbon with Left Book Stack & Right Open Book */}
            <div className="-mt-[17px] flex items-center justify-center pt-1 pb-1">
              <div className="relative inline-flex items-center justify-center">
                <Step3LeftBookStackIllustration className="w-24 h-16 sm:w-30 sm:h-19 -mr-8 sm:-mr-10 -mt-1 z-20 shrink-0 pointer-events-none drop-shadow-xs" />

                <div className="bg-gradient-to-r from-[#E6F1D0] via-[#DCECC0] to-[#E6F1D0] border border-[#CFE2AD] rounded-full px-10 sm:px-14 py-2.5 sm:py-3 shadow-[0_4px_14px_rgba(106,136,82,0.12)] relative z-10">
                  <h2 className="text-lg sm:text-2xl md:text-[26px] font-bold text-[#5C3A21] tracking-tight whitespace-nowrap">
                    หนังสือที่นำมาแลก
                  </h2>
                </div>

                <Step3RightOpenBookIllustration className="w-24 h-16 sm:w-30 sm:h-19 -ml-8 sm:-ml-10 -mt-1 z-20 shrink-0 pointer-events-none drop-shadow-xs" />
              </div>
            </div>

            {/* Stepper Counter: [-]  2  [+] with Golden Sparkle Rays */}
            <div className="-mt-[10px] flex items-center justify-center py-0.5">
              <div className="relative inline-flex items-center gap-2.5">
                {/* Left Golden Rays */}
                <svg viewBox="0 0 18 22" fill="none" className="w-4 h-5 pointer-events-none" aria-hidden="true">
                  <path d="M16 5L8 2" stroke="#F59E0B" strokeWidth="2.4" strokeLinecap="round" />
                  <path d="M15 11L4 11" stroke="#F59E0B" strokeWidth="2.4" strokeLinecap="round" />
                  <path d="M16 17L8 20" stroke="#F59E0B" strokeWidth="2.4" strokeLinecap="round" />
                </svg>

                <div className="relative flex items-center gap-2.5">
                  <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-[2px] bg-[#E2D0B8] z-0" />

                  <button
                    type="button"
                    onClick={() => handleUpdateBookCount(bookCount - 1)}
                    disabled={bookCount <= 1}
                    className="relative z-10 w-10 h-10 rounded-full bg-gradient-to-b from-[#8D5B34] to-[#6E4425] hover:from-[#7B4E2B] hover:to-[#5D381C] disabled:opacity-40 text-white flex items-center justify-center font-bold shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    <Minus className="w-4 h-4 stroke-[2.75]" />
                  </button>

                  <div className="relative z-10 min-w-[74px] h-10 px-5 rounded-full bg-[#FAF1DF] border border-[#E5D4B8] shadow-inner flex items-center justify-center">
                    <span className="text-2xl font-bold text-[#3E2723] tabular-nums leading-none">
                      {bookCount}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUpdateBookCount(bookCount + 1)}
                    disabled={bookCount >= 10}
                    className="relative z-10 w-10 h-10 rounded-full bg-gradient-to-b from-[#8D5B34] to-[#6E4425] hover:from-[#7B4E2B] hover:to-[#5D381C] disabled:opacity-40 text-white flex items-center justify-center font-bold shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[2.75]" />
                  </button>
                </div>

                {/* Right Golden Rays */}
                <svg viewBox="0 0 18 22" fill="none" className="w-4 h-5 pointer-events-none" aria-hidden="true">
                  <path d="M2 5L10 2" stroke="#F59E0B" strokeWidth="2.4" strokeLinecap="round" />
                  <path d="M3 11L14 11" stroke="#F59E0B" strokeWidth="2.4" strokeLinecap="round" />
                  <path d="M2 17L10 20" stroke="#F59E0B" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* Book Cards Grid */}
            <div className="-mt-[6px] grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 text-left">
              {bookEntries.map((entry, idx) => (
                <div
                  key={entry.tempId || idx}
                  className="bg-[#FFFDF9] border border-[#EAE0D2] rounded-[26px] p-4 sm:p-5 space-y-3 shadow-[0_6px_22px_rgba(92,58,33,0.05)] relative"
                >
                  {/* Sage-Green Pill Header with Mini Book & Code Badge */}
                  <div className="bg-gradient-to-r from-[#EBF4D6] to-[#E2EECC] border border-[#D4E4B8] rounded-full px-3.5 py-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Step3CardMiniBookIllustration
                        variant={idx % 2 === 0 ? 'green' : 'amber'}
                        className="w-8 h-8 -my-1 shrink-0 drop-shadow-2xs"
                      />
                      <span className="text-base sm:text-lg font-bold text-[#3E2723]">
                        เล่มที่ {idx + 1}
                      </span>
                    </div>
                    <span className="bg-gradient-to-b from-[#6C9640] to-[#567C2F] text-white text-xs font-bold px-3.5 py-1 rounded-full font-mono shadow-2xs">
                      รหัส: {entry.code}
                    </span>
                  </div>

                  {/* Title */}
                  <div>
                    <div className="relative">
                      <BookOpen className="w-4 h-4 text-[#7D502E]/75 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={entry.title}
                        onChange={(e) => handleBookEntryChange(idx, 'title', e.target.value)}
                        placeholder="ชื่อเรื่อง *"
                        className={`w-full bg-white border ${
                          bookValidationErrors[idx]?.includes('ชื่อเรื่อง') ? 'border-red-500' : 'border-[#E2D4C0]'
                        } rounded-full pl-10 pr-4 py-2.5 text-sm text-[#3A2D26] placeholder-[#8E8175] focus:outline-none focus:ring-2 focus:ring-[#7D502E] transition-all shadow-2xs`}
                      />
                    </div>
                    {bookValidationErrors[idx]?.includes('ชื่อเรื่อง') && (
                      <p className="text-xs text-[#D32F2F] mt-1 pl-3">{bookValidationErrors[idx]}</p>
                    )}
                  </div>

                  {/* Price */}
                  <div>
                    <div className="relative">
                      <Tag className="w-4 h-4 text-[#7D502E]/75 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                        placeholder="ราคา * (หากไม่มีโปรดประมาณมูลค่า)"
                        className={`w-full bg-white border ${
                          bookValidationErrors[idx]?.includes('ราคา') ? 'border-red-500 bg-red-50/20' : 'border-[#E2D4C0]'
                        } rounded-full pl-10 pr-4 py-2.5 text-sm text-[#3A2D26] placeholder-[#8E8175] focus:outline-none focus:ring-2 focus:ring-[#7D502E] transition-all shadow-2xs`}
                      />
                    </div>
                    {bookValidationErrors[idx]?.includes('ราคา') && (
                      <p className="text-xs text-[#D32F2F] mt-1 pl-3">{bookValidationErrors[idx]}</p>
                    )}
                  </div>

                  {/* Category Pill Buttons */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#3E2723] mb-2 pl-1">
                      <Layers className="w-4 h-4 text-[#7D502E] shrink-0" />
                      <span>
                        ประเภทหนังสือ <span className="text-[#D32F2F]">*</span>
                      </span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {categoryOptions.map((cat) => {
                        const isSelected = entry.category === cat;
                        const hasCategoryError = bookValidationErrors[idx]?.includes('ประเภทหนังสือ');
                        return (
                          <button
                            type="button"
                            key={cat}
                            onClick={() => handleBookEntryChange(idx, 'category', cat)}
                            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs sm:text-[13px] transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#4B5E26] border-[#4B5E26] text-white font-semibold shadow-xs'
                                : hasCategoryError
                                  ? 'bg-white border-red-300 text-[#4E342E] hover:bg-[#F8F2E7] shadow-2xs'
                                  : 'bg-white border-[#E2D4C0] text-[#3A2D26] hover:bg-[#F8F2E7] hover:border-[#7D502E] font-medium shadow-2xs'
                            }`}
                          >
                            <span className="whitespace-nowrap">{cat}</span>
                            <span
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                isSelected
                                  ? 'border-white bg-white text-[#4B5E26]'
                                  : 'border-[#C8B8A6] bg-white'
                              }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {bookValidationErrors[idx]?.includes('ประเภทหนังสือ') && (
                      <p className="text-xs text-[#D32F2F] mt-1.5 pl-3">{bookValidationErrors[idx]}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3.5 pt-1">
              {renderBackButton()}
              <button
                type="button"
                onClick={() => {
                  if (validateBooksBrought()) {
                    setStep(4);
                  }
                }}
                className="w-full sm:flex-1 py-3.5 px-8 rounded-full bg-gradient-to-b from-[#8D5B34] to-[#6F4424] hover:from-[#7B4E2B] hover:to-[#5D381C] active:scale-[0.99] text-white font-bold text-base sm:text-lg shadow-[0_8px_24px_rgba(111,68,36,0.26)] transition-all cursor-pointer flex items-center justify-center gap-3 relative overflow-hidden"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-[4px] rounded-full border border-dashed border-[#E6C59C]/40"
                />
                <span className="relative z-10">ถัดไป</span>
                <span className="relative z-10 flex items-center gap-1.5">
                  <span className="w-6 h-6 rounded-full bg-white text-[#6F4424] flex items-center justify-center shrink-0 shadow-xs">
                    <ChevronRight className="w-4 h-4 stroke-[2.75]" />
                  </span>
                  <svg
                    viewBox="0 0 18 22"
                    fill="none"
                    className="w-4 h-5 hidden sm:block"
                    aria-hidden="true"
                  >
                    <path d="M2 5L9 1" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M4 11L14 10" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M2 17L9 21" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: ขั้นตอนการติด Sticker */}
        {step === 4 && (
          <div className="space-y-5 text-center">
            {/* Decorative Title Ribbon with Tilted Yellow Tape Sticker */}
            <div className="-mt-[17px] flex items-center justify-center pt-1 pb-1">
              <div className="relative inline-flex items-center justify-center">
                {/* Tilted Yellow Sticker Tape Strip */}
                <svg
                  viewBox="0 0 56 44"
                  fill="none"
                  className="w-11 h-9 sm:w-13 sm:h-10 absolute -top-2.5 -left-3 sm:-left-4 z-20 pointer-events-none drop-shadow-2xs"
                  aria-hidden="true"
                >
                  <g transform="rotate(-38 28 22)">
                    <rect x="6" y="13" width="44" height="16" rx="3" fill="#F8D568" stroke="#E5B93D" strokeWidth="1.2" />
                    <line x1="14" y1="16" x2="42" y2="16" stroke="#FCE79C" strokeWidth="2" strokeLinecap="round" />
                  </g>
                </svg>

                <div className="bg-gradient-to-r from-[#E6F1D0] via-[#F2E9CC] to-[#E6F1D0] border border-[#CFE2AD] rounded-full px-8 sm:px-14 py-2.5 sm:py-3 shadow-[0_4px_14px_rgba(106,136,82,0.12)] relative z-10">
                  <h2 className="text-base sm:text-xl md:text-2xl font-bold text-[#5C3A21] tracking-tight leading-snug">
                    ขั้นตอนการติด Sticker บนหนังสือที่นำมา เพื่อเตรียมขึ้นชั้นแลก
                  </h2>
                </div>
              </div>
            </div>

            {/* Centerpiece BOOK SWAP Book + Mini Book Stack + Sticker Roll Scene */}
            <div className="-mt-[6px] flex justify-center">
              <Step4StickerBookSceneIllustration
                stickerCode={bookEntries[0]?.code || 'U1'}
                className="w-72 sm:w-96 md:w-[420px] h-auto drop-shadow-xs pointer-events-none"
              />
            </div>

            {/* Instruction Callout Box with Green Accent Rays & Highlighted "มุมขวาบน" */}
            <div className="-mt-[8px] flex items-center justify-center">
              <div className="relative inline-flex items-center justify-center gap-2 sm:gap-3">
                {/* Left Green Rays */}
                <svg viewBox="0 0 22 28" fill="none" className="w-5 h-7 hidden sm:block pointer-events-none" aria-hidden="true">
                  <path d="M19 6L9 2" stroke="#96BE58" strokeWidth="2.8" strokeLinecap="round" />
                  <path d="M18 14L4 14" stroke="#96BE58" strokeWidth="2.8" strokeLinecap="round" />
                  <path d="M19 22L9 26" stroke="#96BE58" strokeWidth="2.8" strokeLinecap="round" />
                </svg>

                <div className="bg-[#FBEAD2] border border-[#EED4AE] rounded-[22px] px-6 sm:px-10 py-3.5 shadow-[0_4px_14px_rgba(140,98,57,0.08)]">
                  <p className="text-sm sm:text-base md:text-lg font-bold text-[#4E342E] leading-relaxed">
                    กรุณานำ Sticker หมายเลข ไปติดบนหนังสือจริง
                    <br />
                    ตำแหน่ง{' '}
                    <span className="inline-block bg-[#9BC54D] text-[#3B2616] px-3.5 py-0.5 rounded-full font-extrabold mx-0.5 shadow-2xs">
                      มุมขวาบน
                    </span>{' '}
                    ของหนังสือ
                  </p>
                </div>

                {/* Right Green Rays */}
                <svg viewBox="0 0 22 28" fill="none" className="w-5 h-7 hidden sm:block pointer-events-none" aria-hidden="true">
                  <path d="M3 6L13 2" stroke="#96BE58" strokeWidth="2.8" strokeLinecap="round" />
                  <path d="M4 14L18 14" stroke="#96BE58" strokeWidth="2.8" strokeLinecap="round" />
                  <path d="M3 22L13 26" stroke="#96BE58" strokeWidth="2.8" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* Book Sticker Rows */}
            <div className="max-w-xl mx-auto space-y-2.5 text-left relative pt-1">
              {bookEntries.map((b, i) => (
                <div key={b.tempId} className="relative">
                  {/* Decorative open book peeking on bottom-left of first row */}
                  {i === 0 && (
                    <Step4MiniOpenBookIllustration className="hidden sm:block w-16 h-13 absolute -left-14 -bottom-2 z-20 pointer-events-none drop-shadow-2xs" />
                  )}
                  {/* Golden Sparkle Rays peeking on top-right of first row */}
                  {i === 0 && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="hidden sm:block w-6 h-6 absolute -top-3 -right-3 z-20 pointer-events-none"
                      aria-hidden="true"
                    >
                      <path d="M5 10L11 3" stroke="#F59E0B" strokeWidth="2.6" strokeLinecap="round" />
                      <path d="M9 14L18 10" stroke="#F59E0B" strokeWidth="2.6" strokeLinecap="round" />
                      <path d="M11 19L19 19" stroke="#F59E0B" strokeWidth="2.6" strokeLinecap="round" />
                    </svg>
                  )}

                  <div className="bg-[#FFFDF9] border border-[#EAE0D2] rounded-full px-4 sm:px-5 py-2.5 flex items-center justify-between text-xs sm:text-sm shadow-[0_4px_14px_rgba(92,58,33,0.05)] gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="w-7 h-7 rounded-full bg-[#7D502E] text-white flex items-center justify-center font-bold text-xs shrink-0 tabular-nums shadow-2xs">
                        {i + 1}
                      </span>
                      <span className="font-bold text-[#3A2D26] truncate text-sm sm:text-base">
                        {b.title || `เล่มที่ ${i + 1}`}
                      </span>
                    </div>

                    <div className="hidden sm:block w-px h-5 bg-[#EAE0D2] shrink-0" />

                    <span className="bg-[#F2DFBF] border border-[#E2C69B] text-[#4E342E] font-mono font-bold px-4 py-1 rounded-full shrink-0 text-xs sm:text-sm shadow-2xs">
                      ติด Sticker : {b.code}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
              {renderBackButton()}
              <button
                type="button"
                onClick={() => setStep(5)}
                className="w-full sm:flex-1 py-3.5 px-8 rounded-full bg-gradient-to-b from-[#8D5B34] to-[#6F4424] hover:from-[#7B4E2B] hover:to-[#5D381C] active:scale-[0.99] text-white font-bold text-base sm:text-lg shadow-[0_8px_24px_rgba(111,68,36,0.26)] transition-all cursor-pointer flex items-center justify-center gap-3 relative overflow-hidden"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-[4px] rounded-full border border-dashed border-[#E6C59C]/40"
                />
                <span className="relative z-10">ยืนยันการติดสติกเกอร์</span>
                <span className="relative z-10 flex items-center gap-1.5">
                  <span className="w-6 h-6 rounded-full bg-white text-[#6F4424] flex items-center justify-center shrink-0 shadow-xs">
                    <ChevronRight className="w-4 h-4 stroke-[2.75]" />
                  </span>
                  <svg
                    viewBox="0 0 18 22"
                    fill="none"
                    className="w-4 h-5 hidden sm:block"
                    aria-hidden="true"
                  >
                    <path d="M2 5L9 1" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M4 11L14 10" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M2 17L9 21" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: จับคู่การแลกเปลี่ยน */}
        {step === 5 && (
          <div className="space-y-6">
            {/* Header Composition: Left Book Stack | Center Title Pill + Browse CTA | Right Search Book Mascot */}
            <div className="-mt-[17px] flex items-center justify-center md:justify-between gap-4 pt-1">
              <Step3LeftBookStackIllustration className="hidden md:block w-36 lg:w-42 h-auto shrink-0 pointer-events-none drop-shadow-xs" />

              <div className="text-center space-y-2.5 flex-1 flex flex-col items-center">
                <div className="inline-flex items-center gap-3 bg-gradient-to-r from-[#E6F1D0] via-[#DCECC0] to-[#E6F1D0] border border-[#CFE2AD] rounded-full pl-2.5 pr-7 sm:pr-9 py-1.5 shadow-[0_4px_14px_rgba(106,136,82,0.12)]">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#B9D87C] border border-[#96BC54] flex items-center justify-center shrink-0 shadow-2xs">
                    <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-[#3B4C1D] stroke-[2.25]" />
                  </div>
                  <h2 className="text-lg sm:text-2xl md:text-[26px] font-bold text-[#5C3A21] tracking-tight whitespace-nowrap">
                    จับคู่การแลกเปลี่ยน
                  </h2>
                </div>

                <p className="text-sm sm:text-base text-[#4E342E] font-medium">
                  ท่านนำหนังสือมาแลก {bookEntries.length} เล่ม
                </p>

                <button
                  type="button"
                  onClick={() => setIsBrowsingShelfForIdx(0)}
                  className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#3E2723] bg-[#EDF4DF] hover:bg-[#E1EDCA] px-5 py-2 rounded-full font-semibold transition-colors cursor-pointer border border-[#BDD199] shadow-2xs"
                >
                  <Search className="w-4 h-4 text-[#4B5E26] shrink-0" />
                  <span>คลิกดูหนังสือพร้อมแลกเปลี่ยน ({availableBooks.length} เล่ม)</span>
                </button>
              </div>

              <Step5BookSearchMascotIllustration className="hidden md:block w-36 lg:w-44 h-auto shrink-0 pointer-events-none drop-shadow-xs" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 text-left">
              {bookEntries.map((entry, idx) => {
                const isCancelled = entry.isCancelled;
                const isDonation = entry.matchTargetCode === 'DONATION';
                const feedback = matchVerificationFeedback[idx];
                const error = matchErrors[idx];

                return (
                  <div
                    key={entry.tempId || idx}
                    className="bg-[#FFFDF9] border border-[#EAE0D2] rounded-[26px] p-4 sm:p-5 space-y-3.5 shadow-[0_6px_22px_rgba(92,58,33,0.05)]"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 border ${
                          idx % 2 === 0
                            ? 'bg-[#E6F1D0] border-[#CFE2AD]'
                            : 'bg-[#FDF3DA] border-[#F2DC9F]'
                        }`}
                      >
                        <Step3CardMiniBookIllustration
                          variant={idx % 2 === 0 ? 'green' : 'amber'}
                          className="w-7 h-7"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-[#3E2723] text-sm sm:text-[15px] leading-snug">
                          หนังสือที่นำมา รหัส{' '}
                          <span className="inline-block bg-[#F7E9CA] border border-[#E7CFA0] text-[#4E342E] font-mono font-extrabold px-2.5 py-0.5 rounded-full mx-0.5">
                            {entry.code}
                          </span>{' '}
                          จะ Match เล่มไหน
                        </h3>
                        <p className="text-xs text-[#7E7369] mt-0.5 truncate">
                          {entry.title ? `${entry.title} (เล่มที่ ${idx + 1})` : `ลำดับที่ (เล่มที่ ${idx + 1})`}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          disabled={isCancelled || isDonation}
                          value={
                            isDonation
                              ? 'DONATION (บริจาค)'
                              : isCancelled
                                ? 'NOT MATCH (ยกเลิก)'
                                : entry.matchTargetCode || ''
                          }
                          onChange={(e) => {
                            handleBookEntryChange(idx, 'isCancelled', false);
                            handleBookEntryChange(idx, 'matchTargetCode', e.target.value.toUpperCase());
                          }}
                          placeholder="กรอกรหัส (เช่น L1, U1)"
                          className="flex-1 min-w-0 bg-white border border-[#E2D4C0] disabled:bg-[#F3ECE1] rounded-full px-4 py-2.5 text-sm text-[#3A2D26] placeholder-[#8E8175] focus:outline-none focus:ring-2 focus:ring-[#7D502E] uppercase shadow-2xs"
                        />
                        <button
                          type="button"
                          disabled={isCancelled || isDonation}
                          onClick={() => handleCheckCode(idx)}
                          className="bg-gradient-to-b from-[#6C9640] to-[#567C2F] hover:from-[#5D8435] hover:to-[#4A6B27] active:scale-95 disabled:opacity-40 text-white rounded-full px-5 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 shadow-xs whitespace-nowrap"
                        >
                          Match Check
                        </button>
                      </div>

                      {feedback && (
                        <div
                          className={`rounded-2xl px-3.5 py-2 text-xs flex items-start gap-2 ${
                            feedback.success
                              ? 'bg-[#E9EBC8]/70 text-[#3B4C1D] border border-[#C6D29E]'
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
                        <div className="rounded-2xl px-3.5 py-2 text-xs bg-[#FFF0F0] text-[#D32F2F] border border-[#FFCDCD] flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{error}</span>
                        </div>
                      )}

                      {/* Search Available Books */}
                      <button
                        type="button"
                        disabled={isCancelled || isDonation}
                        onClick={() => {
                          setShelfSearchQuery('');
                          setIsBrowsingShelfForIdx(idx);
                        }}
                        className="w-full py-2.5 px-4 bg-[#4B5E26] hover:bg-[#3B4B1D] active:scale-[0.99] disabled:opacity-40 text-white rounded-full text-xs sm:text-[13px] font-semibold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
                      >
                        <Search className="w-3.5 h-3.5 shrink-0" />
                        <span>ค้นหาหนังสือพร้อมแลกเปลี่ยน (Available)</span>
                      </button>

                      {/* Donation & Cancel Match (Side-by-side row) */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleSetDonation(idx)}
                          className={`w-full py-2.5 px-3 rounded-full text-xs sm:text-[13px] font-semibold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-center whitespace-nowrap ${
                            isDonation
                              ? 'bg-[#E6B875] border-[#9E6F38] text-[#4E2E0C] ring-2 ring-[#9E6F38]/30'
                              : 'bg-[#F7F0E3] hover:bg-[#EFE2CA] text-[#4E342E] border-[#E2D4C0]'
                          }`}
                        >
                          <Package className="w-4 h-4 shrink-0 text-[#7D502E]" />
                          <span>{isDonation ? '✓ ต้องการบริจาค' : 'ต้องการบริจาค'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSetNotMatch(idx)}
                          className={`w-full py-2.5 px-3 rounded-full text-xs sm:text-[13px] font-semibold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-center whitespace-nowrap ${
                            isCancelled
                              ? 'bg-[#FADBD2] border-[#C97B6A] text-[#8B3A2B] ring-2 ring-[#C97B6A]/30'
                              : 'bg-[#FFF3F1] hover:bg-[#FADBD2]/60 text-[#9B4333] border-[#F2CBC2]'
                          }`}
                        >
                          <RotateCcw className="w-3.5 h-3.5 shrink-0 text-[#C62828]" />
                          <span>{isCancelled ? '✓ ยกเลิกการแลก' : 'ยกเลิกการแลก'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3.5 pt-1">
              {renderBackButton()}
              <button
                type="button"
                onClick={handleConfirmExchange}
                className="w-full sm:flex-1 py-3.5 px-8 rounded-full bg-gradient-to-b from-[#8D5B34] to-[#6F4424] hover:from-[#7B4E2B] hover:to-[#5D381C] active:scale-[0.99] text-white font-bold text-base sm:text-lg shadow-[0_8px_24px_rgba(111,68,36,0.26)] transition-all cursor-pointer flex items-center justify-center gap-3 relative overflow-hidden"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-[4px] rounded-full border border-dashed border-[#E6C59C]/40"
                />
                <span className="relative z-10">สรุปการทำรายการ</span>
                <span className="relative z-10 flex items-center gap-1.5">
                  <span className="w-6 h-6 rounded-full bg-white text-[#6F4424] flex items-center justify-center shrink-0 shadow-xs">
                    <ChevronRight className="w-4 h-4 stroke-[2.75]" />
                  </span>
                  <svg
                    viewBox="0 0 18 22"
                    fill="none"
                    className="w-4 h-5 hidden sm:block"
                    aria-hidden="true"
                  >
                    <path d="M2 5L9 1" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M4 11L14 10" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M2 17L9 21" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: สิ้นสุด / สรุปรายการ */}
        {step === 6 && completedTransaction && (
          <div className="space-y-4 sm:space-y-5 text-center relative">
            {/* Top Celebration Check Badge + Golden Sparkle Rays */}
            <div className="flex flex-col items-center">
              <div className="relative flex items-center justify-center z-20 -mb-2.5">
                <svg
                  viewBox="0 0 26 28"
                  fill="none"
                  className="w-6 h-6 mr-2 text-[#F59E0B]"
                  aria-hidden="true"
                >
                  <path d="M22 6L10 2" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
                  <path d="M20 14L5 14" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
                  <path d="M22 22L10 26" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
                </svg>

                <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-gradient-to-b from-[#B2DD5B] via-[#93C644] to-[#74A732] text-white border-2 border-[#C8E88C] shadow-[0_6px_16px_rgba(116,167,50,0.28)] flex items-center justify-center">
                  <Check className="w-7 h-7 sm:w-8 sm:h-8 stroke-[3]" />
                </div>

                <svg
                  viewBox="0 0 26 28"
                  fill="none"
                  className="w-6 h-6 ml-2 text-[#F59E0B]"
                  aria-hidden="true"
                >
                  <path d="M4 6L16 2" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
                  <path d="M6 14L21 14" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
                  <path d="M4 22L16 26" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
                </svg>
              </div>

              {/* Sage-Green Ribbon Title */}
              <div className="relative inline-flex items-center justify-center mt-1">
                <EcoLeafSprig className="w-8 h-6 -mr-1 hidden sm:block rotate-[-14deg]" />
                <div className="bg-gradient-to-r from-[#E6F1D0] via-[#DCECC0] to-[#E6F1D0] border border-[#CFE2AD] rounded-full px-8 sm:px-14 py-2 sm:py-2.5 shadow-xs">
                  <h2 className="text-xl sm:text-3xl font-bold text-[#5C3A21] tracking-tight">
                    ทำรายการแลกเปลี่ยนสำเร็จ
                  </h2>
                </div>
                <EcoLeafSprig className="w-8 h-6 -ml-1 hidden sm:block scale-x-[-1] rotate-[14deg]" />
              </div>

              {/* Thank You Subtitle with Green Heart */}
              <p className="mt-2 text-[#5C3A21] text-sm sm:text-base font-medium inline-flex items-center justify-center gap-1.5 flex-wrap">
                <span>ขอขอบคุณที่ร่วมส่งต่อหนังสือและการอ่านในชุมชนห้องสมุด</span>
                <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-[#5D8C32] stroke-[2.2]" />
              </p>
            </div>

            {/* Receipt Slip + Flanking Corner Eco-Illustrations */}
            <div className="relative max-w-6xl mx-auto">
              {/* Subtle Floating Leaf Upper Left */}
              <svg
                viewBox="0 0 42 36"
                fill="none"
                className="hidden lg:block absolute -top-4 left-4 w-11 h-9 pointer-events-none"
                aria-hidden="true"
              >
                <path
                  d="M4 30C12 12 24 5 38 6C35 21 23 30 4 30Z"
                  fill="#7FB542"
                />
                <path
                  d="M7 28C17 20 26 14 35 8"
                  stroke="#558429"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>

              {/* Flanking Illustrations for compact 1-2 book receipts */}
              {bookEntries.length <= 2 && (
                <>
                  <Step6LeftBookPlantIllustration
                    className={`hidden ${
                      bookEntries.length === 2
                        ? 'lg:block w-36 xl:w-40 left-0'
                        : 'md:block w-40 lg:w-44 left-0 lg:left-4'
                    } absolute -bottom-2 z-20 pointer-events-none select-none`}
                  />
                  <Step6RightHeartMascotIllustration
                    className={`hidden ${
                      bookEntries.length === 2
                        ? 'lg:block w-36 xl:w-40 right-0'
                        : 'md:block w-40 lg:w-44 right-0 lg:right-4'
                    } absolute -bottom-2 z-20 pointer-events-none select-none`}
                  />
                </>
              )}

              {/* Dashed Receipt Card */}
              <div
                className={`bg-white border-2 border-dashed border-[#D7C5AA] rounded-[28px] text-left space-y-3.5 ${
                  bookEntries.length >= 3
                    ? 'w-full'
                    : bookEntries.length === 2
                      ? 'max-w-2xl'
                      : 'max-w-lg'
                } mx-auto shadow-[0_10px_28px_rgba(92,58,33,0.06)] p-4 sm:p-5 relative z-10`}
              >
                {/* Library Header */}
                <div className="border-b border-[#EFE6D8] pb-3 text-center space-y-1">
                  <div className="inline-flex items-center justify-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-[#F3EEFC] border border-[#E0D4F7] text-[#7C5CBF] flex items-center justify-center -rotate-6 shrink-0 shadow-2xs">
                      <BookOpen className="w-4.5 h-4.5 stroke-[2.2]" />
                    </span>
                    <span className="font-bold text-[#5C3A21] text-base sm:text-lg">
                      สำนักหอสมุด มหาวิทยาลัยเชียงใหม่
                    </span>
                  </div>
                  <div className="text-xs font-mono text-[#7E7369] tabular-nums">
                    รหัสรายการ: {completedTransaction.transaction.id} | วันที่:{' '}
                    {new Date(completedTransaction.transaction.timestamp).toLocaleDateString('th-TH')}{' '}
                    {new Date(completedTransaction.transaction.timestamp).toLocaleTimeString('th-TH', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>

                {/* Details Section */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-gradient-to-b from-[#F4A641] to-[#D97A1E] text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <ClipboardList className="w-3.5 h-3.5 stroke-[2.4]" />
                      </span>
                      <h4 className="text-sm font-bold text-[#5C3A21] tracking-wide">
                        รายละเอียดรายการ
                      </h4>
                    </div>
                    <span className="text-[11px] font-semibold bg-[#F3E9D8] text-[#5C3A21] border border-[#E2D2B8] px-2.5 py-0.5 rounded-full tabular-nums">
                      ทั้งหมด {bookEntries.length} เล่ม
                    </span>
                  </div>

                  {/* 4-Column Responsive Book Grid with Graceful Scroll for Many Books */}
                  <div
                    className={`grid grid-cols-1 ${
                      bookEntries.length >= 3
                        ? 'sm:grid-cols-2 lg:grid-cols-4'
                        : bookEntries.length === 2
                          ? 'sm:grid-cols-2'
                          : ''
                    } gap-2.5 max-h-[296px] overflow-y-auto pr-0.5`}
                  >
                    {bookEntries.map((entry, idx) => {
                      const targetCode = entry.matchTargetCode?.trim().toUpperCase();
                      const isDonation = targetCode === 'DONATION';
                      const isCancelled = entry.isCancelled;

                      return (
                        <div
                          key={entry.tempId || idx}
                          className="border border-[#E7DCC8] rounded-2xl p-3 text-sm bg-[#FAF5EB] flex flex-col justify-between gap-2"
                        >
                          <div className="flex items-center justify-between gap-1.5 min-w-0">
                            <span
                              title={`เล่มที่ ${idx + 1}: ${entry.title}`}
                              className="font-bold text-[#4A2E1B] text-xs sm:text-[13px] truncate"
                            >
                              เล่มที่ {idx + 1}: {entry.title}
                            </span>
                            <span className="bg-[#F7E9CA] border border-[#E5CFA2] text-[#6B4226] font-bold text-[11px] px-2 py-0.5 rounded-full shrink-0 tabular-nums whitespace-nowrap">
                              รหัส {entry.code}
                            </span>
                          </div>

                          <div className="pt-2 border-t border-[#EAE0D0] flex items-center justify-between gap-1.5 text-[11px] sm:text-xs">
                            <span className="text-[#7E7369] font-medium shrink-0">สถานะ</span>
                            {isDonation ? (
                              <span className="text-[#7D502E] font-semibold bg-[#EFE2CA] border border-[#DEC9A4] px-2.5 py-0.5 rounded-full whitespace-nowrap">
                                บริจาคให้ห้องสมุด
                              </span>
                            ) : isCancelled ? (
                              <span className="text-[#C62828] font-semibold bg-[#FCE8E8] border border-[#F5C6C6] px-2.5 py-0.5 rounded-full whitespace-nowrap">
                                เปลี่ยนใจ ไม่แลกแล้ว
                              </span>
                            ) : (
                              <span className="text-[#4A6124] font-semibold bg-[#DCEAC2] border border-[#C6DA9F] px-2.5 py-0.5 rounded-full whitespace-nowrap">
                                แลกกับรหัส {targetCode}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Green Instruction Banner (with flanking eco illustrations in 4-column mode) */}
                <div className="relative flex items-center justify-center pt-1">
                  {bookEntries.length >= 3 && (
                    <Step6LeftBookPlantIllustration className="hidden md:block w-24 lg:w-28 absolute left-2 -bottom-2 pointer-events-none select-none" />
                  )}

                  <div
                    className={`bg-[#4B6B22] text-[#FFFDF7] px-4 sm:px-5 py-3 rounded-2xl flex items-center justify-center gap-3 sm:gap-3.5 shadow-xs relative z-10 ${
                      bookEntries.length >= 3 ? 'w-full md:max-w-lg' : 'w-full'
                    }`}
                  >
                    <svg
                      viewBox="0 0 54 44"
                      fill="none"
                      className="w-10 h-8 shrink-0"
                      aria-hidden="true"
                    >
                      {/* Golden Sparkle Rays above Open Book */}
                      <path d="M12 10L6 5" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                      <path d="M18 6L17 1" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                      <path d="M24 8L27 3" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                      {/* White Outlined Open Book */}
                      <g transform="translate(8, 12) rotate(-8)">
                        <path
                          d="M2 5C7 3 13 3 18 6V25C13 22 7 22 2 24V5Z"
                          fill="#FFFFFF"
                          fillOpacity="0.14"
                          stroke="#FFFFFF"
                          strokeWidth="2.2"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M34 5C29 3 23 3 18 6V25C23 22 29 22 34 24V5Z"
                          fill="#FFFFFF"
                          fillOpacity="0.14"
                          stroke="#FFFFFF"
                          strokeWidth="2.2"
                          strokeLinejoin="round"
                        />
                        <path d="M7 10H14M7 15H13M22 10H29M22 15H28" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
                      </g>
                    </svg>
                    <p className="text-xs sm:text-sm md:text-base font-semibold leading-snug text-center">
                      โปรดนำตัวเล่มที่นำมาแลก ไปไว้บนชั้น
                      <br />
                      เพื่อรอผู้ร่วมกิจกรรมท่านอื่น มาเลือกต่อไป
                    </p>
                  </div>

                  {bookEntries.length >= 3 && (
                    <Step6RightHeartMascotIllustration className="hidden md:block w-24 lg:w-28 absolute right-2 -bottom-2 pointer-events-none select-none" />
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Stitched Wood-Brown CTA */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleResetKiosk}
                className="w-full py-3.5 px-8 rounded-full bg-gradient-to-b from-[#8D5B34] to-[#6F4424] hover:from-[#7B4E2B] hover:to-[#5D381C] active:scale-[0.99] text-white font-bold text-base sm:text-lg shadow-[0_8px_24px_rgba(111,68,36,0.26)] transition-all cursor-pointer flex items-center justify-center gap-3 relative overflow-hidden"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-[4px] rounded-full border border-dashed border-[#E6C59C]/40"
                />
                <span className="relative z-10">เสร็จสิ้นและกลับสู่หน้าแรก</span>
                <span className="relative z-10 w-6 h-6 rounded-full bg-white text-[#6F4424] flex items-center justify-center shrink-0 shadow-xs">
                  <ArrowRight className="w-4 h-4 stroke-[2.75]" />
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Shelf Browser Modal for Step 5 */}
      {isBrowsingShelfForIdx !== null && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFCF7] rounded-[28px] p-6 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-[#EAE0D2]">
            <div className="flex items-center justify-between pb-3 border-b border-[#EFE6D8]">
              <div>
                <h3 className="font-bold text-lg text-[#5C3A21]">
                  เลือกหนังสือบนชั้นที่พร้อมแลก
                </h3>
                <p className="text-xs text-[#7E7369]">
                  คลิกที่เล่มที่ต้องการเพื่อเลือกแลกในรายการที่ {isBrowsingShelfForIdx + 1}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBrowsingShelfForIdx(null)}
                className="w-8 h-8 rounded-full bg-white border border-[#E5D8C8] flex items-center justify-center text-[#7E7369] hover:text-[#3E2723] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9E9185]" />
                <input
                  type="text"
                  value={shelfSearchQuery}
                  onChange={(e) => setShelfSearchQuery(e.target.value)}
                  placeholder="ค้นหาชื่อเรื่อง รหัส หรือหมวดหมู่..."
                  className="w-full bg-white border border-[#DDD0BF] rounded-full pl-10 pr-4 py-2.5 text-sm text-[#3A2D26] placeholder-[#9E9185] focus:outline-none focus:ring-2 focus:ring-[#7D502E]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredShelf.length === 0 ? (
                <div className="col-span-full py-12 text-center text-[#7E7369] space-y-1">
                  <p className="font-semibold text-sm">ไม่พบหนังสือพร้อมแลก</p>
                  <p className="text-xs text-[#9E9185]">
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
                    className="group bg-white border border-[#EAE0D2] hover:border-[#7D502E] rounded-2xl p-2.5 flex flex-col justify-between hover:shadow-md cursor-pointer transition-all relative"
                  >
                    <div className="aspect-square rounded-xl overflow-hidden mb-2 relative">
                      {b.coverImage ? (
                        <img
                          src={b.coverImage}
                          alt={b.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <MockBookCover
                          title={b.title}
                          category={b.category}
                          code={b.code}
                          seed={b.code || b.title}
                          size="sm"
                        />
                      )}
                      <span
                        className={`absolute top-1.5 left-1.5 text-white text-[10px] font-mono px-2 py-0.5 rounded-full font-bold z-20 shadow-xs ${
                          b.code.startsWith('L') ? 'bg-[#7D502E]' : 'bg-[#4B5E26]'
                        }`}
                      >
                        {b.code}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-bold text-xs text-[#3E2723] line-clamp-1 group-hover:text-[#7D502E] transition-colors">
                        {b.title}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#7E7369]">
                        <span className="truncate">{getShortCatLabel(b.category)}</span>
                        <span className="text-[10px] font-semibold text-[#4B5E26] bg-[#DCE7C4] px-2 py-0.5 rounded-full shrink-0">
                          เลือก
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

      {/* Book Preview Modal */}
      {previewBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-[#FFFCF7] border border-[#EAE0D2] rounded-[28px] p-6 max-w-sm w-full shadow-2xl relative space-y-4">
            <button
              type="button"
              onClick={() => setPreviewBook(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white border border-[#E5D8C8] flex items-center justify-center text-[#7E7369] hover:text-[#3E2723] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-40 h-40 mx-auto rounded-2xl overflow-hidden shadow-inner flex items-center justify-center relative border border-[#EAE0D2]">
              {previewBook.coverImage ? (
                <img
                  src={previewBook.coverImage}
                  alt={previewBook.title}
                  referrerPolicy="no-referrer"
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
              <span
                className={`absolute top-2.5 left-2.5 text-white text-xs font-bold font-mono px-2.5 py-0.5 rounded-full shadow-xs z-20 ${
                  previewBook.code.startsWith('L') ? 'bg-[#7D502E]' : 'bg-[#4B5E26]'
                }`}
              >
                {previewBook.code}
              </span>
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="font-bold text-[#3E2723] text-base leading-snug">
                {previewBook.title}
              </h3>
              <p className="text-xs text-[#4B5E26] font-semibold bg-[#E9EBC8] inline-block px-3 py-0.5 rounded-full">
                {previewBook.category}
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-[#7E7369] pt-1">
                <span>{previewBook.source === 'Library' ? 'ส่วนกลาง (L)' : 'ผู้ร่วมกิจกรรม (U)'}</span>
                <span>·</span>
                <span className="tabular-nums">แลกแล้ว {previewBook.exchangeCount || 1} ครั้ง</span>
              </div>
            </div>

            <div className="pt-2 flex gap-2.5">
              <button
                type="button"
                onClick={() => setPreviewBook(null)}
                className="flex-1 py-2.5 px-4 bg-white border border-[#E5D8C8] text-[#6D5C50] hover:text-[#3E2723] hover:bg-[#F8F2E7] font-semibold text-sm rounded-full transition-all cursor-pointer"
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
                className="flex-1 py-2.5 px-4 bg-[#7D502E] hover:bg-[#653F22] text-white font-semibold text-sm rounded-full transition-all shadow-xs cursor-pointer text-center"
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
