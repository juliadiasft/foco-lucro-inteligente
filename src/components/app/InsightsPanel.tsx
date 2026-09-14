import { brl, num } from "@/lib/format";
import { cn } from "@/lib/utils";

type Insights = {
  total: number;
  mes: number;
  ticket: number;
  pedidosNovos: number;
  pedidosAndamento: number;
  pedidosConcluidos: number;
  evolucao: { rotulo: string; valor: number; pedidos: number }[];
  maiorDaSerie: number;
  topItens: { nome: string; quantidade: number; valor: number }[];
  topParceiros: { nome: string; pedidos: number; valor: number }[];
  financeiro: { aberto: number; vencido: number };
  orcamentosPendentes: number;
};

// O movimento de compras (comerciante) ou de vendas (fornecedor) na Central.
//
// Eram quatro cartões do mesmo tamanho — total, pedidos, ticket, a receber —
// empilhados um por tela no celular, e depois mais três cartões. Agora segue o
// Painel: um número em destaque (o do mês), o resto numa frase e numa faixa, e
// as listas com divisória em vez de caixa.
export function InsightsPanel({
  data,
  side,
}: {
  data: Insights | undefined;
  side: "comerciante" | "fornecedor";
}) {
  const comprando = side === "comerciante";

  // Sem nenhum pedido, nenhuma conta e nenhum orçamento, este painel virava uma
  // fileira de "R$ 0,00" — que ocupa o mesmo espaço de um número de verdade e
  // ensina a pessoa a ignorar a tela. Quando houver movimento, ele aparece.
  const semMovimento =
    !data ||
    (data.total === 0 &&
      data.mes === 0 &&
      data.pedidosNovos === 0 &&
      data.pedidosAndamento === 0 &&
      data.pedidosConcluidos === 0 &&
      data.orcamentosPendentes === 0 &&
      data.financeiro.aberto === 0 &&
      data.financeiro.vencido === 0);
  if (semMovimento || !data) return null;

  const mes = new Date().toLocaleDateString("pt-BR", { month: "long" });
  const vencido = data.financeiro.vencido > 0;

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {comprando ? "Comprado na Central em" : "Vendido na Central em"} {mes}
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{brl(data.mes)}</p>
        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
          {brl(data.total)} desde o início · ticket médio de {brl(data.ticket)}
        </p>
      </section>

      <div className="grid grid-cols-2 divide-x divide-border overflow-hidden rounded-lg border border-border">
        <div className="px-3 py-3">
          <p className="text-2xl font-semibold tabular-nums">{num(data.pedidosAndamento)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            pedido(s) em andamento · {num(data.pedidosConcluidos)} concluído(s)
          </p>
        </div>
        <div className="px-3 py-3">
          <p className="text-2xl font-semibold tabular-nums">{brl(data.financeiro.aberto)}</p>
          <p
            className={cn(
              "mt-0.5 text-xs",
              vencido ? "font-medium text-destructive" : "text-muted-foreground",
            )}
          >
            {comprando ? "a pagar" : "a receber"}
            {vencido ? ` · ${brl(data.financeiro.vencido)} vencido` : ""}
          </p>
        </div>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Últimos 6 meses
        </h2>
        <div className="mt-2 space-y-2">
          {data.evolucao.map((item) => {
            const largura = data.maiorDaSerie > 0 ? (item.valor / data.maiorDaSerie) * 100 : 0;
            return (
              <div key={item.rotulo} className="flex items-center gap-3 text-sm">
                <span className="w-14 shrink-0 text-xs text-muted-foreground tabular-nums">
                  {item.rotulo}
                </span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${Math.max(largura, item.valor > 0 ? 3 : 0)}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right tabular-nums">{brl(item.valor)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Ranking
          titulo={comprando ? "O que mais compra" : "O que mais vende"}
          linhas={data.topItens.map((item) => ({
            nome: item.nome,
            detalhe: `${num(item.quantidade)} embalagem(ns)`,
            valor: item.valor,
          }))}
        />
        <Ranking
          titulo={comprando ? "De quem mais compra" : "Quem mais compra de você"}
          linhas={data.topParceiros.map((parceiro) => ({
            nome: parceiro.nome,
            detalhe: `${num(parceiro.pedidos)} pedido(s)`,
            valor: parceiro.valor,
          }))}
        />
      </div>
    </div>
  );
}

function Ranking({
  titulo,
  linhas,
}: {
  titulo: string;
  linhas: { nome: string; detalhe: string; valor: number }[];
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h2>
      {!linhas.length ? (
        <p className="mt-1 text-sm text-muted-foreground">Nenhum pedido fechado ainda.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border border-y border-border text-sm">
          {linhas.map((linha) => (
            <li key={linha.nome} className="flex justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate font-medium">{linha.nome}</p>
                <p className="text-xs text-muted-foreground">{linha.detalhe}</p>
              </div>
              <span className="shrink-0 font-medium tabular-nums">{brl(linha.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
