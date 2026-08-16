import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Store, Truck } from "lucide-react";
import { useState } from "react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { accountTypeLabels, type AccountType } from "@/lib/account";
import {
  formatPlanPriceBRL,
  planHighlights,
  planLabels,
  planOrder,
  planPricesBRL,
  planTagline,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos — Central do Comerciante" },
      {
        name: "description",
        content:
          "Planos da Central do Comerciante para quem compra e para quem fornece. Teste 7 dias grátis.",
      },
    ],
  }),
  component: Planos,
});

function Planos() {
  // Os preços são os mesmos para os dois lados, mas o que cada um recebe é
  // diferente. Mostrar as duas listas juntas confundiria quem está decidindo.
  const [accountType, setAccountType] = useState<AccountType>("comerciante");

  return (
    <SiteLayout>
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <Badge variant="secondary" className="mb-4">
            7 dias grátis
          </Badge>
          <h1 className="text-4xl font-bold md:text-5xl">Um plano para cada fase do negócio</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Teste o plano Profissional sem cobrança. Depois, escolha o plano ideal e pague de forma
            recorrente pela Cakto.
          </p>
        </div>

        <div className="mx-auto mb-10 grid max-w-md grid-cols-2 gap-2">
          {(["comerciante", "fornecedor"] as const).map((type) => {
            const Icon = type === "comerciante" ? Store : Truck;
            const selected = accountType === type;
            return (
              <button
                key={type}
                type="button"
                aria-pressed={selected}
                onClick={() => setAccountType(type)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/60",
                )}
              >
                <Icon className="h-4 w-4" />
                Sou {accountTypeLabels[type].toLowerCase()}
              </button>
            );
          })}
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {planOrder.map((plan) => {
            const featured = plan === "profissional";
            return (
              <Card
                key={plan}
                className={cn(
                  "relative flex flex-col p-7",
                  featured && "border-primary shadow-elegant",
                )}
              >
                {featured && <Badge className="absolute -top-3 left-6">Mais escolhido</Badge>}
                <h2 className="text-2xl font-bold">{planLabels[plan]}</h2>
                <p className="mt-1 min-h-10 text-sm text-muted-foreground">
                  {planTagline[accountType][plan]}
                </p>
                <p className="mt-5 text-4xl font-bold">
                  R$ {formatPlanPriceBRL(planPricesBRL[plan])}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {planHighlights[accountType][plan].map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-7 w-full" variant={featured ? "default" : "outline"}>
                  <Link to="/cadastro">Testar por 7 dias</Link>
                </Button>
              </Card>
            );
          })}
        </div>

        <p className="mt-7 text-center text-xs text-muted-foreground">
          Sem cobrança no cadastro. Pagamento recorrente seguro pela Cakto.
        </p>
      </section>
    </SiteLayout>
  );
}
