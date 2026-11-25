import React from 'react';
import { ShieldCheck, LogOut, BookOpen, LayoutDashboard, AlertTriangle, RefreshCw } from 'lucide-react';

interface NavbarProps {
  currentTab: 'kiosk' | 'dashboard' | 'books' | 'settings';
  onSelectTab: (tab: 'kiosk' | 'dashboard' | 'books' | 'settings') => void;
  onGoHome?: () => void;
  isAdminLoggedIn: boolean;
  adminUsername: string | null;
  onOpenAdminLogin: () => void;
  onAdminLogout: () => void;
  googleConnected: boolean;
  pendingSyncCount?: number;
  isSyncingPending?: boolean;
  onSyncPendingNow?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onGoHome,
  isAdminLoggedIn,
  adminUsername,
  onOpenAdminLogin,
  onAdminLogout,
  googleConnected,
  pendingSyncCount = 0,
  isSyncingPending = false,
  onSyncPendingNow,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#FAF3E6]/75 backdrop-blur-md text-[#3A2D26] border-b border-[#EAE0D2]/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Slot */}
        <div
          onClick={() => {
            if (onGoHome) {
              onGoHome();
            } else {
              onSelectTab('kiosk');
            }
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (onGoHome) onGoHome();
              else onSelectTab('kiosk');
            }
          }}
          className="flex items-center gap-3 cursor-pointer active:scale-95 transition-transform shrink-0"
        >
          {/* CMU Library Logo */}
          <div className="h-9 sm:h-10 flex items-center shrink-0">
            <img
              src="/assets/aistudio/image_f1c30ab4.png"
              alt="CMU Library Logo"
              className="h-8 sm:h-9 w-auto object-contain"
            />
          </div>
          <div className="flex items-center">
            <div className="text-[22px] text-[#753f0c] font-bold whitespace-nowrap">
              Exchange Book Project
            </div>
          </div>
        </div>

        {/* Right Action: Honest Google Sheet Sync Status + Mode Switcher + Staff Login Pill */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {pendingSyncCount > 0 ? (
            <button
              type="button"
              disabled={isSyncingPending}
              onClick={() => {
                if (googleConnected && onSyncPendingNow) {
                  onSyncPendingNow();
                } else {
                  onOpenAdminLogin();
                }
              }}
              className="flex items-center gap-1.5 bg-[#FFF3CD] hover:bg-[#FFE8A3] text-[#8A4B08] border border-[#EBC76D] px-3 py-1.5 rounded-full text-xs font-semibold shadow-2xs transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="มีรายการแลกที่ค้างส่งขึ้น Google Sheet คลิกเพื่อเชื่อมต่อ Google Mail และซิงค์ทันที"
            >
              {isSyncingPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
              )}
              <span>
                {isSyncingPending
                  ? 'กำลังส่งขึ้น Sheet...'
                  : `ค้างส่ง Sheet (${pendingSyncCount})`}
              </span>
            </button>
          ) : googleConnected ? (
            <span
              className="inline-flex items-center gap-1.5 bg-[#E8F5E9] text-[#1E5631] border border-[#C8E6C9] px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0"
              title="เชื่อมต่อ Google Mail เรียบร้อย พร้อมบันทึกข้อมูลลง Google Sheet อัตโนมัติ"
            >
              <span className="w-2 h-2 rounded-full bg-[#388E3C] shrink-0" />
              <span className="hidden sm:inline">Sheet พร้อมบันทึก</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={onOpenAdminLogin}
              className="inline-flex items-center gap-1.5 bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] border border-[#F5D08A] px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer shrink-0"
              title="ยังไม่ได้ลงชื่อเข้าใช้ Google Mail (หรือสิทธิ์ครบ 1 ชม.) คลิกเพื่อเชื่อมต่อสิทธิ์บันทึก Google Sheet"
            >
              <span className="w-2 h-2 rounded-full bg-[#D97706] shrink-0" />
              <span className="hidden sm:inline">ยังไม่เชื่อมสิทธิ์บันทึก Sheet</span>
            </button>
          )}

          {isAdminLoggedIn && (
            currentTab === 'kiosk' ? (
              <button
                type="button"
                onClick={() => onSelectTab('dashboard')}
                className="flex items-center gap-1.5 bg-[#7D502E] hover:bg-[#653F22] active:scale-95 text-white px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
                title="สลับไปหน้า Dashboard เจ้าหน้าที่"
              >
                <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
                <span>หน้าเจ้าหน้าที่ (Dashboard)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSelectTab('kiosk')}
                className="flex items-center gap-1.5 bg-[#4B5E26] hover:bg-[#3B4B1D] active:scale-95 text-white px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
                title="กลับไปใช้งานหน้าแลกเปลี่ยนหนังสือ"
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span>แลกเปลี่ยนหนังสือ</span>
              </button>
            )
          )}

          {isAdminLoggedIn ? (
            <div className="flex items-center gap-1.5 bg-[#F3E7D3] px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#5C3A21] border border-[#E0CEB5] shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-[#5C3A21] shrink-0" />
              <span>Staff</span>
              <button
                type="button"
                onClick={onAdminLogout}
                className="ml-1 text-[#7E7369] hover:text-[#D32F2F] p-0.5 cursor-pointer transition-colors"
                title="ออกจากระบบ"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAdminLogin}
              className="flex items-center gap-2 bg-[#F3E7D3] hover:bg-[#EAD9BE] active:scale-95 text-[#5C3A21] border border-[#E0CEB5] px-4 py-2 rounded-full text-xs font-semibold shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Staff Login"
            >
              <ShieldCheck className="w-4 h-4 text-[#5C3A21] shrink-0" />
              <span>Staff Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
