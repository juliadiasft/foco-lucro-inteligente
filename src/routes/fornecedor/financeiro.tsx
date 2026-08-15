import { createFileRoute } from "@tanstack/react-router";

import { FinanceView } from "@/components/app/FinanceView";

export const Route = createFileRoute("/fornecedor/financeiro")({
  head: () => ({ meta: [{ title: "Contas a receber — Central do Comerciante" }] }),
  component: FinanceView,
});
