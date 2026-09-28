export interface Env {
  HYPERDRIVE: Hyperdrive;
  JWT_SECRET: string;
  JWT_EXPIRY_HOURS: string;
  CORS_ALLOWED_ORIGIN: string;
  DB_SCHEMA: string;
}

export type AccountType = "member" | "staff" | "group_admin";

export interface JwtUser {
  account_type: AccountType;
  member_id?: number;
  staff_id?: number;
  email?: string;
  role?: string;
  admin_name?: string;
  exp: number;
  [key: string]: unknown;
}

export type Variables = {
  db: import("postgres").Sql;
  user: JwtUser;
};

export type AppEnv = { Bindings: Env; Variables: Variables };
