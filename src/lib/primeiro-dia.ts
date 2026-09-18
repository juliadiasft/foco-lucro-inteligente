// O que falta para o fornecedor ser encontrado — e o que mostrar enquanto falta.
//
// O painel de quem acabou de se cadastrar abre hoje com três vazios em
// sequência: "nenhum cliente esperando agora", "nenhum nicho escolhido",
// "ainda não há avaliações". Quem chegou há um minuto lê isso como "não tem
// nada aqui" e fecha — e quem perde é a Julia, que trouxe essa pessoa no
// telefone.
//
// O vazio não é o problema: o problema é o vazio que não diz o que fazer nem
// por quê. Cada passo aqui carrega o motivo dele em dinheiro ou em visibilidade,
// nunca "complete seu perfil".

export type PassoDoFornecedor = {
  chave: "catalogo" | "nicho" | "vitrine" | "entrega";
  titulo: string;
  porque: string;
  feito: boolean;
  /** Onde a pessoa resolve isto. */
  para: string;
};

export type EstadoDoFornecedor = {
  itensNoCatalogo: number;
  temNicho: boolean;
  vitrinePublicada: boolean;
  prazoDeEntrega: number | null;
};

/**
 * Os passos, na ordem em que valem a pena.
 *
 * Catálogo vem primeiro e não é negociável: sem preço cadastrado o fornecedor
 * não aparece em busca nenhuma, e todo o resto é enfeite. Vitrine vem depois
 * do nicho porque publicar sem nicho é publicar para ninguém.
 */
export function passosDoFornecedor(estado: EstadoDoFornecedor): PassoDoFornecedor[] {
  return [
    {
      chave: "catalogo",
      titulo: "Subir seus produtos e preços",
      porque:
        estado.itensNoCatalogo > 0
          ? `${estado.itensNoCatalogo} ${estado.itensNoCatalogo === 1 ? "item" : "itens"} no ar`
          : "Sem catálogo você não aparece em nenhuma busca — não há o que comparar",
      feito: estado.itensNoCatalogo > 0,
      para: "/fornecedor/importar",
    },
    {
      chave: "nicho",
      titulo: "Dizer o que você fornece",
      porque: "É o que faz você aparecer para o comerciante certo",
      feito: estado.temNicho,
      para: "/fornecedor",
    },
    {
      chave: "entrega",
      titulo: "Prazo de entrega e pedido mínimo",
      porque: "Quem compra filtra por prazo. Sem isso, você sai dos filtros",
      feito: estado.prazoDeEntrega !== null,
      para: "/fornecedor/vitrine",
    },
    {
      chave: "vitrine",
      titulo: "Publicar sua vitrine",
      porque: "A vitrine é a sua página pública, que aparece no Google",
      feito: estado.vitrinePublicada,
      para: "/fornecedor/vitrine",
    },
  ];
}

/**
 * Se o painel deve abrir no modo primeiro dia.
 *
 * Enquanto o fornecedor não pode ser encontrado, o painel de operação não tem
 * o que mostrar — e mostrar vazio no lugar de instrução é o que faz ele
 * desistir. Some sozinho quando ele fica encontrável.
 */
export function ehPrimeiroDia(estado: EstadoDoFornecedor) {
  return !estado.vitrinePublicada || estado.itensNoCatalogo === 0;
}

export type BuscaDaRegiao = { termo: string; buscas: number; comerciantes: number };

/**
 * A frase do topo: quanta procura existe e o que ele está perdendo.
 *
 * Nunca inventa demanda. Sem busca registrada, devolve null e a tela mostra os
 * passos sem número nenhum — um "0 buscas" em corpo grande convence o
 * fornecedor a ir embora, que é o contrário do que a tela existe para fazer.
 */
export function chamadaDaRegiao(
  buscas: number,
  aparece: boolean,
  regiao: string | null,
): string | null {
  if (buscas <= 0) return null;
  const onde = regiao ? ` perto de ${regiao}` : "";
  const quantas = `${buscas} ${buscas === 1 ? "busca" : "buscas"}${onde} esta semana`;
  return aparece
    ? `${quantas}. Mantenha seus preços novos para continuar aparecendo.`
    : `${quantas} — e você não apareceu em nenhuma.`;
}

// ---------------------------------------------------------------------------
// O primeiro dia de quem compra.
//
// O Painel abria com "Vendido em setembro: R$ 0,00" em corpo grande e mandava
// "conectar seu sistema" — a única coisa que ainda não existe. Quem entra no
// teste de 7 dias bate nessa parede no primeiro minuto.
//
// Aqui vale a mesma regra do lado do fornecedor: cada passo diz o PORQUÊ em
// dinheiro, nunca "complete seu perfil". E só entra passo que o app cumpre hoje:
// câmera e nota fiscal não existem, então não aparecem como promessa.

/** Abaixo disto a Central não tem o que comparar. */
export const PRODUTOS_PARA_COMPARAR = 5;

export type PassoDoComerciante = {
  chave: "conta" | "produtos" | "custos";
  titulo: string;
  porque: string;
  feito: boolean;
  /** Quanto já foi feito, quando o passo é uma contagem. */
  progresso?: { atual: number; total: number };
  para: string;
};

export type EstadoDoComerciante = {
  produtos: number;
  produtosComCusto: number;
  vendasNoMes: number;
  /** Itens de distribuidores publicados na região — o que dá para comparar sem cadastrar nada. */
  itensNaRegiao: number;
  fornecedoresNaRegiao: number;
};

const limitar = (valor: number) => Math.min(valor, PRODUTOS_PARA_COMPARAR);

export function passosDoComerciante(estado: EstadoDoComerciante): PassoDoComerciante[] {
  const produtosFeito = estado.produtos >= PRODUTOS_PARA_COMPARAR;
  const custosFeito = estado.produtosComCusto >= PRODUTOS_PARA_COMPARAR;
  return [
    {
      chave: "conta",
      titulo: "Conta criada",
      porque: "Tudo certo por aqui",
      feito: true,
      para: "/dashboard",
    },
    {
      chave: "produtos",
      titulo: `Cadastre os ${PRODUTOS_PARA_COMPARAR} que mais saem`,
      porque: produtosFeito
        ? `${estado.produtos} produtos cadastrados`
        : `Sem ${PRODUTOS_PARA_COMPARAR} produtos a Central não tem o que comparar`,
      feito: produtosFeito,
      progresso: { atual: limitar(estado.produtos), total: PRODUTOS_PARA_COMPARAR },
      para: "/produtos",
    },
    {
      chave: "custos",
      titulo: "Diga quanto você paga neles",
      porque: custosFeito
        ? "É daí que sai a sua margem"
        : "Sem o custo não dá para dizer quanto sobra em cada um",
      feito: custosFeito,
      progresso: { atual: limitar(estado.produtosComCusto), total: PRODUTOS_PARA_COMPARAR },
      para: "/produtos",
    },
  ];
}

/**
 * O Painel abre no modo primeiro dia enquanto não há o que analisar.
 *
 * Quem já registrou venda no mês não é "primeiro dia" mesmo com poucos produtos:
 * tem número de verdade para mostrar, e esconder isso atrás de um checklist seria
 * tratar quem já usa o app como visitante.
 */
export function ehPrimeiroDiaDoComerciante(estado: EstadoDoComerciante) {
  return estado.produtos < PRODUTOS_PARA_COMPARAR && estado.vendasNoMes === 0;
}

/** Quantos passos de verdade (fora "conta criada") já foram feitos, para "1 de 3". */
export function posicaoDoComerciante(passos: PassoDoComerciante[]) {
  const feitos = passos.filter((passo) => passo.feito).length;
  return { feitos, total: passos.length, proximo: passos.find((passo) => !passo.feito) ?? null };
}

/**
 * A frase do "comparar sem cadastrar nada". Sem itens na região devolve null:
 * prometer "0 itens de 0 distribuidores" mostra um produto vazio em vez de
 * um atalho.
 */
export function chamadaDeComparar(itens: number, fornecedores: number): string | null {
  if (itens <= 0 || fornecedores <= 0) return null;
  const itensTxt = `${itens} ${itens === 1 ? "item" : "itens"}`;
  const fornTxt = `${fornecedores} ${fornecedores === 1 ? "distribuidor" : "distribuidores"}`;
  return `${itensTxt} de ${fornTxt} perto de você, já cotados`;
}
