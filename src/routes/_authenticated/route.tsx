import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/app/AppShell";
import { hasActiveAccess } from "@/lib/access";
import { getCurrentUser } from "@/lib/api/auth.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const user = await getCurrentUser();
    if (!user) throw redirect({ to: "/login" });
    if (location.pathname !== "/onboarding" && !user.onboardingComplete)
      throw redirect({ to: "/onboarding" });
    if (location.pathname !== "/assinatura" && !hasActiveAccess(user))
      throw redirect({ to: "/assinatura" });
    return { user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
