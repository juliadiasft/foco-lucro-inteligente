// O medidor da praça: o número do marco, que antes não aparecia em lugar nenhum.
//
// A pergunta que decide quando abrir para os pet shops não é "quantos
// fornecedores temos", e sim "quantos fornecedores DA MESMA REGIÃO vendem O
// MESMO ITEM com preço". Um fornecedor com cem itens e ninguém ao lado dele
// continua dando zero comparação.
//
// Conta do mesmo jeito que a tela Onde comprar agrupa: o mesmo item é o mesmo
// item do catálogo (catalog_item_id), só vitrine publicada entra, só oferta ativa
// entra, e item sem preço não conta — "sob consulta" não se compara.

import { MARCO, pracaDaCidade, type Praca } from "./praca.ts";

export type LinhaDoMedidor = {
  empresa: string;
  tipoDeConta: "fornecedor" | "comerciante";
  cidade: string | null;
  uf: string | null;
  /** Só de fornecedor com vitrine publicada; null quando não há oferta. */
  itemId: string | null;
  itemNome: string | null;
  temPreco: boolean;
};

export type MedidaDaPraca = {
  vitrines: number;
  fornecedoresComPreco: number;
  itensEmComum: number;
  petShops: number;
  itens: { nome: string; fornecedores: number }[];
  marcoBatido: boolean;
};

export function medirPraca(linhas: LinhaDoMedidor[], praca: Praca): MedidaDaPraca {
  const vitrines = new Set<string>();
  const comPreco = new Set<string>();
  const petShops = new Set<string>();
  const porItem = new Map<string, { nome: string; fornecedores: Set<string> }>();

  for (const linha of linhas) {
    if (pracaDaCidade(linha.cidade, linha.uf) !== praca) continue;
    if (linha.tipoDeConta === "comerciante") {
      petShops.add(linha.empresa);
      continue;
    }
    vitrines.add(linha.empresa);
    if (!linha.itemId || !linha.temPreco) continue;
    comPreco.add(linha.empresa);
    const item = porItem.get(linha.itemId) ?? {
      nome: linha.itemNome ?? "",
      fornecedores: new Set<string>(),
    };
    // Set: o mesmo fornecedor com o mesmo item em duas embalagens (15 kg e
    // 20 kg) continua sendo um fornecedor para esse item.
    item.fornecedores.add(linha.empresa);
    porItem.set(linha.itemId, item);
  }

  const itens = [...porItem.values()]
    .map((item) => ({ nome: item.nome, fornecedores: item.fornecedores.size }))
    .filter((item) => item.fornecedores >= 2)
    .sort((a, b) => b.fornecedores - a.fornecedores || a.nome.localeCompare(b.nome, "pt-BR"));
  const itensEmComum = itens.filter(
    (item) => item.fornecedores >= MARCO.fornecedoresPorItem,
  ).length;

  return {
    vitrines: vitrines.size,
    fornecedoresComPreco: comPreco.size,
    itensEmComum,
    petShops: petShops.size,
    itens,
    marcoBatido: vitrines.size >= MARCO.vitrines && itensEmComum >= MARCO.itensEmComum,
  };
}
