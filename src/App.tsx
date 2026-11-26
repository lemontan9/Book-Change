import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, UploadCloud } from 'lucide-react';
import type { Book, SystemSettings, TransactionRecord } from './types';
import { StorageService } from './services/storage';
import {
  initAuth,
  logout,
  getAccessToken,
  invalidateAccessToken,
  getTokenExpiresAt,
  getSavedStaffSession,
} from './services/firebaseAuth';
import {
  SheetApiError,
  appendBookToSheet,
  appendTransactionsToSheet,
  syncAllBooksToSheet,
  syncAllTransactionsToSheet,
  createBookSwapSpreadsheet,
  fetchBooksFromSheet,
  fetchTransactionsFromSheet,
  fetchSettingsFromSheet,
  getEffectiveAppsScriptUrl,
  recordTransactionViaAppsScript,
  upsertBooksViaAppsScript,
  syncAllViaAppsScript,
} from './services/googleSheets';
import { getOrCreateBookCoversFolder, uploadCoverImageToDrive } from './services/googleDrive';
import { Navbar } from './components/Navbar';
import { KioskView } from './views/KioskView';
import { AdminDashboard } from './views/AdminDashboard';
import { AdminBookList } from './views/AdminBookList';
import { AdminSettings } from './views/AdminSettings';
import { AdminLogin } from './views/AdminLogin';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'kiosk' | 'dashboard' | 'books' | 'settings'>('kiosk');
  const [kioskKey, setKioskKey] = useState<number>(0);

  // Application Data Stores
  const [books, setBooks] = useState<Book[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(StorageService.getSettings());
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);

  // Auth State (restored synchronously from persisted staff session so login stays remembered until manual logout)
  const [initialStaffSession] = useState(() => getSavedStaffSession());
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() =>
    Boolean(initialStaffSession)
  );
  const [adminUsername, setAdminUsername] = useState<string | null>(
    () => initialStaffSession?.email || initialStaffSession?.displayName || null
  );
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Google Workspace state
  const [googleUser, setGoogleUser] = useState<any | null>(() => initialStaffSession);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  // Persistent Pending Sync state (guarantees zero data loss even if token expires after 1 hr or browser refreshes)
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() =>
    StorageService.getPendingSyncCount()
  );
  const [isFlushingPending, setIsFlushingPending] = useState<boolean>(false);
  const [syncBanner, setSyncBanner] = useState<{
    type: 'warning' | 'error' | 'success';
    text: string;
  } | null>(null);

  // Track in-flight Sheet writes so subsequent pulls always wait for writes to complete first
  const pendingSyncRef = useRef<Promise<any> | null>(null);
  // Keep user on Kiosk screen when they sign in with Google Mail from Kiosk/Sync Banner
  const stayOnKioskAfterLoginRef = useRef<boolean>(false);

  const getActiveSpreadsheetId = useCallback(() => {
    const currentSettings = StorageService.getSettings();
    return (
      (currentSettings.connectedSpreadsheetId &&
      !currentSettings.connectedSpreadsheetId.startsWith('172FuZL2')
        ? currentSettings.connectedSpreadsheetId.trim()
        : '') || '1ppG2ExLSTl5pb1TS47pW2aNvqMVID8qvXwrB3_uOSm0'
    );
  }, []);

  /**
   * Flushes ALL queued unsynced Kiosk transactions, new U books, and matched status updates
   * to Google Sheets using safe Merge-Before-Write (never overwrites other Kiosks' rows,
   * and ONLY clears the local pending queue after BOTH Books & Transactions return HTTP 200 OK).
   */
  const flushPendingSyncToGoogleSheet = useCallback(
    async (
      tokenOverride?: string | null
    ): Promise<{ synced: boolean; count: number; reason?: 'no_auth' | 'error'; error?: string }> => {
      if (!StorageService.hasPendingSync()) {
        setPendingSyncCount(0);
        return { synced: true, count: 0 };
      }

      const spreadsheetId = getActiveSpreadsheetId();
      const appsScriptUrl = getEffectiveAppsScriptUrl(StorageService.getSettings());

      // PATH 1 (Preferred): Write directly via Google Apps Script Web App Bridge
      // Zero unverified-app warning, zero 404 errors on existing Sheets, zero 1-hour token expiration!
      if (appsScriptUrl) {
        setIsFlushingPending(true);
        try {
          const currentQueue = StorageService.getPendingSyncQueue();
          const pendingCountBefore = StorageService.getPendingSyncCount();
          const optionalToken =
            tokenOverride !== undefined
              ? tokenOverride
              : googleToken || (await getAccessToken().catch(() => null));

          // Optional cover upload to Drive only when a data:image cover & token exist
          const needsDriveUpload = currentQueue.addedBooks.some(
            (b) => b.coverImage && b.coverImage.startsWith('data:image') && !b.driveFileId
          );
          if (needsDriveUpload && optionalToken) {
            try {
              let folderId = StorageService.getSettings().connectedDriveFolderId;
              if (!folderId) {
                folderId = await getOrCreateBookCoversFolder(optionalToken);
                const updated = { ...StorageService.getSettings(), connectedDriveFolderId: folderId };
                StorageService.saveSettings(updated);
                setSettings(updated);
              }
              let queueModified = false;
              for (const b of currentQueue.addedBooks) {
                if (b.coverImage && b.coverImage.startsWith('data:image') && !b.driveFileId) {
                  try {
                    const driveRes = await uploadCoverImageToDrive(
                      optionalToken,
                      folderId,
                      `${b.code}_${b.title.slice(0, 20)}.jpg`,
                      b.coverImage
                    );
                    b.driveFileId = driveRes.fileId;
                    queueModified = true;
                  } catch (e) {
                    console.warn('Cover drive upload non-fatal:', e);
                  }
                }
              }
              if (queueModified) {
                StorageService.savePendingSyncQueue(currentQueue);
              }
            } catch (driveErr) {
              console.warn('Optional Drive cover upload skipped:', driveErr);
            }
          }

          await recordTransactionViaAppsScript(
            appsScriptUrl,
            spreadsheetId,
            currentQueue.transactions,
            currentQueue.addedBooks,
            currentQueue.updatedBooks
          );

          // Confirmed saved on Google Sheet -> clear pending queue and pull freshest merged state
          StorageService.clearPendingSyncQueue();
          setPendingSyncCount(0);

          try {
            const [freshBooks, freshTx] = await Promise.all([
              fetchBooksFromSheet(null, spreadsheetId),
              fetchTransactionsFromSheet(null, spreadsheetId).catch(() => StorageService.getTransactions()),
            ]);
            const sortedBooks = StorageService.sortBooks(freshBooks);
            StorageService.saveBooks(sortedBooks);
            StorageService.syncUsedCodesFromBooks(sortedBooks);
            StorageService.saveTransactions(freshTx);
            setBooks(sortedBooks);
            setTransactions(freshTx);
          } catch (refreshErr) {
            console.warn('Post-AppsScript refresh non-fatal:', refreshErr);
          }

          const finalSettings: SystemSettings = {
            ...StorageService.getSettings(),
            connectedSpreadsheetId: spreadsheetId,
            lastSyncTime: new Date().toISOString(),
          };
          StorageService.saveSettings(finalSettings);
          setSettings(finalSettings);

          setSyncBanner({
            type: 'success',
            text: `บันทึกข้อมูลขึ้น Google Sheet (Books และ Transactions) สำเร็จแล้ว (${pendingCountBefore} รายการ)`,
          });
          setTimeout(() => {
            setSyncBanner((prev) => (prev?.type === 'success' ? null : prev));
          }, 6000);

          return { synced: true, count: pendingCountBefore };
        } catch (err: any) {
          console.error('Apps Script pending-queue flush failed:', err);
          const friendlyError =
            err?.message ||
            'ไม่สามารถส่งข้อมูลขึ้น Google Sheet ผ่าน Apps Script ได้ (ข้อมูลยังถูกสำรองไว้ในเครื่องอย่างปลอดภัย)';
          StorageService.setPendingSyncError(friendlyError);
          const remaining = StorageService.getPendingSyncCount();
          setPendingSyncCount(remaining);
          setSyncBanner({
            type: 'error',
            text: `${friendlyError} (ค้างส่ง ${remaining} รายการ)`,
          });
          return { synced: false, count: remaining, reason: 'error', error: friendlyError };
        } finally {
          setIsFlushingPending(false);
        }
      }

      // PATH 2 (Fallback): OAuth Sheets API (for sheets created by this app with drive.file)
      const token =
        tokenOverride !== undefined
          ? tokenOverride
          : googleToken || (await getAccessToken().catch(() => null));

      if (!token) {
        const count = StorageService.getPendingSyncCount();
        const msg =
          'ยังไม่ได้ตั้งค่า Google Apps Script Web App URL ในหน้า "ตั้งค่าระบบ" (หรือยังไม่ได้ลงชื่อเข้าใช้ Google Mail) — ข้อมูลถูกสำรองไว้ในเครื่องอย่างปลอดภัยแล้ว';
        StorageService.setPendingSyncError(msg);
        setPendingSyncCount(count);
        setSyncBanner({ type: 'warning', text: msg });
        return { synced: false, count, reason: 'no_auth', error: msg };
      }

      setIsFlushingPending(true);
      try {
        let targetSpreadsheetId = spreadsheetId;
        let folderId = StorageService.getSettings().connectedDriveFolderId;

        const currentQueue = StorageService.getPendingSyncQueue();
        const pendingCountBefore = StorageService.getPendingSyncCount();
        const needsDriveUpload = currentQueue.addedBooks.some(
          (b) => b.coverImage && b.coverImage.startsWith('data:image') && !b.driveFileId
        );

        if (!targetSpreadsheetId) {
          targetSpreadsheetId = await createBookSwapSpreadsheet(token);
          if (needsDriveUpload) {
            folderId = await getOrCreateBookCoversFolder(token);
          }
          const updated = {
            ...StorageService.getSettings(),
            connectedSpreadsheetId: targetSpreadsheetId,
            connectedDriveFolderId: folderId,
          };
          StorageService.saveSettings(updated);
          setSettings(updated);
        } else if (needsDriveUpload && !folderId) {
          try {
            folderId = await getOrCreateBookCoversFolder(token);
            const updated = { ...StorageService.getSettings(), connectedDriveFolderId: folderId };
            StorageService.saveSettings(updated);
            setSettings(updated);
          } catch (folderErr) {
            console.warn('Drive folder setup non-fatal:', folderErr);
          }
        }

        // 1. Upload any pending cover images to Google Drive ONLY when present (non-fatal)
        if (needsDriveUpload && folderId) {
          let queueModified = false;
          for (const b of currentQueue.addedBooks) {
            if (b.coverImage && b.coverImage.startsWith('data:image') && !b.driveFileId) {
              try {
                const driveRes = await uploadCoverImageToDrive(
                  token,
                  folderId,
                  `${b.code}_${b.title.slice(0, 20)}.jpg`,
                  b.coverImage
                );
                b.driveFileId = driveRes.fileId;
                queueModified = true;
              } catch (e) {
                console.warn('Cover drive upload non-fatal:', e);
              }
            }
          }
          if (queueModified) {
            StorageService.savePendingSyncQueue(currentQueue);
          }
        }

        // 2. Fetch latest remote Books & Transactions first (strictAuth=true fails fast on expired 401/403 token)
        const [remoteBooks, remoteTx] = await Promise.all([
          fetchBooksFromSheet(token, targetSpreadsheetId, true),
          fetchTransactionsFromSheet(token, targetSpreadsheetId, true),
        ]);

        const mergedBooks = StorageService.mergeRemoteBooksWithPending(remoteBooks);
        const mergedTx = StorageService.mergeRemoteTransactionsWithPending(remoteTx);

        // Append ONLY new unsynced transactions directly into Transactions tab (gid=104373978)
        // using INSERT_ROWS so existing rows are NEVER cleared or overwritten
        const remoteTxIdSet = new Set(remoteTx.map((t) => (t.id || '').trim()).filter(Boolean));
        const newTransactionsToAppend = currentQueue.transactions.filter(
          (t) => t?.id && !remoteTxIdSet.has(t.id.trim())
        );

        // 3. Write BOTH Transactions AND Books immediately in parallel (throws SheetApiError on 401/403/5xx)
        const writePromises: Promise<void>[] = [];
        if (newTransactionsToAppend.length > 0) {
          writePromises.push(
            appendTransactionsToSheet(
              token,
              targetSpreadsheetId,
              newTransactionsToAppend,
              remoteTx.length === 0
            )
          );
        }
        if (currentQueue.addedBooks.length > 0 || currentQueue.updatedBooks.length > 0) {
          writePromises.push(syncAllBooksToSheet(token, targetSpreadsheetId, mergedBooks));
        }
        await Promise.all(writePromises);

        // 4. ONLY clear pending queue after BOTH Google Sheet tabs confirm HTTP 200 OK
        StorageService.clearPendingSyncQueue();
        StorageService.saveBooks(mergedBooks);
        StorageService.syncUsedCodesFromBooks(mergedBooks);
        StorageService.saveTransactions(mergedTx);

        setBooks(mergedBooks);
        setTransactions(mergedTx);
        setPendingSyncCount(0);

        const finalSettings: SystemSettings = {
          ...StorageService.getSettings(),
          connectedSpreadsheetId: targetSpreadsheetId,
          connectedDriveFolderId: folderId,
          lastSyncTime: new Date().toISOString(),
        };
        StorageService.saveSettings(finalSettings);
        setSettings(finalSettings);

        setSyncBanner({
          type: 'success',
          text: `บันทึกข้อมูลขึ้น Google Sheet (Books และ Transactions) สำเร็จแล้ว (${pendingCountBefore} รายการ)`,
        });
        setTimeout(() => {
          setSyncBanner((prev) => (prev?.type === 'success' ? null : prev));
        }, 6000);

        return { synced: true, count: pendingCountBefore };
      } catch (err: any) {
        console.error('Google Sheet pending-queue flush failed:', err);
        const isExpired =
          (err instanceof SheetApiError && err.isAuthExpired) ||
          String(err?.message || '').includes('401') ||
          String(err?.message || '').includes('หมดอายุ');

        if (isExpired) {
          invalidateAccessToken();
          setGoogleToken(null);
        }

        const friendlyError =
          err?.message ||
          'ไม่สามารถส่งข้อมูลขึ้น Google Sheet ได้ (ข้อมูลยังถูกสำรองไว้ในเครื่องอย่างปลอดภัย)';
        StorageService.setPendingSyncError(friendlyError);
        const remaining = StorageService.getPendingSyncCount();
        setPendingSyncCount(remaining);
        setSyncBanner({
          type: 'error',
          text: `${friendlyError} (ค้างส่ง ${remaining} รายการ)`,
        });
        return { synced: false, count: remaining, reason: 'error', error: friendlyError };
      } finally {
        setIsFlushingPending(false);
      }
    },
    [googleToken, getActiveSpreadsheetId]
  );

  // Authoritative Pull: fetches exact latest data from Google Sheet and safely merges with any pending local queue
  const pullFromGoogleSheet = useCallback(
    async (tokenOverride?: string | null): Promise<{ books: Book[]; transactions: TransactionRecord[] }> => {
      if (pendingSyncRef.current) {
        await pendingSyncRef.current.catch(() => {});
      }

      const targetId = getActiveSpreadsheetId();
      const token =
        tokenOverride !== undefined
          ? tokenOverride
          : googleToken || (await getAccessToken().catch(() => null));

      const [fetchedBooks, fetchedTx, fetchedSettings] = await Promise.all([
        fetchBooksFromSheet(token, targetId),
        fetchTransactionsFromSheet(token, targetId).catch(() => []),
        fetchSettingsFromSheet(token, targetId).catch(() => null),
      ]);

      // Rescue any real unsynced Kiosk transactions/books from localStorage before merging
      StorageService.adoptLegacyUnsyncedLocalData(fetchedBooks, fetchedTx);

      // Merge remote Google Sheet rows with any pending local Kiosk items (ZERO data loss on refresh!)
      const mergedBooks = StorageService.mergeRemoteBooksWithPending(fetchedBooks);
      const mergedTx = StorageService.mergeRemoteTransactionsWithPending(fetchedTx);

      StorageService.saveBooks(mergedBooks);
      StorageService.syncUsedCodesFromBooks(mergedBooks);
      setBooks(mergedBooks);

      StorageService.saveTransactions(mergedTx);
      setTransactions(mergedTx);

      const pendingCount = StorageService.getPendingSyncCount();
      setPendingSyncCount(pendingCount);

      const updatedSettings: SystemSettings = {
        ...StorageService.getSettings(),
        ...(fetchedSettings || {}),
        lastSyncTime: new Date().toISOString(),
      };
      StorageService.saveSettings(updatedSettings);
      setSettings(updatedSettings);

      return { books: mergedBooks, transactions: mergedTx };
    },
    [googleToken, getActiveSpreadsheetId]
  );

  // Pulls latest Books from Google Sheet for Kiosk Step 3 (U-code assignment) and Step 5 (live Match search)
  const handleRefreshBooksBeforeKioskAssign = useCallback(async (): Promise<Book[]> => {
    if (pendingSyncRef.current) {
      await pendingSyncRef.current.catch(() => {});
    }
    // If there are pending unsynced items and Apps Script URL or token is available, flush first so Sheet is 100% up-to-date
    if (StorageService.hasPendingSync()) {
      const hasAppsScript = Boolean(getEffectiveAppsScriptUrl(StorageService.getSettings()));
      const liveToken = googleToken || (await getAccessToken().catch(() => null));
      if (hasAppsScript || liveToken) {
        await flushPendingSyncToGoogleSheet(liveToken);
      }
    }
    // Always pull live Google Sheet Books (pullFromGoogleSheet safely merges any pending local items)
    try {
      const res = await pullFromGoogleSheet();
      return res.books;
    } catch (err) {
      console.warn('Live Kiosk Google Sheet refresh non-fatal, keeping local books:', err);
      return StorageService.getBooks();
    }
  }, [googleToken, flushPendingSyncToGoogleSheet, pullFromGoogleSheet]);

  const refreshFromGoogleSheet = useCallback(
    async (tokenOverride?: string | null) => {
      try {
        await pullFromGoogleSheet(tokenOverride);
      } catch (err) {
        console.warn('Live Google Sheet refresh non-fatal, keeping local cache:', err);
      }
    },
    [pullFromGoogleSheet]
  );

  const handleAddBookToGoogle = useCallback(
    async (
      newBook: Book,
      updatedBooks: Book[]
    ): Promise<{ synced: boolean; reason?: 'no_auth' | 'error'; error?: string }> => {
      try {
        const targetId = getActiveSpreadsheetId();
        const appsScriptUrl = getEffectiveAppsScriptUrl(StorageService.getSettings());
        const token = googleToken || (await getAccessToken().catch(() => null));
        const bookToAppend: Book = { ...newBook };

        // Optional: Upload cover image to Google Drive if data URL and token available
        if (bookToAppend.coverImage && bookToAppend.coverImage.startsWith('data:image') && token) {
          try {
            let folderId = settings.connectedDriveFolderId;
            if (!folderId) {
              folderId = await getOrCreateBookCoversFolder(token);
              const withFolder = { ...StorageService.getSettings(), connectedDriveFolderId: folderId };
              StorageService.saveSettings(withFolder);
              setSettings(withFolder);
            }
            const driveRes = await uploadCoverImageToDrive(
              token,
              folderId,
              `${bookToAppend.code}_${bookToAppend.title.slice(0, 20)}.jpg`,
              bookToAppend.coverImage
            );
            bookToAppend.driveFileId = driveRes.fileId;
          } catch (driveErr) {
            console.warn('Cover Drive upload on add book non-fatal:', driveErr);
          }
        }

        // PATH 1 (Preferred): Immediately upsert book into Google Sheet via Apps Script Web App
        if (appsScriptUrl) {
          await upsertBooksViaAppsScript(appsScriptUrl, targetId, [bookToAppend]);

          if (bookToAppend.driveFileId) {
            const withDrive = updatedBooks.map((b) =>
              b.id === bookToAppend.id ? { ...b, driveFileId: bookToAppend.driveFileId } : b
            );
            StorageService.saveBooks(withDrive);
            setBooks(withDrive);
          }

          const finalSettings: SystemSettings = {
            ...StorageService.getSettings(),
            lastSyncTime: new Date().toISOString(),
          };
          StorageService.saveSettings(finalSettings);
          setSettings(finalSettings);

          return { synced: true };
        }

        // PATH 2 (Fallback): OAuth Sheets API
        if (!token) {
          return {
            synced: false,
            reason: 'no_auth',
            error: 'ยังไม่ได้ตั้งค่า Google Apps Script Web App URL ในหน้า "ตั้งค่าระบบ"',
          };
        }

        await appendBookToSheet(token, targetId, bookToAppend);

        if (bookToAppend.driveFileId) {
          const withDrive = updatedBooks.map((b) =>
            b.id === bookToAppend.id ? { ...b, driveFileId: bookToAppend.driveFileId } : b
          );
          StorageService.saveBooks(withDrive);
          setBooks(withDrive);
        }

        const finalSettings: SystemSettings = {
          ...StorageService.getSettings(),
          lastSyncTime: new Date().toISOString(),
        };
        StorageService.saveSettings(finalSettings);
        setSettings(finalSettings);

        return { synced: true };
      } catch (err: any) {
        if (err instanceof SheetApiError && err.isAuthExpired) {
          invalidateAccessToken();
          setGoogleToken(null);
        }
        console.error('Append new book to Google Sheet error:', err);
        return {
          synced: false,
          reason: 'error',
          error: err?.message || 'ไม่สามารถบันทึกลง Google Sheet ได้',
        };
      }
    },
    [googleToken, getActiveSpreadsheetId, settings.connectedDriveFolderId]
  );

  // Load initial data from persistent Storage, restore session token if valid, and sync live data from Google Sheet
  useEffect(() => {
    setBooks(StorageService.getBooks());
    setSettings(StorageService.getSettings());
    setTransactions(StorageService.getTransactions());
    setPendingSyncCount(StorageService.getPendingSyncCount());

    // Immediately pull live Google Sheet (safely preserving any pending unsynced local queue)
    refreshFromGoogleSheet(null);

    // Initialize Firebase Auth listener (keeps staff logged in persistently across browser restarts until explicit logout)
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        setIsAdminLoggedIn(true);
        setAdminUsername(user.email || user.displayName || 'Google Staff');
      },
      () => {
        setIsAdminLoggedIn(false);
        setAdminUsername(null);
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Periodic OAuth token expiry monitor (Google OAuth access tokens expire after 1 hour)
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (googleToken && !getTokenExpiresAt()) {
        invalidateAccessToken();
        setGoogleToken(null);
        setSyncBanner({
          type: 'warning',
          text: 'สิทธิ์การเชื่อมต่อ Google Mail ครบ 1 ชั่วโมงแล้ว กรุณากดลงชื่อเข้าใช้ Google Mail ใหม่เพื่อให้ระบบบันทึกข้อมูลลง Google Sheet อัตโนมัติได้ต่อเนื่อง',
        });
      }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [googleToken]);

  // Handle transaction from Kiosk: enqueue persistently FIRST, then flush to Google Sheet immediately and await result
  const handleTransactionComplete = async (
    updatedBooks: Book[],
    newTransaction: TransactionRecord,
    addedBooks?: Book[],
    matchedUpdates?: Book[]
  ): Promise<{ synced: boolean; count: number; reason?: 'no_auth' | 'error'; error?: string }> => {
    const txAdded =
      addedBooks && addedBooks.length > 0
        ? addedBooks
        : updatedBooks.filter(
            (b) =>
              (b.transactionId || '').trim() === newTransaction.id ||
              newTransaction.booksBrought.includes(b.code)
          );
    const txUpdated =
      matchedUpdates && matchedUpdates.length > 0
        ? matchedUpdates
        : updatedBooks.filter(
            (b) =>
              (b.matchedTransactionId || '').trim() === newTransaction.id &&
              newTransaction.booksTaken.includes(b.code)
          );

    // Persist to Pending Sync Queue BEFORE attempting network upload so ZERO records are ever lost
    StorageService.enqueuePendingTransaction(newTransaction, txAdded, txUpdated);
    setPendingSyncCount(StorageService.getPendingSyncCount());

    setBooks(updatedBooks);
    setTransactions(StorageService.getTransactions());

    // Serialize flushes so concurrent transactions never race or duplicate rows in Transactions
    const previousFlush = pendingSyncRef.current;
    const syncTask = (async () => {
      if (previousFlush) {
        await previousFlush.catch(() => {});
      }
      return flushPendingSyncToGoogleSheet();
    })().finally(() => {
      if (pendingSyncRef.current === syncTask) {
        pendingSyncRef.current = null;
      }
    });
    pendingSyncRef.current = syncTask;
    return await syncTask;
  };

  const handleAdminLogout = async () => {
    await logout();
    setIsAdminLoggedIn(false);
    setAdminUsername(null);
    setGoogleUser(null);
    setGoogleToken(null);
    setCurrentTab('kiosk');
  };

  const handleSelectTab = (tab: 'kiosk' | 'dashboard' | 'books' | 'settings') => {
    // If selecting an admin tab while not logged in, prompt login
    if (tab !== 'kiosk' && !isAdminLoggedIn) {
      setIsLoginModalOpen(true);
      return;
    }
    setCurrentTab(tab);
    if (tab === 'kiosk') {
      refreshFromGoogleSheet();
    }
  };

  const handleGoHome = () => {
    setCurrentTab('kiosk');
    setKioskKey((prev) => prev + 1);
  };

  const isSheetWriteReady = Boolean(getEffectiveAppsScriptUrl(settings) || googleToken);

  return (
    <div
      className="min-h-screen bg-[#FAF3E6] text-[#3A2D26] flex flex-col font-sans select-none bg-cover bg-bottom bg-no-repeat bg-fixed"
      style={{
        backgroundImage: "url('/assets/aistudio/image_074dfe2c.png')",
      }}
    >
      <Navbar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onGoHome={handleGoHome}
        isAdminLoggedIn={isAdminLoggedIn}
        adminUsername={adminUsername}
        onOpenAdminLogin={() => {
          if (isAdminLoggedIn && !isSheetWriteReady) {
            setCurrentTab('settings');
          } else {
            setIsLoginModalOpen(true);
          }
        }}
        onAdminLogout={handleAdminLogout}
        googleConnected={isSheetWriteReady}
        pendingSyncCount={pendingSyncCount}
        isSyncingPending={isFlushingPending}
        onSyncPendingNow={() => {
          flushPendingSyncToGoogleSheet();
        }}
      />

      {/* Honest Sync Status & Pending Queue Alert Banner */}
      {(pendingSyncCount > 0 || syncBanner) && (
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-3">
          <div
            className={`rounded-2xl px-4 py-2.5 text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-xs border ${
              syncBanner?.type === 'success' && pendingSyncCount === 0
                ? 'bg-[#E8F5E9] border-[#C8E6C9] text-[#1E5631]'
                : syncBanner?.type === 'error'
                  ? 'bg-[#FDECEC] border-[#F5C2C0] text-[#8B2620]'
                  : 'bg-[#FEF3C7] border-[#F5D08A] text-[#78350F]'
            }`}
          >
            <div className="flex items-start sm:items-center gap-2 min-w-0">
              {syncBanner?.type === 'success' && pendingSyncCount === 0 ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2E7D32] mt-0.5 sm:mt-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-[#D97706] mt-0.5 sm:mt-0" />
              )}
              <span className="leading-snug">
                {syncBanner?.text ||
                  `มีข้อมูลการแลกค้างส่งขึ้น Google Sheet จำนวน ${pendingSyncCount} รายการ (สำรองไว้ในเครื่องอย่างปลอดภัยแล้ว)`}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {pendingSyncCount > 0 && (
                <button
                  type="button"
                  disabled={isFlushingPending}
                  onClick={() => {
                    if (isSheetWriteReady) {
                      flushPendingSyncToGoogleSheet();
                    } else if (isAdminLoggedIn) {
                      setCurrentTab('settings');
                    } else {
                      stayOnKioskAfterLoginRef.current = currentTab === 'kiosk';
                      setIsLoginModalOpen(true);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 bg-[#1E5631] hover:bg-[#164024] disabled:opacity-60 text-white px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  {isFlushingPending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isFlushingPending
                      ? 'กำลังส่งข้อมูล...'
                      : isSheetWriteReady
                        ? `ส่งขึ้น Google Sheet ทันที (${pendingSyncCount})`
                        : isAdminLoggedIn
                          ? 'ตั้งค่า Apps Script ในหน้าตั้งค่าระบบ'
                          : 'เข้าสู่ระบบเจ้าหน้าที่เพื่อตั้งค่า Sheet'}
                  </span>
                </button>
              )}
              {!isSheetWriteReady && pendingSyncCount === 0 && syncBanner?.type !== 'success' && (
                <button
                  type="button"
                  onClick={() => {
                    if (isAdminLoggedIn) {
                      setCurrentTab('settings');
                    } else {
                      stayOnKioskAfterLoginRef.current = currentTab === 'kiosk';
                      setIsLoginModalOpen(true);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 bg-[#7D502E] hover:bg-[#653F22] text-white px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>{isAdminLoggedIn ? 'ไปหน้าตั้งค่า Apps Script' : 'ลงชื่อเข้าใช้ Google Mail'}</span>
                </button>
              )}
              {pendingSyncCount === 0 && (
                <button
                  type="button"
                  onClick={() => setSyncBanner(null)}
                  className="text-xs opacity-60 hover:opacity-100 px-1 cursor-pointer"
                  aria-label="ปิดการแจ้งเตือน"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1">
        {currentTab === 'kiosk' && (
          <KioskView
            key={kioskKey}
            settings={settings}
            books={books}
            onTransactionComplete={handleTransactionComplete}
            onOpenAdminLogin={() => {
              if (isAdminLoggedIn && !isSheetWriteReady) {
                setCurrentTab('settings');
              } else {
                stayOnKioskAfterLoginRef.current = true;
                setIsLoginModalOpen(true);
              }
            }}
            onRefreshBooks={handleRefreshBooksBeforeKioskAssign}
            googleConnected={isSheetWriteReady}
            pendingSyncCount={pendingSyncCount}
            isSyncingPending={isFlushingPending}
            onRetrySync={() => flushPendingSyncToGoogleSheet()}
          />
        )}

        {currentTab === 'books' && (
          <AdminBookList
            books={books}
            settings={settings}
            onUpdateBooks={(updated) => setBooks(updated)}
            onPullFromGoogleSheet={() => pullFromGoogleSheet()}
            onAddBookToGoogle={handleAddBookToGoogle}
            onSyncToGoogle={async (updatedBooks?: Book[]) => {
              try {
                const targetId = getActiveSpreadsheetId();
                const list = updatedBooks || books;
                const allTx = StorageService.getTransactions();
                const appsScriptUrl = getEffectiveAppsScriptUrl(StorageService.getSettings());

                if (appsScriptUrl) {
                  await syncAllViaAppsScript(appsScriptUrl, targetId, list, allTx);
                  StorageService.clearPendingSyncQueue();
                  setPendingSyncCount(0);
                  await pullFromGoogleSheet();
                  return { synced: true };
                }

                const token = googleToken || (await getAccessToken());
                if (!token) {
                  return {
                    synced: false,
                    error: 'กรุณาตั้งค่า Google Apps Script Web App URL ในหน้า "ตั้งค่าระบบ" ก่อนซิงค์ขึ้น Google Sheet',
                  };
                }
                await syncAllBooksToSheet(token, targetId, list);
                await syncAllTransactionsToSheet(token, targetId, allTx);
                StorageService.clearPendingSyncQueue();
                setPendingSyncCount(0);
                await pullFromGoogleSheet(token);
                return { synced: true };
              } catch (e: any) {
                if (e instanceof SheetApiError && e.isAuthExpired) {
                  invalidateAccessToken();
                  setGoogleToken(null);
                }
                console.error('Google Sheets auto-sync error:', e);
                const msg = e?.message || 'เกิดข้อผิดพลาดในการซิงค์ขึ้น Google Sheet';
                setSyncBanner({
                  type: 'error',
                  text: msg,
                });
                return { synced: false, error: msg };
              }
            }}
            onSelectTab={handleSelectTab}
          />
        )}

        {currentTab === 'dashboard' && (
          <AdminDashboard
            books={books}
            settings={settings}
            transactions={transactions}
            googleConnected={isSheetWriteReady}
            onConnectGoogle={() => {
              if (isAdminLoggedIn && !isSheetWriteReady) {
                setCurrentTab('settings');
              } else {
                setIsLoginModalOpen(true);
              }
            }}
            onFlushPendingSync={() => flushPendingSyncToGoogleSheet()}
            onSelectTab={handleSelectTab}
            onOpenAddBook={() => setCurrentTab('books')}
            onSheetDataSynced={(freshBooks, freshTx, freshSettingsPatch) => {
              const sorted = StorageService.sortBooks(freshBooks);
              StorageService.saveBooks(sorted);
              StorageService.syncUsedCodesFromBooks(sorted);
              StorageService.saveTransactions(freshTx);
              setBooks(sorted);
              setTransactions(freshTx);
              setPendingSyncCount(StorageService.getPendingSyncCount());
              if (freshSettingsPatch) {
                const mergedSettings: SystemSettings = {
                  ...StorageService.getSettings(),
                  ...freshSettingsPatch,
                  lastSyncTime: new Date().toISOString(),
                };
                StorageService.saveSettings(mergedSettings);
                setSettings(mergedSettings);
              }
            }}
          />
        )}

        {currentTab === 'settings' && (
          <AdminSettings
            settings={settings}
            books={books}
            onUpdateSettings={(updated) => setSettings(updated)}
            googleConnected={Boolean(googleToken)}
            googleUser={googleUser}
            onConnectGoogle={() => setIsLoginModalOpen(true)}
            onFlushPendingSync={() => flushPendingSyncToGoogleSheet()}
            onSelectTab={handleSelectTab}
            onOpenAddBook={() => setCurrentTab('books')}
          />
        )}
      </main>

      {/* Admin Login Modal */}
      <AdminLogin
        isOpen={isLoginModalOpen}
        onClose={() => {
          stayOnKioskAfterLoginRef.current = false;
          setIsLoginModalOpen(false);
        }}
        onLoginSuccess={async (user) => {
          setIsAdminLoggedIn(true);
          setAdminUsername(user);
          const shouldStayOnKiosk = stayOnKioskAfterLoginRef.current;
          stayOnKioskAfterLoginRef.current = false;
          if (!shouldStayOnKiosk) {
            setCurrentTab((prev) => (prev === 'kiosk' ? 'dashboard' : prev));
          }
        }}
        onGoogleConnected={async (user, token) => {
          setGoogleUser(user);
          setGoogleToken(token);
          setSyncBanner(null);
          try {
            // Immediately flush ANY queued unsynced Kiosk transactions/books to Google Sheet FIRST
            if (StorageService.hasPendingSync()) {
              await flushPendingSyncToGoogleSheet(token);
            }
            await pullFromGoogleSheet(token);
          } catch (syncErr) {
            console.warn('Auto flush/pull on Google connect non-fatal:', syncErr);
          }
        }}
      />
    </div>
  );
}
