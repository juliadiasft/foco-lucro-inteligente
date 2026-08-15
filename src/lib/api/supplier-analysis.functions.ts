import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { BaseUnit } from "../catalog";
import { planIncludes, planLimits } from "../plans";
import {
  aiConfigured,
  askOpenAi,
  completeAiSlot,
  releaseAiSlot,
  reserveAiSlot,
} from "../server/ai.server";
import { requireActiveSession, requireFeature, type SessionUser } from "../server/auth.server";
import { query } from "../server/db.server";

function requireSupplier(user: SessionUser) {
  if (user.accountType !== "fornecedor") throw new Error("Área exclusiva de fornecedores");
  return user;
}

// Posição de mercado por item, sempre agregada. O fornecedor descobre se está
// caro ou barato, mas nunca quem é o concorrente nem o preço individual dele.
// Os preços já são visíveis aos comerciantes na busca; o que não pode é a
// plataforma virar ferramenta de espionagem entre fornecedores.
const MARKET_SQL = `
  WITH mercado AS (
    SELECT o.catalog_item_id,
           min(o.price / o.pack_size) menor,
           avg(o.price / o.pack_size) media,
           count(DISTINCT o.company_id) fornecedores
      FROM supplier_offerings o
      JOIN supplier_profiles sp ON sp.company_id = o.company_id AND sp.published = true
     WHERE o.active = true AND o.price IS NOT NULL AND o.pack_size > 0
     GROUP BY o.catalog_item_id
  )
  SELECT ci.name, ci.brand, ci.base_unit, o.pack_size, o.price,
         (o.price / o.pack_size)::text meu_unitario,
         m.menor::text menor, m.media::text media, m.fornecedores::text fornecedores
    FROM supplier_offerings o
    JOIN catalog_items ci ON ci.id = o.catalog_item_id
    LEFT JOIN mercado m ON m.catalog_item_id = o.catalog_item_id
   WHERE o.company_id = $1 AND o.active = true AND o.price IS NOT NULL AND o.pack_size > 0
   ORDER BY ci.name
   LIMIT 100`;

type MarketRow = {
  name: string;
  brand: string | null;
  base_unit: BaseUnit;
  pack_size: string;
  price: string;
  meu_unitario: string;
  menor: string | null;
  media: string | null;
  fornecedores: string | null;
};

async function loadSupplierData(companyId: string) {
  const [perfil, mercado, orcamentos, pedidos, clientes, conversas] = await Promise.all([
    query<{
      display_name: string | null;
      published: boolean | null;
      delivery_days: number | null;
      minimum_order: string | null;
      itens: string;
      nichos: string | null;
      city: string | null;
      uf: string | null;
    }>(
      `SELECT sp.display_name, sp.published, sp.delivery_days, sp.minimum_order,
              (SELECT count(*) FROM supplier_offerings o
                WHERE o.company_id=c.id AND o.active=true)::text itens,
              (SELECT string_agg(sg.name, ', ') FROM company_segments cs
                 JOIN segments sg ON sg.id=cs.segment_id WHERE cs.company_id=c.id) nichos,
              c.city, c.uf
         FROM companies c LEFT JOIN supplier_profiles sp ON sp.company_id=c.id
        WHERE c.id=$1`,
      [companyId],
    ),
    query<MarketRow>(MARKET_SQL, [companyId]),
    query<{ total: string; aguardando: string; ganhos: string; perdidos: string }>(
      `SELECT count(*)::text total,
              count(*) FILTER (WHERE status='aberto')::text aguardando,
              count(*) FILTER (WHERE status='aceito')::text ganhos,
              count(*) FILTER (WHERE status IN ('recusado','cancelado'))::text perdidos
         FROM quote_requests WHERE supplier_company_id=$1`,
      [companyId],
    ),
    query<{ pedidos: string; faturamento: string; ticket: string; mes: string }>(
      `SELECT count(*)::text pedidos,
              coalesce(sum(total),0)::text faturamento,
              coalesce(avg(total),0)::text ticket,
              coalesce(sum(total) FILTER (WHERE created_at >= date_trunc('month',now())),0)::text mes
         FROM purchase_orders
        WHERE supplier_company_id=$1 AND status IN ('aceito','concluido')`,
      [companyId],
    ),
    query<{ nome: string; pedidos: string; valor: string }>(
      `SELECT c.name nome, count(*)::text pedidos, sum(o.total)::text valor
         FROM purchase_orders o JOIN companies c ON c.id=o.merchant_company_id
        WHERE o.supplier_company_id=$1 AND o.status IN ('aceito','concluido')
        GROUP BY c.id, c.name ORDER BY sum(o.total) DESC LIMIT 10`,
      [companyId],
    ),
    query<{ sem_resposta: string }>(
      `SELECT count(*)::text sem_resposta
         FROM conversations c
        WHERE c.supplier_company_id=$1
          AND NOT EXISTS (SELECT 1 FROM messages m
                           WHERE m.conversation_id=c.id AND m.sender_company_id=$1)`,
      [companyId],
    ),
  ]);

  return {
    perfil: perfil.rows[0],
    mercado: mercado.rows,
    orcamentos,
    pedidos,
    clientes,
    conversas,
  };
}

export const getSupplierInsights = createServerFn({ method: "GET" }).handler(async () => {
  const user = requireSupplier(await requireActiveSession());
  const dados = await loadSupplierData(user.companyId);
  const usage = await query<{ total: string }>(
    "SELECT count(*)::text total FROM ai_usage WHERE company_id=$1 AND created_at >= date_trunc('month',now())",
    [user.companyId],
  );

  const acima = dados.mercado
    .filter((row) => row.media !== null && Number(row.meu_unitario) > Number(row.media))
    .map((row) => ({
      nome: row.name,
      marca: row.brand,
      baseUnit: row.base_unit,
      meuPreco: Number(row.meu_unitario),
      mediaMercado: Number(row.media),
      menorMercado: row.menor === null ? null : Number(row.menor),
      fornecedores: Number(row.fornecedores || 0),
      diferencaPercentual:
        ((Number(row.meu_unitario) - Number(row.media)) / Number(row.media)) * 100,
    }))
    .sort((a, b) => b.diferencaPercentual - a.diferencaPercentual)
    .slice(0, 10);

  const alertas: { nivel: "danger" | "warning" | "info"; titulo: string; texto: string }[] = [];
  if (!dados.perfil?.published)
    alertas.push({
      nivel: "danger",
      titulo: "Sua vitrine está oculta",
      texto: "Enquanto não publicar, nenhum comerciante encontra você na busca.",
    });
  if (Number(dados.perfil?.itens || 0) === 0)
    alertas.push({
      nivel: "danger",
      titulo: "Seu catálogo está vazio",
      texto: "Sem itens cadastrados você não aparece em nenhuma comparação de preço.",
    });
  if (Number(dados.orcamentos.rows[0].aguardando) > 0)
    alertas.push({
      nivel: "warning",
      titulo: `${dados.orcamentos.rows[0].aguardando} orçamento(s) esperando resposta`,
      texto: "Comerciante que não recebe proposta procura outro fornecedor.",
    });
  if (Number(dados.conversas.rows[0].sem_resposta) > 0)
    alertas.push({
      nivel: "warning",
      titulo: `${dados.conversas.rows[0].sem_resposta} conversa(s) sem resposta`,
      texto: "Alguém falou com você e ainda não teve retorno.",
    });
  if (acima.length)
    alertas.push({
      nivel: "info",
      titulo: `${acima.length} item(ns) acima da média do mercado`,
      texto: "Revise o preço destes itens para aparecer melhor nas comparações.",
    });
  if (!alertas.length)
    alertas.push({
      nivel: "info",
      titulo: "Nada exigindo atenção agora",
      texto: "Mantenha o catálogo e os preços atualizados para continuar competitivo.",
    });

  return {
    vitrinePublicada: Boolean(dados.perfil?.published),
    itens: Number(dados.perfil?.itens || 0),
    orcamentos: {
      total: Number(dados.orcamentos.rows[0].total),
      aguardando: Number(dados.orcamentos.rows[0].aguardando),
      ganhos: Number(dados.orcamentos.rows[0].ganhos),
      perdidos: Number(dados.orcamentos.rows[0].perdidos),
    },
    vendas: {
      pedidos: Number(dados.pedidos.rows[0].pedidos),
      faturamento: Number(dados.pedidos.rows[0].faturamento),
      ticket: Number(dados.pedidos.rows[0].ticket),
      mes: Number(dados.pedidos.rows[0].mes),
    },
    clientes: dados.clientes.rows.map((row) => ({
      nome: row.nome,
      pedidos: Number(row.pedidos),
      valor: Number(row.valor),
    })),
    acimaDoMercado: acima,
    alertas,
    aiUsed: Number(usage.rows[0].total),
    aiLimit: planLimits[user.plan].aiRequestsPerMonth,
    aiEnabled: planIncludes(user.plan, "consultorIa"),
    aiConfigured: aiConfigured(),
  };
});

export const askSupplierAi = createServerFn({ method: "POST" })
  .validator(z.object({ question: z.string().trim().min(3).max(1200) }))
  .handler(async ({ data }) => {
    const user = requireSupplier(await requireActiveSession());
    requireFeature(user, "consultorIa");

    const slot = await reserveAiSlot(user, data.question);
    try {
      const dados = await loadSupplierData(user.companyId);

      // O contexto enviado é só da própria empresa, mais a posição de mercado
      // agregada. Nenhum nome de concorrente e nenhum preço individual de
      // outro fornecedor saem daqui.
      const contexto = {
        empresa: {
          nome: dados.perfil?.display_name || user.companyName,
          nichos: dados.perfil?.nichos,
          cidade: dados.perfil?.city,
          estado: dados.perfil?.uf,
          vitrinePublicada: Boolean(dados.perfil?.published),
          prazoEntregaDias: dados.perfil?.delivery_days,
          pedidoMinimo: dados.perfil?.minimum_order ? Number(dados.perfil.minimum_order) : null,
          itensNoCatalogo: Number(dados.perfil?.itens || 0),
        },
        posicaoDeMercado: dados.mercado.map((row) => ({
          produto: row.name,
          marca: row.brand,
          unidade: row.base_unit,
          meuPrecoPorUnidade: Number(row.meu_unitario),
          menorPrecoDoMercado: row.menor === null ? null : Number(row.menor),
          precoMedioDoMercado: row.media === null ? null : Number(row.media),
          quantosFornecedoresOferecem: Number(row.fornecedores || 0),
        })),
        orcamentos: {
          total: Number(dados.orcamentos.rows[0].total),
          aguardandoMinhaResposta: Number(dados.orcamentos.rows[0].aguardando),
          fechados: Number(dados.orcamentos.rows[0].ganhos),
          perdidos: Number(dados.orcamentos.rows[0].perdidos),
        },
        vendas: {
          pedidos: Number(dados.pedidos.rows[0].pedidos),
          faturamentoTotal: Number(dados.pedidos.rows[0].faturamento),
          ticketMedio: Number(dados.pedidos.rows[0].ticket),
          faturamentoDoMes: Number(dados.pedidos.rows[0].mes),
        },
        principaisClientes: dados.clientes.rows.map((row) => ({
          nome: row.nome,
          pedidos: Number(row.pedidos),
          valor: Number(row.valor),
        })),
        conversasSemMinhaResposta: Number(dados.conversas.rows[0].sem_resposta),
      };

      const { answer, usage } = await askOpenAi(
        "Você é um consultor comercial de distribuidores e fornecedores do pequeno comércio brasileiro. Responda em português simples e direto. Use somente os dados fornecidos, cite os números relevantes e dê de 2 a 5 ações práticas para vender mais. Sobre preço, compare apenas com a média e o menor preço do mercado que estão nos dados: você não sabe quem são os concorrentes e nunca deve especular sobre eles. Diferencie fatos de estimativas. Não dê garantias financeiras, fiscais ou jurídicas. Se faltarem dados, diga exatamente o que precisa ser cadastrado.",
        `DADOS DO FORNECEDOR:\n${JSON.stringify(contexto)}\n\nPERGUNTA DO FORNECEDOR:\n${data.question}`,
      );

      await completeAiSlot(slot.id, answer, usage);
      return { answer, remaining: slot.remaining };
    } catch (error) {
      await releaseAiSlot(slot.id);
      throw error;
    }
  });

export const listSupplierAiHistory = createServerFn({ method: "GET" }).handler(async () => {
  const user = requireSupplier(await requireActiveSession());
  if (!planIncludes(user.plan, "consultorIa")) return [];
  const result = await query<{ id: string; question: string; answer: string; created_at: Date }>(
    "SELECT id,question,answer,created_at FROM ai_usage WHERE company_id=$1 AND answer <> '' ORDER BY created_at DESC LIMIT 20",
    [user.companyId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    question: row.question,
    answer: row.answer,
    createdAt: row.created_at.toISOString(),
  }));
});
