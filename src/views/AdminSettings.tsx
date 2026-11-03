import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import type { SystemSettings, StaffAccount, Book } from '../types';
import { StorageService } from '../services/storage';
import {
  createBookSwapSpreadsheet,
  syncAllBooksToSheet,
  syncAllTransactionsToSheet,
} from '../services/googleSheets';
import { getOrCreateBookCoversFolder } from '../services/googleDrive';
import { getAccessToken, ALLOWED_GOOGLE_ADMIN_EMAIL } from '../services/firebaseAuth';

interface AdminSettingsProps {
  settings: SystemSettings;
  staff: StaffAccount[];
  books: Book[];
  onUpdateSettings: (s: SystemSettings) => void;
  onUpdateStaff: (st: StaffAccount[]) => void;
  googleConnected: boolean;
  googleUser?: any;
  onConnectGoogle: () => void;
  onSelectTab?: (tab: 'kiosk' | 'dashboard' | 'books' | 'settings') => void;
  onOpenAddBook?: () => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  settings,
  staff,
  books,
  onUpdateSettings,
  onUpdateStaff,
  googleConnected,
  googleUser,
  onConnectGoogle,
  onSelectTab,
  onOpenAddBook,
}) => {
  const isSuperAdmin = Boolean(
    googleUser?.email?.toLowerCase().trim() === ALLOWED_GOOGLE_ADMIN_EMAIL.toLowerCase()
  );
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

  const [staffList, setStaffList] = useState<StaffAccount[]>(staff);
  const [newStaffUser, setNewStaffUser] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');

  const [spreadsheetIdInput, setSpreadsheetIdInput] = useState(
    settings.connectedSpreadsheetId || ''
  );
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
  }, [settings]);

  const codeStats = StorageService.getCodeStats();

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatInput.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    setCategories([...categories, trimmed]);
    setNewCatInput('');
  };

  const handleRemoveCategory = (catToRemove: string) => {
    if (categories.length <= 1) {
      alert('ต้องมีหมวดหมู่อย่างน้อย 1 หมวด');
      return;
    }
    setCategories(categories.filter((c) => c !== catToRemove));
  };

  const handleAddParticipationOpt = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newParticipationInput.trim();
    if (!trimmed || participationOptions.includes(trimmed)) return;
    setParticipationOptions([...participationOptions, trimmed]);
    setNewParticipationInput('');
  };

  const handleRemoveParticipationOpt = (optToRemove: string) => {
    if (participationOptions.length <= 1) {
      alert('ต้องมีตัวเลือกอย่างน้อย 1 ตัวเลือก');
      return;
    }
    setParticipationOptions(participationOptions.filter((o) => o !== optToRemove));
  };

  const handleAddFrequencyOpt = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFrequencyInput.trim();
    if (!trimmed || frequencyOptions.includes(trimmed)) return;
    setFrequencyOptions([...frequencyOptions, trimmed]);
    setNewFrequencyInput('');
  };

  const handleRemoveFrequencyOpt = (optToRemove: string) => {
    if (frequencyOptions.length <= 1) {
      alert('ต้องมีตัวเลือกอย่างน้อย 1 ตัวเลือก');
      return;
    }
    setFrequencyOptions(frequencyOptions.filter((o) => o !== optToRemove));
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    const user = newStaffUser.trim();
    const pwd = newStaffPassword.trim();
    if (!user || !pwd) {
      alert('กรุณากรอก Username และ Password');
      return;
    }
    if (staffList.some((s) => s.username === user)) {
      alert('มีชื่อผู้ใช้นี้ในระบบแล้ว');
      return;
    }

    const nextStaff: StaffAccount[] = [
      ...staffList,
      {
        username: user,
        password: pwd,
        role: 'staff',
        createdAt: new Date().toISOString(),
      },
    ];
    setStaffList(nextStaff);
    StorageService.saveStaff(nextStaff);
    onUpdateStaff(nextStaff);
    setNewStaffUser('');
    setNewStaffPassword('');
  };

  const handleRemoveStaff = (username: string) => {
    if (username === 'admin') {
      alert('ไม่สามารถลบบัญชี admin หลักได้');
      return;
    }
    const nextStaff = staffList.filter((s) => s.username !== username);
    setStaffList(nextStaff);
    StorageService.saveStaff(nextStaff);
    onUpdateStaff(nextStaff);
  };

  const handleSaveSettings = async () => {
    setIsSyncing(true);
    setSyncStatusMsg(null);

    const updated: SystemSettings = {
      ...settings,
      categories,
      exchangeTerms,
      showWelcomeShelf,
      participationHistoryOptions: participationOptions,
      visitFrequencyOptions: frequencyOptions,
      deadStockThresholdDays: Number(deadStockDays) || 30,
      connectedSpreadsheetId: isSuperAdmin
        ? (spreadsheetIdInput.trim() || settings.connectedSpreadsheetId || undefined)
        : settings.connectedSpreadsheetId,
    };

    // 1. Save data locally
    StorageService.saveSettings(updated);
    onUpdateSettings(updated);
    setIsSaved(true);

    // 2. Automatically sync book list to Google Sheet if super admin
    try {
      const token = await getAccessToken();
      if (!token) {
        setSyncStatusMsg({
          type: 'info',
          text: 'บันทึกการตั้งค่าเรียบร้อยแล้ว (เชื่อมต่อ Google ด้านล่างเพื่อซิงค์ข้อมูลไปยัง Google Sheet อัตโนมัติ)',
        });
        setTimeout(() => setIsSaved(false), 3000);
        return;
      }

      let targetId = updated.connectedSpreadsheetId;
      if (!targetId && isSuperAdmin) {
        targetId = await createBookSwapSpreadsheet(token);
        setSpreadsheetIdInput(targetId);
        const folderId = await getOrCreateBookCoversFolder(token);
        updated.connectedSpreadsheetId = targetId;
        updated.connectedDriveFolderId = folderId;
      }

      if (targetId) {
        await syncAllBooksToSheet(token, targetId, books);
        const allTx = StorageService.getTransactions();
        await syncAllTransactionsToSheet(token, targetId, allTx);

        updated.lastSyncTime = new Date().toISOString();
        StorageService.saveSettings(updated);
        onUpdateSettings(updated);

        setIsSyncSuccess(true);
        setTimeout(() => setIsSyncSuccess(false), 3500);
        setTimeout(() => setIsSaved(false), 3500);

        setSyncStatusMsg({
          type: 'success',
          text: `บันทึกข้อมูลและซิงค์หนังสือ (${books.length} เล่ม) พร้อมประวัติการแลกเปลี่ยน (${allTx.length} รายการ) สำเร็จ!`,
        });
      }
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
    if (!isSuperAdmin) {
      setSyncStatusMsg({
        type: 'error',
        text: `ไม่อนุญาต: เฉพาะผู้ที่เข้าสู่ระบบด้วย Google บัญชี ${ALLOWED_GOOGLE_ADMIN_EMAIL} เท่านั้นที่มีสิทธิ์สร้าง Google Spreadsheet ใหม่`,
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
        deadStockThresholdDays: Number(deadStockDays) || 30,
        connectedSpreadsheetId: newSheetId,
        connectedDriveFolderId: folderId,
        lastSyncTime: new Date().toISOString(),
      };
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
    if (!isSuperAdmin) {
      setSyncStatusMsg({
        type: 'error',
        text: `ไม่อนุญาต: เฉพาะผู้ที่เข้าสู่ระบบด้วย Google บัญชี ${ALLOWED_GOOGLE_ADMIN_EMAIL} เท่านั้นที่มีสิทธิ์แก้ไขและซิงค์ข้อมูล Google Sheet`,
      });
      return;
    }

    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      // Save current input values too
      const currentConfig: SystemSettings = {
        ...settings,
        categories,
        exchangeTerms,
        showWelcomeShelf,
        participationHistoryOptions: participationOptions,
        visitFrequencyOptions: frequencyOptions,
        deadStockThresholdDays: Number(deadStockDays) || 30,
        connectedSpreadsheetId: spreadsheetIdInput.trim() || settings.connectedSpreadsheetId || undefined,
      };
      StorageService.saveSettings(currentConfig);
      onUpdateSettings(currentConfig);

      const token = await getAccessToken();
      if (!token) {
        onConnectGoogle();
        throw new Error('กรุณาลงชื่อเข้าใช้ด้วย Google หรือเชื่อมต่อ Google ก่อนซิงค์');
      }

      let targetId = spreadsheetIdInput.trim() || currentConfig.connectedSpreadsheetId;
      if (!targetId) {
        // Automatically create a new Google Sheet if not configured yet
        targetId = await createBookSwapSpreadsheet(token);
        setSpreadsheetIdInput(targetId);
        const folderId = await getOrCreateBookCoversFolder(token);
        currentConfig.connectedSpreadsheetId = targetId;
        currentConfig.connectedDriveFolderId = folderId;
      }

      await syncAllBooksToSheet(token, targetId, books);
      const allTx = StorageService.getTransactions();
      await syncAllTransactionsToSheet(token, targetId, allTx);

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
        text: `ซิงค์ข้อมูลทั้งหมด (${books.length} เล่ม, ${allTx.length} ธุรกรรม) ไปยัง Google Sheets สำเร็จตามโครงสร้าง PDPA ล่าสุด!`,
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

      {/* 2. Sub-header Navigation Pill Bar + Action Buttons */}
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
            className="text-[#4D4D4D] hover:text-[#2A3B4C] px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer"
          >
            Book List
          </button>
          <button
            type="button"
            onClick={() => onSelectTab?.('settings')}
            className="bg-[#2A3B4C] text-white px-5 py-2 rounded-xl text-xs sm:text-sm font-medium shadow-xs transition-colors cursor-pointer"
          >
            ตั้งค่าระบบ
          </button>
        </div>

        {/* Action Buttons: ซิงค์ไป Google Sheet + บันทึกการตั้งค่า */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSyncCurrentBooksToGoogle}
            disabled={isSyncing}
            className="flex items-center gap-1.5 bg-[#2A3B4C] hover:bg-[#1E2B38] active:scale-[0.98] disabled:opacity-60 text-white px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-medium shadow-xs transition-all cursor-pointer tracking-tight"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>กำลังซิงค์...</span>
              </>
            ) : isSyncSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>ซิงค์สำเร็จแล้ว</span>
              </>
            ) : (
              <>
                <Cloud className="w-3.5 h-3.5 text-[#9ED8EB]" />
                <span>ซิงค์ไป Google Sheet</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-4 sm:px-5 py-2.5 bg-[#6A8852] hover:bg-[#5A7446] active:scale-[0.98] disabled:opacity-75 text-white font-medium text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer tracking-tight"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>กำลังบันทึกและซิงค์...</span>
              </>
            ) : isSaved && isSyncSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-200" />
                <span>บันทึกและซิงค์แล้ว</span>
              </>
            ) : isSaved ? (
              <>
                <Check className="w-4 h-4 text-emerald-200" />
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
      </div>

      <div className="space-y-4">
        {/* Google Sheets Card (Restricted strictly to lemontan9@gmail.com) */}
        <div className="bg-white rounded-3xl p-5 border border-[#E8ECF2] shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8ECF2] mb-3">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-[#4CAF4F]" />
              <h3 className="text-xs font-medium text-[#263238]">
                Google Sheets & Drive Database
              </h3>
            </div>
            {isSuperAdmin ? (
              <span className="text-[10px] font-medium text-[#2E7D32] bg-[#E8F5E9] px-2.5 py-1 rounded-full border border-[#4CAF4F]/30 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2E7D32]" />
                Super Admin ({ALLOWED_GOOGLE_ADMIN_EMAIL})
              </span>
            ) : googleConnected ? (
              <span className="text-[10px] font-medium text-[#D32F2F] bg-[#FFEBEE] px-2.5 py-1 rounded-full border border-[#FFCDD2] flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" />
                โหมดดูอย่างเดียว (จำกัดสิทธิ์แก้ไข)
              </span>
            ) : (
              <button
                onClick={onConnectGoogle}
                className="text-[11px] font-medium text-[#2E7D32] bg-[#E8F5E9] hover:bg-[#C8E6C9] px-2.5 py-1 rounded-full border border-[#4CAF4F]/20 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Lock className="w-3.5 h-3.5 text-[#2E7D32]" />
                เข้าสู่ระบบด้วย {ALLOWED_GOOGLE_ADMIN_EMAIL} เพื่อแก้ไข
              </button>
            )}
          </div>

          {/* Access Control Notice */}
          {!isSuperAdmin ? (
            <div className="p-3 bg-[#FFF8E1] border border-[#FFE082] rounded-2xl mb-3 text-xs text-[#8D6E14] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#F57C00] shrink-0" />
                <div>
                  <span className="font-semibold text-[#B26A00]">ล็อกการแก้ไข (Read-Only):</span>{' '}
                  <span>เฉพาะคนที่ Login ด้วย Google Account <strong>{ALLOWED_GOOGLE_ADMIN_EMAIL}</strong> เท่านั้นที่สามารถแก้ไขหรือสร้าง Google Sheet ในส่วนนี้ได้</span>
                </div>
              </div>
              {!googleConnected && (
                <button
                  type="button"
                  onClick={onConnectGoogle}
                  className="px-3 py-1 bg-[#F57C00] hover:bg-[#E65100] text-white text-[11px] font-medium rounded-xl shadow-xs shrink-0 cursor-pointer transition-colors"
                >
                  เข้าสู่ระบบด้วย Google
                </button>
              )}
            </div>
          ) : (
            <div className="p-2.5 bg-[#E8F5E9] border border-[#A5D6A7] rounded-2xl mb-3 text-xs text-[#1E5C3B] flex items-center gap-2 shadow-xs">
              <ShieldCheck className="w-4 h-4 text-[#2E7D32] shrink-0" />
              <span>
                ได้รับสิทธิ์: คุณเข้าสู่ระบบด้วย Google <strong>{ALLOWED_GOOGLE_ADMIN_EMAIL}</strong> (สามารถแก้ไข Spreadsheet ID และสร้างตาราง Google Sheet ได้)
              </span>
            </div>
          )}

          {syncStatusMsg && (
            <div
              className={`p-2.5 rounded-xl mb-3 text-[11px] flex items-center gap-1.5 ${
                syncStatusMsg.type === 'success'
                  ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#4CAF4F]/20'
                  : syncStatusMsg.type === 'info'
                    ? 'bg-[#EBF3FB] text-[#1E5C8B] border border-[#BBD8F5]'
                    : 'bg-[#FFEBEE] text-[#D32F2F] border border-[#FFCDD2]'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{syncStatusMsg.text}</span>
            </div>
          )}

          <div className="space-y-2 mb-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-medium text-[#263238]">
                  Spreadsheet ID
                </label>
                {!isSuperAdmin && (
                  <span className="text-[10px] text-[#8A7E74] flex items-center gap-1">
                    <Lock className="w-3 h-3 text-[#F57C00]" /> ล็อกการแก้ไข
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  readOnly={!isSuperAdmin}
                  placeholder={isSuperAdmin ? "Google Spreadsheet ID" : "Google Spreadsheet ID (ล็อกการแก้ไข)"}
                  value={spreadsheetIdInput}
                  onChange={(e) => isSuperAdmin && setSpreadsheetIdInput(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border border-[#E8ECF2] font-mono text-xs ${
                    isSuperAdmin
                      ? 'bg-[#F5F7FA] text-[#263238] focus:ring-1 focus:ring-[#4CAF4F]'
                      : 'bg-[#ECEFF1] text-[#78909C] cursor-not-allowed select-none'
                  }`}
                />
              </div>
            </div>
            {settings.connectedDriveFolderId && (
              <p className="text-[10px] text-[#717171] flex items-center gap-1 font-normal">
                <FolderOpen className="w-3.5 h-3.5 text-[#4CAF4F]" />
                โฟลเดอร์ปก: BookSwap_BookCovers
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              disabled={isSyncing || !isSuperAdmin}
              onClick={handleCreateNewGoogleSheet}
              title={
                !isSuperAdmin
                  ? `เฉพาะผู้ที่ Login ด้วย Google บัญชี ${ALLOWED_GOOGLE_ADMIN_EMAIL} เท่านั้นที่สามารถสร้าง Google Sheet ได้`
                  : undefined
              }
              className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-xl flex items-center justify-center gap-1 shadow-xs tracking-tight transition-all ${
                isSuperAdmin
                  ? 'text-white bg-[#2a3b4c] hover:bg-[#1e2b38] cursor-pointer'
                  : 'text-[#90A4AE] bg-[#CFD8DC] cursor-not-allowed opacity-80'
              }`}
            >
              {!isSuperAdmin ? <Lock className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              สร้าง Google Sheet ใหม่อัตโนมัติ {!isSuperAdmin && '(ล็อก)'}
            </button>
            <button
              disabled={isSyncing || !isSuperAdmin}
              onClick={handleSyncCurrentBooksToGoogle}
              title={
                !isSuperAdmin
                  ? `เฉพาะผู้ที่ Login ด้วย Google บัญชี ${ALLOWED_GOOGLE_ADMIN_EMAIL} เท่านั้นที่สามารถแก้ไข/ซิงค์ Google Sheet ได้`
                  : 'ระบบจะซิงค์อัตโนมัติเมื่อเพิ่มหรือ Match หนังสือ และสามารถกดปุ่มนี้เพื่อซิงค์ทันทีได้ตลอดเวลา'
              }
              className={`py-1.5 px-3 text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 border tracking-tight transition-colors ${
                isSuperAdmin
                  ? 'text-[#2E7D32] bg-[#E8F5E9] hover:bg-[#C8E6C9] border-[#4CAF4F]/30 cursor-pointer'
                  : 'text-[#90A4AE] bg-[#F5F5F5] border-[#E0E0E0] cursor-not-allowed opacity-80'
              }`}
            >
              {!isSuperAdmin ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              )}
              <span>ซิงค์ข้อมูลอัตโนมัติ {!isSuperAdmin && '(ล็อก)'}</span>
            </button>
          </div>

          <div className="mt-2.5 pt-2.5 border-t border-[#E8ECF2] flex items-center justify-between text-[11px] text-[#2E7D32]">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-[#4CAF4F] animate-pulse shrink-0" />
              ทำงานอัตโนมัติเมื่อเพิ่มหนังสือ หรือเมื่อ Match หนังสือ
            </span>
            <span className="text-[10px] text-[#717171] font-normal">
              สถานะ: เปิดใช้งาน
            </span>
          </div>
        </div>

        {/* Categories Card */}
        <div className="bg-white rounded-3xl p-5 border border-[#E8ECF2] shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-[#E8ECF2] mb-3">
            <Tag className="w-4 h-4 text-[#4CAF4F]" />
            <h3 className="text-xs font-medium text-[#263238]">
              จัดการหมวดหมู่หนังสือ
            </h3>
          </div>

          <form onSubmit={handleAddCategory} className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="หมวดหมู่ใหม่..."
              value={newCatInput}
              onChange={(e) => setNewCatInput(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-xl border border-[#E8ECF2] text-xs bg-[#F5F7FA] text-[#263238]"
            />
            <button
              type="submit"
              className="px-3.5 py-1 bg-[#2a3b4c] hover:bg-[#1e2b38] text-white font-medium text-xs rounded-xl cursor-pointer transition-colors tracking-tight"
            >
              เพิ่ม
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <div
                key={cat}
                style={{ backgroundColor: '#bfcee4' }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#bfcee4] border border-[#A2B8D8] text-xs font-medium text-[#1E3A5F]"
              >
                <span>{cat}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveCategory(cat)}
                  className="p-0.5 text-[#556987] hover:text-[#D32F2F] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* PDPA Dropdown 1: จัดการตัวเลือกการร่วมกิจกรรม */}
        <div className="bg-white rounded-3xl p-5 border border-[#E8ECF2] shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8ECF2] mb-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#4CAF4F]" />
              <h3 className="text-xs font-medium text-[#263238]">
                จัดการตัวเลือก: การร่วมกิจกรรม (แบบฟอร์ม Kiosk)
              </h3>
            </div>
            <span className="text-[10px] text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded-full border border-[#4CAF4F]/20 font-medium">
              PDPA Compliance
            </span>
          </div>

          <p className="text-[11px] text-[#717171] mb-3">
            ตัวเลือกสำหรับคำถาม &quot;การร่วมกิจกรรม&quot; ในขั้นตอนที่ 2 ของ Kiosk (ค่าเริ่มต้นหน้าตู้จะเป็นค่าว่าง)
          </p>

          <form onSubmit={handleAddParticipationOpt} className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="เพิ่มตัวเลือกการร่วมกิจกรรม..."
              value={newParticipationInput}
              onChange={(e) => setNewParticipationInput(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-xl border border-[#E8ECF2] text-xs bg-[#F5F7FA] text-[#263238]"
            />
            <button
              type="submit"
              className="px-3.5 py-1 bg-[#2a3b4c] hover:bg-[#1e2b38] text-white font-medium text-xs rounded-xl cursor-pointer transition-colors tracking-tight"
            >
              เพิ่ม
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {participationOptions.map((opt) => (
              <div
                key={opt}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F0F7F4] border border-[#CFE8DE] text-xs font-medium text-[#1E5C3B]"
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
        <div className="bg-white rounded-3xl p-5 border border-[#E8ECF2] shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8ECF2] mb-3">
            <div className="flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-[#4CAF4F]" />
              <h3 className="text-xs font-medium text-[#263238]">
                จัดการตัวเลือก: ในปีนี้ ท่านมาร่วมกิจกรรมแล้วกี่ครั้ง (แบบฟอร์ม Kiosk)
              </h3>
            </div>
            <span className="text-[10px] text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded-full border border-[#4CAF4F]/20 font-medium">
              PDPA Compliance
            </span>
          </div>

          <p className="text-[11px] text-[#717171] mb-3">
            ตัวเลือกสำหรับคำถาม &quot;ในปีนี้ ท่านมาร่วมกิจกรรมแล้วกี่ครั้ง&quot; ในขั้นตอนที่ 2 ของ Kiosk (ค่าเริ่มต้นหน้าตู้จะเป็นค่าว่าง)
          </p>

          <form onSubmit={handleAddFrequencyOpt} className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="เพิ่มตัวเลือกจำนวนครั้ง เช่น ครั้งที่ 6..."
              value={newFrequencyInput}
              onChange={(e) => setNewFrequencyInput(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-xl border border-[#E8ECF2] text-xs bg-[#F5F7FA] text-[#263238]"
            />
            <button
              type="submit"
              className="px-3.5 py-1 bg-[#2a3b4c] hover:bg-[#1e2b38] text-white font-medium text-xs rounded-xl cursor-pointer transition-colors tracking-tight"
            >
              เพิ่ม
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {frequencyOptions.map((opt) => (
              <div
                key={opt}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF5EE] border border-[#EADBCC] text-xs font-medium text-[#7A4B30]"
              >
                <span>{opt}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveFrequencyOpt(opt)}
                  className="p-0.5 text-[#8A7E74] hover:text-[#D32F2F] cursor-pointer"
                  title="ลบตัวเลือกนี้"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Rules Card */}
        <div className="bg-white rounded-3xl p-5 border border-[#E8ECF2] shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-[#E8ECF2] mb-3">
            <FileText className="w-4 h-4 text-[#4CAF4F]" />
            <h3 className="text-xs font-medium text-[#263238]">
              ข้อความเงื่อนไขและกติกา
            </h3>
          </div>

          <textarea
            rows={5}
            value={exchangeTerms}
            onChange={(e) => setExchangeTerms(e.target.value)}
            className="w-full p-3 rounded-2xl border border-[#E8ECF2] text-xs text-[#4D4D4D] bg-[#F5F7FA] font-normal"
          />

          <div className="mt-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showWelcomeShelf}
                onChange={(e) => setShowWelcomeShelf(e.target.checked)}
                className="w-4 h-4 text-[#4CAF4F] rounded focus:ring-[#4CAF4F]"
              />
              <span className="text-xs text-[#4D4D4D] font-normal">
                แสดงภาพหน้าปกหนังสือบนชั้นที่หน้าแรก
              </span>
            </label>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-[#717171] font-normal">เกณฑ์ Dead Stock:</span>
              <div className="flex items-center gap-1 font-mono">
                <input
                  type="number"
                  min="5"
                  value={deadStockDays}
                  onChange={(e) => setDeadStockDays(Number(e.target.value) || 30)}
                  className="w-12 px-1.5 py-0.5 border border-[#E8ECF2] rounded-lg text-center bg-[#F5F7FA] text-[#263238]"
                />
                <span className="text-[#717171]">วัน</span>
              </div>
            </div>
          </div>
        </div>

        {/* Book Code Policy Card (L & U strict uniqueness & non-reuse) */}
        <div className="bg-white rounded-3xl p-5 border border-[#E8ECF2] shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8ECF2] mb-3">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-[#4CAF4F]" />
              <h3 className="text-xs font-medium text-[#263238]">
                การกำหนดรหัสหนังสือ (Book Code Policy)
              </h3>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2E7D32] bg-[#E8F5E9] px-2.5 py-1 rounded-full border border-[#4CAF4F]/25">
              <ShieldCheck className="w-3.5 h-3.5 text-[#4CAF4F]" />
              ห้ามใช้รหัสซ้ำ 100%
            </span>
          </div>

          <p className="text-xs text-[#717171] mb-3 leading-relaxed">
            ระบบตั้งค่าให้หมายเลข Code ของหนังสือที่เพิ่มทั้งรหัส <strong>L</strong> (หนังสือส่วนกลาง) และรหัส <strong>U</strong> (หนังสือผู้แลก)
            เป็นตัวเลขที่ <strong>ห้ามซ้ำกัน</strong> และหากรหัสใดถูกใช้งานไปแล้ว จะถูกบันทึกประวัติไว้ถาวรและ <strong>ห้ามนำกลับมาใช้อีกอย่างเด็ดขาด</strong> แม้จะมีการลบหรือยกเลิกรายการ
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            {/* L Code Box */}
            <div className="p-3.5 rounded-2xl bg-[#FAF5EE] border border-[#EADBCC]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-[#263238]">
                  รหัสหนังสือส่วนกลาง (L Code)
                </span>
                <span className="font-mono font-bold text-xs bg-[#2A3B4C] text-white px-2 py-0.5 rounded-md">
                  {codeStats.nextLCode}
                </span>
              </div>
              <p className="text-[11px] text-[#8A7E74]">
                รหัสถัดไปที่จะเพิ่ม: <strong className="text-[#2A3B4C]">{codeStats.nextLCode}</strong> (นับต่อเนื่อง ห้ามซ้ำ)
              </p>
              <div className="mt-2 text-[10px] text-[#717171] flex items-center justify-between pt-1.5 border-t border-[#EADBCC]/60">
                <span>บันทึกรหัส L ในระบบ:</span>
                <span className="font-mono font-semibold text-[#263238]">{codeStats.usedLCodesCount} รหัส</span>
              </div>
            </div>

            {/* U Code Box */}
            <div className="p-3.5 rounded-2xl bg-[#F0F7F4] border border-[#CFE8DE]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-[#1E5C3B]">
                  รหัสหนังสือผู้แลก (U Code)
                </span>
                <span className="font-mono font-bold text-xs bg-[#2E7D32] text-white px-2 py-0.5 rounded-md">
                  {codeStats.nextUCode}
                </span>
              </div>
              <p className="text-[11px] text-[#55826A]">
                รหัสถัดไปที่จะเพิ่ม: <strong className="text-[#2E7D32]">{codeStats.nextUCode}</strong> (นับต่อเนื่อง ห้ามซ้ำ)
              </p>
              <div className="mt-2 text-[10px] text-[#717171] flex items-center justify-between pt-1.5 border-t border-[#CFE8DE]/60">
                <span>บันทึกรหัส U ในระบบ:</span>
                <span className="font-mono font-semibold text-[#263238]">{codeStats.usedUCodesCount} รหัส</span>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#F5F7FA] border border-[#E8ECF2] flex items-center justify-between text-[11px] text-[#4D4D4D]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#4CAF4F]" />
              สถานะการป้องกันรหัสซ้ำ: ทำงานสมบูรณ์ (Monotonic Non-reusable Registry)
            </span>
            <span className="font-medium text-[#263238]">
              รวมรหัสที่เคยใช้งาน: {codeStats.totalUsedCodes} เล่ม
            </span>
          </div>
        </div>

        {/* Staff Management */}
        <div className="bg-white rounded-3xl p-5 border border-[#E8ECF2] shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-[#E8ECF2] mb-3">
            <Users className="w-4 h-4 text-[#4CAF4F]" />
            <h3 className="text-xs font-medium text-[#263238]">
              จัดการสิทธิ์เจ้าหน้าที่
            </h3>
          </div>

          <form onSubmit={handleAddStaff} className="flex flex-col sm:flex-row gap-2 mb-3">
            <input
              type="text"
              placeholder="Username"
              value={newStaffUser}
              onChange={(e) => setNewStaffUser(e.target.value)}
              style={{ backgroundColor: '#e4d8c2' }}
              className="flex-1 px-3 py-1.5 rounded-xl border border-[#D8CABE] text-xs font-mono text-[#263238] placeholder-[#7A7168] focus:outline-none focus:ring-1 focus:ring-[#7A4B30]"
            />
            <input
              type="password"
              placeholder="Password"
              value={newStaffPassword}
              onChange={(e) => setNewStaffPassword(e.target.value)}
              style={{ backgroundColor: '#e4d8c2' }}
              className="flex-1 px-3 py-1.5 rounded-xl border border-[#D8CABE] text-xs text-[#263238] placeholder-[#7A7168] focus:outline-none focus:ring-1 focus:ring-[#7A4B30]"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#2A3B4C] hover:bg-[#1E2B38] text-white font-medium text-xs rounded-xl shadow-xs cursor-pointer transition-colors tracking-tight shrink-0 flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>เพิ่มเจ้าหน้าที่</span>
            </button>
          </form>

          <div className="divide-y divide-[#E8ECF2]">
            {staffList.map((s) => (
              <div key={s.username} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[#263238]">{s.username}</span>
                  <span className="text-[#8A7E74] text-[11px] font-mono">
                    (รหัสผ่าน: {s.password ? '•'.repeat(Math.min(s.password.length, 8)) : '••••'})
                  </span>
                </div>
                {s.username !== 'admin' && (
                  <button
                    type="button"
                    onClick={() => handleRemoveStaff(s.username)}
                    className="text-xs text-[#D32F2F] hover:underline cursor-pointer"
                  >
                    ลบ
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
