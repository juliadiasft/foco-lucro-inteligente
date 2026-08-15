import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { AccountType } from "../account";
import { planPricesBRL, type PlanName } from "../plans";
import { verifyPassword } from "../server/auth.server";
import { query } from "../server/db.server";
import { consumeRateLimit } from "../server/rate-limit.server";
import {
  createStaffSession,
  destroyStaffSession,
  getStaffSession,
  logStaffAction,
  requireStaff,
} from "../server/staff.server";

export const staffLogin = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z
        .string()
        .trim()
        .email()
        .transform((value) => value.toLowerCase()),
      password: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const allowed = await consumeRateLimit("staff-login", data.email, 5, 15 * 60);
    if (!allowed) throw new Error("Email ou senha inválidos");
    const result = await query<{
      id: string;
      name: string;
      email: string;
      role: "admin" | "financeiro" | "suporte";
      password_hash: string;
    }>("SELECT id,name,email,role,password_hash FROM staff_users WHERE email=$1 AND active=true", [
      data.email,
    ]);
    const staff = result.rows[0];
    if (!staff || !(await verifyPassword(data.password, staff.password_hash)))
      throw new Error("Email ou senha inválidos");
    await createStaffSession(staff.id);
    await logStaffAction(staff, "login");
    return { ok: true };
  });

export const staffLogout = createServerFn({ method: "POST" }).handler(async () => {
  await destroyStaffSession();
  return { ok: true };
});

export const getStaffUser = createServerFn({ method: "GET" }).handler(async () =>
  getStaffSession(),
);

export const getStaffOverview = createServerFn({ method: "GET" }).handler(async () => {
  await requireStaff(["admin", "financeiro"]);
  const [byPlan, trials, aiUsage, orders] = await Promise.all([
    query<{ account_type: AccountType; plan: PlanName; status: string; total: string }>(
      `SELECT account_type, plan, subscription_status status, count(*)::text total
         FROM companies GROUP BY account_type, plan, subscription_status`,
    ),
    query<{ total: string; expirando: string }>(
      `SELECT count(*) FILTER (WHERE subscription_status='trialing')::text total,
              count(*) FILTER (WHERE subscription_status='trialing'
                                 AND trial_ends_at < now() + interval '2 days')::text expirando
         FROM companies`,
    ),
    query<{ perguntas: string; entrada: string; saida: string }>(
      `SELECT count(*)::text perguntas,
              coalesce(sum(prompt_tokens),0)::text entrada,
              coalesce(sum(output_tokens),0)::text saida
         FROM ai_usage WHERE created_at >= date_trunc('month', now())`,
    ),
    query<{ total: string; valor: string }>(
      `SELECT count(*)::text total, coalesce(sum(total),0)::text valor
         FROM purchase_orders WHERE created_at >= date_trunc('month', now())`,
    ),
  ]);

  // Receita recorrente contando apenas assinatura ativa. Teste em andamento
  // não é receita, e misturar os dois esconde o que realmente entra.
  let mrr = 0;
  let mrrComerciante = 0;
  let mrrFornecedor = 0;
  let ativos = 0;
  for (const row of byPlan.rows) {
    if (row.status !== "active") continue;
    const valor = planPricesBRL[row.plan] * Number(row.total);
    mrr += valor;
    ativos += Number(row.total);
    if (row.account_type === "fornecedor") mrrFornecedor += valor;
    else mrrComerciante += valor;
  }

  return {
    mrr,
    mrrComerciante,
    mrrFornecedor,
    ativos,
    trials: Number(trials.rows[0].total),
    trialsExpirando: Number(trials.rows[0].expirando),
    contasPorTipo: byPlan.rows.map((row) => ({
      accountType: row.account_type,
      plan: row.plan,
      status: row.status,
      total: Number(row.total),
    })),
    ia: {
      perguntas: Number(aiUsage.rows[0].perguntas),
      tokensEntrada: Number(aiUsage.rows[0].entrada),
      tokensSaida: Number(aiUsage.rows[0].saida),
    },
    pedidos: {
      total: Number(orders.rows[0].total),
      valor: Number(orders.rows[0].valor),
    },
  };
});

export const listCustomers = createServerFn({ method: "POST" })
  .validator(
    z.object({
      search: z.string().trim().max(120).optional(),
      accountType: z.enum(["comerciante", "fornecedor"]).optional(),
      status: z.string().trim().max(20).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const staff = await requireStaff();
    const result = await query<{
      id: string;
      name: string;
      account_type: AccountType;
      plan: PlanName;
      subscription_status: string;
      trial_ends_at: Date;
      city: string | null;
      uf: string | null;
      created_at: Date;
      owner_email: string | null;
      usuarios: string;
      itens: string;
    }>(
      `SELECT c.id,c.name,c.account_type,c.plan,c.subscription_status,c.trial_ends_at,
              c.city,c.uf,c.created_at,
              (SELECT u.email FROM users u
                WHERE u.company_id=c.id AND u.role='owner' ORDER BY u.created_at LIMIT 1) owner_email,
              (SELECT count(*) FROM users u WHERE u.company_id=c.id AND u.active=true)::text usuarios,
              (CASE WHEN c.account_type='fornecedor'
                    THEN (SELECT count(*) FROM supplier_offerings o
                           WHERE o.company_id=c.id AND o.active=true)
                    ELSE (SELECT count(*) FROM products p
                           WHERE p.company_id=c.id AND p.active=true) END)::text itens
         FROM companies c
        WHERE ($1::text IS NULL OR c.name ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR c.account_type = $2)
          AND ($3::text IS NULL OR c.subscription_status = $3)
        ORDER BY c.created_at DESC
        LIMIT 200`,
      [data.search || null, data.accountType || null, data.status || null],
    );

    // Consultar a base de clientes fica registrado. O detalhe do que foi
    // filtrado ajuda a entender o acesso depois.
    await logStaffAction(staff, "listar_clientes", null, {
      busca: data.search || null,
      tipo: data.accountType || null,
      status: data.status || null,
      resultados: result.rows.length,
    });

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      accountType: row.account_type,
      plan: row.plan,
      subscriptionStatus: row.subscription_status,
      trialEndsAt: row.trial_ends_at.toISOString(),
      city: row.city,
      uf: row.uf,
      createdAt: row.created_at.toISOString(),
      ownerEmail: row.owner_email,
      usuarios: Number(row.usuarios),
      itens: Number(row.itens),
    }));
  });

export const listBillingFailures = createServerFn({ method: "GET" }).handler(async () => {
  await requireStaff(["admin", "financeiro"]);
  const result = await query<{
    id: string;
    event_type: string;
    reason: string;
    customer_email: string | null;
    subscription_id: string | null;
    created_at: Date;
    company_name: string | null;
  }>(
    `SELECT f.id,f.event_type,f.reason,f.customer_email,f.subscription_id,f.created_at,
            c.name company_name
       FROM billing_webhook_failures f
       LEFT JOIN companies c ON c.id = f.company_id
      WHERE f.resolved_at IS NULL
      ORDER BY f.created_at DESC
      LIMIT 100`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    reason: row.reason,
    customerEmail: row.customer_email,
    subscriptionId: row.subscription_id,
    createdAt: row.created_at.toISOString(),
    companyName: row.company_name,
  }));
});

export const resolveBillingFailure = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const staff = await requireStaff(["admin", "financeiro"]);
    await query("UPDATE billing_webhook_failures SET resolved_at=now() WHERE id=$1", [data.id]);
    await logStaffAction(staff, "resolver_cobranca", null, { evento: data.id });
    return { ok: true };
  });
