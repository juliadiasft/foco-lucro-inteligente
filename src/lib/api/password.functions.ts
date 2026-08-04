import { createHash, randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getAppBaseUrl } from "../server/app-url.server";
import { hashPassword } from "../server/auth.server";
import { query, transaction } from "../server/db.server";
import { consumeRateLimit } from "../server/rate-limit.server";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z
        .string()
        .trim()
        .email()
        .transform((v) => v.toLowerCase()),
    }),
  )
  .handler(async ({ data }) => {
    const allowed = await consumeRateLimit("password-reset", data.email, 3, 30 * 60);
    if (!allowed) return { ok: true };
    const result = await query<{ id: string; email: string }>(
      "SELECT id,email FROM users WHERE email=$1 AND active=true",
      [data.email],
    );
    const user = result.rows[0];
    if (!user) return { ok: true };
    const token = randomBytes(32).toString("base64url");
    await transaction(async (client) => {
      await client.query(
        "DELETE FROM password_reset_tokens WHERE user_id=$1 OR expires_at <= now()",
        [user.id],
      );
      await client.query(
        "INSERT INTO password_reset_tokens (user_id,token_hash,expires_at) VALUES ($1,$2,now()+interval '30 minutes')",
        [user.id, hashToken(token)],
      );
    });
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("Envio de email ainda não foi configurado pelo administrador");
    const baseUrl = getAppBaseUrl();
    const resetUrl = `${baseUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Central do Comerciante <onboarding@resend.dev>",
        to: [user.email],
        subject: "Redefina sua senha — Central do Comerciante",
        html: `<p>Olá.</p><p>Use o link abaixo para criar uma nova senha. Ele expira em 30 minutos.</p><p><a href="${resetUrl}">Redefinir minha senha</a></p><p>Se você não pediu essa alteração, ignore este email.</p>`,
      }),
    });
    if (!response.ok) throw new Error("Não foi possível enviar o email de recuperação");
    return { ok: true };
  });

export const resetPassword = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string().min(20).max(200), password: z.string().min(8).max(128) }))
  .handler(async ({ data }) => {
    const passwordHash = await hashPassword(data.password);
    await transaction(async (client) => {
      const result = await client.query<{ id: string; user_id: string }>(
        "SELECT id,user_id FROM password_reset_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now() FOR UPDATE",
        [hashToken(data.token)],
      );
      const row = result.rows[0];
      if (!row) throw new Error("Link inválido ou expirado");
      await client.query("UPDATE users SET password_hash=$2,updated_at=now() WHERE id=$1", [
        row.user_id,
        passwordHash,
      ]);
      await client.query("UPDATE password_reset_tokens SET used_at=now() WHERE id=$1", [row.id]);
      await client.query("DELETE FROM sessions WHERE user_id=$1", [row.user_id]);
    });
    return { ok: true };
  });
