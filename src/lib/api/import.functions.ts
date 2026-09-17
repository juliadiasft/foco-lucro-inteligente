import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { catalogSearchKey } from "../catalog";
import { planLimits, type PlanName } from "../plans";
import { requireActiveSession } from "../server/auth.server";
import { transaction } from "../server/db.server";
import {
  MAX_LINHAS_DA_IMPORTACAO,
  aplicarOfertasDoFornecedor,
  linhaDeOfertaSchema,
  type ResultadoDaImportacao,
} from "../server/importar-ofertas.server";

const MAX_ROWS = MAX_LINHAS_DA_IMPORTACAO;

// O nome que as telas já usam. A regra em si mora em
// server/importar-ofertas.server.ts, porque a equipe também importa por lá.
export type ImportResult = ResultadoDaImportacao;

const productRowSchema = z.object({
  linha: z.number().int().min(1),
  name: z.string().trim().min(1).max(180),
  sku: z.string().trim().max(80).optional(),
  costPrice: z.number().min(0).max(9999999),
  salePrice: z.number().min(0).max(9999999),
  stock: z.number().min(0).max(9999999).optional(),
  minimumStock: z.number().min(0).max(9999999).optional(),
  unit: z.string().trim().max(20).optional(),
});

export const importProducts = createServerFn({ method: "POST" })
  .validator(z.object({ rows: z.array(productRowSchema).min(1).max(MAX_ROWS) }))
  .handler(async ({ data }): Promise<ImportResult> => {
    const user = await requireActiveSession();
    if (user.accountType !== "comerciante")
      throw new Error("A importação de produtos é da conta de comerciante");

    return transaction(async (client) => {
      // A trava do plano vale para a planilha do mesmo jeito que vale para o
      // cadastro manual: importar não pode ser um caminho para furar o limite.
      const company = await client.query<{ plan: PlanName }>(
        "SELECT plan FROM companies WHERE id=$1 FOR UPDATE",
        [user.companyId],
      );
      const limite = planLimits[company.rows[0].plan].products;
      const atual = await client.query<{ total: string }>(
        "SELECT count(*)::text total FROM products WHERE company_id=$1 AND active=true",
        [user.companyId],
      );
      let ativos = Number(atual.rows[0].total);

      const resultado: ImportResult = { criados: 0, atualizados: 0, ignorados: [] };

      for (const row of data.rows) {
        // Atualiza pelo SKU quando ele existe: reimportar a mesma planilha
        // corrige os preços em vez de duplicar o catálogo inteiro.
        const existente = row.sku
          ? await client.query<{ id: string }>(
              "SELECT id FROM products WHERE company_id=$1 AND sku=$2 AND active=true LIMIT 1",
              [user.companyId, row.sku],
            )
          : { rows: [] as { id: string }[] };

        if (existente.rows[0]) {
          await client.query(
            `UPDATE products SET name=$3,description=coalesce(description,null),cost_price=$4,
                    sale_price=$5,minimum_stock=coalesce($6,minimum_stock),
                    unit=coalesce($7,unit),updated_at=now()
              WHERE id=$1 AND company_id=$2`,
            [
              existente.rows[0].id,
              user.companyId,
              row.name,
              row.costPrice,
              row.salePrice,
              row.minimumStock ?? null,
              row.unit || null,
            ],
          );
          resultado.atualizados += 1;
          continue;
        }

        if (ativos >= limite) {
          resultado.ignorados.push({
            linha: row.linha,
            motivo: "Limite de produtos do plano atingido",
          });
          continue;
        }

        try {
          await client.query(
            `INSERT INTO products (company_id,name,sku,cost_price,sale_price,stock,minimum_stock,unit)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              user.companyId,
              row.name,
              row.sku || null,
              row.costPrice,
              row.salePrice,
              row.stock ?? 0,
              row.minimumStock ?? 0,
              row.unit || "un",
            ],
          );
          ativos += 1;
          resultado.criados += 1;
        } catch (error) {
          if ((error as { code?: string }).code === "23505")
            resultado.ignorados.push({ linha: row.linha, motivo: "SKU repetido na planilha" });
          else throw error;
        }
      }

      return resultado;
    });
  });

export const importOfferings = createServerFn({ method: "POST" })
  .validator(z.object({ rows: z.array(linhaDeOfertaSchema).min(1).max(MAX_ROWS) }))
  .handler(async ({ data }): Promise<ImportResult> => {
    const user = await requireActiveSession();
    if (user.accountType !== "fornecedor")
      throw new Error("A importação de catálogo é da conta de fornecedor");

    return transaction((client) => aplicarOfertasDoFornecedor(client, user.companyId, data.rows));
  });
