import { createFileRoute } from "@tanstack/react-router";

import { EscolhaDoIdioma } from "@/components/app/EscolhaDoIdioma";
import { EscolhaDoTema } from "@/components/app/EscolhaDoTema";
import { useIdioma } from "@/hooks/useIdioma";

// O fornecedor não tinha tela de configurações — o que era dele ficava
// espalhado entre a vitrine e o cadastro. Começa pelo tema, que é o que ele
// pode querer trocar hoje, e é aqui que o resto vai morar.
export const Route = createFileRoute("/fornecedor/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Central do Comerciante" }] }),
  component: ConfiguracoesDoFornecedor,
});

function ConfiguracoesDoFornecedor() {
  const { t } = useIdioma();
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{t("cfg.titulo")}</h1>
        <p className="text-muted-foreground">{t("cfg.subtituloAparelho")}</p>
      </div>
      <EscolhaDoIdioma />
      <EscolhaDoTema />
    </div>
  );
}
