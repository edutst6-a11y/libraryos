import { Hono } from "hono";
import type { AppEnv } from "../types";
import { authRequired, managementRequired } from "../auth";

const statsRoutes = new Hono<AppEnv>();

// Every query below returns exactly one unaliased aggregate column, mirroring
// the original Flask code's `cur.fetchone()[0]` -- grab whatever the single
// column value is without caring what Postgres happened to name it.
function firstValue<T>(row: Record<string, unknown> | undefined): T {
  return row ? (Object.values(row)[0] as T) : (undefined as T);
}

statsRoutes.get("/stats", authRequired, managementRequired, async (c) => {
  const sql = c.get("db");
  const [
    totalBooks,
    totalCopies,
    activeMembers,
    totalLoans,
    currentlyBorrowed,
    overdueNow,
    branches,
    finesOutstanding,
    finesCollected,
    collectionRate,
  ] = await Promise.all([
    sql`SELECT COUNT(*) FROM books`,
    sql`SELECT COALESCE(SUM(total_copies), 0) FROM books`,
    sql`SELECT COUNT(*) FROM members WHERE is_active`,
    sql`SELECT COUNT(*) FROM loans`,
    sql`SELECT COUNT(*) FROM loans WHERE status = 'Borrowed'`,
    sql`SELECT COUNT(*) FROM loans WHERE status = 'Overdue'`,
    sql`SELECT COUNT(*) FROM branches`,
    sql`SELECT COALESCE(SUM(amount), 0) FROM fines WHERE status = 'Unpaid'`,
    sql`SELECT COALESCE(SUM(amount), 0) FROM fines WHERE status = 'Paid'`,
    sql`SELECT ROUND(100.0 * SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END)
        / NULLIF(SUM(amount), 0), 1) FROM fines`,
  ]);

  const rate = firstValue<number | null>(collectionRate[0]);
  return c.json({
    total_books: firstValue<number>(totalBooks[0]),
    total_copies: firstValue<number>(totalCopies[0]),
    active_members: firstValue<number>(activeMembers[0]),
    total_loans: firstValue<number>(totalLoans[0]),
    currently_borrowed: firstValue<number>(currentlyBorrowed[0]),
    overdue_now: firstValue<number>(overdueNow[0]),
    branches: firstValue<number>(branches[0]),
    fines_outstanding: firstValue<number>(finesOutstanding[0]),
    fines_collected: firstValue<number>(finesCollected[0]),
    collection_rate_pct: rate ?? 0,
  });
});

statsRoutes.get("/my/loans", authRequired, async (c) => {
  const u = c.get("user");
  if (u.account_type !== "member") return c.json({ error: "Members only" }, 403);
  const sql = c.get("db");
  const rows = await sql`
    SELECT l.loan_id, b.title AS book, l.loan_date, l.due_date, l.return_date, l.status
    FROM loans l JOIN books b ON b.book_id = l.book_id
    WHERE l.member_id = ${u.member_id!} ORDER BY l.loan_date DESC
  `;
  return c.json(rows);
});

statsRoutes.get("/my/fines", authRequired, async (c) => {
  const u = c.get("user");
  if (u.account_type !== "member") return c.json({ error: "Members only" }, 403);
  const sql = c.get("db");
  const rows = await sql`
    SELECT f.fine_id, b.title AS book, f.amount, f.reason, f.issued_date, f.status
    FROM fines f JOIN loans l ON l.loan_id = f.loan_id JOIN books b ON b.book_id = l.book_id
    WHERE l.member_id = ${u.member_id!} ORDER BY f.issued_date DESC
  `;
  return c.json(rows);
});

export default statsRoutes;
