import { createFileRoute } from "@tanstack/react-router";

import { ConversationsView } from "@/components/app/ConversationsView";

export const Route = createFileRoute("/fornecedor/conversas")({
  head: () => ({ meta: [{ title: "Conversas — Central do Comerciante" }] }),
  component: () => (
    <ConversationsView emptyHint="Publique sua vitrine e cadastre seu catálogo para os comerciantes encontrarem você e iniciarem a conversa." />
  ),
});
