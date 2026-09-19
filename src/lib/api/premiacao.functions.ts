import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { DEGRAUS, degrausNovos, estadoDaPremiacao, type Lado } from "../premiacao";
import { requireActiveSession, requireAdmin } from "../server/auth.server";
import { query } from "../server/db.server";

type LinhaConquista = {
  degrau: number;
  conquistada_em: Date;
  entrega_status: "sem_premio" | "pendente" | "endereco_enviado" | "enviado" | "entregue";
  destinatario: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
};

// O que conta: pedidos ACEITOS ou CONCLUÍDOS. Enviado, recusado e cancelado não
// contam — a premiação é por resultado, não por tentativa.
async function totalDaEmpresa(empresa: string, lado: Lado) {
  const coluna = lado === "comerciante" ? "merchant_company_id" : "supplier_company_id";
  const r = await query<{ total: string }>(
    `SELECT COALESCE(sum(total), 0)::text total FROM purchase_orders
      WHERE ${coluna} = $1 AND status IN ('aceito', 'concluido')`,
    [empresa],
  );
  return Number(r.rows[0].total);
}

const listar = (empresa: string) =>
  query<LinhaConquista>(
    `SELECT degrau, conquistada_em, entrega_status, destinatario, telefone, cep,
            logradouro, numero, complemento, bairro, cidade, uf
       FROM conquistas WHERE company_id = $1 ORDER BY degrau`,
    [empresa],
  );

// Abrir a tela calcula o total, grava os degraus novos (uma vez cada) e devolve
// tudo. Nada depende de a pessoa "entrar no app": o total vem dos pedidos.
export const getPremiacao = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  const lado: Lado = user.accountType === "fornecedor" ? "fornecedor" : "comerciante";
  const total = await totalDaEmpresa(user.companyId, lado);

  let registradas = await listar(user.companyId);
  const novos = degrausNovos(
    total,
    registradas.rows.map((c) => c.degrau),
  );
  for (const d of novos) {
    await query(
      `INSERT INTO conquistas (company_id, degrau, total_na_data, entrega_status)
       VALUES ($1, $2, $3, $4) ON CONFLICT (company_id, degrau) DO NOTHING`,
      [user.companyId, d.valor, total, d.premioFisico ? "pendente" : "sem_premio"],
    );
  }
  if (novos.length) registradas = await listar(user.companyId);

  return {
    lado,
    estado: estadoDaPremiacao(total),
    conquistas: registradas.rows.map((c) => ({
      degrau: c.degrau,
      conquistadaEm: c.conquistada_em.toISOString(),
      entrega: c.entrega_status,
      endereco:
        c.entrega_status === "pendente" || c.entrega_status === "sem_premio"
          ? null
          : {
              destinatario: c.destinatario ?? "",
              telefone: c.telefone ?? "",
              cep: c.cep ?? "",
              logradouro: c.logradouro ?? "",
              numero: c.numero ?? "",
              complemento: c.complemento ?? "",
              bairro: c.bairro ?? "",
              cidade: c.cidade ?? "",
              uf: c.uf ?? "",
            },
    })),
    // Degraus conquistados nesta abertura: a tela usa para comemorar uma vez.
    novos: novos.map((d) => d.valor),
  };
});

const enderecoSchema = z.object({
  degrau: z.number().int(),
  destinatario: z.string().trim().min(3).max(120),
  telefone: z.string().trim().min(8).max(30),
  cep: z
    .string()
    .trim()
    .regex(/^\d{5}-?\d{3}$/, "CEP inválido"),
  logradouro: z.string().trim().min(2).max(160),
  numero: z.string().trim().min(1).max(20),
  complemento: z.string().trim().max(80).optional(),
  bairro: z.string().trim().min(2).max(80),
  cidade: z.string().trim().min(2).max(80),
  uf: z
    .string()
    .trim()
    .length(2)
    .transform((s) => s.toUpperCase()),
});

// Só dono ou administrador informa o endereço, e só de um degrau que tem prêmio
// físico, já conquistado, e que ainda não saiu para entrega.
export const salvarEnderecoDeEntrega = createServerFn({ method: "POST" })
  .validator(enderecoSchema)
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    requireAdmin(user);
    const degrau = DEGRAUS.find((d) => d.valor === data.degrau);
    if (!degrau?.premioFisico) throw new Error("Este degrau não tem entrega.");
    const r = await query(
      `UPDATE conquistas SET
         destinatario=$3, telefone=$4, cep=$5, logradouro=$6, numero=$7,
         complemento=$8, bairro=$9, cidade=$10, uf=$11,
         entrega_status='endereco_enviado', endereco_enviado_em=now()
       WHERE company_id=$1 AND degrau=$2 AND entrega_status IN ('pendente', 'endereco_enviado')`,
      [
        user.companyId,
        data.degrau,
        data.destinatario,
        data.telefone,
        data.cep,
        data.logradouro,
        data.numero,
        data.complemento ?? "",
        data.bairro,
        data.cidade,
        data.uf,
      ],
    );
    if (!r.rowCount) throw new Error("Não dá mais para mudar o endereço deste prêmio.");
    return { ok: true };
  });
