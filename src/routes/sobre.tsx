import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, Heart, Sparkles } from "lucide-react";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre — Central do Comerciante" },
      {
        name: "description",
        content:
          "Conheça a missão da Central do Comerciante: ajudar pequenos comerciantes brasileiros a lucrar mais.",
      },
    ],
  }),
  component: Sobre,
});

function Sobre() {
  const valores = [
    {
      i: Target,
      t: "Foco no lucro",
      d: "Cada recurso existe para aumentar o lucro do comerciante.",
    },
    {
      i: Heart,
      t: "Feito para o pequeno",
      d: "Para mercados de bairro, mercearias, adegas e lojas de conveniência.",
    },
    {
      i: Sparkles,
      t: "Inteligência prática",
      d: "Análises automáticas, simples e acionáveis com os dados do negócio.",
    },
  ];
  return (
    <SiteLayout>
      <section className="container mx-auto px-4 py-16 md:py-24 max-w-4xl">
        <Badge variant="secondary" className="mb-4">
          Sobre nós
        </Badge>
        <h1 className="text-4xl md:text-5xl font-bold">
          Existimos para o pequeno comerciante <span className="text-gradient">lucrar mais</span>.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground">
          A Central do Comerciante nasceu da constatação de que mercados de bairro, mercearias e
          adegas perdem dinheiro todos os meses sem perceber: comprando pelo fornecedor errado, com
          estoque parado, com margens abaixo do ideal. Nosso papel é mostrar, com clareza, onde está
          esse dinheiro — e como recuperá-lo.
        </p>
        <p className="mt-4 text-lg text-muted-foreground">
          Não somos um ERP. Somos um consultor inteligente, disponível 24h, que analisa seu negócio
          continuamente e entrega recomendações práticas em português claro.
        </p>

        <div className="grid md:grid-cols-3 gap-5 mt-12">
          {valores.map((v) => (
            <Card key={v.t} className="p-6 bg-gradient-card">
              <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <v.i className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg">{v.t}</h3>
              <p className="text-sm text-muted-foreground mt-2">{v.d}</p>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button
            asChild
            size="lg"
            className="bg-gradient-hero text-primary-foreground shadow-elegant"
          >
            <Link to="/cadastro">Crie sua conta</Link>
          </Button>
        </div>
      </section>
    </SiteLayout>
  );
}
