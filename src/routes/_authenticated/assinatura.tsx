import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  cancelSubscription,
  getBillingOptions,
  getBillingStatus,
  startCheckout,
} from "@/lib/api/billing.functions";
import { CycleToggle, PlanPrice } from "@/components/app/CycleToggle";
import { dataBR } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { planHighlights, planLabels, planOrder, planTagline, type BillingCycle } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/assinatura")({
  head: () => ({ meta: [{ title: "Assinatura — Central do Comerciante" }] }),
  component: SubscriptionPage,
});
// A lista de recursos sai da mesma fonte usada na página pública, por tipo de
// conta: quem fornece não recebe o mesmo que quem compra.
const planIds = planOrder;

function SubscriptionPage() {
  const { user } = useAuth();
  const lado = user?.accountType === "fornecedor" ? "fornecedor" : "comerciante";
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["billing"], queryFn: () => getBillingStatus() });
  const { data: opcoes } = useQuery({
    queryKey: ["billing-options"],
    queryFn: () => getBillingOptions(),
    staleTime: 60 * 60 * 1000,
  });
  const [cycle, setCycle] = useState<BillingCycle>("mensal");
  const checkout = useMutation({
    mutationFn: (plan: "essencial" | "profissional" | "premium") =>
      startCheckout({ data: { plan, cycle } }),
    onSuccess: async ({ url, changed }) => {
      if (url) {
        window.location.href = url;
        return;
      }
      if (changed) toast.success("Plano alterado com sucesso");
      await queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const cancellation = useMutation({
    mutationFn: () => cancelSubscription(),
    onSuccess: async () => {
      toast.success("Assinatura cancelada. Seus dados continuam salvos.");
      await queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Plano e assinatura</h1>
          <p className="text-muted-foreground">Escolha o plano adequado ao tamanho do negócio.</p>
        </div>
        {data?.hasSubscription && data.status === "active" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">Cancelar assinatura</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar a assinatura?</AlertDialogTitle>
                <AlertDialogDescription>
                  As próximas cobranças serão interrompidas. Seus produtos, vendas, estoque e
                  relatórios continuarão salvos e o acesso pago será mantido até o fim do período
                  atual.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Manter assinatura</AlertDialogCancel>
                <AlertDialogAction
                  disabled={cancellation.isPending}
                  onClick={() => cancellation.mutate()}
                >
                  Confirmar cancelamento
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      {/* O aviso de bloqueio, quando o acesso caiu.
          Antes, quem era barrado numa tela do painel chegava aqui e via
          "Status: Teste grátis" com a data do vencimento em letra pequena, como
          se fosse rodapé. A pessoa não entendia que tinha sido bloqueada nem
          por quê, e a leitura natural era que o sistema tinha quebrado.
          Aqui o motivo vem primeiro, em cima, e junto com a única coisa que
          realmente importa saber nessa hora: os dados continuam lá. */}
      {data?.bloqueio && (
        <Card className="border-warning/40 bg-warning/5 p-5">
          <div className="flex gap-3">
            <Lock className="h-5 w-5 shrink-0 text-warning mt-0.5" />
            <div>
              <p className="font-semibold">
                {data.bloqueio === "teste_venceu"
                  ? `Seu teste grátis terminou em ${dataBR(data.trialEndsAt)}.`
                  : data.bloqueio === "suspensa"
                    ? "Sua conta está suspensa."
                    : "Sua assinatura venceu."}
              </p>
              <p className="text-sm text-muted-foreground mt-1.5">
                {data.bloqueio === "suspensa" ? (
                  <>
                    O acesso ao painel está bloqueado. Fale com a gente pelo{" "}
                    <a href="/contato" className="text-primary hover:underline">
                      contato
                    </a>{" "}
                    para resolver.
                  </>
                ) : (
                  <>
                    O painel fica bloqueado até você escolher um plano.{" "}
                    <strong className="text-foreground">
                      Nada do que você cadastrou foi apagado
                    </strong>{" "}
                    — seus produtos, fornecedores, preços e histórico continuam
                    guardados, e voltam exatamente como estavam assim que a
                    assinatura entrar.
                  </>
                )}
              </p>
              {data.bloqueio !== "suspensa" && (
                <p className="text-sm text-muted-foreground mt-2">
                  Escolha o plano abaixo para continuar de onde parou.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Badge>{data?.planLabel || "Carregando"}</Badge>
          <span className="text-sm">
            Status:{" "}
            <strong>
              {data?.status === "trialing"
                ? "Teste grátis"
                : data?.status === "active"
                  ? "Ativo"
                  : data?.status === "past_due"
                    ? "Pagamento pendente"
                    : data?.status === "canceled"
                      ? "Cancelado"
                      : data?.status}
            </strong>
          </span>
          {data?.status === "trialing" && (
            // "Teste até 11/08" continuava aparecendo em setembro, no presente,
            // como se ainda houvesse teste correndo. A data sozinha não diz se
            // já passou — quem lê rápido entende que está tudo certo.
            <span className="text-sm text-muted-foreground">
              {data.bloqueio === "teste_venceu"
                ? `Terminou em ${dataBR(data.trialEndsAt)}`
                : `Teste até ${dataBR(data.trialEndsAt)}`}
            </span>
          )}
          {data?.currentPeriodEnd && data.status === "active" && (
            <span className="text-sm text-muted-foreground">
              Próxima renovação: {dataBR(data.currentPeriodEnd)}
            </span>
          )}
          {data?.currentPeriodEnd && data.status === "canceled" && (
            <span className="text-sm text-muted-foreground">
              Acesso disponível até {dataBR(data.currentPeriodEnd)}
            </span>
          )}
        </div>
      </Card>
      <CycleToggle
        value={cycle}
        onChange={setCycle}
        anualDisponivel={Boolean(opcoes?.anualDisponivel.profissional)}
      />
      <div className="grid md:grid-cols-3 gap-4">
        {planIds.map((plan) => {
          const featured = plan === "profissional";
          const atual = data?.plan === plan && data.status === "active";
          return (
            <Card
              key={plan}
              className={`p-6 relative ${featured ? "border-primary shadow-elegant" : ""}`}
            >
              {featured && <Badge className="absolute -top-3 left-5">Mais escolhido</Badge>}
              <h2 className="text-xl font-bold">{planLabels[plan]}</h2>
              <p className="text-xs text-muted-foreground mt-1">{planTagline[lado][plan]}</p>
              <PlanPrice plan={plan} cycle={cycle} />
              <ul className="space-y-2 mt-5">
                {planHighlights[lado][plan].map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full mt-6"
                variant={featured ? "default" : "outline"}
                disabled={checkout.isPending || atual}
                onClick={() => checkout.mutate(plan)}
              >
                {atual ? "Plano atual" : "Escolher plano"}
              </Button>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        {cycle === "anual"
          ? "No plano anual você paga uma vez e fica doze meses sem se preocupar. "
          : ""}
        Pagamento recorrente processado com segurança pela Cakto. Seus dados não são apagados ao
        trocar ou cancelar um plano.
      </p>
    </div>
  );
}
