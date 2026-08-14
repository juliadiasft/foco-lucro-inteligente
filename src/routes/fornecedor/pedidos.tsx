import { createFileRoute } from "@tanstack/react-router";

import { OrdersView } from "@/components/app/OrdersView";

export const Route = createFileRoute("/fornecedor/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos — Central do Comerciante" }] }),
  component: () => (
    <OrdersView emptyHint="Os pedidos dos comerciantes aparecem aqui assim que chegarem." />
  ),
});
