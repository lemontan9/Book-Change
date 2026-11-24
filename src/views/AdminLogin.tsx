import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertCircle, X } from 'lucide-react';
import { googleSignIn } from '../services/firebaseAuth';
import { StorageService } from '../services/storage';

interface AdminLoginProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (username: string) => Promise<void> | void;
  onGoogleConnected?: (user: any, token: string) => Promise<void> | void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onGoogleConnected,
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setIsLoadingGoogle(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsLoadingGoogle(true);
    setErrorMsg(null);
    try {
      const boundSheetId = StorageService.getSettings().connectedSpreadsheetId;
      const res = await googleSignIn(boundSheetId);
      if (res) {
        if (onGoogleConnected) {
          await onGoogleConnected(res.user, res.accessToken);
        }
        await onLoginSuccess(res.user.displayName || res.user.email || 'Google Admin');
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการลงชื่อเข้าใช้ด้วย Google');
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs font-sans">
      <div className="bg-[#FFFCF7] rounded-t-[28px] sm:rounded-[28px] w-full max-w-sm p-6 shadow-2xl border border-[#EAE0D2] relative">
        <div className="w-10 h-1 bg-[#E5D8C8] rounded-full mx-auto mb-3 sm:hidden" />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white border border-[#E5D8C8] flex items-center justify-center text-[#7E7369] hover:text-[#3E2723] cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-[#DCE7C4] flex items-center justify-center mx-auto mb-2.5 border border-[#C3D3A6]">
            <ShieldCheck className="w-6 h-6 text-[#4B5E26]" />
          </div>
          <h3 className="text-base font-bold text-[#4E342E]">
            เข้าสู่ระบบเจ้าหน้าที่
          </h3>
          <p className="text-[11px] text-[#7E7369] mt-0.5">
            ลงชื่อเข้าใช้ด้วย Google Mail เพื่อเชื่อมต่อและอัปเดต Google Sheet
          </p>
        </div>

        {errorMsg && (
          <div className="mb-3 p-3 rounded-2xl bg-[#FFF0F0] border border-[#FFCDCD] text-[11px] text-[#C62828] flex items-start gap-2 leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Google Mail Sign-In Only (Authorized Google Sheet Users) */}
        <div className="space-y-3.5">
          <div className="bg-[#F8F2E7] border border-[#E5D8C8] rounded-2xl p-3.5 text-xs text-[#4E342E] space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-[#5C3A21]">
              <ShieldCheck className="w-4 h-4 text-[#7D502E]" />
              <span>ลงชื่อเข้าใช้ด้วยบัญชี Google Mail เท่านั้น</span>
            </div>
            <p className="text-[11px] text-[#6D5C50] leading-relaxed">
              เฉพาะบัญชี Google Mail ที่มีสิทธิ์เข้าใช้งาน Google Sheet ที่ผูกกับระบบ เพื่อให้ซิงค์และอัปเดตข้อมูลหนังสืออัตโนมัติ (กรุณาติ๊กอนุญาตสิทธิ์ Google Sheets ในหน้าต่างยืนยันของ Google)
            </p>
            <div className="text-[10px] text-[#4B5E26] bg-[#DCE7C4] px-2.5 py-0.5 rounded-full font-semibold inline-block border border-[#C3D3A6]">
              ตรวจสอบสิทธิ์จาก Google Sheet ที่ผูกกับระบบอัตโนมัติ
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoadingGoogle}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-full border border-[#DDD0BF] bg-white hover:bg-[#F8F2E7] active:scale-[0.98] disabled:opacity-70 text-xs font-semibold text-[#3E2723] transition-all shadow-xs cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>
              {isLoadingGoogle ? 'กำลังตรวจสอบสิทธิ์ Google Sheet...' : 'ลงชื่อเข้าใช้ด้วย Google'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
