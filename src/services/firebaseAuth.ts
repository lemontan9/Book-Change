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
provider.setCustomParameters({ prompt: 'select_account' });

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export interface SpreadsheetAccessResult {
  hasAccess: boolean;
  canEdit: boolean;
  title?: string;
  reason?: string;
}

/**
 * Verifies that the signed-in Google account has access (Editor permission)
 * to the Google Spreadsheet currently bound to the system.
 */
export async function verifySpreadsheetAccess(
  accessToken: string,
  spreadsheetId?: string
): Promise<SpreadsheetAccessResult> {
  const targetId =
    (spreadsheetId || '').trim() ||
    StorageService.getSettings().connectedSpreadsheetId ||
    ACTIVE_SPREADSHEET_ID;

  if (!targetId) {
    return {
      hasAccess: false,
      canEdit: false,
      reason: 'ยังไม่ได้ผูก Google Spreadsheet ID กับระบบ',
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
      };
    }

    if (metaRes.status === 403 || metaRes.status === 404) {
      return {
        hasAccess: false,
        canEdit: false,
        reason:
          'บัญชี Google นี้ไม่มีสิทธิ์เข้าถึง Google Sheet ที่ผูกกับระบบ กรุณาติดต่อผู้ดูแลเพื่อขอสิทธิ์แชร์ (Editor) บนไฟล์ Google Sheet',
      };
    }

    if (!metaRes.ok) {
      const errJson = await metaRes.json().catch(() => null);
      return {
        hasAccess: false,
        canEdit: false,
        reason:
          errJson?.error?.message ||
          'ไม่สามารถตรวจสอบสิทธิ์การเข้าถึง Google Sheet ที่ผูกกับระบบได้',
      };
    }

    const metaData = await metaRes.json().catch(() => ({}));
    const sheetTitle: string | undefined = metaData?.properties?.title;

    // 2. Non-mutating Editor ACL check via empty batchUpdate requests array.
    // Google Sheets API enforces write ACL (403) before validating empty requests (200/400).
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

    if (editCheckRes.status === 403) {
      return {
        hasAccess: false,
        canEdit: false,
        title: sheetTitle,
        reason:
          'บัญชี Google นี้มีสิทธิ์เพียงอ่านอย่างเดียว (Viewer) กรุณาขอสิทธิ์ผู้แก้ไข (Editor) บน Google Sheet ที่ผูกกับระบบก่อนเข้าสู่ระบบ',
      };
    }

    if (editCheckRes.status === 401) {
      return {
        hasAccess: false,
        canEdit: false,
        title: sheetTitle,
        reason: 'สิทธิ์การเชื่อมต่อ Google หมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
      };
    }

    // 200 OK or 400 INVALID_ARGUMENT (empty requests after passing ACL check) confirms Editor/Owner access
    if (editCheckRes.ok || editCheckRes.status === 400) {
      return {
        hasAccess: true,
        canEdit: true,
        title: sheetTitle,
      };
    }

    return {
      hasAccess: false,
      canEdit: false,
      title: sheetTitle,
      reason: 'ไม่สามารถยืนยันสิทธิ์การแก้ไข Google Sheet ที่ผูกกับระบบได้',
    };
  } catch (err: any) {
    console.error('Spreadsheet access verification error:', err);
    return {
      hasAccess: false,
      canEdit: false,
      reason: 'เกิดข้อผิดพลาดระหว่างตรวจสอบสิทธิ์ Google Sheet กรุณาลองใหม่อีกครั้ง',
    };
  }
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (
  spreadsheetId?: string
): Promise<{ user: User; accessToken: string; spreadsheetTitle?: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const email = result.user.email?.toLowerCase().trim();

    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      await signOut(auth);
      cachedAccessToken = null;
      throw new Error('ไม่สามารถรับสิทธิ์ OAuth Access Token จาก Google ได้');
    }

    const accessCheck = await verifySpreadsheetAccess(credential.accessToken, spreadsheetId);
    if (!accessCheck.hasAccess) {
      await signOut(auth);
      cachedAccessToken = null;
      throw new Error(
        `${accessCheck.reason} (บัญชีที่คุณใช้คือ ${email || 'ไม่ระบุ'})`
      );
    }

    cachedAccessToken = credential.accessToken;
    return {
      user: result.user,
      accessToken: cachedAccessToken,
      spreadsheetTitle: accessCheck.title,
    };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
