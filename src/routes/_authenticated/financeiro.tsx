import { createFileRoute } from "@tanstack/react-router";

import { FinanceView } from "@/components/app/FinanceView";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({ meta: [{ title: "Contas a pagar — Central do Comerciante" }] }),
  component: FinanceView,
});
