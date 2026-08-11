import { createHash, timingSafeEqual } from "node:crypto";

import type { PlanName } from "../plans";
import { planFromCaktoOffer } from "./cakto.server";
import { transaction } from "./db.server";

type JsonObject = Record<string, unknown>;
type SubscriptionRow = {
  company_id: string;
  plan: PlanName;
  current_period_end: Date | null;
};

const handledEvents = new Set([
  "purchase_approved",
  "subscription_created",
  "subscription_renewed",
  "subscription_renewal_refused",
  "subscription_canceled",
  "refund",
  "chargeback",
]);

function objectValue(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function entityId(value: unknown) {
  if (typeof value === "string") return stringValue(value);
  const object = objectValue(value);
  return object ? stringValue(object.id) || stringValue(object.short_id) : null;
}

function dateValue(value: unknown) {
  const text = stringValue(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function secureEqual(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function webhookEventKey(body: string) {
  return createHash("sha256").update(body).digest("hex");
}

export async function handleCaktoWebhook(request: Request) {
  const expectedSecret = process.env.CAKTO_WEBHOOK_SECRET;
  if (!expectedSecret) return new Response("Cakto not configured", { status: 503 });

  const body = await request.text();
  if (body.length > 1_000_000) return new Response("Payload too large", { status: 413 });

  let payload: JsonObject;
  try {
    payload = JSON.parse(body) as JsonObject;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const secret = stringValue(payload.secret);
  if (!secret || !secureEqual(secret, expectedSecret))
    return new Response("Invalid secret", { status: 401 });

  const event = stringValue(payload.event);
  if (!event || !handledEvents.has(event)) return new Response("ignored");
  const data = objectValue(payload.data);
  if (!data) return new Response("Invalid payload", { status: 400 });

  const subscriptionObject = objectValue(data.subscription);
  const subscriptionId =
    entityId(data.subscription) ||
    stringValue(data.subscription_id) ||
    (event.startsWith("subscription_") ? stringValue(data.id) : null);
  const offerId = entityId(data.offer) || entityId(subscriptionObject?.offer);
  const mappedPlan = planFromCaktoOffer(offerId);
  const customer = objectValue(data.customer) || objectValue(subscriptionObject?.customer);
  const customerEmail = stringValue(customer?.email)?.toLowerCase() || null;
  const customerId = entityId(customer) || customerEmail;
  const checkoutToken = stringValue(data.utm_content);
  const incomingPeriodEnd =
    dateValue(data.next_payment_date) ||
    dateValue(subscriptionObject?.next_payment_date) ||
    dateValue(data.current_period_end) ||
    dateValue(subscriptionObject?.current_period_end);

  const processed = await transaction(async (client) => {
    const intent = checkoutToken
      ? (
          await client.query<{
            company_id: string;
            plan: PlanName;
            offer_id: string | null;
          }>(
            `SELECT company_id,plan,offer_id FROM checkout_intents
              WHERE token_hash=$1 AND expires_at > now() LIMIT 1`,
            [tokenHash(checkoutToken)],
          )
        ).rows[0]
      : undefined;

    if (intent?.offer_id && offerId && intent.offer_id !== offerId) return false;

    let current: SubscriptionRow | undefined;
    if (subscriptionId) {
      current = (
        await client.query<SubscriptionRow>(
          `SELECT company_id,plan,current_period_end FROM subscriptions
            WHERE subscription_id=$1 LIMIT 1`,
          [subscriptionId],
        )
      ).rows[0];
    }
    if (!current && customerId) {
      current = (
        await client.query<SubscriptionRow>(
          `SELECT company_id,plan,current_period_end FROM subscriptions
            WHERE customer_id=$1 LIMIT 1`,
          [customerId],
        )
      ).rows[0];
    }
    if (!current && customerEmail && mappedPlan) {
      current = (
        await client.query<SubscriptionRow>(
          `SELECT s.company_id,s.plan,s.current_period_end
             FROM subscriptions s JOIN users u ON u.company_id=s.company_id
            WHERE lower(u.email)=$1 AND u.role='owner' LIMIT 1`,
          [customerEmail],
        )
      ).rows[0];
    }

    const companyId = intent?.company_id || current?.company_id;
    const plan = mappedPlan || intent?.plan || current?.plan;
    if (!companyId || !plan) return false;

    const inserted = await client.query<{ event_key: string }>(
      `INSERT INTO billing_webhook_events (event_key,provider,event_type)
       VALUES ($1,'cakto',$2) ON CONFLICT (event_key) DO NOTHING RETURNING event_key`,
      [webhookEventKey(body), event],
    );
    if (!inserted.rows[0]) return true;

    let status: "active" | "past_due" | "canceled" = "active";
    let periodEnd = incomingPeriodEnd || current?.current_period_end || null;
    let cancelAtPeriodEnd = false;

    if (event === "subscription_renewal_refused") {
      status = "past_due";
    } else if (event === "subscription_canceled") {
      status = "canceled";
      cancelAtPeriodEnd = true;
      periodEnd ||= new Date();
    } else if (event === "refund" || event === "chargeback") {
      status = "canceled";
      periodEnd = new Date();
    } else if (!periodEnd) {
      periodEnd = new Date(Date.now() + 30 * 86_400_000);
    }

    await client.query(
      "UPDATE companies SET plan=$2,subscription_status=$3,updated_at=now() WHERE id=$1",
      [companyId, plan, status],
    );
    await client.query(
      `UPDATE subscriptions
          SET provider='cakto',customer_id=coalesce($2,customer_id),
              subscription_id=coalesce($3,subscription_id),price_id=coalesce($4,price_id),
              plan=$5,status=$6,current_period_end=$7,cancel_at_period_end=$8,updated_at=now()
        WHERE company_id=$1`,
      [companyId, customerId, subscriptionId, offerId, plan, status, periodEnd, cancelAtPeriodEnd],
    );
    if (intent)
      await client.query(
        "UPDATE checkout_intents SET used_at=coalesce(used_at,now()) WHERE company_id=$1 AND token_hash=$2",
        [companyId, tokenHash(checkoutToken as string)],
      );
    return true;
  });

  return new Response(processed ? "ok" : "ignored");
}
