import { createFileRoute } from "@tanstack/react-router";

import { OrdersView } from "@/components/app/OrdersView";

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos — Central do Comerciante" }] }),
  component: () => (
    <OrdersView emptyHint="Vá em Onde comprar, toque na oferta e em Fazer pedido." />
  ),
});
