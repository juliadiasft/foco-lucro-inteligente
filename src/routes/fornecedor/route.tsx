import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { SupplierShell } from "@/components/app/SupplierShell";
import { hasActiveAccess } from "@/lib/access";
import { getCurrentUser } from "@/lib/api/auth.functions";

export const Route = createFileRoute("/fornecedor")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) throw redirect({ to: "/login" });
    // Área exclusiva do fornecedor. Comerciante que cair aqui volta para o
    // painel dele; as duas experiências não se misturam.
    if (user.accountType !== "fornecedor") throw redirect({ to: "/dashboard" });
    if (!hasActiveAccess(user)) throw redirect({ to: "/assinatura" });
    return { user };
  },
  component: () => (
    <SupplierShell>
      <Outlet />
    </SupplierShell>
  ),
});
