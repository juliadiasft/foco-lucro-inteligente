export const planLimits = {
  essencial: { users: 1, products: 50, aiRequestsPerMonth: 0 },
  profissional: { users: 5, products: 150, aiRequestsPerMonth: 150 },
  premium: {
    users: Number.POSITIVE_INFINITY,
    products: Number.POSITIVE_INFINITY,
    aiRequestsPerMonth: 1000,
  },
} as const;

export const planPricesBRL = {
  essencial: 77,
  profissional: 127,
  premium: 177,
} as const;

export type PlanName = keyof typeof planLimits;

export const planLabels: Record<PlanName, string> = {
  essencial: "Essencial",
  profissional: "Profissional",
  premium: "Premium",
};
