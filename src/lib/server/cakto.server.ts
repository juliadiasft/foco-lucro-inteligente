import type { BillingCycle, PlanName } from "../plans";

const API_URL = "https://api.cakto.com.br/public_api";

let cachedToken: { value: string; expiresAt: number } | undefined;

function credentials() {
  const clientId = process.env.CAKTO_CLIENT_ID;
  const clientSecret = process.env.CAKTO_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error("A integração com a Cakto ainda não foi concluída pelo administrador");
  return { clientId, clientSecret };
}

async function accessToken(forceRefresh = false) {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now() + 60_000)
    return cachedToken.value;

  const { clientId, clientSecret } = credentials();
  const response = await fetch(`${API_URL}/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    detail?: string;
  };
  if (!response.ok || !result.access_token)
    throw new Error(result.detail || "Não foi possível autenticar a integração com a Cakto");

  cachedToken = {
    value: result.access_token,
    expiresAt: Date.now() + Math.max(300, result.expires_in || 3600) * 1000,
  };
  return cachedToken.value;
}

export async function caktoRequest<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PUT"; body?: Record<string, unknown> } = {},
  retry = true,
): Promise<T> {
  const token = await accessToken();
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (response.status === 401 && retry) {
    await accessToken(true);
    return caktoRequest<T>(path, options, false);
  }
  const result = (await response.json().catch(() => ({}))) as T & { detail?: string };
  if (!response.ok)
    throw new Error(result.detail || "A Cakto não conseguiu concluir esta operação");
  return result;
}

export function caktoCheckoutUrl(plan: PlanName, cycle: BillingCycle = "mensal") {
  const mensal: Record<PlanName, string | undefined> = {
    essencial: process.env.CAKTO_CHECKOUT_ESSENCIAL,
    profissional: process.env.CAKTO_CHECKOUT_PROFISSIONAL,
    premium: process.env.CAKTO_CHECKOUT_PREMIUM,
  };
  const anual: Record<PlanName, string | undefined> = {
    essencial: process.env.CAKTO_CHECKOUT_ESSENCIAL_ANUAL,
    profissional: process.env.CAKTO_CHECKOUT_PROFISSIONAL_ANUAL,
    premium: process.env.CAKTO_CHECKOUT_PREMIUM_ANUAL,
  };
  const value = (cycle === "anual" ? anual : mensal)[plan];
  if (!value)
    throw new Error(
      cycle === "anual"
        ? "O plano anual ainda nao foi liberado. Escolha o mensal."
        : "O checkout deste plano ainda nao foi configurado",
    );

  const url = new URL(value);
  if (url.protocol !== "https:" || !url.hostname.endsWith("cakto.com.br"))
    throw new Error("O endereco de checkout da Cakto e invalido");
  return url;
}

// Diz se o ciclo anual esta pronto para ser oferecido. Sem isso, a tela
// mostraria uma opcao que quebra no clique — o mesmo cuidado que a IA tem
// quando nao ha chave configurada.
export function annualCycleAvailable(plan: PlanName) {
  try {
    caktoCheckoutUrl(plan, "anual");
    return true;
  } catch {
    return false;
  }
}

export function caktoOfferId(plan: PlanName, cycle: BillingCycle = "mensal") {
  const url = caktoCheckoutUrl(plan, cycle);
  return url.pathname.split("/").filter(Boolean).at(-1) || null;
}

/**
 * Descobre plano e ciclo a partir da oferta que a Cakto mandou no webhook.
 * Precisa cobrir os dois ciclos: sem isso, uma assinatura anual chegaria como
 * plano nao reconhecido e o cliente pagaria sem receber acesso.
 */
export function planFromCaktoOffer(
  offerId: string | null | undefined,
): { plan: PlanName; cycle: BillingCycle } | null {
  if (!offerId) return null;
  for (const cycle of ["mensal", "anual"] as const) {
    for (const plan of ["essencial", "profissional", "premium"] as const) {
      try {
        if (caktoOfferId(plan, cycle) === offerId) return { plan, cycle };
      } catch {
        // A ausencia de um checkout nao deve impedir o reconhecimento dos outros.
      }
    }
  }
  return null;
}
