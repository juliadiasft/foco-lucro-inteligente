import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Store, Truck } from "lucide-react";
import { useState } from "react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CycleToggle, PlanPrice } from "@/components/app/CycleToggle";
import { getBillingOptions } from "@/lib/api/billing.functions";
import { accountTypeLabels, type AccountType } from "@/lib/account";
import { planHighlights, planLabels, planOrder, planTagline, type BillingCycle } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos — Central do Comerciante" },
      {
        name: "description",
        content:
          "Planos da Central do Comerciante para quem compra. Para quem fornece, o cadastro é gratuito. Teste 7 dias grátis.",
      },
    ],
  }),
  component: Planos,
});

function Planos() {
  // Os dois lados veem telas diferentes porque pagam de formas diferentes: o
  // comerciante assina, o fornecedor entra de graça. Mostrar preço para quem
  // não paga afastaria justamente quem precisa entrar primeiro.
  const [accountType, setAccountType] = useState<AccountType>("comerciante");
  const [cycle, setCycle] = useState<BillingCycle>("mensal");
  const { data: opcoes } = useQuery({
    queryKey: ["billing-options"],
    queryFn: () => getBillingOptions(),
    staleTime: 60 * 60 * 1000,
  });

  const fornecedor = accountType === "fornecedor";

  return (
    <SiteLayout>
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <Badge variant="secondary" className="mb-4">
            {fornecedor ? "Cadastro gratuito" : "7 dias grátis"}
          </Badge>
          <h1 className="text-4xl font-bold md:text-5xl">
            {fornecedor ? "Para fornecer, é de graça." : "Um plano para cada fase do negócio"}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {fornecedor
              ? "Quem abastece o comércio não paga para estar aqui. Publique sua vitrine, seja encontrado e receba pedidos sem custo nenhum."
              : "Teste o plano Profissional sem cobrança. Depois, escolha o plano ideal e pague de forma recorrente pela Cakto."}
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
                  "flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all duration-200 active:scale-[0.98]",
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

        {fornecedor ? (
          <PlanoFornecedor />
        ) : (
          <>
            <div className="mb-10">
              <CycleToggle
                value={cycle}
                onChange={setCycle}
                anualDisponivel={Boolean(opcoes?.anualDisponivel.profissional)}
              />
            </div>
            <PlanosComerciante accountType={accountType} cycle={cycle} />
            <p className="mt-7 text-center text-xs text-muted-foreground">
              Sem cobrança no cadastro. Pagamento recorrente seguro pela Cakto.
            </p>
          </>
        )}
      </section>
    </SiteLayout>
  );
}

function PlanosComerciante({
  accountType,
  cycle,
}: {
  accountType: AccountType;
  cycle: BillingCycle;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {planOrder.map((plan) => {
        const featured = plan === "profissional";
        return (
          <Card
            key={plan}
            className={cn(
              "group relative flex flex-col p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-elegant",
              featured && "border-primary shadow-elegant",
            )}
          >
            {featured && <Badge className="absolute -top-3 left-6">Mais escolhido</Badge>}
            <h2 className="text-2xl font-bold transition-colors group-hover:text-primary">
              {planLabels[plan]}
            </h2>
            <p className="mt-1 min-h-10 text-sm text-muted-foreground">
              {planTagline[accountType][plan]}
            </p>
            <div className="mt-5">
              <PlanPrice plan={plan} cycle={cycle} />
            </div>
            <ul className="mt-6 flex-1 space-y-3 text-sm">
              {planHighlights[accountType][plan].map((feature) => (
                <li key={feature} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary transition-transform duration-300 group-hover:scale-110" />
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
  );
}

// O que o fornecedor recebe, e o que ele não recebe.
//
// Dizer só "é grátis" levanta a pergunta seguinte na cabeça de quem lê: e o
// que vocês ganham com isso? Deixar isso sem resposta faz a oferta parecer
// pegadinha. A resposta honesta é que ele é quem enche a prateleira, e a
// plataforma só vale para o comerciante quando a prateleira está cheia.
function PlanoFornecedor() {
  const inclui = [
    "Vitrine pública, encontrada pelo Google e por quem ainda não é cliente",
    "Catálogo com preço, embalagem, prazo e pedido mínimo",
    "Orçamentos e pedidos direto na plataforma, sem intermediário",
    "Aparece na busca dos comerciantes do seu nicho",
    "Conversa direta com quem quer comprar",
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="relative overflow-hidden border-primary/30 shadow-elegant">
        <div className="bg-primary/5 p-7 md:p-9">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-display text-5xl font-bold text-primary">R$ 0</span>
            <span className="text-muted-foreground">por mês, sem prazo para acabar</span>
          </div>
          <p className="mt-4 text-muted-foreground">
            Você não é nosso cliente — é o que faz a Central valer a pena. Cada fornecedor que entra
            melhora o sistema para o comerciante, e é ele quem paga a conta.
          </p>

          <ul className="mt-7 space-y-3 text-sm">
            {inclui.map((item) => (
              <li key={item} className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>

          <Button asChild size="lg" className="mt-8">
            <Link to="/cadastro">
              Cadastrar minha empresa <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="border-t border-border p-6 md:px-9">
          <p className="text-sm font-medium">Sem letra miúda</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Não pedimos cartão, não cobramos comissão sobre o que você vender e não ficamos no meio
            da sua negociação. Se um dia existir recurso pago para fornecedor, o que está aqui
            continua de graça.
          </p>
        </div>
      </Card>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        O cadastro pede o CNPJ da empresa que fornece. É como confirmamos que a vitrine é de quem
        vende para o comércio.
      </p>
    </div>
  );
}
