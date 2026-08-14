import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, MapPin } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  listOrders,
  orderStatusLabels,
  updateOrderStatus,
  type OrderStatus,
} from "@/lib/api/orders.functions";
import { baseUnitShort } from "@/lib/catalog";
import { brl, dataHoraBR, num } from "@/lib/format";

const statusStyles: Record<OrderStatus, string> = {
  enviado: "bg-warning/15 text-warning border-warning/30",
  aceito: "bg-primary/15 text-primary border-primary/30",
  concluido: "bg-success/15 text-success border-success/30",
  recusado: "bg-destructive/10 text-destructive border-destructive/30",
  cancelado: "bg-muted text-muted-foreground",
};

export function OrdersView({ emptyHint }: { emptyHint: string }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["orders"], queryFn: () => listOrders() });

  const change = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      updateOrderStatus({ data: { id, status: status as "aceito" } }),
    onSuccess: async () => {
      toast.success("Pedido atualizado");
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const orders = data?.orders || [];
  const isMerchant = data?.side === "comerciante";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Pedidos</h1>
        <p className="text-muted-foreground mt-1">
          O combinado fica registrado aqui. O pagamento é feito direto entre vocês, fora da Central.
        </p>
      </div>

      {!orders.length ? (
        <Card className="p-8 text-center">
          <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium mt-3">Nenhum pedido ainda.</p>
          <p className="text-sm text-muted-foreground mt-1">{emptyHint}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{order.counterpartName}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-3">
                    {order.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {order.city}
                        {order.uf ? ` — ${order.uf}` : ""}
                      </span>
                    )}
                    <span>{dataHoraBR(order.createdAt)}</span>
                  </p>
                </div>
                <Badge className={statusStyles[order.status]}>
                  {orderStatusLabels[order.status]}
                </Badge>
              </div>

              <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="font-medium">
                    {order.itemName}
                    {order.brand ? ` — ${order.brand}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {num(order.quantity, 3)} × embalagem de {num(order.packSize, 3)}{" "}
                    {baseUnitShort[order.baseUnit]} a {brl(order.unitPrice)}
                  </p>
                </div>
                <p className="text-2xl font-bold">{brl(order.total)}</p>
              </div>

              {order.note && (
                <p className="mt-3 text-sm text-muted-foreground border-l-2 border-border pl-3">
                  {order.note}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {isMerchant && (order.status === "enviado" || order.status === "aceito") && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={change.isPending}
                    onClick={() => change.mutate({ id: order.id, status: "cancelado" })}
                  >
                    Cancelar pedido
                  </Button>
                )}
                {!isMerchant && order.status === "enviado" && (
                  <>
                    <Button
                      size="sm"
                      disabled={change.isPending}
                      onClick={() => change.mutate({ id: order.id, status: "aceito" })}
                    >
                      Aceitar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={change.isPending}
                      onClick={() => change.mutate({ id: order.id, status: "recusado" })}
                    >
                      Recusar
                    </Button>
                  </>
                )}
                {!isMerchant && order.status === "aceito" && (
                  <Button
                    size="sm"
                    disabled={change.isPending}
                    onClick={() => change.mutate({ id: order.id, status: "concluido" })}
                  >
                    Marcar como concluído
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
