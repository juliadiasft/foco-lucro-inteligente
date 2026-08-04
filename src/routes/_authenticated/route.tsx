import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/app/AppShell";
import { getCurrentUser } from "@/lib/api/auth.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const user = await getCurrentUser();
    if (!user) throw redirect({ to: "/login" });
    if (location.pathname !== "/onboarding" && !user.onboardingComplete)
      throw redirect({ to: "/onboarding" });
    const accessActive =
      user.subscriptionStatus === "active" ||
      (user.subscriptionStatus === "trialing" && new Date(user.trialEndsAt).getTime() > Date.now());
    if (location.pathname !== "/assinatura" && !accessActive) throw redirect({ to: "/assinatura" });
    return { user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
