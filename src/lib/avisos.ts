// A central de avisos (A04) e a regra do push (A05), separadas do banco de
// propósito: é aqui que se decide o que merece tocar no celular de alguém.
//
// Regra do SPEC: push só quando há dinheiro ou algo esperando resposta. Nunca
// "dê uma olhada no app". Quem recebe push à toa desliga o push, e perde
// também o aviso que valia.

export type CategoriaDeAviso = "precisa_de_voce" | "dinheiro_na_mesa" | "so_para_saber";

export type TipoDeAviso =
  | "supplier_opportunity"
  | "stock_alert"
  | "system"
  | "orcamento_novo"
  | "orcamento_respondido"
  | "pedido_novo"
  | "pedido_atualizado"
  | "proposta_aceita"
  | "fornecedor_na_busca";

export const CATEGORIAS: { id: CategoriaDeAviso; titulo: string; ajuda: string }[] = [
  { id: "precisa_de_voce", titulo: "Precisa de você", ajuda: "Tem alguém esperando sua resposta" },
  { id: "dinheiro_na_mesa", titulo: "Dinheiro na mesa", ajuda: "Onde dá para economizar" },
  { id: "so_para_saber", titulo: "Só para saber", ajuda: "Confirmações, sem ação" },
];

const CATEGORIA_DO_TIPO: Record<TipoDeAviso, CategoriaDeAviso> = {
  supplier_opportunity: "dinheiro_na_mesa",
  stock_alert: "precisa_de_voce",
  orcamento_novo: "precisa_de_voce",
  orcamento_respondido: "precisa_de_voce",
  pedido_novo: "precisa_de_voce",
  pedido_atualizado: "so_para_saber",
  proposta_aceita: "so_para_saber",
  system: "so_para_saber",
  // Pedido pela própria pessoa, mas não é dinheiro nem espera resposta: fica
  // na central, sem push (regra do A05).
  fornecedor_na_busca: "so_para_saber",
};

/** Tipo desconhecido (linha antiga ou futura) cai no menos ruidoso. */
export function categoriaDoTipo(tipo: string): CategoriaDeAviso {
  return CATEGORIA_DO_TIPO[tipo as TipoDeAviso] ?? "so_para_saber";
}

/** "Só para saber" aparece na central, mas nunca toca no celular. */
export function categoriaFazPush(categoria: CategoriaDeAviso) {
  return categoria !== "so_para_saber";
}

export function tipoFazPush(tipo: string) {
  return categoriaFazPush(categoriaDoTipo(tipo));
}

/** Agrupa na ordem das categorias, sem devolver grupo vazio. */
export function agruparAvisos<T extends { type: string }>(avisos: T[]) {
  return CATEGORIAS.map((categoria) => ({
    ...categoria,
    avisos: avisos.filter((aviso) => categoriaDoTipo(aviso.type) === categoria.id),
  })).filter((grupo) => grupo.avisos.length > 0);
}
