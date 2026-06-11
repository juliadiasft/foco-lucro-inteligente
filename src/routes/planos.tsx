import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos e preços — Central do Comerciante" },
      { name: "description", content: "Planos a partir de R$ 49/mês. 14 dias grátis em todos os planos." },
    ],
  }),
  component: Planos,
});

const plans = [
  { name: "Essencial", price: "49", desc: "Para começar a organizar o lucro.", features: ["Até 500 produtos", "1 usuário", "Controle de estoque", "Comparação de fornecedores", "Relatórios essenciais"] },
  { name: "Profissional", price: "99", desc: "Para quem quer maximizar lucros com IA.", popular: true, features: ["Até 3.000 produtos", "5 usuários", "Consultor de Lucro IA", "Índice de Saúde do Lucro", "Oportunidades de lucro", "Exportação PDF/Excel"] },
  { name: "Premium", price: "149", desc: "Para operações maiores e mais complexas.", features: ["Produtos ilimitados", "Usuários ilimitados", "Suporte prioritário", "Integrações avançadas", "Onboarding dedicado", "Relatórios customizados"] },
];

function Planos() {
  return (
    <SiteLayout>
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Badge variant="secondary" className="mb-4">Planos</Badge>
          <h1 className="text-4xl md:text-5xl font-bold">Escolha o plano ideal para o seu comércio</h1>
          <p className="mt-4 text-muted-foreground text-lg">14 dias grátis em todos os planos. Sem cartão de crédito.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((p) => (
            <Card key={p.name} className={`p-7 relative ${p.popular ? "border-primary shadow-elegant bg-gradient-card" : ""}`}>
              {p.popular && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-hero text-primary-foreground">Mais popular</Badge>}
              <h3 className="font-display font-bold text-xl">{p.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{p.desc}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">R$ {p.price}</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <Button asChild className={`w-full mt-6 ${p.popular ? "bg-gradient-hero text-primary-foreground" : ""}`} variant={p.popular ? "default" : "outline"}>
                <Link to="/cadastro">Começar grátis</Link>
              </Button>
              <ul className="mt-6 space-y-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {f}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
}
