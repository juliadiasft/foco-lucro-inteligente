import { createFileRoute } from "@tanstack/react-router";

import { getAppBaseUrl } from "@/lib/server/app-url.server";

// A vitrine é para ser lida; o resto da Central não. As áreas logadas nem
// respondem sem sessão, mas deixar isso explícito evita que o robô gaste as
// visitas dele em porta fechada em vez de indexar o que interessa.
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const base = getAppBaseUrl();
        const corpo = [
          "User-agent: *",
          "Allow: /vitrine/",
          "Disallow: /adm",
          "Disallow: /fornecedor",
          "Disallow: /dashboard",
          "Disallow: /api/",
          "Disallow: /convite",
          "Disallow: /redefinir-senha",
          "",
          `Sitemap: ${base}/sitemap.xml`,
          "",
        ].join("\n");
        return new Response(corpo, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
