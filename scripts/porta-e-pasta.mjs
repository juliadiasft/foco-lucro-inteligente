// Dá a cada execução de teste uma porta e uma pasta de banco só dela.
//
// Existe por causa de uma falha que não é do sistema e mesmo assim assusta:
// dois testes rodando ao mesmo tempo — a pessoa numa janela, o assistente em
// outra — usavam a mesma porta e a mesma pasta. O primeiro a terminar apagava
// a pasta do outro, e o outro morria com "relation companies does not exist",
// que parece banco quebrado e é só atropelo.
//
// Tentei antes resolver avisando quando a porta estava ocupada. Não resolve:
// se a segunda execução começa quando a primeira ainda está subindo, o aviso
// não dispara e o atropelo acontece igual.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import path from "node:path";

/** Uma porta que o sistema operacional garante estar livre agora. */
export function portaLivre() {
  return new Promise((resolve, reject) => {
    const servidor = createServer();
    servidor.unref();
    servidor.on("error", reject);
    // Porta 0 quer dizer "escolha uma livre". Fechamos logo em seguida e
    // devolvemos o número: sobra uma fresta entre fechar e o teste subir, mas
    // é muito menor que a chance de duas execuções escolherem a mesma porta
    // fixa.
    servidor.listen(0, "127.0.0.1", () => {
      const { port } = servidor.address();
      servidor.close(() => resolve(port));
    });
  });
}

/**
 * Uma pasta de banco nova, na área temporária do sistema.
 *
 * Fora do projeto de propósito, e não é detalhe. O projeto mora dentro do
 * OneDrive, que sincroniza tudo que aparece lá: um banco de teste de 40 MB
 * viraria upload, e — pior — o OneDrive segura o arquivo enquanto sincroniza,
 * fazendo o apagar do começo do teste falhar sem avisar. A execução seguinte
 * então abria um banco pela metade e morria com "PGlite failed to initialize
 * properly", que não diz nada sobre a causa.
 *
 * A primeira versão disto punha o número do processo no nome da pasta, dentro
 * do projeto. Não bastou: o sistema reaproveita esses números, e uma execução
 * nova reabria a pasta suja de uma execução antiga que tinha morrido. O
 * mkdtemp resolve os dois de uma vez — cria uma pasta que ainda não existe,
 * sempre, e longe do OneDrive.
 */
export function pastaPropria(prefixo) {
  return mkdtempSync(path.join(tmpdir(), `central-${prefixo}-`));
}
