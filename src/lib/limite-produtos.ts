// Limite de produtos do plano — com saída.
//
// Hoje o limite aparece como um toast seco ("Limite de produtos do plano
// atingido") depois que a pessoa já preencheu o formulário inteiro. Bloqueio
// sem saída é paywall; aqui o primeiro caminho é de graça: arquivar o que não
// vende há 90 dias libera vaga, e o histórico fica.

import { planLimits, planPricesBRL, type PlanName } from "./plans.ts";

export const DIAS_SEM_VENDA = 90;

export type EstadoDoLimite = {
  limite: number;
  ativos: number;
  vagas: number;
  cheio: boolean;
};

export function estadoDoLimite(plano: PlanName, ativos: number): EstadoDoLimite {
  const limite = planLimits[plano].products;
  const vagas = Number.isFinite(limite) ? Math.max(0, limite - ativos) : Number.POSITIVE_INFINITY;
  return { limite, ativos, vagas, cheio: vagas === 0 };
}

export type ProdutoParado = {
  id: string;
  name: string;
  /** Dias desde a última venda; sem venda nenhuma, desde o cadastro. */
  diasParado: number;
};

/**
 * Quem pode ser arquivado sem dó: passou de 90 dias sem sair. Produto que
 * nunca vendeu conta desde o cadastro — o cadastrado ontem não é "parado".
 * Os mais antigos primeiro.
 */
export function produtosParados(
  produtos: { id: string; name: string; ultimaVenda: Date | null; criadoEm: Date }[],
  hoje: Date,
): ProdutoParado[] {
  const dia = 86_400_000;
  return produtos
    .map((p) => ({
      id: p.id,
      name: p.name,
      diasParado: Math.floor((hoje.getTime() - (p.ultimaVenda ?? p.criadoEm).getTime()) / dia),
    }))
    .filter((p) => p.diasParado > DIAS_SEM_VENDA)
    .sort((a, b) => b.diasParado - a.diasParado);
}

export type ProximoPlano = {
  plano: PlanName;
  preco: number;
  produtos: number | null;
  perguntasIA: number;
  usuarios: number;
};

/** O plano acima do atual, ou nulo se já é o maior. */
export function proximoPlano(plano: PlanName): ProximoPlano | null {
  const ordem: PlanName[] = ["essencial", "profissional", "premium"];
  const seguinte = ordem[ordem.indexOf(plano) + 1];
  if (!seguinte) return null;
  const l = planLimits[seguinte];
  return {
    plano: seguinte,
    preco: planPricesBRL[seguinte],
    produtos: Number.isFinite(l.products) ? l.products : null,
    perguntasIA: l.aiRequestsPerMonth,
    usuarios: l.users,
  };
}
