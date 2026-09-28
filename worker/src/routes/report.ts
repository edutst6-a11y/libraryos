import { Hono } from "hono";
import type { AppEnv } from "../types";
import { authRequired, managementRequired } from "../auth";

const reportRoutes = new Hono<AppEnv>();

reportRoutes.get("/content", async (c) => {
  const sql = c.get("db");
  const [row] = await sql`
    SELECT html_content, updated_at, updated_by FROM report_document ORDER BY id DESC LIMIT 1
  `;
  if (!row) return c.json({ error: "No report on file." }, 404);
  return c.json({
    html: row.html_content,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    updatedBy: row.updated_by,
  });
});

reportRoutes.get("/pdf", async (c) => {
  const sql = c.get("db");
  const [row] = await sql`SELECT pdf_bytes FROM report_document ORDER BY id DESC LIMIT 1`;
  if (!row || !row.pdf_bytes) return c.json({ error: "No PDF on file." }, 404);
  const disposition = c.req.query("download") ? "attachment" : "inline";
  return new Response(row.pdf_bytes as Uint8Array, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="Library_Analytics_Project_Report.pdf"`,
    },
  });
});

reportRoutes.put("/content", authRequired, managementRequired, async (c) => {
  const sql = c.get("db");
  const data = await c.req.json().catch(() => ({}) as Record<string, unknown>);
  const html = String(data.html ?? "");
  const pdfBase64 = String(data.pdfBase64 ?? "");
  if (!html.trim() || !pdfBase64) {
    return c.json({ error: "Report content and a rendered PDF are both required." }, 400);
  }

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = Buffer.from(pdfBase64, "base64");
    if (!pdfBytes.length) throw new Error("empty");
  } catch {
    return c.json({ error: "The rendered PDF could not be read." }, 400);
  }

  const u = c.get("user");
  const [staffRow] = await sql`SELECT full_name FROM staff WHERE staff_id = ${u.staff_id!}`;
  const updatedBy = staffRow ? staffRow.full_name : u.email;

  const [{ updated_at: updatedAt }] = await sql`
    INSERT INTO report_document (html_content, pdf_bytes, updated_by)
    VALUES (${html}, ${pdfBytes}, ${updatedBy})
    RETURNING updated_at
  `;
  return c.json({ ok: true, updatedAt: new Date(updatedAt).toISOString(), updatedBy });
});

export default reportRoutes;
