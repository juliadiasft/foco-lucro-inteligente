import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { logStaffAction, requireStaff } from "../server/staff.server";
import { query } from "../server/db.server";

// A prospecção, servida ao back office.
//
// Tudo aqui exige sessão de staff: é lista de terceiros que não são clientes
// da Central, e nenhum comerciante ou fornecedor logado pode chegar perto.

const LADOS = ["comerciante", "fornecedor"] as const;
const STATUS = [
  "a contatar",
  "contatado",
  "respondeu",
  "cadastrou",
  "vitrine no ar",
  "sem interesse",
] as const;

const filtros = z.object({
  lado: z.enum(LADOS).default("fornecedor"),
  nicho: z.string().trim().max(40).default("pet"),
  uf: z.string().trim().max(2).optional(),
  cidade: z.string().trim().max(80).optional(),
  status: z.enum(STATUS).optional(),
  // "decide" tira as filiais e deixa quem manda na compra.
  quemDecide: z.boolean().optional(),
  // Só quem dá para contatar agora.
  comWhatsapp: z.boolean().optional(),
  comEmail: z.boolean().optional(),
  soPrincipal: z.boolean().optional(),
  soAtivas: z.boolean().default(true),
  busca: z.string().trim().max(80).optional(),
  pagina: z.number().int().min(1).max(500).default(1),
});

const POR_PAGINA = 50;

/**
 * Monta o WHERE a partir dos filtros da tela.
 *
 * As condições são montadas em pedaços com parâmetros numerados, e nunca por
 * concatenação de texto: é lista grande e filtro vindo da tela, que é
 * exatamente onde injeção de SQL entra.
 */
function condicoesDosFiltros(data: z.infer<typeof filtros>) {
  const condicoes = ["p.lado = $1", "p.nicho = $2"];
  const valores: unknown[] = [data.lado, data.nicho];
  const add = (sql: string, valor: unknown) => {
    valores.push(valor);
    condicoes.push(sql.replace("?", `$${valores.length}`));
  };

  if (data.uf) add("p.uf = ?", data.uf.toUpperCase());
  if (data.cidade) add("p.cidade = ?", data.cidade);
  if (data.status) add("p.status = ?", data.status);
  if (data.soAtivas) condicoes.push("p.situacao = 'Ativa'");
  if (data.quemDecide) condicoes.push("p.matriz_ou_filial <> 'filial'");
  if (data.comWhatsapp) condicoes.push("p.whatsapp <> ''");
  if (data.comEmail) condicoes.push("p.email <> ''");
  if (data.soPrincipal) condicoes.push("p.confere = 'principal'");
  if (data.busca) {
    valores.push(`%${data.busca.toLowerCase()}%`);
    condicoes.push(
      `(lower(p.razao_social) LIKE $${valores.length} OR lower(p.nome_fantasia) LIKE $${valores.length} OR p.cnpj LIKE $${valores.length})`,
    );
  }

  return { onde: condicoes.join(" AND "), valores };
}

// Os campos que a tela mostra num cartão, em lista ou no quadro.
const CAMPOS_DO_CARTAO = `p.id,p.cnpj,p.razao_social,p.nome_fantasia,p.cidade,p.uf,p.telefone,
        p.whatsapp,p.email,p.fornece,p.confere,p.matriz_ou_filial,p.enderecos_da_empresa,
        p.contatos_iguais,p.status,p.quem_falou,p.compra_de_quem,p.observacoes,
        p.contatado_em, s.name AS responsavel_nome,
        (p.company_id IS NOT NULL) AS virou_cliente`;

type LinhaDoCartao = {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  cidade: string;
  uf: string;
  telefone: string;
  whatsapp: string;
  email: string;
  fornece: string;
  confere: string;
  matriz_ou_filial: string;
  enderecos_da_empresa: number;
  contatos_iguais: number;
  status: string;
  quem_falou: string;
  compra_de_quem: string;
  observacoes: string;
  contatado_em: Date | null;
  responsavel_nome: string | null;
  virou_cliente: boolean;
};

function cartao(r: LinhaDoCartao) {
  return {
    id: r.id,
    cnpj: r.cnpj,
    nome: r.razao_social || r.nome_fantasia,
    nomeFantasia: r.nome_fantasia,
    cidade: r.cidade,
    uf: r.uf,
    telefone: r.telefone,
    whatsapp: r.whatsapp,
    email: r.email,
    fornece: r.fornece,
    confere: r.confere,
    matrizOuFilial: r.matriz_ou_filial,
    enderecos: r.enderecos_da_empresa,
    contatosIguais: r.contatos_iguais,
    status: r.status,
    quemFalou: r.quem_falou,
    compraDeQuem: r.compra_de_quem,
    observacoes: r.observacoes,
    contatadoEm: r.contatado_em?.toISOString() ?? null,
    responsavel: r.responsavel_nome,
    virouCliente: r.virou_cliente,
  };
}

// A ordem em que a conversa tem mais chance de acontecer: quem tem WhatsApp
// primeiro, depois quem é atividade principal.
const ORDEM = `ORDER BY (p.whatsapp <> '') DESC,
                   (p.confere = 'principal') DESC,
                   p.nome_sugere_pet DESC,
                   p.razao_social`;

export const listProspects = createServerFn({ method: "POST" })
  .validator(filtros)
  .handler(async ({ data }) => {
    await requireStaff();

    const { onde, valores } = condicoesDosFiltros(data);
    const deslocamento = (data.pagina - 1) * POR_PAGINA;

    // Conta e lista na mesma ida ao banco. Duas consultas em sequência
    // custariam duas viagens de 115ms até São Paulo.
    const [total, linhas] = await Promise.all([
      query<{ n: string }>(`SELECT count(*)::text n FROM prospects p WHERE ${onde}`, valores),
      query<LinhaDoCartao>(
        `SELECT ${CAMPOS_DO_CARTAO}
           FROM prospects p
           LEFT JOIN staff_users s ON s.id = p.responsavel_id
          WHERE ${onde}
          ${ORDEM}
          LIMIT ${POR_PAGINA} OFFSET ${deslocamento}`,
        valores,
      ),
    ]);

    return {
      total: Number(total.rows[0].n),
      porPagina: POR_PAGINA,
      pagina: data.pagina,
      itens: linhas.rows.map(cartao),
    };
  });

// Quantos cartões cada coluna do quadro carrega.
//
// O quadro não mostra tudo, e não é limitação: é a única forma de ele existir.
// A coluna "a contatar" tem cento e dezessete mil empresas, e desenhar isso
// trava o navegador antes de qualquer coisa aparecer na tela. Trinta é o que
// cabe numa sessão de ligações — e quem quiser ver o resto tem a lista, que
// pagina.
const POR_COLUNA = 30;

/**
 * O quadro: cada etapa com seus primeiros cartões e o total dela.
 *
 * Uma consulta por etapa, todas disparadas juntas. São seis consultas, mas uma
 * viagem só até São Paulo — em sequência seriam seis vezes 115ms, quase sete
 * décimos de segundo só de ida e volta.
 */
export const listProspectQuadro = createServerFn({ method: "POST" })
  .validator(filtros)
  .handler(async ({ data }) => {
    await requireStaff();

    const colunas = await Promise.all(
      STATUS.map(async (etapa) => {
        // O filtro de status da tela não vale aqui: no quadro, a coluna É o
        // status. Passar os dois faria cinco colunas nascerem vazias.
        const { onde, valores } = condicoesDosFiltros({ ...data, status: etapa });
        const [total, linhas] = await Promise.all([
          query<{ n: string }>(`SELECT count(*)::text n FROM prospects p WHERE ${onde}`, valores),
          query<LinhaDoCartao>(
            `SELECT ${CAMPOS_DO_CARTAO}
               FROM prospects p
               LEFT JOIN staff_users s ON s.id = p.responsavel_id
              WHERE ${onde}
              ${ORDEM}
              LIMIT ${POR_COLUNA}`,
            valores,
          ),
        ]);
        return {
          etapa,
          total: Number(total.rows[0].n),
          mostrando: linhas.rows.length,
          itens: linhas.rows.map(cartao),
        };
      }),
    );

    return { porColuna: POR_COLUNA, colunas };
  });

/** Os números do topo, e a lista de estados e cidades para os filtros. */
export const getProspectResumo = createServerFn({ method: "POST" })
  .validator(
    z.object({ lado: z.enum(LADOS).default("fornecedor"), nicho: z.string().default("pet") }),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    const [contagem, estados] = await Promise.all([
      query<{
        total: string;
        ativas: string;
        com_telefone: string;
        com_whatsapp: string;
        com_email: string;
        a_contatar: string;
        contatados: string;
        cadastraram: string;
      }>(
        `SELECT count(*)::text total,
                count(*) FILTER (WHERE situacao='Ativa')::text ativas,
                count(*) FILTER (WHERE telefone <> '')::text com_telefone,
                count(*) FILTER (WHERE whatsapp <> '')::text com_whatsapp,
                count(*) FILTER (WHERE email <> '')::text com_email,
                count(*) FILTER (WHERE status='a contatar')::text a_contatar,
                count(*) FILTER (WHERE status NOT IN ('a contatar'))::text contatados,
                count(*) FILTER (WHERE status IN ('cadastrou','vitrine no ar'))::text cadastraram
           FROM prospects WHERE lado=$1 AND nicho=$2`,
        [data.lado, data.nicho],
      ),
      query<{ uf: string; n: string }>(
        `SELECT uf, count(*)::text n FROM prospects
          WHERE lado=$1 AND nicho=$2 AND uf <> '' GROUP BY uf ORDER BY count(*) DESC`,
        [data.lado, data.nicho],
      ),
    ]);
    const c = contagem.rows[0];
    return {
      total: Number(c.total),
      ativas: Number(c.ativas),
      comTelefone: Number(c.com_telefone),
      comWhatsapp: Number(c.com_whatsapp),
      comEmail: Number(c.com_email),
      aContatar: Number(c.a_contatar),
      contatados: Number(c.contatados),
      cadastraram: Number(c.cadastraram),
      estados: estados.rows.map((e) => ({ uf: e.uf, total: Number(e.n) })),
    };
  });

/** As cidades de um estado, para o segundo filtro. */
export const listProspectCidades = createServerFn({ method: "POST" })
  .validator(
    z.object({ lado: z.enum(LADOS), nicho: z.string().default("pet"), uf: z.string().length(2) }),
  )
  .handler(async ({ data }) => {
    await requireStaff();
    const linhas = await query<{ cidade: string; n: string }>(
      `SELECT cidade, count(*)::text n FROM prospects
        WHERE lado=$1 AND nicho=$2 AND uf=$3 AND cidade <> ''
        GROUP BY cidade ORDER BY count(*) DESC LIMIT 400`,
      [data.lado, data.nicho, data.uf.toUpperCase()],
    );
    return linhas.rows.map((l) => ({ cidade: l.cidade, total: Number(l.n) }));
  });

/** Anota o resultado de um contato. É o que o quadro e a tela gravam. */
export const salvarProspect = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(STATUS).optional(),
      quemFalou: z.string().trim().max(120).optional(),
      compraDeQuem: z.string().trim().max(300).optional(),
      observacoes: z.string().trim().max(1000).optional(),
      // Passar null desatribui.
      responsavelId: z.string().uuid().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const staff = await requireStaff();

    const campos: string[] = [];
    const valores: unknown[] = [data.id];
    const set = (coluna: string, valor: unknown) => {
      valores.push(valor);
      campos.push(`${coluna} = $${valores.length}`);
    };

    if (data.status !== undefined) {
      set("status", data.status);
      // Sair de "a contatar" é o momento em que o contato aconteceu. Registrar
      // sozinho evita a pessoa ter que preencher data à mão — e data
      // preenchida à mão é data que ninguém preenche.
      if (data.status !== "a contatar") campos.push("contatado_em = coalesce(contatado_em, now())");
      else campos.push("contatado_em = NULL");
    }
    if (data.quemFalou !== undefined) set("quem_falou", data.quemFalou);
    if (data.compraDeQuem !== undefined) set("compra_de_quem", data.compraDeQuem);
    if (data.observacoes !== undefined) set("observacoes", data.observacoes);
    if (data.responsavelId !== undefined) set("responsavel_id", data.responsavelId);

    if (!campos.length) return { ok: true };
    campos.push("atualizado_em = now()");

    const atualizado = await query<{ razao_social: string }>(
      `UPDATE prospects SET ${campos.join(",")} WHERE id = $1 RETURNING razao_social`,
      valores,
    );
    if (!atualizado.rows[0]) throw new Error("Empresa não encontrada na lista");

    // Só o que muda o estado do trabalho entra na auditoria. Anotar cada
    // digitação de observação encheria o log de ruído e esconderia o que
    // importa.
    if (data.status !== undefined || data.responsavelId !== undefined) {
      await logStaffAction(staff, "prospeccao_atualizada", null, {
        empresa: atualizado.rows[0].razao_social,
        status: data.status,
        responsavel: data.responsavelId,
      });
    }
    return { ok: true };
  });
