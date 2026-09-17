import { createFileRoute } from "@tanstack/react-router";

import { avisoParaOLog, problemasDeConfiguracao } from "@/lib/configuracao";
import { query } from "@/lib/server/db.server";

// O monitor externo e o HEALTHCHECK do contêiner batem aqui.
//
// Configuração faltando NÃO derruba a resposta para 503 de propósito: o
// HEALTHCHECK do Dockerfile usa este endereço, e um 503 faria o Render
// reiniciar o contêiner em laço por causa de uma variável de ambiente — o
// site inteiro cairia para punir um problema que afeta só o cadastro.
//
// O que ele faz é aparecer no corpo da resposta e no log, que é onde dá para
// ver sem derrubar nada.
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await query("SELECT 1");
        } catch {
          return Response.json({ status: "unavailable" }, { status: 503 });
        }
        const problemas = problemasDeConfiguracao(process.env);
        if (problemas.length) console.error(avisoParaOLog(problemas));
        return Response.json({
          status: "ok",
          cadastro: problemas.length ? "bloqueado" : "ok",
          configuracao: problemas.map((p) => p.chave),
        });
      },
    },
  },
});
