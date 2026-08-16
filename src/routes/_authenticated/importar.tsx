import { createFileRoute, Link } from "@tanstack/react-router";

import { ImportWizard } from "@/components/app/ImportWizard";

export const Route = createFileRoute("/_authenticated/importar")({
  head: () => ({ meta: [{ title: "Importar planilha — Central do Comerciante" }] }),
  component: ImportarProdutos,
});

function ImportarProdutos() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Importar planilha</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Traga seus produtos e custos de uma vez, sem digitar item por item. Reimportar a mesma
          planilha atualiza os preços em vez de duplicar o cadastro.
        </p>
        <Link to="/integracoes" className="text-sm text-primary underline mt-2 inline-block">
          Ver as outras integrações
        </Link>
      </div>
      <ImportWizard mode="produtos" />
    </div>
  );
}
