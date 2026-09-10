export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete";

export type AccessSnapshot = {
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  suspended?: boolean;
  accountType?: "comerciante" | "fornecedor";
  contaDaCasa?: boolean;
};

/** Por que o acesso foi negado. É o que a tela usa para explicar em vez de só barrar. */
export type MotivoDoBloqueio = "suspensa" | "teste_venceu" | "assinatura_vencida" | null;

export function motivoDoBloqueio(user: AccessSnapshot): MotivoDoBloqueio {
  if (hasActiveAccess(user)) return null;
  if (user.suspended) return "suspensa";
  if (user.subscriptionStatus === "trialing") return "teste_venceu";
  return "assinatura_vencida";
}

// Regra única de acesso, compartilhada pelo servidor e pelo guarda de rota.
// Enquanto viviam separados, o cliente que cancelava com período pago em
// aberto passava no servidor e era barrado na navegação.
export function hasActiveAccess(user: AccessSnapshot) {
  // Suspensão administrativa vence qualquer assinatura em dia.
  if (user.suspended) return false;

  // Conta da casa não vence: a da dona e a de demonstração.
  //
  // A conta da Julia estava sujeita ao mesmo relógio de sete dias dos
  // clientes. Em 09/09/2026 ela não conseguia abrir nenhuma tela do próprio
  // sistema — o teste tinha vencido em 11/08 e o guarda fazia exatamente o que
  // devia. Estender pelo back office resolveria por trinta dias e travaria de
  // novo, provavelmente no meio de uma demonstração.
  //
  // Fica depois da suspensão de propósito: se um dia for preciso trancar uma
  // conta da casa, a suspensão ainda manda.
  if (user.contaDaCasa) return true;

  // O fornecedor não paga. Ele não é o cliente: é o estoque.
  //
  // Cada fornecedor que entra deixa o produto melhor para o comerciante, que é
  // quem paga. Cobrar de quem enche a prateleira, numa plataforma que ainda
  // está enchendo a prateleira, é cobrar pedágio na porta de uma loja onde se
  // quer que entre gente. Decidido pela Julia em 09/09/2026.
  //
  // Isto não abre brecha para o comerciante entrar de graça: o guarda de rota
  // manda conta de fornecedor para /fornecedor e conta de comerciante para
  // /dashboard, e nenhum recurso do painel do comerciante responde para o
  // outro tipo.
  if (user.accountType === "fornecedor") return true;
  if (user.subscriptionStatus === "active") return true;
  if (user.subscriptionStatus === "trialing")
    return new Date(user.trialEndsAt).getTime() > Date.now();
  return (
    (user.subscriptionStatus === "canceled" || user.subscriptionStatus === "past_due") &&
    Boolean(user.currentPeriodEnd) &&
    new Date(user.currentPeriodEnd as string).getTime() > Date.now()
  );
}
