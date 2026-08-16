import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { extendTrial, getCustomer, setCustomerSuspension } from "@/lib/api/staff.functions";
import { dataBR, dataHoraBR, num } from "@/lib/format";

export const Route = createFileRoute("/adm/cliente/$id")({
  head: () => ({ meta: [{ title: "Cliente — Back office" }] }),
  component: CustomerDetail,
});

function CustomerDetail() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const { data, error } = useQuery({
    queryKey: ["staff-customer", id],
    queryFn: () => getCustomer({ data: { id } }),
    retry: false,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["staff-customer", id] });

  const trial = useMutation({
    mutationFn: (days: number) => extendTrial({ data: { id, days } }),
    onSuccess: async () => {
      toast.success("Teste estendido");
      await refresh();
    },
    onError: (reason: Error) => toast.error(reason.message),
  });

  const suspension = useMutation({
    mutationFn: ({ suspended, reason }: { suspended: boolean; reason?: string }) =>
      setCustomerSuspension({ data: { id, suspended, reason } }),
    onSuccess: async () => {
      toast.success("Situação da conta atualizada");
      await refresh();
    },
    onError: (reason: Error) => toast.error(reason.message),
  });

  if (error)
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/adm/clientes">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Link>
        </Button>
        <Card className="p-6">
          <p className="text-sm">{error.message}</p>
        </Card>
      </div>
    );

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/adm/clientes">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar para clientes
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{data?.name}</h1>
          <p className="text-muted-foreground mt-1 capitalize">
            {data?.accountType} · plano {data?.plan} ·{" "}
            {data?.city ? `${data.city}${data.uf ? ` — ${data.uf}` : ""}` : "sem cidade"}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">{data?.subscriptionStatus}</Badge>
          {data?.suspendedAt && <Badge variant="destructive">suspensa</Badge>}
        </div>
      </div>

      {data?.suspendedAt && (
        <Card className="p-5 border-destructive/40 bg-destructive/5 flex flex-wrap items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          <div className="flex-1 min-w-[14rem]">
            <p className="font-medium">Conta suspensa em {dataHoraBR(data.suspendedAt)}</p>
            {data.suspendedReason && (
              <p className="text-sm text-muted-foreground">{data.suspendedReason}</p>
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6 space-y-2 text-sm">
          <h2 className="font-semibold text-base">Assinatura</h2>
          <p>
            <span className="text-muted-foreground">Situação: </span>
            {data?.subscriptionStatus}
          </p>
          <p>
            <span className="text-muted-foreground">Teste até: </span>
            {data ? dataBR(data.trialEndsAt) : "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Renovação: </span>
            {data?.currentPeriodEnd ? dataBR(data.currentPeriodEnd) : "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Assinatura Cakto: </span>
            {data?.subscriptionId || "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Documento: </span>
            {data?.documento || "—"}
          </p>
          <p className="text-xs text-muted-foreground pt-2">
            A Central guarda apenas o tipo e os quatro últimos dígitos do documento.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold">Uso da plataforma</h2>
          <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
            <div>
              <p className="text-muted-foreground">Produtos</p>
              <p className="text-2xl font-bold">{num(data?.atividade.produtos)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Pedidos</p>
              <p className="text-2xl font-bold">{num(data?.atividade.pedidos)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Conversas</p>
              <p className="text-2xl font-bold">{num(data?.atividade.conversas)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Perguntas à IA</p>
              <p className="text-2xl font-bold">{num(data?.atividade.perguntasIa)}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold">Pessoas da conta</h2>
        <ul className="mt-4 divide-y text-sm">
          {(data?.usuarios || []).map((user) => (
            <li key={user.email} className="py-2 flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>{user.role}</p>
                <p>{user.active ? "ativo" : "inativo"}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold">Ações</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Toda ação daqui fica registrada na auditoria com seu nome.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" disabled={trial.isPending} onClick={() => trial.mutate(7)}>
            Estender teste em 7 dias
          </Button>
          <Button variant="outline" disabled={trial.isPending} onClick={() => trial.mutate(30)}>
            Estender teste em 30 dias
          </Button>
          {data?.suspendedAt ? (
            <Button
              disabled={suspension.isPending}
              onClick={() => suspension.mutate({ suspended: false })}
            >
              Reativar conta
            </Button>
          ) : (
            <Button
              variant="destructive"
              disabled={suspension.isPending}
              onClick={() => {
                const reason = window.prompt("Motivo da suspensão (fica registrado):", "");
                if (reason === null) return;
                suspension.mutate({ suspended: true, reason: reason || undefined });
              }}
            >
              Suspender conta
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Suspender encerra as sessões abertas na hora e bloqueia o acesso mesmo com assinatura em
          dia. Não cancela a cobrança na Cakto — isso precisa ser feito lá.
        </p>
      </Card>
    </div>
  );
}
