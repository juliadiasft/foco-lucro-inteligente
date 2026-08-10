import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, CreditCard } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getBillingStatus, openBillingPortal, startCheckout } from "@/lib/api/billing.functions";
import { dataBR } from "@/lib/format";
import { planPricesBRL } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/assinatura")({
  head: () => ({ meta: [{ title: "Assinatura — Central do Comerciante" }] }),
  component: SubscriptionPage,
});
const plans = [
  {
    id: "essencial" as const,
    name: "Essencial",
    price: planPricesBRL.essencial,
    features: ["1 usuário", "Até 50 produtos", "Sem Consultor de IA", "PDV, estoque e relatórios"],
  },
  {
    id: "profissional" as const,
    name: "Profissional",
    price: planPricesBRL.profissional,
    featured: true,
    features: [
      "Até 5 usuários",
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
      "Usuários ilimitados",
      "Produtos ilimitados",
      "1.000 perguntas à IA/mês",
      "Todos os recursos",
    ],
  },
];

function SubscriptionPage() {
  const { data } = useQuery({ queryKey: ["billing"], queryFn: () => getBillingStatus() });
  const checkout = useMutation({
    mutationFn: (plan: "essencial" | "profissional" | "premium") =>
      startCheckout({ data: { plan } }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const portal = useMutation({
    mutationFn: () => openBillingPortal(),
    onSuccess: ({ url }) => {
      window.location.href = url;
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
        {data?.hasCustomer && (
          <Button variant="outline" onClick={() => portal.mutate()}>
            <CreditCard className="h-4 w-4 mr-1" /> Gerenciar pagamento
          </Button>
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
                  : data?.status}
            </strong>
          </span>
          {data?.status === "trialing" && (
            <span className="text-sm text-muted-foreground">
              Teste até {dataBR(data.trialEndsAt)}
            </span>
          )}
          {data?.currentPeriodEnd && (
            <span className="text-sm text-muted-foreground">
              Próxima renovação: {dataBR(data.currentPeriodEnd)}
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
              R$ {plan.price}
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
        Cobrança segura. Cancele ou troque de plano pelo portal de assinatura.
      </p>
    </div>
  );
}
