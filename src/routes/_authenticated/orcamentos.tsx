import { createFileRoute } from "@tanstack/react-router";

import { QuotesView } from "@/components/app/QuotesView";
import { buscaDoItemAberto, useItemAberto } from "@/hooks/useItemAberto";

export const Route = createFileRoute("/_authenticated/orcamentos")({
  validateSearch: buscaDoItemAberto,
  head: () => ({ meta: [{ title: "Orçamentos — Central do Comerciante" }] }),
  component: Orcamentos,
});

function Orcamentos() {
  const { aberto } = Route.useSearch();
  const navigate = Route.useNavigate();
  const item = useItemAberto(aberto, (id, substituir) =>
    navigate({ search: id ? { aberto: id } : {}, replace: substituir }),
  );
  return (
    <QuotesView
      {...item}
      emptyHint="Vá em Onde comprar e clique em Pedir orçamento para negociar condições."
    />
  );
}
