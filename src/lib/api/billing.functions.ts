import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { planLabels } from "../plans";
import { getAppBaseUrl } from "../server/app-url.server";
import { requireAdmin, requireSession } from "../server/auth.server";
import { query } from "../server/db.server";

const priceForPlan = (plan: "essencial" | "profissional" | "premium") => {
  const values = {
    essencial: process.env.STRIPE_PRICE_ESSENCIAL,
    profissional: process.env.STRIPE_PRICE_PROFISSIONAL,
    premium: process.env.STRIPE_PRICE_PREMIUM,
  };
  return values[plan];
};

async function stripePost<T>(path: string, values: Record<string, string>) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Cobrança ainda não foi configurada pelo administrador");
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(values),
  });
  const result = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(result.error?.message || "Falha na comunicação com a cobrança");
  return result;
}

export const getBillingStatus = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  const result = await query<{
    plan: "essencial" | "profissional" | "premium";
    subscription_status: string;
    trial_ends_at: Date;
    customer_id: string | null;
    current_period_end: Date | null;
    cancel_at_period_end: boolean;
  }>(
    `SELECT c.plan,c.subscription_status,c.trial_ends_at,s.customer_id,s.current_period_end,s.cancel_at_period_end
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
    hasCustomer: Boolean(row.customer_id),
  };
});

export const startCheckout = createServerFn({ method: "POST" })
  .validator(z.object({ plan: z.enum(["essencial", "profissional", "premium"]) }))
  .handler(async ({ data }) => {
    const user = await requireSession();
    requireAdmin(user);
    const price = priceForPlan(data.plan);
    if (!process.env.STRIPE_SECRET_KEY || !price)
      throw new Error("Cobrança ainda não foi configurada pelo administrador");
    const existing = await query<{
      customer_id: string | null;
      subscription_id: string | null;
    }>("SELECT customer_id,subscription_id FROM subscriptions WHERE company_id=$1", [
      user.companyId,
    ]);
    if (existing.rows[0]?.subscription_id) {
      throw new Error("Use Gerenciar pagamento para trocar um plano já ativo");
    }
    let customerId = existing.rows[0]?.customer_id || null;
    if (!customerId) {
      const customer = await stripePost<{ id: string }>("customers", {
        name: user.companyName,
        email: user.email,
        "metadata[companyId]": user.companyId,
      });
      customerId = customer.id;
      await query("UPDATE subscriptions SET customer_id=$2,updated_at=now() WHERE company_id=$1", [
        user.companyId,
        customerId,
      ]);
    }
    const baseUrl = getAppBaseUrl();
    const session = await stripePost<{ url: string | null }>("checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.companyId,
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      "subscription_data[metadata][companyId]": user.companyId,
      "subscription_data[metadata][plan]": data.plan,
      "metadata[companyId]": user.companyId,
      "metadata[plan]": data.plan,
      success_url: `${baseUrl}/assinatura?sucesso=1`,
      cancel_url: `${baseUrl}/assinatura?cancelado=1`,
      allow_promotion_codes: "true",
    });
    if (!session.url) throw new Error("Não foi possível abrir o pagamento");
    return { url: session.url };
  });

export const openBillingPortal = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requireSession();
  requireAdmin(user);
  const subscription = await query<{ customer_id: string | null }>(
    "SELECT customer_id FROM subscriptions WHERE company_id=$1",
    [user.companyId],
  );
  const customerId = subscription.rows[0]?.customer_id;
  if (!customerId) throw new Error("Ainda não há uma assinatura para gerenciar");
  const baseUrl = getAppBaseUrl();
  const portal = await stripePost<{ url: string }>("billing_portal/sessions", {
    customer: customerId,
    return_url: `${baseUrl}/assinatura`,
  });
  return { url: portal.url };
});
