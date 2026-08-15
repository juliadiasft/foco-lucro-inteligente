import { createFileRoute } from "@tanstack/react-router";

import { ImportWizard } from "@/components/app/ImportWizard";

export const Route = createFileRoute("/fornecedor/importar")({
  head: () => ({ meta: [{ title: "Importar catálogo — Central do Comerciante" }] }),
  component: ImportarCatalogo,
});

function ImportarCatalogo() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Importar catálogo</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Traga sua tabela de preços de uma vez. Informe o tamanho da embalagem para a Central
          comparar seu preço com o dos outros de forma justa.
        </p>
      </div>
      <ImportWizard mode="catalogo" />
    </div>
  );
}
