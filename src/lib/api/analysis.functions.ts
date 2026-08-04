import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { planLimits } from "../plans";
import { requireActiveSession } from "../server/auth.server";
import { query } from "../server/db.server";

export const getProfitAnalysis = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  const [summary, products, usage, suppliers] = await Promise.all([
    query<{ sales: string; revenue: string; profit: string; ticket: string }>(
      `SELECT count(*)::text sales,coalesce(sum(total),0)::text revenue,coalesce(sum(profit),0)::text profit,coalesce(avg(total),0)::text ticket
       FROM sales WHERE company_id=$1 AND sold_at >= now()-interval '30 days'`,
      [user.companyId],
    ),
    query<{
      name: string;
      cost_price: string;
      sale_price: string;
      stock: string;
      minimum_stock: string;
      sold_quantity: string;
    }>(
      `SELECT p.name,p.cost_price,p.sale_price,p.stock,p.minimum_stock,
              coalesce(sum(si.quantity) FILTER (WHERE s.sold_at >= now()-interval '30 days'),0)::text sold_quantity
         FROM products p LEFT JOIN sale_items si ON si.product_id=p.id LEFT JOIN sales s ON s.id=si.sale_id
        WHERE p.company_id=$1 AND p.active=true GROUP BY p.id ORDER BY p.name`,
      [user.companyId],
    ),
    query<{ count: string }>(
      "SELECT count(*)::text count FROM ai_usage WHERE company_id=$1 AND created_at >= date_trunc('month',now())",
      [user.companyId],
    ),
    query<{
      product_name: string;
      current_cost: string;
      best_price: string;
      supplier_name: string;
    }>(
      `SELECT DISTINCT ON (p.id) p.name product_name,p.cost_price current_cost,sp.price best_price,s.name supplier_name
         FROM products p JOIN supplier_prices sp ON sp.product_id=p.id AND sp.company_id=p.company_id JOIN suppliers s ON s.id=sp.supplier_id
        WHERE p.company_id=$1 AND p.active=true AND s.active=true ORDER BY p.id,sp.price ASC`,
      [user.companyId],
    ),
  ]);
  const row = summary.rows[0];
  const revenue = Number(row.revenue);
  const profit = Number(row.profit);
  const mapped = products.rows.map((p) => ({
    name: p.name,
    cost: Number(p.cost_price),
    price: Number(p.sale_price),
    stock: Number(p.stock),
    minimumStock: Number(p.minimum_stock),
    soldQuantity: Number(p.sold_quantity),
  }));
  const opportunities: {
    level: "danger" | "warning" | "success" | "info";
    title: string;
    description: string;
    impact?: number;
  }[] = [];
  const lowMargins = mapped
    .filter((p) => p.price > 0 && ((p.price - p.cost) / p.price) * 100 < 20)
    .slice(0, 5);
  if (lowMargins.length)
    opportunities.push({
      level: "warning",
      title: "Margens abaixo de 20%",
      description: `${lowMargins.map((p) => p.name).join(", ")}. Revise preço ou custo.`,
    });
  const lowStock = mapped.filter((p) => p.stock <= (p.minimumStock || 5)).slice(0, 5);
  if (lowStock.length)
    opportunities.push({
      level: "danger",
      title: "Risco de perder vendas",
      description: `${lowStock.map((p) => p.name).join(", ")} precisam de reposição.`,
    });
  const deadStock = mapped.filter((p) => p.stock > 0 && p.soldQuantity === 0).slice(0, 5);
  if (deadStock.length)
    opportunities.push({
      level: "info",
      title: "Estoque sem giro em 30 dias",
      description: `${deadStock.map((p) => p.name).join(", ")}. Avalie kits, promoções ou menor reposição.`,
    });
  const savings = suppliers.rows
    .filter((p) => Number(p.best_price) < Number(p.current_cost))
    .reduce((sum, p) => sum + Number(p.current_cost) - Number(p.best_price), 0);
  if (savings > 0)
    opportunities.push({
      level: "success",
      title: "Economia nas compras",
      description: "Há cotações abaixo do custo atual cadastrado.",
      impact: savings,
    });
  if (!opportunities.length)
    opportunities.push({
      level: "success",
      title: "Nenhum alerta crítico",
      description: "Continue registrando vendas, estoque e cotações para aumentar a precisão.",
    });
  return {
    summary: {
      sales: Number(row.sales),
      revenue,
      profit,
      ticket: Number(row.ticket),
      margin: revenue > 0 ? (profit / revenue) * 100 : 0,
    },
    opportunities,
    aiUsed: Number(usage.rows[0].count),
    aiLimit: planLimits[user.plan].aiRequestsPerMonth,
    aiEnabled: user.plan === "profissional" || user.plan === "premium",
  };
});

async function loadAiContext(companyId: string) {
  const [company, summary, products, quotes] = await Promise.all([
    query<{
      name: string;
      business_type: string | null;
      monthly_revenue_goal: string;
      expected_average_ticket: string;
    }>(
      "SELECT name,business_type,monthly_revenue_goal,expected_average_ticket FROM companies WHERE id=$1",
      [companyId],
    ),
    query<{ sales: string; revenue: string; cost: string; profit: string; ticket: string }>(
      `SELECT count(*)::text sales,coalesce(sum(total),0)::text revenue,coalesce(sum(total_cost),0)::text cost,
              coalesce(sum(profit),0)::text profit,coalesce(avg(total),0)::text ticket
         FROM sales WHERE company_id=$1 AND sold_at >= now()-interval '30 days'`,
      [companyId],
    ),
    query<{
      name: string;
      cost_price: string;
      sale_price: string;
      stock: string;
      minimum_stock: string;
      sold: string;
      revenue: string;
      profit: string;
    }>(
      `SELECT p.name,p.cost_price,p.sale_price,p.stock,p.minimum_stock,
              coalesce(sum(si.quantity) FILTER (WHERE s.sold_at >= now()-interval '30 days'),0)::text sold,
              coalesce(sum(si.subtotal) FILTER (WHERE s.sold_at >= now()-interval '30 days'),0)::text revenue,
              coalesce(sum((si.unit_price-si.unit_cost)*si.quantity) FILTER (WHERE s.sold_at >= now()-interval '30 days'),0)::text profit
         FROM products p LEFT JOIN sale_items si ON si.product_id=p.id LEFT JOIN sales s ON s.id=si.sale_id
        WHERE p.company_id=$1 AND p.active=true GROUP BY p.id ORDER BY coalesce(sum(si.subtotal),0) DESC LIMIT 60`,
      [companyId],
    ),
    query<{
      product_name: string;
      supplier_name: string;
      price: string;
      minimum_quantity: string;
      quoted_at: Date;
    }>(
      `SELECT p.name product_name,s.name supplier_name,sp.price,sp.minimum_quantity,sp.quoted_at
         FROM supplier_prices sp JOIN products p ON p.id=sp.product_id JOIN suppliers s ON s.id=sp.supplier_id
        WHERE sp.company_id=$1 AND p.active=true AND s.active=true ORDER BY p.name,sp.price LIMIT 100`,
      [companyId],
    ),
  ]);
  const totals = summary.rows[0];
  return {
    empresa: {
      nome: company.rows[0].name,
      segmento: company.rows[0].business_type,
      metaMensal: Number(company.rows[0].monthly_revenue_goal),
      ticketDesejado: Number(company.rows[0].expected_average_ticket),
    },
    ultimos30Dias: {
      vendas: Number(totals.sales),
      faturamento: Number(totals.revenue),
      custo: Number(totals.cost),
      lucro: Number(totals.profit),
      ticketMedio: Number(totals.ticket),
    },
    produtos: products.rows.map((p) => ({
      nome: p.name,
      custo: Number(p.cost_price),
      preco: Number(p.sale_price),
      estoque: Number(p.stock),
      estoqueMinimo: Number(p.minimum_stock),
      quantidadeVendida30d: Number(p.sold),
      faturamento30d: Number(p.revenue),
      lucro30d: Number(p.profit),
    })),
    cotacoes: quotes.rows.map((q) => ({
      produto: q.product_name,
      fornecedor: q.supplier_name,
      preco: Number(q.price),
      quantidadeMinima: Number(q.minimum_quantity),
      data: q.quoted_at.toISOString().slice(0, 10),
    })),
  };
}

export const askProfitAi = createServerFn({ method: "POST" })
  .validator(z.object({ question: z.string().trim().min(3).max(1200) }))
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    if (user.plan === "essencial")
      throw new Error("O Consultor de IA está disponível nos planos Profissional e Premium");
    const usage = await query<{ count: string }>(
      "SELECT count(*)::text count FROM ai_usage WHERE company_id=$1 AND created_at >= date_trunc('month',now())",
      [user.companyId],
    );
    const used = Number(usage.rows[0].count);
    const limit = planLimits[user.plan].aiRequestsPerMonth;
    if (used >= limit) throw new Error("Limite mensal de perguntas à IA atingido neste plano");
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("A IA ainda não foi ativada pelo administrador do sistema");
    const context = await loadAiContext(user.companyId);
    const model = process.env.OPENAI_MODEL || "gpt-5.6";
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 1000,
        instructions:
          "Você é um consultor de lucro para pequenos comércios brasileiros. Responda em português simples e direto. Use somente os dados fornecidos, cite os números relevantes e dê de 2 a 5 ações práticas. Diferencie fatos de estimativas. Não dê garantias financeiras, fiscais ou jurídicas. Se faltarem dados, diga exatamente o que precisa ser cadastrado.",
        input: `DADOS DA EMPRESA:\n${JSON.stringify(context)}\n\nPERGUNTA DO COMERCIANTE:\n${data.question}`,
      }),
    });
    const result = (await response.json()) as {
      output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      error?: { message?: string };
    };
    if (!response.ok)
      throw new Error(result.error?.message || "Não foi possível consultar a IA agora");
    const answer = (result.output || [])
      .flatMap((item) => item.content || [])
      .filter((item) => item.type === "output_text")
      .map((item) => item.text || "")
      .join("\n")
      .trim();
    if (!answer) throw new Error("A IA não retornou uma resposta. Tente novamente.");
    await query(
      `INSERT INTO ai_usage (company_id,user_id,model,prompt_tokens,output_tokens,question,answer)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        user.companyId,
        user.id,
        model,
        result.usage?.input_tokens || 0,
        result.usage?.output_tokens || 0,
        data.question,
        answer,
      ],
    );
    return { answer, remaining: Math.max(0, limit - used - 1) };
  });

export const listAiHistory = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  if (user.plan === "essencial") return [];
  const result = await query<{ id: string; question: string; answer: string; created_at: Date }>(
    "SELECT id,question,answer,created_at FROM ai_usage WHERE company_id=$1 ORDER BY created_at DESC LIMIT 20",
    [user.companyId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    question: row.question,
    answer: row.answer,
    createdAt: row.created_at.toISOString(),
  }));
});
