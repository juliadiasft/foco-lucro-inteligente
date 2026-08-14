export const planLimits = {
  essencial: { users: 1, products: 50, aiRequestsPerMonth: 0 },
  profissional: { users: 3, products: 150, aiRequestsPerMonth: 150 },
  premium: {
    users: 5,
    products: Number.POSITIVE_INFINITY,
    aiRequestsPerMonth: 300,
  },
} as const;

export const planPricesBRL = {
  essencial: 79.9,
  profissional: 129.9,
  premium: 179.9,
} as const;

export const formatPlanPriceBRL = (value: number) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export type PlanName = keyof typeof planLimits;

export const planLabels: Record<PlanName, string> = {
  essencial: "Essencial",
  profissional: "Profissional",
  premium: "Premium",
};
