import React, { useState, useEffect, useRef } from 'react';
import {
  Tag,
  FileText,
  Users,
  Plus,
  X,
  Save,
  Check,
  Cloud,
  FolderOpen,
  RefreshCw,
  AlertCircle,
  Hash,
  ShieldCheck,
  HelpCircle,
  ListOrdered,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Delete,
  BookOpen,
  Copy,
  Link2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import type { SystemSettings, Book } from '../types';
import { StorageService, ACTIVE_SPREADSHEET_ID } from '../services/storage';
import {
  createBookSwapSpreadsheet,
  syncAllBooksToSheet,
  syncAllTransactionsToSheet,
  syncSettingsToSheet,
  getEffectiveAppsScriptUrl,
  isValidAppsScriptUrl,
  testAppsScriptConnection,
  syncAllViaAppsScript,
  syncSettingsViaAppsScript,
} from '../services/googleSheets';
import { getBookSwapAppsScriptCode } from '../services/appsScriptTemplate';
import { getOrCreateBookCoversFolder } from '../services/googleDrive';
import { getAccessToken } from '../services/firebaseAuth';

const SETTINGS_ACCESS_PIN = '44512';

interface AdminSettingsProps {
  settings: SystemSettings;
  books: Book[];
  onUpdateSettings: (s: SystemSettings) => void;
  googleConnected: boolean;
  googleUser?: any;
  onConnectGoogle: () => void;
  onFlushPendingSync?: () => Promise<{ synced: boolean; error?: string }>;
  onSelectTab?: (tab: 'kiosk' | 'dashboard' | 'books' | 'settings') => void;
  onOpenAddBook?: () => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  settings,
  books,
  onUpdateSettings,
  googleConnected,
  googleUser,
  onConnectGoogle,
  onFlushPendingSync,
  onSelectTab,
  onOpenAddBook,
}) => {
  const activeAppsScriptUrl = getEffectiveAppsScriptUrl(settings);
  const isGoogleAuthorized = Boolean(activeAppsScriptUrl || (googleConnected && googleUser?.email));
  const googleEmail = googleUser?.email || '';

  // PIN confirmation gate before viewing/editing Settings (PIN: 44512)
  const [isPinUnlocked, setIsPinUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [showPinDigits, setShowPinDigits] = useState(false);
  const pinInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isPinUnlocked) {
      const timer = setTimeout(() => {
        pinInputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isPinUnlocked]);

  const verifyPinValue = (value: string) => {
    if (value === SETTINGS_ACCESS_PIN) {
      setIsPinUnlocked(true);
      setPinInput('');
      setPinError(null);
      return true;
    }
    setPinError('รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
    setPinInput('');
    pinInputRef.current?.focus();
    return false;
  };

  const handlePinDigitInput = (raw: string) => {
    const cleaned = raw.replace(/\D/g, '').slice(0, SETTINGS_ACCESS_PIN.length);
    setPinError(null);
    setPinInput(cleaned);
    if (cleaned.length === SETTINGS_ACCESS_PIN.length) {
      verifyPinValue(cleaned);
    }
  };

  const handleKeypadPress = (digit: string) => {
    if (pinInput.length >= SETTINGS_ACCESS_PIN.length) return;
    handlePinDigitInput(pinInput + digit);
  };

  const handleKeypadBackspace = () => {
    setPinError(null);
    setPinInput((prev) => prev.slice(0, -1));
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.length < SETTINGS_ACCESS_PIN.length) {
      setPinError(`กรุณากรอกรหัส PIN ให้ครบ ${SETTINGS_ACCESS_PIN.length} หลัก`);
      pinInputRef.current?.focus();
      return;
    }
    verifyPinValue(pinInput);
  };

  const [categories, setCategories] = useState<string[]>(settings.categories);
  const [newCatInput, setNewCatInput] = useState('');

  const [participationOptions, setParticipationOptions] = useState<string[]>(
    settings.participationHistoryOptions && settings.participationHistoryOptions.length > 0
      ? settings.participationHistoryOptions
      : ['เคยเข้าร่วมกิจกรรมในปีที่ผ่านมา', 'ปีนี้เป็นครั้งแรก']
  );
  const [newParticipationInput, setNewParticipationInput] = useState('');

  const [frequencyOptions, setFrequencyOptions] = useState<string[]>(
    settings.visitFrequencyOptions && settings.visitFrequencyOptions.length > 0
      ? settings.visitFrequencyOptions
      : ['ครั้งที่ 1', 'ครั้งที่ 2', 'ครั้งที่ 3', 'ครั้งที่ 4', 'ครั้งที่ 5', 'มากกว่า 5 ครั้ง']
  );
  const [newFrequencyInput, setNewFrequencyInput] = useState('');

  const [exchangeTerms, setExchangeTerms] = useState(settings.exchangeTerms);
  const [showWelcomeShelf, setShowWelcomeShelf] = useState(settings.showWelcomeShelf);
  const [deadStockDays, setDeadStockDays] = useState(settings.deadStockThresholdDays);

  const [spreadsheetIdInput, setSpreadsheetIdInput] = useState(
    settings.connectedSpreadsheetId || ACTIVE_SPREADSHEET_ID
  );
  const [appsScriptUrlInput, setAppsScriptUrlInput] = useState(
    settings.appsScriptUrl || ''
  );
  const [isTestingAppsScript, setIsTestingAppsScript] = useState(false);
  const [showScriptGuide, setShowScriptGuide] = useState(!activeAppsScriptUrl);
  const [copiedScript, setCopiedScript] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );
  const [isSaved, setIsSaved] = useState(false);
  const [isSyncSuccess, setIsSyncSuccess] = useState(false);

  useEffect(() => {
    setCategories(settings.categories);
    setExchangeTerms(settings.exchangeTerms);
    setShowWelcomeShelf(settings.showWelcomeShelf);
    setDeadStockDays(settings.deadStockThresholdDays);
    if (settings.participationHistoryOptions && settings.participationHistoryOptions.length > 0) {
      setParticipationOptions(settings.participationHistoryOptions);
    }
    if (settings.visitFrequencyOptions && settings.visitFrequencyOptions.length > 0) {
      setFrequencyOptions(settings.visitFrequencyOptions);
    }
    if (settings.connectedSpreadsheetId) {
      setSpreadsheetIdInput(settings.connectedSpreadsheetId);
    }
    if (settings.appsScriptUrl !== undefined) {
      setAppsScriptUrlInput(settings.appsScriptUrl || '');
    }
  }, [settings]);

  const codeStats = StorageService.getCodeStats();

  const persistLocalSettings = (patch: Partial<SystemSettings>) => {
    const cleanScriptUrl = (
      patch.appsScriptUrl !== undefined ? patch.appsScriptUrl : appsScriptUrlInput
    )?.trim();
    const next: SystemSettings = {
      ...settings,
      categories,
      exchangeTerms,
      showWelcomeShelf,
      participationHistoryOptions: participationOptions,
      visitFrequencyOptions: frequencyOptions,
      deadStockThresholdDays: Number(deadStockDays) || 30,
      connectedSpreadsheetId:
        spreadsheetIdInput.trim() || settings.connectedSpreadsheetId || ACTIVE_SPREADSHEET_ID,
      appsScriptUrl: cleanScriptUrl || undefined,
      ...patch,
    };
    StorageService.saveSettings(next);
    onUpdateSettings(next);
  };

  const handleCopyAppsScriptCode = async () => {
    const targetId = spreadsheetIdInput.trim() || settings.connectedSpreadsheetId || ACTIVE_SPREADSHEET_ID;
    const code = getBookSwapAppsScriptCode(targetId);
    try {
      await navigator.clipboard.writeText(code);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2500);
    } catch {
      setSyncStatusMsg({
        type: 'info',
        text: 'กรุณาคัดลอกโค้ดจากกล่องด้านล่างด้วยตนเอง (Ctrl+A แล้ว Ctrl+C)',
      });
    }
  };

  const handleTestAndSaveAppsScript = async () => {
    const cleanUrl = appsScriptUrlInput.trim();
    const targetId = spreadsheetIdInput.trim() || settings.connectedSpreadsheetId || ACTIVE_SPREADSHEET_ID;
    if (!isValidAppsScriptUrl(cleanUrl)) {
      setSyncStatusMsg({
        type: 'error',
        text: 'URL ไม่ถูกต้อง กรุณาวาง Web App URL จาก Google Apps Script ที่ขึ้นต้นด้วย https://script.google.com/macros/s/ และลงท้ายด้วย /exec',
      });
      return;
    }

    setIsTestingAppsScript(true);
    setSyncStatusMsg(null);
    try {
      const ping = await testAppsScriptConnection(cleanUrl, targetId);
      const updated: SystemSettings = {
        ...settings,
        categories,
        exchangeTerms,
        showWelcomeShelf,
        participationHistoryOptions: participationOptions,
        visitFrequencyOptions: frequencyOptions,
        deadStockThresholdDays: Number(deadStockDays) || 30,
        connectedSpreadsheetId: targetId,
        appsScriptUrl: cleanUrl,
        lastSyncTime: new Date().toISOString(),
      };
      StorageService.saveSettings(updated);
      onUpdateSettings(updated);

      // Save appsScriptUrl into Settings tab of the Google Sheet so ALL Kiosk browsers & Vercel automatically inherit it!
      await syncSettingsViaAppsScript(cleanUrl, targetId, updated);

      // Immediately flush any queued unsynced Kiosk transactions/books
      let flushText = '';
      if (StorageService.hasPendingSync() && onFlushPendingSync) {
        const flushRes = await onFlushPendingSync();
        if (flushRes.synced) {
          flushText = ' และส่งรายการที่ค้างอยู่ขึ้น Google Sheet เรียบร้อยแล้ว!';
        }
      }

      setShowScriptGuide(false);
      setIsSyncSuccess(true);
      setTimeout(() => setIsSyncSuccess(false), 3500);
      setSyncStatusMsg({
        type: 'success',
        text: `เชื่อมต่อ "${ping.title || 'Google Sheet'}" สำเร็จ! (หนังสือ ${ping.booksCount ?? 0} เล่ม, ธุรกรรม ${ping.transactionsCount ?? 0} รายการ) — ระบบพร้อมบันทึกทุก Transaction และซิงค์หนังสืออัตโนมัติแล้ว${flushText}`,
      });
    } catch (err: any) {
      setSyncStatusMsg({
        type: 'error',
        text: err?.message || 'เชื่อมต่อ Google Apps Script Web App ไม่สำเร็จ กรุณาตรวจสอบว่า Deploy โดยเลือก "Who has access: Anyone" แล้ว',
      });
    } finally {
      setIsTestingAppsScript(false);
    }
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatInput.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    const nextCategories = [...categories, trimmed];
    setCategories(nextCategories);
    setNewCatInput('');
    persistLocalSettings({ categories: nextCategories });
  };

  const handleRemoveCategory = (catToRemove: string) => {
    if (categories.length <= 1) {
      setSyncStatusMsg({ type: 'error', text: 'ต้องมีหมวดหมู่อย่างน้อย 1 หมวด' });
      return;
    }
    const nextCategories = categories.filter((c) => c !== catToRemove);
    setCategories(nextCategories);
    persistLocalSettings({ categories: nextCategories });
  };

  const handleAddParticipationOpt = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newParticipationInput.trim();
    if (!trimmed || participationOptions.includes(trimmed)) return;
    const nextOptions = [...participationOptions, trimmed];
    setParticipationOptions(nextOptions);
    setNewParticipationInput('');
    persistLocalSettings({ participationHistoryOptions: nextOptions });
  };

  const handleRemoveParticipationOpt = (optToRemove: string) => {
    if (participationOptions.length <= 1) {
      setSyncStatusMsg({ type: 'error', text: 'ต้องมีตัวเลือกอย่างน้อย 1 ตัวเลือก' });
      return;
    }
    const nextOptions = participationOptions.filter((o) => o !== optToRemove);
    setParticipationOptions(nextOptions);
    persistLocalSettings({ participationHistoryOptions: nextOptions });
  };

  const handleAddFrequencyOpt = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFrequencyInput.trim();
    if (!trimmed || frequencyOptions.includes(trimmed)) return;
    const nextOptions = [...frequencyOptions, trimmed];
    setFrequencyOptions(nextOptions);
    setNewFrequencyInput('');
    persistLocalSettings({ visitFrequencyOptions: nextOptions });
  };

  const handleRemoveFrequencyOpt = (optToRemove: string) => {
    if (frequencyOptions.length <= 1) {
      setSyncStatusMsg({ type: 'error', text: 'ต้องมีตัวเลือกอย่างน้อย 1 ตัวเลือก' });
      return;
    }
    const nextOptions = frequencyOptions.filter((o) => o !== optToRemove);
    setFrequencyOptions(nextOptions);
    persistLocalSettings({ visitFrequencyOptions: nextOptions });
  };

  const handleSaveSettings = async () => {
    if (!isPinUnlocked) {
      setSyncStatusMsg({
        type: 'error',
        text: 'กรุณายืนยันรหัส PIN ก่อนแก้ไขการตั้งค่าระบบ',
      });
      return;
    }

    setIsSyncing(true);
    setSyncStatusMsg(null);

    const cleanScriptUrl = appsScriptUrlInput.trim();
    const updated: SystemSettings = {
      ...settings,
      categories,
      exchangeTerms,
      showWelcomeShelf,
      participationHistoryOptions: participationOptions,
      visitFrequencyOptions: frequencyOptions,
      deadStockThresholdDays: Number(deadStockDays) || 30,
      connectedSpreadsheetId:
        spreadsheetIdInput.trim() || settings.connectedSpreadsheetId || ACTIVE_SPREADSHEET_ID,
      appsScriptUrl: isValidAppsScriptUrl(cleanScriptUrl) ? cleanScriptUrl : settings.appsScriptUrl,
    };

    // 1. Save data locally
    StorageService.saveSettings(updated);
    onUpdateSettings(updated);
    setIsSaved(true);

    // 2. Sync to Google Sheet (prefer Apps Script Web App Bridge, fallback to OAuth)
    try {
      const targetId = updated.connectedSpreadsheetId || ACTIVE_SPREADSHEET_ID;
      const scriptUrl = getEffectiveAppsScriptUrl(updated);
      const allTx = StorageService.getTransactions();

      if (scriptUrl) {
        await syncAllViaAppsScript(scriptUrl, targetId, books, allTx, updated);
        updated.lastSyncTime = new Date().toISOString();
        StorageService.saveSettings(updated);
        onUpdateSettings(updated);

        setIsSyncSuccess(true);
        setTimeout(() => setIsSyncSuccess(false), 3500);
        setTimeout(() => setIsSaved(false), 3500);
        setSyncStatusMsg({
          type: 'success',
          text: `บันทึกและซิงค์การตั้งค่าระบบ, หนังสือ (${books.length} เล่ม) และธุรกรรม (${allTx.length} รายการ) ขึ้น Google Sheet สำเร็จ!`,
        });
        return;
      }

      const token = await getAccessToken();
      if (!token) {
        setSyncStatusMsg({
          type: 'info',
          text: 'บันทึกในเบราว์เซอร์นี้แล้ว — กรุณาตั้งค่า Google Apps Script Web App URL ด้านบนเพื่อให้ระบบซิงค์ไปยัง Google Sheet และทุกเครื่องอัตโนมัติ',
        });
        setTimeout(() => setIsSaved(false), 3000);
        return;
      }

      await syncSettingsToSheet(token, targetId, updated);
      await syncAllBooksToSheet(token, targetId, books);
      await syncAllTransactionsToSheet(token, targetId, allTx);

      updated.lastSyncTime = new Date().toISOString();
      StorageService.saveSettings(updated);
      onUpdateSettings(updated);

      setIsSyncSuccess(true);
      setTimeout(() => setIsSyncSuccess(false), 3500);
      setTimeout(() => setIsSaved(false), 3500);

      setSyncStatusMsg({
        type: 'success',
        text: `บันทึกและซิงค์การตั้งค่าระบบ (เงื่อนไข/หมวดหมู่), หนังสือ (${books.length} เล่ม) และธุรกรรม (${allTx.length} รายการ) ขึ้น Google Sheet สำเร็จ!`,
      });
    } catch (err: any) {
      console.error('Save and sync error:', err);
      setTimeout(() => setIsSaved(false), 3000);
      setSyncStatusMsg({
        type: 'error',
        text: `บันทึกข้อมูลเรียบร้อยแล้ว แต่การซิงค์ Google Sheet ขัดข้อง: ${err.message || 'โปรดตรวจสอบการเชื่อมต่อ'}`,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateNewGoogleSheet = async () => {
    if (!isPinUnlocked) {
      setSyncStatusMsg({
        type: 'error',
        text: 'กรุณายืนยันรหัส PIN ก่อนแก้ไขการตั้งค่าระบบ',
      });
      return;
    }

    if (!isGoogleAuthorized) {
      onConnectGoogle();
      setSyncStatusMsg({
        type: 'info',
        text: 'กรุณาลงชื่อเข้าใช้ด้วยบัญชี Google ที่มีสิทธิ์เข้าถึง Google Sheet ก่อนสร้างตารางใหม่',
      });
      return;
    }

    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('กรุณาลงชื่อเข้าใช้ด้วย Google ก่อน');

      const newSheetId = await createBookSwapSpreadsheet(token);
      setSpreadsheetIdInput(newSheetId);
      const folderId = await getOrCreateBookCoversFolder(token);
      await syncAllBooksToSheet(token, newSheetId, books);
      const allTx = StorageService.getTransactions();
      await syncAllTransactionsToSheet(token, newSheetId, allTx);

      const updated: SystemSettings = {
        ...settings,
        categories,
        exchangeTerms,
        showWelcomeShelf,
        participationHistoryOptions: participationOptions,
        visitFrequencyOptions: frequencyOptions,
        deadStockThresholdDays: Number(deadStockDays) || 30,
        connectedSpreadsheetId: newSheetId,
        connectedDriveFolderId: folderId,
        lastSyncTime: new Date().toISOString(),
      };
      await syncSettingsToSheet(token, newSheetId, updated);
      StorageService.saveSettings(updated);
      onUpdateSettings(updated);

      setIsSyncSuccess(true);
      setTimeout(() => setIsSyncSuccess(false), 3000);

      setSyncStatusMsg({
        type: 'success',
        text: `สร้าง Google Spreadsheet สำเร็จและซิงค์ข้อมูล ${books.length} เล่ม และ ${allTx.length} รายการแลกเปลี่ยนเรียบร้อย!`,
      });
    } catch (err: any) {
      console.error(err);
      setSyncStatusMsg({
        type: 'error',
        text: err.message || 'ไม่สามารถสร้าง Google Spreadsheet ได้',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncCurrentBooksToGoogle = async () => {
    if (!isPinUnlocked) {
      setSyncStatusMsg({
        type: 'error',
        text: 'กรุณายืนยันรหัส PIN ก่อนซิงค์ข้อมูล',
      });
      return;
    }

    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      const cleanScriptUrl = appsScriptUrlInput.trim();
      const targetId =
        spreadsheetIdInput.trim() || settings.connectedSpreadsheetId || ACTIVE_SPREADSHEET_ID;
      const currentConfig: SystemSettings = {
        ...settings,
        categories,
        exchangeTerms,
        showWelcomeShelf,
        participationHistoryOptions: participationOptions,
        visitFrequencyOptions: frequencyOptions,
        deadStockThresholdDays: Number(deadStockDays) || 30,
        connectedSpreadsheetId: targetId,
        appsScriptUrl: isValidAppsScriptUrl(cleanScriptUrl) ? cleanScriptUrl : settings.appsScriptUrl,
      };
      StorageService.saveSettings(currentConfig);
      onUpdateSettings(currentConfig);

      const allTx = StorageService.getTransactions();
      const scriptUrl = getEffectiveAppsScriptUrl(currentConfig);

      if (scriptUrl) {
        await syncAllViaAppsScript(scriptUrl, targetId, books, allTx, currentConfig);
      } else {
        const token = await getAccessToken();
        if (!token) {
          throw new Error(
            'กรุณาวาง Google Apps Script Web App URL ในการ์ดด้านบนก่อนกดซิงค์ขึ้น Google Sheet'
          );
        }
        await syncSettingsToSheet(token, targetId, currentConfig);
        await syncAllBooksToSheet(token, targetId, books);
        await syncAllTransactionsToSheet(token, targetId, allTx);
      }

      const updated = {
        ...currentConfig,
        connectedSpreadsheetId: targetId,
        lastSyncTime: new Date().toISOString(),
      };
      StorageService.saveSettings(updated);
      onUpdateSettings(updated);

      setIsSaved(true);
      setIsSyncSuccess(true);
      setTimeout(() => setIsSyncSuccess(false), 3000);
      setTimeout(() => setIsSaved(false), 3000);

      setSyncStatusMsg({
        type: 'success',
        text: `ซิงค์การตั้งค่าระบบ และข้อมูลทั้งหมด (${books.length} เล่ม, ${allTx.length} ธุรกรรม) ไปยัง Google Sheets สำเร็จ!`,
      });
    } catch (err: any) {
      console.error(err);
      setSyncStatusMsg({
        type: 'error',
        text: err.message || 'เกิดข้อผิดพลาดในการซิงค์',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="pb-24 pt-5 max-w-6xl mx-auto px-4 min-h-[calc(100vh-8rem)] font-sans space-y-4">
      {/* 1. Top Header Card */}
      <div className="bg-[#FFFCF7]/95 backdrop-blur-sm border border-[#EAE0D2] rounded-[28px] sm:rounded-[34px] p-5 sm:p-6 shadow-[0_18px_48px_rgba(92,58,33,0.09)]">
        <h1 className="text-lg sm:text-xl font-bold text-[#4E342E] tracking-tight">
          ระบบแลกเปลี่ยนหนังสือ สำนักหอสมุด
        </h1>
        <p className="text-xs text-[#7E7369] font-medium mt-1">
          ส่วนการจัดการสำหรับเจ้าหน้าที่ (ตั้งค่าระบบ)
        </p>
      </div>

      {/* 2. Sub-header Navigation Pill Bar + Action Buttons */}
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
            className="text-[#4E342E] hover:bg-[#F8F2E7] px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            Book List
          </button>
          <button
            type="button"
            onClick={() => onSelectTab?.('settings')}
            className="bg-[#7D502E] text-white px-5 py-2 rounded-full text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
          >
            ตั้งค่าระบบ
          </button>
        </div>

        {/* Action Buttons (visible once PIN is verified) */}
        {isPinUnlocked && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setIsPinUnlocked(false);
                setPinInput('');
                setPinError(null);
              }}
              className="flex items-center gap-1.5 bg-[#FFFDF9] hover:bg-[#F8F2E7] text-[#5C3A21] border border-[#E2D4C0] px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold shadow-2xs transition-all cursor-pointer"
              title="ล็อกหน้าตั้งค่าระบบอีกครั้ง"
            >
              <Lock className="w-3.5 h-3.5 text-[#7D502E]" />
              <span>ล็อกหน้าตั้งค่า</span>
            </button>

            <button
              type="button"
              onClick={handleSyncCurrentBooksToGoogle}
              disabled={isSyncing}
              className="flex items-center gap-1.5 bg-[#7D502E] hover:bg-[#653F22] active:scale-[0.98] disabled:opacity-60 text-white px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังซิงค์...</span>
                </>
              ) : isSyncSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#DCE7C4]" />
                  <span>ซิงค์สำเร็จแล้ว</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5 text-[#E9EBC8]" />
                  <span>ซิงค์ไป Google Sheet</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-4 sm:px-5 py-2 active:scale-[0.98] disabled:opacity-70 text-white font-semibold text-xs sm:text-sm rounded-full shadow-xs transition-all bg-[#4B5E26] hover:bg-[#3B4B1D] cursor-pointer"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังบันทึกและซิงค์...</span>
                </>
              ) : isSaved && isSyncSuccess ? (
                <>
                  <Check className="w-4 h-4 text-[#DCE7C4]" />
                  <span>บันทึกและซิงค์แล้ว</span>
                </>
              ) : isSaved ? (
                <>
                  <Check className="w-4 h-4 text-[#DCE7C4]" />
                  <span>บันทึกข้อมูลแล้ว</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>บันทึกข้อมูล</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* PIN Confirmation Gate before accessing/editing Settings */}
      {!isPinUnlocked ? (
        <div className="pt-4 pb-8 flex items-center justify-center">
          <div className="w-full max-w-md bg-[#FFFCF7]/95 backdrop-blur-sm border border-[#EAE0D2] rounded-[28px] p-6 sm:p-8 shadow-[0_18px_48px_rgba(92,58,33,0.09)] text-center space-y-5">
            <div className="space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-[#DCE7C4] border border-[#C3D3A6] flex items-center justify-center mx-auto shadow-xs">
                <KeyRound className="w-7 h-7 text-[#4B5E26]" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[#4E342E]">
                ยืนยันรหัส PIN เพื่อตั้งค่าระบบ
              </h2>
              <p className="text-xs sm:text-sm text-[#7E7369] leading-relaxed">
                กรุณากรอกรหัส PIN 5 หลัก เพื่อยืนยันสิทธิ์ก่อนเข้าไปดูและแก้ไขข้อมูลหน้าตั้งค่าระบบ
              </p>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              {/* Hidden/accessible text input synchronized with 5 visual PIN slots */}
              <div
                onClick={() => pinInputRef.current?.focus()}
                className="relative cursor-text"
              >
                <input
                  ref={pinInputRef}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={SETTINGS_ACCESS_PIN.length}
                  value={pinInput}
                  onChange={(e) => handlePinDigitInput(e.target.value)}
                  aria-label="รหัส PIN 5 หลัก"
                  className="absolute inset-0 opacity-0 w-full h-full cursor-text"
                />
                <div className="flex items-center justify-center gap-2.5 sm:gap-3">
                  {Array.from({ length: SETTINGS_ACCESS_PIN.length }).map((_, idx) => {
                    const char = pinInput[idx] || '';
                    const isFilled = Boolean(char);
                    const isActive = pinInput.length === idx;
                    return (
                      <div
                        key={idx}
                        className={`w-11 h-12 sm:w-12 sm:h-14 rounded-2xl border-2 flex items-center justify-center text-lg sm:text-xl font-bold font-mono transition-all ${
                          pinError
                            ? 'bg-[#FFF5F5] border-[#E57373] text-[#C62828]'
                            : isActive
                              ? 'bg-white border-[#7D502E] ring-4 ring-[#7D502E]/15 text-[#4E342E]'
                              : isFilled
                                ? 'bg-[#F8F2E7] border-[#4B5E26] text-[#3B4C1D]'
                                : 'bg-white border-[#E2D4C0] text-[#8E8175]'
                        }`}
                      >
                        {isFilled ? (showPinDigits ? char : '•') : ''}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowPinDigits((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#7E7369] hover:text-[#4E342E] cursor-pointer transition-colors"
                >
                  {showPinDigits ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPinDigits ? 'ซ่อนตัวเลข PIN' : 'แสดงตัวเลข PIN'}</span>
                </button>
              </div>

              {pinError && (
                <div className="p-2.5 rounded-2xl bg-[#FFF0F0] border border-[#FFCDCD] text-xs text-[#D32F2F] flex items-center justify-center gap-1.5 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              {/* Touch-friendly Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleKeypadPress(digit)}
                    className="h-11 rounded-2xl bg-white hover:bg-[#F8F2E7] active:scale-95 border border-[#E5D8C8] text-base font-bold font-mono text-[#4E342E] shadow-2xs transition-all cursor-pointer"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setPinInput('');
                    setPinError(null);
                    pinInputRef.current?.focus();
                  }}
                  className="h-11 rounded-2xl bg-[#F3ECE1] hover:bg-[#EAE0D2] active:scale-95 border border-[#E5D8C8] text-xs font-semibold text-[#6D5C50] transition-all cursor-pointer"
                >
                  ล้าง
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className="h-11 rounded-2xl bg-white hover:bg-[#F8F2E7] active:scale-95 border border-[#E5D8C8] text-base font-bold font-mono text-[#4E342E] shadow-2xs transition-all cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleKeypadBackspace}
                  aria-label="ลบตัวเลข"
                  className="h-11 rounded-2xl bg-[#F3ECE1] hover:bg-[#EAE0D2] active:scale-95 border border-[#E5D8C8] flex items-center justify-center text-[#6D5C50] transition-all cursor-pointer"
                >
                  <Delete className="w-4 h-4" />
                </button>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-6 rounded-full bg-gradient-to-b from-[#8D5B34] to-[#6F4424] hover:from-[#7B4E2B] hover:to-[#5D381C] active:scale-[0.99] text-white font-bold text-sm shadow-[0_8px_20px_rgba(111,68,36,0.22)] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>ยืนยันรหัส PIN</span>
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {syncStatusMsg && (
            <div
              className={`p-3 rounded-2xl text-xs flex items-center gap-2 shadow-xs ${
                syncStatusMsg.type === 'success'
                  ? 'bg-[#DCE7C4]/80 text-[#3B4C1D] border border-[#CBD6A6]'
                  : syncStatusMsg.type === 'info'
                    ? 'bg-[#F8F2E7] text-[#5C3A21] border border-[#E5D8C8]'
                    : 'bg-[#FFEBEE] text-[#D32F2F] border border-[#FFCDD2]'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="flex-1">{syncStatusMsg.text}</span>
            </div>
          )}

          {/* Google Sheet Auto-Write Connection Card (Apps Script Web App Bridge) */}
          <div className="bg-[#FFFCF7]/95 backdrop-blur-xs rounded-[28px] p-5 border border-[#EAE0D2] shadow-xs space-y-3.5">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EFE6D8] flex-wrap">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#4B5E26]" />
                <h3 className="text-xs sm:text-sm font-bold text-[#4E342E]">
                  เชื่อมต่อบันทึกข้อมูล Google Sheet อัตโนมัติ (Books &amp; Transactions)
                </h3>
              </div>
              {activeAppsScriptUrl ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-[#E8F5E9] text-[#1E5631] border border-[#C8E6C9] px-3 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D32]" />
                  <span>เชื่อมต่อพร้อมบันทึกแล้ว</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-[#FEF3C7] text-[#92400E] border border-[#F5D08A] px-3 py-1 rounded-full">
                  <AlertCircle className="w-3.5 h-3.5 text-[#D97706]" />
                  <span>รอวาง Apps Script Web App URL (ตั้งค่าครั้งเดียว)</span>
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#F8F2E7] border border-[#E5D8C8] rounded-2xl px-3.5 py-2.5 text-xs">
              <div className="min-w-0">
                <div className="text-[11px] text-[#7E7369] font-medium">Google Sheet ที่ผูกกับระบบ</div>
                <div className="font-mono font-semibold text-[#4E342E] truncate">
                  {spreadsheetIdInput || ACTIVE_SPREADSHEET_ID}
                </div>
              </div>
              <a
                href={`https://docs.google.com/spreadsheets/d/${encodeURIComponent(
                  spreadsheetIdInput || ACTIVE_SPREADSHEET_ID
                )}/edit#gid=229659620`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4B5E26] hover:text-[#3B4B1D] bg-[#DCE7C4] hover:bg-[#CEDEB0] px-3 py-1.5 rounded-full transition-colors shrink-0 self-start sm:self-center"
              >
                <span>เปิดไฟล์ Google Sheet</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#4E342E]">
                Google Apps Script Web App URL (ลงท้ายด้วย /exec)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={appsScriptUrlInput}
                  onChange={(e) => setAppsScriptUrlInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="flex-1 px-3.5 py-2 rounded-2xl border border-[#DDD0BF] text-xs font-mono bg-white text-[#3E2723] placeholder-[#9E9185] focus:outline-none focus:ring-2 focus:ring-[#7D502E]"
                />
                <button
                  type="button"
                  disabled={isTestingAppsScript || !appsScriptUrlInput.trim()}
                  onClick={handleTestAndSaveAppsScript}
                  className="px-4 py-2 bg-[#4B5E26] hover:bg-[#3B4B1D] disabled:opacity-50 text-white font-semibold text-xs rounded-full cursor-pointer transition-colors flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap"
                >
                  {isTestingAppsScript ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังทดสอบและบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>ทดสอบและบันทึกการเชื่อมต่อ</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-[#7E7369] leading-relaxed">
                ตั้งค่าเพียงครั้งเดียว ระบบจะบันทึก URL นี้ลงแท็บ Settings ของ Google Sheet เพื่อให้ทุกเครื่อง Kiosk และหน้าเว็บไซต์จริงบันทึกข้อมูล Transactions และซิงค์หนังสือลง Sheet ได้ทันทีโดยไม่ขึ้นหน้าเตือน Google และไม่หมดอายุทุก 1 ชั่วโมง
              </p>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowScriptGuide((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7D502E] hover:text-[#5C3A21] cursor-pointer"
              >
                {showScriptGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <span>{showScriptGuide ? 'ซ่อนวิธีติดตั้งและโค้ด Apps Script' : 'ดูวิธีติดตั้งและคัดลอกโค้ด Apps Script (ทำครั้งเดียว)'}</span>
              </button>

              {showScriptGuide && (
                <div className="mt-3 bg-[#FAF5EB] border border-[#E5D8C8] rounded-2xl p-4 space-y-3 text-xs text-[#4E342E]">
                  <ol className="list-decimal list-inside space-y-1.5 text-[11px] sm:text-xs leading-relaxed">
                    <li>
                      เปิดไฟล์ Google Sheet ด้านบน แล้วไปที่เมนู <strong>Extensions (ส่วนขยาย) → Apps Script</strong>
                    </li>
                    <li>
                      กดปุ่ม <strong>คัดลอกโค้ด Apps Script</strong> ด้านล่าง แล้วนำไปวางทับโค้ดเดิมทั้งหมด จากนั้นกดบันทึก (Ctrl+S)
                    </li>
                    <li>
                      กดปุ่ม <strong>Deploy → New deployment</strong> เลือกชนิดเป็น <strong>Web app</strong> ตั้งค่า{' '}
                      <strong>Execute as: Me</strong> และ <strong>Who has access: Anyone</strong> แล้วกด Deploy
                    </li>
                    <li>
                      คัดลอก <strong>Web app URL</strong> (ลงท้ายด้วย <code className="font-mono">/exec</code>) มาวางในช่องด้านบน แล้วกด{' '}
                      <strong>ทดสอบและบันทึกการเชื่อมต่อ</strong>
                    </li>
                  </ol>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] font-semibold text-[#5C3A21]">
                      โค้ด Code.gs (ตั้งค่า Spreadsheet ID อัตโนมัติแล้ว)
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyAppsScriptCode}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#7D502E] hover:bg-[#653F22] text-white text-xs font-semibold cursor-pointer transition-colors"
                    >
                      {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedScript ? 'คัดลอกโค้ดแล้ว!' : 'คัดลอกโค้ด Apps Script'}</span>
                    </button>
                  </div>

                  <pre className="bg-white border border-[#E5D8C8] rounded-xl p-3 text-[10px] sm:text-[11px] font-mono text-[#3E2723] max-h-48 overflow-auto select-all whitespace-pre">
                    {getBookSwapAppsScriptCode(spreadsheetIdInput || ACTIVE_SPREADSHEET_ID)}
                  </pre>
                </div>
              )}
            </div>
          </div>

        {/* Categories Card */}
        <div className="bg-[#FFFCF7]/95 backdrop-blur-xs rounded-[28px] p-5 border border-[#EAE0D2] shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-[#EFE6D8] mb-3">
            <Tag className="w-4 h-4 text-[#4B5E26]" />
            <h3 className="text-xs font-bold text-[#4E342E]">
              จัดการหมวดหมู่หนังสือ
            </h3>
          </div>

          <form onSubmit={handleAddCategory} className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="หมวดหมู่ใหม่..."
              value={newCatInput}
              onChange={(e) => setNewCatInput(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-2xl border border-[#DDD0BF] text-xs bg-white text-[#3E2723] focus:outline-none focus:ring-2 focus:ring-[#7D502E]"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#7D502E] hover:bg-[#653F22] text-white font-semibold text-xs rounded-full cursor-pointer transition-colors tracking-tight"
            >
              เพิ่ม
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <div
                key={cat}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F3E7D3] border border-[#E0CEB5] text-xs font-semibold text-[#5C3A21]"
              >
                <span>{cat}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveCategory(cat)}
                  className="p-0.5 text-[#7E7369] hover:text-[#D32F2F] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* PDPA Dropdown 1: จัดการตัวเลือกการร่วมกิจกรรม */}
        <div className="bg-[#FFFCF7]/95 backdrop-blur-xs rounded-[28px] p-5 border border-[#EAE0D2] shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#EFE6D8] mb-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#4B5E26]" />
              <h3 className="text-xs font-bold text-[#4E342E]">
                จัดการตัวเลือก: การร่วมกิจกรรม (แบบฟอร์ม Kiosk)
              </h3>
            </div>
            <span className="text-[10px] text-[#3B4C1D] bg-[#DCE7C4] px-2.5 py-0.5 rounded-full border border-[#CBD6A6] font-semibold">
              PDPA Compliance
            </span>
          </div>

          <p className="text-[11px] text-[#7E7369] mb-3">
            ตัวเลือกสำหรับคำถาม &quot;การร่วมกิจกรรม&quot; ในขั้นตอนที่ 2 ของ Kiosk (ค่าเริ่มต้นหน้าตู้จะเป็นค่าว่าง)
          </p>

          <form onSubmit={handleAddParticipationOpt} className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="เพิ่มตัวเลือกการร่วมกิจกรรม..."
              value={newParticipationInput}
              onChange={(e) => setNewParticipationInput(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-2xl border border-[#DDD0BF] text-xs bg-white text-[#3E2723] focus:outline-none focus:ring-2 focus:ring-[#7D502E]"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#7D502E] hover:bg-[#653F22] text-white font-semibold text-xs rounded-full cursor-pointer transition-colors tracking-tight"
            >
              เพิ่ม
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {participationOptions.map((opt) => (
              <div
                key={opt}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#DCE7C4]/60 border border-[#CBD6A6] text-xs font-medium text-[#3B4C1D]"
              >
                <span>{opt}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveParticipationOpt(opt)}
                  className="p-0.5 text-[#55826A] hover:text-[#D32F2F] cursor-pointer"
                  title="ลบตัวเลือกนี้"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* PDPA Dropdown 2: จัดการตัวเลือกความถี่การร่วมกิจกรรมในปีนี้ */}
        <div className="bg-[#FFFCF7]/95 backdrop-blur-xs rounded-[28px] p-5 border border-[#EAE0D2] shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#EFE6D8] mb-3">
            <div className="flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-[#4B5E26]" />
              <h3 className="text-xs font-bold text-[#4E342E]">
                จัดการตัวเลือก: ในปีนี้ ท่านมาร่วมกิจกรรมแล้วกี่ครั้ง (แบบฟอร์ม Kiosk)
              </h3>
            </div>
            <span className="text-[10px] text-[#3B4C1D] bg-[#DCE7C4] px-2.5 py-0.5 rounded-full border border-[#CBD6A6] font-semibold">
              PDPA Compliance
            </span>
          </div>

          <p className="text-[11px] text-[#7E7369] mb-3">
            ตัวเลือกสำหรับคำถาม &quot;ในปีนี้ ท่านมาร่วมกิจกรรมแล้วกี่ครั้ง&quot; ในขั้นตอนที่ 2 ของ Kiosk (ค่าเริ่มต้นหน้าตู้จะเป็นค่าว่าง)
          </p>

          <form onSubmit={handleAddFrequencyOpt} className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="เพิ่มตัวเลือกจำนวนครั้ง เช่น ครั้งที่ 6..."
              value={newFrequencyInput}
              onChange={(e) => setNewFrequencyInput(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-2xl border border-[#DDD0BF] text-xs bg-white text-[#3E2723] focus:outline-none focus:ring-2 focus:ring-[#7D502E]"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#7D502E] hover:bg-[#653F22] text-white font-semibold text-xs rounded-full cursor-pointer transition-colors tracking-tight"
            >
              เพิ่ม
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {frequencyOptions.map((opt) => (
              <div
                key={opt}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF3E6] border border-[#E5D8C8] text-xs font-medium text-[#5C3A21]"
              >
                <span>{opt}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveFrequencyOpt(opt)}
                  className="p-0.5 text-[#7E7369] hover:text-[#D32F2F] cursor-pointer"
                  title="ลบตัวเลือกนี้"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Rules Card */}
        <div className="bg-[#FFFCF7]/95 backdrop-blur-xs rounded-[28px] p-5 border border-[#EAE0D2] shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-[#EFE6D8] mb-3">
            <FileText className="w-4 h-4 text-[#4B5E26]" />
            <h3 className="text-xs font-bold text-[#4E342E]">
              ข้อความเงื่อนไขและกติกา
            </h3>
          </div>

          <textarea
            rows={5}
            value={exchangeTerms}
            onChange={(e) => {
              const val = e.target.value;
              setExchangeTerms(val);
              persistLocalSettings({ exchangeTerms: val });
            }}
            className="w-full p-3.5 rounded-2xl border border-[#DDD0BF] text-xs text-[#3E2723] bg-white font-normal focus:outline-none focus:ring-2 focus:ring-[#7D502E]"
          />

          <div className="mt-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showWelcomeShelf}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setShowWelcomeShelf(checked);
                  persistLocalSettings({ showWelcomeShelf: checked });
                }}
                className="w-4 h-4 text-[#4B5E26] rounded focus:ring-[#4B5E26]"
              />
              <span className="text-xs text-[#4E342E] font-normal">
                แสดงภาพหน้าปกหนังสือบนชั้นที่หน้าแรก
              </span>
            </label>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-[#7E7369] font-normal">เกณฑ์ Dead Stock:</span>
              <div className="flex items-center gap-1 font-mono">
                <input
                  type="number"
                  min="5"
                  value={deadStockDays}
                  onChange={(e) => {
                    const days = Number(e.target.value) || 30;
                    setDeadStockDays(days);
                    persistLocalSettings({ deadStockThresholdDays: days });
                  }}
                  className="w-14 px-2 py-1 border border-[#DDD0BF] rounded-xl text-center bg-white text-[#3E2723]"
                />
                <span className="text-[#7E7369]">วัน</span>
              </div>
            </div>
          </div>
        </div>

      </div>
      )}
    </div>
  );
};
