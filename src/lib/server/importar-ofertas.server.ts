// A regra de subir tabela de preço para a vitrine de um fornecedor.
//
// Mora aqui, e não dentro da função de servidor, porque agora há duas portas
// para a mesma coisa: o próprio fornecedor importando na conta dele, e a
// equipe importando por ele no back office durante o cadastro assistido.
//
// Duas portas não podem virar duas regras. Se a importação da equipe tivesse
// cópia própria desta lógica, um dia uma delas passaria a respeitar o limite
// do plano e a outra não, ou uma atualizaria preço e a outra duplicaria a
// oferta — e a diferença só apareceria como preço errado na comparação, que é
// o pior lugar para descobrir.
import { z } from "zod";

// Com a extensão .ts: o teste roda este arquivo direto no Node, que não
// adivinha extensão de import relativo.
import { catalogSearchKey } from "../catalog.ts";
import { planLimits, type PlanName } from "../plans.ts";
import type { DatabaseClient } from "./db.server";

export const MAX_LINHAS_DA_IMPORTACAO = 2000;

export type ResultadoDaImportacao = {
  criados: number;
  atualizados: number;
  ignorados: Array<{ linha: number; motivo: string }>;
};

export const linhaDeOfertaSchema = z.object({
  linha: z.number().int().min(1),
  name: z.string().trim().min(1).max(180),
  brand: z.string().trim().max(80).optional(),
  baseUnit: z.enum(["kg", "l", "un"]),
  packSize: z.number().positive().max(1000000),
  price: z.number().min(0).max(9999999).nullable().optional(),
  minimumQuantity: z.number().positive().max(1000000).optional(),
});

export type LinhaDeOferta = z.infer<typeof linhaDeOfertaSchema>;

/**
 * Sobe as linhas para a vitrine de um fornecedor, dentro de uma transação já
 * aberta. Não publica nada: vitrine no ar é decisão separada.
 *
 * Recebe o cliente de fora de propósito — quem chama é dono da transação, e as
 * duas portas têm coisas diferentes para fazer dentro dela: a da equipe ainda
 * carimba a data na empresa, e o carimbo só vale se a importação der certo.
 */
export async function aplicarOfertasDoFornecedor(
  client: DatabaseClient,
  companyId: string,
  linhas: LinhaDeOferta[],
): Promise<ResultadoDaImportacao> {
  const company = await client.query<{ plan: PlanName }>(
    "SELECT plan FROM companies WHERE id=$1 FOR UPDATE",
    [companyId],
  );
  if (!company.rows[0]) throw new Error("Empresa não encontrada");
  const limite = planLimits[company.rows[0].plan].products;
  const atual = await client.query<{ total: string }>(
    "SELECT count(*)::text total FROM supplier_offerings WHERE company_id=$1 AND active=true",
    [companyId],
  );
  let ativos = Number(atual.rows[0].total);

  const resultado: ResultadoDaImportacao = { criados: 0, atualizados: 0, ignorados: [] };

  for (const row of linhas) {
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

    // A mesma combinação de item e embalagem já existente vira atualização de
    // preço, não uma oferta duplicada.
    const jaOferecido = await client.query<{ id: string }>(
      `SELECT id FROM supplier_offerings
        WHERE company_id=$1 AND catalog_item_id=$2 AND pack_size=$3`,
      [companyId, catalogItemId, row.packSize],
    );

    if (jaOferecido.rows[0]) {
      await client.query(
        `UPDATE supplier_offerings
            SET price=$3,minimum_quantity=coalesce($4,minimum_quantity),
                active=true,updated_at=now()
          WHERE id=$1 AND company_id=$2`,
        [jaOferecido.rows[0].id, companyId, row.price ?? null, row.minimumQuantity ?? null],
      );
      resultado.atualizados += 1;
      continue;
    }

    if (ativos >= limite) {
      resultado.ignorados.push({ linha: row.linha, motivo: "Limite de itens do plano atingido" });
      continue;
    }

    await client.query(
      `INSERT INTO supplier_offerings
         (company_id,catalog_item_id,pack_size,price,minimum_quantity)
       VALUES ($1,$2,$3,$4,$5)`,
      [companyId, catalogItemId, row.packSize, row.price ?? null, row.minimumQuantity ?? 1],
    );
    ativos += 1;
    resultado.criados += 1;
  }

  return resultado;
}
