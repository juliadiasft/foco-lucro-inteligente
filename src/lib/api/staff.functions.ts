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
  const [byPlan, funil, movimento, canceladasMes, marketplace, operacional, aiUsage, orders] =
    await Promise.all([
      query<{ account_type: AccountType; plan: PlanName; status: string; total: string }>(
        `SELECT account_type, plan, subscription_status status, count(*)::text total
           FROM companies GROUP BY account_type, plan, subscription_status`,
      ),
      query<{
        total: string;
        em_teste: string;
        ativas: string;
        vencendo: string;
        vencidas: string;
        novas_mes: string;
      }>(
        `SELECT count(*)::text total,
                count(*) FILTER (WHERE subscription_status='trialing'
                                   AND trial_ends_at > now())::text em_teste,
                count(*) FILTER (WHERE subscription_status='active')::text ativas,
                count(*) FILTER (WHERE subscription_status='trialing'
                                   AND trial_ends_at BETWEEN now() AND now() + interval '2 days')::text vencendo,
                count(*) FILTER (WHERE subscription_status='trialing'
                                   AND trial_ends_at <= now())::text vencidas,
                count(*) FILTER (WHERE created_at >= date_trunc('month', now()))::text novas_mes
           FROM companies`,
      ),
      // Movimento real do mês vem dos eventos já processados da Cakto, não de
      // uma leitura do estado atual: o estado atual não sabe o que aconteceu
      // e voltou atrás dentro do mesmo mês.
      query<{ event_type: string; total: string }>(
        `SELECT event_type, count(*)::text total
           FROM billing_webhook_events
          WHERE processed_at >= date_trunc('month', now())
          GROUP BY event_type`,
      ),
      query<{ plan: PlanName; total: string }>(
        `SELECT plan, count(*)::text total
           FROM companies
          WHERE subscription_status='canceled' AND updated_at >= date_trunc('month', now())
          GROUP BY plan`,
      ),
      query<{
        fornecedores: string;
        publicadas: string;
        itens: string;
        conversas_mes: string;
      }>(
        `SELECT (SELECT count(*) FROM companies WHERE account_type='fornecedor')::text fornecedores,
                (SELECT count(*) FROM supplier_profiles WHERE published=true)::text publicadas,
                (SELECT count(*) FROM supplier_offerings WHERE active=true)::text itens,
                (SELECT count(*) FROM conversations
                  WHERE created_at >= date_trunc('month', now()))::text conversas_mes`,
      ),
      query<{ suspensas: string; cobrancas: string }>(
        `SELECT (SELECT count(*) FROM companies WHERE suspended_at IS NOT NULL)::text suspensas,
                (SELECT count(*) FROM billing_webhook_failures
                  WHERE resolved_at IS NULL)::text cobrancas`,
      ),
      query<{ perguntas: string; entrada: string; saida: string; empresas: string }>(
        `SELECT count(*)::text perguntas,
                coalesce(sum(prompt_tokens),0)::text entrada,
                coalesce(sum(output_tokens),0)::text saida,
                count(DISTINCT company_id)::text empresas
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
  const porPlano = new Map<PlanName, { contas: number; mrr: number }>();
  for (const row of byPlan.rows) {
    if (row.status !== "active") continue;
    const contas = Number(row.total);
    const valor = planPricesBRL[row.plan] * contas;
    mrr += valor;
    ativos += contas;
    if (row.account_type === "fornecedor") mrrFornecedor += valor;
    else mrrComerciante += valor;
    const atual = porPlano.get(row.plan) || { contas: 0, mrr: 0 };
    porPlano.set(row.plan, { contas: atual.contas + contas, mrr: atual.mrr + valor });
  }

  const evento = (tipo: string) =>
    Number(movimento.rows.find((row) => row.event_type === tipo)?.total || 0);
  const novas = evento("purchase_approved") + evento("subscription_created");
  const renovacoes = evento("subscription_renewed");
  const cancelamentos = evento("subscription_canceled") + evento("refund") + evento("chargeback");
  const falhasPagamento = evento("subscription_renewal_refused");

  const mrrPerdido = canceladasMes.rows.reduce(
    (soma, row) => soma + planPricesBRL[row.plan] * Number(row.total),
    0,
  );

  // Churn sobre a base do início do mês, reconstruída somando de volta quem
  // saiu. É aproximado e está rotulado como tal na tela.
  const baseInicial = ativos + cancelamentos;
  const churn = baseInicial > 0 ? (cancelamentos / baseInicial) * 100 : 0;

  const totalContas = Number(funil.rows[0].total);

  return {
    receita: {
      mrr,
      arr: mrr * 12,
      arpu: ativos > 0 ? mrr / ativos : 0,
      mrrComerciante,
      mrrFornecedor,
      porPlano: [...porPlano.entries()].map(([plan, valores]) => ({ plan, ...valores })),
    },
    movimento: {
      novas,
      renovacoes,
      cancelamentos,
      falhasPagamento,
      mrrPerdido,
      churn,
    },
    funil: {
      totalContas,
      emTeste: Number(funil.rows[0].em_teste),
      ativas: ativos,
      novasMes: Number(funil.rows[0].novas_mes),
      testesVencendo: Number(funil.rows[0].vencendo),
      testesVencidos: Number(funil.rows[0].vencidas),
      conversao: totalContas > 0 ? (ativos / totalContas) * 100 : 0,
    },
    marketplace: {
      fornecedores: Number(marketplace.rows[0].fornecedores),
      vitrinesPublicadas: Number(marketplace.rows[0].publicadas),
      itensCatalogo: Number(marketplace.rows[0].itens),
      conversasMes: Number(marketplace.rows[0].conversas_mes),
      pedidosMes: Number(orders.rows[0].total),
      valorPedidosMes: Number(orders.rows[0].valor),
    },
    operacional: {
      suspensas: Number(operacional.rows[0].suspensas),
      cobrancasPendentes: Number(operacional.rows[0].cobrancas),
    },
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
      empresas: Number(aiUsage.rows[0].empresas),
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

export const getCustomer = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const staff = await requireStaff();
    const [company, users, atividade] = await Promise.all([
      query<{
        id: string;
        name: string;
        account_type: AccountType;
        plan: PlanName;
        subscription_status: string;
        trial_ends_at: Date;
        city: string | null;
        uf: string | null;
        created_at: Date;
        suspended_at: Date | null;
        suspended_reason: string | null;
        document_type: string | null;
        document_last4: string | null;
        subscription_id: string | null;
        current_period_end: Date | null;
      }>(
        `SELECT c.id,c.name,c.account_type,c.plan,c.subscription_status,c.trial_ends_at,
                c.city,c.uf,c.created_at,c.suspended_at,c.suspended_reason,
                t.document_type,t.document_last4,
                s.subscription_id,s.current_period_end
           FROM companies c
           LEFT JOIN trial_identity_claims t ON t.company_id=c.id
           LEFT JOIN subscriptions s ON s.company_id=c.id
          WHERE c.id=$1`,
        [data.id],
      ),
      query<{ name: string; email: string; role: string; active: boolean; created_at: Date }>(
        "SELECT name,email,role,active,created_at FROM users WHERE company_id=$1 ORDER BY created_at",
        [data.id],
      ),
      query<{ produtos: string; pedidos: string; conversas: string; perguntas_ia: string }>(
        `SELECT (SELECT count(*) FROM products WHERE company_id=$1 AND active=true)::text produtos,
                (SELECT count(*) FROM purchase_orders
                  WHERE merchant_company_id=$1 OR supplier_company_id=$1)::text pedidos,
                (SELECT count(*) FROM conversations
                  WHERE merchant_company_id=$1 OR supplier_company_id=$1)::text conversas,
                (SELECT count(*) FROM ai_usage WHERE company_id=$1)::text perguntas_ia`,
        [data.id],
      ),
    ]);
    const row = company.rows[0];
    if (!row) throw new Error("Cliente não encontrado");

    // Abrir a ficha de um cliente é o acesso mais sensível do back office.
    await logStaffAction(staff, "abrir_ficha_cliente", row.id, { empresa: row.name });

    return {
      id: row.id,
      name: row.name,
      accountType: row.account_type,
      plan: row.plan,
      subscriptionStatus: row.subscription_status,
      trialEndsAt: row.trial_ends_at.toISOString(),
      city: row.city,
      uf: row.uf,
      createdAt: row.created_at.toISOString(),
      suspendedAt: row.suspended_at?.toISOString() || null,
      suspendedReason: row.suspended_reason,
      // Nunca o documento completo: apenas o tipo e os quatro últimos
      // dígitos, que é o que a Central guarda.
      documento:
        row.document_type && row.document_last4
          ? `${row.document_type.toUpperCase()} •••${row.document_last4}`
          : null,
      subscriptionId: row.subscription_id,
      currentPeriodEnd: row.current_period_end?.toISOString() || null,
      usuarios: users.rows.map((user) => ({
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
        createdAt: user.created_at.toISOString(),
      })),
      atividade: {
        produtos: Number(atividade.rows[0].produtos),
        pedidos: Number(atividade.rows[0].pedidos),
        conversas: Number(atividade.rows[0].conversas),
        perguntasIa: Number(atividade.rows[0].perguntas_ia),
      },
    };
  });

export const extendTrial = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid(), days: z.number().int().min(1).max(60) }))
  .handler(async ({ data }) => {
    const staff = await requireStaff(["admin"]);
    const updated = await query<{ trial_ends_at: Date }>(
      `UPDATE companies
          SET trial_ends_at = greatest(trial_ends_at, now()) + ($2 || ' days')::interval,
              updated_at = now()
        WHERE id=$1 RETURNING trial_ends_at`,
      [data.id, String(data.days)],
    );
    if (!updated.rows[0]) throw new Error("Cliente não encontrado");
    await logStaffAction(staff, "estender_teste", data.id, { dias: data.days });
    return { trialEndsAt: updated.rows[0].trial_ends_at.toISOString() };
  });

export const setCustomerSuspension = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid(),
      suspended: z.boolean(),
      reason: z.string().trim().max(300).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const staff = await requireStaff(["admin"]);
    await query(
      `UPDATE companies
          SET suspended_at = CASE WHEN $2::boolean THEN now() ELSE NULL END,
              suspended_reason = CASE WHEN $2::boolean THEN $3 ELSE NULL END,
              updated_at = now()
        WHERE id=$1`,
      [data.id, data.suspended, data.reason || null],
    );
    // Suspender sem encerrar as sessões abertas não suspende nada: quem já
    // estava dentro continuaria usando até o cookie expirar.
    if (data.suspended)
      await query(
        "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE company_id=$1)",
        [data.id],
      );
    await logStaffAction(staff, data.suspended ? "suspender_conta" : "reativar_conta", data.id, {
      motivo: data.reason || null,
    });
    return { ok: true };
  });

export const listAuditLog = createServerFn({ method: "GET" }).handler(async () => {
  await requireStaff(["admin"]);
  const result = await query<{
    id: string;
    staff_email: string | null;
    action: string;
    company_name: string | null;
    details: Record<string, unknown>;
    ip_address: string | null;
    created_at: Date;
  }>(
    `SELECT a.id,a.staff_email,a.action,c.name company_name,a.details,a.ip_address,a.created_at
       FROM staff_audit_log a
       LEFT JOIN companies c ON c.id=a.target_company_id
      ORDER BY a.created_at DESC
      LIMIT 300`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    staffEmail: row.staff_email,
    action: row.action,
    companyName: row.company_name,
    details: JSON.stringify(row.details),
    ipAddress: row.ip_address,
    createdAt: row.created_at.toISOString(),
  }));
});

export const listStaff = createServerFn({ method: "GET" }).handler(async () => {
  await requireStaff(["admin"]);
  const result = await query<{
    id: string;
    name: string;
    email: string;
    role: string;
    active: boolean;
    created_at: Date;
  }>("SELECT id,name,email,role,active,created_at FROM staff_users ORDER BY created_at");
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: row.active,
    createdAt: row.created_at.toISOString(),
  }));
});

export const setStaffActive = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid(), active: z.boolean() }))
  .handler(async ({ data }) => {
    const staff = await requireStaff(["admin"]);
    // Sem esta trava, um administrador consegue se desativar sozinho e
    // ninguém mais entra no back office.
    if (staff.id === data.id) throw new Error("Você não pode desativar a própria conta");
    await query("UPDATE staff_users SET active=$2,updated_at=now() WHERE id=$1", [
      data.id,
      data.active,
    ]);
    if (!data.active) await query("DELETE FROM staff_sessions WHERE staff_id=$1", [data.id]);
    await logStaffAction(staff, data.active ? "ativar_equipe" : "desativar_equipe", null, {
      alvo: data.id,
    });
    return { ok: true };
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
