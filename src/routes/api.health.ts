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
// Qual versão do código está rodando agora.
//
// Existe por causa de 18/09/2026: subi uma correção que mexia só no servidor e
// não consegui provar, de fora, que ela tinha entrado no ar. O navegador baixa
// exatamente os mesmos arquivos de antes, e nenhuma resposta do site diz qual
// commit está rodando. Sobra deduzir "deve ter subido" — que é precisamente
// como duas entregas foram engolidas pelo archive em 08/09 sem ninguém notar.
//
// Com isto, conferir um deploy é uma linha: se o commit aqui é o que foi
// empurrado, subiu. Se é o anterior, não subiu ainda.
//
// O Render injeta RENDER_GIT_COMMIT no contêiner. Rodando na máquina de casa a
// variável não existe, e aí a resposta diz "local" em vez de inventar um valor.
function versaoNoAr() {
  const commit = process.env.RENDER_GIT_COMMIT;
  if (commit) return commit.slice(0, 7);
  return process.env.NODE_ENV === "production" ? "desconhecida" : "local";
}

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
          versao: versaoNoAr(),
          cadastro: problemas.length ? "bloqueado" : "ok",
          configuracao: problemas.map((p) => p.chave),
        });
      },
    },
  },
});
