import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { proximaEtapaDaEntrega, type EntregaStatus } from "../premiacao";
import { query } from "../server/db.server";
import { logStaffAction, requireStaff } from "../server/staff.server";

// A fila de entrega dos mascotinhos. Sem esta tela, a conquista existiria no
// banco e o endereço também, mas ninguém da equipe saberia para onde mandar.
export const listEntregasDePremio = createServerFn({ method: "GET" }).handler(async () => {
  await requireStaff(["admin", "suporte"]);
  const r = await query<{
    company_id: string;
    empresa: string;
    tipo: string;
    degrau: number;
    conquistada_em: Date;
    total_na_data: string;
    entrega_status: EntregaStatus;
    destinatario: string | null;
    telefone: string | null;
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    endereco_enviado_em: Date | null;
  }>(
    `SELECT c.company_id, co.name empresa, co.account_type tipo, c.degrau, c.conquistada_em,
            c.total_na_data::text, c.entrega_status, c.destinatario, c.telefone, c.cep,
            c.logradouro, c.numero, c.complemento, c.bairro, c.cidade, c.uf,
            c.endereco_enviado_em
       FROM conquistas c JOIN companies co ON co.id = c.company_id
      WHERE c.entrega_status <> 'sem_premio'
      ORDER BY
        CASE c.entrega_status
          WHEN 'endereco_enviado' THEN 0 WHEN 'pendente' THEN 1
          WHEN 'enviado' THEN 2 ELSE 3 END,
        c.conquistada_em`,
  );
  return r.rows.map((c) => ({
    empresaId: c.company_id,
    empresa: c.empresa,
    tipo: c.tipo,
    degrau: c.degrau,
    conquistadaEm: c.conquistada_em.toISOString(),
    totalNaData: Number(c.total_na_data),
    status: c.entrega_status,
    proxima: proximaEtapaDaEntrega(c.entrega_status),
    endereco:
      c.entrega_status === "pendente"
        ? null
        : {
            destinatario: c.destinatario ?? "",
            telefone: c.telefone ?? "",
            cep: c.cep ?? "",
            linha1: [c.logradouro, c.numero, c.complemento].filter(Boolean).join(", "),
            bairro: c.bairro ?? "",
            cidade: c.cidade ?? "",
            uf: c.uf ?? "",
          },
  }));
});

export const marcarEntregaDePremio = createServerFn({ method: "POST" })
  .validator(
    z.object({
      empresaId: z.string().uuid(),
      degrau: z.number().int().positive(),
      para: z.enum(["enviado", "entregue"]),
    }),
  )
  .handler(async ({ data }) => {
    const staff = await requireStaff(["admin", "suporte"]);
    const atual = await query<{ entrega_status: EntregaStatus }>(
      "SELECT entrega_status FROM conquistas WHERE company_id=$1 AND degrau=$2",
      [data.empresaId, data.degrau],
    );
    const linha = atual.rows[0];
    if (!linha) throw new Error("Conquista não encontrada.");
    // A regra é a mesma que a tela usa para mostrar o botão: só anda para
    // frente, uma etapa por vez.
    if (proximaEtapaDaEntrega(linha.entrega_status) !== data.para)
      throw new Error("Esta entrega não está nessa etapa.");
    await query(
      "UPDATE conquistas SET entrega_status=$3 WHERE company_id=$1 AND degrau=$2 AND entrega_status=$4",
      [data.empresaId, data.degrau, data.para, linha.entrega_status],
    );
    await logStaffAction(staff, "premio_entrega", data.empresaId, {
      degrau: data.degrau,
      de: linha.entrega_status,
      para: data.para,
    });
    return { ok: true };
  });
