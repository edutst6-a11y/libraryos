import { Hono } from "hono";
import type { AppEnv } from "../types";
import { authRequired, managementRequired } from "../auth";

const queryRoutes = new Hono<AppEnv>();
queryRoutes.use("*", authRequired, managementRequired);

const QUERIES = [
  {
    id: 1,
    title: "Books in the Science Fiction genre",
    concepts: "SELECT, WHERE, JOIN, ORDER BY",
    sql: `SELECT b.title, b.publication_year, a.full_name AS author, b.available_copies
FROM books b JOIN authors a ON a.author_id = b.author_id JOIN genres g ON g.genre_id = b.genre_id
WHERE g.genre_name = 'Science Fiction' ORDER BY b.publication_year DESC;`,
  },
  {
    id: 2,
    title: "15 most recently joined members",
    concepts: "SELECT, ORDER BY, LIMIT",
    sql: `SELECT member_id, full_name, membership_type, join_date FROM members
ORDER BY join_date DESC LIMIT 15;`,
  },
  {
    id: 3,
    title: "Loans processed per branch",
    concepts: "JOIN, GROUP BY, COUNT, ORDER BY",
    sql: `SELECT br.branch_name, COUNT(l.loan_id) AS total_loans FROM branches br
JOIN staff s ON s.branch_id = br.branch_id JOIN loans l ON l.staff_id = s.staff_id
GROUP BY br.branch_name ORDER BY total_loans DESC;`,
  },
  {
    id: 4,
    title: "Total value of fines collected",
    concepts: "SUM, WHERE",
    sql: `SELECT SUM(amount) AS total_fines_collected FROM fines WHERE status = 'Paid';`,
  },
  {
    id: 5,
    title: "Books held per genre",
    concepts: "GROUP BY, COUNT, JOIN, ORDER BY",
    sql: `SELECT g.genre_name, COUNT(b.book_id) AS number_of_titles, SUM(b.total_copies) AS total_physical_copies
FROM genres g LEFT JOIN books b ON b.genre_id = g.genre_id
GROUP BY g.genre_name ORDER BY number_of_titles DESC;`,
  },
  {
    id: 6,
    title: "Genres with more than 10 titles",
    concepts: "GROUP BY, HAVING",
    sql: `SELECT g.genre_name, COUNT(b.book_id) AS number_of_titles FROM genres g
JOIN books b ON b.genre_id = g.genre_id GROUP BY g.genre_name
HAVING COUNT(b.book_id) > 10 ORDER BY number_of_titles DESC;`,
  },
  {
    id: 7,
    title: "Full catalogue listing",
    concepts: "Multi-table JOIN, ORDER BY",
    sql: `SELECT b.title, a.full_name AS author, p.publisher_name, g.genre_name, b.publication_year
FROM books b JOIN authors a ON a.author_id = b.author_id JOIN publishers p ON p.publisher_id = b.publisher_id
JOIN genres g ON g.genre_id = b.genre_id ORDER BY b.title LIMIT 25;`,
  },
  {
    id: 8,
    title: "Currently borrowed books, most recent first",
    concepts: "Multi-table JOIN, WHERE, ORDER BY",
    sql: `SELECT m.full_name AS member, b.title AS book, br.branch_name, l.loan_date, l.due_date, l.return_date, l.status
FROM loans l JOIN members m ON m.member_id = l.member_id JOIN books b ON b.book_id = l.book_id
JOIN staff s ON s.staff_id = l.staff_id JOIN branches br ON br.branch_id = s.branch_id
WHERE l.status = 'Borrowed' ORDER BY l.loan_date DESC LIMIT 25;`,
  },
  {
    id: 9,
    title: "Top 10 most borrowed books of all time",
    concepts: "JOIN, GROUP BY, COUNT, ORDER BY, LIMIT",
    sql: `SELECT b.title, a.full_name AS author, COUNT(l.loan_id) AS times_borrowed
FROM loans l JOIN books b ON b.book_id = l.book_id JOIN authors a ON a.author_id = b.author_id
GROUP BY b.title, a.full_name ORDER BY times_borrowed DESC LIMIT 10;`,
  },
  {
    id: 10,
    title: "Top 10 most active members",
    concepts: "JOIN, GROUP BY, COUNT, ORDER BY, LIMIT",
    sql: `SELECT m.full_name, m.membership_type, COUNT(l.loan_id) AS total_loans
FROM members m JOIN loans l ON l.member_id = m.member_id
GROUP BY m.full_name, m.membership_type ORDER BY total_loans DESC LIMIT 10;`,
  },
  {
    id: 11,
    title: "Members who have never borrowed a book",
    concepts: "Subquery (NOT IN)",
    sql: `SELECT member_id, full_name, membership_type, join_date FROM members
WHERE member_id NOT IN (SELECT DISTINCT member_id FROM loans) ORDER BY join_date;`,
  },
  {
    id: 12,
    title: "Books that have never been borrowed",
    concepts: "Subquery (NOT EXISTS), JOIN",
    sql: `SELECT b.title, a.full_name AS author, b.publication_year, b.total_copies
FROM books b JOIN authors a ON a.author_id = b.author_id
WHERE NOT EXISTS (SELECT 1 FROM loans l WHERE l.book_id = b.book_id) ORDER BY b.publication_year;`,
  },
  {
    id: 13,
    title: "Currently overdue loans with member contact info",
    concepts: "JOIN, WHERE, ORDER BY, date arithmetic",
    sql: `SELECT m.full_name, m.email, m.phone, b.title, l.due_date, (CURRENT_DATE - l.due_date) AS days_overdue
FROM loans l JOIN members m ON m.member_id = l.member_id JOIN books b ON b.book_id = l.book_id
WHERE l.status = 'Overdue' ORDER BY days_overdue DESC;`,
  },
  {
    id: 14,
    title: "Branches that collected more than K100 in fines",
    concepts: "JOIN, GROUP BY, HAVING, SUM",
    sql: `SELECT br.branch_name, SUM(f.amount) AS fines_collected FROM fines f
JOIN loans l ON l.loan_id = f.loan_id JOIN staff s ON s.staff_id = l.staff_id
JOIN branches br ON br.branch_id = s.branch_id WHERE f.status = 'Paid'
GROUP BY br.branch_name HAVING SUM(f.amount) > 100 ORDER BY fines_collected DESC;`,
  },
  {
    id: 15,
    title: "Monthly borrowing trend",
    concepts: "GROUP BY (date part), COUNT, ORDER BY",
    sql: `SELECT EXTRACT(YEAR FROM loan_date) AS loan_year, EXTRACT(MONTH FROM loan_date) AS loan_month, COUNT(*) AS total_loans
FROM loans GROUP BY EXTRACT(YEAR FROM loan_date), EXTRACT(MONTH FROM loan_date) ORDER BY loan_year, loan_month;`,
  },
  {
    id: 16,
    title: "Average days a book stays out, by genre",
    concepts: "JOIN, GROUP BY, AVG, WHERE",
    sql: `SELECT g.genre_name, ROUND(AVG(l.return_date - l.loan_date), 1) AS avg_days_out
FROM loans l JOIN books b ON b.book_id = l.book_id JOIN genres g ON g.genre_id = b.genre_id
WHERE l.return_date IS NOT NULL GROUP BY g.genre_name ORDER BY avg_days_out DESC;`,
  },
  {
    id: 17,
    title: "Fine payment / collection rate",
    concepts: "SUM, COUNT, CASE expression",
    sql: `SELECT COUNT(*) AS total_fines_issued, SUM(CASE WHEN status = 'Paid' THEN 1 ELSE 0 END) AS fines_paid,
    SUM(amount) AS total_amount_issued, SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END) AS total_amount_collected,
    ROUND(100.0 * SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END) / NULLIF(SUM(amount), 0), 1) AS collection_rate_pct
FROM fines;`,
  },
  {
    id: 18,
    title: "Members currently holding 2+ books at once",
    concepts: "Subquery, GROUP BY, HAVING",
    sql: `SELECT m.full_name, m.email, active.active_loans FROM members m JOIN (
    SELECT member_id, COUNT(*) AS active_loans FROM loans WHERE status IN ('Borrowed', 'Overdue')
    GROUP BY member_id HAVING COUNT(*) >= 2
) active ON active.member_id = m.member_id ORDER BY active.active_loans DESC;`,
  },
  {
    id: 19,
    title: "Loans processed per staff member",
    concepts: "JOIN, GROUP BY, COUNT, ORDER BY",
    sql: `SELECT s.full_name AS staff_member, s.role, br.branch_name, COUNT(l.loan_id) AS loans_processed
FROM staff s JOIN branches br ON br.branch_id = s.branch_id LEFT JOIN loans l ON l.staff_id = s.staff_id
GROUP BY s.full_name, s.role, br.branch_name ORDER BY loans_processed DESC;`,
  },
  {
    id: 20,
    title: "Most-borrowed book within each genre",
    concepts: "Window function (RANK), CTE",
    sql: `WITH book_loan_counts AS (
    SELECT b.book_id, b.title, g.genre_name, COUNT(l.loan_id) AS times_borrowed,
           RANK() OVER (PARTITION BY g.genre_name ORDER BY COUNT(l.loan_id) DESC) AS genre_rank
    FROM books b JOIN genres g ON g.genre_id = b.genre_id LEFT JOIN loans l ON l.book_id = b.book_id
    GROUP BY b.book_id, b.title, g.genre_name
)
SELECT genre_name, title, times_borrowed FROM book_loan_counts WHERE genre_rank = 1 ORDER BY times_borrowed DESC;`,
  },
];

queryRoutes.get("/", (c) =>
  c.json(QUERIES.map((q) => ({ id: q.id, title: q.title, concepts: q.concepts }))),
);

queryRoutes.get("/:qid", async (c) => {
  const qid = parseInt(c.req.param("qid"), 10);
  const query = QUERIES.find((q) => q.id === qid);
  if (!query) return c.json({ error: "not found" }, 404);

  const sql = c.get("db");
  const rows = await sql.unsafe(query.sql);
  const columns = rows.columns?.map((col) => col.name) ?? [];
  return c.json({ id: query.id, title: query.title, concepts: query.concepts, sql: query.sql, columns, rows });
});

export default queryRoutes;
