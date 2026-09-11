import { createFileRoute } from "@tanstack/react-router";

import { ConversationsView } from "@/components/app/ConversationsView";
import { buscaDoItemAberto, useItemAberto } from "@/hooks/useItemAberto";

export const Route = createFileRoute("/_authenticated/conversas")({
  validateSearch: buscaDoItemAberto,
  head: () => ({ meta: [{ title: "Conversas — Central do Comerciante" }] }),
  component: Conversas,
});

function Conversas() {
  const { aberto } = Route.useSearch();
  const navigate = Route.useNavigate();
  const item = useItemAberto(aberto, (id, substituir) =>
    navigate({ search: id ? { aberto: id } : {}, replace: substituir }),
  );
  return (
    <ConversationsView
      {...item}
      emptyHint="Vá em Onde comprar, encontre um fornecedor e clique em Conversar."
    />
  );
}
