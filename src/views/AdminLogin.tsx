import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, User, AlertCircle, X } from 'lucide-react';
import { googleSignIn } from '../services/firebaseAuth';
import { StorageService } from '../services/storage';

interface AdminLoginProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (username: string) => void;
  onGoogleConnected?: (user: any, token: string) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onGoogleConnected,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUsername('');
      setPassword('');
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const staff = StorageService.getStaff();
    const u = username.trim();
    const p = password.trim();

    const matchedStaff = staff.find(
      (s) =>
        s.username === u &&
        (s.password === p || (!s.password && (u === 'admin' && p === 'admin')))
    );

    if (matchedStaff || (u === 'admin' && p === 'admin')) {
      onLoginSuccess(u);
      onClose();
    } else {
      setErrorMsg('Username หรือ Password ไม่ถูกต้อง');
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoadingGoogle(true);
    setErrorMsg(null);
    try {
      const res = await googleSignIn();
      if (res) {
        if (onGoogleConnected) {
          onGoogleConnected(res.user, res.accessToken);
        }
        onLoginSuccess(res.user.displayName || res.user.email || 'Google Admin');
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
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6 shadow-xl border border-[#E8ECF2] relative animate-in slide-in-from-bottom-5">
        <div className="w-10 h-1 bg-[#E8ECF2] rounded-full mx-auto mb-3 sm:hidden" />
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1 text-[#717171] hover:text-[#263238]"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-[#E8F5E9] flex items-center justify-center text-[#4CAF4F] mx-auto mb-2 border border-[#4CAF4F]/20">
            <ShieldCheck className="w-6 h-6 bg-white rounded-md" />
          </div>
          <h3 className="text-base font-medium text-[#263238]">
            เข้าสู่ระบบเจ้าหน้าที่
          </h3>
          <p className="text-[11px] text-[#717171] mt-0.5 font-normal">
            จัดการคลังหนังสือ สถิติ และ Google Sheets
          </p>
        </div>

        {errorMsg && (
          <div className="mb-3 p-2.5 rounded-xl bg-[#FFEBEE] border border-[#FFCDD2] text-[11px] text-[#D32F2F] flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleTestLogin} className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-[#263238] mb-1">
              Username
            </label>
            <div className="relative">
              <User className="w-3.5 h-3.5 text-[#717171] absolute left-3 top-3" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="กรอกชื่อผู้ใช้งาน"
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#E8ECF2] text-xs font-mono bg-[#F5F7FA] text-[#263238] focus:outline-hidden focus:ring-1 focus:ring-[#4CAF4F]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#263238] mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-[#717171] absolute left-3 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่าน"
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#E8ECF2] text-xs font-mono bg-[#F5F7FA] text-[#263238] focus:outline-hidden focus:ring-1 focus:ring-[#4CAF4F]"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-1.5 bg-[#2a3b4c] hover:bg-[#1e2b38] text-white font-medium text-xs rounded-xl shadow-xs transition-colors cursor-pointer tracking-tight"
          >
            เข้าสู่ระบบ
          </button>
        </form>

        <div className="relative my-4 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#E8ECF2]" />
          </div>
          <span className="relative bg-white px-2 text-[10px] text-[#717171]">
            หรือเชื่อมต่อบัญชี Google
          </span>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoadingGoogle}
          className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl border border-[#E8ECF2] hover:bg-[#F5F7FA] text-xs font-medium text-[#4D4D4D] transition-colors tracking-tight"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
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
          {isLoadingGoogle ? 'กำลังเชื่อมต่อ...' : 'ลงชื่อเข้าใช้ด้วย Google'}
        </button>
      </div>
    </div>
  );
};
