import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Heart, Sparkles, Store, Target, Truck } from "lucide-react";

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

        <DoisPublicos />

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

// A Central atende dois públicos com contratos diferentes: um paga, o outro
// não. Sem dizer isso em algum lugar, o fornecedor lê a página inteira achando
// que vai ser cobrado, e o comerciante não entende por que a prateleira existe.
function DoisPublicos() {
  const publicos = [
    {
      icone: Store,
      titulo: "Se você tem um comércio",
      resumo: "Você assina. É de você que a Central vive, e é para você que ela trabalha todo dia.",
      itens: [
        "Compare o preço dos fornecedores por quilo, litro ou unidade",
        "Veja sua margem real, produto a produto",
        "Receba aviso quando alguém baixar o preço do que você compra",
        "Negocie, peça orçamento e feche pedido sem sair daqui",
      ],
      nota: "7 dias grátis, sem cartão de crédito.",
    },
    {
      icone: Truck,
      titulo: "Se você fornece ao comércio",
      resumo: "Você não paga nada. Você é o que faz a Central valer a pena para quem compra.",
      itens: [
        "Vitrine pública, que o Google encontra e você compartilha",
        "Catálogo com preço, embalagem, prazo e pedido mínimo",
        "Aparece na busca dos comerciantes do seu nicho",
        "Orçamentos e pedidos diretos, sem comissão sobre a venda",
      ],
      nota: "Cadastro gratuito, sem prazo para acabar.",
    },
  ];

  return (
    <div className="mt-16">
      <h2 className="text-2xl md:text-3xl font-bold">Os dois lados, e o que cada um paga</h2>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {publicos.map((publico) => (
          <Card
            key={publico.titulo}
            className="group p-7 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-elegant hover:border-primary/40"
          >
            <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
              <publico.icone className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-xl font-bold transition-colors group-hover:text-primary">
              {publico.titulo}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">{publico.resumo}</p>
            <ul className="mt-5 flex-1 space-y-2.5 text-sm">
              {publico.itens.map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-5 pt-4 border-t border-border text-sm font-medium text-primary">
              {publico.nota}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
