import { Hono } from "hono";
import type { AppEnv } from "../types";

const publicRoutes = new Hono<AppEnv>();

publicRoutes.get("/branches", async (c) => {
  const sql = c.get("db");
  const rows = await sql`SELECT branch_id, branch_name, city FROM branches ORDER BY branch_name`;
  return c.json(rows);
});

publicRoutes.get("/genres", async (c) => {
  const sql = c.get("db");
  const rows = await sql`SELECT genre_name FROM genres ORDER BY genre_name`;
  return c.json(rows.map((r) => r.genre_name));
});

publicRoutes.get("/health", async (c) => {
  const sql = c.get("db");
  try {
    await sql`SELECT 1`;
    return c.json({ status: "UP" });
  } catch {
    return c.json({ status: "DOWN" }, 503);
  }
});

export default publicRoutes;
