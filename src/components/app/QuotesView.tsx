import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, FileText, Handshake } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  acceptProposal,
  closeQuote,
  getQuote,
  listQuotes,
  quoteStatusLabels,
  sendProposal,
  type QuoteStatus,
} from "@/lib/api/quotes.functions";
import { baseUnitShort } from "@/lib/catalog";
import { downloadCsv } from "@/lib/csv";
import { brl, dataHoraBR, num } from "@/lib/format";
import type { ItemAberto } from "@/hooks/useItemAberto";
import { cn } from "@/lib/utils";

const statusStyles: Record<QuoteStatus, string> = {
  aberto: "bg-warning/15 text-warning border-warning/30",
  respondido: "bg-primary/15 text-primary border-primary/30",
  negociando: "bg-primary/15 text-primary border-primary/30",
  aceito: "bg-success/15 text-success border-success/30",
  recusado: "bg-destructive/10 text-destructive border-destructive/30",
  cancelado: "bg-muted text-muted-foreground",
};

// O orçamento aberto vem da rota, e não de um estado daqui: é o que faz o
// gesto de voltar do celular fechar o orçamento em vez de sair da tela. Ver
// src/hooks/useItemAberto.ts.
export function QuotesView({
  emptyHint,
  aberto: selected,
  abrir,
  fechar,
}: { emptyHint: string } & ItemAberto) {
  const queryClient = useQueryClient();
  const [precos, setPrecos] = useState<Record<string, string>>({});
  const [prazo, setPrazo] = useState("");
  const [pagamento, setPagamento] = useState("");
  const [observacao, setObservacao] = useState("");

  const lista = useQuery({ queryKey: ["quotes"], queryFn: () => listQuotes() });
  const detalhe = useQuery({
    queryKey: ["quote", selected],
    queryFn: () => getQuote({ data: { id: selected as string } }),
    enabled: Boolean(selected),
  });

  // Pré-preenche com a última rodada: negociar é ajustar o que veio, não
  // digitar tudo de novo.
  useEffect(() => {
    if (!detalhe.data) return;
    const ultima = [...detalhe.data.proposals].reverse()[0];
    const inicial: Record<string, string> = {};
    for (const item of detalhe.data.items) {
      const anterior = ultima?.items.find((linha) => linha.requestItemId === item.id);
      inicial[item.id] = anterior ? String(anterior.unitPrice) : "";
    }
    setPrecos(inicial);
    setPrazo(ultima?.deliveryDays != null ? String(ultima.deliveryDays) : "");
    setPagamento(ultima?.paymentTerms || "");
    setObservacao("");
  }, [detalhe.data]);

  const atualizar = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["quotes"] }),
      queryClient.invalidateQueries({ queryKey: ["quote", selected] }),
    ]);
  };

  const enviar = useMutation({
    mutationFn: () => {
      const itens = (detalhe.data?.items || [])
        .map((item) => ({
          requestItemId: item.id,
          itemName: item.itemName,
          baseUnit: item.baseUnit,
          packSize: item.packSize ?? 1,
          quantity: item.quantity,
          unitPrice: Number((precos[item.id] || "").replace(",", ".")),
        }))
        .filter((item) => Number.isFinite(item.unitPrice) && item.unitPrice >= 0);
      if (itens.length !== (detalhe.data?.items.length || 0))
        throw new Error("Informe o preço de todos os itens");
      return sendProposal({
        data: {
          quoteId: selected as string,
          deliveryDays: prazo === "" ? null : Number(prazo),
          paymentTerms: pagamento || undefined,
          note: observacao || undefined,
          items: itens,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Proposta enviada");
      await atualizar();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const aceitar = useMutation({
    mutationFn: (proposalId: string) =>
      acceptProposal({ data: { quoteId: selected as string, proposalId } }),
    onSuccess: async () => {
      toast.success("Negócio fechado! O pedido já foi criado.");
      await atualizar();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const encerrar = useMutation({
    mutationFn: (status: "recusado" | "cancelado") =>
      closeQuote({ data: { id: selected as string, status } }),
    onSuccess: async () => {
      toast.success("Orçamento encerrado");
      await atualizar();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const quotes = lista.data?.quotes || [];
  const isMerchant = lista.data?.side === "comerciante";
  const dados = detalhe.data;
  const ultima = dados ? [...dados.proposals].reverse()[0] : undefined;
  const podeAceitar = ultima && !ultima.mine && ultima.status === "enviada";
  const encerrado =
    dados?.status === "aceito" || dados?.status === "recusado" || dados?.status === "cancelado";

  if (selected && dados)
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={fechar}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar para orçamentos
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{dados.counterpartName}</h1>
            <p className="text-muted-foreground text-sm">
              {dados.city ? `${dados.city}${dados.uf ? ` — ${dados.uf}` : ""}` : ""}
            </p>
          </div>
          <Badge className={statusStyles[dados.status]}>{quoteStatusLabels[dados.status]}</Badge>
        </div>

        <Card className="p-6">
          <h2 className="font-semibold">Itens pedidos</h2>
          <ul className="mt-3 divide-y text-sm">
            {dados.items.map((item) => (
              <li key={item.id} className="py-2 flex justify-between gap-4">
                <span>
                  {item.itemName}
                  {item.brand ? ` — ${item.brand}` : ""}
                </span>
                <span className="text-muted-foreground shrink-0">
                  {num(item.quantity, 3)} ×{" "}
                  {item.packSize ? `${num(item.packSize, 3)} ${baseUnitShort[item.baseUnit]}` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {dados.proposals.length > 0 && (
          <Card className="p-6">
            <h2 className="font-semibold">Histórico da negociação</h2>
            <div className="mt-4 space-y-3">
              {dados.proposals.map((proposta) => (
                <div
                  key={proposta.id}
                  className={cn(
                    "rounded-lg border p-4",
                    proposta.status === "aceita"
                      ? "border-success/40 bg-success/5"
                      : proposta.status === "superada"
                        ? "opacity-60"
                        : "border-primary/30 bg-primary/5",
                  )}
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="font-medium">
                      {proposta.mine ? "Você" : dados.counterpartName} ·{" "}
                      {proposta.kind === "proposta" ? "Proposta" : "Contraproposta"}
                    </p>
                    <p className="text-lg font-bold">{brl(proposta.total)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dataHoraBR(proposta.createdAt)}
                    {proposta.deliveryDays !== null
                      ? ` · entrega em ${proposta.deliveryDays} dia(s)`
                      : ""}
                    {proposta.paymentTerms ? ` · ${proposta.paymentTerms}` : ""}
                    {proposta.status === "superada" ? " · superada" : ""}
                    {proposta.status === "aceita" ? " · aceita" : ""}
                  </p>
                  {proposta.note && <p className="text-sm mt-2">{proposta.note}</p>}
                  <ul className="mt-2 text-xs text-muted-foreground">
                    {proposta.items.map((item, index) => (
                      <li key={index}>
                        {item.itemName}: {num(item.quantity, 3)} × {brl(item.unitPrice)} ={" "}
                        {brl(item.subtotal)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        )}

        {!encerrado && (
          <Card className="p-6">
            <h2 className="font-semibold">
              {isMerchant ? "Fazer uma contraproposta" : "Enviar proposta"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Informe o preço por embalagem de cada item.
            </p>

            <div className="mt-4 space-y-3">
              {dados.items.map((item) => (
                <div key={item.id} className="grid gap-2 sm:grid-cols-[1fr_10rem] items-end">
                  <div>
                    <p className="text-sm font-medium">{item.itemName}</p>
                    <p className="text-xs text-muted-foreground">
                      {num(item.quantity, 3)} embalagem(ns)
                      {item.packSize
                        ? ` de ${num(item.packSize, 3)} ${baseUnitShort[item.baseUnit]}`
                        : ""}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`preco-${item.id}`}>Preço unitário (R$)</Label>
                    <Input
                      id={`preco-${item.id}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={precos[item.id] || ""}
                      onChange={(event) =>
                        setPrecos((atual) => ({ ...atual, [item.id]: event.target.value }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="prazo">Prazo de entrega (dias)</Label>
                <Input
                  id="prazo"
                  type="number"
                  min={0}
                  value={prazo}
                  onChange={(event) => setPrazo(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pagamento">Condição de pagamento</Label>
                <Input
                  id="pagamento"
                  placeholder="Ex.: 30 dias no boleto"
                  value={pagamento}
                  onChange={(event) => setPagamento(event.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 space-y-1.5">
              <Label htmlFor="observacao">Observação</Label>
              <Textarea
                id="observacao"
                rows={2}
                value={observacao}
                onChange={(event) => setObservacao(event.target.value)}
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button disabled={enviar.isPending} onClick={() => enviar.mutate()}>
                {enviar.isPending
                  ? "Enviando..."
                  : isMerchant
                    ? "Enviar contraproposta"
                    : "Enviar proposta"}
              </Button>
              {podeAceitar && (
                <Button
                  variant="default"
                  className="bg-success hover:bg-success/90"
                  disabled={aceitar.isPending}
                  onClick={() => aceitar.mutate(ultima.id)}
                >
                  <Handshake className="h-4 w-4 mr-1" /> Aceitar {brl(ultima.total)} e gerar pedido
                </Button>
              )}
              <Button
                variant="outline"
                disabled={encerrar.isPending}
                onClick={() => encerrar.mutate(isMerchant ? "cancelado" : "recusado")}
              >
                {isMerchant ? "Cancelar orçamento" : "Recusar"}
              </Button>
            </div>
          </Card>
        )}
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Orçamentos</h1>
          <p className="text-muted-foreground mt-1">
            Peça condições, negocie e feche. Ao aceitar, o pedido é criado sozinho.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={!quotes.length}
          onClick={() =>
            downloadCsv(
              `orcamentos-${new Date().toISOString().slice(0, 10)}.csv`,
              [
                isMerchant ? "Fornecedor" : "Cliente",
                "Aberto em",
                "Itens",
                "Último valor",
                "Situação",
              ],
              quotes.map((quote) => [
                quote.counterpartName,
                dataHoraBR(quote.createdAt),
                quote.itens,
                quote.ultimoTotal,
                quoteStatusLabels[quote.status],
              ]),
            )
          }
        >
          <Download className="h-4 w-4 mr-1" /> Exportar
        </Button>
      </div>

      {!quotes.length ? (
        <Card className="p-8 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium mt-3">Nenhum orçamento ainda.</p>
          <p className="text-sm text-muted-foreground mt-1">{emptyHint}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {quotes.map((quote) => (
            <Card
              key={quote.id}
              className="p-5 flex flex-wrap items-center gap-4 cursor-pointer hover:bg-muted/40"
              onClick={() => abrir(quote.id)}
            >
              <div className="flex-1 min-w-[14rem]">
                <p className="font-medium">{quote.counterpartName}</p>
                <p className="text-xs text-muted-foreground">
                  {quote.itens} item(ns) · {dataHoraBR(quote.createdAt)}
                </p>
                {quote.note && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{quote.note}</p>
                )}
              </div>
              {quote.ultimoTotal !== null && (
                <p className="text-lg font-bold">{brl(quote.ultimoTotal)}</p>
              )}
              <div className="flex flex-col items-end gap-1">
                <Badge className={statusStyles[quote.status]}>
                  {quoteStatusLabels[quote.status]}
                </Badge>
                {quote.minhaVez && quote.status !== "aceito" && (
                  <span className="text-xs font-medium text-primary">Aguardando você</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
