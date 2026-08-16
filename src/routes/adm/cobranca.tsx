import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, CreditCard } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listBillingFailures, resolveBillingFailure } from "@/lib/api/staff.functions";
import { dataHoraBR } from "@/lib/format";

export const Route = createFileRoute("/adm/cobranca")({
  head: () => ({ meta: [{ title: "Cobrança — Back office" }] }),
  component: AdminBilling,
});

function AdminBilling() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["billing-failures"],
    queryFn: () => listBillingFailures(),
  });

  const resolve = useMutation({
    mutationFn: (id: string) => resolveBillingFailure({ data: { id } }),
    onSuccess: async () => {
      toast.success("Evento marcado como resolvido");
      await queryClient.invalidateQueries({ queryKey: ["billing-failures"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Cobrança</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Eventos da Cakto que não viraram acesso liberado. Cada linha aqui é um pagamento que pode
          ter entrado sem a conta ser ativada.
        </p>
      </div>

      {!rows.length ? (
        <Card className="p-8 text-center">
          <CheckCircle2 className="h-8 w-8 mx-auto text-success" />
          <p className="font-medium mt-3">Nenhum evento pendente.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Todos os pagamentos recebidos foram conciliados.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id} className="p-5 flex flex-wrap items-center gap-4">
              <CreditCard className="h-5 w-5 text-warning" />
              <div className="flex-1 min-w-[16rem]">
                <p className="font-medium">
                  {row.eventType} — {row.reason}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.companyName ? `${row.companyName} · ` : ""}
                  {row.customerEmail || "sem email"}
                  {row.subscriptionId ? ` · assinatura ${row.subscriptionId}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">{dataHoraBR(row.createdAt)}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={resolve.isPending}
                onClick={() => resolve.mutate(row.id)}
              >
                Marcar como resolvido
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
