import { createFileRoute } from "@tanstack/react-router";

import { handleCaktoWebhook } from "@/lib/server/billing.server";

export const Route = createFileRoute("/api/cakto-webhook")({
  server: { handlers: { POST: ({ request }) => handleCaktoWebhook(request) } },
});
