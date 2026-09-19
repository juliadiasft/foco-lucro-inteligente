import { createServerFn } from "@tanstack/react-start";

import {
  componentesDoIndice,
  indiceDeSaude,
  pontosQuePuxamParaBaixo,
  variacaoDoIndice,
  type FotoDoIndice,
} from "../indice-saude";
import { produtosParados, DIAS_SEM_VENDA } from "../limite-produtos";
import { margemBaixa } from "../regras-produto";
import { requireActiveSession } from "../server/auth.server";
import { query } from "../server/db.server";
import { compararCustos } from "../server/signals.server";

// M01: o índice de saúde do lucro. Recalculado a cada abertura do Painel — o
// que se guarda é só uma foto por dia, para poder dizer "+N no mês".
export const getIndiceDeSaude = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  if (user.accountType !== "comerciante") return null;

  const [produtos, custos, dia] = await Promise.all([
    query<{
      id: string;
      name: string;
      cost_price: string;
      sale_price: string;
      created_at: Date;
      ultima_venda: Date | null;
    }>(
      `SELECT p.id, p.name, p.cost_price::text, p.sale_price::text, p.created_at,
              (SELECT max(s.sold_at) FROM sale_items si JOIN sales s ON s.id = si.sale_id
                WHERE si.product_id = p.id) ultima_venda
         FROM products p WHERE p.company_id=$1 AND p.active=true`,
      [user.companyId],
    ),
    compararCustos(user.companyId),
    query<{ hoje: string }>(
      "SELECT to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD') hoje",
    ),
  ]);
  const hoje = dia.rows[0].hoje;

  const comMargem = produtos.rows.filter(
    (p) => Number(p.cost_price) > 0 && Number(p.sale_price) > 0,
  );
  // Produto cadastrado há pouco não teve tempo de vender: fora da conta do giro.
  const limite = Date.now() - DIAS_SEM_VENDA * 86_400_000;
  const maduros = produtos.rows.filter((p) => new Date(p.created_at).getTime() < limite);
  const parados = produtosParados(
    maduros.map((p) => ({
      id: p.id,
      name: p.name,
      ultimaVenda: p.ultima_venda ? new Date(p.ultima_venda) : null,
      criadoEm: new Date(p.created_at),
    })),
    new Date(),
  );

  const componentes = componentesDoIndice({
    comMargem: comMargem.length,
    margemBaixa: comMargem.filter((p) => margemBaixa(Number(p.cost_price), Number(p.sale_price)))
      .length,
    comparados: custos.comparados,
    pagandoCaro: custos.sinais.length,
    ativos: maduros.length,
    parados: parados.length,
  });
  const score = indiceDeSaude(componentes);
  if (score === null) return null;

  const valorDe = (chave: string) => componentes.find((c) => c.chave === chave)?.valor ?? null;
  await query(
    `INSERT INTO indice_saude (company_id,data,score,comp_margem,comp_custo,comp_giro)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (company_id,data) DO UPDATE SET score=excluded.score,
       comp_margem=excluded.comp_margem, comp_custo=excluded.comp_custo, comp_giro=excluded.comp_giro`,
    [user.companyId, hoje, score, valorDe("margem"), valorDe("custo"), valorDe("giro")],
  );
  const fotos = await query<{ data: string; score: number }>(
    `SELECT to_char(data,'YYYY-MM-DD') data, score FROM indice_saude
      WHERE company_id=$1 AND data < $2::date AND data >= $2::date - 40`,
    [user.companyId, hoje],
  );

  return {
    score,
    variacao: variacaoDoIndice({ data: hoje, score }, fotos.rows as FotoDoIndice[]),
    puxamParaBaixo: pontosQuePuxamParaBaixo(componentes).map((c) => ({
      chave: c.chave,
      titulo: c.titulo,
      detalhe: c.detalhe,
      perda: c.perda,
    })),
    // O que ainda está na mesa: só o achado de preço, na primeira compra (não é
    // projeção mensal — o desenho tinha "vazando por mês", e isso não medimos).
    naMesa: Math.round(custos.sinais.reduce((s, x) => s + x.economiaNaCompra, 0) * 100) / 100,
    achados: custos.sinais.length,
  };
});
