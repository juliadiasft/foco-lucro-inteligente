export const planLimits = {
  essencial: { users: 1, products: 500, aiRequestsPerMonth: 0 },
  profissional: { users: 5, products: 3000, aiRequestsPerMonth: 150 },
  premium: {
    users: Number.POSITIVE_INFINITY,
    products: Number.POSITIVE_INFINITY,
    aiRequestsPerMonth: 1000,
  },
} as const;

export type PlanName = keyof typeof planLimits;

export const planLabels: Record<PlanName, string> = {
  essencial: "Essencial",
  profissional: "Profissional",
  premium: "Premium",
};
