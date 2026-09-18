import { createHmac, timingSafeEqual } from "node:crypto";

import { annualPricesBRL, planLabels, planPricesBRL, type BillingCycle, type PlanName } from "../plans";

// Fala com a Stripe por fetch, sem o SDK: sao quatro chamadas, e assim nao ha
// dependencia nova para instalar nem atualizar.
const API_URL = "https://api.stripe.com/v1";

export type Currency = "BRL" | "USD" | "EUR";

// Valores por moeda. So o real esta preenchido: o preco em dolar e euro e
// decisao de negocio (nao e conversao do cambio do dia), e uma moeda sem preco
// definido nao e oferecida. Para abrir outra, preencher aqui.
const prices: Partial<Record<Currency, Record<BillingCycle, Record<PlanName, number>>>> = {
  BRL: { mensal: planPricesBRL, anual: annualPricesBRL },
};

export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

export const availableCurrencies = (): Currency[] => Object.keys(prices) as Currency[];

export function stripeAmountCents(plan: PlanName, cycle: BillingCycle, currency: Currency) {
  const value = prices[currency]?.[cycle][plan];
  if (value === undefined) throw new Error("Esta moeda ainda nao esta disponivel");
  return Math.round(value * 100);
}

function secretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("A integração com a Stripe ainda não foi concluída pelo administrador");
  return key;
}

// A Stripe recebe formulario, nao JSON, e aninha com colchetes: a[b][0][c]=1.
function encodeForm(value: unknown, prefix = "", out = new URLSearchParams()) {
  if (value === undefined || value === null) return out;
  if (Array.isArray(value)) {
    value.forEach((item, index) => encodeForm(item, `${prefix}[${index}]`, out));
  } else if (typeof value === "object") {
    for (const [key, item] of Object.entries(value))
      encodeForm(item, prefix ? `${prefix}[${key}]` : key, out);
  } else {
    out.append(prefix, String(value));
  }
  return out;
}

export async function stripeRequest<T>(
  path: string,
  options: { method?: "GET" | "POST" | "DELETE"; body?: Record<string, unknown> } = {},
): Promise<T> {
  const method = options.method || "GET";
  const query = method === "GET" && options.body ? `?${encodeForm(options.body)}` : "";
  const response = await fetch(`${API_URL}${path}${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" && options.body ? encodeForm(options.body) : undefined,
  });
  const result = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };
  if (!response.ok) {
    // A mensagem da Stripe fica no log; a tela recebe uma frase nossa.
    console.error("[stripe] chamada recusada", path, result.error?.message);
    throw new Error("A Stripe não conseguiu concluir esta operação. Tente de novo em instantes.");
  }
  return result;
}

const lookupKey = (plan: PlanName, cycle: BillingCycle, currency: Currency) =>
  // O valor entra na chave: mudar o preco em plans.ts cria um Price novo em vez
  // de continuar cobrando o antigo.
  `central_${plan}_${cycle}_${currency.toLowerCase()}_${stripeAmountCents(plan, cycle, currency)}`;

/**
 * O Price do plano na Stripe, criado na primeira vez que alguem o escolhe.
 *
 * O preco mora em plans.ts, uma vez so. Criar os Prices no painel da Stripe
 * seria uma segunda copia dos mesmos valores para manter junto — exatamente o
 * defeito que a Cakto tinha com as ofertas.
 */
export async function ensurePrice(plan: PlanName, cycle: BillingCycle, currency: Currency) {
  const key = lookupKey(plan, cycle, currency);
  const found = await stripeRequest<{ data: { id: string }[] }>("/prices", {
    body: { "lookup_keys[]": key, active: true, limit: 1 },
  });
  if (found.data[0]) return found.data[0].id;
  const created = await stripeRequest<{ id: string }>("/prices", {
    method: "POST",
    body: {
      currency: currency.toLowerCase(),
      unit_amount: stripeAmountCents(plan, cycle, currency),
      recurring: { interval: cycle === "anual" ? "year" : "month" },
      lookup_key: key,
      product_data: { name: `Central do Comerciante — ${planLabels[plan]} (${cycle})` },
    },
  });
  return created.id;
}

// ---------------------------------------------------------------- webhook

const TOLERANCE_SECONDS = 300;

/**
 * Confere a assinatura que a Stripe manda no cabecalho, sobre o corpo cru.
 * Sem isto qualquer pessoa poderia postar um evento falso e ganhar plano.
 */
export function verifyStripeSignature(
  body: string,
  header: string | null,
  secret: string,
  now = Date.now(),
) {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const timestamp = parts.find(([k]) => k === "t")?.[1];
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest();
  return signatures.some((candidate) => {
    const received = Buffer.from(candidate, "hex");
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}
