-- ============================================================
-- Library Management and Usage Analytics
-- SQL Queries and Analysis
-- Each query is numbered, states the business question it answers,
-- and is labelled with the SQL concept(s) it demonstrates.
-- ============================================================
SET search_path TO library;


-- ============================================================
-- Q1. Which books belong to the "Science Fiction" genre?
-- Concepts: SELECT, WHERE, JOIN, ORDER BY
-- ============================================================
SELECT b.title, b.publication_year, a.full_name AS author, b.available_copies
FROM books b
JOIN authors a ON a.author_id = b.author_id
JOIN genres g ON g.genre_id = b.genre_id
WHERE g.genre_name = 'Science Fiction'
ORDER BY b.publication_year DESC;


-- ============================================================
-- Q2. Who are the 15 most recently joined members?
-- Concepts: SELECT, ORDER BY, LIMIT
-- ============================================================
SELECT member_id, full_name, membership_type, join_date
FROM members
ORDER BY join_date DESC
LIMIT 15;


-- ============================================================
-- Q3. How many loans has each branch processed?
-- Concepts: JOIN, GROUP BY, aggregate function (COUNT), ORDER BY
-- ============================================================
SELECT br.branch_name, COUNT(l.loan_id) AS total_loans
FROM branches br
JOIN staff s ON s.branch_id = br.branch_id
JOIN loans l ON l.staff_id = s.staff_id
GROUP BY br.branch_name
ORDER BY total_loans DESC;


-- ============================================================
-- Q4. What is the total value of fines collected (paid) so far?
-- Concepts: aggregate function (SUM), WHERE
-- ============================================================
SELECT SUM(amount) AS total_fines_collected
FROM fines
WHERE status = 'Paid';


-- ============================================================
-- Q5. How many books does the library hold in each genre?
-- Concepts: GROUP BY, aggregate function (COUNT), JOIN, ORDER BY
-- ============================================================
SELECT g.genre_name, COUNT(b.book_id) AS number_of_titles, SUM(b.total_copies) AS total_physical_copies
FROM genres g
LEFT JOIN books b ON b.genre_id = g.genre_id
GROUP BY g.genre_name
ORDER BY number_of_titles DESC;


-- ============================================================
-- Q6. Which genres have more than 10 titles in the catalogue?
-- Concepts: GROUP BY, HAVING, aggregate function
-- ============================================================
SELECT g.genre_name, COUNT(b.book_id) AS number_of_titles
FROM genres g
JOIN books b ON b.genre_id = g.genre_id
GROUP BY g.genre_name
HAVING COUNT(b.book_id) > 10
ORDER BY number_of_titles DESC;


-- ============================================================
-- Q7. Full catalogue listing with author, publisher and genre
-- Concepts: multi-table JOIN, ORDER BY
-- ============================================================
SELECT b.title, a.full_name AS author, p.publisher_name, g.genre_name, b.publication_year
FROM books b
JOIN authors a     ON a.author_id = b.author_id
JOIN publishers p  ON p.publisher_id = b.publisher_id
JOIN genres g      ON g.genre_id = b.genre_id
ORDER BY b.title
LIMIT 25;


-- ============================================================
-- Q8. Full loan history: who borrowed what, when, from which branch
-- Concepts: multi-table JOIN, WHERE, ORDER BY
-- ============================================================
SELECT m.full_name AS member, b.title AS book, br.branch_name,
       l.loan_date, l.due_date, l.return_date, l.status
FROM loans l
JOIN members m  ON m.member_id = l.member_id
JOIN books b    ON b.book_id = l.book_id
JOIN staff s    ON s.staff_id = l.staff_id
JOIN branches br ON br.branch_id = s.branch_id
WHERE l.status = 'Borrowed'
ORDER BY l.loan_date DESC
LIMIT 25;


-- ============================================================
-- Q9. Top 10 most borrowed books of all time
-- Concepts: JOIN, GROUP BY, aggregate function (COUNT), ORDER BY, LIMIT
-- ============================================================
SELECT b.title, a.full_name AS author, COUNT(l.loan_id) AS times_borrowed
FROM loans l
JOIN books b   ON b.book_id = l.book_id
JOIN authors a ON a.author_id = b.author_id
GROUP BY b.title, a.full_name
ORDER BY times_borrowed DESC
LIMIT 10;


-- ============================================================
-- Q10. Top 10 most active members by number of loans
-- Concepts: JOIN, GROUP BY, aggregate function (COUNT), ORDER BY, LIMIT
-- ============================================================
SELECT m.full_name, m.membership_type, COUNT(l.loan_id) AS total_loans
FROM members m
JOIN loans l ON l.member_id = m.member_id
GROUP BY m.full_name, m.membership_type
ORDER BY total_loans DESC
LIMIT 10;


-- ============================================================
-- Q11. Members who have never borrowed a single book
-- Concepts: subquery (NOT IN), WHERE
-- ============================================================
SELECT member_id, full_name, membership_type, join_date
FROM members
WHERE member_id NOT IN (SELECT DISTINCT member_id FROM loans)
ORDER BY join_date;


-- ============================================================
-- Q12. Books that have never once been borrowed (candidates for
-- weeding the collection or promoting)
-- Concepts: subquery (NOT EXISTS), JOIN
-- ============================================================
SELECT b.title, a.full_name AS author, b.publication_year, b.total_copies
FROM books b
JOIN authors a ON a.author_id = b.author_id
WHERE NOT EXISTS (SELECT 1 FROM loans l WHERE l.book_id = b.book_id)
ORDER BY b.publication_year;


-- ============================================================
-- Q13. Currently overdue loans, with the member's contact details
-- so reception knows exactly who to follow up with
-- Concepts: JOIN, WHERE, ORDER BY
-- ============================================================
SELECT m.full_name, m.email, m.phone, b.title,
       l.due_date, (CURRENT_DATE - l.due_date) AS days_overdue
FROM loans l
JOIN members m ON m.member_id = l.member_id
JOIN books b   ON b.book_id = l.book_id
WHERE l.status = 'Overdue'
ORDER BY days_overdue DESC;


-- ============================================================
-- Q14. Which branches have collected more than K100 in fines?
-- Concepts: JOIN, GROUP BY, HAVING, aggregate function (SUM)
-- ============================================================
SELECT br.branch_name, SUM(f.amount) AS fines_collected
FROM fines f
JOIN loans l    ON l.loan_id = f.loan_id
JOIN staff s    ON s.staff_id = l.staff_id
JOIN branches br ON br.branch_id = s.branch_id
WHERE f.status = 'Paid'
GROUP BY br.branch_name
HAVING SUM(f.amount) > 100
ORDER BY fines_collected DESC;


-- ============================================================
-- Q15. Monthly borrowing trend for the current year
-- Concepts: GROUP BY (date part), aggregate function (COUNT), ORDER BY
-- ============================================================
SELECT EXTRACT(YEAR FROM loan_date) AS loan_year,
       EXTRACT(MONTH FROM loan_date) AS loan_month,
       COUNT(*) AS total_loans
FROM loans
GROUP BY EXTRACT(YEAR FROM loan_date), EXTRACT(MONTH FROM loan_date)
ORDER BY loan_year, loan_month;


-- ============================================================
-- Q16. Average number of days a book stays out, by genre
-- Concepts: JOIN, GROUP BY, aggregate function (AVG), WHERE
-- ============================================================
SELECT g.genre_name, ROUND(AVG(l.return_date - l.loan_date), 1) AS avg_days_out
FROM loans l
JOIN books b  ON b.book_id = l.book_id
JOIN genres g ON g.genre_id = b.genre_id
WHERE l.return_date IS NOT NULL
GROUP BY g.genre_name
ORDER BY avg_days_out DESC;


-- ============================================================
-- Q17. Fine payment rate: how much of what's been issued has
-- actually been collected?
-- Concepts: aggregate functions (SUM, COUNT), CASE expression
-- ============================================================
SELECT
    COUNT(*) AS total_fines_issued,
    SUM(CASE WHEN status = 'Paid' THEN 1 ELSE 0 END) AS fines_paid,
    SUM(amount) AS total_amount_issued,
    SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END) AS total_amount_collected,
    ROUND(100.0 * SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END) / NULLIF(SUM(amount), 0), 1) AS collection_rate_pct
FROM fines;


-- ============================================================
-- Q18. Members currently holding 2 or more books at once
-- (useful for enforcing a borrowing-limit policy)
-- Concepts: subquery, GROUP BY, HAVING
-- ============================================================
SELECT m.full_name, m.email, active.active_loans
FROM members m
JOIN (
    SELECT member_id, COUNT(*) AS active_loans
    FROM loans
    WHERE status IN ('Borrowed', 'Overdue')
    GROUP BY member_id
    HAVING COUNT(*) >= 2
) active ON active.member_id = m.member_id
ORDER BY active.active_loans DESC;


-- ============================================================
-- Q19. Loans processed per staff member (workload distribution)
-- Concepts: JOIN, GROUP BY, aggregate function (COUNT), ORDER BY
-- ============================================================
SELECT s.full_name AS staff_member, s.role, br.branch_name, COUNT(l.loan_id) AS loans_processed
FROM staff s
JOIN branches br ON br.branch_id = s.branch_id
LEFT JOIN loans l ON l.staff_id = s.staff_id
GROUP BY s.full_name, s.role, br.branch_name
ORDER BY loans_processed DESC;


-- ============================================================
-- Q20. The single most-borrowed book within each genre
-- Concepts: window function (RANK), subquery / CTE, JOIN
-- (this is the "other relevant SQL technique" beyond the core list)
-- ============================================================
WITH book_loan_counts AS (
    SELECT b.book_id, b.title, g.genre_name, COUNT(l.loan_id) AS times_borrowed,
           RANK() OVER (PARTITION BY g.genre_name ORDER BY COUNT(l.loan_id) DESC) AS genre_rank
    FROM books b
    JOIN genres g ON g.genre_id = b.genre_id
    LEFT JOIN loans l ON l.book_id = b.book_id
    GROUP BY b.book_id, b.title, g.genre_name
)
SELECT genre_name, title, times_borrowed
FROM book_loan_counts
WHERE genre_rank = 1
ORDER BY times_borrowed DESC;
