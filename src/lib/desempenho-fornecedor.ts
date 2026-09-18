// Posição do fornecedor na região (S07) e o que a faz subir.
//
// Regra de produto (SPEC §5): posição não se compra. Ela só depende do que o
// fornecedor faz — responder, responder rápido e manter o preço em dia. Nada
// aqui olha plano, pagamento ou tamanho.
//
// Três sinais, com pesos: o desenho tinha um quarto (estoque confiável), mas o
// sistema não mede isso hoje e um número inventado não ajuda ninguém a subir.

export type SinaisDoFornecedor = {
  /** Orçamentos que chegaram e já passou tempo de responder. */
  recebidos: number;
  respondidos: number;
  /** Mediana, em horas, do pedido até a primeira proposta. Nulo sem resposta. */
  medianaHoras: number | null;
  ofertas: number;
  /** Ofertas sem atualização há mais de 30 dias. */
  ofertasVelhas: number;
};

export const PESOS = { resposta: 0.4, tempo: 0.3, precos: 0.3 } as const;

/** Responder em até 2h vale tudo; 48h ou mais não vale nada. */
export const HORAS_BOAS = 2;
export const HORAS_RUINS = 48;

const entre01 = (n: number) => Math.min(1, Math.max(0, n));

export type Componentes = {
  resposta: number | null;
  tempo: number | null;
  precos: number | null;
};

export function componentes(s: SinaisDoFornecedor): Componentes {
  return {
    resposta: s.recebidos > 0 ? entre01(s.respondidos / s.recebidos) : null,
    tempo:
      s.medianaHoras === null
        ? null
        : entre01(1 - (s.medianaHoras - HORAS_BOAS) / (HORAS_RUINS - HORAS_BOAS)),
    precos: s.ofertas > 0 ? entre01((s.ofertas - s.ofertasVelhas) / s.ofertas) : null,
  };
}

/**
 * De 0 a 100. Sinal que ainda não existe (fornecedor novo, sem orçamento) sai da
 * conta e os pesos dos outros são redistribuídos: quem acabou de chegar não é
 * punido por não ter histórico. Sem nenhum sinal, nulo.
 */
export function pontuacao(s: SinaisDoFornecedor): number | null {
  const c = componentes(s);
  let soma = 0;
  let pesos = 0;
  for (const chave of ["resposta", "tempo", "precos"] as const) {
    const valor = c[chave];
    if (valor === null) continue;
    soma += valor * PESOS[chave];
    pesos += PESOS[chave];
  }
  return pesos === 0 ? null : (soma / pesos) * 100;
}

export type Posicao = { posicao: number; total: number };

/**
 * Em que lugar a pontuação fica entre as da região (a própria incluída em
 * `todas`). Empate divide a melhor posição. Sem pontuação, sem posição.
 */
export function posicaoNaRegiao(minha: number | null, todas: (number | null)[]): Posicao | null {
  if (minha === null) return null;
  const validas = todas.filter((p): p is number => p !== null);
  const arredonda = (n: number) => Math.round(n * 10) / 10;
  const melhores = validas.filter((p) => arredonda(p) > arredonda(minha)).length;
  return { posicao: melhores + 1, total: validas.length };
}

export type AcaoParaSubir = {
  chave: "responder_abertos" | "atualizar_precos" | "responder_rapido";
  titulo: string;
  detalhe: string;
  pontos: number;
};

const pctDe = (respondidos: number, recebidos: number) =>
  Math.round((respondidos / Math.max(1, recebidos)) * 100);

/** O que mais rende, em pontos reais: simula a ação feita e mede a diferença. */
export function acoesParaSubir(s: SinaisDoFornecedor, abertos: number): AcaoParaSubir[] {
  const base = pontuacao(s);
  if (base === null) return [];
  const acoes: AcaoParaSubir[] = [];
  const ganho = (novo: SinaisDoFornecedor) => {
    const p = pontuacao(novo);
    return p === null ? 0 : Math.round(p - base);
  };

  if (abertos > 0 && s.recebidos > 0) {
    const depois = Math.min(s.recebidos, s.respondidos + abertos);
    const pontos = ganho({ ...s, respondidos: depois });
    if (pontos >= 1)
      acoes.push({
        chave: "responder_abertos",
        titulo:
          abertos === 1 ? "Responder o orçamento em aberto" : `Responder os ${abertos} em aberto`,
        detalhe: `sua taxa vai de ${pctDe(s.respondidos, s.recebidos)}% para ${pctDe(depois, s.recebidos)}%`,
        pontos,
      });
  }
  if (s.ofertasVelhas > 0) {
    const pontos = ganho({ ...s, ofertasVelhas: 0 });
    if (pontos >= 1)
      acoes.push({
        chave: "atualizar_precos",
        titulo: `Atualizar ${s.ofertasVelhas} ${s.ofertasVelhas === 1 ? "preço velho" : "preços velhos"}`,
        detalhe: "parados há mais de 30 dias",
        pontos,
      });
  }
  if (s.medianaHoras !== null && s.medianaHoras > HORAS_BOAS) {
    const pontos = ganho({ ...s, medianaHoras: HORAS_BOAS });
    if (pontos >= 1)
      acoes.push({
        chave: "responder_rapido",
        titulo: `Responder em até ${HORAS_BOAS}h`,
        detalhe: `hoje sua média é ${horasPorExtenso(s.medianaHoras)}`,
        pontos,
      });
  }
  return acoes.sort((a, b) => b.pontos - a.pontos);
}

/** 4,33 → "4h20"; 0,5 → "30min"; 26 → "1d2h". */
export function horasPorExtenso(horas: number): string {
  const minutos = Math.round(horas * 60);
  if (minutos < 60) return `${minutos}min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const resto = h % 24;
    return resto ? `${d}d${resto}h` : `${d}d`;
  }
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;
