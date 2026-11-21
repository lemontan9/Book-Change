import React, { useState, useEffect, useCallback } from 'react';
import type { Book, SystemSettings, TransactionRecord, StaffAccount } from './types';
import { StorageService } from './services/storage';
import { initAuth, logout, getAccessToken } from './services/firebaseAuth';
import {
  appendBookToSheet,
  appendTransactionToSheet,
  syncAllBooksToSheet,
  syncAllTransactionsToSheet,
  createBookSwapSpreadsheet,
  fetchBooksFromSheet,
  fetchTransactionsFromSheet,
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
  const [staff, setStaff] = useState<StaffAccount[]>([]);

  // Auth State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [adminUsername, setAdminUsername] = useState<string | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Google Workspace state
  const [googleUser, setGoogleUser] = useState<any | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  const getActiveSpreadsheetId = useCallback(() => {
    const currentSettings = StorageService.getSettings();
    return (
      (currentSettings.connectedSpreadsheetId &&
      !currentSettings.connectedSpreadsheetId.startsWith('172FuZL2')
        ? currentSettings.connectedSpreadsheetId.trim()
        : '') || '1ppG2ExLSTl5pb1TS47pW2aNvqMVID8qvXwrB3_uOSm0'
    );
  }, []);

  // Authoritative Pull: fetches exact latest data from Google Sheet and updates system state & localStorage
  const pullFromGoogleSheet = useCallback(
    async (tokenOverride?: string | null): Promise<{ books: Book[]; transactions: TransactionRecord[] }> => {
      const targetId = getActiveSpreadsheetId();
      const token =
        tokenOverride !== undefined
          ? tokenOverride
          : googleToken || (await getAccessToken().catch(() => null));

      const [fetchedBooks, fetchedTx] = await Promise.all([
        fetchBooksFromSheet(token, targetId),
        fetchTransactionsFromSheet(token, targetId).catch(() => []),
      ]);

      const sortedBooks = StorageService.sortBooks(fetchedBooks);
      StorageService.saveBooks(sortedBooks);
      StorageService.registerUsedCodes(sortedBooks.map((b) => b.code));
      setBooks(sortedBooks);

      StorageService.saveTransactions(fetchedTx);
      setTransactions(fetchedTx);

      const updatedSettings: SystemSettings = {
        ...StorageService.getSettings(),
        lastSyncTime: new Date().toISOString(),
      };
      StorageService.saveSettings(updatedSettings);
      setSettings(updatedSettings);

      return { books: sortedBooks, transactions: fetchedTx };
    },
    [googleToken, getActiveSpreadsheetId]
  );

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

  // Load initial data from persistent Storage, then sync live data from Google Sheet
  useEffect(() => {
    setBooks(StorageService.getBooks());
    setSettings(StorageService.getSettings());
    setTransactions(StorageService.getTransactions());
    setStaff(StorageService.getStaff());

    // Immediately pull live public Google Sheet so Kiosk Home counts match Dashboard & Sheet
    refreshFromGoogleSheet(null);

    // Initialize Firebase Auth listener
    initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
  }, []);

  // Handle transaction from Kiosk
  const handleTransactionComplete = async (
    updatedBooks: Book[],
    newTransaction: TransactionRecord
  ) => {
    setBooks(updatedBooks);
    setTransactions(StorageService.getTransactions());

    // Asynchronous background sync to Google Sheets & Google Drive if connected
    syncTransactionToGoogleWorkspace(updatedBooks, newTransaction);
  };

  const syncTransactionToGoogleWorkspace = async (
    allBooks: Book[],
    tx: TransactionRecord
  ) => {
    try {
      const token = googleToken || (await getAccessToken());
      if (!token) return;

      let spreadsheetId = settings.connectedSpreadsheetId;
      let folderId = settings.connectedDriveFolderId;

      // Auto-provision Google Sheet and Drive folder if not yet created
      if (!spreadsheetId) {
        spreadsheetId = await createBookSwapSpreadsheet(token);
        folderId = await getOrCreateBookCoversFolder(token);
        const updated = {
          ...settings,
          connectedSpreadsheetId: spreadsheetId,
          connectedDriveFolderId: folderId,
          lastSyncTime: new Date().toISOString(),
        };
        setSettings(updated);
        StorageService.saveSettings(updated);
      } else if (!folderId) {
        folderId = await getOrCreateBookCoversFolder(token);
        const updated = { ...settings, connectedDriveFolderId: folderId };
        setSettings(updated);
        StorageService.saveSettings(updated);
      }

      // 1. Append transaction to Google Sheet
      await appendTransactionToSheet(token, spreadsheetId, tx);

      // 2. Upload cover images for newly brought books to Google Drive
      const broughtBooks = allBooks.filter((b) => tx.booksBrought.includes(b.code));
      for (const b of broughtBooks) {
        if (b.coverImage && b.coverImage.startsWith('data:image')) {
          try {
            const driveRes = await uploadCoverImageToDrive(
              token,
              folderId!,
              `${b.code}_${b.title.slice(0, 20)}.jpg`,
              b.coverImage
            );
            b.driveFileId = driveRes.fileId;
          } catch (e) {
            console.warn('Cover drive upload non-fatal:', e);
          }
        }
      }

      // 3. Auto-sync ALL books (including new additions and matched status changes) to Google Sheets
      await syncAllBooksToSheet(token, spreadsheetId, allBooks);

      const finalSettings = {
        ...settings,
        connectedSpreadsheetId: spreadsheetId,
        connectedDriveFolderId: folderId,
        lastSyncTime: new Date().toISOString(),
      };
      setSettings(finalSettings);
      StorageService.saveSettings(finalSettings);
      StorageService.saveBooks(allBooks);
      setBooks([...allBooks]);
    } catch (err) {
      console.error('Google Workspace auto-sync on match error:', err);
    }
  };

  const handleAdminLogout = async () => {
    await logout();
    setIsAdminLoggedIn(false);
    setAdminUsername(null);
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
        googleConnected={Boolean(googleToken || settings.connectedSpreadsheetId)}
      />

      <main className="flex-1">
        {currentTab === 'kiosk' && (
          <KioskView
            key={kioskKey}
            settings={settings}
            books={books}
            onTransactionComplete={handleTransactionComplete}
            onOpenAdminLogin={() => setIsLoginModalOpen(true)}
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
              } catch (e) {
                console.error('Google Sheets auto-sync error:', e);
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
            onSelectTab={handleSelectTab}
            onOpenAddBook={() => setCurrentTab('books')}
            onSheetDataSynced={(freshBooks, freshTx) => {
              const sorted = StorageService.sortBooks(freshBooks);
              StorageService.saveBooks(sorted);
              StorageService.saveTransactions(freshTx);
              setBooks(sorted);
              setTransactions(freshTx);
            }}
          />
        )}

        {currentTab === 'settings' && (
          <AdminSettings
            settings={settings}
            staff={staff}
            books={books}
            onUpdateSettings={(updated) => setSettings(updated)}
            onUpdateStaff={(updated) => setStaff(updated)}
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
          await refreshFromGoogleSheet();
        }}
        onGoogleConnected={async (user, token) => {
          setGoogleUser(user);
          setGoogleToken(token);
          try {
            await pullFromGoogleSheet(token);
          } catch (syncErr) {
            console.warn('Auto pull on Google connect non-fatal:', syncErr);
          }
        }}
      />
    </div>
  );
}
