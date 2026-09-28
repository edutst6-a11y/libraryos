import { Hono } from "hono";
import bcrypt from "bcryptjs";
import type { AppEnv } from "../types";
import { authRequired, issueToken, managementRequired } from "../auth";

const authRoutes = new Hono<AppEnv>();

const MEMBERSHIP_TYPES = ["Student", "Staff", "Public", "Senior"];
const STAFF_ROLES = ["Librarian", "Assistant Librarian", "Branch Manager", "IT Support"];

authRoutes.post("/register", async (c) => {
  const sql = c.get("db");
  const data = await c.req.json().catch(() => ({}) as Record<string, unknown>);
  const fullName = String(data.fullName ?? "").trim();
  const email = String(data.email ?? "").trim().toLowerCase();
  const password = String(data.password ?? "");
  let membershipType = String(data.membershipType ?? "Student");
  let homeBranchId = data.homeBranchId as number | null | undefined;

  if (!fullName || !email || password.length < 8) {
    return c.json(
      { error: "Full name, a valid email, and a password of at least 8 characters are required." },
      400,
    );
  }
  if (!MEMBERSHIP_TYPES.includes(membershipType)) membershipType = "Student";

  const existing = await sql`SELECT 1 FROM members WHERE email = ${email}`;
  if (existing.length) {
    return c.json({ error: "An account with that email already exists." }, 409);
  }

  if (!homeBranchId) {
    const [branch] = await sql`SELECT branch_id FROM branches ORDER BY branch_id LIMIT 1`;
    homeBranchId = branch.branch_id as number;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const { memberId, membership } = await sql.begin(async (tx) => {
    const [{ member_id: memberId }] = await tx`
      INSERT INTO members (full_name, email, home_branch_id, membership_type, join_date, is_active, password_hash)
      VALUES (${fullName}, ${email}, ${homeBranchId}, ${membershipType}, CURRENT_DATE, TRUE, ${passwordHash})
      RETURNING member_id
    `;
    const membershipNumber = `LIB-${String(memberId).padStart(6, "0")}`;
    await tx`UPDATE members SET membership_number = ${membershipNumber} WHERE member_id = ${memberId}`;
    const [membership] = await tx`
      SELECT m.member_id, m.full_name, m.email, m.membership_type, m.membership_number,
             m.join_date, br.branch_name
      FROM members m JOIN branches br ON br.branch_id = m.home_branch_id
      WHERE m.member_id = ${memberId}
    `;
    return { memberId, membership };
  });

  const token = await issueToken(
    { account_type: "member", member_id: memberId, email },
    c.env.JWT_SECRET,
    Number(c.env.JWT_EXPIRY_HOURS),
  );
  return c.json({ token, membership }, 201);
});

authRoutes.post("/login", async (c) => {
  const sql = c.get("db");
  const data = await c.req.json().catch(() => ({}) as Record<string, unknown>);
  const email = String(data.email ?? "").trim().toLowerCase();
  const password = String(data.password ?? "");

  const [memberRow] = await sql`
    SELECT member_id, full_name, password_hash, is_active FROM members WHERE email = ${email}
  `;
  if (memberRow?.password_hash && (await bcrypt.compare(password, memberRow.password_hash))) {
    if (!memberRow.is_active) return c.json({ error: "This account has been deactivated." }, 403);
    const token = await issueToken(
      { account_type: "member", member_id: memberRow.member_id, email },
      c.env.JWT_SECRET,
      Number(c.env.JWT_EXPIRY_HOURS),
    );
    return c.json({
      token,
      accountType: "member",
      fullName: memberRow.full_name,
      memberId: memberRow.member_id,
    });
  }

  const [staffRow] = await sql`
    SELECT staff_id, full_name, role, password_hash, is_active FROM staff
    WHERE email = ${email} OR username = ${email}
  `;
  if (staffRow?.password_hash && (await bcrypt.compare(password, staffRow.password_hash))) {
    if (!staffRow.is_active) return c.json({ error: "This account has been deactivated." }, 403);
    const token = await issueToken(
      { account_type: "staff", staff_id: staffRow.staff_id, email, role: staffRow.role },
      c.env.JWT_SECRET,
      Number(c.env.JWT_EXPIRY_HOURS),
    );
    return c.json({
      token,
      accountType: "staff",
      fullName: staffRow.full_name,
      role: staffRow.role,
      staffId: staffRow.staff_id,
    });
  }

  return c.json({ error: "Incorrect email or password." }, 401);
});

authRoutes.get("/me", authRequired, async (c) => {
  const sql = c.get("db");
  const u = c.get("user");
  if (u.account_type === "member") {
    const [row] = await sql`
      SELECT m.member_id, m.full_name, m.email, m.membership_type, m.membership_number,
             m.join_date, br.branch_name,
             (SELECT COUNT(*) FROM loans l WHERE l.member_id = m.member_id AND l.status IN ('Borrowed','Overdue')) AS active_loans
      FROM members m JOIN branches br ON br.branch_id = m.home_branch_id
      WHERE m.member_id = ${u.member_id!}
    `;
    return c.json({ accountType: "member", ...row });
  }
  const [row] = await sql`
    SELECT s.staff_id, s.full_name, s.email, s.role, br.branch_name
    FROM staff s JOIN branches br ON br.branch_id = s.branch_id
    WHERE s.staff_id = ${u.staff_id!}
  `;
  return c.json({ accountType: "staff", ...row });
});

authRoutes.patch("/role", authRequired, managementRequired, async (c) => {
  const sql = c.get("db");
  const data = await c.req.json().catch(() => ({}) as Record<string, unknown>);
  const role = data.role as string;
  if (!STAFF_ROLES.includes(role)) {
    return c.json({ error: `Role must be one of: ${STAFF_ROLES.join(", ")}` }, 400);
  }
  const u = c.get("user");
  await sql`UPDATE staff SET role = ${role} WHERE staff_id = ${u.staff_id!}`;
  return c.json({ role });
});

export default authRoutes;
