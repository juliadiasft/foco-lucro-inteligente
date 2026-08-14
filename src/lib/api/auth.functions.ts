import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { validateBrazilianDocument } from "../brazilian-document";
import {
  createSession,
  destroySession,
  getSessionUser,
  hashPassword,
  verifyPassword,
} from "../server/auth.server";
import { query, transaction } from "../server/db.server";
import { clearRateLimit, consumeRateLimit } from "../server/rate-limit.server";
import { hashTrialDocument } from "../server/trial-identity.server";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(30).optional(),
  document: z.string().trim().min(11).max(24),
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
    const document = validateBrazilianDocument(data.document);
    if (!document) throw new Error("Informe um CPF ou CNPJ válido");
    const documentHash = hashTrialDocument(document.normalized);
    const allowed = await consumeRateLimit("register", documentHash, 5, 60 * 60);
    if (!allowed) throw new Error("Muitas tentativas de cadastro. Tente novamente mais tarde.");
    const passwordHash = await hashPassword(data.password);
    try {
      const userId = await transaction(async (client) => {
        const company = await client.query<{ id: string }>(
          "INSERT INTO companies (name) VALUES ($1) RETURNING id",
          [data.company],
        );
        const companyId = company.rows[0].id;
        await client.query(
          `INSERT INTO trial_identity_claims (document_hash,document_type,document_last4,company_id)
           VALUES ($1,$2,$3,$4)`,
          [documentHash, document.type, document.last4, companyId],
        );
        const user = await client.query<{ id: string }>(
          `INSERT INTO users (company_id, name, email, phone, password_hash, role, terms_accepted_at, terms_version)
           VALUES ($1, $2, $3, $4, $5, 'owner', now(), '2026-08-12') RETURNING id`,
          [companyId, data.name, data.email, data.phone || null, passwordHash],
        );
        await client.query(
          `INSERT INTO subscriptions (company_id, plan, status)
           VALUES ($1, 'profissional', 'trialing')`,
          [companyId],
        );
        return user.rows[0].id;
      });
      await clearRateLimit("register", documentHash);
      await createSession(userId);
      return { ok: true };
    } catch (error) {
      const databaseError = error as { code?: string; constraint?: string };
      if (databaseError.code === "23505") {
        if (databaseError.constraint === "trial_identity_claims_pkey")
          throw new Error("Este CPF ou CNPJ já utilizou o teste grátis");
        throw new Error("Este email já está cadastrado");
      }
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
