// Quem da equipe pode usar cada área do back office.
//
// Mora fora de staff.server.ts porque aquele arquivo importa o servidor do
// TanStack logo na primeira linha, e uma regra de permissão que só pode ser
// exercitada subindo servidor acaba não sendo testada. Esta pode
// (scripts/importar-catalogo.test.mjs).

export type PapelDaEquipe = "admin" | "financeiro" | "suporte";

/**
 * Sem lista de papéis, basta ser da equipe. Com lista, é preciso estar nela —
 * e o admin passa sempre, porque é a conta que existe para destravar o resto.
 */
export function podeUsar(papel: PapelDaEquipe, permitidos?: PapelDaEquipe[]) {
  if (!permitidos) return true;
  return permitidos.includes(papel) || papel === "admin";
}
