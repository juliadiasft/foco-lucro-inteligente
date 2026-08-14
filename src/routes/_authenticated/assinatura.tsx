import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
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
import { cancelSubscription, getBillingStatus, startCheckout } from "@/lib/api/billing.functions";
import { dataBR } from "@/lib/format";
import { formatPlanPriceBRL, planPricesBRL } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/assinatura")({
  head: () => ({ meta: [{ title: "Assinatura — Central do Comerciante" }] }),
  component: SubscriptionPage,
});
const plans = [
  {
    id: "essencial" as const,
    name: "Essencial",
    price: planPricesBRL.essencial,
    features: [
      "1 usuário",
      "Até 50 produtos",
      "Custos, preços e margens",
      "Controle e alertas de estoque",
      "Fornecedores e relatórios essenciais",
    ],
  },
  {
    id: "profissional" as const,
    name: "Profissional",
    price: planPricesBRL.profissional,
    featured: true,
    features: [
      "Até 3 usuários",
      "Até 150 produtos",
      "150 perguntas à IA/mês",
      "Comparação de fornecedores",
    ],
  },
  {
    id: "premium" as const,
    name: "Premium",
    price: planPricesBRL.premium,
    features: [
      "Até 5 usuários",
      "Produtos ilimitados",
      "300 perguntas à IA/mês",
      "Todos os recursos",
    ],
  },
];

function SubscriptionPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["billing"], queryFn: () => getBillingStatus() });
  const checkout = useMutation({
    mutationFn: (plan: "essencial" | "profissional" | "premium") =>
      startCheckout({ data: { plan } }),
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
            <span className="text-sm text-muted-foreground">
              Teste até {dataBR(data.trialEndsAt)}
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
      <div className="grid md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`p-6 relative ${plan.featured ? "border-primary shadow-elegant" : ""}`}
          >
            {plan.featured && <Badge className="absolute -top-3 left-5">Mais escolhido</Badge>}
            <h2 className="text-xl font-bold">{plan.name}</h2>
            <p className="text-3xl font-bold mt-2">
              R$ {formatPlanPriceBRL(plan.price)}
              <span className="text-sm font-normal text-muted-foreground">/mês</span>
            </p>
            <ul className="space-y-2 mt-5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2 text-sm">
                  <Check className="h-4 w-4 text-success shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button
              className="w-full mt-6"
              variant={plan.featured ? "default" : "outline"}
              disabled={checkout.isPending || (data?.plan === plan.id && data.status === "active")}
              onClick={() => checkout.mutate(plan.id)}
            >
              {data?.plan === plan.id && data.status === "active"
                ? "Plano atual"
                : "Escolher plano"}
            </Button>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Pagamento recorrente processado com segurança pela Cakto. Seus dados não são apagados ao
        trocar ou cancelar um plano.
      </p>
    </div>
  );
}
