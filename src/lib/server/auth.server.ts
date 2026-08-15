import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { deleteCookie, getCookie, getRequestHeader, setCookie } from "@tanstack/react-start/server";

import { hasActiveAccess, type SubscriptionStatus } from "../access";
import type { AccountType } from "../account";
import { query } from "./db.server";
import {
  planIncludes,
  planLabels,
  requiredPlanFor,
  type PlanFeature,
  type PlanName,
} from "../plans";

const scrypt = promisify(scryptCallback);
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone: string | null;
  role: "owner" | "admin" | "operator";
  onboardingComplete: boolean;
  companyName: string;
  accountType: AccountType;
  plan: PlanName;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  suspended: boolean;
};

function cookieName() {
  return process.env.SESSION_COOKIE_NAME || "central_session";
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, saltHex, hashHex] = stored.split("$");
  if (algorithm !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = (await scrypt(password, Buffer.from(saltHex, "hex"), expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  const userAgent = getRequestHeader("user-agent")?.slice(0, 500) ?? null;
  const ipAddress =
    (
      getRequestHeader("x-forwarded-for")?.split(",")[0] ??
      getRequestHeader("x-real-ip") ??
      ""
    ).slice(0, 80) || null;

  await query(
    `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, expiresAt, userAgent, ipAddress],
  );

  setCookie(cookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession() {
  const token = getCookie(cookieName());
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  deleteCookie(cookieName(), { path: "/" });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = getCookie(cookieName());
  if (!token) return null;

  const result = await query<{
    id: string;
    company_id: string;
    name: string;
    email: string;
    phone: string | null;
    role: SessionUser["role"];
    onboarding_complete: boolean;
    company_name: string;
    account_type: AccountType;
    plan: PlanName;
    subscription_status: SessionUser["subscriptionStatus"];
    trial_ends_at: Date;
    current_period_end: Date | null;
    cancel_at_period_end: boolean | null;
    suspended_at: Date | null;
  }>(
    `SELECT u.id, u.company_id, u.name, u.email, u.phone, u.role, u.onboarding_complete,
            c.name AS company_name, c.account_type, c.plan, c.subscription_status, c.trial_ends_at,
            sub.current_period_end, sub.cancel_at_period_end, c.suspended_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id AND u.active = true
       JOIN companies c ON c.id = u.company_id
       LEFT JOIN subscriptions sub ON sub.company_id = c.id
      WHERE s.token_hash = $1 AND s.expires_at > now()
      LIMIT 1`,
    [hashToken(token)],
  );

  const row = result.rows[0];
  if (!row) {
    deleteCookie(cookieName(), { path: "/" });
    return null;
  }

  void query("UPDATE sessions SET last_seen_at = now() WHERE token_hash = $1", [
    hashToken(token),
  ]).catch(() => undefined);

  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    onboardingComplete: row.onboarding_complete,
    companyName: row.company_name,
    accountType: row.account_type,
    plan: row.plan,
    subscriptionStatus: row.subscription_status,
    trialEndsAt: row.trial_ends_at.toISOString(),
    currentPeriodEnd: row.current_period_end?.toISOString() || null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    suspended: row.suspended_at !== null,
  };
}

export async function requireSession() {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export function requireAdmin(user: SessionUser) {
  if (user.role !== "owner" && user.role !== "admin") throw new Error("FORBIDDEN");
}

// A trava de plano vale no servidor. Esconder o botão na tela não impede
// ninguém de chamar a função direto — é o servidor que protege a receita.
export function requireFeature(user: SessionUser, feature: PlanFeature) {
  if (!planIncludes(user.plan, feature))
    throw new Error(
      `Este recurso está disponível a partir do plano ${planLabels[requiredPlanFor(feature)]}.`,
    );
}

export async function requireActiveSession() {
  const user = await requireSession();
  if (!hasActiveAccess(user))
    throw new Error("Seu período de acesso terminou. Escolha um plano para continuar.");
  return user;
}
