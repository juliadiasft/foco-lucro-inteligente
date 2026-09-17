// A praça onde a Central começa, e que tipo de fornecedor procurar primeiro.
//
// Decidido em 14/09/2026: concentrar em Campinas e região até ter 5 fornecedores
// com vitrine no ar e 10 rações em comum entre 3 deles. A comparação de preço só
// existe quando vários fornecedores da mesma região vendem o mesmo item —
// cinquenta espalhados dão zero comparação.
//
// A prospecção (quem ligar) e o medidor (se o marco foi batido) leem daqui.
// Mudar a lista num lugar só evita que o painel diga "praça fechada" contando
// cidades que a lista de ligação nunca mostrou.

export type Praca = "campinas";

// Da mais perto para a mais longe: é a ordem em que se liga.
export const CIDADES_DA_PRACA: Record<Praca, readonly string[]> = {
  campinas: [
    "CAMPINAS",
    "VALINHOS",
    "HORTOLANDIA",
    "SUMARE",
    "PAULINIA",
    "VINHEDO",
    "JAGUARIUNA",
    "MONTE MOR",
    "COSMOPOLIS",
    "NOVA ODESSA",
    "ITATIBA",
    "INDAIATUBA",
    "AMERICANA",
    "ARTUR NOGUEIRA",
    "PEDREIRA",
    "SANTA BARBARA D'OESTE",
    "LOUVEIRA",
    "ITUPEVA",
    "MOGI MIRIM",
    "JUNDIAI",
    "LIMEIRA",
    "MOGI GUACU",
    "PIRACICABA",
  ],
};

export const UF_DA_PRACA: Record<Praca, string> = { campinas: "SP" };

export const NOME_DA_PRACA: Record<Praca, string> = { campinas: "Campinas e região" };

/**
 * A cidade no formato da lista: maiúscula, sem acento, apóstrofo reto.
 *
 * A Receita grava "SANTA BARBARA D'OESTE"; quem se cadastra digita "Santa
 * Bárbara d’Oeste", com acento e apóstrofo curvo. Sem isto o mesmo fornecedor
 * estaria dentro da praça na lista de ligação e fora dela no medidor.
 */
export function normalizarCidade(cidade: string | null | undefined) {
  return (cidade ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function pracaDaCidade(cidade: string | null | undefined, uf: string | null | undefined) {
  const nome = normalizarCidade(cidade);
  const estado = (uf ?? "").trim().toUpperCase();
  for (const praca of Object.keys(CIDADES_DA_PRACA) as Praca[]) {
    if (estado === UF_DA_PRACA[praca] && CIDADES_DA_PRACA[praca].includes(nome)) return praca;
  }
  return null;
}

// Que tipo de fornecedor, pela atividade principal na Receita.
//
//   A — atacado de ração: vende exatamente o que o pet shop mais compra, e as
//       mesmas marcas que os concorrentes. É onde a comparação nasce.
//   B — fábrica de ração e remédio veterinário: abastece pet shop, mas o
//       catálogo sobrepõe menos (a fábrica vende a própria marca).
//   C — o resto: "artigos de uso pessoal e doméstico" e "insumos
//       agropecuários" são códigos genéricos; só vale quem tem nome de pet.
export type TipoDeFornecedor = "A" | "B" | "C";

export const DESCRICAO_DO_TIPO: Record<TipoDeFornecedor, string> = {
  A: "Atacado de ração",
  B: "Fábrica de ração ou remédio veterinário",
  C: "Outros (só com nome de pet)",
};

export function tipoDeFornecedor(ramoPrincipal: string | null | undefined): TipoDeFornecedor {
  const ramo = (ramoPrincipal ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (ramo.includes("atacadista de alimentos para animais")) return "A";
  if (ramo.includes("alimentos para animais") || ramo.includes("uso veterinario")) return "B";
  return "C";
}

// A mesma regra em SQL, para filtrar e ordenar dentro do banco. Sem acento nos
// padrões de propósito: ILIKE não ignora acento, e "Fabricação" com ou sem
// cedilha precisa cair no mesmo lugar. O teste da prospecção confere que as
// duas versões concordam para cada atividade que existe na lista.
export const TIPO_SQL = `(CASE
  WHEN p.ramo_principal ILIKE '%atacadista de alimentos para animais%' THEN 'A'
  WHEN p.ramo_principal ILIKE '%alimentos para animais%'
    OR p.ramo_principal ILIKE '%uso veterin%' THEN 'B'
  ELSE 'C' END)`;

// O marco do plano de 14/09/2026: só quando ele for batido a praça abre para
// os pet shops. Antes disso, pet shop que entra encontra a prateleira vazia.
export const MARCO = {
  vitrines: 5,
  itensEmComum: 10,
  fornecedoresPorItem: 3,
  petShops: 10,
} as const;
