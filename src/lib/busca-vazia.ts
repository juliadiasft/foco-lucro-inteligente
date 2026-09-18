// Busca sem resultado — quem é o culpado.
//
// "Nenhum fornecedor encontrado" deixa a pessoa sozinha com cinco filtros
// ligados e nenhuma pista de qual deles esvaziou a lista. Aqui, para cada
// filtro ligado, o servidor responde "e se eu soltasse só este?", e a tela
// nomeia os que trazem gente de volta.

export type FiltroSolto = {
  chave: string;
  texto: string;
  /** Quantos fornecedores aparecem se só este filtro sair. */
  fornecedores: number;
};

export type AnaliseDoVazio = {
  /** Filtros que, soltos, trazem fornecedores — os que mais trazem primeiro. */
  culpados: FiltroSolto[];
  /** Filtros que não mudam nada sozinhos. */
  inocentes: FiltroSolto[];
  /** Nenhum filtro sozinho resolve: é a combinação deles. */
  soCombinados: boolean;
};

export function analisarBuscaVazia(soltos: FiltroSolto[]): AnaliseDoVazio {
  const culpados = soltos
    .filter((s) => s.fornecedores > 0)
    .sort((a, b) => b.fornecedores - a.fornecedores);
  return {
    culpados,
    inocentes: soltos.filter((s) => s.fornecedores === 0),
    soCombinados: soltos.length > 1 && culpados.length === 0,
  };
}

export function fornecedoresDistintos(
  resultado: { offers: { supplierCompanyId: string }[] }[],
): number {
  const ids = new Set<string>();
  for (const item of resultado) for (const o of item.offers) ids.add(o.supplierCompanyId);
  return ids.size;
}

export const nFornecedores = (n: number) => (n === 1 ? "1 fornecedor" : `${n} fornecedores`);
