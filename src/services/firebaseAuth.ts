import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { ACTIVE_SPREADSHEET_ID, StorageService } from './storage';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account consent',
  include_granted_scopes: 'true',
});

const OAUTH_SESSION_KEY = 'bookswap_google_oauth_session_v1';
// Google OAuth access tokens expire after 60 minutes; treat as expired at 55 minutes for safety
const TOKEN_TTL_MS = 55 * 60 * 1000;

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedTokenExpiresAt: number | null = null;

function saveSessionToken(token: string, email?: string | null) {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  cachedAccessToken = token;
  cachedTokenExpiresAt = expiresAt;
  try {
    sessionStorage.setItem(
      OAUTH_SESSION_KEY,
      JSON.stringify({ token, expiresAt, email: email || '' })
    );
  } catch {
    // ignore storage quota errors
  }
}

function loadSessionToken(): { token: string; expiresAt: number; email?: string } | null {
  if (cachedAccessToken && cachedTokenExpiresAt && Date.now() < cachedTokenExpiresAt) {
    return { token: cachedAccessToken, expiresAt: cachedTokenExpiresAt };
  }
  try {
    const raw = sessionStorage.getItem(OAUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.token === 'string' &&
      parsed.token.length > 0 &&
      typeof parsed?.expiresAt === 'number' &&
      Date.now() < parsed.expiresAt
    ) {
      cachedAccessToken = parsed.token;
      cachedTokenExpiresAt = parsed.expiresAt;
      return { token: parsed.token, expiresAt: parsed.expiresAt, email: parsed.email };
    }
    sessionStorage.removeItem(OAUTH_SESSION_KEY);
  } catch {
    // ignore
  }
  cachedAccessToken = null;
  cachedTokenExpiresAt = null;
  return null;
}

export function invalidateAccessToken(): void {
  cachedAccessToken = null;
  cachedTokenExpiresAt = null;
  try {
    sessionStorage.removeItem(OAUTH_SESSION_KEY);
  } catch {
    // ignore
  }
}

export function getTokenExpiresAt(): number | null {
  const session = loadSessionToken();
  return session ? session.expiresAt : null;
}

export interface SpreadsheetAccessResult {
  hasAccess: boolean;
  canEdit: boolean;
  title?: string;
  reason?: string;
  errorCode?: 'SCOPE_MISSING' | 'TOKEN_EXPIRED' | 'NO_SHEET_ACCESS' | 'UNKNOWN';
}

function isInsufficientScopeError(errJson: any): boolean {
  const status = String(errJson?.error?.status || '').toUpperCase();
  const message = String(errJson?.error?.message || '').toLowerCase();
  const details = Array.isArray(errJson?.error?.details) ? errJson.error.details : [];
  const hasScopeDetail = details.some(
    (d: any) =>
      String(d?.reason || '').toUpperCase() === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' ||
      String(d?.message || '').toLowerCase().includes('insufficient')
  );
  return (
    hasScopeDetail ||
    status === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' ||
    message.includes('insufficient authentication scopes') ||
    message.includes('insufficient permission')
  );
}

/**
 * Verifies that the signed-in Google account has access to the Google Spreadsheet
 * currently bound to the system, and detects whether the account has Editor permission.
 */
export async function verifySpreadsheetAccess(
  accessToken: string,
  spreadsheetId?: string
): Promise<SpreadsheetAccessResult> {
  const rawId =
    (spreadsheetId || '').trim() ||
    StorageService.getSettings().connectedSpreadsheetId ||
    ACTIVE_SPREADSHEET_ID;

  const targetId =
    rawId && !rawId.startsWith('172FuZL2') ? rawId : ACTIVE_SPREADSHEET_ID;

  if (!targetId) {
    return {
      hasAccess: false,
      canEdit: false,
      reason: 'ยังไม่ได้ผูก Google Spreadsheet ID กับระบบ',
      errorCode: 'NO_SHEET_ACCESS',
    };
  }

  try {
    // 1. Check read access to the bound Google Sheet
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(targetId)}?fields=spreadsheetId,properties.title`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (metaRes.status === 401) {
      return {
        hasAccess: false,
        canEdit: false,
        reason: 'สิทธิ์การเชื่อมต่อ Google หมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
        errorCode: 'TOKEN_EXPIRED',
      };
    }

    if (!metaRes.ok) {
      const errJson = await metaRes.json().catch(() => null);
      if (metaRes.status === 403 && isInsufficientScopeError(errJson)) {
        return {
          hasAccess: false,
          canEdit: false,
          reason:
            'ยังไม่ได้ติ๊กอนุญาตสิทธิ์เข้าถึง Google Sheets ในหน้าต่างยืนยันของ Google กรุณากดลงชื่อเข้าใช้อีกครั้งแล้วติ๊กเลือกสิทธิ์ Google Sheets ให้ครบก่อนกด Continue',
          errorCode: 'SCOPE_MISSING',
        };
      }

      if (metaRes.status === 403 || metaRes.status === 404) {
        return {
          hasAccess: false,
          canEdit: false,
          reason:
            'บัญชี Google นี้ไม่มีสิทธิ์เข้าถึง Google Sheet ที่ผูกกับระบบ กรุณาตรวจสอบว่าได้แชร์ไฟล์ Google Sheet (สิทธิ์ Editor) ให้กับอีเมลนี้แล้ว',
          errorCode: 'NO_SHEET_ACCESS',
        };
      }

      return {
        hasAccess: false,
        canEdit: false,
        reason:
          errJson?.error?.message ||
          'ไม่สามารถตรวจสอบสิทธิ์การเข้าถึง Google Sheet ที่ผูกกับระบบได้',
        errorCode: 'UNKNOWN',
      };
    }

    const metaData = await metaRes.json().catch(() => ({}));
    const sheetTitle: string | undefined = metaData?.properties?.title;

    // 2. Non-mutating Editor ACL probe via empty batchUpdate requests array.
    // Google Sheets API checks write ACL before validating empty requests (200/400).
    // Even if account is Viewer (403 PERMISSION_DENIED), allow login with canEdit: false
    // so staff with Sheet access can still log in and sync data without being locked out.
    let canEdit = true;
    try {
      const editCheckRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(targetId)}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requests: [] }),
        }
      );

      if (editCheckRes.status === 401) {
        return {
          hasAccess: false,
          canEdit: false,
          title: sheetTitle,
          reason: 'สิทธิ์การเชื่อมต่อ Google หมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
          errorCode: 'TOKEN_EXPIRED',
        };
      }

      if (editCheckRes.status === 403) {
        const editErrJson = await editCheckRes.json().catch(() => null);
        if (isInsufficientScopeError(editErrJson)) {
          return {
            hasAccess: false,
            canEdit: false,
            title: sheetTitle,
            reason:
              'ยังไม่ได้ติ๊กอนุญาตสิทธิ์แก้ไข Google Sheets กรุณากดลงชื่อเข้าใช้อีกครั้งและติ๊กเลือกสิทธิ์ทั้งหมดในหน้าต่างของ Google',
            errorCode: 'SCOPE_MISSING',
          };
        }
        // Account has valid read access to the Sheet (metaRes succeeded), just not Editor
        canEdit = false;
      } else {
        canEdit = editCheckRes.ok || editCheckRes.status === 400;
      }
    } catch (probeErr) {
      console.warn('Non-fatal Editor ACL probe error:', probeErr);
      canEdit = true;
    }

    return {
      hasAccess: true,
      canEdit,
      title: sheetTitle,
    };
  } catch (err: any) {
    console.error('Spreadsheet access verification error:', err);
    return {
      hasAccess: false,
      canEdit: false,
      reason: 'เกิดข้อผิดพลาดระหว่างตรวจสอบสิทธิ์ Google Sheet กรุณาลองใหม่อีกครั้ง',
      errorCode: 'UNKNOWN',
    };
  }
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const session = loadSessionToken();
      if (session?.token) {
        if (onAuthSuccess) onAuthSuccess(user, session.token);
      } else if (!isSigningIn) {
        invalidateAccessToken();
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      invalidateAccessToken();
      if (onAuthFailure) onAuthFailure();
    }
  });
};

function formatFirebaseAuthError(error: any): string {
  const code = String(error?.code || '');
  const msg = String(error?.message || '');

  if (code === 'auth/popup-blocked') {
    return 'เบราว์เซอร์บล็อกหน้าต่าง Pop-up กรุณาอนุญาต Pop-up สำหรับเว็บไซต์นี้แล้วกดลงชื่อเข้าใช้อีกครั้ง';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'หน้าต่างลงชื่อเข้าใช้ Google ถูกปิดก่อนเสร็จสิ้น — หากหน้า Google แจ้ง "Access blocked / Error 403" ผู้ดูแลระบบต้องเพิ่มอีเมลเจ้าหน้าที่ใน Test users หรือกด Publish App ใน Google Cloud Console (OAuth consent screen) ก่อน';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'โดเมนของเว็บไซต์นี้ยังไม่ได้รับอนุญาตใน Firebase Authentication (Authorized domains) กรุณาติดต่อผู้ดูแลระบบ';
  }
  if (code === 'auth/network-request-failed') {
    return 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ Google ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่';
  }
  if (msg.toLowerCase().includes('access_denied')) {
    return 'Google ปฏิเสธการเข้าสู่ระบบ (access_denied) — หากอีเมลนี้ไม่ใช่บัญชีผู้สร้างแอป กรุณาให้ผู้ดูแลเพิ่มอีเมลใน Test users หรือ Publish App ใน Google Cloud Console';
  }
  return msg || 'เกิดข้อผิดพลาดในการลงชื่อเข้าใช้ด้วย Google';
}

export const googleSignIn = async (
  spreadsheetId?: string
): Promise<{ user: User; accessToken: string; spreadsheetTitle?: string; canEdit?: boolean } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const email = result.user.email?.toLowerCase().trim();

    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      await signOut(auth);
      invalidateAccessToken();
      throw new Error('ไม่สามารถรับสิทธิ์ OAuth Access Token จาก Google ได้');
    }

    const accessCheck = await verifySpreadsheetAccess(credential.accessToken, spreadsheetId);
    if (!accessCheck.hasAccess) {
      await signOut(auth);
      invalidateAccessToken();
      throw new Error(
        `${accessCheck.reason} (บัญชีที่คุณใช้คือ ${email || 'ไม่ระบุ'})`
      );
    }

    saveSessionToken(credential.accessToken, email);
    return {
      user: result.user,
      accessToken: credential.accessToken,
      spreadsheetTitle: accessCheck.title,
      canEdit: accessCheck.canEdit,
    };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    const friendlyMessage = error?.code ? formatFirebaseAuthError(error) : error?.message || formatFirebaseAuthError(error);
    throw new Error(friendlyMessage);
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  const session = loadSessionToken();
  return session ? session.token : null;
};

export const logout = async () => {
  await signOut(auth);
  invalidateAccessToken();
};
