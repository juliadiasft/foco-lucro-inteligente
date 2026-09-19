import { createFileRoute } from "@tanstack/react-router";

import { TelaDeConquistas } from "@/components/app/Conquistas";

export const Route = createFileRoute("/_authenticated/conquistas")({
  head: () => ({ meta: [{ title: "Conquistas — Central do Comerciante" }] }),
  component: () => <TelaDeConquistas lado="comerciante" />,
});
