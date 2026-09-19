// Calculadora de margem para quem revende em marketplace (etapa 6).
//
// Responde uma pergunta só: "vendendo aqui por esse preço, quanto sobra?" e a
// inversa, "que preço eu preciso cobrar para sobrar X%?".
//
// As taxas dos canais mudam várias vezes por ano (Shopee e TikTok Shop mexeram
// em 2026; o Mercado Livre passou o custo fixo a depender do peso). Por isso:
//   - toda taxa é editável na tela; o que está aqui é só o ponto de partida;
//   - cada canal diz o quanto da tabela foi CONFERIDO na página oficial, e em
//     que dia. Nada é apresentado como certo quando não foi visto na fonte.

export type CanalId = "mercadolivre" | "shopee" | "amazon" | "magalu" | "tiktok" | "direta";

/** Como a taxa foi obtida. "estimativa" = só de fonte secundária, sem página oficial. */
export type Confianca = "oficial" | "parcial" | "estimativa";

export type Faixa = {
  /** Vale para preço a partir daqui (inclusive). */
  de: number;
  comissaoPct: number;
  /** Taxa fixa em R$ por item vendido. */
  fixo: number;
};

export type Canal = {
  id: CanalId;
  nome: string;
  faixas: Faixa[];
  /** Comissão mínima em R$ (Amazon cobra no mínimo R$ 2,00 em produtos pet). */
  comissaoMinima?: number;
  confianca: Confianca;
  /** O que foi e o que não foi visto na fonte oficial. */
  nota: string;
  /** Onde o vendedor confere a taxa do caso dele. */
  fonte: string;
};

/** Dia em que as tabelas abaixo foram lidas. */
export const TAXAS_CONFERIDAS_EM = "2026-09-18";

export const CANAIS: Canal[] = [
  {
    id: "mercadolivre",
    nome: "Mercado Livre",
    // Anúncio clássico, categoria de acessórios pet. Premium soma ~5 pontos.
    faixas: [
      { de: 0, comissaoPct: 12.5, fixo: 6.75 },
      { de: 79, comissaoPct: 12.5, fixo: 0 },
    ],
    confianca: "estimativa",
    nota: "Não consegui abrir a tabela oficial (a página bloqueia leitura automática). Valores de fontes secundárias. Desde março de 2026 o custo fixo depende do peso e das medidas: aqui vai o teto antigo. Anúncio premium cobra uns 5 pontos a mais. Confira no simulador de custos do Mercado Livre.",
    fonte: "https://www.mercadolivre.com.br/simulador-de-custos",
  },
  {
    id: "shopee",
    nome: "Shopee",
    faixas: [
      { de: 0, comissaoPct: 20, fixo: 4 },
      { de: 80, comissaoPct: 14, fixo: 16 },
      { de: 100, comissaoPct: 14, fixo: 20 },
      { de: 200, comissaoPct: 14, fixo: 26 },
    ],
    confianca: "parcial",
    nota: "Os valores fixos (R$ 4, 16, 20 e 26) vêm da política oficial; os percentuais vêm de fontes secundárias. Vendedor CPF com mais de 450 pedidos em 90 dias paga R$ 3 a mais por item.",
    fonte: "https://seller.shopee.com.br/edu/article/26839",
  },
  {
    id: "amazon",
    nome: "Amazon",
    faixas: [{ de: 0, comissaoPct: 12, fixo: 2 }],
    comissaoMinima: 2,
    confianca: "oficial",
    nota: "Categoria produtos para animais, plano Individual (R$ 2 por item). No plano Profissional não há taxa por item, mas há mensalidade (grátis no 1º ano). A comissão incide também sobre o frete pago pelo cliente.",
    fonte: "https://venda.amazon.com.br/precos",
  },
  {
    id: "magalu",
    nome: "Magalu",
    faixas: [{ de: 0, comissaoPct: 18, fixo: 0 }],
    confianca: "parcial",
    nota: "A comissão de 18% é a informada pelo Magalu; vendedor novo paga 9,9% por 3 meses ou até R$ 100 mil vendidos. Existe um custo fixo por pedido que a página pública não informa: veja no portal do parceiro e preencha.",
    fonte: "https://universo.magalu.com/blog/artigo/vendaagora",
  },
  {
    id: "tiktok",
    nome: "TikTok Shop",
    faixas: [
      { de: 0, comissaoPct: 10, fixo: 4 },
      { de: 50, comissaoPct: 6, fixo: 6 },
    ],
    confianca: "oficial",
    nota: "Vigente desde 15/07/2026. Calculado sobre o preço depois dos seus descontos. Vendedor novo pode ter comissão zerada por 60 dias cumprindo missões.",
    fonte: "https://seller-br.tiktok.com/university/essay?knowledge_id=24428156307201&lang=pt-BR",
  },
  {
    id: "direta",
    nome: "Venda direta",
    faixas: [{ de: 0, comissaoPct: 0, fixo: 0 }],
    confianca: "oficial",
    nota: "Loja própria, WhatsApp ou Instagram: sem comissão de marketplace. Se cobrar no cartão, coloque a taxa da sua maquininha em “Comissão”. Serve de comparação.",
    fonte: "",
  },
];

export const CONFIANCA_ROTULO: Record<Confianca, string> = {
  oficial: "Conferida na página oficial",
  parcial: "Conferida em parte",
  estimativa: "Não conferida na fonte oficial",
};

export type Entrada = {
  preco: number;
  /** O que o produto custou para você (por unidade). */
  custo: number;
  /** Frete que sai do seu bolso (quando o canal não desconta do cliente). */
  frete: number;
  /** Embalagem, brinde, outros custos por venda. */
  outros: number;
  /** Imposto sobre a venda, em % (Simples etc.). */
  impostoPct: number;
  /** Se preenchidos, substituem a tabela do canal. */
  comissaoPct?: number | null;
  fixo?: number | null;
};

export type Resultado = {
  comissaoPct: number;
  comissao: number;
  fixo: number;
  imposto: number;
  lucro: number;
  /** Lucro sobre o preço de venda, em %. `null` sem preço. */
  margemPct: number | null;
  /** Quanto sobra sobre o custo, em %. */
  margemSobreCustoPct: number | null;
};

const arredonda = (n: number) => Math.round(n * 100) / 100;

export function faixaDoPreco(canal: Canal, preco: number): Faixa {
  let achada = canal.faixas[0];
  for (const faixa of canal.faixas) if (preco >= faixa.de) achada = faixa;
  return achada;
}

export function calcular(canal: Canal, entrada: Entrada): Resultado {
  const faixa = faixaDoPreco(canal, entrada.preco);
  const comissaoPct = entrada.comissaoPct ?? faixa.comissaoPct;
  const fixo = entrada.fixo ?? faixa.fixo;
  const daTabela = (entrada.preco * comissaoPct) / 100;
  // A comissão mínima é da tabela do canal; se a pessoa digitou o percentual,
  // vale o que ela digitou.
  const comissao =
    entrada.comissaoPct == null && canal.comissaoMinima
      ? Math.max(daTabela, Math.min(canal.comissaoMinima, entrada.preco))
      : daTabela;
  const imposto = (entrada.preco * entrada.impostoPct) / 100;
  const lucro =
    entrada.preco - entrada.custo - comissao - fixo - imposto - entrada.frete - entrada.outros;
  return {
    comissaoPct,
    comissao: arredonda(comissao),
    fixo: arredonda(fixo),
    imposto: arredonda(imposto),
    lucro: arredonda(lucro),
    margemPct: entrada.preco > 0 ? arredonda((lucro / entrada.preco) * 100) : null,
    margemSobreCustoPct: entrada.custo > 0 ? arredonda((lucro / entrada.custo) * 100) : null,
  };
}

/**
 * O menor preço, em centavos, que deixa `margemAlvoPct` de lucro sobre a venda.
 * Devolve `null` quando nenhum preço resolve (taxas + margem passam de 100%).
 *
 * A comissão muda por faixa de preço e há comissão mínima, então não existe uma
 * fórmula única: resolve-se a equação em cada caso (cada faixa, com e sem o
 * mínimo), confere cada candidato na própria `calcular` e fica com o menor que
 * de fato atinge a margem.
 */
export function precoParaMargem(
  canal: Canal,
  entrada: Omit<Entrada, "preco">,
  margemAlvoPct: number,
): number | null {
  const alvo = margemAlvoPct / 100;
  const candidatos: number[] = [];
  const variantes: { comissaoPct: number; fixo: number; faixa?: Faixa }[] =
    entrada.comissaoPct != null || entrada.fixo != null
      ? [
          {
            comissaoPct: entrada.comissaoPct ?? canal.faixas[0].comissaoPct,
            fixo: entrada.fixo ?? canal.faixas[0].fixo,
          },
        ]
      : canal.faixas.map((faixa) => ({
          comissaoPct: faixa.comissaoPct,
          fixo: faixa.fixo,
          faixa,
        }));

  for (const v of variantes) {
    const parteFixa = entrada.custo + v.fixo + entrada.frete + entrada.outros;
    const denominador = 1 - (v.comissaoPct + entrada.impostoPct) / 100 - alvo;
    if (denominador > 0) candidatos.push(parteFixa / denominador);
    // Caso da comissão mínima em R$ (preço baixo, onde o percentual não chega).
    if (canal.comissaoMinima && entrada.comissaoPct == null) {
      const d2 = 1 - entrada.impostoPct / 100 - alvo;
      if (d2 > 0) candidatos.push((parteFixa + canal.comissaoMinima) / d2);
    }
  }

  const validos = candidatos
    .map((p) => Math.ceil(p * 100 - 1e-9) / 100)
    .filter((p) => p > 0)
    .filter((p) => {
      const r = calcular(canal, { ...entrada, preco: p });
      return r.margemPct !== null && r.margemPct >= margemAlvoPct - 0.005;
    });
  return validos.length ? Math.min(...validos) : null;
}
