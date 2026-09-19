import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Gift, MapPin, Phone, Truck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listEntregasDePremio, marcarEntregaDePremio } from "@/lib/api/adm-conquistas.functions";
import { brl, dataBR } from "@/lib/format";
import { ROTULO_DA_ENTREGA } from "@/lib/premiacao";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/adm/conquistas")({
  head: () => ({ meta: [{ title: "Entrega dos mascotinhos — Back office" }] }),
  component: AdminConquistas,
});

const CHAVE = ["adm-entregas-de-premio"];

function AdminConquistas() {
  const cliente = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: CHAVE, queryFn: () => listEntregasDePremio() });
  const marcar = useMutation({
    mutationFn: (e: { empresaId: string; degrau: number; para: "enviado" | "entregue" }) =>
      marcarEntregaDePremio({ data: e }),
    onSuccess: async (_r, e) => {
      toast.success(e.para === "enviado" ? "Marcado como enviado" : "Marcado como entregue");
      await cliente.invalidateQueries({ queryKey: CHAVE });
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const fila = data ?? [];
  const paraEnviar = fila.filter((c) => c.status === "endereco_enviado").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Entrega dos mascotinhos</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Quem bateu R$ 10 mil em pedidos aceitos ou concluídos e informou o endereço aparece aqui,
          no topo. Marque “enviado” quando postar e “entregue” quando confirmar. Quem ainda não
          informou o endereço espera embaixo.
          {paraEnviar > 0 && (
            <strong className="ml-1 text-foreground">{paraEnviar} para enviar agora.</strong>
          )}
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !fila.length ? (
        <Card className="p-8 text-center">
          <Gift className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Ninguém chegou aos R$ 10 mil ainda.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {fila.map((c) => (
            <Card key={`${c.empresaId}-${c.degrau}`} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{c.empresa}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {c.tipo === "fornecedor" ? "Fornecedor" : "Comerciante"} · {brl(c.totalNaData)}{" "}
                    na conquista · {dataBR(c.conquistadaEm)}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    c.status === "endereco_enviado" &&
                      "border-primary/40 bg-primary/10 text-primary",
                  )}
                >
                  {ROTULO_DA_ENTREGA[c.status]}
                </Badge>
              </div>

              {c.endereco && (
                <div className="mt-3 space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
                  <p className="font-medium">{c.endereco.destinatario}</p>
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {c.endereco.linha1} — {c.endereco.bairro} — {c.endereco.cidade}/{c.endereco.uf}{" "}
                    — CEP {c.endereco.cep}
                  </p>
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 shrink-0" /> {c.endereco.telefone}
                  </p>
                </div>
              )}

              {c.proxima && (
                <div className="mt-3">
                  <Button
                    size="sm"
                    disabled={marcar.isPending}
                    onClick={() =>
                      marcar.mutate({ empresaId: c.empresaId, degrau: c.degrau, para: c.proxima! })
                    }
                  >
                    <Truck className="mr-2 h-4 w-4" />
                    {c.proxima === "enviado" ? "Marcar como enviado" : "Marcar como entregue"}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
