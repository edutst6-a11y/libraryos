-- ============================================================
-- Library Management and Usage Analytics System
-- Big Data - Mid-Semester Project
-- Schema: library (created inside the shared 'mindcare' Postgres
-- database, isolated in its own schema so it never touches any
-- other project's tables)
-- ============================================================

DROP SCHEMA IF EXISTS library CASCADE;
CREATE SCHEMA library;
SET search_path TO library;

-- ------------------------------------------------------------
-- 1. Branches - each physical library location
-- ------------------------------------------------------------
CREATE TABLE branches (
    branch_id       SERIAL PRIMARY KEY,
    branch_name     VARCHAR(100) NOT NULL,
    address         VARCHAR(200) NOT NULL,
    city            VARCHAR(80)  NOT NULL,
    phone           VARCHAR(30),
    opened_date     DATE NOT NULL
);

-- ------------------------------------------------------------
-- 2. Staff - librarians and admin staff, each tied to a branch
-- ------------------------------------------------------------
CREATE TABLE staff (
    staff_id        SERIAL PRIMARY KEY,
    branch_id       INT NOT NULL REFERENCES branches(branch_id),
    full_name       VARCHAR(100) NOT NULL,
    role            VARCHAR(50)  NOT NULL CHECK (role IN ('Librarian','Assistant Librarian','Branch Manager','IT Support')),
    email           VARCHAR(120) NOT NULL UNIQUE,
    hire_date       DATE NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- ------------------------------------------------------------
-- 3. Authors
-- ------------------------------------------------------------
CREATE TABLE authors (
    author_id       SERIAL PRIMARY KEY,
    full_name       VARCHAR(120) NOT NULL,
    nationality     VARCHAR(60),
    birth_year      INT
);

-- ------------------------------------------------------------
-- 4. Publishers
-- ------------------------------------------------------------
CREATE TABLE publishers (
    publisher_id    SERIAL PRIMARY KEY,
    publisher_name  VARCHAR(120) NOT NULL,
    country         VARCHAR(60),
    contact_email   VARCHAR(120)
);

-- ------------------------------------------------------------
-- 5. Genres
-- ------------------------------------------------------------
CREATE TABLE genres (
    genre_id        SERIAL PRIMARY KEY,
    genre_name      VARCHAR(60) NOT NULL UNIQUE
);

-- ------------------------------------------------------------
-- 6. Books - the catalogue. Each title is stored once; copies is
-- how many physical copies the library owns of that title.
-- ------------------------------------------------------------
CREATE TABLE books (
    book_id         SERIAL PRIMARY KEY,
    isbn            VARCHAR(20) NOT NULL UNIQUE,
    title           VARCHAR(200) NOT NULL,
    author_id       INT NOT NULL REFERENCES authors(author_id),
    publisher_id    INT NOT NULL REFERENCES publishers(publisher_id),
    genre_id        INT NOT NULL REFERENCES genres(genre_id),
    branch_id       INT NOT NULL REFERENCES branches(branch_id),
    publication_year INT NOT NULL CHECK (publication_year BETWEEN 1500 AND 2026),
    total_copies    INT NOT NULL CHECK (total_copies >= 0),
    available_copies INT NOT NULL CHECK (available_copies >= 0),
    price           NUMERIC(8,2) NOT NULL CHECK (price >= 0),
    CHECK (available_copies <= total_copies)
);

-- ------------------------------------------------------------
-- 7. Members - library patrons
-- ------------------------------------------------------------
CREATE TABLE members (
    member_id       SERIAL PRIMARY KEY,
    full_name       VARCHAR(120) NOT NULL,
    email           VARCHAR(120) NOT NULL UNIQUE,
    phone           VARCHAR(30),
    home_branch_id  INT NOT NULL REFERENCES branches(branch_id),
    membership_type VARCHAR(20) NOT NULL CHECK (membership_type IN ('Student','Staff','Public','Senior')),
    join_date       DATE NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- ------------------------------------------------------------
-- 8. Loans - the main transactional table: every borrow event
-- ------------------------------------------------------------
CREATE TABLE loans (
    loan_id         SERIAL PRIMARY KEY,
    book_id         INT NOT NULL REFERENCES books(book_id),
    member_id       INT NOT NULL REFERENCES members(member_id),
    staff_id        INT NOT NULL REFERENCES staff(staff_id),
    loan_date       DATE NOT NULL,
    due_date        DATE NOT NULL,
    return_date     DATE,
    status          VARCHAR(20) NOT NULL CHECK (status IN ('Borrowed','Returned','Overdue','Lost')),
    CHECK (due_date >= loan_date),
    CHECK (return_date IS NULL OR return_date >= loan_date)
);

-- ------------------------------------------------------------
-- 9. Fines - generated against a loan that is overdue or lost
-- ------------------------------------------------------------
CREATE TABLE fines (
    fine_id         SERIAL PRIMARY KEY,
    loan_id         INT NOT NULL REFERENCES loans(loan_id),
    amount          NUMERIC(8,2) NOT NULL CHECK (amount >= 0),
    reason          VARCHAR(20) NOT NULL CHECK (reason IN ('Overdue','Lost','Damaged')),
    issued_date     DATE NOT NULL,
    paid_date       DATE,
    status          VARCHAR(20) NOT NULL CHECK (status IN ('Unpaid','Paid','Waived'))
);

-- ------------------------------------------------------------
-- 10. Reservations - a member reserving a book that is fully on loan
-- ------------------------------------------------------------
CREATE TABLE reservations (
    reservation_id  SERIAL PRIMARY KEY,
    book_id         INT NOT NULL REFERENCES books(book_id),
    member_id       INT NOT NULL REFERENCES members(member_id),
    reservation_date DATE NOT NULL,
    status          VARCHAR(20) NOT NULL CHECK (status IN ('Pending','Fulfilled','Cancelled','Expired'))
);

-- ------------------------------------------------------------
-- Indexes on foreign keys / hot columns used heavily by the
-- analytics queries in 03_queries.sql
-- ------------------------------------------------------------
CREATE INDEX idx_loans_book       ON loans(book_id);
CREATE INDEX idx_loans_member     ON loans(member_id);
CREATE INDEX idx_loans_staff      ON loans(staff_id);
CREATE INDEX idx_loans_dates      ON loans(loan_date, due_date, return_date);
CREATE INDEX idx_books_genre      ON books(genre_id);
CREATE INDEX idx_books_author     ON books(author_id);
CREATE INDEX idx_books_branch     ON books(branch_id);
CREATE INDEX idx_fines_loan       ON fines(loan_id);
CREATE INDEX idx_reservations_book ON reservations(book_id);
CREATE INDEX idx_reservations_member ON reservations(member_id);
