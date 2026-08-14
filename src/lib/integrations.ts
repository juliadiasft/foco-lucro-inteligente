// Catálogo de integrações. Nenhum conector está pronto: enquanto não houver
// uma conexão real funcionando, a tela precisa dizer isso com todas as letras.
// Para promover uma integração, basta mudar o `status` aqui.

export type IntegrationStatus = "em_avaliacao" | "em_desenvolvimento";

export type IntegrationKind = "pdv" | "erp" | "loja" | "planilha";

export type IntegrationDefinition = {
  id: string;
  name: string;
  kind: IntegrationKind;
  status: IntegrationStatus;
  summary: string;
};

export const integrationStatusLabels: Record<IntegrationStatus, string> = {
  em_avaliacao: "Em avaliação",
  em_desenvolvimento: "Em desenvolvimento",
};

export const integrationKindLabels: Record<IntegrationKind, string> = {
  pdv: "PDV",
  erp: "ERP",
  loja: "Loja virtual",
  planilha: "Planilha",
};

export const integrations: IntegrationDefinition[] = [
  {
    id: "bling",
    name: "Bling",
    kind: "erp",
    status: "em_avaliacao",
    summary: "Traz produtos, custos e estoque direto do seu Bling.",
  },
  {
    id: "olist-tiny",
    name: "Olist Tiny",
    kind: "erp",
    status: "em_avaliacao",
    summary: "Traz produtos, custos e estoque do Tiny.",
  },
  {
    id: "omie",
    name: "Omie",
    kind: "erp",
    status: "em_avaliacao",
    summary: "Traz produtos, compras e fornecedores do Omie.",
  },
  {
    id: "marketup",
    name: "MarketUP",
    kind: "pdv",
    status: "em_avaliacao",
    summary: "Traz as vendas do seu PDV MarketUP.",
  },
  {
    id: "nuvemshop",
    name: "Nuvemshop",
    kind: "loja",
    status: "em_avaliacao",
    summary: "Traz produtos e vendas da sua loja virtual.",
  },
  {
    id: "planilha",
    name: "Planilha",
    kind: "planilha",
    status: "em_avaliacao",
    summary: "Envie uma planilha de produtos e custos para analisar.",
  },
];

export const integrationById = new Map(integrations.map((item) => [item.id, item]));
