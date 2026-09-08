import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CheckCircle2, Clock, Lock, MapPin, Package, ShoppingBasket, Star } from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { brl } from "@/lib/format";
import { getPublicSupplier } from "@/lib/api/public-supplier.functions";

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

function VitrinePublica() {
  const f = Route.useLoaderData();
  const onde = [f.cidade, f.uf].filter(Boolean).join(" - ");

  // Só entram os sinais que existem de verdade. Um fornecedor novo mostra
  // menos coisas em vez de mostrar zeros que parecem má reputação.
  const sinais = [
    f.pedidosConcluidos > 0 && {
      icone: CheckCircle2,
      valor: String(f.pedidosConcluidos),
      rotulo: f.pedidosConcluidos === 1 ? "pedido concluído" : "pedidos concluídos",
    },
    f.taxaResposta !== null && {
      icone: Clock,
      valor: `${f.taxaResposta.toFixed(0)}%`,
      rotulo: "dos orçamentos respondidos",
    },
    f.avaliacoes > 0 &&
      f.nota !== null && {
        icone: Star,
        valor: f.nota.toFixed(1),
        rotulo: `de ${f.avaliacoes} avaliação(ões)`,
      },
    f.totalItens > 0 && {
      icone: Package,
      valor: String(f.totalItens),
      rotulo: f.totalItens === 1 ? "item no catálogo" : "itens no catálogo",
    },
  ].filter(Boolean) as { icone: typeof Package; valor: string; rotulo: string }[];

  return (
    <SiteLayout>
      <section className="container mx-auto px-4 py-12 md:py-16 max-w-4xl">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Fornecedor</Badge>
          {f.nichos && <Badge variant="outline">{f.nichos}</Badge>}
        </div>

        <h1 className="mt-4 text-3xl md:text-4xl font-bold">{f.nome}</h1>

        {onde && (
          <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            {onde}
          </p>
        )}

        {f.descricao && <p className="mt-6 text-lg text-muted-foreground">{f.descricao}</p>}

        {sinais.length > 0 && (
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {sinais.map((s) => {
              const Icone = s.icone;
              return (
                <Card key={s.rotulo} className="p-4">
                  <Icone className="h-4 w-4 text-primary" />
                  <p className="mt-2 text-2xl font-bold leading-none">{s.valor}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.rotulo}</p>
                </Card>
              );
            })}
          </div>
        )}

        {(f.prazoEntrega !== null || f.pedidoMinimo !== null || f.condicoesPagamento) && (
          <Card className="mt-6 p-5">
            <h2 className="font-semibold">Como este fornecedor trabalha</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
              {f.prazoEntrega !== null && (
                <div>
                  <dt className="text-muted-foreground">Prazo de entrega</dt>
                  <dd className="font-medium">
                    {f.prazoEntrega === 0 ? "No mesmo dia" : `${f.prazoEntrega} dia(s) útil(eis)`}
                  </dd>
                </div>
              )}
              {f.pedidoMinimo !== null && (
                <div>
                  <dt className="text-muted-foreground">Pedido mínimo</dt>
                  <dd className="font-medium">{brl(f.pedidoMinimo)}</dd>
                </div>
              )}
              {f.condicoesPagamento && (
                <div>
                  <dt className="text-muted-foreground">Pagamento</dt>
                  <dd className="font-medium">{f.condicoesPagamento}</dd>
                </div>
              )}
            </dl>
          </Card>
        )}

        <h2 className="mt-10 text-xl font-semibold">O que este fornecedor carrega</h2>
        {f.itens.length === 0 ? (
          <p className="mt-2 text-muted-foreground">
            O catálogo ainda não foi publicado. Cadastre-se para falar direto com o fornecedor.
          </p>
        ) : (
          <>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {f.itens.map((item, indice) => (
                <li
                  key={`${item.nome}-${indice}`}
                  className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm"
                >
                  <ShoppingBasket className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="font-medium">{item.nome}</span>
                    {item.marca && <span className="text-muted-foreground"> · {item.marca}</span>}
                    {item.categoria && (
                      <span className="block text-xs text-muted-foreground">{item.categoria}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {f.totalItens > f.itens.length && (
              <p className="mt-3 text-sm text-muted-foreground">
                E mais {f.totalItens - f.itens.length} item(ns) no catálogo completo.
              </p>
            )}
          </>
        )}

        {/* O preço e o contato ficam atrás do cadastro. Não é obstáculo
            inventado: publicar a tabela do fornecedor entregaria o preço dele
            ao concorrente, e telefone em página aberta vira alvo de robô de
            spam em semanas. */}
        <Card className="mt-10 p-6 bg-primary/5 border-primary/20">
          <Lock className="h-5 w-5 text-primary" />
          <h2 className="mt-3 text-xl font-semibold">Quer os preços e o contato?</h2>
          <p className="mt-2 text-muted-foreground">
            Preço e telefone deste fornecedor ficam na área do comerciante — para proteger a tabela
            dele de concorrente e o contato dele de robô de spam. Crie sua conta e veja quanto ele
            cobra, compare com os outros fornecedores do seu nicho e fale direto com ele.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/cadastro">Criar conta e ver os preços</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/login">Já tenho conta</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            7 dias grátis. Sem cartão de crédito.
          </p>
        </Card>

        <Card className="mt-6 p-6">
          <h2 className="font-semibold">É fornecedor e quer uma página como esta?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Publique sua vitrine na Central e seja encontrado pelos comerciantes do seu nicho.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/cadastro">Cadastrar minha empresa</Link>
          </Button>
        </Card>
      </section>
    </SiteLayout>
  );
}
