import React from 'react';
import {
  BookMarked,
  ShieldCheck,
  LogOut,
} from 'lucide-react';

interface NavbarProps {
  currentTab: 'kiosk' | 'dashboard' | 'books' | 'settings';
  onSelectTab: (tab: 'kiosk' | 'dashboard' | 'books' | 'settings') => void;
  onGoHome?: () => void;
  isAdminLoggedIn: boolean;
  adminUsername: string | null;
  onOpenAdminLogin: () => void;
  onAdminLogout: () => void;
  googleConnected: boolean;
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
}) => {
  return (
    <>
      {/* Mobile Top Header (Sticky Top App Bar) */}
      <header className="sticky top-0 z-40 bg-[#FAF5EE]/95 backdrop-blur-md text-[#332D29] shadow-xs border-b border-[#EADBCC]">
        <div className="max-w-md mx-auto sm:max-w-2xl lg:max-w-5xl px-4 h-14 flex items-center justify-between">
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
            className="flex items-center gap-2.5 cursor-pointer active:scale-95 transition-transform"
          >
            <div className="w-8 h-8 rounded-xl bg-[#EFE5D6] border border-[#E0D2BE] flex items-center justify-center text-[#7A4B30] shadow-xs">
              <BookMarked className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-[#7A4B30]">
                CMU Library :
              </div>
              <div className="text-[10px] text-[#8A7E74] font-medium -mt-1">
                Exchange Book Project
              </div>
            </div>
          </div>

          {/* Right Action: Admin Profile / Login trigger */}
          <div className="flex items-center gap-2">
            {googleConnected && (
              <span
                className="w-2.5 h-2.5 rounded-full bg-[#2E7D32] ring-2 ring-[#EBF5EE]"
                title="Google Sheets & Drive เชื่อมต่อแล้ว"
              />
            )}

            {isAdminLoggedIn ? (
              <div className="flex items-center gap-1.5 bg-[#F5E2CC] px-2.5 py-1 rounded-full text-xs font-medium text-[#7A4B30] border border-[#E0D2BE]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#7A4B30]" />
                <span className="max-w-[70px] truncate">{adminUsername || 'Admin'}</span>
                <button
                  onClick={onAdminLogout}
                  className="ml-1 text-[#8A7E74] hover:text-[#D32F2F] p-0.5 cursor-pointer"
                  title="ออกจากระบบ"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
    </>
  );
};
