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

// Cobranca anual: doze meses pelo preco de dez. O desconto existe para trazer
// caixa a frente e reduzir churn — quem paga o ano nao cancela no segundo mes.
export type BillingCycle = "mensal" | "anual";

// Meses cobrados no plano anual. Dois de bonus.
export const ANNUAL_BILLED_MONTHS = 10;

export const annualPricesBRL = {
  essencial: planPricesBRL.essencial * ANNUAL_BILLED_MONTHS,
  profissional: planPricesBRL.profissional * ANNUAL_BILLED_MONTHS,
  premium: planPricesBRL.premium * ANNUAL_BILLED_MONTHS,
} as const;

export const cycleLabels: Record<BillingCycle, string> = {
  mensal: "Mensal",
  anual: "Anual",
};

export const priceFor = (plan: PlanName, cycle: BillingCycle) =>
  cycle === "anual" ? annualPricesBRL[plan] : planPricesBRL[plan];

/** Quanto o cliente deixa de pagar ao escolher o anual. */
export const annualSavingsBRL = (plan: PlanName) =>
  planPricesBRL[plan] * 12 - annualPricesBRL[plan];

/** O anual dividido por doze, para comparar com o mensal na mesma medida. */
export const annualMonthlyEquivalent = (plan: PlanName) => annualPricesBRL[plan] / 12;

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

// Os preços e os limites são os mesmos para os dois lados. O que muda é o que
// cada um recebe em troca: quem compra quer enxergar margem e comparar preço;
// quem vende quer ser encontrado e vender mais.
export const planTagline: Record<"comerciante" | "fornecedor", Record<PlanName, string>> = {
  comerciante: {
    essencial: "Para quem administra o comércio sozinho.",
    profissional: "Para quem quer comprar melhor e crescer.",
    premium: "Para operações com mais volume e pessoas.",
  },
  fornecedor: {
    essencial: "Para começar a ser encontrado pelo comércio.",
    profissional: "Para vender mais e acompanhar o resultado.",
    premium: "Para distribuidoras com catálogo grande.",
  },
};

export const planHighlights: Record<"comerciante" | "fornecedor", Record<PlanName, string[]>> = {
  comerciante: {
    essencial: [
      "1 usuário",
      "Até 50 produtos",
      "Custos, preços e margens",
      "Controle e alertas de estoque",
      "Encontrar fornecedores, conversar e pedir",
    ],
    profissional: [
      "Até 3 usuários",
      "Até 150 produtos",
      "Tudo do Essencial",
      "Comparação de preços entre fornecedores",
      "Consultor de Lucro com IA — 150 perguntas por mês",
    ],
    premium: [
      "Até 5 usuários",
      "Produtos ilimitados",
      "Tudo do Profissional",
      "300 perguntas à IA por mês",
      "Suporte prioritário",
    ],
  },
  fornecedor: {
    essencial: [
      "1 usuário",
      "Até 50 itens no catálogo",
      "Vitrine para os comerciantes do seu nicho",
      "Orçamentos, propostas e pedidos",
      "Conversa direta com o comerciante",
    ],
    profissional: [
      "Até 3 usuários",
      "Até 150 itens no catálogo",
      "Tudo do Essencial",
      "Consultor de Vendas com IA — 150 perguntas por mês",
      "Comparação do seu preço com a média do mercado",
    ],
    premium: [
      "Até 5 usuários",
      "Itens ilimitados no catálogo",
      "Tudo do Profissional",
      "300 perguntas à IA por mês",
      "Suporte prioritário",
    ],
  },
};

export function planIncludes(plan: PlanName, feature: PlanFeature) {
  return planRank(plan) >= planRank(featureMinimumPlan[feature]);
}

export function requiredPlanFor(feature: PlanFeature) {
  return featureMinimumPlan[feature];
}
