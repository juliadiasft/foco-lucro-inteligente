import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ClipboardList, Download, MapPin, Star } from "lucide-react";
import { useState } from "react";
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
import {
  listOrders,
  orderStatusLabels,
  updateOrderStatus,
  type OrderStatus,
} from "@/lib/api/orders.functions";
import { listPendingReviews, saveReview } from "@/lib/api/reviews.functions";
import { baseUnitShort } from "@/lib/catalog";
import { downloadCsv } from "@/lib/csv";
import { brl, dataHoraBR, diaBR, horaBR, num, quandoNaLista } from "@/lib/format";
import { cn } from "@/lib/utils";

const statusStyles: Record<OrderStatus, string> = {
  enviado: "bg-warning/15 text-warning border-warning/30",
  aceito: "bg-primary/15 text-primary border-primary/30",
  concluido: "bg-success/15 text-success border-success/30",
  recusado: "bg-destructive/10 text-destructive border-destructive/30",
  cancelado: "bg-muted text-muted-foreground",
};

type Pedido = Awaited<ReturnType<typeof listOrders>>["orders"][number];

// "Aguardando o fornecedor" é a situação vista por quem comprou. Para o próprio
// fornecedor, o mesmo pedido é um pedido novo — e o selo aparecia ao lado de
// "Aguardando você", dizendo as duas coisas ao mesmo tempo.
const rotulo = (status: OrderStatus, isMerchant: boolean) =>
  status === "enviado" && !isMerchant ? "Novo pedido" : orderStatusLabels[status];

// Pedidos no celular.
//
// Antes era um cartão grande por pedido, todos abertos, com os botões dentro:
// "Cancelar pedido" e "Recusar" a um toque do polegar, sem confirmação, no meio
// da rolagem. Agora a lista mostra o que importa para achar o pedido — quem,
// quanto, em que pé está — separada entre o que ainda anda e o que acabou; o
// resto, e as ações, ficam na folha que abre ao tocar.
export function OrdersView({ emptyHint }: { emptyHint: string }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["orders"], queryFn: () => listOrders() });
  const [abertoId, setAbertoId] = useState<string | null>(null);

  const { data: pendentes } = useQuery({
    queryKey: ["pending-reviews"],
    queryFn: () => listPendingReviews(),
  });

  const orders = data?.orders || [];
  const isMerchant = data?.side === "comerciante";
  const notaDe = (orderId: string) =>
    pendentes?.find((item) => item.orderId === orderId)?.myRating ?? null;

  // O que depende de mim agora. Para o fornecedor: aceitar o que chegou e
  // concluir o que foi entregue. Para o comerciante: avaliar o que acabou.
  const minhaVez = (pedido: Pedido) =>
    isMerchant
      ? pedido.status === "concluido" && notaDe(pedido.id) === null
      : pedido.status === "enviado" || pedido.status === "aceito";

  const andamento = orders.filter((p) => p.status === "enviado" || p.status === "aceito");
  const encerrados = orders.filter((p) => p.status !== "enviado" && p.status !== "aceito");
  const aberto = orders.find((p) => p.id === abertoId) || null;

  const grupo = (titulo: string, pedidos: Pedido[]) =>
    pedidos.length > 0 && (
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {titulo}
        </h2>
        <ul className="mt-2 divide-y divide-border border-y border-border">
          {pedidos.map((pedido) => (
            <li key={pedido.id}>
              <button
                type="button"
                onClick={() => setAbertoId(pedido.id)}
                className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-medium">{pedido.counterpartName}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{brl(pedido.total)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {num(pedido.quantity)} × {pedido.itemName}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Badge className={cn("text-[11px]", statusStyles[pedido.status])}>
                      {rotulo(pedido.status, isMerchant)}
                    </Badge>
                    {minhaVez(pedido) && (
                      <span className="text-xs font-semibold text-primary">
                        {pedido.status === "concluido" ? "Avalie" : "Aguardando você"}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {quandoNaLista(pedido.createdAt)}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold md:text-3xl">Pedidos</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            O combinado fica registrado aqui. O pagamento é feito direto entre vocês, fora da
            Central.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!orders.length}
          onClick={() =>
            downloadCsv(
              `pedidos-${new Date().toISOString().slice(0, 10)}.csv`,
              [
                isMerchant ? "Fornecedor" : "Cliente",
                "Data",
                "Produto",
                "Quantidade",
                "Preço unitário",
                "Total",
                "Situação",
              ],
              orders.map((order) => [
                order.counterpartName,
                dataHoraBR(order.createdAt),
                order.itemName,
                order.quantity,
                order.unitPrice,
                order.total,
                orderStatusLabels[order.status],
              ]),
            )
          }
        >
          <Download className="mr-1 h-4 w-4" /> Exportar
        </Button>
      </div>

      {!orders.length ? (
        <Card className="p-8 text-center">
          <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium mt-3">Nenhum pedido ainda.</p>
          <p className="text-sm text-muted-foreground mt-1">{emptyHint}</p>
        </Card>
      ) : (
        <>
          {grupo("Em andamento", andamento)}
          {grupo("Encerrados", encerrados)}
        </>
      )}

      <Drawer open={Boolean(aberto)} onOpenChange={(estado) => !estado && setAbertoId(null)}>
        <DrawerContent className="max-h-[92vh]">
          {aberto && (
            <FolhaDoPedido
              key={aberto.id}
              pedido={aberto}
              isMerchant={isMerchant}
              nota={notaDe(aberto.id)}
              aoMudar={async () => {
                await queryClient.invalidateQueries({ queryKey: ["orders"] });
              }}
              aoAvaliar={async () => {
                await queryClient.invalidateQueries({ queryKey: ["pending-reviews"] });
              }}
            />
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function FolhaDoPedido({
  pedido,
  isMerchant,
  nota,
  aoMudar,
  aoAvaliar,
}: {
  pedido: Pedido;
  isMerchant: boolean;
  nota: number | null;
  aoMudar: () => Promise<void>;
  aoAvaliar: () => Promise<void>;
}) {
  // Cancelar e recusar pedem um segundo toque. É o único jeito de desfazer um
  // combinado com outra empresa, e não pode acontecer por um esbarrão.
  const [confirmando, setConfirmando] = useState(false);

  const change = useMutation({
    mutationFn: (status: OrderStatus) =>
      updateOrderStatus({ data: { id: pedido.id, status: status as "aceito" } }),
    onSuccess: async (_resultado, status) => {
      setConfirmando(false);
      toast.success(
        status === "cancelado"
          ? "Pedido cancelado"
          : status === "recusado"
            ? "Pedido recusado"
            : "Pedido atualizado",
      );
      await aoMudar();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const avaliar = useMutation({
    mutationFn: (rating: number) => saveReview({ data: { orderId: pedido.id, rating } }),
    onSuccess: async () => {
      toast.success("Obrigado pela avaliação");
      await aoAvaliar();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const unidade = baseUnitShort[pedido.baseUnit];
  const desfazer = isMerchant ? "cancelado" : "recusado";
  const podeDesfazer = isMerchant
    ? pedido.status === "enviado" || pedido.status === "aceito"
    : pedido.status === "enviado";

  return (
    <>
      <DrawerHeader className="text-left">
        <div className="flex items-start justify-between gap-3">
          <DrawerTitle className="leading-snug">{pedido.counterpartName}</DrawerTitle>
          <Badge className={cn("shrink-0", statusStyles[pedido.status])}>
            {rotulo(pedido.status, isMerchant)}
          </Badge>
        </div>
        <DrawerDescription className="flex flex-wrap gap-x-3">
          {pedido.city && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {pedido.city}
              {pedido.uf ? ` — ${pedido.uf}` : ""}
            </span>
          )}
          <span>
            {diaBR(pedido.createdAt)} às {horaBR(pedido.createdAt)}
          </span>
        </DrawerDescription>
      </DrawerHeader>

      <div className="space-y-4 overflow-y-auto px-4">
        <div className="border-y border-border py-3">
          <p className="font-medium">
            {pedido.itemName}
            {pedido.brand ? ` — ${pedido.brand}` : ""}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
            {num(pedido.quantity)} × embalagem de {num(pedido.packSize, 3)} {unidade} a{" "}
            {brl(pedido.unitPrice)}
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{brl(pedido.total)}</p>
        </div>

        {pedido.note && (
          <p className="border-l-2 border-border pl-3 text-sm text-muted-foreground">
            {pedido.note}
          </p>
        )}

        {pedido.status === "aceito" && isMerchant && (
          <p className="text-sm text-muted-foreground">
            O fornecedor aceitou. A conta a pagar já está em Contas a pagar.
          </p>
        )}

        {/* Uma nota, e pronto. Cinco critérios ninguém preenche. As estrelas
            têm o tamanho do dedo: eram ícones de 20px sem área de toque. */}
        {pedido.status === "concluido" && (
          <div className="border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              {nota !== null ? "Sua avaliação" : `Como foi negociar com ${pedido.counterpartName}?`}
            </p>
            <div className="mt-1 flex">
              {[1, 2, 3, 4, 5].map((estrela) => (
                <button
                  key={estrela}
                  type="button"
                  aria-label={`${estrela} estrela(s)`}
                  disabled={avaliar.isPending}
                  onClick={() => avaliar.mutate(estrela)}
                  className="flex h-11 w-11 items-center justify-center text-warning"
                >
                  <Star
                    className={cn(
                      "h-7 w-7",
                      (nota ?? 0) >= estrela ? "fill-current" : "opacity-40",
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <DrawerFooter>
        {!isMerchant && pedido.status === "enviado" && (
          <Button size="lg" disabled={change.isPending} onClick={() => change.mutate("aceito")}>
            Aceitar pedido
          </Button>
        )}
        {!isMerchant && pedido.status === "aceito" && (
          <Button size="lg" disabled={change.isPending} onClick={() => change.mutate("concluido")}>
            Marcar como entregue
          </Button>
        )}
        {podeDesfazer &&
          (confirmando ? (
            <div className="space-y-2">
              <p className="text-center text-sm text-muted-foreground">
                {isMerchant
                  ? pedido.status === "aceito"
                    ? "O fornecedor já aceitou. Ele será avisado, e a conta a pagar sai do seu financeiro se ainda não foi paga."
                    : "O fornecedor será avisado."
                  : "O comerciante será avisado."}
              </p>
              <Button
                size="lg"
                variant="destructive"
                className="w-full"
                disabled={change.isPending}
                onClick={() => change.mutate(desfazer)}
              >
                {isMerchant ? "Sim, cancelar pedido" : "Sim, recusar pedido"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setConfirmando(false)}>
                Voltar
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setConfirmando(true)}
            >
              {isMerchant ? "Cancelar pedido" : "Recusar pedido"}
            </Button>
          ))}
      </DrawerFooter>
    </>
  );
}
