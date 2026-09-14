import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Download, Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
  listFinance,
  removeFinanceEntry,
  saveFinanceEntry,
  settleFinanceEntry,
} from "@/lib/api/finance.functions";
import { downloadCsv } from "@/lib/csv";
import { brl, dataBR } from "@/lib/format";
import { cn } from "@/lib/utils";

type Conta = Awaited<ReturnType<typeof listFinance>>["entries"][number];

const formVazio = {
  id: undefined as string | undefined,
  description: "",
  counterpartyName: "",
  amount: "",
  dueDate: "",
  note: "",
  fromOrder: false,
};

// "2026-09-15" é um dia do calendário: vira data local sem passar por
// instante, pelo mesmo motivo de dataBR (ver src/lib/format.ts).
function diasAte(dueDate: string) {
  const [ano, mes, dia] = dueDate.split("-").map(Number);
  const vence = new Date(ano, mes - 1, dia);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((vence.getTime() - hoje.getTime()) / 86400000);
}

function prazo(conta: Conta, pagar: boolean) {
  if (conta.paidAt) return `${pagar ? "Pago" : "Recebido"} em ${dataBR(conta.paidAt)}`;
  if (!conta.dueDate) return "Sem vencimento";
  const dias = diasAte(conta.dueDate);
  if (dias < -1) return `Venceu há ${-dias} dias`;
  if (dias === -1) return "Venceu ontem";
  if (dias === 0) return "Vence hoje";
  if (dias === 1) return "Vence amanhã";
  return `Vence ${dataBR(conta.dueDate)}`;
}

// Contas a pagar (e a receber, no fornecedor) no celular.
//
// Antes: quatro cartões do tamanho da tela empilhados antes da primeira conta,
// e depois uma tabela de seis colunas que rolava de lado, com "Marcar como
// pago", "Editar" e uma lixeira em cada linha — a lixeira apagava sem
// perguntar. Agora o topo é um número só, o que está em aberto, e a lista é
// separada pelo que a pessoa precisa decidir: o que venceu, o que vai vencer,
// o que já foi pago. Pagar é um toque na própria linha, com desfazer.
export function FinanceView() {
  const queryClient = useQueryClient();
  const [folha, setFolha] = useState<"fechada" | "ver" | "editar">("fechada");
  const [contaId, setContaId] = useState<string | null>(null);
  const [form, setForm] = useState(formVazio);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const { data } = useQuery({ queryKey: ["finance"], queryFn: () => listFinance() });
  const pagar = data?.direction === "pagar";
  const atualizar = () => queryClient.invalidateQueries({ queryKey: ["finance"] });

  const fechar = () => {
    setFolha("fechada");
    setConfirmandoExclusao(false);
  };

  const save = useMutation({
    mutationFn: () =>
      saveFinanceEntry({
        data: {
          id: form.id,
          description: form.description,
          counterpartyName: form.counterpartyName || undefined,
          amount: Number(form.amount.replace(",", ".") || 0),
          dueDate: form.dueDate || undefined,
          note: form.note || undefined,
        },
      }),
    onSuccess: async () => {
      toast.success("Conta salva");
      fechar();
      await atualizar();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const settle = useMutation({
    mutationFn: ({ id, paid }: { id: string; paid: boolean }) =>
      settleFinanceEntry({ data: { id, paid } }),
    onSuccess: async (_resultado, { id, paid }) => {
      await atualizar();
      if (paid)
        toast.success(pagar ? "Marcada como paga" : "Marcada como recebida", {
          action: { label: "Desfazer", onClick: () => settle.mutate({ id, paid: false }) },
        });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFinanceEntry({ data: { id } }),
    onSuccess: async () => {
      toast.success("Conta excluída");
      fechar();
      await atualizar();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const entries = data?.entries || [];
  const conta = entries.find((item) => item.id === contaId) || null;
  const vencidas = entries.filter((item) => !item.paidAt && item.vencida);
  const aVencer = entries.filter((item) => !item.paidAt && !item.vencida);
  const pagas = entries.filter((item) => item.paidAt);
  const mes = new Date().toLocaleDateString("pt-BR", { month: "long" });

  const abrirConta = (item: Conta) => {
    setContaId(item.id);
    setConfirmandoExclusao(false);
    setFolha("ver");
  };

  const editar = (item: Conta | null) => {
    setForm(
      item
        ? {
            id: item.id,
            description: item.description,
            counterpartyName: item.counterpartyName || "",
            amount: String(item.amount),
            dueDate: item.dueDate || "",
            note: item.note || "",
            fromOrder: item.fromOrder,
          }
        : formVazio,
    );
    setFolha("editar");
  };

  const grupo = (titulo: string, contas: Conta[], destaque?: string) =>
    contas.length > 0 && (
      <section>
        <h2
          className={cn(
            "text-sm font-semibold uppercase tracking-wide",
            destaque || "text-muted-foreground",
          )}
        >
          {titulo}
        </h2>
        <ul className="mt-2 divide-y divide-border border-y border-border">
          {contas.map((item) => (
            <li key={item.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => abrirConta(item)}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 py-3 text-left transition-colors hover:bg-muted/50",
                  item.paidAt && "opacity-60",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-medium">{item.description}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{brl(item.amount)}</span>
                  </div>
                  <p
                    className={cn(
                      "mt-0.5 truncate text-xs",
                      item.vencida && !item.paidAt
                        ? "font-medium text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {item.counterpartyName ? `${item.counterpartyName} · ` : ""}
                    {prazo(item, pagar)}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
              {!item.paidAt && (
                <button
                  type="button"
                  aria-label={pagar ? "Marcar como paga" : "Marcar como recebida"}
                  disabled={settle.isPending}
                  onClick={() => settle.mutate({ id: item.id, paid: true })}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-success hover:text-success"
                >
                  <Check className="h-5 w-5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold md:text-3xl">
            {pagar ? "Contas a pagar" : "Contas a receber"}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {pagar
              ? "Pedido aceito na Central entra aqui sozinho. Contas de fora você lança."
              : "Venda aceita na Central entra aqui sozinha. Recebimentos de fora você lança."}
          </p>
        </div>
        <Button className="shrink-0" onClick={() => editar(null)}>
          <Plus className="mr-1 h-4 w-4" /> Lançar
        </Button>
      </div>

      {/* Um número no topo, como no extrato do banco. Os outros três viraram
          a frase de baixo: são detalhes dele, não concorrentes. */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Em aberto
        </p>
        <p className="mt-1 text-4xl font-bold tabular-nums">{brl(data?.totals.aberto)}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {(data?.totals.vencido || 0) > 0 && (
            <>
              <strong className="font-semibold text-destructive">
                {brl(data?.totals.vencido)} vencido
              </strong>
              {" · "}
            </>
          )}
          {brl(data?.totals.proximos)} nos próximos 7 dias
          {(data?.totals.semData || 0) > 0 && ` · ${brl(data?.totals.semData)} sem vencimento`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {pagar ? "Pago" : "Recebido"} em {mes}:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {brl(data?.totals.pagoNoMes)}
          </span>
        </p>
      </section>

      {!entries.length ? (
        <Card className="p-8 text-center">
          <Wallet className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium mt-3">Nenhuma conta registrada.</p>
          <p className="text-sm text-muted-foreground mt-1">
            {pagar
              ? "Feche um pedido na Central ou lance uma conta manualmente."
              : "Aceite um pedido na Central ou lance um recebimento manualmente."}
          </p>
        </Card>
      ) : (
        <>
          {grupo("Vencidas", vencidas, "text-destructive")}
          {grupo("A vencer", aVencer)}
          {grupo(pagar ? "Pagas" : "Recebidas", pagas)}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() =>
              downloadCsv(
                `${pagar ? "contas-a-pagar" : "contas-a-receber"}-${new Date()
                  .toISOString()
                  .slice(0, 10)}.csv`,
                [
                  "Descrição",
                  pagar ? "Para" : "De",
                  "Vencimento",
                  "Valor",
                  "Situação",
                  "Quitado em",
                ],
                entries.map((entry) => [
                  entry.description,
                  entry.counterpartyName,
                  entry.dueDate ? dataBR(entry.dueDate) : "",
                  entry.amount,
                  entry.paidAt
                    ? pagar
                      ? "Pago"
                      : "Recebido"
                    : entry.vencida
                      ? "Vencida"
                      : "Em aberto",
                  entry.paidAt ? dataBR(entry.paidAt) : "",
                ]),
              )
            }
          >
            <Download className="mr-1 h-4 w-4" /> Exportar planilha
          </Button>
        </>
      )}

      <Drawer open={folha !== "fechada"} onOpenChange={(estado) => !estado && fechar()}>
        <DrawerContent className="max-h-[92vh]">
          {folha === "ver" && conta && (
            <>
              <DrawerHeader className="text-left">
                <DrawerTitle className="leading-snug">{conta.description}</DrawerTitle>
                <DrawerDescription>
                  {conta.counterpartyName || (pagar ? "Sem fornecedor" : "Sem cliente")}
                </DrawerDescription>
              </DrawerHeader>
              <div className="space-y-3 overflow-y-auto px-4">
                <div className="border-y border-border py-3">
                  <p className="text-3xl font-bold tabular-nums">{brl(conta.amount)}</p>
                  <p
                    className={cn(
                      "mt-1 text-sm",
                      conta.vencida && !conta.paidAt
                        ? "font-medium text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {prazo(conta, pagar)}
                  </p>
                </div>
                {conta.note && <p className="text-sm">{conta.note}</p>}
                {conta.fromOrder && (
                  <p className="text-xs text-muted-foreground">
                    Veio de um pedido da Central: valor e {pagar ? "fornecedor" : "cliente"} são o
                    que foi negociado.
                  </p>
                )}
              </div>
              <DrawerFooter>
                <Button
                  size="lg"
                  variant={conta.paidAt ? "outline" : "default"}
                  disabled={settle.isPending}
                  onClick={() => {
                    settle.mutate({ id: conta.id, paid: !conta.paidAt });
                    fechar();
                  }}
                >
                  {conta.paidAt
                    ? "Reabrir conta"
                    : pagar
                      ? "Marcar como paga"
                      : "Marcar como recebida"}
                </Button>
                <Button variant="outline" onClick={() => editar(conta)}>
                  Editar
                </Button>
                {!conta.fromOrder &&
                  (confirmandoExclusao ? (
                    <Button
                      variant="destructive"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(conta.id)}
                    >
                      Sim, excluir esta conta
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() => setConfirmandoExclusao(true)}
                    >
                      Excluir
                    </Button>
                  ))}
              </DrawerFooter>
            </>
          )}

          {folha === "editar" && (
            <>
              <DrawerHeader className="text-left">
                <DrawerTitle>{form.id ? "Editar conta" : "Nova conta"}</DrawerTitle>
                {form.fromOrder && (
                  <DrawerDescription>
                    Veio de um pedido da Central: só o vencimento e a observação mudam.
                  </DrawerDescription>
                )}
              </DrawerHeader>
              <div className="space-y-4 overflow-y-auto px-4">
                <div className="space-y-1.5">
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    className="h-11"
                    placeholder={pagar ? "Ex.: Aluguel da loja" : "Ex.: Venda para mercado"}
                    disabled={form.fromOrder}
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="counterpartyName">
                    {pagar ? "Para quem (opcional)" : "De quem (opcional)"}
                  </Label>
                  <Input
                    id="counterpartyName"
                    className="h-11"
                    disabled={form.fromOrder}
                    value={form.counterpartyName}
                    onChange={(event) => setForm({ ...form, counterpartyName: event.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="amount">Valor (R$)</Label>
                    <Input
                      id="amount"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      className="h-11 tabular-nums"
                      disabled={form.fromOrder}
                      value={form.amount}
                      onChange={(event) => setForm({ ...form, amount: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dueDate">Vencimento</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      className="h-11"
                      value={form.dueDate}
                      onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="note">Observação (opcional)</Label>
                  <Textarea
                    id="note"
                    rows={2}
                    value={form.note}
                    onChange={(event) => setForm({ ...form, note: event.target.value })}
                  />
                </div>
              </div>
              <DrawerFooter>
                <Button
                  size="lg"
                  disabled={save.isPending || !form.description.trim()}
                  onClick={() => save.mutate()}
                >
                  {save.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
