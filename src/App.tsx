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
} from './services/firebaseAuth';
import {
  SheetApiError,
  appendBookToSheet,
  syncAllBooksToSheet,
  syncAllTransactionsToSheet,
  createBookSwapSpreadsheet,
  fetchBooksFromSheet,
  fetchTransactionsFromSheet,
  fetchSettingsFromSheet,
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

  // Auth State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [adminUsername, setAdminUsername] = useState<string | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Google Workspace state
  const [googleUser, setGoogleUser] = useState<any | null>(null);
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

      const token =
        tokenOverride !== undefined
          ? tokenOverride
          : googleToken || (await getAccessToken().catch(() => null));

      if (!token) {
        const count = StorageService.getPendingSyncCount();
        const msg =
          'ยังไม่ได้ลงชื่อเข้าใช้ Google Mail (หรือสิทธิ์ครบ 1 ชม.) — ข้อมูลถูกสำรองไว้ในเครื่องอย่างปลอดภัยแล้ว กรุณากดลงชื่อเข้าใช้ Google Mail เพื่อส่งข้อมูลขึ้น Google Sheet';
        StorageService.setPendingSyncError(msg);
        setPendingSyncCount(count);
        setSyncBanner({ type: 'warning', text: msg });
        return { synced: false, count, reason: 'no_auth', error: msg };
      }

      setIsFlushingPending(true);
      try {
        let spreadsheetId = getActiveSpreadsheetId();
        let folderId = StorageService.getSettings().connectedDriveFolderId;

        if (!spreadsheetId) {
          spreadsheetId = await createBookSwapSpreadsheet(token);
          folderId = await getOrCreateBookCoversFolder(token);
          const updated = {
            ...StorageService.getSettings(),
            connectedSpreadsheetId: spreadsheetId,
            connectedDriveFolderId: folderId,
          };
          StorageService.saveSettings(updated);
          setSettings(updated);
        } else if (!folderId) {
          try {
            folderId = await getOrCreateBookCoversFolder(token);
            const updated = { ...StorageService.getSettings(), connectedDriveFolderId: folderId };
            StorageService.saveSettings(updated);
            setSettings(updated);
          } catch (folderErr) {
            console.warn('Drive folder setup non-fatal:', folderErr);
          }
        }

        // 1. Upload any pending cover images to Google Drive (non-fatal)
        const currentQueue = StorageService.getPendingSyncQueue();
        const pendingCountBefore = StorageService.getPendingSyncCount();
        if (folderId) {
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

        // 2. Fetch latest remote Books & Transactions first so Merge-Before-Write never overwrites other devices
        const [remoteBooks, remoteTx] = await Promise.all([
          fetchBooksFromSheet(token, spreadsheetId),
          fetchTransactionsFromSheet(token, spreadsheetId).catch(() => []),
        ]);

        const mergedBooks = StorageService.mergeRemoteBooksWithPending(remoteBooks);
        const mergedTx = StorageService.mergeRemoteTransactionsWithPending(remoteTx);

        // 3. Write BOTH Books AND Transactions strictly (throws SheetApiError on 401/403/5xx)
        await syncAllBooksToSheet(token, spreadsheetId, mergedBooks);
        await syncAllTransactionsToSheet(token, spreadsheetId, mergedTx);

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
          connectedSpreadsheetId: spreadsheetId,
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

  // Pulls latest Books from Google Sheet before Kiosk Step 3 assigns U1, U2, U3... codes
  const handleRefreshBooksBeforeKioskAssign = useCallback(async (): Promise<Book[]> => {
    if (pendingSyncRef.current) {
      await pendingSyncRef.current.catch(() => {});
    }
    // If there are pending unsynced items and we have a token, flush first so Sheet is 100% up-to-date
    if (StorageService.hasPendingSync()) {
      const liveToken = googleToken || (await getAccessToken().catch(() => null));
      if (liveToken) {
        await flushPendingSyncToGoogleSheet(liveToken);
      } else {
        // Keep local books + pending queue so U codes continue sequentially without duplicates
        return StorageService.getBooks();
      }
    }
    try {
      const res = await pullFromGoogleSheet();
      return res.books;
    } catch (err) {
      console.warn('Pre-assign Google Sheet refresh non-fatal, keeping local books:', err);
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
        const token = googleToken || (await getAccessToken().catch(() => null));
        if (!token) {
          setIsLoginModalOpen(true);
          return { synced: false, reason: 'no_auth' };
        }

        const targetId = getActiveSpreadsheetId();
        const bookToAppend: Book = { ...newBook };

        // Upload cover image to Google Drive if provided as data URL so the sheet cell stays lightweight
        if (bookToAppend.coverImage && bookToAppend.coverImage.startsWith('data:image')) {
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

        // Immediately append the new book row to Google Sheet
        await appendBookToSheet(token, targetId, bookToAppend);

        // Save driveFileId locally if uploaded
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

    // Initialize Firebase Auth listener (restores unexpired sessionStorage OAuth token across F5 refresh)
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        setIsAdminLoggedIn(true);
        setAdminUsername(user.email || user.displayName || 'Google Staff');
      },
      () => {
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

  // Handle transaction from Kiosk: enqueue persistently FIRST, then flush to Google Sheet immediately
  const handleTransactionComplete = async (
    updatedBooks: Book[],
    newTransaction: TransactionRecord,
    addedBooks?: Book[],
    matchedUpdates?: Book[]
  ) => {
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

    // Track flush promise so subsequent Step 3 pulls wait for this write to finish
    const syncTask = flushPendingSyncToGoogleSheet().finally(() => {
      if (pendingSyncRef.current === syncTask) {
        pendingSyncRef.current = null;
      }
    });
    pendingSyncRef.current = syncTask;
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
        onOpenAdminLogin={() => setIsLoginModalOpen(true)}
        onAdminLogout={handleAdminLogout}
        googleConnected={Boolean(googleToken)}
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
                    if (googleToken) {
                      flushPendingSyncToGoogleSheet();
                    } else {
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
                      : googleToken
                        ? `ส่งขึ้น Google Sheet ทันที (${pendingSyncCount})`
                        : 'เชื่อม Google Mail เพื่อส่งข้อมูล'}
                  </span>
                </button>
              )}
              {!googleToken && pendingSyncCount === 0 && syncBanner?.type !== 'success' && (
                <button
                  type="button"
                  onClick={() => setIsLoginModalOpen(true)}
                  className="inline-flex items-center gap-1.5 bg-[#7D502E] hover:bg-[#653F22] text-white px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>ลงชื่อเข้าใช้ Google Mail</span>
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
            onOpenAdminLogin={() => setIsLoginModalOpen(true)}
            onRefreshBooks={handleRefreshBooksBeforeKioskAssign}
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
                const token = googleToken || (await getAccessToken());
                const targetId = getActiveSpreadsheetId();
                const list = updatedBooks || books;
                if (!token) {
                  setIsLoginModalOpen(true);
                  return;
                }
                await syncAllBooksToSheet(token, targetId, list);
                const allTx = StorageService.getTransactions();
                await syncAllTransactionsToSheet(token, targetId, allTx);
                StorageService.clearPendingSyncQueue();
                setPendingSyncCount(0);
              } catch (e: any) {
                if (e instanceof SheetApiError && e.isAuthExpired) {
                  invalidateAccessToken();
                  setGoogleToken(null);
                }
                console.error('Google Sheets auto-sync error:', e);
                setSyncBanner({
                  type: 'error',
                  text: e?.message || 'เกิดข้อผิดพลาดในการซิงค์ขึ้น Google Sheet',
                });
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
            googleConnected={Boolean(googleToken)}
            onConnectGoogle={() => setIsLoginModalOpen(true)}
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
            onSelectTab={handleSelectTab}
            onOpenAddBook={() => setCurrentTab('books')}
          />
        )}
      </main>

      {/* Admin Login Modal */}
      <AdminLogin
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={async (user) => {
          setIsAdminLoggedIn(true);
          setAdminUsername(user);
          setCurrentTab((prev) => (prev === 'kiosk' ? 'dashboard' : prev));
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
