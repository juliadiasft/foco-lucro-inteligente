import { createFileRoute } from "@tanstack/react-router";

import { QuotesView } from "@/components/app/QuotesView";

export const Route = createFileRoute("/fornecedor/orcamentos")({
  head: () => ({ meta: [{ title: "Orçamentos — Central do Comerciante" }] }),
  component: () => (
    <QuotesView emptyHint="Os pedidos de orçamento dos comerciantes aparecem aqui assim que chegarem." />
  ),
});
