import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { catalogSearchKey } from "../catalog";
import { planLimits, type PlanName } from "../plans";
import { requireActiveSession } from "../server/auth.server";
import { transaction } from "../server/db.server";

const MAX_ROWS = 2000;

export type ImportResult = {
  criados: number;
  atualizados: number;
  ignorados: Array<{ linha: number; motivo: string }>;
};

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

const offeringRowSchema = z.object({
  linha: z.number().int().min(1),
  name: z.string().trim().min(1).max(180),
  brand: z.string().trim().max(80).optional(),
  baseUnit: z.enum(["kg", "l", "un"]),
  packSize: z.number().positive().max(1000000),
  price: z.number().min(0).max(9999999).nullable().optional(),
  minimumQuantity: z.number().positive().max(1000000).optional(),
});

export const importOfferings = createServerFn({ method: "POST" })
  .validator(z.object({ rows: z.array(offeringRowSchema).min(1).max(MAX_ROWS) }))
  .handler(async ({ data }): Promise<ImportResult> => {
    const user = await requireActiveSession();
    if (user.accountType !== "fornecedor")
      throw new Error("A importação de catálogo é da conta de fornecedor");

    return transaction(async (client) => {
      const company = await client.query<{ plan: PlanName }>(
        "SELECT plan FROM companies WHERE id=$1 FOR UPDATE",
        [user.companyId],
      );
      const limite = planLimits[company.rows[0].plan].products;
      const atual = await client.query<{ total: string }>(
        "SELECT count(*)::text total FROM supplier_offerings WHERE company_id=$1 AND active=true",
        [user.companyId],
      );
      let ativos = Number(atual.rows[0].total);

      const resultado: ImportResult = { criados: 0, atualizados: 0, ignorados: [] };

      for (const row of data.rows) {
        const searchKey = catalogSearchKey(row.name, row.brand);
        if (!searchKey) {
          resultado.ignorados.push({ linha: row.linha, motivo: "Nome de produto inválido" });
          continue;
        }

        const existenteItem = await client.query<{ id: string }>(
          "SELECT id FROM catalog_items WHERE search_key=$1 AND base_unit=$2",
          [searchKey, row.baseUnit],
        );
        const catalogItemId =
          existenteItem.rows[0]?.id ||
          (
            await client.query<{ id: string }>(
              `INSERT INTO catalog_items (name,brand,base_unit,search_key)
               VALUES ($1,$2,$3,$4) RETURNING id`,
              [row.name, row.brand || null, row.baseUnit, searchKey],
            )
          ).rows[0].id;

        // A mesma combinação de item e embalagem já existente vira
        // atualização de preço, não uma oferta duplicada.
        const jaOferecido = await client.query<{ id: string }>(
          `SELECT id FROM supplier_offerings
            WHERE company_id=$1 AND catalog_item_id=$2 AND pack_size=$3`,
          [user.companyId, catalogItemId, row.packSize],
        );

        if (jaOferecido.rows[0]) {
          await client.query(
            `UPDATE supplier_offerings
                SET price=$3,minimum_quantity=coalesce($4,minimum_quantity),
                    active=true,updated_at=now()
              WHERE id=$1 AND company_id=$2`,
            [
              jaOferecido.rows[0].id,
              user.companyId,
              row.price ?? null,
              row.minimumQuantity ?? null,
            ],
          );
          resultado.atualizados += 1;
          continue;
        }

        if (ativos >= limite) {
          resultado.ignorados.push({
            linha: row.linha,
            motivo: "Limite de itens do plano atingido",
          });
          continue;
        }

        await client.query(
          `INSERT INTO supplier_offerings
             (company_id,catalog_item_id,pack_size,price,minimum_quantity)
           VALUES ($1,$2,$3,$4,$5)`,
          [
            user.companyId,
            catalogItemId,
            row.packSize,
            row.price ?? null,
            row.minimumQuantity ?? 1,
          ],
        );
        ativos += 1;
        resultado.criados += 1;
      }

      return resultado;
    });
  });
