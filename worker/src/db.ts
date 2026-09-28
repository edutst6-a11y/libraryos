import postgres from "postgres";
import { createMiddleware } from "hono/factory";
import type { AppEnv, Env } from "./types";

// Type overrides so the JSON we send back matches what the old Flask/psycopg2
// backend produced: DATE as a plain "YYYY-MM-DD" string (not a JS Date),
// NUMERIC as a JS number (Python did float(Decimal(...))), and int8/COUNT(*)
// as a JS number rather than postgres.js's default string-for-bigint.
function getDb(env: Env) {
  return postgres(env.HYPERDRIVE.connectionString, {
    max: 5,
    fetch_types: false,
    // All tables live in the "library" schema, not "public" -- the old
    // Flask app did the equivalent with `SET search_path TO library;` on
    // every new connection. Sending it as a startup parameter here does the
    // same thing without an extra round trip.
    connection: {
      search_path: env.DB_SCHEMA || "library",
    },
    types: {
      bigint: {
        to: 20,
        from: [20],
        serialize: (x: unknown) => String(x),
        parse: (x: string) => Number(x),
      },
      numeric: {
        to: 1700,
        from: [1700],
        serialize: (x: unknown) => String(x),
        parse: (x: string) => Number(x),
      },
      date: {
        to: 1082,
        from: [1082],
        serialize: (x: string) => x,
        parse: (x: string) => x,
      },
    },
  });
}

// One postgres.js client per request, closed (via waitUntil, off the
// response's critical path) once the handler finishes -- Hyperdrive is what
// makes this cheap, the same way get_conn() opened a fresh psycopg2
// connection per request in the Flask app.
export const withDb = createMiddleware<AppEnv>(async (c, next) => {
  const sql = getDb(c.env);
  c.set("db", sql);
  try {
    await next();
  } finally {
    c.executionCtx.waitUntil(sql.end());
  }
});

export async function paginate(
  sql: postgres.Sql,
  tableSql: string,
  countSql: string,
  params: unknown[],
  page: number,
  perPage = 15,
) {
  const [countRows, rows] = await Promise.all([
    sql.unsafe(countSql, params as never[]),
    sql.unsafe(tableSql, [...params, perPage, (page - 1) * perPage] as never[]),
  ]);
  const total = Number((countRows[0] as Record<string, unknown>).count);
  return { rows, total, page, per_page: perPage };
}
