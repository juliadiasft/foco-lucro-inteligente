import { createFileRoute } from "@tanstack/react-router";

import { query } from "@/lib/server/db.server";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await query("SELECT 1");
          return Response.json({ status: "ok" });
        } catch {
          return Response.json({ status: "unavailable" }, { status: 503 });
        }
      },
    },
  },
});
