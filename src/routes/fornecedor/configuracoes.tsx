import { createFileRoute } from "@tanstack/react-router";

import { EscolhaDoTema } from "@/components/app/EscolhaDoTema";

// O fornecedor não tinha tela de configurações — o que era dele ficava
// espalhado entre a vitrine e o cadastro. Começa pelo tema, que é o que ele
// pode querer trocar hoje, e é aqui que o resto vai morar.
export const Route = createFileRoute("/fornecedor/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Central do Comerciante" }] }),
  component: ConfiguracoesDoFornecedor,
});

function ConfiguracoesDoFornecedor() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Configurações</h1>
        <p className="text-muted-foreground">Como a Central se comporta neste aparelho</p>
      </div>
      <EscolhaDoTema />
    </div>
  );
}
