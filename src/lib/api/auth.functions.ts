import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  createSession,
  destroySession,
  getSessionUser,
  hashPassword,
  verifyPassword,
} from "../server/auth.server";
import { query, transaction } from "../server/db.server";
import { clearRateLimit, consumeRateLimit } from "../server/rate-limit.server";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(30).optional(),
  email: z
    .string()
    .trim()
    .email()
    .max(200)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "Aceite os termos para continuar" }),
  }),
});

export const registerAccount = createServerFn({ method: "POST" })
  .validator(registerSchema)
  .handler(async ({ data }) => {
    const passwordHash = await hashPassword(data.password);
    try {
      const userId = await transaction(async (client) => {
        const company = await client.query<{ id: string }>(
          "INSERT INTO companies (name) VALUES ($1) RETURNING id",
          [data.company],
        );
        const companyId = company.rows[0].id;
        const user = await client.query<{ id: string }>(
          `INSERT INTO users (company_id, name, email, phone, password_hash, role, terms_accepted_at, terms_version)
           VALUES ($1, $2, $3, $4, $5, 'owner', now(), '2026-08-04') RETURNING id`,
          [companyId, data.name, data.email, data.phone || null, passwordHash],
        );
        await client.query(
          `INSERT INTO subscriptions (company_id, plan, status)
           VALUES ($1, 'profissional', 'trialing')`,
          [companyId],
        );
        return user.rows[0].id;
      });
      await createSession(userId);
      return { ok: true };
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        throw new Error("Este email já está cadastrado");
      throw error;
    }
  });

export const loginAccount = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z
        .string()
        .trim()
        .email()
        .transform((v) => v.toLowerCase()),
      password: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const allowed = await consumeRateLimit("login", data.email, 10, 15 * 60);
    if (!allowed) throw new Error("Email ou senha inválidos");
    const result = await query<{ id: string; password_hash: string; active: boolean }>(
      "SELECT id, password_hash, active FROM users WHERE email = $1 LIMIT 1",
      [data.email],
    );
    const user = result.rows[0];
    if (!user || !user.active || !(await verifyPassword(data.password, user.password_hash))) {
      throw new Error("Email ou senha inválidos");
    }
    await clearRateLimit("login", data.email);
    await query("DELETE FROM sessions WHERE user_id = $1 AND expires_at <= now()", [user.id]);
    await createSession(user.id);
    return { ok: true };
  });

export const logoutAccount = createServerFn({ method: "POST" }).handler(async () => {
  await destroySession();
  return { ok: true };
});

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () =>
  getSessionUser(),
);
