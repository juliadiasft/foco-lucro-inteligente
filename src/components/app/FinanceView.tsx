import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2, Plus, Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  listFinance,
  removeFinanceEntry,
  saveFinanceEntry,
  settleFinanceEntry,
} from "@/lib/api/finance.functions";
import { brl, dataBR } from "@/lib/format";
import { cn } from "@/lib/utils";

const emptyForm = {
  id: undefined as string | undefined,
  description: "",
  counterpartyName: "",
  amount: "",
  dueDate: "",
  note: "",
  fromOrder: false,
};

export function FinanceView() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data } = useQuery({ queryKey: ["finance"], queryFn: () => listFinance() });
  const pagar = data?.direction === "pagar";

  const atualizar = () => queryClient.invalidateQueries({ queryKey: ["finance"] });

  const save = useMutation({
    mutationFn: () =>
      saveFinanceEntry({
        data: {
          id: form.id,
          description: form.description,
          counterpartyName: form.counterpartyName || undefined,
          amount: Number(form.amount || 0),
          dueDate: form.dueDate || undefined,
          note: form.note || undefined,
        },
      }),
    onSuccess: async () => {
      toast.success("Conta salva");
      setOpen(false);
      setForm(emptyForm);
      await atualizar();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const settle = useMutation({
    mutationFn: ({ id, paid }: { id: string; paid: boolean }) =>
      settleFinanceEntry({ data: { id, paid } }),
    onSuccess: async () => {
      await atualizar();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFinanceEntry({ data: { id } }),
    onSuccess: async () => {
      toast.success("Conta excluída");
      await atualizar();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const entries = data?.entries || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            {pagar ? "Contas a pagar" : "Contas a receber"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {pagar
              ? "Todo pedido aceito na Central entra aqui automaticamente. Você também pode lançar contas de fora."
              : "Toda venda aceita na Central entra aqui automaticamente. Você também pode lançar recebimentos de fora."}
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setForm(emptyForm);
          }}
        >
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="h-4 w-4 mr-1" /> Lançar conta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Editar conta" : "Nova conta"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="description">Descrição</Label>
                <Input
                  id="description"
                  disabled={form.fromOrder}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="counterpartyName">{pagar ? "Para quem" : "De quem"}</Label>
                <Input
                  id="counterpartyName"
                  disabled={form.fromOrder}
                  value={form.counterpartyName}
                  onChange={(event) => setForm({ ...form, counterpartyName: event.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="amount">Valor (R$)</Label>
                  <Input
                    id="amount"
                    type="number"
                    min={0}
                    step="0.01"
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
                    value={form.dueDate}
                    onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
                  />
                </div>
              </div>
              {form.fromOrder && (
                <p className="text-xs text-muted-foreground">
                  Esta conta veio de um pedido da Central. Valor e contraparte são o que foi
                  negociado — só o vencimento e a observação podem ser ajustados.
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="note">Observação</Label>
                <Textarea
                  id="note"
                  rows={2}
                  value={form.note}
                  onChange={(event) => setForm({ ...form, note: event.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button disabled={save.isPending || !form.description} onClick={() => save.mutate()}>
                {save.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-primary">
            <Wallet className="h-5 w-5" />
            <h2 className="text-xs font-semibold uppercase">Em aberto</h2>
          </div>
          <p className="text-3xl font-bold mt-3">{brl(data?.totals.aberto)}</p>
          <p className="text-xs text-muted-foreground mt-1">Total ainda não quitado</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-xs font-semibold uppercase">Vencido</h2>
          </div>
          <p className="text-3xl font-bold mt-3">{brl(data?.totals.vencido)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {pagar ? "Precisa de atenção hoje" : "Cobrança atrasada"}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-warning">
            <CalendarClock className="h-5 w-5" />
            <h2 className="text-xs font-semibold uppercase">Próximos 7 dias</h2>
          </div>
          <p className="text-3xl font-bold mt-3">{brl(data?.totals.proximos)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {(data?.totals.semData || 0) > 0
              ? `${brl(data?.totals.semData)} sem vencimento definido`
              : "Programe seu caixa"}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="h-5 w-5" />
            <h2 className="text-xs font-semibold uppercase">
              {pagar ? "Pago no mês" : "Recebido no mês"}
            </h2>
          </div>
          <p className="text-3xl font-bold mt-3">{brl(data?.totals.pagoNoMes)}</p>
          <p className="text-xs text-muted-foreground mt-1">Quitado neste mês</p>
        </Card>
      </div>

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
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="p-3 font-medium">Descrição</th>
                <th className="p-3 font-medium">{pagar ? "Para" : "De"}</th>
                <th className="p-3 font-medium">Vencimento</th>
                <th className="p-3 font-medium text-right">Valor</th>
                <th className="p-3 font-medium">Situação</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className={cn("border-b last:border-0", entry.paidAt && "opacity-60")}
                >
                  <td className="p-3">
                    <p className="font-medium">{entry.description}</p>
                    {entry.note && <p className="text-xs text-muted-foreground">{entry.note}</p>}
                  </td>
                  <td className="p-3 text-muted-foreground">{entry.counterpartyName || "—"}</td>
                  <td className="p-3 text-muted-foreground">
                    {entry.dueDate ? dataBR(entry.dueDate) : "A definir"}
                  </td>
                  <td className="p-3 text-right font-medium">{brl(entry.amount)}</td>
                  <td className="p-3">
                    {entry.paidAt ? (
                      <Badge className="bg-success/15 text-success border-success/30">
                        {pagar ? "Pago" : "Recebido"}
                      </Badge>
                    ) : entry.vencida ? (
                      <Badge className="bg-destructive/10 text-destructive border-destructive/30">
                        Vencida
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Em aberto</Badge>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={settle.isPending}
                        onClick={() => settle.mutate({ id: entry.id, paid: !entry.paidAt })}
                      >
                        {entry.paidAt ? "Reabrir" : pagar ? "Marcar como pago" : "Marcar recebido"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setForm({
                            id: entry.id,
                            description: entry.description,
                            counterpartyName: entry.counterpartyName || "",
                            amount: String(entry.amount),
                            dueDate: entry.dueDate || "",
                            note: entry.note || "",
                            fromOrder: entry.fromOrder,
                          });
                          setOpen(true);
                        }}
                      >
                        Editar
                      </Button>
                      {!entry.fromOrder && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Excluir conta"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(entry.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
