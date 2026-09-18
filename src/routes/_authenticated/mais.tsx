import { createFileRoute } from "@tanstack/react-router";

import { TelaMais } from "@/components/app/TelaMais";
import { ITENS_DE_MAIS } from "@/lib/navegacao";

// A quinta aba do comerciante: contas, relatórios, trazer dados e a conta em si.
export const Route = createFileRoute("/_authenticated/mais")({
  head: () => ({ meta: [{ title: "Mais — Central do Comerciante" }] }),
  component: () => (
    <TelaMais
      itens={ITENS_DE_MAIS}
      grupos={[
        { id: "dinheiro", titulo: "mais.grupoDinheiro" },
        { id: "dados", titulo: "mais.grupoDados" },
        { id: "conta", titulo: "mais.grupoConta" },
      ]}
    />
  ),
});
