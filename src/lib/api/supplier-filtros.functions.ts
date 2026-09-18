import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { pontuacao, posicaoNaRegiao } from "../desempenho-fornecedor";
import { efeitoDoFiltro, type FiltrosDeOrcamento } from "../filtro-orcamentos";
import { requireActiveSession, type SessionUser } from "../server/auth.server";
import { query } from "../server/db.server";
import { sinaisDaRegiao } from "../server/desempenho.server";
import {
  filtrosDoFornecedor,
  lugarDoFornecedor,
  pedidosParaFiltrar,
} from "../server/filtro-orcamentos.server";

function requireSupplier(user: SessionUser) {
  if (user.accountType !== "fornecedor") throw new Error("Área exclusiva de fornecedores");
  return user;
}

const filtrosSchema = z.object({
  valorMinimo: z.number().min(0).max(9_999_999).nullable(),
  alcance: z.enum(["todos", "uf", "cidade"]),
  segmentos: z.array(z.string().trim().max(40)).max(30),
  soComEstoque: z.boolean(),
});

export const getFiltrosDeOrcamento = createServerFn({ method: "GET" }).handler(async () => {
  const user = requireSupplier(await requireActiveSession());
  return filtrosDoFornecedor(user.companyId);
});

export const salvarFiltrosDeOrcamento = createServerFn({ method: "POST" })
  .validator(filtrosSchema)
  .handler(async ({ data }) => {
    const user = requireSupplier(await requireActiveSession());
    await query(
      `INSERT INTO filtros_de_orcamento (company_id,valor_minimo,alcance,segmentos,so_com_estoque)
       VALUES ($1,$2,$3,$4::text[],$5)
       ON CONFLICT (company_id) DO UPDATE SET valor_minimo=excluded.valor_minimo,
         alcance=excluded.alcance, segmentos=excluded.segmentos,
         so_com_estoque=excluded.so_com_estoque, updated_at=now()`,
      [user.companyId, data.valorMinimo, data.alcance, data.segmentos, data.soComEstoque],
    );
    return { ok: true };
  });

/**
 * O que esses filtros fariam com os últimos 90 dias: quantos pedidos e quantos
 * R$ ele deixaria de ver, e o que isso faz com a taxa de resposta e com a
 * posição na região. Números do histórico dele, não estimativa.
 */
export const efeitoDosFiltros = createServerFn({ method: "POST" })
  .validator(filtrosSchema)
  .handler(async ({ data }) => {
    const user = requireSupplier(await requireActiveSession());
    const filtros: FiltrosDeOrcamento = data;
    const [lugar, pedidos, regiao] = await Promise.all([
      lugarDoFornecedor(user.companyId),
      pedidosParaFiltrar(user.companyId),
      sinaisDaRegiao(user.companyId),
    ]);
    const efeito = efeitoDoFiltro(
      pedidos.map((p) => p.situacao),
      filtros,
      lugar,
    );

    // A posição com o filtro: a mesma conta da tela de posição, com as
    // respostas dos pedidos escondidos tiradas dos sinais dele.
    const eu = regiao.find((r) => r.id === user.companyId);
    let posicaoAtual = null;
    let posicaoComFiltro = null;
    if (eu) {
      const todas = regiao.map((r) => pontuacao(r.sinais));
      posicaoAtual = posicaoNaRegiao(pontuacao(eu.sinais), todas);
      const depois = pontuacao({
        ...eu.sinais,
        respondidos: Math.max(0, eu.sinais.respondidos - efeito.jaRespondidos),
      });
      posicaoComFiltro = posicaoNaRegiao(
        depois,
        regiao.map((r) => (r.id === user.companyId ? depois : pontuacao(r.sinais))),
      );
    }
    return { ...efeito, posicaoAtual, posicaoComFiltro };
  });
