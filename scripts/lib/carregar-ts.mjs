// Carrega um módulo TypeScript do projeto dentro de um script .mjs.
//
// Por que isto existe: o Node consegue tirar os tipos de um .ts sozinho, mas
// só resolve import que traz a extensão. O projeto inteiro importa sem
// extensão ("./db.server"), então `import('./billing.server.ts')` morre no
// primeiro import interno.
//
// Sair adicionando ".ts" em todo o código só para os testes conseguirem ler
// seria deixar a casa torta para acomodar a visita. O Vite já é dependência do
// projeto e já sabe resolver esses caminhos — é só pedir para ele.
//
// Serve para testar código de servidor de verdade, e não uma cópia dele
// reescrita no teste. A diferença aparece no dia em que o código muda e o
// teste continua passando.
import { createServer } from "vite";

let servidor;

/** Carrega um módulo do projeto pelo caminho relativo à raiz. Ex.: "src/lib/server/billing.server.ts" */
export async function carregarModulo(caminho) {
  if (!servidor) {
    servidor = await createServer({
      configFile: false,
      appType: "custom",
      // Sem isto o Vite tenta abrir uma porta e ficar escutando, o que um
      // script de teste não precisa.
      server: { middlewareMode: true, hmr: false, watch: null },
      logLevel: "error",
      resolve: { alias: { "@": new URL("../../src", import.meta.url).pathname } },
    });
  }
  return servidor.ssrLoadModule(caminho);
}

export async function fecharCarregador() {
  if (servidor) {
    await servidor.close();
    servidor = undefined;
  }
}
