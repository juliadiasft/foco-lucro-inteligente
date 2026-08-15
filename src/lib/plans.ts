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

// O acesso é cumulativo: Premium contém Profissional, que contém Essencial.
// Guardar a ordem em um lugar só evita duas listas discordando entre a tela e
// o servidor.
export const planOrder: PlanName[] = ["essencial", "profissional", "premium"];

export const planRank = (plan: PlanName) => planOrder.indexOf(plan);

export type PlanFeature =
  "comparacaoFornecedores" | "consultorIa" | "relatoriosAvancados" | "suportePrioritario";

export const featureMinimumPlan: Record<PlanFeature, PlanName> = {
  comparacaoFornecedores: "profissional",
  consultorIa: "profissional",
  relatoriosAvancados: "profissional",
  suportePrioritario: "premium",
};

export const featureLabels: Record<PlanFeature, string> = {
  comparacaoFornecedores: "Comparação de preços entre fornecedores",
  consultorIa: "Consultor de Lucro com IA",
  relatoriosAvancados: "Relatórios e alertas completos",
  suportePrioritario: "Suporte prioritário",
};

export const featureDescriptions: Record<PlanFeature, string> = {
  comparacaoFornecedores:
    "Veja o preço por quilo, litro ou unidade de cada fornecedor lado a lado e descubra quanto dá para economizar em cada compra.",
  consultorIa:
    "Pergunte em português e receba respostas sobre margem, estoque e fornecedores com base nos seus próprios números.",
  relatoriosAvancados:
    "Relatórios completos de compras, gastos e estoque, com alertas mais detalhados.",
  suportePrioritario: "Atendimento na frente da fila quando você precisar de ajuda.",
};

export function planIncludes(plan: PlanName, feature: PlanFeature) {
  return planRank(plan) >= planRank(featureMinimumPlan[feature]);
}

export function requiredPlanFor(feature: PlanFeature) {
  return featureMinimumPlan[feature];
}
