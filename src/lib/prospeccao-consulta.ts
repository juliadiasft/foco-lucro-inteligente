// A consulta da lista de prospecção: filtros e ordem.
//
// Fica fora de prospeccao.functions.ts para poder ser testada contra um banco
// de verdade sem subir servidor nem sessão de staff (ver
// scripts/praca.test.mjs). A função do servidor só chama isto.

import { z } from "zod";

import { CIDADES_DA_PRACA, TIPO_SQL, UF_DA_PRACA } from "./praca.ts";

export const LADOS = ["comerciante", "fornecedor"] as const;
export const STATUS = [
  "a contatar",
  "contatado",
  "respondeu",
  "cadastrou",
  "vitrine no ar",
  "sem interesse",
] as const;

export const filtros = z.object({
  lado: z.enum(LADOS).default("fornecedor"),
  nicho: z.string().trim().max(40).default("pet"),
  // Com praça escolhida, estado e cidade não valem: a praça já é uma lista
  // de cidades, e somar os dois daria sempre vazio ou sempre a praça inteira.
  praca: z.enum(["campinas"]).optional(),
  uf: z.string().trim().max(2).optional(),
  cidade: z.string().trim().max(80).optional(),
  tipo: z.enum(["A", "B", "C"]).optional(),
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

export type Filtros = z.infer<typeof filtros>;

/** Lista de texto do SQL a partir de constantes do código — nunca de entrada da tela. */
const listaSql = (itens: readonly string[]) =>
  `ARRAY[${itens.map((item) => `'${item.replace(/'/g, "''")}'`).join(",")}]::text[]`;

/**
 * Monta o WHERE a partir dos filtros da tela.
 *
 * As condições são montadas em pedaços com parâmetros numerados, e nunca por
 * concatenação de texto: é lista grande e filtro vindo da tela, que é
 * exatamente onde injeção de SQL entra. A lista de cidades da praça é a única
 * exceção, e vem do código (src/lib/praca.ts), não da tela.
 */
export function condicoesDosFiltros(data: Filtros) {
  const condicoes = ["p.lado = $1", "p.nicho = $2"];
  const valores: unknown[] = [data.lado, data.nicho];
  const add = (sql: string, valor: unknown) => {
    valores.push(valor);
    condicoes.push(sql.replace("?", `$${valores.length}`));
  };

  if (data.praca) {
    add("p.uf = ?", UF_DA_PRACA[data.praca]);
    condicoes.push(`upper(p.cidade) = ANY(${listaSql(CIDADES_DA_PRACA[data.praca])})`);
  } else {
    if (data.uf) add("p.uf = ?", data.uf.toUpperCase());
    if (data.cidade) add("p.cidade = ?", data.cidade);
  }
  if (data.tipo) add(`${TIPO_SQL} = ?`, data.tipo);
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

/**
 * A ordem da lista.
 *
 * Fora da praça: quem tem WhatsApp primeiro, depois quem é atividade principal.
 *
 * Dentro da praça, a ordem é o plano de ligações, e as primeiras 40 são a
 * semana 2 do plano de 14/09/2026:
 *   1. central de atendimento (10+ empresas no mesmo telefone) vai para o fim —
 *      ligar para ela é ligar para a mesma mesa de novo;
 *   2. atacado de ração, depois fábrica e remédio veterinário, depois o resto;
 *   3. no tipo C, quem não tem nome de pet fica atrás de quem tem;
 *   4. a cidade mais perto de Campinas antes da mais longe;
 *   5. nome de pet, WhatsApp e e-mail desempatam.
 */
export function ordemDaLista(data: Pick<Filtros, "praca">) {
  if (!data.praca)
    return `ORDER BY (p.whatsapp <> '') DESC,
                   (p.confere = 'principal') DESC,
                   p.nome_sugere_pet DESC,
                   p.razao_social`;
  return `ORDER BY (p.contatos_iguais >= 10),
                   ${TIPO_SQL},
                   (${TIPO_SQL} = 'C' AND NOT p.nome_sugere_pet),
                   array_position(${listaSql(CIDADES_DA_PRACA[data.praca])}, upper(p.cidade)),
                   p.nome_sugere_pet DESC,
                   (p.whatsapp <> '') DESC,
                   (p.email <> '') DESC,
                   p.razao_social`;
}
