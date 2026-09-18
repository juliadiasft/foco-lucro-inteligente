import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, FileText, Lock, Tag, TriangleAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  getPosicaoNaBusca,
  getRelatorioDoFornecedor,
} from "@/lib/api/supplier-desempenho.functions";
import { horasPorExtenso, pct, PESOS, type AcaoParaSubir } from "@/lib/desempenho-fornecedor";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/fornecedor/desempenho")({
  head: () => ({ meta: [{ title: "Posição e relatórios — Central do Comerciante" }] }),
  component: DesempenhoPage,
});

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesCurto = (aaaamm: string) => MESES[Number(aaaamm.slice(5, 7)) - 1];

const ICONE_DA_ACAO: Record<AcaoParaSubir["chave"], typeof FileText> = {
  responder_abertos: FileText,
  atualizar_precos: Tag,
  responder_rapido: Clock,
};

function DesempenhoPage() {
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-bold md:text-3xl">Posição e relatórios</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Como você aparece para os comerciantes da região e o que a Central vendeu por você.
        </p>
      </div>
      <Posicao />
      <Relatorio />
    </div>
  );
}

function Posicao() {
  const { data } = useQuery({ queryKey: ["posicao-na-busca"], queryFn: () => getPosicaoNaBusca() });
  if (!data) return <div className="h-40 animate-pulse rounded-lg bg-muted/40" />;

  const linhas = [
    {
      nome: "Taxa de resposta",
      peso: PESOS.resposta,
      valor: data.componentes.resposta,
      texto: data.componentes.resposta === null ? null : pct(data.componentes.resposta),
    },
    {
      nome: "Tempo até responder",
      peso: PESOS.tempo,
      valor: data.componentes.tempo,
      texto: data.sinais.medianaHoras === null ? null : horasPorExtenso(data.sinais.medianaHoras),
    },
    {
      nome: "Preços atualizados",
      peso: PESOS.precos,
      valor: data.componentes.precos,
      texto: data.componentes.precos === null ? null : pct(data.componentes.precos),
    },
  ];

  return (
    <section className="space-y-4">
      <Card className="p-5">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Sua posição hoje{data.regiao ? ` · ${data.regiao}` : ""}
        </p>
        {data.posicao ? (
          <p className="mt-2">
            <span className="text-5xl font-bold tabular-nums">{data.posicao.posicao}º</span>{" "}
            <span className="text-muted-foreground">
              de {data.posicao.total} {data.posicao.total === 1 ? "fornecedor" : "fornecedores"}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-muted-foreground">
            Ainda sem dados para posicionar você: cadastre preços no catálogo e responda o primeiro
            orçamento.
          </p>
        )}
        <p className="mt-4 flex items-start gap-2 border-t pt-3 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          Posição não se compra. Só sobe com resposta, prazo e preço em dia.
        </p>
      </Card>

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          O que pesa
        </p>
        <Card className="space-y-4 p-5">
          {linhas.map((l) => (
            <div key={l.nome}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium">
                  {l.nome}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    peso {Math.round(l.peso * 100)}%
                  </span>
                </p>
                <p className="font-semibold tabular-nums">{l.texto ?? "—"}</p>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full ${(l.valor ?? 0) >= 0.8 ? "bg-success" : "bg-warning"}`}
                  style={{ width: `${Math.round((l.valor ?? 0) * 100)}%` }}
                />
              </div>
              {l.texto === null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  ainda sem dados — não entra na sua posição
                </p>
              )}
            </div>
          ))}
        </Card>
      </div>

      {data.acoes.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            O que sobe mais rápido
          </p>
          <Card className="divide-y">
            {data.acoes.map((a) => {
              const Icone = ICONE_DA_ACAO[a.chave];
              const destino =
                a.chave === "atualizar_precos" ? "/fornecedor/catalogo" : "/fornecedor/orcamentos";
              return (
                <Link
                  key={a.chave}
                  to={destino}
                  className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/50"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted">
                    <Icone className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{a.titulo}</span>
                    <span className="text-sm text-muted-foreground">{a.detalhe}</span>
                  </span>
                  <span className="rounded-md bg-success/15 px-2 py-1 text-sm font-bold text-success tabular-nums">
                    +{a.pontos} pts
                  </span>
                </Link>
              );
            })}
          </Card>
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Por enquanto a posição mostra como você está em relação aos outros fornecedores da região; a
        busca do comerciante ainda ordena por preço.
      </p>
    </section>
  );
}

function Relatorio() {
  const { data } = useQuery({
    queryKey: ["relatorio-do-fornecedor"],
    queryFn: () => getRelatorioDoFornecedor(),
  });
  if (!data) return <div className="h-40 animate-pulse rounded-lg bg-muted/40" />;

  const atual = data.vendas.at(-1);
  const maior = Math.max(1, ...data.vendas.map((v) => v.total));
  const conversao = data.orcamentos.total
    ? Math.round((data.orcamentos.aceitos / data.orcamentos.total) * 100)
    : null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Relatórios</h2>

      <Card className="p-5">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Vendido pela Central
        </p>
        {atual ? (
          <>
            <p className="mt-2 text-4xl font-bold tabular-nums">{brl(atual.total)}</p>
            <p className="text-sm text-muted-foreground">
              {atual.pedidos} {atual.pedidos === 1 ? "pedido" : "pedidos"} no mês · ticket médio{" "}
              {brl(atual.total / atual.pedidos)}
            </p>
            <div className="mt-5 flex h-28 items-end gap-2">
              {data.vendas.map((v, i) => (
                <div key={v.mes} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-md ${i === data.vendas.length - 1 ? "bg-success" : "bg-muted"}`}
                    style={{ height: `${Math.max(6, (v.total / maior) * 96)}px` }}
                    title={brl(v.total)}
                  />
                  <span className="text-xs text-muted-foreground">{mesCurto(v.mes)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-2 text-muted-foreground">
            Ainda não há pedido aceito. Quando o primeiro for fechado pela Central, o valor aparece
            aqui.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Conversão</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            {conversao === null ? "—" : `${conversao}%`}
          </p>
          <p className="text-xs text-muted-foreground">
            {data.orcamentos.aceitos} de {data.orcamentos.total} orçamentos (90 dias)
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Recompra</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-success">
            {data.recompra.recorrentes}
          </p>
          <p className="text-xs text-muted-foreground">
            de {data.recompra.clientes} {data.recompra.clientes === 1 ? "cliente" : "clientes"}
          </p>
        </Card>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Pediram e você não tinha
        </p>
        {data.pediramENaoTinha.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">
            Nas buscas dos últimos 30 dias na sua região, nenhum item ficou sem resposta do seu
            catálogo.
          </Card>
        ) : (
          <Card className="divide-y">
            {data.pediramENaoTinha.map((p) => (
              <div key={p.termo} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold capitalize">{p.termo}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.buscas} {p.buscas === 1 ? "busca" : "buscas"} · {p.comerciantes}{" "}
                    {p.comerciantes === 1 ? "comerciante" : "comerciantes"}
                  </p>
                </div>
                <Link
                  to="/fornecedor/catalogo"
                  className="rounded-md bg-warning/15 px-3 py-1.5 text-sm font-semibold text-warning"
                >
                  Adicionar
                </Link>
              </div>
            ))}
          </Card>
        )}
      </div>
    </section>
  );
}
