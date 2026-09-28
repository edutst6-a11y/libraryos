import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "./types";
import { withDb } from "./db";
import authRoutes from "./routes/auth";
import publicRoutes from "./routes/public";
import reportRoutes from "./routes/report";
import groupRoutes from "./routes/group";
import statsRoutes from "./routes/stats";
import tableRoutes from "./routes/tables";
import chartRoutes from "./routes/charts";
import queryRoutes from "./routes/queries";

const app = new Hono<AppEnv>();

app.use("/api/*", async (c, next) => {
  const allowed = c.env.CORS_ALLOWED_ORIGIN;
  const mw = cors({
    origin: allowed === "*" ? "*" : allowed.split(",").map((o) => o.trim()),
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  return mw(c, next);
});
app.use("/api/*", withDb);

app.route("/api/auth", authRoutes);
app.route("/api", publicRoutes);
app.route("/api/report", reportRoutes);
app.route("/api/group", groupRoutes);
app.route("/api", statsRoutes);
app.route("/api", tableRoutes);
app.route("/api/charts", chartRoutes);
app.route("/api/queries", queryRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
