// Filtros dos orçamentos que chegam ao fornecedor (S06).
//
// O fornecedor decide de que pedidos quer ser avisado. Filtrar tira o pedido
// da lista e do aviso, mas NÃO o tira da conta da taxa de resposta: pedido que
// chegou e não foi respondido conta contra ele — é a regra que mantém o
// filtro honesto, e a tela diz isso antes de salvar.

export type Alcance = "todos" | "uf" | "cidade";

export type FiltrosDeOrcamento = {
  /** Valor estimado mínimo, em R$. Nulo = qualquer valor. */
  valorMinimo: number | null;
  alcance: Alcance;
  /** Nichos aceitos. Vazio = todos. */
  segmentos: string[];
  /** Só pedidos cujos itens estão todos disponíveis. */
  soComEstoque: boolean;
};

export const SEM_FILTRO: FiltrosDeOrcamento = {
  valorMinimo: null,
  alcance: "todos",
  segmentos: [],
  soComEstoque: false,
};

export type DadosDoOrcamento = {
  /** Soma dos itens com preço no catálogo. Nulo se nenhum item tem preço. */
  valorEstimado: number | null;
  comerciante: { cidade: string | null; uf: string | null; segmentos: string[] };
  /** Todos os itens ligados a uma oferta estão disponíveis. */
  todosDisponiveis: boolean;
};

export type Lugar = { cidade: string | null; uf: string | null };

const igual = (a: string | null, b: string | null) =>
  a !== null && b !== null && a.trim().toLowerCase() === b.trim().toLowerCase();

export function filtroAtivo(f: FiltrosDeOrcamento): boolean {
  return (
    f.valorMinimo !== null || f.alcance !== "todos" || f.segmentos.length > 0 || f.soComEstoque
  );
}

/**
 * O pedido passa pelo filtro? Na dúvida, passa: valor que não dá para estimar,
 * comerciante sem nicho ou sem cidade cadastrada não são escondidos — esconder
 * por falta de dado seria perder pedido sem motivo.
 */
export function passaNoFiltro(
  q: DadosDoOrcamento,
  f: FiltrosDeOrcamento,
  fornecedor: Lugar,
): boolean {
  if (f.valorMinimo !== null && q.valorEstimado !== null && q.valorEstimado < f.valorMinimo)
    return false;
  if (
    f.alcance === "uf" &&
    q.comerciante.uf &&
    fornecedor.uf &&
    !igual(q.comerciante.uf, fornecedor.uf)
  )
    return false;
  if (
    f.alcance === "cidade" &&
    q.comerciante.cidade &&
    fornecedor.cidade &&
    !(igual(q.comerciante.cidade, fornecedor.cidade) && igual(q.comerciante.uf, fornecedor.uf))
  )
    return false;
  if (
    f.segmentos.length > 0 &&
    q.comerciante.segmentos.length > 0 &&
    !q.comerciante.segmentos.some((s) => f.segmentos.includes(s))
  )
    return false;
  if (f.soComEstoque && !q.todosDisponiveis) return false;
  return true;
}

export type SituacaoDoPedido = DadosDoOrcamento & {
  /** Já teve proposta do fornecedor. */
  respondido: boolean;
};

export type EfeitoDoFiltro = {
  /** Pedidos dos últimos 90 dias no total. */
  total: number;
  /** Pedidos dos últimos 90 dias que o filtro esconderia. */
  escondidos: number;
  /** Valor estimado desses pedidos, em R$ (só os que têm estimativa). */
  valorEscondido: number;
  /** Escondidos que ele já tinha respondido: virariam pedidos não respondidos daqui pra frente. */
  jaRespondidos: number;
  /** Taxa de resposta hoje e se, dali em diante, ele só respondesse o que o filtro deixa passar. */
  taxaAtual: number | null;
  taxaComFiltro: number | null;
};

/**
 * Efeito do filtro sobre a taxa, com o histórico como régua: se ele só tivesse
 * respondido o que passa pelo filtro, quanto teria sido a taxa? Os pedidos
 * escondidos que ele respondeu deixam de contar como resposta.
 */
export function efeitoDoFiltro(
  historico: SituacaoDoPedido[],
  f: FiltrosDeOrcamento,
  fornecedor: Lugar,
): EfeitoDoFiltro {
  let escondidos = 0;
  let valorEscondido = 0;
  let jaRespondidos = 0;
  let respondidos = 0;
  for (const p of historico) {
    if (p.respondido) respondidos++;
    if (passaNoFiltro(p, f, fornecedor)) continue;
    escondidos++;
    valorEscondido += p.valorEstimado ?? 0;
    if (p.respondido) jaRespondidos++;
  }
  const total = historico.length;
  return {
    total,
    escondidos,
    valorEscondido: Math.round(valorEscondido * 100) / 100,
    jaRespondidos,
    taxaAtual: total ? respondidos / total : null,
    taxaComFiltro: total ? (respondidos - jaRespondidos) / total : null,
  };
}
