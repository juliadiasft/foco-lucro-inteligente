import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { brl, num } from "../format";
import { requireActiveSession } from "../server/auth.server";
import { query } from "../server/db.server";

const LOW_MARGIN_PERCENT = 20;
const RUNOUT_DAYS = 7;

export type AttentionLevel = "danger" | "warning" | "info";

export type AttentionItem = {
  id: string;
  level: AttentionLevel;
  title: string;
  description: string;
  action: "produtos" | "fornecedores" | "integracoes";
};

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  const [company, month, products, quotes, freshness] = await Promise.all([
    query<{ name: string; monthly_revenue_goal: string }>(
      "SELECT name,monthly_revenue_goal FROM companies WHERE id=$1",
      [user.companyId],
    ),
    query<{ count: string; revenue: string; profit: string }>(
      `SELECT count(*)::text AS count,coalesce(sum(total),0)::text AS revenue,
              coalesce(sum(profit),0)::text AS profit
         FROM sales WHERE company_id=$1 AND sold_at >= date_trunc('month',now())`,
      [user.companyId],
    ),
    query<{
      id: string;
      name: string;
      cost_price: string;
      sale_price: string;
      stock: string;
      minimum_stock: string;
      unit: string;
      sold30: string;
    }>(
      `SELECT p.id,p.name,p.cost_price,p.sale_price,p.stock,p.minimum_stock,p.unit,
              coalesce(sum(si.quantity) FILTER (WHERE s.sold_at >= now()-interval '30 days'),0)::text sold30
         FROM products p
         LEFT JOIN sale_items si ON si.product_id=p.id
         LEFT JOIN sales s ON s.id=si.sale_id AND s.company_id=p.company_id
        WHERE p.company_id=$1 AND p.active=true
        GROUP BY p.id
        ORDER BY p.name`,
      [user.companyId],
    ),
    // Melhor e segunda melhor cotação por produto: é a comparação que gera a
    // recomendação de troca de fornecedor.
    query<{
      product_id: string;
      product_name: string;
      cost_price: string;
      supplier_name: string;
      price: string;
      rank: string;
    }>(
      `SELECT product_id,product_name,cost_price,supplier_name,price,rank FROM (
         SELECT p.id product_id,p.name product_name,p.cost_price,s.name supplier_name,sp.price,
                row_number() OVER (PARTITION BY p.id ORDER BY sp.price ASC,s.name ASC)::text rank
           FROM supplier_prices sp
           JOIN products p ON p.id=sp.product_id AND p.company_id=sp.company_id AND p.active=true
           JOIN suppliers s ON s.id=sp.supplier_id AND s.company_id=sp.company_id AND s.active=true
          WHERE sp.company_id=$1
       ) ranked WHERE rank IN ('1','2')`,
      [user.companyId],
    ),
    query<{ last_updated: Date | null }>(
      `SELECT greatest(
                (SELECT max(updated_at) FROM products WHERE company_id=$1),
                (SELECT max(created_at) FROM sales WHERE company_id=$1),
                (SELECT max(updated_at) FROM supplier_prices WHERE company_id=$1)
              ) AS last_updated`,
      [user.companyId],
    ),
  ]);

  const mapped = products.rows.map((row) => {
    const cost = Number(row.cost_price);
    const price = Number(row.sale_price);
    const stock = Number(row.stock);
    const sold30 = Number(row.sold30);
    const dailySales = sold30 / 30;
    return {
      id: row.id,
      name: row.name,
      cost,
      price,
      stock,
      minimumStock: Number(row.minimum_stock),
      unit: row.unit,
      sold30,
      marginPercent: price > 0 ? ((price - cost) / price) * 100 : null,
      daysLeft: dailySales > 0 ? stock / dailySales : null,
    };
  });

  const lowMargin = mapped.filter(
    (p) => p.marginPercent !== null && p.marginPercent < LOW_MARGIN_PERCENT && p.price > 0,
  );
  const negativeMargin = mapped.filter((p) => p.price > 0 && p.price <= p.cost);
  const lowStock = mapped.filter((p) => p.stock <= (p.minimumStock || 5));
  const runningOut = mapped.filter((p) => p.daysLeft !== null && p.daysLeft <= RUNOUT_DAYS);

  const best = new Map<string, { supplier: string; price: number; name: string; cost: number }>();
  const second = new Map<string, { supplier: string; price: number }>();
  for (const row of quotes.rows) {
    if (row.rank === "1")
      best.set(row.product_id, {
        supplier: row.supplier_name,
        price: Number(row.price),
        name: row.product_name,
        cost: Number(row.cost_price),
      });
    else second.set(row.product_id, { supplier: row.supplier_name, price: Number(row.price) });
  }

  const soldByProduct = new Map(mapped.map((p) => [p.id, p.sold30]));
  // Economia estimada com base no volume realmente vendido nos últimos 30
  // dias. Sem vendas registradas não há volume para projetar, e nesse caso
  // preferimos não exibir um número inventado.
  let monthlySavings = 0;
  let savingsHasVolume = false;
  for (const [productId, bestQuote] of best) {
    if (bestQuote.price >= bestQuote.cost) continue;
    const volume = soldByProduct.get(productId) || 0;
    if (volume > 0) savingsHasVolume = true;
    monthlySavings += (bestQuote.cost - bestQuote.price) * volume;
  }

  let bestOpportunity: {
    productName: string;
    bestSupplier: string;
    alternativeSupplier: string;
    unitSavings: number;
    savingsPercent: number;
  } | null = null;
  for (const [productId, bestQuote] of best) {
    const alternative = second.get(productId);
    if (!alternative) continue;
    const unitSavings = alternative.price - bestQuote.price;
    if (unitSavings <= 0) continue;
    if (bestOpportunity && unitSavings <= bestOpportunity.unitSavings) continue;
    bestOpportunity = {
      productName: bestQuote.name,
      bestSupplier: bestQuote.supplier,
      alternativeSupplier: alternative.supplier,
      unitSavings,
      savingsPercent: (unitSavings / alternative.price) * 100,
    };
  }

  const attention: AttentionItem[] = [];
  if (!mapped.length)
    attention.push({
      id: "sem-dados",
      level: "info",
      title: "Seus dados ainda não foram sincronizados",
      description:
        "Conecte o sistema que você já usa ou cadastre alguns produtos para a Central começar a analisar.",
      action: "integracoes",
    });
  for (const product of negativeMargin.slice(0, 3))
    attention.push({
      id: `preco-${product.id}`,
      level: "danger",
      title: `Revise o preço de venda de ${product.name}`,
      description:
        product.price < product.cost
          ? `Você vende por ${brl(product.price)} e paga ${brl(product.cost)}. Cada venda dá prejuízo.`
          : `O preço de venda é igual ao custo (${brl(product.cost)}). Essa venda não deixa lucro.`,
      action: "produtos",
    });
  for (const product of lowMargin.filter((p) => p.price > p.cost).slice(0, 3))
    attention.push({
      id: `margem-${product.id}`,
      level: "warning",
      title: `${product.name} está com margem muito baixa`,
      description: `Sobra ${num(product.marginPercent ?? 0, 1)}% por venda. Revise o preço ou negocie o custo.`,
      action: "produtos",
    });
  for (const product of runningOut.slice(0, 3))
    attention.push({
      id: `acabando-${product.id}`,
      level: "danger",
      title: `${product.name} pode acabar nos próximos dias`,
      description: `Restam ${num(product.stock, 0)} ${product.unit} e a saída recente aponta cerca de ${num(product.daysLeft ?? 0, 0)} dia(s).`,
      action: "produtos",
    });
  if (bestOpportunity)
    attention.push({
      id: "fornecedor",
      level: "info",
      title: `${bestOpportunity.bestSupplier} está mais barato que ${bestOpportunity.alternativeSupplier}`,
      description: `Em ${bestOpportunity.productName} a diferença é de ${brl(bestOpportunity.unitSavings)} por unidade (${num(bestOpportunity.savingsPercent, 1)}%).`,
      action: "fornecedores",
    });

  const revenue = Number(month.rows[0].revenue);
  const profit = Number(month.rows[0].profit);
  const goal = Number(company.rows[0].monthly_revenue_goal);
  const lastUpdated = freshness.rows[0].last_updated;

  return {
    companyName: company.rows[0].name,
    // Nenhum conector está disponível ainda, então toda informação que existe
    // hoje entrou pela mão do comerciante. Quando houver integração real, a
    // origem passa a ser lida da conexão.
    dataSource: mapped.length ? ("manual" as const) : ("vazio" as const),
    lastUpdatedAt: lastUpdated ? lastUpdated.toISOString() : null,
    metrics: {
      analyzedProducts: mapped.length,
      lowMarginCount: lowMargin.length,
      lowStockCount: lowStock.length,
      monthlySavings: savingsHasVolume ? monthlySavings : null,
    },
    bestOpportunity,
    attention,
    month: {
      count: Number(month.rows[0].count),
      revenue,
      profit,
      margin: revenue > 0 ? (profit / revenue) * 100 : 0,
    },
    goal,
    goalProgress: goal > 0 ? Math.min(100, (revenue / goal) * 100) : 0,
    lowStock: lowStock.slice(0, 20).map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stock,
      minimumStock: p.minimumStock,
      unit: p.unit,
    })),
  };
});

export const getReport = createServerFn({ method: "GET" })
  .validator(z.object({ from: z.string().datetime(), to: z.string().datetime() }))
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    const [summary, daily, topProducts, payments] = await Promise.all([
      query<{ sales: string; revenue: string; cost: string; profit: string; ticket: string }>(
        `SELECT count(*)::text sales,coalesce(sum(total),0)::text revenue,coalesce(sum(total_cost),0)::text cost,
                coalesce(sum(profit),0)::text profit,coalesce(avg(total),0)::text ticket
           FROM sales WHERE company_id=$1 AND sold_at >= $2 AND sold_at < $3`,
        [user.companyId, data.from, data.to],
      ),
      query<{ day: string; sales: string; revenue: string; profit: string }>(
        `SELECT to_char(date_trunc('day',sold_at),'YYYY-MM-DD') day,count(*)::text sales,sum(total)::text revenue,sum(profit)::text profit
           FROM sales WHERE company_id=$1 AND sold_at >= $2 AND sold_at < $3 GROUP BY 1 ORDER BY 1`,
        [user.companyId, data.from, data.to],
      ),
      query<{ product_name: string; quantity: string; revenue: string; profit: string }>(
        `SELECT p.name product_name,sum(si.quantity)::text quantity,sum(si.subtotal)::text revenue,
                sum((si.unit_price-si.unit_cost)*si.quantity)::text profit
           FROM sale_items si JOIN sales s ON s.id=si.sale_id JOIN products p ON p.id=si.product_id
          WHERE s.company_id=$1 AND s.sold_at >= $2 AND s.sold_at < $3 GROUP BY p.id,p.name ORDER BY sum(si.subtotal) DESC LIMIT 20`,
        [user.companyId, data.from, data.to],
      ),
      query<{ payment_method: string; sales: string; revenue: string }>(
        `SELECT payment_method,count(*)::text sales,sum(total)::text revenue FROM sales
          WHERE company_id=$1 AND sold_at >= $2 AND sold_at < $3 GROUP BY payment_method ORDER BY sum(total) DESC`,
        [user.companyId, data.from, data.to],
      ),
    ]);
    const row = summary.rows[0];
    const revenue = Number(row.revenue);
    const profit = Number(row.profit);
    return {
      summary: {
        sales: Number(row.sales),
        revenue,
        cost: Number(row.cost),
        profit,
        ticket: Number(row.ticket),
        margin: revenue > 0 ? (profit / revenue) * 100 : 0,
      },
      daily: daily.rows.map((r) => ({
        day: r.day,
        sales: Number(r.sales),
        revenue: Number(r.revenue),
        profit: Number(r.profit),
      })),
      topProducts: topProducts.rows.map((r) => ({
        productName: r.product_name,
        quantity: Number(r.quantity),
        revenue: Number(r.revenue),
        profit: Number(r.profit),
      })),
      payments: payments.rows.map((r) => ({
        paymentMethod: r.payment_method,
        sales: Number(r.sales),
        revenue: Number(r.revenue),
      })),
    };
  });
