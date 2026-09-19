// Busca guardada: "me avise quando aparecer um fornecedor assim".
//
// A regra que importa é a de não repetir: o aviso sai quando aparece um
// fornecedor que a pessoa ainda não viu naquela busca, e nunca de novo pelo
// mesmo. Sem isso, cada vez que o fornecedor mexe num preço o comerciante
// recebe o mesmo aviso.

export type FiltrosDaBusca = {
  term: string | null;
  onlyMySegments: boolean;
  uf: string | null;
  city: string | null;
  maxDeliveryDays: number | null;
  categoryId: string | null;
  onlyAvailable: boolean;
  /** Pedido mínimo do fornecedor, no máximo, em R$. Nulo = sem limite. */
  maxMinimumOrder: number | null;
  /** Só fornecedores com quem a pessoa já fechou pedido. */
  onlyKnown: boolean;
};

/** Mesma busca, mesma chave — ignora caixa e espaço sobrando. */
export function chaveDaBusca(f: FiltrosDaBusca): string {
  return JSON.stringify([
    (f.term ?? "").trim().toLowerCase(),
    f.onlyMySegments,
    (f.uf ?? "").toUpperCase(),
    (f.city ?? "").trim().toLowerCase(),
    f.maxDeliveryDays,
    f.categoryId ?? "",
    f.onlyAvailable,
    f.maxMinimumOrder,
    f.onlyKnown,
  ]);
}

/** "ração golden · SP · até 1 dia(s)" — para a mensagem do aviso. */
export function descreverBusca(f: FiltrosDaBusca, nomeDaCategoria?: string | null): string {
  const partes = [
    f.term?.trim() || null,
    nomeDaCategoria || null,
    f.city?.trim() || null,
    f.uf || null,
    f.maxDeliveryDays !== null ? `até ${f.maxDeliveryDays} dia(s)` : null,
    f.onlyAvailable ? "pronta entrega" : null,
    f.maxMinimumOrder !== null ? `pedido mínimo até R$ ${f.maxMinimumOrder}` : null,
    f.onlyKnown ? "quem já comprei" : null,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : "sua busca";
}

/** Fornecedores que aparecem agora e ainda não tinham sido vistos. */
export function novosFornecedores(vistos: string[], agora: string[]): string[] {
  const jaVistos = new Set(vistos);
  return [...new Set(agora)].filter((id) => !jaVistos.has(id));
}
