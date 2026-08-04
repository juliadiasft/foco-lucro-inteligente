import { createHmac, timingSafeEqual } from "node:crypto";

import { query } from "./db.server";

type StripeSubscription = {
  id: string;
  customer: string | { id: string };
  status: string;
  cancel_at_period_end: boolean;
  metadata: { companyId?: string; plan?: string };
  items: { data: Array<{ price: { id: string }; current_period_end?: number }> };
};
type StripeEvent = { type: string; data: { object: Record<string, unknown> } };

function mappedStatus(status: string) {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "canceled") return "canceled";
  if (status === "incomplete" || status === "incomplete_expired") return "incomplete";
  return "past_due";
}

function validSignature(body: string, header: string, secret: string) {
  const entries = header.split(",").map((part) => {
    const index = part.indexOf("=");
    return [part.slice(0, index), part.slice(index + 1)] as const;
  });
  const parts = Object.fromEntries(entries);
  if (!parts.t || !parts.v1 || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const expected = Buffer.from(
    createHmac("sha256", secret).update(`${parts.t}.${body}`).digest("hex"),
    "hex",
  );
  const actual = Buffer.from(parts.v1, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function handleStripeWebhook(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!process.env.STRIPE_SECRET_KEY || !webhookSecret)
    return new Response("Stripe not configured", { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  const body = await request.text();
  if (!validSignature(body, signature, webhookSecret))
    return new Response("Invalid signature", { status: 400 });
  const event = JSON.parse(body) as StripeEvent;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      metadata?: { companyId?: string };
      client_reference_id?: string;
      customer?: string | { id: string };
      subscription?: string | { id: string };
    };
    const companyId = session.metadata?.companyId || session.client_reference_id;
    const customerId =
      typeof session.customer === "string" ? session.customer : session.customer?.id;
    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (companyId)
      await query(
        "UPDATE subscriptions SET customer_id=coalesce($2,customer_id),subscription_id=coalesce($3,subscription_id),updated_at=now() WHERE company_id=$1",
        [companyId, customerId || null, subscriptionId || null],
      );
  }

  if (
    [
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ].includes(event.type)
  ) {
    const subscription = event.data.object as unknown as StripeSubscription;
    const customerId =
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
    const priceId = subscription.items.data[0]?.price.id || null;
    const periodEnd = subscription.items.data[0]?.current_period_end;
    const plan =
      subscription.metadata.plan ||
      (priceId === process.env.STRIPE_PRICE_ESSENCIAL
        ? "essencial"
        : priceId === process.env.STRIPE_PRICE_PREMIUM
          ? "premium"
          : "profissional");
    const status = mappedStatus(subscription.status);
    const targetCompany =
      subscription.metadata.companyId ||
      (
        await query<{ company_id: string }>(
          "SELECT company_id FROM subscriptions WHERE customer_id=$1",
          [customerId],
        )
      ).rows[0]?.company_id;
    if (targetCompany) {
      await query(
        "UPDATE companies SET plan=$2,subscription_status=$3,updated_at=now() WHERE id=$1",
        [targetCompany, plan, status],
      );
      await query(
        `UPDATE subscriptions SET customer_id=$2,subscription_id=$3,price_id=$4,plan=$5,status=$6,current_period_end=$7,cancel_at_period_end=$8,updated_at=now() WHERE company_id=$1`,
        [
          targetCompany,
          customerId,
          subscription.id,
          priceId,
          plan,
          status,
          periodEnd ? new Date(periodEnd * 1000) : null,
          subscription.cancel_at_period_end,
        ],
      );
    }
  }
  return new Response("ok");
}
