import { Hono } from "hono";
import type { AppEnv } from "../types";
import { authRequired, managementRequired } from "../auth";

const chartRoutes = new Hono<AppEnv>();
chartRoutes.use("*", authRequired, managementRequired);

chartRoutes.get("/top-books", async (c) => {
  const sql = c.get("db");
  const rows = await sql`
    SELECT b.title, COUNT(l.loan_id) AS n FROM loans l JOIN books b ON b.book_id = l.book_id
    GROUP BY b.title ORDER BY n DESC LIMIT 10
  `;
  return c.json({ labels: rows.map((r) => r.title), values: rows.map((r) => r.n) });
});

chartRoutes.get("/genre-composition", async (c) => {
  const sql = c.get("db");
  const rows = await sql`
    SELECT g.genre_name, COUNT(b.book_id) AS n FROM genres g JOIN books b ON b.genre_id = g.genre_id
    GROUP BY g.genre_name ORDER BY n DESC
  `;
  return c.json({ labels: rows.map((r) => r.genre_name), values: rows.map((r) => r.n) });
});

chartRoutes.get("/monthly-trend", async (c) => {
  const sql = c.get("db");
  const rows = await sql`
    SELECT EXTRACT(YEAR FROM loan_date)::int AS y, EXTRACT(MONTH FROM loan_date)::int AS m, COUNT(*) AS n
    FROM loans GROUP BY 1, 2 ORDER BY 1, 2
  `;
  return c.json({
    labels: rows.map((r) => `${r.y}-${String(r.m).padStart(2, "0")}`),
    values: rows.map((r) => r.n),
  });
});

chartRoutes.get("/branch-activity", async (c) => {
  const sql = c.get("db");
  const rows = await sql`
    SELECT br.branch_name, COUNT(DISTINCT l.loan_id) AS loans,
           COALESCE(SUM(CASE WHEN f.status='Paid' THEN f.amount END), 0) AS fines
    FROM branches br JOIN staff s ON s.branch_id = br.branch_id JOIN loans l ON l.staff_id = s.staff_id
    LEFT JOIN fines f ON f.loan_id = l.loan_id GROUP BY br.branch_name ORDER BY loans DESC
  `;
  return c.json({
    labels: rows.map((r) => r.branch_name),
    loans: rows.map((r) => r.loans),
    fines: rows.map((r) => Number(r.fines)),
  });
});

export default chartRoutes;
