import { createFileRoute } from "@tanstack/react-router";

import { handleStripeWebhook } from "@/lib/server/billing.server";

export const Route = createFileRoute("/api/stripe-webhook")({
  server: { handlers: { POST: ({ request }) => handleStripeWebhook(request) } },
});
