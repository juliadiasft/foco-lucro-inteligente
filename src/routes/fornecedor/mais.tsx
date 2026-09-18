import { createFileRoute } from "@tanstack/react-router";

import { TelaMais } from "@/components/app/TelaMais";
import { ITENS_DE_MAIS_FORNECEDOR } from "@/lib/navegacao";

// A quinta aba do fornecedor (SPEC §6.2): pedidos, vitrine, importação e conta.
export const Route = createFileRoute("/fornecedor/mais")({
  head: () => ({ meta: [{ title: "Mais — Central do Comerciante" }] }),
  component: () => (
    <TelaMais
      itens={ITENS_DE_MAIS_FORNECEDOR}
      grupos={[
        { id: "negocio", titulo: "mais.grupoNegocio" },
        { id: "dinheiro", titulo: "mais.grupoDinheiro" },
        { id: "conta", titulo: "mais.grupoConta" },
      ]}
    />
  ),
});
