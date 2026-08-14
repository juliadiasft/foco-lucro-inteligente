export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete";

export type AccessSnapshot = {
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string;
  currentPeriodEnd: string | null;
};

// Regra única de acesso, compartilhada pelo servidor e pelo guarda de rota.
// Enquanto viviam separados, o cliente que cancelava com período pago em
// aberto passava no servidor e era barrado na navegação.
export function hasActiveAccess(user: AccessSnapshot) {
  if (user.subscriptionStatus === "active") return true;
  if (user.subscriptionStatus === "trialing")
    return new Date(user.trialEndsAt).getTime() > Date.now();
  return (
    (user.subscriptionStatus === "canceled" || user.subscriptionStatus === "past_due") &&
    Boolean(user.currentPeriodEnd) &&
    new Date(user.currentPeriodEnd as string).getTime() > Date.now()
  );
}
