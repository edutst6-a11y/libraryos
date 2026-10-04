# LibraryOS — Complete Project Specification

The single source of truth for what LibraryOS is, what it does, how it is
built, and what a rebuild has to preserve. Written from a full read of every
file in this repository (code, SQL, scripts, report, diagrams, charts, git
history) on 2026-10-04, at commit `1268561` on branch
`claude/confident-hawking-5uh0wm`.

Exact code and copy stay where they live; this document points to them by
`file:line`. Every number the app's content quotes is listed here so it can be
kept consistent if the data ever changes.

## Contents

1. [At a glance](#1-at-a-glance)
2. [Identity and context](#2-identity-and-context)
3. [Users, roles and access](#3-users-roles-and-access)
4. [Pages and features](#4-pages-and-features)
5. [API reference](#5-api-reference)
6. [Data model](#6-data-model)
7. [Seed data](#7-seed-data)
8. [The 20 SQL queries](#8-the-20-sql-queries)
9. [Content inventory](#9-content-inventory)
10. [Design system and visual effects](#10-design-system-and-visual-effects)
11. [Static assets and generated deliverables](#11-static-assets-and-generated-deliverables)
12. [Architecture, hosting and local development](#12-architecture-hosting-and-local-development)
13. [Data that exists only in production](#13-data-that-exists-only-in-production)
14. [Security notes for a rebuild](#14-security-notes-for-a-rebuild)
15. [Known issues and quirks](#15-known-issues-and-quirks)
16. [File map](#16-file-map)
17. [History](#17-history)

---

## 1. At a glance

**LibraryOS** is a library management and usage-analytics web app for a
fictional four-branch public library network in Zambia, built as a University
of Lusaka **Big Data – Mid-Semester Project** (group project, submitted
8 September 2026). It has two halves:

1. **A working library system** on PostgreSQL: a catalogue of 150 books, 130
   members, 14 staff across 4 branches, and 460 loans with fines and
   reservations. Members get a self-service portal (membership card, loans,
   fines, catalogue search). Staff get a management dashboard (live KPIs,
   charts, searchable/paginated tables of every circulation record).
2. **A course-project showcase** inside the staff dashboard: a dark navy/gold
   "Big Data Project" section that maps every assignment requirement and
   deliverable to a page (problem statement, schema, ERD, live SQL explorer
   running all 20 queries, Big Data architecture, visualisations, findings,
   in-app slide deck, and the 32-page report, which staff can edit in the
   browser and save back to PDF).

**Live today:** frontend <https://libraryos-tau.vercel.app> (Vercel), API
<https://libraryos-api-ugsj.onrender.com> (Flask on Render). A complete
Cloudflare Workers + Pages port is built and locally validated on this branch
but not yet deployed (see §12).

**A rebuild must preserve:** the brand and dark navy/gold look (§10), the three
audiences and their access rules (§3), every API contract the frontend uses
(§5), the 10-table schema and its seed data, because the report's findings
quote exact figures from it (§6–7, §9), the 20 queries (§8), the Big Data
Project pages and their copy (§9), and the production-only data (§13).

---

## 2. Identity and context

| Item | Value |
|---|---|
| Product name | **LibraryOS** |
| Tagline | Library Management & Usage Analytics |
| Brand mark | Gold gradient rounded tile with a navy bold **"L"** |
| Page titles | `LibraryOS — Library Management & Usage Analytics` (login), `LibraryOS — Management Dashboard`, `LibraryOS — My Membership` |
| Academic context | University of Lusaka (UNILUS); course "Big Data – Mid-Semester Project"; "Application Area 10 — Library Management and Usage Analytics" |
| Report title | *Design and Development of a SQL-Based Big Data Analytics System* |
| Submission date | 8 September 2026 |
| Credit line (every Big Data Project page) | `Developed by T. Nenzou and company · University of Lusaka · Big Data Mid-Semester Project` |
| Repository | `github.com/edutst6-a11y/libraryos` (public), default branch `master` |
| Modelled organisation | Four-branch public library network: Central Library and Northmead Branch (Lusaka), Kitwe Branch (Kitwe), Ndola Branch (Ndola); one shared member base |
| Currency | Zambian Kwacha, shown as `K` with 2 decimals (`K1,290.32`) |
| Fictional domains | Staff `@citylibrary.zm`, members `@mail.zm`, phones `+260-…` |

---

## 3. Users, roles and access

| Audience | How they get in | Lands on | Can do |
|---|---|---|---|
| **Visitor** | — | `/index.html` | Log in, register as a member, open the password-locked "Project Group" modal |
| **Member** | Registers, or logs in with **email** + password | `/portal.html` | See own membership card, own loans and fines, browse/search the catalogue |
| **Staff** | Logs in with **username or email** + password | `/dashboard.html` | Everything in the dashboard: KPIs, charts, all tables, SQL explorer, Big Data Project pages, edit the report, switch own role |
| **Group leader** | Enters the single shared group password in the "Project Group" modal | Modal only | See group members with student IDs, add group members |

- One login form serves members and staff. The API checks `members.email`
  first, then `staff.email OR staff.username`.
- All four staff roles (`Librarian`, `Assistant Librarian`, `Branch Manager`,
  `IT Support`) have **identical access**. Role is a label. Any staff user can
  change their own role from the sidebar (`PATCH /api/auth/role`).
- Group-leader access is a separate token type (`group_admin`) granted only by
  the group password. It is not a staff or member account.
- Session: a JWT in `localStorage` (`lo_token`), plus `lo_account`
  (`{accountType, fullName, role}`) for the UI. A 401 from any `api()` call
  clears both and redirects to `/index.html`.
- Redirect rules: a logged-in visitor on `/index.html` is sent to their home
  page; a staff account on `/portal.html` is sent to `/dashboard.html`.
  `/dashboard.html` only checks that a token exists, not that it is staff
  (see §15).

### Access matrix (API)

| Endpoint group | Public | Member | Staff | Group leader |
|---|---|---|---|---|
| `POST /api/auth/register`, `POST /api/auth/login` | ✓ | | | |
| `GET /api/auth/me` | | ✓ | ✓ | |
| `PATCH /api/auth/role` | | | ✓ | |
| `GET /api/branches`, `/api/genres`, `/api/books`, `/api/health` | ✓ | ✓ | ✓ | ✓ |
| `GET /api/report/content`, `GET /api/report/pdf` | ✓ | ✓ | ✓ | ✓ |
| `PUT /api/report/content` | | | ✓ | |
| `GET /api/group/members` (names + roles only) | ✓ | ✓ | ✓ | ✓ |
| `POST /api/group/unlock` | ✓ | | | |
| `POST /api/group/members` | | | | ✓ |
| `GET /api/my/loans`, `/api/my/fines` | | ✓ | | |
| `GET /api/stats`, `/api/members`, `/api/loans`, `/api/fines`, `/api/reservations` | | | ✓ | |
| `GET /api/queries`, `/api/queries/:id`, `/api/charts/*` | | | ✓ | |

---

## 4. Pages and features

The frontend is plain static HTML/CSS/JS with no build step (`frontend/`).
Three pages, each loading `js/config.js` (API base URL + auth helpers).

### 4.1 Login / Register — `frontend/index.html`, `js/auth.js`, `css/auth.css`

- Full-screen **Three.js scene** of floating, slowly spinning books with a
  particle field and mouse parallax (`js/scene.js`, §10.5), under a radial
  vignette.
- Centered **glassmorphism card** (blurred translucent navy, 400px max) with the
  brand block and two tabs, **Log In** and **Create Account**.
- **Log In:** "Email or Username" + Password. Hint: *"Members log in with
  email. Staff log in with their username. You'll land on the right dashboard
  automatically."* On success stores the token and account, then redirects by
  `accountType`.
- **Create Account:** Full Name, Email, Password (min 8), Membership Type
  (UI offers Student / Public / Senior), Home Branch (populated from
  `GET /api/branches` as "Name — City"). Hint: *"We'll assign your membership
  number and card the moment you sign up."* On success redirects to
  `/portal.html?welcome=1`.
- **🔒 Project Group** link opens the group modal (§4.4).

### 4.2 Member portal — `frontend/portal.html`, `js/portal.js`, `css/portal.css`

- Light top bar: brand + "Log out".
- **Membership card:** navy gradient credit-card style with a gold glow,
  "Library Member", the member's name, membership number (`LIB-000123`,
  monospace, letter-spaced), Type, Branch, Member Since; tilts in 3D following
  the mouse.
- **Welcome note** (only with `?welcome=1`): *"🎉 Welcome to LibraryOS! Your
  membership was created just now — the card above is yours."*
- **My Loans** (Book, Loan Date, Due Date, Status badge) and **My Fines**
  (Book, Amount, Reason, Status badge), side by side on desktop.
- **Browse the Catalogue:** search title/author (300ms debounce) + genre
  filter; columns Title, Author, Genre, Branch, Available (`x / y`); 15 per
  page with Prev/Next.

### 4.3 Management dashboard — `frontend/dashboard.html`, `js/app.js`, `css/style.css`

**Shell.** Sticky navy-gradient sidebar (252px) with brand ("LibraryOS /
MANAGEMENT"), sectioned nav, and a footer showing "Signed in — Name (Role)", a
**Role** select (4 roles) and **Log out**. Sticky white top bar with the view
title and a pulsing green dot: **"Live data — PostgreSQL"**. Hash routing
(`#view`, `RENDERERS` at `app.js:919`). Each navigation replays a 3D entrance
animation and re-binds hover tilt. Under 900px the sidebar becomes off-canvas
with a hamburger and backdrop.

**Navigation** (section → item → hash):

| Section | Items |
|---|---|
| Overview | Dashboard `#dashboard`, Analytics `#analytics` |
| Catalogue | Books `#books`, Members `#members` |
| Circulation | Loans `#loans`, Fines `#fines`, Reservations `#reservations` |
| Big Data Project | Assignment Overview `#overview`, Problem & Objectives `#problem`, Database Design `#schema`, ER Diagram `#erd`, Data & SQL Queries `#sql`, Big Data Architecture `#architecture`, Visualisations `#visualisations`, Findings & Recommendations `#findings`, Presentation Slides `#slides`, Project Report `#report`, 🔒 Project Group (modal) |

**Dashboard** (`app.js:151`). Six stat cards, each with a colored left accent
bar:

| Card | Value | Sub-line | Accent |
|---|---|---|---|
| Total Books | `total_books` | "{total_copies} physical copies" | `#3b6ea5` |
| Active Members | `active_members` | "{total_loans} loans all-time" | `#c9973d` |
| Currently Borrowed | `currently_borrowed` | "{overdue_now} overdue right now" | red `#d9534f` if any overdue, else green `#1f9d61` |
| Fines Outstanding | `K fines_outstanding` | "K{fines_collected} collected" | `#d99a1f` |
| Collection Rate | `collection_rate_pct %` | "of fines issued, paid" | `#1f9d61` |
| Branches | `branches` | "library locations" | `#8592a6` |

Then three charts: **Top 10 Most Borrowed Books** (horizontal bar), **Catalogue
by Genre** (doughnut), **Monthly Borrowing Trend** ("Jan 2024 – present",
filled line).

**Analytics** (`app.js:208`). Larger light-theme versions: top books (bar),
genre composition (pie), monthly trend (line), and **Branch Activity: Loans vs.
Fines Collected** (bars for loans on the left axis, line for fines on a right
axis).

**Books / Members / Loans / Fines / Reservations** (`app.js:282–415`). One panel
each with controls, a table and pagination ("Page X of Y · N total", 15 rows).

| View | Controls | Columns |
|---|---|---|
| Books | search title/author, genre select | Title, Author, Genre, Branch, Year, Copies (`avail / total`), Price |
| Members | search name/email | Name, Email, Type, Home Branch, Joined, Total Loans, Status (Active/Inactive badge) |
| Loans | status: Borrowed / Returned / Overdue / Lost | Member, Book, Branch, Loan Date, Due Date, Return Date, Status |
| Fines | status: Unpaid / Paid / Waived | Member, Book, Amount, Reason, Issued, Paid, Status |
| Reservations | status: Pending / Fulfilled / Cancelled / Expired | Member, Book, Reserved On, Status |

**Big Data Project section.** Every page renders inside the shared
**showcase shell** (`bdpMount`, `app.js:426`): dark navy gradient card with a
faint University of Lusaka logo watermark, a **"Prepared by"** byline of gold
chips (live from `GET /api/group/members`: "Name · Role"), a gold-bordered
**requirement badge** (label + text naming the brief requirement and report
sections), title, subtitle, page body, and the credit footer. The first three
pages also show a small **rotating 4D tesseract** (110px) top-right.

| Page | Title / badge | Body |
|---|---|---|
| Assignment Overview `app.js:449` | "Assignment Overview"; badge *Application Area 10 — Library Management and Usage Analytics* | Two clickable checklists jumping to the answering page: **Project Requirements** 1–7 and **Project Deliverables** 1–7 |
| Problem & Objectives `app.js:486` | "Problem Identification"; badge *1. Problem Identification — Report §1–§4* | Panels: The organisation · The problem being addressed · Why the organisation requires a database system · What type of data the organisation generates · Project objectives (7 bullets) |
| Database Design `app.js:514` | badge *2. Database Design — 10 related tables …— Report §5, §7* | Summary panel, **Download schema.sql**, and the full `01_schema.sql` fetched and shown live |
| Data & SQL Queries `app.js:534` | "Data Population & SQL Queries"; badge *3. Data Population (996 seeded) & 4. SQL Queries (20 delivered) — Report §8–§10* | Row-count table (996 rows), **Download queries.sql**, and the **SQL explorer**: list of 20 queries (Q-number, title, concepts) on the left; clicking runs the query **live** and shows its SQL plus a results table. Q1 auto-runs |
| ER Diagram `app.js:601` | badge *2. Database Design (ERD) & Deliverable 3 — Report §6* | **Download PNG** + the full-size ERD image |
| Big Data Architecture `app.js:620` | "Big Data Architecture & Discussion"; badge *5. & 7. — Report §11, §12* | **Download PNG** + architecture image, "Purpose of each technology" (6) and "Big Data discussion" (6 Q&As) |
| Visualisations `app.js:661` | badge *6. Data Visualisation — 4 delivered — Report §13* | The four charts in gold-on-navy styling, each with an explanation paragraph |
| Findings & Recommendations `app.js:725` | badge *Report sections: §14, §15, §16* | 6 findings, 6 recommendations, conclusion |
| Presentation Slides `app.js:757` | badge *6. Presentation Slides* | 10 navy slide cards with the logo in the corner, "Slide n / 10" |
| Project Report `app.js:784` | badge *1. Project Report* | PDF viewer (`/api/report/pdf` in an iframe), **Download PDF**, and for staff an **✎ Edit** button |

**Report editing flow** (staff only):

1. **Edit** fetches `GET /api/report/content` (stored HTML), keeps its
   `<style>`, and shows the body in a white `contenteditable` area with
   **B / I / U** buttons.
2. **Save as PDF** lazy-loads html2pdf.js 0.14.0, renders the edited area to an
   A4 PDF (12mm margins, 2× scale), base64-encodes it, and sends
   `PUT /api/report/content {html, pdfBase64}`.
3. The server inserts a **new row** (old versions are kept) and the viewer
   reloads with the new PDF.

### 4.4 Project Group modal (login page and dashboard)

Locked state: *"Project Group — Restricted. Enter the group leader's password
to view the team."* After unlocking: a table of Name / Student ID / Role, and
an **Add a group member** form (Full name, Student ID, Role defaulting to
"Member"). Adding requires the `group_admin` token returned by the unlock.

### 4.5 What the app does not do

Scope for a rebuild to decide on. No staff action changes circulation data:

- No checkout, return, renew, or reservation-fulfilment actions; the
  circulation tables are read-only views.
- No fine payment or waiving, and no book, author, member or staff
  create/edit/delete.
- No member-facing reservations, holds or renewals.
- No password reset, email verification, account deactivation UI, or logout
  that invalidates a token.
- `books.available_copies` is a stored number, not derived from loans (§7.3).

---

## 5. API reference

Both backends implement exactly this contract: `backend/app.py` (Flask, live)
and `worker/src/` (Cloudflare Worker, same behavior, validated endpoint by
endpoint against a real database).

**Conventions**

- JSON in and out. Errors are `{"error": "message"}`.
- Auth header: `Authorization: Bearer <JWT>`. HS256, `exp` = issue time +
  `JWT_EXPIRY_HOURS` (default 24). No refresh or revocation.
- Token payloads: member `{account_type:"member", member_id, email}`, staff
  `{account_type:"staff", staff_id, email, role}`, group leader
  `{account_type:"group_admin", admin_name}`.
- Standard failures: 401 `Authentication required`, 403
  `Management access required` / `Group leader access required` /
  `Members only`.
- Types: `DATE` → `"YYYY-MM-DD"`, `NUMERIC` and counts → JSON numbers,
  timestamps → ISO strings.
- Pagination: `?page=N` (1-based), 15 per page; response
  `{rows, total, page, per_page}`.

| Method & path | Auth | Request | Success response |
|---|---|---|---|
| `POST /api/auth/register` | — | `{fullName, email, password, membershipType, homeBranchId}` | 201 `{token, membership:{member_id, full_name, email, membership_type, membership_number, join_date, branch_name}}` |
| `POST /api/auth/login` | — | `{email, password}` (email field also takes a staff username) | member `{token, accountType:"member", fullName, memberId}`; staff `{token, accountType:"staff", fullName, role, staffId}` |
| `GET /api/auth/me` | member/staff | — | member `{accountType, member_id, full_name, email, membership_type, membership_number, join_date, branch_name, active_loans}`; staff `{accountType, staff_id, full_name, email, role, branch_name}` |
| `PATCH /api/auth/role` | staff | `{role}` | `{role}` |
| `GET /api/branches` | — | — | `[{branch_id, branch_name, city}]` ordered by name |
| `GET /api/genres` | — | — | `["Biography", …]` alphabetical |
| `GET /api/books` | — | `q`, `genre`, `page` | rows `{book_id, title, author, genre, branch, publication_year, total_copies, available_copies, price}` ordered by title |
| `GET /api/members` | staff | `q`, `page` | rows `{member_id, full_name, email, membership_type, membership_number, home_branch, join_date, is_active, total_loans}`, newest join first |
| `GET /api/loans` | staff | `status`, `page` | rows `{loan_id, member, book, branch, loan_date, due_date, return_date, status}`, newest first |
| `GET /api/fines` | staff | `status`, `page` | rows `{fine_id, member, book, amount, reason, issued_date, paid_date, status}`, newest first |
| `GET /api/reservations` | staff | `status`, `page` | rows `{reservation_id, member, book, reservation_date, status}`, newest first |
| `GET /api/my/loans` | member | — | `[{loan_id, book, loan_date, due_date, return_date, status}]` |
| `GET /api/my/fines` | member | — | `[{fine_id, book, amount, reason, issued_date, status}]` |
| `GET /api/stats` | staff | — | `{total_books, total_copies, active_members, total_loans, currently_borrowed, overdue_now, branches, fines_outstanding, fines_collected, collection_rate_pct}` |
| `GET /api/charts/top-books` | staff | — | `{labels, values}` (top 10) |
| `GET /api/charts/genre-composition` | staff | — | `{labels, values}` |
| `GET /api/charts/monthly-trend` | staff | — | `{labels:["2024-01", …], values}` |
| `GET /api/charts/branch-activity` | staff | — | `{labels, loans, fines}` (fines = paid only) |
| `GET /api/queries` | staff | — | `[{id, title, concepts}]` |
| `GET /api/queries/:id` | staff | — | `{id, title, concepts, sql, columns, rows}` (404 `not found`) |
| `GET /api/report/content` | — | — | `{html, updatedAt, updatedBy}` (404 `No report on file.`) |
| `GET /api/report/pdf` | — | `download=1` → attachment, else inline | `application/pdf`, filename `Library_Analytics_Project_Report.pdf` |
| `PUT /api/report/content` | staff | `{html, pdfBase64}` | `{ok:true, updatedAt, updatedBy}` (`updatedBy` = staff full name) |
| `GET /api/group/members` | — | — | `[{full_name, role}]` by `sort_order` |
| `POST /api/group/unlock` | — | `{password}` | `{token, members:[{full_name, student_id, role}]}` (401 `Incorrect password.`) |
| `POST /api/group/members` | group leader | `{fullName, studentId, role}` | 201 `{members:[…]}` |
| `GET /api/health` | — | — | `{status:"UP"}` or 503 `{status:"DOWN"}` |

**Validation and error messages.** Register: name, email and password ≥ 8
required → 400 *"Full name, a valid email, and a password of at least 8
characters are required."*; duplicate email → 409 *"An account with that email
already exists."*; unknown membership type silently becomes `Student`; missing
branch defaults to the lowest `branch_id`; passwords are hashed with bcrypt
(cost 12); emails are lower-cased. Login: 401 *"Incorrect email or password."*;
inactive account → 403 *"This account has been deactivated."* Role: 400
*"Role must be one of: …"*. Report PUT: 400 if either field is missing or the
PDF can't be decoded. Group add: 400 *"Full name and student ID are
required."*; the new member's `sort_order` is max + 1.

---

## 6. Data model

PostgreSQL. All tables live in the **`library` schema**. The schema comment
says it sits inside a shared database named `mindcare` (shared with the
owner's MindCare / online-therapy project), so connections must set
`search_path` to `library`.

### 6.1 Tables

| Table | Kind | Columns (PK first; FK → target) | Constraints |
|---|---|---|---|
| `branches` | reference | `branch_id`, branch_name, address, city, phone, opened_date | |
| `staff` | reference | `staff_id`, branch_id → branches, full_name, role, email (unique), hire_date, is_active, **password_hash**, **username** (unique) | role ∈ Librarian, Assistant Librarian, Branch Manager, IT Support |
| `authors` | reference | `author_id`, full_name, nationality, birth_year | |
| `publishers` | reference | `publisher_id`, publisher_name, country, contact_email | |
| `genres` | reference | `genre_id`, genre_name (unique) | |
| `books` | reference | `book_id`, isbn (unique), title, author_id, publisher_id, genre_id, branch_id → their tables, publication_year, total_copies, available_copies, price NUMERIC(8,2) | year 1500–2026; copies ≥ 0; `available_copies ≤ total_copies`; price ≥ 0 |
| `members` | reference | `member_id`, full_name, email (unique), phone, home_branch_id → branches, membership_type, join_date, is_active, **password_hash**, **membership_number** (unique) | type ∈ Student, Staff, Public, Senior |
| `loans` | transactional | `loan_id`, book_id, member_id, staff_id → their tables, loan_date, due_date, return_date (nullable), status | status ∈ Borrowed, Returned, Overdue, Lost; `due_date ≥ loan_date`; `return_date` null or ≥ loan_date |
| `fines` | transactional | `fine_id`, loan_id → loans, amount NUMERIC(8,2), reason, issued_date, paid_date (nullable), status | reason ∈ Overdue, Lost, Damaged; status ∈ Unpaid, Paid, Waived; amount ≥ 0 |
| `reservations` | transactional | `reservation_id`, book_id, member_id, reservation_date, status | status ∈ Pending, Fulfilled, Cancelled, Expired |
| `group_members` | app | `id`, full_name, student_id, role, sort_order | |
| `group_admin` | app | `id`, full_name, password_hash | the app reads the first row only |
| `report_document` | app | `id`, html_content TEXT, pdf_bytes BYTEA, updated_by, updated_at (default now) | one row per save; newest wins |

Indexes on every foreign key on `loans`, `books`, `fines`, `reservations`, plus
`loans(loan_date, due_date, return_date)` and
`report_document(updated_at DESC)`.

**Branch attribution.** Analytics attribute a loan to the branch of the
**staff member who processed it** (`loans → staff → branches`), not the book's
home branch.

**Membership number.** `LIB-` + `member_id` zero-padded to 6 digits, assigned at
registration in the same transaction (backfilled for seeded members by
`04_auth_schema.sql`).

### 6.2 SQL files and order

A fresh database needs `01 → 02 → 04 → 05 → 06`. `03` is the query script, not
a migration.

| File | Purpose |
|---|---|
| `sql/01_schema.sql` | Drops and recreates schema `library`; 10 core tables + indexes |
| `sql/02_seed_data.sql` | 996 seed rows with explicit ids, then resets sequences |
| `sql/03_queries.sql` | The 20 documented analysis queries (§8) |
| `sql/04_auth_schema.sql` | Password/membership columns, membership-number backfill, `group_members`, `group_admin` |
| `sql/05_report_document.sql` | `report_document`; created ad hoc in production, written down later; idempotent |
| `sql/06_staff_username.sql` | `staff.username` + deterministic backfill (`name` + `staff_id`); same story; idempotent |

None of these files create passwords or group data. Staff passwords, the
group-leader row and group members were inserted by hand in production (§13).

---

## 7. Seed data

### 7.1 How it is made

`scripts/generate_seed_data.py`: `random.seed(42)`, so it is deterministic; it
writes plain `INSERT` SQL to `sql/02_seed_data.sql`. The script's "today" is
fixed at **2026-09-08**, so loan statuses are frozen as of that date.

- Business rules baked in: loans run **14 days**; overdue fines are **K0.75 per
  day**; a lost book is fined its **price**.
- Realism on purpose: genre weights `[3,2,3,3,2,2,2,2,3,2,1,1,1,1]`; per-book
  popularity weights; a top-up batch of 40 loans in the final 14 days, 55% of
  them from 18 "frequent" members, so some hold 2+ books at once.
- Names from Zambian first/last name pools; 41 real authors (Achebe, Ngũgĩ,
  Adichie, Rowling, Orwell …, with nationality and birth year); 15 real
  publishers; titles from templates such as "The {adj} {noun}" and "Beyond the
  {adj} {noun2}".

### 7.2 What is in it

| Table | Rows | Notes |
|---|---|---|
| branches | 4 | Central Library, 12 Cairo Road, Lusaka (2005) · Northmead Branch, 45 Church Road, Lusaka (2010) · Kitwe Branch, 8 Independence Ave, Kitwe (2012) · Ndola Branch, 21 Buteko Ave, Ndola (2015) |
| staff | 14 | see roster below |
| authors | 41 | |
| publishers | 15 | |
| genres | 14 | |
| books | 150 | years 1960–2024, prices K8.59–K64.98, 1–8 copies |
| members | 130 | joined 2015-02-02 → 2025-10-05; Student 59 · Public 30 · Staff 23 · Senior 18; 118 active |
| loans | 460 | 2024-01-01 → 2026-09-08; Returned 375 · Borrowed 44 · Lost 37 · Overdue 4 |
| fines | 98 | Paid/Overdue 51 = K524.25 · Unpaid/Lost 37 = K1,168.07 · Unpaid/Overdue 10 = K122.25 (no Waived, no Damaged) |
| reservations | 70 | Fulfilled 33 · Expired 13 · Pending 12 · Cancelled 12 |
| **total** | **996** | loans + fines + reservations = 628 |

**Titles per genre (copies):** Children's 20 (96), Fantasy 20 (96), Fiction 18
(95), History 13 (40), Non-Fiction 12 (75), Science Fiction 11 (49), Mystery &
Crime 10 (47), Young Adult 10 (57), Biography 9 (39), Poetry 7 (37), Romance 7
(27), Technology & Computing 6 (25), Education 4 (14), Self-Help 3 (14).

**Staff roster.** The username column shows what `06_staff_username.sql` assigns
on a fresh database; production usernames were set by hand and may differ.

| id | Name | Role (seed) | Branch | Fresh-DB username |
|---|---|---|---|---|
| 1 | Robert Chola | Librarian | Central | robertchola1 |
| 2 | Chanda Sinyangwe | Librarian | Central | chandasinyangwe2 |
| 3 | John Chirwa | Branch Manager | Central | johnchirwa3 |
| 4 | Emmanuel Kunda | Librarian | Northmead | emmanuelkunda4 |
| 5 | David Mumba | Assistant Librarian | Northmead | davidmumba5 |
| 6 | Bright Chisenga | Branch Manager | Northmead | brightchisenga6 |
| 7 | Michael Mbewe | Librarian | Northmead | michaelmbewe7 |
| 8 | Mutinta Mwansa | Librarian | Kitwe | mutintamwansa8 |
| 9 | Loveness Tembo | Assistant Librarian | Kitwe | lovenesstembo9 |
| 10 | Patricia Chisenga | Assistant Librarian | Kitwe | patriciachisenga10 |
| 11 | Ireen Mwansa | Branch Manager | Kitwe | ireenmwansa11 |
| 12 | Daniel Kunda | IT Support | Ndola | danielkunda12 |
| 13 | Precious Phiri | Librarian | Ndola | preciousphiri13 |
| 14 | John Kaluba | IT Support | Ndola | johnkaluba14 |

### 7.3 Seed-data quirks

Consistency gaps in the generated data, useful to know before adding features
that rely on it:

- `books.available_copies` is random: it disagrees with the actual active loans
  for 120 of 150 books, and one book has more active loans than copies.
- 24 loans are dated before the borrowing member's `join_date`.
- 46 loans belong to members who are now inactive.
- 8 `Pending` reservations are for books that show free copies; the schema
  comment says reservations are for fully loaned books.
- 337 of 460 loans were processed at a branch other than the book's home
  branch. This matches the "one shared network" model rather than being an
  error.

---

## 8. The 20 SQL queries

The source of truth is `sql/03_queries.sql`. The same SQL is **duplicated** in
`backend/app.py:524` and `worker/src/routes/queries.ts`; keep all three in
sync. In-app titles differ slightly from the `.sql` comments (e.g. Q8 is
"Currently borrowed books, most recent first" in the app).

| # | In-app title | Concepts |
|---|---|---|
| 1 | Books in the Science Fiction genre | SELECT, WHERE, JOIN, ORDER BY |
| 2 | 15 most recently joined members | SELECT, ORDER BY, LIMIT |
| 3 | Loans processed per branch | JOIN, GROUP BY, COUNT, ORDER BY |
| 4 | Total value of fines collected | SUM, WHERE |
| 5 | Books held per genre | GROUP BY, COUNT, JOIN, ORDER BY |
| 6 | Genres with more than 10 titles | GROUP BY, HAVING |
| 7 | Full catalogue listing | Multi-table JOIN, ORDER BY |
| 8 | Currently borrowed books, most recent first | Multi-table JOIN, WHERE, ORDER BY |
| 9 | Top 10 most borrowed books of all time | JOIN, GROUP BY, COUNT, ORDER BY, LIMIT |
| 10 | Top 10 most active members | JOIN, GROUP BY, COUNT, ORDER BY, LIMIT |
| 11 | Members who have never borrowed a book | Subquery (NOT IN) |
| 12 | Books that have never been borrowed | Subquery (NOT EXISTS), JOIN |
| 13 | Currently overdue loans with member contact info | JOIN, WHERE, ORDER BY, date arithmetic |
| 14 | Branches that collected more than K100 in fines | JOIN, GROUP BY, HAVING, SUM |
| 15 | Monthly borrowing trend | GROUP BY (date part), COUNT, ORDER BY |
| 16 | Average days a book stays out, by genre | JOIN, GROUP BY, AVG, WHERE |
| 17 | Fine payment / collection rate | SUM, COUNT, CASE expression |
| 18 | Members currently holding 2+ books at once | Subquery, GROUP BY, HAVING |
| 19 | Loans processed per staff member | JOIN, GROUP BY, COUNT, ORDER BY |
| 20 | Most-borrowed book within each genre | Window function (RANK), CTE |

The explorer runs only these fixed statements, looked up by id. No
user-supplied SQL is ever executed.

---

## 9. Content inventory

### 9.1 Where the copy lives

| Content | Location |
|---|---|
| Login/register text, group modal text | `frontend/index.html`, `frontend/dashboard.html:82–113` |
| Portal text | `frontend/portal.html` |
| Assignment Overview checklists (7 requirements, 7 deliverables) | `frontend/js/app.js:450–467` |
| Problem & Objectives panels | `app.js:486–511` |
| Database Design summary | `app.js:514–531` |
| Data & SQL page (row-count table, explorer) | `app.js:534–598` |
| Architecture: 6 technology purposes + 6 discussion Q&As | `app.js:621–636` |
| Visualisation explanations | `app.js:668–681` |
| Findings (6), recommendations (6), conclusion | `app.js:726–752` |
| Slides (10) | `app.js:758–769` |
| Full written report (16 sections) | `report/library_report.html`; rendered to `Library_Analytics_Project_Report.pdf` (32 pages, LibreOffice). The live app serves whatever is newest in `report_document` |

**Report outline:** 1 Introduction · 2 Problem Statement · 3 Project Objectives ·
4 Organisation / System Description · 5 Database Design · 6 ERD · 7 SQL Table
Creation · 8 Data Population · 9 SQL Queries · 10 Query Results and Analysis ·
11 Big Data Architecture · 12 Big Data Scalability · 13 Data Visualisations ·
14 Findings · 15 Recommendations · 16 Conclusion. The cover has a
**blank 5-row Full Name / Student ID table**; names were never filled in the
repo copy.

**Slides:** 1 Title · 2 The Problem · 3 Objectives · 4 Database Design · 5 ERD ·
6 Data & Queries · 7 Big Data Architecture · 8 Data Visualisations · 9 Key
Findings · 10 Thank You.

**Big Data architecture (5 layers):** Data Sources (branch systems, kiosks,
member portal, operational PostgreSQL, legacy exports) → Ingestion (Kafka,
Sqoop-style batch extraction, external feeds) → Storage (HDFS data lake, Hive
warehouse, metadata/governance) → Processing (Spark batch, Spark Streaming,
ML/recommendation jobs) → Consumption (BI dashboards, ad-hoc HiveQL/SparkSQL,
management decisions, member-facing features).

### 9.2 Facts the content quotes

These come from the seed data and appear in the report, findings and slides. If
the data changes, these sentences must change with it.

| Fact | Value | Source |
|---|---|---|
| Fines issued / collected / collection rate | 98 fines, K1,814.57 issued; 51 paid, K524.25; **28.9%** | Q17 |
| Uncollected fines | K1,290 (exactly K1,290.32) | Q17 |
| Most borrowed title | "The Last Road" (Mystery & Crime), 10 loans; "The City Diaries" 9; a cluster at 7–8 | Q9, Q20 |
| Branch loans / paid fines | Northmead 140 / K151.50 · Kitwe 127 / K102.75 · Ndola 104 / K143.25 · Central 89 / K126.75 | Q3, Q14, chart 4 |
| Kitwe finding | 2nd-most loans, least fines collected | Q3 + Q14 |
| Never borrowed | 2 members: Mutinta Sakala (joined 2020), Mulenga Chisenga (2023) | Q11 |
| Holding 2+ books | 8 members; Michael Chisenga holds 4 | Q18 |
| Largest genres | Fantasy and Children's, 20 titles each (over a quarter of the catalogue); Mystery & Crime has 10 | Q5, Q6 |
| Monthly volume | Mostly 8–19 loans/month, spike in Aug–Sep 2026 (30, 24) from the deliberate recent-loan top-up | Q15, chart 3 |
| Headline counts | 10 tables, 996 rows, 460 loans, 20 queries, 4 visualisations, 32-page report, 16 sections | — |

---

## 10. Design system and visual effects

### 10.1 Typography

- **Inter** 400–800 for UI text (14px base).
- **Sora** 600–800 for the brand on the login page, portal and modal headings.
- **JetBrains Mono** 400–500 for SQL blocks and the membership number.
- All loaded from Google Fonts.

### 10.2 Color tokens (`css/style.css:1–21`)

| Token | Hex | Use |
|---|---|---|
| `--navy` | `#0f2942` | sidebar, SQL blocks, deepest brand color |
| `--navy-2` | `#14314f` | sidebar gradient end, cards, modal |
| `--navy-light` | `#1c4166` | gradients |
| `--gold` | `#c9973d` | primary accent, focus ring, active nav |
| `--gold-light` | `#e8c88a` | gold highlights on dark backgrounds |
| `--bg` | `#f4f6f9` | light page background |
| `--card` | `#ffffff` | panels |
| `--border` | `#e7eaf0` | borders and dividers |
| `--text` / `--text-dim` / `--text-faint` | `#1a2332` / `#64748b` / `#94a3b8` | text levels |
| `--blue` / `--green` / `--red` / `--amber` / `--grey` | `#3b6ea5` / `#1f9d61` / `#d9534f` / `#d99a1f` / `#8592a6` | data and status colors |

Also used: dark login background `#060d18`, cream text `#f4e7c9`, muted blue
text `#a9bcd4` / `#93a8c2`, secondary gold `#a67725`.

Gold gradient used on the brand tile, primary buttons, active tabs and download
buttons: `linear-gradient(135deg, #e8c88a, #c9973d)` (brand tile ends at
`#a67725`).

### 10.3 Components

- **Radius** 12px (cards), 8–10px (controls), 16–20px (showcase shell, login
  card).
- **Shadows** are soft and navy-tinted (`rgba(15,41,66,…)`).
- **Stat card:** white, 4px colored left bar via `--accent`, uppercase label,
  28px/800 value.
- **Panel:** white card, 15px/700 title, dim subtitle.
- **Data table:** uppercase 11px headers on `#f8fafc`, hover row tint.
- **Status badges** (pills): Borrowed blue; Returned, Paid and Fulfilled green;
  Overdue and Unpaid red; Pending amber; Lost, Waived, Cancelled and Expired
  grey.
- **Buttons:**
  - `.btn`: white, outline, gold on hover.
  - `.download-btn` and `.auth-submit`: gold gradient with navy text.
  - `.btn-ghost`: outline on dark backgrounds.
- **Inputs:** gold border on focus; translucent white on dark backgrounds.

### 10.4 Layout, themes and motion

- **Light dashboard:** 252px sidebar, sticky top bar, content max 1400px with
  28–32px padding.
- **Dark showcase shell** (all Big Data Project pages):
  - Navy gradient `#14314f → #0f2942 → #0a1c30`, gold hairline border, deep
    shadow.
  - UNILUS logo watermark at 6% opacity, grayscale.
  - Translucent panels with gold `h3` headings.
  - Overrides that re-color reused light components so text stays readable
    (`style.css:356–375`).
- **Slides:** same navy gradient with the logo at 14% in the top-right corner.
- **Login:** WebGL scene + vignette + frosted-glass card (`blur(18px)`) that
  rises in with a slight X-rotation.
- **Motion:**
  - Views enter with `rotateX(6deg) translateY(18px) scale(.98) → none` over
    0.5s, `cubic-bezier(.16,1,.3,1)`.
  - Cards tilt on hover (§10.5).
  - The "live" dot pulses.
  - Primary buttons lift 1px on hover.
- **Responsive:** off-canvas sidebar below 900px; grids collapse to one column;
  the portal grid collapses below 800px; form rows stack below 480px.

### 10.5 Visual effects

| Effect | File | What it does |
|---|---|---|
| Floating books | `js/scene.js` | Three.js 0.160: 26 thin box "books" in navy/blue/gold with cream spines, scattered in an ellipsoid, slowly rotating and bobbing; 260 particles; gold and blue point lights; camera follows the mouse |
| 4D tesseract | `js/tesseract.js` | True hypercube: 16 vertices (all ±1 in 4D), 32 edges; rotated in the XW, YZ and XY planes, perspective-projected 4D→3D, rendered as gold lines with glowing blue vertex spheres. Shown at 110px on Overview, Problem and Database Design. It started as a full "4D Visualization" page that was folded into the accent (§17) |
| Hover tilt | `js/tilt3d.js` | `attachTilt()` adds a perspective rotate (±5–6°) following the cursor to stat cards, panels, diagram frames, the membership card, showcase panels and slides |

### 10.6 Charts (Chart.js 4.5.1)

- **Light pages:** bars `#3b6ea5`, trend line `#c9973d` with a 12% gold fill,
  grid `#eef1f5`.
- **Genre palette:** `#0f2942 #1c4166 #2c5c8a #3b6ea5 #5a89ba #79a3cc #9bbedb
  #bcd8ea #d9c896 #c9973d #a67725 #d99a1f #e8c88a #8592a6`.
- **Dark Visualisations page:** gold bars `#e8c88a`, ticks `#a9bcd4`, grid
  `rgba(255,255,255,.08)`, and a palette led by golds.

### 10.7 External libraries (all from CDNs, no npm in the frontend)

| Library | Version | Source | Used on |
|---|---|---|---|
| Chart.js | 4.5.1 | cdnjs | dashboard |
| Three.js | 0.160.0 | jsdelivr (ES module) | login scene, tesseract |
| html2pdf.js | 0.14.0 | cdnjs, lazy-loaded | report editing |
| Google Fonts | — | fonts.googleapis.com | all pages |

---

## 11. Static assets and generated deliverables

| Asset | Files | Made by |
|---|---|---|
| University logo | `frontend/img/unilus_logo.png` (= `report/unilus_logo.png`) | provided |
| ERD | `erd/library_erd.svg/.png` (620px, for the PDF), `erd/library_erd_full.svg/.png` (1360×1230; copied to `frontend/img/`) | `scripts/generate_erd.py` (hand-laid-out SVG → cairosvg → PIL) |
| Architecture diagram | `architecture/big_data_architecture.svg/.png` (620px), `…_full.svg/.png` (1500×980; copied to `frontend/img/`) | `scripts/generate_architecture.py` |
| Four charts | `visualizations/chart1…4.png` (full), `report/chart1…4.png` (smaller copies for the PDF) | `scripts/generate_visualizations.py` (matplotlib, from live queries) |
| Report | `report/library_report.html` → `Library_Analytics_Project_Report.pdf` (copies in `report/` and `frontend/downloads/`) | LibreOffice HTML→PDF |
| Downloads served by the app | `frontend/downloads/01_schema.sql`, `02_seed_data.sql`, `03_queries.sql`, the PDF | byte-identical copies of the `sql/` files and the PDF |

The Python scripts hard-code paths under `/home/tadiwanashe-nenzou/Desktop/Big_data/`
and a local database (`mindcare` / `mindcare_dev_password`). Edit both before
running them anywhere else. Dependencies: psycopg2, matplotlib, cairosvg,
Pillow.

---

## 12. Architecture, hosting and local development

### 12.1 Live today

```
Browser ──▶ Vercel (static frontend/) ── fetch ──▶ Render (Flask + gunicorn, backend/) ──▶ PostgreSQL (schema "library")
```

- **Frontend:** `https://libraryos-tau.vercel.app` (also the repo's homepage
  field).
- **API:** `https://libraryos-api-ugsj.onrender.com`, started with
  `gunicorn app:app --bind 0.0.0.0:$PORT` (`backend/Procfile`). Python deps:
  Flask 3.1.3, flask-cors 5.0.0, psycopg2-binary 2.9.10, bcrypt 4.2.1, PyJWT
  2.10.1, gunicorn 23.0.0.
- **Flask environment** (set in Render, not in the repo):
  - `JWT_SECRET` (code default `dev-secret-change-me`) and `JWT_EXPIRY_HOURS`
    (24).
  - `CORS_ALLOWED_ORIGINS` (comma list, default `*`).
  - `DB_URL`, or `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` /
    `DB_PASSWORD` / `DB_SSLMODE` (defaults `localhost` / 5432 / `mindcare` /
    `mindcare` / `mindcare_dev_password` / `prefer`).
  - `DB_SCHEMA` (`library`), `PORT`, `FLASK_DEBUG`.
- **Database host:** configured only in Render's environment, so it is not
  known from the repo.

### 12.2 Cloudflare port (this branch, not deployed)

```
Browser ──▶ Cloudflare Pages (frontend/) ── fetch ──▶ Cloudflare Worker (worker/) ── Hyperdrive ──▶ same PostgreSQL
```

- **Worker stack:** TypeScript, Hono 4, postgres.js 3 over Hyperdrive, bcryptjs
  (verified to accept the existing Python bcrypt hashes, so no password
  resets), JWT via `hono/jwt`. `nodejs_compat` flag.
- **Layout:**
  - `src/index.ts`: CORS, per-request DB client, routes.
  - `src/db.ts`: type parsers that keep JSON identical to Flask, and
    `search_path`.
  - `src/auth.ts`: JWT and role middleware.
  - `src/routes/*`: one file per area.
- **Configuration** (`worker/wrangler.toml`):
  - Vars: `CORS_ALLOWED_ORIGIN` (note: singular, unlike Flask),
    `JWT_EXPIRY_HOURS`, `DB_SCHEMA`.
  - Secret: `JWT_SECRET`.
  - Binding: `HYPERDRIVE`.
- **Validated** locally against real Postgres: every endpoint, auth boundaries,
  CORS preflight, PDF byte round-trip. `wrangler deploy --dry-run` builds
  cleanly (243 KiB).
- **Differences from Flask:** unknown routes get Hono's plain-text 404;
  uncaught errors return JSON 500.
- **Placeholders to fill before deploying:**
  - Hyperdrive `id` in `wrangler.toml`.
  - Worker URL in `frontend/js/config.js`
    (`https://libraryos-api.YOUR_SUBDOMAIN.workers.dev`).
  - Real Pages origin in `CORS_ALLOWED_ORIGIN`.
- **Step-by-step deployment:** `docs/CLOUDFLARE_DEPLOYMENT.md`.
- `frontend/_headers` adds `nosniff`, `strict-origin-when-cross-origin` and
  `X-Frame-Options: DENY` on Pages.
- **Reference in the same account:** `edutst6-a11y/nandys-paradise` already
  runs on Cloudflare **Pages + Pages Functions + Hyperdrive + Supabase**. That
  is a single-project alternative to the separate Worker if LibraryOS is
  rebuilt.

### 12.3 Local development

- **API (Worker):**
  1. `cd worker && npm install`.
  2. Put `JWT_SECRET` in `.dev.vars` (template: `.dev.vars.example`).
  3. Export
     `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=postgres://…` as
     a **real shell environment variable** before `npm run dev`. Gotcha: wrangler
     reads this one from the process environment, so `.dev.vars` alone is not
     enough.
  4. Runs on `http://localhost:8787`.
- **API (Flask, legacy):** `python backend/app.py` → `http://localhost:5055`.
- **Frontend:** serve `frontend/` with any static server. `config.js` points
  `localhost` and `127.0.0.1` at `http://localhost:8787` (it pointed at 5055
  before the port).
- **Database:**
  1. Create a database and run `01`, `02`, `04`, `05`, `06`.
  2. Set a bcrypt `password_hash` on at least one staff row and one member, and
     insert a `group_admin` row, to be able to log in.
  3. Insert a `report_document` row so the report page has content.
- **Dev tooling in the repo:**
  - `.mcp.json` registers the 21st.dev UI-component MCP server (key from
    `API_KEY_21ST`).
  - `.claude/launch.json` points at the owner's laptop path for an older
    prototype (`webapp/`, gitignored).

---

## 13. Data that exists only in production

None of this is in the repo, and none of it can be regenerated. **Export it
before decommissioning Render or rebuilding the database.** It could not be read
from the cloud session that wrote this document: that environment's network
policy blocks `onrender.com` and `vercel.app`.

- Staff usernames and password hashes. Production may also have different staff
  **roles**, because the sidebar role switcher writes to `staff.role`.
- The `group_admin` row: the group leader's name and password hash.
- `group_members`: the real group's names, student IDs and roles. Their names
  appear as "Prepared by" chips on every showcase page.
- `report_document`: every saved version of the report, including staff edits
  made in the browser. The newest row is what the app shows; it may differ
  from `report/library_report.html`.
- Members who registered through the app, and anything else changed since
  seeding.

Backup of the whole schema (run from anywhere that can reach the database, with
the connection string from Render's environment):

```bash
pg_dump "$DB_URL" --schema=library --no-owner --format=custom -f libraryos_library_schema.dump
# restore into a new database:
pg_restore --no-owner -d "$NEW_DB_URL" libraryos_library_schema.dump
```

---

## 14. Security notes for a rebuild

What is already right:

- Every SQL value is parameterized. Dynamic SQL is assembled only from fixed
  code fragments.
- The query explorer runs whitelisted SQL by id.
- Passwords are bcrypt, cost 12, stored only in the database.
- Staff endpoints are enforced server-side, not only hidden in the UI.

Fix or decide in a rebuild:

| # | Issue | Where |
|---|---|---|
| 1 | JWT kept in `localStorage`, so any XSS can steal sessions. Prefer an `HttpOnly`, `Secure`, `SameSite` cookie | `js/config.js` |
| 2 | Stored HTML injection: report HTML is inserted into the page with `innerHTML` in edit mode, and its `<style>` applies to the whole dashboard. A malicious or compromised staff account could plant `onerror`-style payloads that run for other staff | `app.js:833–847` |
| 3 | Group table on the login page renders names, student IDs and roles without escaping (the dashboard copy escapes) | `auth.js:94–98` |
| 4 | Branch names injected unescaped into the register dropdown (data is database-controlled; low risk) | `auth.js:21–24` |
| 5 | No rate limiting or lockout on login or group unlock, and a single shared group password | API |
| 6 | Any staff user can change their own role. Harmless today because roles grant nothing, but it must not carry over if roles ever gain permissions | `PATCH /api/auth/role` |
| 7 | Flask falls back to `JWT_SECRET=dev-secret-change-me` and CORS `*` if the environment variables are unset. Verify Render sets both | `backend/app.py:20–23` |
| 8 | No token revocation; logout only clears the browser; tokens live 24h | auth |
| 9 | The API accepts `membershipType: "Staff"` from public registration (the UI just doesn't offer it). Email format is validated only by the browser | register |
| 10 | `/dashboard.html` loads for member accounts; the API correctly returns 403 | `app.js:1` |

---

## 15. Known issues and quirks

- A non-numeric or negative `?page=` produces a 500 (Flask raises on `int()`;
  the Worker sends `NaN` or a negative OFFSET to Postgres).
- **ERD image:**
  - The "1 branch employs M staff" label overlaps the STAFF table's
    `branch_id` row.
  - The staff→loans line crosses the MEMBERS table.
  - Several lines cross each other.
- **Charts and diagrams:**
  - The genre pie (chart 2) has overlapping "Self-Help" and "Education"
    labels.
  - In the architecture diagram, the "Ad-hoc Analyst Queries → Library
    Management Decisions" link draws as a plain line with no arrowhead.
- **Dead CSS:** `.tesseract-frame` (the old 4D page), `.section-hidden`,
  `pre.sql-block .kw` (keyword highlighting that nothing emits).
- Q8's title differs between the app and `03_queries.sql`.
- The report cover's member table is blank.
- The report says the charts use "pandas + matplotlib"; the script uses
  matplotlib only.
- The report HTML/PDF in the repo may be older than the production
  `report_document` (§13).
- The seed-data consistency gaps in §7.3.

---

## 16. File map

```
backend/            Flask API (live on Render): app.py, requirements.txt, Procfile
worker/             Cloudflare Worker port of the API (TypeScript/Hono), wrangler.toml, .dev.vars.example
frontend/           Static site (no build): index.html, portal.html, dashboard.html, _headers
  css/              style.css (design system + dashboard + showcase), auth.css, portal.css
  js/               config.js (API base + auth helpers), auth.js, portal.js, app.js (dashboard router + every view),
                    scene.js (3D books), tesseract.js (4D), tilt3d.js (hover tilt)
  img/              unilus_logo.png, library_erd_full.png, big_data_architecture_full.png
  downloads/        copies of the three SQL files and the report PDF, served for download
sql/                01 schema · 02 seed · 03 queries · 04 auth · 05 report_document · 06 staff username
scripts/            generate_seed_data.py, generate_erd.py, generate_architecture.py, generate_visualizations.py
report/             library_report.html (source of the PDF) + the images it embeds + the PDF
erd/, architecture/ diagram SVG/PNG at report size and full size
visualizations/     the four chart PNGs at full size
docs/               this spec, CLOUDFLARE_DEPLOYMENT.md
Library_Analytics_Project_Report.pdf   the 32-page report (root copy)
.mcp.json, .claude/launch.json         developer tooling
```

---

## 17. History

| Date | Commit | Change |
|---|---|---|
| 2026-09-08 | `733023a` | Initial LibraryOS: schema, seed, queries, Flask API, three frontend pages, 3D login scene, report, ERD, architecture, charts |
| 2026-09-08 | `98444ed` | Fixed the production API URL to Render's assigned hostname |
| 2026-09-09 | `8b55124` | Username-based staff login; self-service role switching |
| 2026-09-09 | `e8725f9` | Group leader can add members; every deliverable surfaced in the dashboard with downloads; 3D tilt and entrance animations app-wide |
| 2026-09-09 | `5825926` | Added a full-page "4D Visualization" (rotating tesseract) |
| 2026-09-09 | `c7c31a3` | Rebuilt the Big Data Project section: requirement mapping, dark watermarked showcase theme, live group byline, slides; the 4D page became the small tesseract accent |
| 2026-09-09 | `89ec8f5` | Fixed unreadable text inside the dark showcase shell |
| 2026-09-11 | `a8f1a3f` | Staff can edit the report in the browser and save it back to PDF (stored in `report_document`) |
| 2026-09-28 | `1268561` | Cloudflare Workers + Pages port (not deployed), migrations 05–06, deployment guide |
