import type { Chave } from "@/lib/idioma";

// As cinco abas do app do comerciante (SPEC §6.1).
//
// Até 18/09/2026 o app tinha 11 itens numa gaveta e quatro atalhos na barra de
// baixo. Produtos, Fornecedores, Relatórios e o Assistente de Lucro ficavam
// escondidos no menu. Agora são cinco abas fixas, e cada tela do app pertence a
// exatamente uma delas.
//
// Nenhuma rota mudou de endereço: `/orcamentos` continua `/orcamentos`. O que
// muda é o agrupamento — e é por isso que a regra mora aqui, pura, e não
// espalhada nos componentes: a barra de baixo, a lateral do computador e a
// faixa de subtelas leem a mesma resposta.

export type AbaId = "painel" | "comprar" | "produtos" | "assistente" | "mais";

// As telas que "Comprar" absorve: buscar, orçar, negociar, pedir. Antes eram
// quatro entradas soltas no menu.
export const SUBTELAS_DE_COMPRAR = [
  { to: "/comprar", label: "Onde comprar", chave: "nav.ondeComprar" },
  { to: "/fornecedores", label: "Fornecedores", chave: "nav.fornecedores" },
  { to: "/orcamentos", label: "Orçamentos", chave: "nav.orcamentos" },
  { to: "/pedidos", label: "Pedidos", chave: "nav.pedidos" },
  { to: "/conversas", label: "Conversas", chave: "nav.conversas" },
] as const;

// O que mora em "Mais". O lançamento manual fica aqui de propósito: continua
// disponível, mas como apoio — a Central não pode pedir de novo o que a
// maquininha já registrou.
export const ITENS_DE_MAIS = [
  { to: "/financeiro", label: "Contas a pagar", chave: "nav.financeiro", grupo: "dinheiro" },
  { to: "/relatorios", label: "Relatórios", chave: "nav.relatorios", grupo: "dinheiro" },
  { to: "/integracoes", label: "Trazer meus dados", chave: "nav.trazerDados", grupo: "dados" },
  { to: "/pdv", label: "Registrar venda", chave: "nav.registrarVenda", grupo: "dados" },
  { to: "/vendas", label: "Histórico de vendas", chave: "nav.historicoVendas", grupo: "dados" },
  { to: "/equipe", label: "Equipe", chave: "nav.equipe", grupo: "conta" },
  { to: "/assinatura", label: "Plano e assinatura", chave: "nav.plano", grupo: "conta" },
  { to: "/configuracoes", label: "Configurações", chave: "nav.configuracoes", grupo: "conta" },
] as const;

const PREFIXOS_DE_ABA: { aba: AbaId; prefixos: readonly string[] }[] = [
  { aba: "painel", prefixos: ["/dashboard"] },
  { aba: "comprar", prefixos: SUBTELAS_DE_COMPRAR.map((subtela) => subtela.to) },
  { aba: "produtos", prefixos: ["/produtos"] },
  { aba: "assistente", prefixos: ["/consultor"] },
  { aba: "mais", prefixos: ["/mais", ...ITENS_DE_MAIS.map((item) => item.to)] },
];

/** `/orcamentos/123` pertence a `/orcamentos`; `/orcamentosx` não. */
function comecaCom(pathname: string, prefixo: string) {
  return pathname === prefixo || pathname.startsWith(`${prefixo}/`);
}

/**
 * A aba a que a rota pertence. Rota que ninguém reclamou (onboarding, por
 * exemplo) cai em "painel": é a casa do app, e a barra nunca fica sem nenhuma
 * aba acesa.
 */
export function abaDaRota(pathname: string): AbaId {
  for (const { aba, prefixos } of PREFIXOS_DE_ABA)
    if (prefixos.some((prefixo) => comecaCom(pathname, prefixo))) return aba;
  return "painel";
}

/** Se a faixa de subtelas de "Comprar" aparece nesta rota. */
export function mostraSubtelasDeComprar(pathname: string) {
  return abaDaRota(pathname) === "comprar";
}

export function subtelaAtiva(pathname: string, to: string) {
  return comecaCom(pathname, to);
}

// ---------------------------------------------------------------------------
// App do fornecedor — 5 abas (SPEC §6.2): Painel, Orçamentos, Catálogo,
// Conversas e Mais. Pedidos, vitrine, importação e o resto moram em "Mais".

export type AbaFornecedorId = "painel" | "orcamentos" | "catalogo" | "conversas" | "mais";

export const ITENS_DE_MAIS_FORNECEDOR = [
  { to: "/fornecedor/pedidos", chave: "nav.pedidos", grupo: "negocio" },
  { to: "/fornecedor/vitrine", chave: "forn.vitrine", grupo: "negocio" },
  { to: "/fornecedor/importar", chave: "forn.importar", grupo: "negocio" },
  { to: "/fornecedor/consultor", chave: "forn.consultor", grupo: "negocio" },
  { to: "/fornecedor/financeiro", chave: "forn.contasReceber", grupo: "dinheiro" },
  { to: "/fornecedor/configuracoes", chave: "nav.configuracoes", grupo: "conta" },
  { to: "/assinatura", chave: "nav.plano", grupo: "conta" },
] as const satisfies readonly { to: string; chave: Chave; grupo: string }[];

/** O painel do fornecedor é `/fornecedor` exato: todas as outras rotas começam com ele. */
export function abaDoFornecedor(pathname: string): AbaFornecedorId {
  if (comecaCom(pathname, "/fornecedor/orcamentos")) return "orcamentos";
  if (comecaCom(pathname, "/fornecedor/catalogo")) return "catalogo";
  if (comecaCom(pathname, "/fornecedor/conversas")) return "conversas";
  if (pathname === "/fornecedor" || pathname === "/fornecedor/") return "painel";
  if (
    comecaCom(pathname, "/fornecedor/mais") ||
    ITENS_DE_MAIS_FORNECEDOR.some((item) => comecaCom(pathname, item.to))
  )
    return "mais";
  return "painel";
}
