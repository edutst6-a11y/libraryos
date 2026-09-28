import { sign, verify } from "hono/jwt";
import { createMiddleware } from "hono/factory";
import type { AppEnv, JwtUser } from "./types";

export async function issueToken(
  payload: Record<string, unknown>,
  secret: string,
  expiryHours: number,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + expiryHours * 3600;
  return sign({ ...payload, exp }, secret, "HS256");
}

async function decodeToken(token: string, secret: string): Promise<JwtUser | null> {
  try {
    return (await verify(token, secret, "HS256")) as JwtUser;
  } catch {
    return null;
  }
}

export const authRequired = createMiddleware<AppEnv>(async (c, next) => {
  const auth = c.req.header("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const payload = token ? await decodeToken(token, c.env.JWT_SECRET) : null;
  if (!payload) return c.json({ error: "Authentication required" }, 401);
  c.set("user", payload);
  return next();
});

export const managementRequired = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("user")?.account_type !== "staff") {
    return c.json({ error: "Management access required" }, 403);
  }
  return next();
});

export const groupAdminRequired = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("user")?.account_type !== "group_admin") {
    return c.json({ error: "Group leader access required" }, 403);
  }
  return next();
});
