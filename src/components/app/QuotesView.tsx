import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, Download, FileText, Handshake } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
import { brl, dataHoraBR, diaBR, horaBR, num, quandoNaLista } from "@/lib/format";
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
//
// A tela abre com a decisão, e não com o formulário.
//
// Antes, quem recebia uma proposta de R$ 310,00 via primeiro o cartão de itens,
// depois o histórico, depois um formulário de preços — e só no fim dele o botão
// de aceitar, fora da primeira tela. Pior: o comerciante que tinha ACABADO de
// pedir preço já era recebido por "Fazer uma contraproposta", como se coubesse
// a ele precificar o que veio pedir.
export function QuotesView({
  emptyHint,
  aberto: selected,
  abrir,
  fechar,
}: { emptyHint: string } & ItemAberto) {
  const queryClient = useQueryClient();
  const [folha, setFolha] = useState(false);
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
      setFolha(false);
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
  const podeAceitar = Boolean(ultima && !ultima.mine && ultima.status === "enviada");
  const encerrado =
    dados?.status === "aceito" || dados?.status === "recusado" || dados?.status === "cancelado";
  // Quem mandou a última palavra está esperando. Sem nenhuma proposta ainda,
  // quem espera é o comerciante: pedir preço é o que ele acabou de fazer.
  const esperando = !encerrado && (ultima ? Boolean(ultima.mine) : isMerchant);

  if (selected && dados)
    return (
      <div className="max-w-3xl space-y-5">
        <div className="flex items-start gap-1">
          <Button variant="ghost" size="icon" aria-label="Voltar" onClick={fechar}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            {/* Sem truncate: "Distribuidora Pet Brasil" virava
                "Distribuidor..." ao dividir a linha com a etiqueta. */}
            <h1 className="text-xl font-bold leading-tight">{dados.counterpartName}</h1>
            <p className="text-xs text-muted-foreground">
              {dados.city ? `${dados.city}${dados.uf ? ` — ${dados.uf}` : ""}` : ""}
            </p>
          </div>
          <Badge className={cn("shrink-0", statusStyles[dados.status])}>
            {quoteStatusLabels[dados.status]}
          </Badge>
        </div>

        {/* O que fazer agora, antes de qualquer outra coisa. */}
        {encerrado ? (
          <section
            className={cn(
              "rounded-lg border p-4",
              dados.status === "aceito"
                ? "border-success/40 bg-success/5"
                : "border-border bg-muted/30",
            )}
          >
            <p className="font-semibold">
              {dados.status === "aceito"
                ? `Fechado por ${brl(ultima?.total)}`
                : dados.status === "recusado"
                  ? "Orçamento recusado"
                  : "Orçamento cancelado"}
            </p>
            {dados.status === "aceito" && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                O pedido foi criado e está em Pedidos.
              </p>
            )}
          </section>
        ) : podeAceitar ? (
          <section className="rounded-lg border border-success/40 bg-success/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {ultima?.kind === "proposta" ? "Proposta" : "Contraproposta"} de{" "}
              {dados.counterpartName}
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{brl(ultima?.total)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {ultima?.deliveryDays !== null && ultima?.deliveryDays !== undefined
                ? `Entrega em ${ultima.deliveryDays} dia(s)`
                : "Prazo não informado"}
              {ultima?.paymentTerms ? ` · ${ultima.paymentTerms}` : ""}
            </p>
            {ultima?.note && <p className="mt-2 text-sm">{ultima.note}</p>}

            <div className="mt-4 space-y-2">
              <Button
                size="lg"
                className="w-full bg-success hover:bg-success/90"
                disabled={aceitar.isPending || !ultima}
                onClick={() => ultima && aceitar.mutate(ultima.id)}
              >
                <Handshake className="mr-1.5 h-4 w-4" />
                Aceitar e gerar pedido
              </Button>
              <Button size="lg" variant="outline" className="w-full" onClick={() => setFolha(true)}>
                Fazer contraproposta
              </Button>
            </div>
          </section>
        ) : esperando ? (
          <section className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-semibold">Aguardando {dados.counterpartName}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {ultima
                  ? `Sua ${ultima.kind === "proposta" ? "proposta" : "contraproposta"} de ${brl(ultima.total)} foi enviada ${diaBR(ultima.createdAt).toLowerCase()} às ${horaBR(ultima.createdAt)}.`
                  : "O pedido de orçamento já chegou. Assim que o preço for enviado, ele aparece aqui."}
              </p>
            </div>
          </section>
        ) : (
          <section className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="font-semibold">Sua vez: mande o preço</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {dados.counterpartName} pediu orçamento de {dados.items.length} item(ns).
            </p>
            <Button size="lg" className="mt-4 w-full" onClick={() => setFolha(true)}>
              Enviar proposta
            </Button>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Itens pedidos
          </h2>
          <ul className="mt-2 divide-y divide-border border-y border-border text-sm">
            {dados.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-2.5">
                <span className="min-w-0">
                  {item.itemName}
                  {item.brand ? ` — ${item.brand}` : ""}
                </span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {num(item.quantity)} ×{" "}
                  {item.packSize ? `${num(item.packSize, 3)} ${baseUnitShort[item.baseUnit]}` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {dados.proposals.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Rodadas da negociação
            </h2>
            <ul className="mt-2 divide-y divide-border border-y border-border">
              {[...dados.proposals].reverse().map((proposta) => (
                <li key={proposta.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium">
                      {proposta.mine ? "Você" : dados.counterpartName}
                      {proposta.status === "aceita" && (
                        <span className="ml-1.5 text-xs font-semibold text-success"> · aceita</span>
                      )}
                    </p>
                    <p
                      className={cn(
                        "font-semibold tabular-nums",
                        proposta.status === "superada" && "text-muted-foreground line-through",
                      )}
                    >
                      {brl(proposta.total)}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {diaBR(proposta.createdAt)} às {horaBR(proposta.createdAt)}
                    {proposta.deliveryDays !== null ? ` · ${proposta.deliveryDays} dia(s)` : ""}
                    {proposta.paymentTerms ? ` · ${proposta.paymentTerms}` : ""}
                  </p>
                  {proposta.note && <p className="mt-1 text-sm">{proposta.note}</p>}
                  <ul className="mt-1 text-xs text-muted-foreground">
                    {proposta.items.map((item, index) => (
                      <li key={index} className="tabular-nums">
                        {item.itemName}: {num(item.quantity)} × {brl(item.unitPrice)} ={" "}
                        {brl(item.subtotal)}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!encerrado && (
          <Button
            variant="ghost"
            className="text-muted-foreground"
            disabled={encerrar.isPending}
            onClick={() => encerrar.mutate(isMerchant ? "cancelado" : "recusado")}
          >
            {isMerchant ? "Cancelar orçamento" : "Recusar orçamento"}
          </Button>
        )}

        {/* O formulário de preços mora numa folha: ele é o passo de quem vai
            responder, e não a primeira coisa que se vê ao abrir. */}
        <Drawer open={folha} onOpenChange={(estado) => !estado && setFolha(false)}>
          <DrawerContent className="max-h-[92vh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>{podeAceitar ? "Fazer contraproposta" : "Enviar proposta"}</DrawerTitle>
              <DrawerDescription>
                {isMerchant
                  ? "Diga quanto você pagaria por embalagem de cada item."
                  : "Informe o preço por embalagem de cada item."}
              </DrawerDescription>
            </DrawerHeader>

            <div className="space-y-4 overflow-y-auto px-4">
              {dados.items.map((item) => (
                <div key={item.id}>
                  <Label htmlFor={`preco-${item.id}`}>{item.itemName}</Label>
                  <p className="text-xs text-muted-foreground">
                    {num(item.quantity)} embalagem(ns)
                    {item.packSize
                      ? ` de ${num(item.packSize, 3)} ${baseUnitShort[item.baseUnit]}`
                      : ""}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">R$</span>
                    <Input
                      id={`preco-${item.id}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      className="h-11 tabular-nums"
                      placeholder="0,00"
                      value={precos[item.id] || ""}
                      onChange={(event) =>
                        setPrecos((atual) => ({ ...atual, [item.id]: event.target.value }))
                      }
                    />
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      ={" "}
                      {brl(
                        (Number((precos[item.id] || "0").replace(",", ".")) || 0) * item.quantity,
                      )}
                    </span>
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="prazo">Entrega (dias)</Label>
                  <Input
                    id="prazo"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className="h-11"
                    value={prazo}
                    onChange={(event) => setPrazo(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pagamento">Pagamento</Label>
                  <Input
                    id="pagamento"
                    className="h-11"
                    placeholder="30 dias no boleto"
                    value={pagamento}
                    onChange={(event) => setPagamento(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="observacao">Observação (opcional)</Label>
                <Textarea
                  id="observacao"
                  rows={2}
                  placeholder="Ex.: frete incluso acima de R$ 400,00"
                  value={observacao}
                  onChange={(event) => setObservacao(event.target.value)}
                />
              </div>
            </div>

            <DrawerFooter>
              <Button size="lg" disabled={enviar.isPending} onClick={() => enviar.mutate()}>
                {enviar.isPending
                  ? "Enviando..."
                  : `Enviar ${brl(
                      dados.items.reduce(
                        (soma, item) =>
                          soma +
                          (Number((precos[item.id] || "0").replace(",", ".")) || 0) * item.quantity,
                        0,
                      ),
                    )}`}
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    );

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold md:text-3xl">Orçamentos</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Peça condições, negocie e feche. Ao aceitar, o pedido é criado sozinho.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
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
          <Download className="mr-1 h-4 w-4" /> Exportar
        </Button>
      </div>

      {!quotes.length ? (
        <Card className="p-8 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium mt-3">Nenhum orçamento ainda.</p>
          <p className="text-sm text-muted-foreground mt-1">{emptyHint}</p>
        </Card>
      ) : (
        // Lista com divisória, e não um cartão por orçamento: no celular são
        // três linhas de informação, não um bloco.
        <ul className="divide-y divide-border border-y border-border">
          {quotes.map((quote) => (
            <li key={quote.id}>
              <button
                type="button"
                onClick={() => abrir(quote.id)}
                className="w-full py-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-medium">{quote.counterpartName}</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {quote.ultimoTotal !== null ? brl(quote.ultimoTotal) : ""}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge className={cn("text-[11px]", statusStyles[quote.status])}>
                    {quoteStatusLabels[quote.status]}
                  </Badge>
                  {quote.minhaVez && quote.status !== "aceito" && (
                    <span className="text-xs font-semibold text-primary">Aguardando você</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {quote.itens} item(ns) · {quandoNaLista(quote.createdAt)}
                  </span>
                </div>
                {quote.note && (
                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{quote.note}</p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
