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
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  ClipboardList,
  Package,
  PiggyBank,
  ShoppingCart,
  Sparkles,
  Target,
  Truck,
} from "lucide-react";
import heroImg from "@/assets/hero-comerciante.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Central do Comerciante — Vendas, estoque e lucro sem complicação" },
      {
        name: "description",
        content:
          "Controle produtos, estoque e vendas e acompanhe o lucro do seu comércio em um painel simples.",
      },
      { property: "og:title", content: "Central do Comerciante" },
      {
        property: "og:description",
        content: "Vendas, estoque e lucro do seu comércio em um só lugar.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <SiteLayout>
      <Hero />
      <Benefits />
      <Features />
      <HowItWorks />
      <ProfitAssistant />
      <Pricing />
      <FAQ />
      <FinalCTA />
    </SiteLayout>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-subtle">
      <div className="absolute inset-0 -z-10 opacity-30 [background-image:radial-gradient(circle_at_30%_20%,var(--color-primary-glow),transparent_50%)]" />
      <div className="container mx-auto px-4 py-16 md:py-24 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <Badge variant="secondary" className="mb-5 gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Gestão simples para pequenos comércios
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight">
            Saiba o que vende, o que precisa repor e{" "}
            <span className="text-gradient">quanto realmente sobra</span>.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl">
            Registre produtos e vendas, acompanhe o estoque e veja faturamento, custo e lucro em um
            painel pensado para a rotina do comerciante.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button
              asChild
              size="lg"
              className="bg-gradient-hero text-primary-foreground shadow-elegant hover:opacity-95"
            >
              <Link to="/cadastro">
                Criar minha conta <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/" hash="recursos">
                Conhecer recursos
              </Link>
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-primary" /> Funciona no celular e computador
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-primary" /> Dados separados por empresa
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-hero opacity-20 blur-3xl rounded-full" />
          <img
            src={heroImg}
            alt="Comerciante acompanhando resultados do negócio"
            width={1536}
            height={1024}
            className="relative rounded-2xl shadow-elegant border border-border"
          />
          <Card className="absolute -bottom-6 -left-6 hidden md:flex items-center gap-3 px-4 py-3 shadow-card bg-gradient-card">
            <div className="h-10 w-10 rounded-lg bg-success/15 text-success flex items-center justify-center">
              <PiggyBank className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Visão do negócio</p>
              <p className="font-display font-bold">Venda, custo e lucro</p>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function Benefits() {
  const items = [
    {
      icon: ShoppingCart,
      title: "Venda com agilidade",
      text: "Use o PDV simples e dê baixa automática no estoque.",
    },
    {
      icon: AlertTriangle,
      title: "Evite falta de produto",
      text: "Receba alertas quando o saldo atingir o mínimo definido.",
    },
    {
      icon: PiggyBank,
      title: "Acompanhe o lucro",
      text: "Veja faturamento, custo e lucro calculados a partir das vendas.",
    },
  ];
  return (
    <section className="py-16 md:py-20 border-y border-border bg-background">
      <div className="container mx-auto px-4 grid md:grid-cols-3 gap-6">
        {items.map((item) => (
          <div key={item.title} className="flex gap-4">
            <div className="h-12 w-12 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <item.icon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{item.title}</h3>
              <p className="text-muted-foreground mt-1">{item.text}</p>
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
      title: "Produtos e margens",
      text: "Cadastre custo, preço, SKU, unidade e estoque mínimo.",
    },
    {
      icon: ShoppingCart,
      title: "PDV e vendas",
      text: "Registre itens, desconto, cliente e forma de pagamento.",
    },
    {
      icon: ClipboardList,
      title: "Movimentação de estoque",
      text: "Faça reposições e ajustes com histórico preservado.",
    },
    {
      icon: Truck,
      title: "Fornecedores e cotações",
      text: "Compare preços por produto e identifique a melhor opção de compra.",
    },
    {
      icon: Target,
      title: "Metas mensais",
      text: "Acompanhe o progresso do faturamento ao longo do mês.",
    },
    {
      icon: BarChart3,
      title: "Relatórios e saúde do negócio",
      text: "Veja margem, ticket, produtos mais rentáveis, alertas e um indicador de saúde.",
    },
  ];
  return (
    <section id="recursos" className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <Badge variant="secondary" className="mb-4">
            Recursos disponíveis
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold">O essencial para controlar a operação</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Sem excesso de telas e sem exigir conhecimento técnico.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="p-6 bg-gradient-card hover:shadow-elegant transition-shadow border-border"
            >
              <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{feature.text}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      number: "1",
      title: "Configure o negócio",
      text: "Informe sua atividade, meta mensal e ticket desejado.",
    },
    {
      number: "2",
      title: "Cadastre os produtos",
      text: "Adicione preço de custo, venda e saldo em estoque.",
    },
    {
      number: "3",
      title: "Registre as vendas",
      text: "O painel passa a mostrar estoque, faturamento e lucro.",
    },
  ];
  return (
    <section className="py-20 md:py-24 bg-muted/40">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto">
          <Badge variant="secondary" className="mb-4">
            Como funciona
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold">Comece em três passos</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5 mt-12">
          {steps.map((step) => (
            <Card key={step.number} className="p-6">
              <span className="inline-grid place-items-center h-9 w-9 rounded-full bg-primary text-primary-foreground font-bold">
                {step.number}
              </span>
              <h3 className="font-semibold text-lg mt-4">{step.title}</h3>
              <p className="text-muted-foreground mt-2">{step.text}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProfitAssistant() {
  const examples = [
    "Quais produtos devo reajustar primeiro para melhorar minha margem?",
    "O que devo comprar nesta semana considerando estoque e cotações?",
    "Como posso me aproximar da meta de faturamento deste mês?",
    "Quais produtos geraram mais lucro e quais estão parados?",
  ];
  return (
    <section id="assistente" className="py-20 md:py-28">
      <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
        <Card className="order-2 lg:order-1 p-6 bg-secondary text-secondary-foreground border-0 shadow-elegant">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-9 w-9 rounded-lg bg-primary/20 text-primary-glow flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="font-semibold">Perguntas que a IA pode responder</p>
          </div>
          <div className="space-y-3">
            {examples.map((example) => (
              <div
                key={example}
                className="rounded-lg bg-white/5 border border-white/10 p-3 text-sm flex gap-3"
              >
                <Sparkles className="h-4 w-4 text-primary-glow shrink-0 mt-0.5" />
                <span>{example}</span>
              </div>
            ))}
          </div>
        </Card>
        <div className="order-1 lg:order-2">
          <Badge variant="secondary" className="mb-4">
            Assistente de Lucro
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold">
            Uma IA que entende os números do seu negócio.
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Faça perguntas em linguagem simples. A IA cruza vendas, lucro, estoque, produtos, metas
            e cotações da sua empresa para sugerir ações práticas — sem receber senhas, cartões ou
            dados de outras empresas.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-7 bg-gradient-hero text-primary-foreground shadow-elegant"
          >
            <Link to="/cadastro">Começar agora</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    { name: "Essencial", price: 49, detail: "1 usuário · sem Consultor de IA" },
    {
      name: "Profissional",
      price: 99,
      detail: "5 usuários · 150 perguntas à IA/mês",
      featured: true,
    },
    { name: "Premium", price: 149, detail: "Usuários ilimitados · 1.000 perguntas à IA/mês" },
  ];
  return (
    <section id="planos" className="py-20 md:py-28 bg-muted/40">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-4">
            14 dias grátis
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold">Planos simples e transparentes</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Comece no Profissional sem cobrança e escolha o melhor plano depois.
          </p>
        </div>
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative p-7 ${plan.featured ? "border-primary shadow-elegant" : ""}`}
            >
              {plan.featured && <Badge className="absolute -top-3 left-6">Mais escolhido</Badge>}
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="mt-3 text-4xl font-bold">
                R$ {plan.price}
                <span className="text-sm font-normal text-muted-foreground">/mês</span>
              </p>
              <p className="mt-3 min-h-10 text-sm text-muted-foreground">{plan.detail}</p>
              <Button
                asChild
                className="mt-6 w-full"
                variant={plan.featured ? "default" : "outline"}
              >
                <Link to="/cadastro">Testar grátis</Link>
              </Button>
            </Card>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Button asChild variant="link">
            <Link to="/planos">Comparar todos os recursos</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const faqs = [
    {
      q: "A Central emite nota fiscal?",
      a: "Não. Ela controla internamente produtos, vendas, estoque e lucro. A emissão de NFC-e/NF-e deve continuar no sistema fiscal autorizado.",
    },
    {
      q: "Preciso entender de tecnologia?",
      a: "Não. O cadastro inicial orienta os primeiros passos e as telas foram pensadas para uso no celular e no computador.",
    },
    {
      q: "O estoque é atualizado na venda?",
      a: "Sim. Ao concluir uma venda no PDV, os itens são baixados automaticamente e o sistema impede vender acima do saldo disponível.",
    },
    {
      q: "Consigo corrigir ou repor o estoque?",
      a: "Sim. Em Produtos, use Gerenciar para adicionar uma reposição ou definir o saldo correto após uma contagem.",
    },
    {
      q: "Uma empresa vê os dados da outra?",
      a: "Não. As regras de acesso do banco separam produtos, vendas, fornecedores e configurações por empresa autenticada.",
    },
    {
      q: "Quais informações a IA recebe?",
      a: "Quando você usa o consultor, o servidor envia à OpenAI apenas o contexto operacional necessário, como totais de vendas e lucro, produtos, estoque, cotações e a pergunta. Senhas, cartões e dados de outras empresas não são enviados.",
    },
    {
      q: "Como funciona o teste grátis?",
      a: "A conta começa com 14 dias no plano Profissional, sem cobrança no cadastro. Para continuar depois do período, escolha um plano na área de assinatura.",
    },
  ];
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-4">
            Perguntas frequentes
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold">Dúvidas comuns</h2>
        </div>
        <Accordion type="single" collapsible>
          {faqs.map((faq, i) => (
            <AccordionItem key={faq.q} value={`item-${i}`}>
              <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
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
            <h2 className="text-3xl md:text-5xl font-bold">Tenha clareza sobre seu comércio.</h2>
            <p className="mt-4 opacity-90 max-w-xl mx-auto">
              Organize produtos, vendas e estoque e acompanhe o lucro sem depender de planilhas
              espalhadas.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-7">
              <Link to="/cadastro">
                Criar minha conta <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}
