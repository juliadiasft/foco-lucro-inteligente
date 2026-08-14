import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatPlanPriceBRL, planPricesBRL } from "@/lib/plans";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos — Central do Comerciante" },
      {
        name: "description",
        content: "Escolha um plano da Central do Comerciante e teste gratuitamente por 7 dias.",
      },
    ],
  }),
  component: Planos,
});

const plans = [
  {
    name: "Essencial",
    price: planPricesBRL.essencial,
    description: "Para quem administra o negócio sozinho.",
    features: [
      "1 usuário",
      "Até 50 produtos",
      "Sem Consultor de IA",
      "PDV, estoque, fornecedores e relatórios",
    ],
  },
  {
    name: "Profissional",
    price: planPricesBRL.profissional,
    description: "Para equipes pequenas que querem crescer.",
    featured: true,
    features: [
      "Até 3 usuários",
      "Até 150 produtos",
      "150 perguntas à IA por mês",
      "Comparação de cotações de fornecedores",
    ],
  },
  {
    name: "Premium",
    price: planPricesBRL.premium,
    description: "Para operações com mais volume e pessoas.",
    features: [
      "Até 5 usuários",
      "Produtos ilimitados",
      "300 perguntas à IA por mês",
      "Todos os recursos da plataforma",
    ],
  },
];

function Planos() {
  return (
    <SiteLayout>
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <Badge variant="secondary" className="mb-4">
            7 dias grátis
          </Badge>
          <h1 className="text-4xl font-bold md:text-5xl">Um plano para cada fase do negócio</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Teste o plano Profissional sem cobrança. Depois, escolha o plano ideal e pague de forma
            recorrente pela Cakto.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative flex flex-col p-7 ${plan.featured ? "border-primary shadow-elegant" : ""}`}
            >
              {plan.featured && <Badge className="absolute -top-3 left-6">Mais escolhido</Badge>}
              <h2 className="text-2xl font-bold">{plan.name}</h2>
              <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.description}</p>
              <p className="mt-5 text-4xl font-bold">
                R$ {formatPlanPriceBRL(plan.price)}
                <span className="text-sm font-normal text-muted-foreground">/mês</span>
              </p>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className="mt-7 w-full"
                variant={plan.featured ? "default" : "outline"}
              >
                <Link to="/cadastro">Testar por 7 dias</Link>
              </Button>
            </Card>
          ))}
        </div>

        <p className="mt-7 text-center text-xs text-muted-foreground">
          Sem cobrança no cadastro. Pagamento recorrente seguro pela Cakto.
        </p>
      </section>
    </SiteLayout>
  );
}
