import type { BillingCycle, PlanName } from "../plans";
import { esquecerSessoesDaEmpresa } from "./auth.server";
import { claimIdentifier, redact } from "./billing.server";
import { query, transaction } from "./db.server";
import { verifyStripeSignature } from "./stripe.server";

type JsonObject = Record<string, unknown>;

const obj = (v: unknown): JsonObject | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as JsonObject) : null;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const id = (v: unknown) => str(v) || str(obj(v)?.id);
const fromUnix = (v: unknown) => (typeof v === "number" ? new Date(v * 1000) : null);

const plans = ["essencial", "profissional", "premium"] as const;
const asPlan = (v: unknown): PlanName | null => plans.find((p) => p === v) ?? null;
const asCycle = (v: unknown): BillingCycle | null => (v === "mensal" || v === "anual" ? v : null);

type Change = {
  companyId: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  plan: PlanName | null;
  cycle: BillingCycle | null;
  currency: string | null;
  priceId: string | null;
  status: "active" | "past_due" | "canceled" | null;
  periodEnd: Date | null;
  // null = o evento nao diz (fatura), entao o que esta gravado fica.
  cancelAtPeriodEnd: boolean | null;
};

// O plano e o ciclo viajam nos metadados que nos mesmos gravamos ao abrir o
// checkout (e ao trocar de plano). A chave do Price e o plano B: um evento
// sem metadados ainda se reconhece pelo nome do que foi cobrado.
function planFromLookupKey(key: unknown): { plan: PlanName; cycle: BillingCycle } | null {
  const m = /^central_(essencial|profissional|premium)_(mensal|anual)_/.exec(str(key) ?? "");
  return m ? { plan: m[1] as PlanName, cycle: m[2] as BillingCycle } : null;
}

// Le a assinatura como a Stripe a descreve. O fim do periodo ja esteve no
// topo do objeto e hoje esta em cada item, conforme a versao da API da conta:
// aceitar os dois evita que uma mudanca de versao vire cliente sem renovar.
function fromSubscription(sub: JsonObject): Change {
  const item = obj((obj(sub.items)?.data as unknown[] | undefined)?.[0]);
  const price = obj(item?.price);
  const meta = obj(sub.metadata) ?? {};
  const fromKey = planFromLookupKey(price?.lookup_key);
  const raw = str(sub.status);
  const cancelAtPeriodEnd = sub.cancel_at_period_end === true;
  let status: Change["status"] = null;
  if (raw === "active" || raw === "trialing") status = cancelAtPeriodEnd ? "canceled" : "active";
  else if (raw === "past_due" || raw === "unpaid") status = "past_due";
  else if (raw === "canceled") status = "canceled";
  // incomplete / incomplete_expired / paused: nao mexe no acesso.
  return {
    companyId: str(meta.company_id),
    customerId: id(sub.customer),
    subscriptionId: str(sub.id),
    plan: asPlan(meta.plan) ?? fromKey?.plan ?? null,
    cycle: asCycle(meta.cycle) ?? fromKey?.cycle ?? null,
    currency: str(price?.currency)?.toUpperCase() ?? null,
    priceId: str(price?.id),
    status,
    periodEnd: fromUnix(sub.current_period_end) ?? fromUnix(item?.current_period_end),
    cancelAtPeriodEnd,
  };
}

async function recordFailure(eventId: string, type: string, reason: string, payload: unknown) {
  console.warn(`[stripe] evento nao conciliado: reason=${reason} event=${type} id=${eventId}`);
  await query(
    `INSERT INTO billing_webhook_failures (provider,event_type,event_key,reason,payload)
     VALUES ('stripe',$1,$2,$3,$4::jsonb) ON CONFLICT (provider,event_key,reason) DO NOTHING`,
    [type, eventId, reason, JSON.stringify(redact(payload))],
  ).catch((error) => console.error("[stripe] falha ao registrar evento nao conciliado", error));
}

export async function handleStripeWebhook(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Stripe not configured", { status: 503 });

  const body = await request.text();
  if (body.length > 1_000_000) return new Response("Payload too large", { status: 413 });
  if (!verifyStripeSignature(body, request.headers.get("stripe-signature"), secret))
    return new Response("Invalid signature", { status: 401 });

  let event: JsonObject;
  try {
    event = JSON.parse(body) as JsonObject;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const eventId = str(event.id);
  const type = str(event.type);
  const object = obj(obj(event.data)?.object);
  if (!eventId || !type || !object) return new Response("Invalid payload", { status: 400 });

  let change: Change | null = null;
  if (type === "customer.subscription.created" || type === "customer.subscription.updated") {
    change = fromSubscription(object);
  } else if (type === "customer.subscription.deleted") {
    change = { ...fromSubscription(object), status: "canceled", cancelAtPeriodEnd: true };
    change.periodEnd = fromUnix(object.ended_at) ?? new Date();
  } else if (type === "checkout.session.completed") {
    // Liga a empresa a assinatura assim que o pagamento fecha. O fim do periodo
    // exato chega no customer.subscription.* que a Stripe manda em seguida; ate
    // la vale o ciclo contado de hoje, para o cliente nao esperar acesso.
    if (object.mode !== "subscription" || object.payment_status === "unpaid")
      return new Response("ignored");
    const meta = obj(object.metadata) ?? {};
    const cycle = asCycle(meta.cycle) ?? "mensal";
    change = {
      companyId: str(meta.company_id) ?? str(object.client_reference_id),
      customerId: id(object.customer),
      subscriptionId: id(object.subscription),
      plan: asPlan(meta.plan),
      cycle,
      currency: str(object.currency)?.toUpperCase() ?? null,
      priceId: null,
      status: "active",
      periodEnd: new Date(Date.now() + (cycle === "anual" ? 365 : 30) * 86_400_000),
      cancelAtPeriodEnd: false,
    };
  } else if (type === "invoice.payment_failed") {
    // So a falha vem daqui. A fatura paga nao entra: a volta para "ativa" chega
    // no customer.subscription.updated, e tratar os dois deixaria uma fatura
    // atrasada desfazer um cancelamento feito depois dela.
    const subscriptionId =
      id(object.subscription) ??
      id(obj(obj(object.parent)?.subscription_details)?.subscription);
    change = {
      companyId: null,
      customerId: null,
      subscriptionId,
      plan: null,
      cycle: null,
      currency: null,
      priceId: null,
      status: "past_due",
      periodEnd: null,
      cancelAtPeriodEnd: null,
    };
  } else {
    return new Response("ignored");
  }
  if (!change.status) return new Response("ignored");
  const c = change;

  let outcome: { status: "processed"; companyId: string; conflicts: string[] } | { status: string; reason?: string };
  try {
    outcome = await transaction(async (client) => {
      const known = c.subscriptionId
        ? (
            await client.query<{ company_id: string; plan: PlanName; billing_cycle: BillingCycle; current_period_end: Date | null; status: string }>(
              `SELECT company_id,plan,billing_cycle,current_period_end,status FROM subscriptions WHERE subscription_id=$1 LIMIT 1`,
              [c.subscriptionId],
            )
          ).rows[0]
        : undefined;
      const companyId = c.companyId ?? known?.company_id;
      if (!companyId) return { status: "unresolved", reason: "empresa_nao_identificada" };
      const plan = c.plan ?? known?.plan;
      if (!plan) return { status: "unresolved", reason: "plano_nao_identificado" };
      const cycle = c.cycle ?? known?.billing_cycle ?? "mensal";

      const inserted = await client.query(
        `INSERT INTO billing_webhook_events (event_key,provider,event_type)
         VALUES ($1,'stripe',$2) ON CONFLICT (event_key) DO NOTHING RETURNING event_key`,
        [eventId, type],
      );
      if (!inserted.rows[0]) return { status: "duplicate" };

      // Nunca encurta o que ja esta gravado por causa de um evento que so diz
      // "pagou": o fim exato vem do evento da assinatura.
      let periodEnd = c.periodEnd ?? known?.current_period_end ?? null;
      if (c.periodEnd && known?.current_period_end && type === "checkout.session.completed")
        periodEnd = known.current_period_end > c.periodEnd ? known.current_period_end : c.periodEnd;
      if (c.status === "canceled") periodEnd ||= new Date();

      const customer = await claimIdentifier(client, "customer_id", c.customerId, companyId);
      const subscription = await claimIdentifier(client, "subscription_id", c.subscriptionId, companyId);
      const conflicts = [
        ...(customer.conflict ? ["customer_id"] : []),
        ...(subscription.conflict ? ["subscription_id"] : []),
      ];

      await client.query(
        "UPDATE companies SET plan=$2,subscription_status=$3,updated_at=now() WHERE id=$1",
        [companyId, plan, c.status],
      );
      await client.query(
        `UPDATE subscriptions
            SET provider='stripe',customer_id=coalesce($2,customer_id),
                subscription_id=coalesce($3,subscription_id),price_id=coalesce($4,price_id),
                plan=$5,status=$6,current_period_end=$7,cancel_at_period_end=coalesce($8,cancel_at_period_end),
                billing_cycle=$9,currency=coalesce($10,currency),updated_at=now()
          WHERE company_id=$1`,
        [
          companyId,
          customer.value,
          subscription.value,
          c.priceId,
          plan,
          c.status,
          periodEnd,
          c.cancelAtPeriodEnd,
          cycle,
          c.currency,
        ],
      );
      return { status: "processed", companyId, conflicts };
    });
  } catch (error) {
    // Erro de banco e transitorio: 500 faz a Stripe reenviar em vez de perder o pagamento.
    console.error("[stripe] falha ao processar webhook", error);
    await recordFailure(eventId, type, "erro_ao_processar", event);
    return new Response("processing error", { status: 500 });
  }

  if (outcome.status === "unresolved") {
    await recordFailure(eventId, type, outcome.reason as string, event);
    return new Response("ignored");
  }
  if (outcome.status === "processed") {
    const done = outcome as { companyId: string; conflicts: string[] };
    esquecerSessoesDaEmpresa(done.companyId);
    if (done.conflicts.length)
      await recordFailure(
        eventId,
        type,
        `identificador_em_uso_por_outra_empresa:${done.conflicts.join(",")}`,
        event,
      );
  }
  return new Response("ok");
}
