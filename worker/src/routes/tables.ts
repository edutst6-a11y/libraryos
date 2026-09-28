import { Hono } from "hono";
import type { AppEnv } from "../types";
import { authRequired, managementRequired } from "../auth";
import { paginate } from "../db";

const tableRoutes = new Hono<AppEnv>();

tableRoutes.get("/books", async (c) => {
  const sql = c.get("db");
  const q = (c.req.query("q") || "").trim();
  const genre = (c.req.query("genre") || "").trim();
  const page = parseInt(c.req.query("page") || "1", 10);

  const where: string[] = [];
  const params: unknown[] = [];
  if (q) {
    params.push(`%${q}%`, `%${q}%`);
    where.push(`(b.title ILIKE $${params.length - 1} OR a.full_name ILIKE $${params.length})`);
  }
  if (genre) {
    params.push(genre);
    where.push(`g.genre_name = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const base = `FROM books b JOIN authors a ON a.author_id=b.author_id
    JOIN genres g ON g.genre_id=b.genre_id JOIN branches br ON br.branch_id=b.branch_id ${whereSql}`;
  const tableSql = `SELECT b.book_id, b.title, a.full_name AS author, g.genre_name AS genre,
    br.branch_name AS branch, b.publication_year, b.total_copies, b.available_copies, b.price
    ${base} ORDER BY b.title LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

  return c.json(await paginate(sql, tableSql, `SELECT COUNT(*) ${base}`, params, page));
});

tableRoutes.get("/members", authRequired, managementRequired, async (c) => {
  const sql = c.get("db");
  const q = (c.req.query("q") || "").trim();
  const page = parseInt(c.req.query("page") || "1", 10);

  const params: unknown[] = q ? [`%${q}%`, `%${q}%`] : [];
  const whereSql = q ? "WHERE m.full_name ILIKE $1 OR m.email ILIKE $2" : "";
  const base = `FROM members m JOIN branches br ON br.branch_id=m.home_branch_id ${whereSql}`;
  const tableSql = `SELECT m.member_id, m.full_name, m.email, m.membership_type, m.membership_number,
    br.branch_name AS home_branch, m.join_date, m.is_active,
    (SELECT COUNT(*) FROM loans l WHERE l.member_id=m.member_id) AS total_loans
    ${base} ORDER BY m.join_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

  return c.json(await paginate(sql, tableSql, `SELECT COUNT(*) ${base}`, params, page));
});

tableRoutes.get("/loans", authRequired, managementRequired, async (c) => {
  const sql = c.get("db");
  const status = (c.req.query("status") || "").trim();
  const page = parseInt(c.req.query("page") || "1", 10);

  const params: unknown[] = status ? [status] : [];
  const whereSql = status ? "WHERE l.status = $1" : "";
  const base = `FROM loans l JOIN members m ON m.member_id=l.member_id JOIN books b ON b.book_id=l.book_id
    JOIN staff s ON s.staff_id=l.staff_id JOIN branches br ON br.branch_id=s.branch_id ${whereSql}`;
  const tableSql = `SELECT l.loan_id, m.full_name AS member, b.title AS book, br.branch_name AS branch,
    l.loan_date, l.due_date, l.return_date, l.status ${base}
    ORDER BY l.loan_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

  return c.json(await paginate(sql, tableSql, `SELECT COUNT(*) ${base}`, params, page));
});

tableRoutes.get("/fines", authRequired, managementRequired, async (c) => {
  const sql = c.get("db");
  const status = (c.req.query("status") || "").trim();
  const page = parseInt(c.req.query("page") || "1", 10);

  const params: unknown[] = status ? [status] : [];
  const whereSql = status ? "WHERE f.status = $1" : "";
  const base = `FROM fines f JOIN loans l ON l.loan_id=f.loan_id JOIN members m ON m.member_id=l.member_id
    JOIN books b ON b.book_id=l.book_id ${whereSql}`;
  const tableSql = `SELECT f.fine_id, m.full_name AS member, b.title AS book, f.amount, f.reason,
    f.issued_date, f.paid_date, f.status ${base}
    ORDER BY f.issued_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

  return c.json(await paginate(sql, tableSql, `SELECT COUNT(*) ${base}`, params, page));
});

tableRoutes.get("/reservations", authRequired, managementRequired, async (c) => {
  const sql = c.get("db");
  const status = (c.req.query("status") || "").trim();
  const page = parseInt(c.req.query("page") || "1", 10);

  const params: unknown[] = status ? [status] : [];
  const whereSql = status ? "WHERE r.status = $1" : "";
  const base = `FROM reservations r JOIN members m ON m.member_id=r.member_id JOIN books b ON b.book_id=r.book_id ${whereSql}`;
  const tableSql = `SELECT r.reservation_id, m.full_name AS member, b.title AS book, r.reservation_date, r.status
    ${base} ORDER BY r.reservation_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

  return c.json(await paginate(sql, tableSql, `SELECT COUNT(*) ${base}`, params, page));
});

export default tableRoutes;
