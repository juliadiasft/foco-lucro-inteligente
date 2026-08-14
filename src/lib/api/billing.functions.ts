import { createHash, randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { planLabels, planLimits, planPricesBRL, type PlanName } from "../plans";
import { requireAdmin, requireSession } from "../server/auth.server";
import { caktoCheckoutUrl, caktoOfferId, caktoRequest } from "../server/cakto.server";
import { query, transaction } from "../server/db.server";

const planSchema = z.enum(["essencial", "profissional", "premium"]);

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
  return {
    plan: row.plan,
    planLabel: planLabels[row.plan],
    status: row.subscription_status,
    trialEndsAt: row.trial_ends_at.toISOString(),
    currentPeriodEnd: row.current_period_end?.toISOString() || null,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    hasSubscription: Boolean(row.subscription_id),
  };
});

export const startCheckout = createServerFn({ method: "POST" })
  .validator(z.object({ plan: planSchema }))
  .handler(async ({ data }) => {
    const user = await requireSession();
    requireAdmin(user);
    const selectedPlan = data.plan as PlanName;
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
    const checkoutUrl = caktoCheckoutUrl(selectedPlan);
    const offerId = caktoOfferId(selectedPlan);
    const existing = await query<{
      subscription_id: string | null;
      status: string;
      plan: "essencial" | "profissional" | "premium";
    }>("SELECT subscription_id,status,plan FROM subscriptions WHERE company_id=$1", [
      user.companyId,
    ]);
    const subscription = existing.rows[0];

    if (subscription?.subscription_id && subscription.status === "active") {
      if (subscription.plan === selectedPlan) return { url: null, changed: false };
      await caktoRequest(`/subscriptions/${encodeURIComponent(subscription.subscription_id)}/`, {
        method: "PUT",
        body: {
          amount: planPricesBRL[selectedPlan],
          offer: offerId,
          recurrence_period: 30,
        },
      });
      await transaction(async (client) => {
        await client.query("UPDATE companies SET plan=$2,updated_at=now() WHERE id=$1", [
          user.companyId,
          selectedPlan,
        ]);
        await client.query(
          `UPDATE subscriptions SET plan=$2,price_id=$3,provider='cakto',updated_at=now()
            WHERE company_id=$1`,
          [user.companyId, selectedPlan, offerId],
        );
      });
      return { url: null, changed: true };
    }

    const token = randomBytes(32).toString("base64url");
    await transaction(async (client) => {
      await client.query(
        "DELETE FROM checkout_intents WHERE expires_at < now() OR (company_id=$1 AND used_at IS NULL)",
        [user.companyId],
      );
      await client.query(
        `INSERT INTO checkout_intents
          (company_id,user_id,token_hash,plan,offer_id,expires_at)
         VALUES ($1,$2,$3,$4,$5,now() + interval '2 hours')`,
        [user.companyId, user.id, hashCheckoutToken(token), selectedPlan, offerId],
      );
    });

    checkoutUrl.searchParams.set("name", user.name);
    checkoutUrl.searchParams.set("email", user.email);
    checkoutUrl.searchParams.set("confirmEmail", user.email);
    if (user.phone) checkoutUrl.searchParams.set("phone", user.phone);
    checkoutUrl.searchParams.set("utm_source", "central_do_comerciante");
    checkoutUrl.searchParams.set("utm_campaign", `assinatura_${selectedPlan}`);
    checkoutUrl.searchParams.set("utm_content", token);
    return { url: checkoutUrl.toString(), changed: false };
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
