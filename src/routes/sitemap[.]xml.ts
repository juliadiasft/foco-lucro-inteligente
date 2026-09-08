import { createFileRoute } from "@tanstack/react-router";

import { getAppBaseUrl } from "@/lib/server/app-url.server";
import { query } from "@/lib/server/db.server";

// Sem sitemap, o Google só descobre uma vitrine se alguém linkar para ela — e
// uma vitrine recém-publicada pode passar meses invisível justamente na fase
// em que o fornecedor mais precisa aparecer.

const PAGINAS_FIXAS = ["/", "/planos", "/sobre", "/contato", "/termos", "/privacidade"];

const escapar = (valor: string) =>
  valor.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const base = getAppBaseUrl();
        const vitrines = await query<{ slug: string; atualizado: Date }>(
          `SELECT sp.slug, sp.updated_at atualizado
             FROM supplier_profiles sp
             JOIN companies c ON c.id=sp.company_id
            WHERE sp.published=true
              AND sp.slug IS NOT NULL
              AND c.account_type='fornecedor'
            ORDER BY sp.updated_at DESC
            LIMIT 5000`,
        );

        const urls = [
          ...PAGINAS_FIXAS.map((caminho) => `  <url><loc>${escapar(base + caminho)}</loc></url>`),
          ...vitrines.rows.map(
            (v) =>
              `  <url><loc>${escapar(`${base}/vitrine/${v.slug}`)}</loc>` +
              `<lastmod>${v.atualizado.toISOString().slice(0, 10)}</lastmod></url>`,
          ),
        ].join("\n");

        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
            `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
          {
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              // O Google não relê o sitemap a cada minuto, e gerar isso a cada
              // acesso seria consulta ao banco à toa.
              "Cache-Control": "public, max-age=3600",
            },
          },
        );
      },
    },
  },
});
