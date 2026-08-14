import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BellRing, Check, Plug } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  cancelIntegrationRequest,
  listIntegrations,
  requestIntegration,
} from "@/lib/api/integrations.functions";
import { integrationKindLabels, integrationStatusLabels } from "@/lib/integrations";

export const Route = createFileRoute("/_authenticated/integracoes")({
  head: () => ({ meta: [{ title: "Conectar meu sistema — Central do Comerciante" }] }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => listIntegrations(),
  });

  const toggle = useMutation({
    mutationFn: ({ provider, requested }: { provider: string; requested: boolean }) =>
      requested
        ? cancelIntegrationRequest({ data: { provider } })
        : requestIntegration({ data: { provider } }),
    onSuccess: async (_result, variables) => {
      toast.success(
        variables.requested
          ? "Tudo bem, não avisaremos sobre esta."
          : "Combinado. Avisaremos assim que estiver pronta.",
      );
      await queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Conectar meu sistema</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          A ideia é simples: em vez de você digitar tudo de novo, a Central lê os dados do sistema
          que você já usa e mostra onde está o dinheiro.
        </p>
      </div>

      <Card className="p-5 border-warning/40 bg-warning/5">
        <p className="font-medium">Nenhuma conexão está funcionando ainda.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Estamos avaliando por onde começar. Marque as que você usa e avisamos assim que a sua
          estiver pronta — é isso que define a ordem da fila.
        </p>
        <p className="text-sm text-muted-foreground mt-3">
          Enquanto isso, dá para{" "}
          <Link to="/produtos" className="text-primary underline">
            cadastrar seus produtos
          </Link>{" "}
          ou{" "}
          <Link to="/pdv" className="text-primary underline">
            registrar uma venda
          </Link>{" "}
          na mão.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_item, index) => (
              <Card key={index} className="p-5 h-44 animate-pulse bg-muted/40" />
            ))
          : data?.map((integration) => (
              <Card key={integration.id} className="p-5 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <Plug className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <h2 className="font-semibold leading-tight">{integration.name}</h2>
                      <p className="text-xs text-muted-foreground">
                        {integrationKindLabels[integration.kind]}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {integrationStatusLabels[integration.status]}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-3 flex-1">{integration.summary}</p>
                <Button
                  className="mt-4"
                  variant={integration.requested ? "secondary" : "outline"}
                  disabled={toggle.isPending}
                  onClick={() =>
                    toggle.mutate({
                      provider: integration.id,
                      requested: integration.requested,
                    })
                  }
                >
                  {integration.requested ? (
                    <>
                      <Check className="h-4 w-4 mr-1" /> Vamos te avisar
                    </>
                  ) : (
                    <>
                      <BellRing className="h-4 w-4 mr-1" /> Avise-me quando estiver pronta
                    </>
                  )}
                </Button>
              </Card>
            ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Usa outro sistema?{" "}
        <Link to="/contato" className="text-primary underline">
          Conte para a gente
        </Link>{" "}
        — isso pesa na escolha da próxima integração.
      </p>
    </div>
  );
}
