import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, Search, Upload } from "lucide-react";
import { useState } from "react";

import { ImportWizard } from "@/components/app/ImportWizard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ImportResult } from "@/lib/api/import.functions";
import {
  buscarFornecedoresParaImportar,
  importarCatalogoDeFornecedor,
} from "@/lib/api/staff.functions";
import { dataBR } from "@/lib/format";

export const Route = createFileRoute("/adm/importar")({
  head: () => ({ meta: [{ title: "Importar catálogo — Back office" }] }),
  component: AdminImportar,
});

type Fornecedor = {
  id: string;
  empresa: string;
  cidade: string | null;
  uf: string | null;
  itens: number;
  importadoEm: string | null;
  importadoPor: string | null;
};

function AdminImportar() {
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [escolhido, setEscolhido] = useState<Fornecedor | null>(null);

  const fornecedores = useQuery({
    queryKey: ["fornecedores-para-importar", termo],
    queryFn: () => buscarFornecedoresParaImportar({ data: { busca: termo } }),
    enabled: !escolhido,
  });

  if (escolhido)
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">Importar catálogo</h1>
            <p className="text-sm text-muted-foreground mt-1">
              A tabela vai para a conta de <strong>{escolhido.empresa}</strong>
              {escolhido.cidade ? ` — ${escolhido.cidade}` : ""}
              {escolhido.uf ? `/${escolhido.uf}` : ""}.
            </p>
          </div>
          <Button variant="outline" onClick={() => setEscolhido(null)}>
            Trocar de fornecedor
          </Button>
        </div>

        {/* O que esta tela NÃO faz precisa estar escrito na tela, e não só no
            código: quem usa isto está no telefone com o fornecedor e vai
            prometer alguma coisa para ele agora. */}
        <Card className="p-4 border-primary/30 bg-primary/5">
          <p className="text-sm">
            A vitrine <strong>não vai ao ar</strong> com esta importação. Os itens entram na conta
            dele, e publicar continua sendo decisão dele — preço de terceiro não vira página pública
            sem ele ter olhado.
          </p>
          <p className="text-sm mt-2">
            Ele vai ver na tela dele que foi a Central quem subiu, com a data. Combine quem atualiza
            daqui para frente: preço importado envelhece, e preço velho na comparação é pior do que
            preço nenhum.
          </p>
        </Card>

        <ImportWizard
          mode="catalogo"
          enviar={(linhas) =>
            importarCatalogoDeFornecedor({
              data: { companyId: escolhido.id, rows: linhas as never },
            }) as Promise<ImportResult>
          }
        />
      </div>
    );

  const lista = (fornecedores.data ?? []) as Fornecedor[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Importar catálogo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sobe a tabela de preço na conta de um fornecedor, durante o cadastro assistido. Fica
          registrado na auditoria com o seu nome.
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(evento) => {
          evento.preventDefault();
          setTermo(busca);
        }}
      >
        <Input
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Nome do fornecedor ou cidade"
          className="max-w-sm"
        />
        <Button type="submit" variant="outline">
          <Search className="h-4 w-4 mr-2" /> Buscar
        </Button>
      </form>

      {fornecedores.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : lista.length === 0 ? (
        <Card className="p-6 text-center">
          <Building2 className="h-6 w-6 mx-auto text-muted-foreground" />
          <p className="text-sm mt-2">
            Nenhum fornecedor encontrado. Ele precisa ter conta criada antes — a importação preenche
            o catálogo, não cria a conta.
          </p>
        </Card>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {lista.map((fornecedor) => (
            <div
              key={fornecedor.id}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{fornecedor.empresa}</p>
                <p className="text-xs text-muted-foreground">
                  {[fornecedor.cidade, fornecedor.uf].filter(Boolean).join("/") || "Sem cidade"} ·{" "}
                  {fornecedor.itens} {fornecedor.itens === 1 ? "item ativo" : "itens ativos"}
                  {fornecedor.importadoEm
                    ? ` · última importação da equipe em ${dataBR(fornecedor.importadoEm)}`
                    : ""}
                </p>
              </div>
              <Button onClick={() => setEscolhido(fornecedor)}>
                <Upload className="h-4 w-4 mr-2" /> Importar para ele
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
