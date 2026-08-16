import { createHash, randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { planLimits, type PlanName } from "../plans";
import { getAppBaseUrl } from "../server/app-url.server";
import {
  createSession,
  hashPassword,
  requireActiveSession,
  requireAdmin,
} from "../server/auth.server";
import { query, transaction } from "../server/db.server";

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export const listTeam = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  requireAdmin(user);
  const [members, invites] = await Promise.all([
    query<{
      id: string;
      name: string;
      email: string;
      phone: string | null;
      role: string;
      active: boolean;
      created_at: Date;
    }>(
      "SELECT id,name,email,phone,role,active,created_at FROM users WHERE company_id=$1 ORDER BY created_at",
      [user.companyId],
    ),
    query<{ id: string; email: string; role: string; expires_at: Date; created_at: Date }>(
      "SELECT id,email,role,expires_at,created_at FROM invitations WHERE company_id=$1 AND accepted_at IS NULL AND expires_at > now() ORDER BY created_at DESC",
      [user.companyId],
    ),
  ]);
  return {
    members: members.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      active: row.active,
      createdAt: row.created_at.toISOString(),
    })),
    invites: invites.rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      expiresAt: row.expires_at.toISOString(),
      createdAt: row.created_at.toISOString(),
    })),
    limit: planLimits[user.plan].users,
    usedSeats: members.rows.filter((member) => member.active).length + invites.rows.length,
  };
});

export const createInvitation = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z
        .string()
        .trim()
        .email()
        .transform((v) => v.toLowerCase()),
      role: z.enum(["admin", "operator"]),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    requireAdmin(user);
    const existing = await query("SELECT 1 FROM users WHERE email=$1", [data.email]);
    if (existing.rows[0]) throw new Error("Este email já possui uma conta");
    const token = randomBytes(32).toString("base64url");
    await transaction(async (client) => {
      const company = await client.query<{ plan: PlanName }>(
        "SELECT plan FROM companies WHERE id=$1 FOR UPDATE",
        [user.companyId],
      );
      const counts = await client.query<{ total: string }>(
        `SELECT ((SELECT count(*) FROM users WHERE company_id=$1 AND active=true) +
                 (SELECT count(*) FROM invitations
                   WHERE company_id=$1 AND email<>$2 AND accepted_at IS NULL AND expires_at > now()))::text total`,
        [user.companyId, data.email],
      );
      if (Number(counts.rows[0].total) >= planLimits[company.rows[0].plan].users)
        throw new Error("Limite de usuários do plano atingido");
      await client.query(
        `INSERT INTO invitations (company_id,email,role,token_hash,expires_at,invited_by)
         VALUES ($1,$2,$3,$4,now()+interval '7 days',$5)
         ON CONFLICT (company_id,email) DO UPDATE SET role=excluded.role,token_hash=excluded.token_hash,expires_at=excluded.expires_at,accepted_at=NULL,invited_by=excluded.invited_by,created_at=now()`,
        [user.companyId, data.email, data.role, tokenHash(token), user.id],
      );
    });
    const baseUrl = getAppBaseUrl();
    return { inviteUrl: `${baseUrl}/convite/${token}` };
  });

export const cancelInvitation = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    requireAdmin(user);
    await query("DELETE FROM invitations WHERE id=$1 AND company_id=$2 AND accepted_at IS NULL", [
      data.id,
      user.companyId,
    ]);
    return { ok: true };
  });

export const updateTeamMember = createServerFn({ method: "POST" })
  .validator(
    z.object({ id: z.string().uuid(), role: z.enum(["admin", "operator"]), active: z.boolean() }),
  )
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    requireAdmin(user);
    if (data.id === user.id) throw new Error("Você não pode alterar sua própria conta por aqui");
    await transaction(async (client) => {
      const company = await client.query<{ plan: PlanName }>(
        "SELECT plan FROM companies WHERE id=$1 FOR UPDATE",
        [user.companyId],
      );
      const target = await client.query<{ active: boolean }>(
        "SELECT active FROM users WHERE id=$1 AND company_id=$2 AND role<>'owner'",
        [data.id, user.companyId],
      );
      if (!target.rows[0]) throw new Error("Usuário não encontrado");
      if (data.active && !target.rows[0].active) {
        const active = await client.query<{ total: string }>(
          "SELECT count(*)::text total FROM users WHERE company_id=$1 AND active=true",
          [user.companyId],
        );
        if (Number(active.rows[0].total) >= planLimits[company.rows[0].plan].users)
          throw new Error("Limite de usuários do plano atingido");
      }
      await client.query(
        "UPDATE users SET role=$3,active=$4,updated_at=now() WHERE id=$1 AND company_id=$2 AND role <> 'owner'",
        [data.id, user.companyId, data.role, data.active],
      );
    });
    if (!data.active) await query("DELETE FROM sessions WHERE user_id=$1", [data.id]);
    return { ok: true };
  });

export const getInvitation = createServerFn({ method: "GET" })
  .validator(z.object({ token: z.string().min(20).max(200) }))
  .handler(async ({ data }) => {
    const result = await query<{ email: string; role: string; company_name: string }>(
      `SELECT i.email,i.role,c.name company_name FROM invitations i JOIN companies c ON c.id=i.company_id
       WHERE i.token_hash=$1 AND i.accepted_at IS NULL AND i.expires_at > now()`,
      [tokenHash(data.token)],
    );
    if (!result.rows[0]) throw new Error("Convite inválido ou expirado");
    return {
      email: result.rows[0].email,
      role: result.rows[0].role,
      companyName: result.rows[0].company_name,
    };
  });

export const acceptInvitation = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: z.string().min(20).max(200),
      name: z.string().trim().min(2).max(120),
      phone: z.string().trim().max(30).optional(),
      password: z.string().min(8).max(128),
      acceptedTerms: z.literal(true, {
        errorMap: () => ({ message: "Aceite os termos para continuar" }),
      }),
    }),
  )
  .handler(async ({ data }) => {
    const hash = tokenHash(data.token);
    const passwordHash = await hashPassword(data.password);
    const userId = await transaction(async (client) => {
      const preview = await client.query<{
        id: string;
        company_id: string;
        email: string;
        role: "admin" | "operator";
      }>(
        "SELECT id,company_id,email,role FROM invitations WHERE token_hash=$1 AND accepted_at IS NULL AND expires_at > now()",
        [hash],
      );
      if (!preview.rows[0]) throw new Error("Convite inválido ou expirado");
      const company = await client.query<{ plan: PlanName }>(
        "SELECT plan FROM companies WHERE id=$1 FOR UPDATE",
        [preview.rows[0].company_id],
      );
      const invite = await client.query<{
        id: string;
        company_id: string;
        email: string;
        role: "admin" | "operator";
      }>(
        "SELECT id,company_id,email,role FROM invitations WHERE token_hash=$1 AND accepted_at IS NULL AND expires_at > now() FOR UPDATE",
        [hash],
      );
      const row = invite.rows[0];
      if (!row) throw new Error("Convite inválido ou expirado");
      const active = await client.query<{ total: string }>(
        "SELECT count(*)::text total FROM users WHERE company_id=$1 AND active=true",
        [row.company_id],
      );
      if (Number(active.rows[0].total) >= planLimits[company.rows[0].plan].users)
        throw new Error("O limite de usuários deste plano foi atingido");
      const created = await client.query<{ id: string }>(
        `INSERT INTO users (company_id,name,email,phone,password_hash,role,onboarding_complete,terms_accepted_at,terms_version)
         VALUES ($1,$2,$3,$4,$5,$6,true,now(),'2026-08-04') RETURNING id`,
        [row.company_id, data.name, row.email, data.phone || null, passwordHash, row.role],
      );
      await client.query("UPDATE invitations SET accepted_at=now() WHERE id=$1", [row.id]);
      return created.rows[0].id;
    });
    await createSession(userId);
    return { ok: true };
  });
