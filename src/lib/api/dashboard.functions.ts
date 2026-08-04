import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireActiveSession } from "../server/auth.server";
import { query } from "../server/db.server";

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  const [company, today, month, products, comparison] = await Promise.all([
    query<{ name: string; monthly_revenue_goal: string }>(
      "SELECT name,monthly_revenue_goal FROM companies WHERE id=$1",
      [user.companyId],
    ),
    query<{ count: string; revenue: string; profit: string }>(
      "SELECT count(*)::text AS count,coalesce(sum(total),0)::text AS revenue,coalesce(sum(profit),0)::text AS profit FROM sales WHERE company_id=$1 AND sold_at >= date_trunc('day',now())",
      [user.companyId],
    ),
    query<{ count: string; revenue: string; profit: string; ticket: string }>(
      "SELECT count(*)::text AS count,coalesce(sum(total),0)::text AS revenue,coalesce(sum(profit),0)::text AS profit,coalesce(avg(total),0)::text AS ticket FROM sales WHERE company_id=$1 AND sold_at >= date_trunc('month',now())",
      [user.companyId],
    ),
    query<{ id: string; name: string; stock: string; minimum_stock: string; unit: string }>(
      "SELECT id,name,stock,minimum_stock,unit FROM products WHERE company_id=$1 AND active=true ORDER BY stock ASC",
      [user.companyId],
    ),
    query<{ count: string }>(
      "SELECT count(DISTINCT product_id)::text AS count FROM supplier_prices WHERE company_id=$1",
      [user.companyId],
    ),
  ]);
  const productRows = products.rows;
  const lowStock = productRows.filter((p) => Number(p.stock) <= (Number(p.minimum_stock) || 5));
  const revenue = Number(month.rows[0].revenue);
  const profit = Number(month.rows[0].profit);
  const goal = Number(company.rows[0].monthly_revenue_goal);
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  let healthScore = 35;
  if (month.rows[0].count !== "0") healthScore += 15;
  if (goal > 0) healthScore += Math.min(20, (revenue / goal) * 20);
  if (margin >= 20) healthScore += 15;
  else if (margin > 0) healthScore += Math.min(15, (margin / 20) * 15);
  if (productRows.length > 0)
    healthScore += Math.max(0, 10 - (lowStock.length / productRows.length) * 10);
  if (Number(comparison.rows[0].count) > 0) healthScore += 5;
  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));
  return {
    companyName: company.rows[0].name,
    today: {
      count: Number(today.rows[0].count),
      revenue: Number(today.rows[0].revenue),
      profit: Number(today.rows[0].profit),
    },
    month: {
      count: Number(month.rows[0].count),
      revenue,
      profit,
      ticket: Number(month.rows[0].ticket),
      margin,
    },
    goal,
    goalProgress: goal > 0 ? Math.min(100, (revenue / goal) * 100) : 0,
    lowStock: lowStock.slice(0, 20).map((p) => ({
      id: p.id,
      name: p.name,
      stock: Number(p.stock),
      minimumStock: Number(p.minimum_stock),
      unit: p.unit,
    })),
    healthScore,
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
