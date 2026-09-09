import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  TrendingUp,
  Package,
  Users,
  Brain,
  AlertTriangle,
  BarChart3,
  Check,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  Quote,
  PiggyBank,
  Target,
} from "lucide-react";
import { EconomiaAnual } from "@/components/site/EconomiaAnual";
import { HeroPanel } from "@/components/site/HeroPanel";
import { Reveal } from "@/components/site/Reveal";
import { formatPlanPriceBRL, planPricesBRL } from "@/lib/plans";

// A mesma reacao ao mouse em todo cartao da pagina: sobe um pouco e ganha
// sombra. Repetir a classe em cada lugar acabaria com tres reacoes diferentes.
const reacaoCartao = "transition-all duration-300 hover:-translate-y-1 hover:shadow-elegant";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Central do Comerciante — Lucre mais no seu comércio" },
      {
        name: "description",
        content:
          "Plataforma inteligente que mostra onde você perde dinheiro e como aumentar o lucro do seu mercado, mercearia ou loja. Teste grátis 7 dias.",
      },
      { property: "og:title", content: "Central do Comerciante" },
      {
        property: "og:description",
        content:
          "O sistema inteligente que mostra onde o comerciante perde dinheiro e como lucrar mais.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <SiteLayout>
      <Hero />
      <Reveal>
        <DoisLados />
      </Reveal>
      <Reveal>
        <Benefits />
      </Reveal>
      <Reveal>
        <Features />
      </Reveal>
      <Reveal>
        <SupplierCompare />
      </Reveal>
      <Reveal>
        <AIAdvisor />
      </Reveal>
      <Reveal>
        <Pricing />
      </Reveal>
      <Reveal>
        <Testimonials />
      </Reveal>
      <Reveal>
        <FAQ />
      </Reveal>
      <Reveal>
        <FinalCTA />
      </Reveal>
    </SiteLayout>
  );
}

// A Central tem dois públicos que pagam. Sem esta seção, quem fornece lê a
// página inteira achando que o produto não é para ele.
function DoisLados() {
  const lados = [
    {
      titulo: "Para quem tem comércio",
      descricao:
        "Compare o preço dos fornecedores por quilo, litro ou unidade, veja sua margem real, controle o estoque e negocie sem sair da Central.",
      itens: [
        "Comparação de preços entre fornecedores",
        "Alertas de margem baixa e reposição",
        "Orçamento, negociação e pedido no mesmo lugar",
      ],
      chamada: "Quero comprar melhor",
    },
    {
      titulo: "Para quem fornece ao comércio",
      descricao:
        "Publique sua vitrine e seu catálogo e seja encontrado por comerciantes do seu nicho, em todo o país. Receba orçamentos e pedidos direto na plataforma.",
      itens: [
        "Vitrine para os comerciantes do seu nicho",
        "Catálogo com preço, prazo e pedido mínimo",
        "Orçamentos, propostas e pedidos sem intermediário",
      ],
      chamada: "Quero vender mais",
    },
  ];

  return (
    <section className="container mx-auto px-4 py-16 md:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl md:text-4xl font-bold">Os dois lados do balcão, no mesmo lugar</h2>
        <p className="mt-3 text-muted-foreground">
          Quem compra encontra o melhor preço. Quem vende encontra quem compra.
        </p>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {lados.map((lado) => (
          <Card
            key={lado.titulo}
            className={`group p-7 flex flex-col border-border ${reacaoCartao} hover:border-primary/40`}
          >
            <h3 className="text-xl font-bold transition-colors group-hover:text-primary">
              {lado.titulo}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">{lado.descricao}</p>
            <ul className="mt-5 flex-1 space-y-2.5 text-sm">
              {lado.itens.map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary transition-transform duration-300 group-hover:scale-110" />
                  {item}
                </li>
              ))}
            </ul>
            <Button
              asChild
              className="mt-6 transition-colors group-hover:border-primary group-hover:text-primary"
              variant="outline"
            >
              <Link to="/cadastro">{lado.chamada}</Link>
            </Button>
          </Card>
        ))}
      </div>
    </section>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-subtle">
      <div className="absolute inset-0 -z-10 opacity-30 [background-image:radial-gradient(circle_at_30%_20%,var(--color-primary-glow),transparent_50%)]" />
      <div className="container mx-auto px-4 py-16 md:py-24 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <Badge variant="secondary" className="mb-5 gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Onde o comércio e os fornecedores se encontram
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight">
            Descubra onde seu comércio está <span className="text-gradient">perdendo dinheiro</span>
            .
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl">
            A Central compara o preço dos fornecedores, mostra sua margem real e liga você direto a
            quem vende mais barato. <strong className="text-foreground">É fornecedor?</strong> Aqui
            você é encontrado por comerciantes do seu nicho — sem intermediário.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button
              asChild
              size="lg"
              className="bg-gradient-hero text-primary-foreground shadow-elegant hover:opacity-95"
            >
              <Link to="/cadastro">
                Teste Grátis por 7 Dias <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/planos">Ver planos</Link>
            </Button>
          </div>
          <div className="mt-6 flex items-center gap-5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-primary" /> Sem cartão de crédito
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-primary" /> Cancele quando quiser
            </span>
          </div>
        </div>

        <HeroPanel />
      </div>
    </section>
  );
}

function Benefits() {
  const items = [
    {
      icon: PiggyBank,
      t: "Lucre mais",
      d: "Descubra produtos e ações que aumentam sua margem em até 30%.",
    },
    {
      icon: AlertTriangle,
      t: "Pare de perder dinheiro",
      d: "Identifique estoque parado, ruptura e fornecedores caros.",
    },
    {
      icon: Zap,
      t: "Decisões em segundos",
      d: "Recomendações claras da IA para agir hoje, não no próximo mês.",
    },
  ];
  return (
    <section className="py-16 md:py-20 border-y border-border bg-background">
      <div className="container mx-auto px-4 grid md:grid-cols-3 gap-6">
        {items.map((i) => (
          <div
            key={i.t}
            className="group flex gap-4 rounded-xl p-2 -m-2 transition-colors hover:bg-primary/5"
          >
            <div className="h-12 w-12 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-105">
              <i.icon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{i.t}</h3>
              <p className="text-muted-foreground mt-1">{i.d}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: Package,
      t: "Controle de Estoque",
      d: "Cadastro, entradas, saídas, alertas de ruptura e produtos parados.",
    },
    {
      icon: Users,
      t: "Gestão de Fornecedores",
      d: "Cadastro, prazos, ranking e histórico de compras.",
    },
    {
      icon: BarChart3,
      t: "Análise de Lucro",
      d: "Lucro e margem por produto, categoria e período.",
    },
    {
      icon: Target,
      t: "Oportunidades de Lucro",
      d: "Painel exclusivo com economias possíveis e produtos a reajustar.",
    },
    {
      icon: ShieldCheck,
      t: "Índice de Saúde do Lucro",
      d: "Score 0–100 que mostra a saúde financeira do seu negócio.",
    },
    {
      icon: Brain,
      t: "Consultor de Lucro IA",
      d: "Recomendações automáticas baseadas no seu próprio negócio.",
    },
  ];
  return (
    <section id="recursos" className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <Badge variant="secondary" className="mb-4">
            Recursos
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold">
            Tudo o que você precisa para lucrar mais
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Não é mais um ERP. É um sistema feito para responder:{" "}
            <em>onde estou perdendo dinheiro?</em>
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <Card
              key={f.t}
              className={`group p-6 bg-gradient-card border-border ${reacaoCartao} hover:border-primary/40`}
            >
              <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-105">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg transition-colors group-hover:text-primary">
                {f.t}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function SupplierCompare() {
  return (
    <section className="py-20 md:py-28 bg-muted/40">
      <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <Badge variant="secondary" className="mb-4">
            Economia no ano
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold">
            Centavos por unidade viram milhares no fim do ano.
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Trocar de fornecedor parece detalhe quando a diferença é de sessenta centavos.
            Multiplique pelo que você compra por mês e a conta muda de tamanho.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "A diferença de preço, multiplicada pelo seu volume",
              "Projeção mensal e anual, produto a produto",
              "O catálogo inteiro recalculado todo dia",
            ].map((x) => (
              <li key={x} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary" /> {x}
              </li>
            ))}
          </ul>
        </div>
        <EconomiaAnual />
      </div>
    </section>
  );
}
function AIAdvisor() {
  const insights = [
    "Você pode economizar R$ 420 trocando de fornecedor no item Açúcar 1kg.",
    "Seu estoque de Arroz 5kg acaba em 5 dias.",
    "Detergente Neutro tem margem 18% abaixo da média da categoria.",
    "Capital parado estimado: R$ 2.300 em 14 produtos sem giro.",
    "Fornecedor X aumentou preços em 8% nos últimos 30 dias.",
  ];
  return (
    <section id="ia" className="py-20 md:py-28">
      <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
        <Card className="order-2 lg:order-1 p-6 bg-secondary text-secondary-foreground border-0 shadow-elegant">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-9 w-9 rounded-lg bg-primary/20 text-primary-glow flex items-center justify-center">
              <Brain className="h-5 w-5" />
            </div>
            <p className="font-semibold">Consultor de Lucro IA</p>
          </div>
          <div className="space-y-3">
            {insights.map((i, idx) => (
              <div
                key={idx}
                className="rounded-lg bg-white/5 border border-white/10 p-3 text-sm flex gap-3"
              >
                <Sparkles className="h-4 w-4 text-primary-glow shrink-0 mt-0.5" />
                <span>{i}</span>
              </div>
            ))}
          </div>
        </Card>
        <div className="order-1 lg:order-2">
          <Badge variant="secondary" className="mb-4">
            Inteligência Artificial
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold">
            Um consultor financeiro 24h analisando seu negócio.
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            A IA cruza estoque, custos, fornecedores e vendas para entregar recomendações práticas
            de aumento de lucro — em linguagem simples, todos os dias.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-7 bg-gradient-hero text-primary-foreground shadow-elegant"
          >
            <Link to="/cadastro">Quero experimentar grátis</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    {
      name: "Essencial",
      price: formatPlanPriceBRL(planPricesBRL.essencial),
      popular: false,
      features: [
        "Até 50 produtos",
        "1 usuário",
        "Custos, preços e margens",
        "Controle e alertas de estoque",
        "Fornecedores e relatórios essenciais",
      ],
    },
    {
      name: "Profissional",
      price: formatPlanPriceBRL(planPricesBRL.profissional),
      popular: true,
      features: [
        "Até 150 produtos",
        "Até 3 usuários",
        "Tudo do Essencial",
        "Consultor de Lucro com IA",
        "150 perguntas por mês",
        "Comparação de fornecedores",
      ],
    },
    {
      name: "Premium",
      price: formatPlanPriceBRL(planPricesBRL.premium),
      popular: false,
      features: [
        "Produtos ilimitados",
        "Até 5 usuários",
        "Tudo do Profissional",
        "300 perguntas por mês",
        "Suporte prioritário",
      ],
    },
  ];
  return (
    <section id="planos" className="py-20 md:py-28 bg-muted/40">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            Planos
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold">Planos simples, lucro garantido</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            7 dias grátis em qualquer plano. Sem cartão de crédito.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((p) => (
            <Card
              key={p.name}
              className={`group p-7 relative ${reacaoCartao} hover:border-primary/50 ${p.popular ? "border-primary shadow-elegant scale-[1.02] bg-gradient-card" : ""}`}
            >
              {p.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-hero text-primary-foreground">
                  Mais popular
                </Badge>
              )}
              <h3 className="font-display font-bold text-xl transition-colors group-hover:text-primary">
                {p.name}
              </h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold transition-colors group-hover:text-primary">
                  R$ {p.price}
                </span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <Button
                asChild
                className={`w-full mt-6 ${p.popular ? "bg-gradient-hero text-primary-foreground" : ""}`}
                variant={p.popular ? "default" : "outline"}
              >
                <Link to="/cadastro">Começar grátis</Link>
              </Button>
              <ul className="mt-6 space-y-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5 transition-transform duration-300 group-hover:scale-110" />{" "}
                    {f}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const items = [
    {
      name: "Carlos Mendes",
      role: "Mercado do Bairro — SP",
      text: "Em 2 meses economizei R$ 3.800 só trocando de fornecedor nos itens que a IA apontou.",
    },
    {
      name: "Joana Ribeiro",
      role: "Mercearia Boa Vista — MG",
      text: "Descobri que 18% do meu estoque estava parado. Hoje compro muito melhor.",
    },
    {
      name: "Rafael Souza",
      role: "Adega Central — RJ",
      text: "O índice de saúde do lucro me deu clareza que nenhum sistema tinha dado antes.",
    },
  ];
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            Comerciantes
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold">Negócios reais lucrando mais</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {items.map((t) => (
            <Card
              key={t.name}
              className={`group p-6 bg-gradient-card ${reacaoCartao} hover:border-primary/40`}
            >
              <Quote className="h-6 w-6 text-primary mb-3 transition-transform duration-300 group-hover:scale-110" />
              <p className="text-sm">{t.text}</p>
              <div className="mt-5 pt-5 border-t border-border">
                <p className="font-semibold transition-colors group-hover:text-primary">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const faqs = [
    {
      q: "A Central do Comerciante é um ERP?",
      a: "Não. É um sistema de otimização de lucro com IA, feito para mostrar onde você perde dinheiro e como lucrar mais.",
    },
    {
      q: "Como funciona o teste grátis?",
      a: "Você usa o plano Profissional por 7 dias sem precisar de cartão de crédito. Cancele a qualquer momento.",
    },
    {
      q: "Preciso ter conhecimento técnico?",
      a: "Não. A plataforma foi desenhada para donos de mercado, mercearia e adega sem experiência com tecnologia.",
    },
    {
      q: "Posso cadastrar mais de um fornecedor por produto?",
      a: "Sim. É justamente assim que a comparação de fornecedores funciona, mostrando a melhor compra.",
    },
    {
      q: "Meus dados estão seguros?",
      a: "Sim. Cada empresa tem acesso apenas aos seus próprios dados, com autenticação e criptografia.",
    },
  ];
  return (
    <section className="py-20 md:py-28 bg-muted/40">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-4">
            Perguntas frequentes
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold">Dúvidas comuns</h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <Card className="relative overflow-hidden bg-gradient-hero text-primary-foreground border-0 p-10 md:p-16 text-center shadow-elegant">
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_70%_30%,white,transparent_50%)]" />
          <div className="relative">
            <h2 className="text-3xl md:text-5xl font-bold">Comece a lucrar mais hoje.</h2>
            <p className="mt-4 opacity-90 max-w-xl mx-auto">
              7 dias grátis. Sem cartão. Sem complicação. Veja em minutos onde seu comércio pode
              ganhar mais dinheiro.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-7">
              <Link to="/cadastro">
                Teste Grátis por 7 Dias <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}
