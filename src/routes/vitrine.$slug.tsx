import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Lock,
  MapPin,
  Package,
  ShoppingBasket,
  Star,
  Truck,
  Wallet,
} from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getPublicSupplier, type VitrinePublicaItem } from "@/lib/api/public-supplier.functions";

// A única página da Central que abre sem login.
//
// Carregada por loader, e não por useQuery, de propósito: o loader roda no
// servidor durante o SSR, então o nome do fornecedor e a lista de produtos
// chegam dentro do HTML. Com useQuery o Google receberia uma casca vazia e a
// página não valeria nada como porta de entrada — que é o motivo de ela
// existir.
export const Route = createFileRoute("/vitrine/$slug")({
  loader: async ({ params }) => {
    const fornecedor = await getPublicSupplier({ data: { slug: params.slug } });
    if (!fornecedor) throw notFound();
    return fornecedor;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Fornecedor — Central do Comerciante" }] };
    const onde = [loaderData.cidade, loaderData.uf].filter(Boolean).join(" - ");
    const titulo = onde
      ? `${loaderData.nome} — fornecedor em ${onde}`
      : `${loaderData.nome} — fornecedor`;
    // A descrição é o que aparece embaixo do link no Google. Vale mais dizer o
    // que ele vende e onde entrega do que repetir o nome.
    const descricao =
      loaderData.descricao?.slice(0, 155) ||
      `${loaderData.nome} atende o comércio${onde ? ` em ${onde}` : ""}` +
        `${loaderData.nichos ? ` no segmento de ${loaderData.nichos.toLowerCase()}` : ""}. ` +
        `${loaderData.totalItens} item(ns) no catálogo.`;
    return {
      meta: [
        { title: `${titulo} | Central do Comerciante` },
        { name: "description", content: descricao },
        { property: "og:title", content: titulo },
        { property: "og:description", content: descricao },
        { property: "og:type", content: "profile" },
      ],
    };
  },
  notFoundComponent: VitrineNaoEncontrada,
  component: VitrinePublica,
});

function VitrineNaoEncontrada() {
  return (
    <SiteLayout>
      <section className="container mx-auto px-4 py-24 max-w-xl text-center">
        <h1 className="text-3xl font-bold">Vitrine não encontrada</h1>
        <p className="mt-3 text-muted-foreground">
          Este fornecedor não está com a vitrine publicada, ou o endereço mudou.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Voltar ao início</Link>
        </Button>
      </section>
    </SiteLayout>
  );
}

/** Duas letras a partir do nome, para a marca d'água de identidade. */
function iniciais(nome: string) {
  const partes = nome
    .split(/\s+/)
    .filter((parte) => parte.length > 2)
    .slice(0, 2);
  return (partes.length ? partes : nome.split(/\s+/))
    .map((parte) => parte[0]?.toUpperCase() || "")
    .join("");
}

/** Agrupa o catálogo por categoria: lista longa sem divisão ninguém lê. */
function porCategoria(itens: VitrinePublicaItem[]) {
  const grupos = new Map<string, VitrinePublicaItem[]>();
  for (const item of itens) {
    const chave = item.categoria || "Outros produtos";
    const atual = grupos.get(chave);
    if (atual) atual.push(item);
    else grupos.set(chave, [item]);
  }
  return [...grupos.entries()];
}

function VitrinePublica() {
  const f = Route.useLoaderData();
  const onde = [f.cidade, f.uf].filter(Boolean).join(" - ");

  // As três coisas que o comerciante checa antes de qualquer outra: em quanto
  // tempo chega, quanto precisa comprar, e como paga. Ficam no topo, juntas.
  const decisao = [
    f.prazoEntrega !== null && {
      icone: Truck,
      rotulo: "Entrega em",
      valor: f.prazoEntrega === 0 ? "no mesmo dia" : `${f.prazoEntrega} dia(s) útil(eis)`,
    },
    f.pedidoMinimo !== null && {
      icone: Wallet,
      rotulo: "Pedido mínimo",
      valor: brl(f.pedidoMinimo),
    },
    f.condicoesPagamento && {
      icone: CreditCard,
      rotulo: "Pagamento",
      valor: f.condicoesPagamento,
    },
  ].filter(Boolean) as { icone: typeof Truck; rotulo: string; valor: string }[];

  // Só entram os sinais que existem de verdade. Um fornecedor novo mostra
  // menos coisas em vez de mostrar zeros que parecem má reputação.
  const sinais = [
    f.pedidosConcluidos > 0 && {
      icone: CheckCircle2,
      texto: `${f.pedidosConcluidos} pedido${f.pedidosConcluidos > 1 ? "s" : ""} concluído${f.pedidosConcluidos > 1 ? "s" : ""}`,
    },
    f.taxaResposta !== null && {
      icone: Package,
      texto: `responde ${f.taxaResposta.toFixed(0)}% dos orçamentos`,
    },
    f.avaliacoes > 0 &&
      f.nota !== null && {
        icone: Star,
        texto: `nota ${f.nota.toFixed(1)} em ${f.avaliacoes} avaliação(ões)`,
      },
  ].filter(Boolean) as { icone: typeof Star; texto: string }[];

  const grupos = porCategoria(f.itens);

  return (
    <SiteLayout>
      {/* Faixa de identidade. Antes a página começava com o nome solto no
          branco e demorava a parecer a página de uma empresa. */}
      <section className="border-b border-border bg-gradient-subtle">
        <div className="container mx-auto px-4 py-10 md:py-14 max-w-4xl">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div
              aria-hidden
              className="h-16 w-16 shrink-0 rounded-2xl bg-primary/10 text-primary grid place-items-center font-display text-xl font-bold"
            >
              {iniciais(f.nome)}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight">
                {f.nome}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                {onde && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {onde}
                  </span>
                )}
                <Badge variant="secondary">Fornecedor</Badge>
                {f.nichos && <Badge variant="outline">{f.nichos}</Badge>}
              </div>
            </div>
          </div>

          {f.descricao && (
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl">{f.descricao}</p>
          )}

          {/* A grade acompanha quantos fatos existem. Fixa em três, um
              fornecedor que não informou a forma de pagamento ficava com uma
              célula cinza vazia do lado, parecendo defeito. */}
          {decisao.length > 0 && (
            <div
              className={cn(
                "mt-7 grid gap-px overflow-hidden rounded-xl border border-border bg-border",
                decisao.length === 1 && "sm:grid-cols-1",
                decisao.length === 2 && "sm:grid-cols-2",
                decisao.length >= 3 && "sm:grid-cols-3",
              )}
            >
              {decisao.map((fato) => {
                const Icone = fato.icone;
                return (
                  <div key={fato.rotulo} className="bg-card p-4">
                    <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                      <Icone className="h-3.5 w-3.5" />
                      {fato.rotulo}
                    </p>
                    <p className="mt-1.5 font-semibold">{fato.valor}</p>
                  </div>
                );
              })}
            </div>
          )}

          {sinais.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {sinais.map((sinal) => {
                const Icone = sinal.icone;
                return (
                  <span key={sinal.texto} className="inline-flex items-center gap-1.5">
                    <Icone className="h-4 w-4 text-success" />
                    {sinal.texto}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="container mx-auto px-4 py-10 md:py-14 max-w-4xl">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-bold">O que este fornecedor carrega</h2>
          {f.totalItens > 0 && (
            <span className="text-sm text-muted-foreground">
              {f.totalItens} item(ns) no catálogo
            </span>
          )}
        </div>

        {grupos.length === 0 ? (
          <Card className="mt-5 p-8 text-center">
            <ShoppingBasket className="h-7 w-7 mx-auto text-muted-foreground" />
            <p className="mt-3 font-medium">O catálogo ainda não foi publicado.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie sua conta para falar direto com este fornecedor.
            </p>
          </Card>
        ) : (
          <div className="mt-6 space-y-7">
            {grupos.map(([categoria, itens]) => (
              <div key={categoria}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {categoria}
                </h3>
                <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
                  {itens.map((item, indice) => (
                    <li
                      key={`${item.nome}-${indice}`}
                      className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3 text-sm transition-colors hover:border-primary/40"
                    >
                      <ShoppingBasket className="h-4 w-4 shrink-0 mt-0.5 text-primary/70" />
                      <span className="min-w-0">
                        <span className="font-medium">{item.nome}</span>
                        {item.marca && (
                          <span className="block text-xs text-muted-foreground">{item.marca}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {f.totalItens > f.itens.length && (
              <p className="text-sm text-muted-foreground">
                E mais {f.totalItens - f.itens.length} item(ns) no catálogo completo.
              </p>
            )}
          </div>
        )}

        {/* O preço e o contato ficam atrás do cadastro. Não é obstáculo
            inventado: publicar a tabela do fornecedor entregaria o preço dele
            ao concorrente, e telefone em página aberta vira alvo de robô de
            spam em semanas. */}
        <Card className="mt-12 overflow-hidden border-primary/25 shadow-card">
          <div className="bg-primary/5 p-6 md:p-8">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Lock className="h-3.5 w-3.5" />
              Preços e contato
            </span>
            <h2 className="mt-4 font-display text-2xl md:text-3xl font-bold">
              Veja quanto {f.nome} cobra — e compare com os outros.
            </h2>
            <p className="mt-3 text-muted-foreground max-w-2xl">
              Preço e telefone ficam na área do comerciante, para proteger a tabela deste fornecedor
              de concorrente e o contato dele de robô de spam. Crie sua conta, veja o preço por
              quilo, litro ou unidade lado a lado com os outros fornecedores do seu nicho, e fale
              direto com quem vende mais barato.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/cadastro">
                  Criar conta e ver os preços
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/login">Já tenho conta</Link>
              </Button>
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-success" />7 dias grátis. Sem cartão de crédito.
            </p>
          </div>
        </Card>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-5">
          <div className="min-w-0">
            <p className="font-medium">É fornecedor e quer uma página como esta?</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Publique sua vitrine e seja encontrado pelos comerciantes do seu nicho.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/cadastro">Cadastrar minha empresa</Link>
          </Button>
        </div>
      </section>
    </SiteLayout>
  );
}
