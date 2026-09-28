import { Hono } from "hono";
import bcrypt from "bcryptjs";
import type { AppEnv } from "../types";
import { authRequired, groupAdminRequired, issueToken } from "../auth";

const groupRoutes = new Hono<AppEnv>();

groupRoutes.get("/members", async (c) => {
  const sql = c.get("db");
  const members = await sql`SELECT full_name, role FROM group_members ORDER BY sort_order`;
  return c.json(members);
});

groupRoutes.post("/unlock", async (c) => {
  const sql = c.get("db");
  const data = await c.req.json().catch(() => ({}) as Record<string, unknown>);
  const password = String(data.password ?? "");

  const [admin] = await sql`SELECT id, full_name, password_hash FROM group_admin LIMIT 1`;
  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
    return c.json({ error: "Incorrect password." }, 401);
  }

  const members = await sql`SELECT full_name, student_id, role FROM group_members ORDER BY sort_order`;
  const token = await issueToken(
    { account_type: "group_admin", admin_name: admin.full_name },
    c.env.JWT_SECRET,
    Number(c.env.JWT_EXPIRY_HOURS),
  );
  return c.json({ token, members });
});

groupRoutes.post("/members", authRequired, groupAdminRequired, async (c) => {
  const sql = c.get("db");
  const data = await c.req.json().catch(() => ({}) as Record<string, unknown>);
  const fullName = String(data.fullName ?? "").trim();
  const studentId = String(data.studentId ?? "").trim();
  const role = String(data.role ?? "Member").trim() || "Member";

  if (!fullName || !studentId) {
    return c.json({ error: "Full name and student ID are required." }, 400);
  }

  const [{ next_sort: nextSort }] = await sql`
    SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort FROM group_members
  `;
  await sql`
    INSERT INTO group_members (full_name, student_id, role, sort_order)
    VALUES (${fullName}, ${studentId}, ${role}, ${nextSort})
  `;

  const members = await sql`SELECT full_name, student_id, role FROM group_members ORDER BY sort_order`;
  return c.json({ members }, 201);
});

export default groupRoutes;
