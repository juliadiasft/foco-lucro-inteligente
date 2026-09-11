import { createHash, randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { motivoDoBloqueio, type SubscriptionStatus } from "../access";
import { planLabels, planLimits, type BillingCycle, type PlanName } from "../plans";
import { requireAdmin, requireSession } from "../server/auth.server";
import {
  annualCycleAvailable,
  caktoCheckoutUrl,
  caktoOfferId,
  caktoRequest,
} from "../server/cakto.server";
import { query, transaction } from "../server/db.server";

const planSchema = z.enum(["essencial", "profissional", "premium"]);
const cycleSchema = z.enum(["mensal", "anual"]).default("mensal");

function hashCheckoutToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const getBillingStatus = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  const result = await query<{
    plan: "essencial" | "profissional" | "premium";
    subscription_status: string;
    trial_ends_at: Date;
    subscription_id: string | null;
    current_period_end: Date | null;
    cancel_at_period_end: boolean;
  }>(
    `SELECT c.plan,c.subscription_status,c.trial_ends_at,s.subscription_id,
            s.current_period_end,s.cancel_at_period_end
       FROM companies c LEFT JOIN subscriptions s ON s.company_id=c.id WHERE c.id=$1`,
    [user.companyId],
  );
  const row = result.rows[0];
  // Por que o acesso está bloqueado, se estiver.
  //
  // Sem isto a tela mostrava "Status: Teste grátis" mesmo depois de o teste
  // ter vencido, e a data do vencimento aparecia como se fosse informação de
  // rodapé. Quem batia aqui vindo de uma tela bloqueada não entendia que tinha
  // sido bloqueado, nem por quê — parecia o sistema quebrado.
  const bloqueio = motivoDoBloqueio({
    subscriptionStatus: row.subscription_status as SubscriptionStatus,
    trialEndsAt: row.trial_ends_at.toISOString(),
    currentPeriodEnd: row.current_period_end?.toISOString() || null,
    suspended: user.suspended,
    accountType: user.accountType,
    contaDaCasa: user.contaDaCasa,
  });
  return {
    plan: row.plan,
    planLabel: planLabels[row.plan],
    status: row.subscription_status,
    trialEndsAt: row.trial_ends_at.toISOString(),
    currentPeriodEnd: row.current_period_end?.toISOString() || null,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    hasSubscription: Boolean(row.subscription_id),
    bloqueio,
  };
});

// A tela so oferece o anual quando os checkouts anuais existem de verdade.
// Sem isso o cliente clicaria numa opcao que estoura no servidor — o mesmo
// cuidado que a IA tem quando nao ha chave configurada.
// Publica de proposito: devolve apenas se o ciclo anual existe, o que a
// pagina de planos precisa saber antes de qualquer login. Nao expoe endereco
// de checkout nem dado de empresa.
export const getBillingOptions = createServerFn({ method: "GET" }).handler(async () => {
  return {
    anualDisponivel: {
      essencial: annualCycleAvailable("essencial"),
      profissional: annualCycleAvailable("profissional"),
      premium: annualCycleAvailable("premium"),
    },
  };
});

export const startCheckout = createServerFn({ method: "POST" })
  .validator(z.object({ plan: planSchema, cycle: cycleSchema }))
  .handler(async ({ data }) => {
    const user = await requireSession();
    requireAdmin(user);
    const selectedPlan = data.plan as PlanName;
    const selectedCycle = data.cycle as BillingCycle;
    const seats = await query<{ total: string }>(
      "SELECT count(*)::text total FROM users WHERE company_id=$1 AND active=true",
      [user.companyId],
    );
    if (Number(seats.rows[0].total) > planLimits[selectedPlan].users)
      throw new Error(
        `Este plano aceita até ${planLimits[selectedPlan].users} usuário(s). Desative pessoas antes de continuar.`,
      );
    // Sem esta checagem, uma troca para um plano menor deixava a empresa
    // acima do limite indefinidamente: a trava de produtos só barra
    // cadastros novos, nunca o que já existe.
    const productLimit = planLimits[selectedPlan].products;
    if (Number.isFinite(productLimit)) {
      const products = await query<{ total: string }>(
        "SELECT count(*)::text total FROM products WHERE company_id=$1 AND active=true",
        [user.companyId],
      );
      if (Number(products.rows[0].total) > productLimit)
        throw new Error(
          `Este plano aceita até ${productLimit} produtos e você tem ${products.rows[0].total} ativos. Arquive produtos antes de continuar.`,
        );
    }
    const checkoutUrl = caktoCheckoutUrl(selectedPlan, selectedCycle);
    const offerId = caktoOfferId(selectedPlan, selectedCycle);
    const existing = await query<{
      subscription_id: string | null;
      status: string;
      plan: "essencial" | "profissional" | "premium";
    }>("SELECT subscription_id,status,plan FROM subscriptions WHERE company_id=$1", [
      user.companyId,
    ]);
    const subscription = existing.rows[0];

    if (subscription?.subscription_id && subscription.status === "active") {
      if (subscription.plan === selectedPlan) return { url: null };
      // Trocar o plano de uma assinatura ativa não é possível pela Cakto.
      //
      // Até 11/09/2026 este caminho chamava PUT /subscriptions/{id}/, e a Cakto
      // responde 405 a isso: "Alterar valor, periodicidade ou plano da
      // assinatura ainda não é suportado pela API pública". Quem tentava subir
      // de plano recebia um erro técnico — e nenhum teste passava por aqui,
      // por isso ficou no ar sem ninguém ver. Falhava do jeito seguro, ao
      // menos: o banco só era atualizado depois do PUT.
      //
      // Um checkout novo resolveria, mas cobraria o plano novo na hora sem
      // descontar os dias já pagos do antigo — a Cakto também não dá crédito
      // por assinatura. Até essa decisão ser tomada, a troca passa pelo
      // atendimento, e a tela leva a pessoa direto ao WhatsApp. Esta trava é
      // a segunda linha: se alguém chamar a função sem passar pela tela, ela
      // explica em vez de mandar para a Cakto uma chamada que falha.
      throw new Error(
        "A troca de plano de uma assinatura ativa é feita pelo nosso atendimento. Toque no botão de ajuda e fale com a gente pelo WhatsApp.",
      );
    }

    const token = randomBytes(32).toString("base64url");
    await transaction(async (client) => {
      await client.query(
        "DELETE FROM checkout_intents WHERE expires_at < now() OR (company_id=$1 AND used_at IS NULL)",
        [user.companyId],
      );
      await client.query(
        `INSERT INTO checkout_intents
          (company_id,user_id,token_hash,plan,offer_id,billing_cycle,expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,now() + interval '2 hours')`,
        [user.companyId, user.id, hashCheckoutToken(token), selectedPlan, offerId, selectedCycle],
      );
    });

    checkoutUrl.searchParams.set("name", user.name);
    checkoutUrl.searchParams.set("email", user.email);
    checkoutUrl.searchParams.set("confirmEmail", user.email);
    if (user.phone) checkoutUrl.searchParams.set("phone", user.phone);
    checkoutUrl.searchParams.set("utm_source", "central_do_comerciante");
    checkoutUrl.searchParams.set("utm_campaign", `assinatura_${selectedPlan}_${selectedCycle}`);
    checkoutUrl.searchParams.set("utm_content", token);
    return { url: checkoutUrl.toString() };
  });

export const cancelSubscription = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requireSession();
  requireAdmin(user);
  const result = await query<{
    subscription_id: string | null;
    current_period_end: Date | null;
    status: string;
  }>("SELECT subscription_id,current_period_end,status FROM subscriptions WHERE company_id=$1", [
    user.companyId,
  ]);
  const subscription = result.rows[0];
  if (!subscription?.subscription_id)
    throw new Error("Ainda não há uma assinatura ativa para cancelar");
  if (subscription.status === "canceled") return { ok: true };

  await caktoRequest(`/subscriptions/${encodeURIComponent(subscription.subscription_id)}/cancel/`, {
    method: "POST",
  });
  await transaction(async (client) => {
    await client.query(
      "UPDATE companies SET subscription_status='canceled',updated_at=now() WHERE id=$1",
      [user.companyId],
    );
    // O acesso pago vai até o fim do período já cobrado. Se a Cakto nunca
    // informou a data de renovação, preservamos um ciclo mensal em vez de
    // cortar na hora quem acabou de pagar.
    await client.query(
      `UPDATE subscriptions
          SET status='canceled',cancel_at_period_end=true,
              current_period_end=coalesce(current_period_end,now()+interval '30 days'),
              updated_at=now()
        WHERE company_id=$1`,
      [user.companyId],
    );
  });
  return { ok: true };
});
