import React, { useState, useEffect } from 'react';
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

  // Load initial data from persistent Storage
  useEffect(() => {
    setBooks(StorageService.getBooks());
    setSettings(StorageService.getSettings());
    setTransactions(StorageService.getTransactions());
    setStaff(StorageService.getStaff());

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
  };

  const handleGoHome = () => {
    setCurrentTab('kiosk');
    setKioskKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-[#F8F3EA] text-[#332D29] flex flex-col font-sans select-none">
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
            onSyncToGoogle={async (updatedBooks?: Book[]) => {
              try {
                const token = googleToken || (await getAccessToken());
                const targetId = settings.connectedSpreadsheetId || '1ppG2ExLSTl5pb1TS47pW2aNvqMVID8qvXwrB3_uOSm0';
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
          setCurrentTab('dashboard');

          // Immediately refresh latest data directly from public Google Sheet without requiring Google login
          try {
            const targetId = settings.connectedSpreadsheetId || '1ppG2ExLSTl5pb1TS47pW2aNvqMVID8qvXwrB3_uOSm0';
            const token = googleToken || (await getAccessToken().catch(() => null));
            const [fetchedBooks, fetchedTx] = await Promise.all([
              fetchBooksFromSheet(token, targetId),
              fetchTransactionsFromSheet(token, targetId).catch(() => []),
            ]);

            if (fetchedBooks && fetchedBooks.length > 0) {
              const localBooks = StorageService.getBooks();
              const sheetCodes = new Set(fetchedBooks.map((b) => b.code.toUpperCase()));
              const pendingLocal = localBooks.filter((b) => !sheetCodes.has(b.code.toUpperCase()));
              const mergedBooks = StorageService.sortBooks([...fetchedBooks, ...pendingLocal]);
              StorageService.saveBooks(mergedBooks);
              setBooks(mergedBooks);
            }

            if (fetchedTx && fetchedTx.length > 0) {
              const localTx = StorageService.getTransactions();
              const sheetTxIds = new Set(fetchedTx.map((t) => t.id));
              const pendingTx = localTx.filter((t) => !sheetTxIds.has(t.id));
              const mergedTx = [...fetchedTx, ...pendingTx];
              StorageService.saveTransactions(mergedTx);
              setTransactions(mergedTx);
            }
          } catch (err) {
            console.warn('Auto refresh on login non-fatal:', err);
          }
        }}
        onGoogleConnected={async (user, token) => {
          setGoogleUser(user);
          setGoogleToken(token);
          try {
            const targetId = settings.connectedSpreadsheetId || '1ppG2ExLSTl5pb1TS47pW2aNvqMVID8qvXwrB3_uOSm0';
            const allBooks = StorageService.getBooks();
            const allTx = StorageService.getTransactions();
            await syncAllBooksToSheet(token, targetId, allBooks);
            await syncAllTransactionsToSheet(token, targetId, allTx);
          } catch (syncErr) {
            console.warn('Auto sync on Google connect non-fatal:', syncErr);
          }
        }}
      />
    </div>
  );
}
