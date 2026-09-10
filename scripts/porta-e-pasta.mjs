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
// não dispara e o atropelo acontece igual. Porta e pasta próprias resolvem de
// vez, sem ninguém precisar lembrar de esperar.
import { createServer } from "node:net";
import process from "node:process";

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

/** Nome de pasta que não colide com outra execução. */
export function pastaPropria(prefixo) {
  return `.local-${prefixo}-${process.pid}`;
}
