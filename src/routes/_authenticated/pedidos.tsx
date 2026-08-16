import { createFileRoute } from "@tanstack/react-router";

import { OrdersView } from "@/components/app/OrdersView";

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos — Central do Comerciante" }] }),
  component: () => (
    <OrdersView emptyHint="Vá em Onde comprar, compare os preços e clique em Pedir." />
  ),
});
