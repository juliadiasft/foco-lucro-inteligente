import { createHash, randomBytes } from "node:crypto";
import { deleteCookie, getCookie, getRequestHeader, setCookie } from "@tanstack/react-start/server";

import { query } from "./db.server";

const STAFF_SESSION_HOURS = 12;
const STAFF_COOKIE = "central_staff_session";

export type StaffRole = "admin" | "financeiro" | "suporte";

export type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function clientIp() {
  return (
    (
      getRequestHeader("x-forwarded-for")?.split(",")[0] ??
      getRequestHeader("x-real-ip") ??
      ""
    ).slice(0, 80) || null
  );
}

// A sessão do back office é curta de propósito: 12 horas, contra os 30 dias
// da sessão de cliente. Quem enxerga dado de todas as empresas não fica
// logado por um mês.
export async function createStaffSession(staffId: string) {
  const token = randomBytes(32).toString("base64url");
  await query(
    `INSERT INTO staff_sessions (token_hash,staff_id,expires_at,user_agent,ip_address)
     VALUES ($1,$2,$3,$4,$5)`,
    [
      hashToken(token),
      staffId,
      new Date(Date.now() + STAFF_SESSION_HOURS * 3600_000),
      getRequestHeader("user-agent")?.slice(0, 500) ?? null,
      clientIp(),
    ],
  );
  setCookie(STAFF_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.APP_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STAFF_SESSION_HOURS * 3600,
  });
}

export async function destroyStaffSession() {
  const token = getCookie(STAFF_COOKIE);
  if (token) await query("DELETE FROM staff_sessions WHERE token_hash=$1", [hashToken(token)]);
  deleteCookie(STAFF_COOKIE, { path: "/" });
}

export async function getStaffSession(): Promise<StaffUser | null> {
  const token = getCookie(STAFF_COOKIE);
  if (!token) return null;
  const result = await query<{ id: string; name: string; email: string; role: StaffRole }>(
    `SELECT s.id, s.name, s.email, s.role
       FROM staff_sessions ss
       JOIN staff_users s ON s.id = ss.staff_id AND s.active = true
      WHERE ss.token_hash=$1 AND ss.expires_at > now()
      LIMIT 1`,
    [hashToken(token)],
  );
  const row = result.rows[0];
  if (!row) {
    deleteCookie(STAFF_COOKIE, { path: "/" });
    return null;
  }
  void query("UPDATE staff_sessions SET last_seen_at=now() WHERE token_hash=$1", [
    hashToken(token),
  ]).catch(() => undefined);
  return row;
}

export async function requireStaff(roles?: StaffRole[]) {
  const staff = await getStaffSession();
  if (!staff) throw new Error("UNAUTHORIZED");
  if (roles && !roles.includes(staff.role) && staff.role !== "admin")
    throw new Error("Você não tem permissão para esta área");
  return staff;
}

export async function logStaffAction(
  staff: StaffUser,
  action: string,
  targetCompanyId: string | null = null,
  details: Record<string, unknown> = {},
) {
  await query(
    `INSERT INTO staff_audit_log (staff_id,staff_email,action,target_company_id,details,ip_address)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
    [staff.id, staff.email, action, targetCompanyId, JSON.stringify(details), clientIp()],
  ).catch((error) => console.error("Falha ao registrar auditoria do back office", error));
}
