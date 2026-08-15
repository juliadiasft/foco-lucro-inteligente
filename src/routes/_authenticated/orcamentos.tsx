import { createFileRoute } from "@tanstack/react-router";

import { QuotesView } from "@/components/app/QuotesView";

export const Route = createFileRoute("/_authenticated/orcamentos")({
  head: () => ({ meta: [{ title: "Orçamentos — Central do Comerciante" }] }),
  component: () => (
    <QuotesView emptyHint="Vá em Onde comprar e clique em Pedir orçamento para negociar condições." />
  ),
});
