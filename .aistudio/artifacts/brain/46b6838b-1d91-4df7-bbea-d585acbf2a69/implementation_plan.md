# Self-Service Book Exchange System (ระบบแลกเปลี่ยนหนังสือแบบ Self Service)

A bilingual, full-featured web application designed for library kiosks and staff administration to facilitate community book swapping with Google Sheets as the relational database and Google Drive for book cover storage.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and design parameters were confirmed during the planning clarification:
> - **Kiosk Authentication Model**: Admin signs in with Google once in the backend/kiosk setup to bind the Library's Google Sheet and Google Drive folder. Self-service visitors can then complete transactions smoothly on the kiosk without needing personal Google sign-ins.
> - **Book Cover Capture**: Dual input support allowing both real-time device camera snapshots (webcam/tablet camera) and file uploads (JPEG/PNG), with offline base64 preview and asynchronous sync to Google Drive.
> - **Visual Aesthetic**: Playful and colorful community book festival style with rich coral/amber/emerald cheerful accents, tactile buttons, celebratory exchange animations, and clean tabular typography for library cataloging.

---

## 1. Overview & Core Concept

- **What It Does**: Provides an interactive self-service terminal for library patrons to exchange their personal books for cataloged books on a 1:1 basis, along with an administrative control center for library staff to configure categories, audit exchanges, manage inventory with 'L' (Library central collection) and 'U' (User contributed) codes, and view real-time circulation metrics.
- **Target Audience / Persona**:
  - *Library Patrons & University Members* (CMU Students, Staff, Alumni, and General Public) participating in open book exchanges at the library.
  - *Library Staff & Admins* overseeing collection quality, managing exchange rules, replenishing books, and exporting circulation reports.
- **Key Value**: Eliminates manual paper logs, prevents duplicate/fraudulent exchanges, automates running number sticker sequences, and provides instant data synchronization with Google Workspace (Sheets & Drive).

---

## 2. User Experience & Visual Design

### Key User Flows

#### A. Self-Service Patron Kiosk Flow
1. **Welcome Screen**: Vibrant book festival hero banner, animated showcase of available books on the shelf (toggleable by admin), and a prominent "เริ่มต้นการแลกเปลี่ยน" (Start Book Exchange) action button.
2. **Step 1 - Rules & Guidelines (เงื่อนไขการเข้าร่วม)**: Displays library exchange policies (condition standards, 1:1 ratio, rejected formats) fetched directly from admin settings; patron must check "รับทราบและยอมรับเงื่อนไข" to continue.
3. **Step 2 - Participant Information (ข้อมูลผู้เข้าร่วม)**:
   - 10-digit Thai phone number input (formatted and validated strictly).
   - Email address.
   - Membership group selection (CMU นักศึกษา, CMU Staff, CMU ศิษย์เก่า, บุคคลทั่วไป/นักเรียน).
4. **Step 3 - Register Brought Books (บันทึกข้อมูลหนังสือที่นำมาแลก)**:
   - Interactive `+` / `-` quantity stepper.
   - Dynamically generated running codes with preview (e.g. `U101`, `U102`, `U103`).
   - For each book: Title, Estimated Price (THB), Category dropdown, and optional Camera/Upload cover photo.
5. **Step 4 - Sticker Application Guide (ติดรหัสหนังสือบนปก)**:
   - Illustrated instruction showing where to place the physical sticker from the desk onto each book's cover matching the generated codes.
   - Mandatory check: "ยืนยันการติดสติกเกอร์ครบถ้วน" before proceeding.
6. **Step 5 - Book Matching & Exchange (จับคู่แลกเปลี่ยน)**:
   - Summary of patron's registered books.
   - For each slot, user enters the code of the book from the shelf they want to take home (e.g. `L45` or `U89`).
   - *Real-time Validation*: Rejects duplicate codes within the transaction; checks database to verify the code is currently "Available".
   - *Quota Management*:
     - **Donation Option**: If patron brings 3 books but only wants 1, they can mark remaining slots as "Donation" (books become central library stock).
     - **Cancel Slot**: Patron can remove a book from the match; that code is marked as "Not Match" and permanently skipped to prevent sticker confusion.
7. **Step 6 - Final Commitment & Confirmation (ยืนยันการแลก)**:
   - Disclaimer: *"หนังสือที่ท่านนำมาแลก จะถูกนำไปส่งต่อเพื่อให้ผู้ร่วมกิจกรรมท่านอื่นเลือกอ่าน ท่านไม่สามารถเปลี่ยนใจและกลับมาขอเล่มนั้นๆ คืนได้อีก"*.
   - Confirmatory celebration screen with receipt summary and return-to-home countdown.

#### B. Administrative & Staff Console Flow
1. **Secure Login**: Access with test credentials (`admin` / `admin`) or Google Sign-In.
2. **System Settings**:
   - Dynamic book category management (add new category, delete with `×`).
   - Rule/Terms text editor for live kiosk display.
   - Staff account management (add/remove operator accounts).
   - Google Sheets & Drive connection manager (bind Sheet ID, create required headers, select Drive Folder for cover uploads).
3. **Book List & Inventory Management**:
   - Register new Central Library books (`L` prefix) or view patron books (`U` prefix).
   - Filter by status (`Available`, `Matched`, `Donated`, `Not Match`), category, source, or search by code/title.
   - Upload/edit book cover photos, view full provenance and exchange history.
   - One-click Excel/CSV export (`Export .xls`) for institutional reporting.
4. **Dashboard & Analytics**:
   - Metric cards: Total participants, Total registered books, Available on shelf, Total matched.
   - Category distribution bar chart (detect surplus or shortage).
   - Member distribution donut chart (CMU Student vs Staff vs Alumni vs Public).
   - Origin ratio: Library central collection (`L`) vs Community turnover (`U`).
   - Advanced Exchange Chain analysis: Tracks re-exchanges (e.g., Book swapped 2x, 3x, 5x+) and reveals the "Longest Chain" (most read books in the community).
   - Dead Stock / Turnover Alert: Highlights items on shelf $> 30$ days without matching for clearance or donation.

### Visual Identity & Theme
- **Style Direction**: Playful and vibrant community book festival aesthetic that feels warm, accessible, and inviting for university students and general public alike, while retaining rigorous typography for data cataloging.
- **Palette**:
  - Dominant Canvas: Warm festival white (`#FAF8F5`) and cream backgrounds (`#F4EFEA`).
  - Primary Accent: Library indigo/purple (`#4F46E5` / `#6366F1`) paired with celebratory festival amber (`#F59E0B`) and coral (`#F43F5E`).
  - Status Accents: Emerald (`#10B981`) for Available, Slate (`#64748B`) for Matched, Amber (`#F59E0B`) for Donation.
- **Typography**: Clean, friendly geometric sans (`Outfit` or `Plus Jakarta Sans`) paired with tabular numerals (`tabular-nums`) for codes (`U102`, `L45`), quantities, and timestamps.
- **Micro-Interactions**: Smooth card transitions via Framer Motion, confetti blast on completed exchange, and clear inline validation banners.

---

## 3. Key Product Decisions & Trade-Offs

- **Google Workspace Persistence Architecture**:
  - *Chosen Approach*: Direct integration with Google Sheets API v4 (reading/writing rows to sheets: `Books`, `Transactions`, `Settings`, `Chains`) and Google Drive API v3 (storing cover images in a dedicated `BookCovers` folder). An in-memory/localStorage sync buffer is maintained so the kiosk works seamlessly even if temporary network throttling occurs.
  - *Why*: Satisfies the explicit requirement of using Google Sheets as the database and Google Drive for cover images, while guaranteeing kiosk uptime and zero data loss.
- **Running Number Sequencing (L vs U)**:
  - *Chosen Approach*: Atomic running counter tracked in Google Sheets. Library-injected books automatically increment `L{number}` while kiosk visitor books increment `U{number}`. Skipped or cancelled slots are permanently archived as "Not Match" so printed physical stickers remain in exact 1:1 alignment.
- **Single-Kiosk Authorization Model**:
  - *Chosen Approach*: Admin authenticates the app with Google Workspace OAuth once. The active token/session powers all backend API syncs for the kiosk. Visitors do not face Google login hurdles on the public terminal.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Self-Service Kiosk Terminal                     │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────────────────┐ │
│  │ Welcome/Shelf  │  │ Multi-Step Form  │  │ Real-time Code Matcher  │ │
│  │ (Book Covers)  │  │ (Patron & Books) │  │ (Validation & Donation) │ │
│  └───────┬────────┘  └────────┬─────────┘  └────────────┬────────────┘ │
└──────────┼────────────────────┼─────────────────────────┼──────────────┘
           │                    │                         │
           ▼                    ▼                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Core Application State Engine                     │
│  - Active Session & Cart              - Running Sequence Generator     │
│  - Category & Rules Store             - Real-time Inventory Cache      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌─────────────────────────────────────┐   ┌──────────────────────────────┐
│       Admin Management Center       │   │   Google Workspace Adapter   │
│ - Admin Login (admin/admin)         │   │ - Google Sheets API (v4)     │
│ - Inventory CRUD & Sticker Print    │   │   * Books, Logs, Settings    │
│ - Category & Terms Editor           │   │ - Google Drive API (v3)      │
│ - Circulation Analytics & Chains    │   │   * Cover Photo Storage      │
│ - Excel/CSV Report Export           │   │ - OAuth Bearer Auth          │
└─────────────────────────────────────┘   └──────────────────────────────┘
```

### Data Schema (Google Sheets Tabs)

1. **`Books` Tab**:
   - `Code` (e.g. L1, U101)
   - `Title` (ชื่อเรื่อง)
   - `Category` (หมวดหมู่)
   - `Price` (ราคา)
   - `Status` (`Available`, `Matched`, `Donated`, `Not Match`)
   - `Source` (`Library` or `User`)
   - `OwnerPhone` (เบอร์โทรผู้แลก)
   - `OwnerEmail`
   - `MemberType` (CMU นักศึกษา, CMU Staff, etc.)
   - `DriveImageId` / `ImageUrl` (Google Drive File ID / View Link)
   - `CreatedAt` (วันที่ลงทะเบียน)
   - `MatchedAt` (วันที่ถูกแลก)
   - `MatchedWithCode` (รหัสหนังสือที่แลกเปลี่ยนด้วย)

2. **`Transactions` Tab**:
   - `TransactionId`
   - `Timestamp`
   - `UserPhone`
   - `UserEmail`
   - `MemberType`
   - `BooksBrought` (JSON/Comma-separated codes)
   - `BooksTaken` (JSON/Comma-separated codes)
   - `DonatedCount`
   - `CancelledCount`

3. **`Settings` Tab**:
   - `Categories` (JSON array of allowed categories)
   - `ExchangeTerms` (Markdown/HTML string of rules)
   - `StaffAccounts` (JSON array of credential hashes/usernames)
   - `ShowWelcomeShelf` (Boolean)
