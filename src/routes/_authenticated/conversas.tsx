import { createFileRoute } from "@tanstack/react-router";

import { ConversationsView } from "@/components/app/ConversationsView";

export const Route = createFileRoute("/_authenticated/conversas")({
  head: () => ({ meta: [{ title: "Conversas — Central do Comerciante" }] }),
  component: () => (
    <ConversationsView emptyHint="Vá em Onde comprar, encontre um fornecedor e clique em Conversar." />
  ),
});
