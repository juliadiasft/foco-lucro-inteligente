// Sobe o sistema numa porta separada, com um banco local descartável.
//
//   node scripts/preview-local.mjs [pasta-do-banco] [porta]
//
// Serve para olhar uma tela sem encostar no banco com que você navega no dia a
// dia (.local-data) — e para conferir uma mudança antes de publicar.
//
// Duas coisas aqui não são capricho, e as duas custaram tempo em 17/09/2026:
//
// 1. O banco nasce FORA do projeto, no temporário do sistema. A pasta do
//    projeto está dentro do OneDrive, e o PGlite não abre banco lá: a
//    sincronização mexe nos arquivos embaixo do processo e o erro que aparece
//    é "PGlite failed to initialize properly", que não diz nada sobre a causa.
//
// 2. O vite sobe pela API dele, e não chamando o executável. O caminho deste
//    projeto tem espaço no nome ("Central do Comerciante") e o cmd do Windows
//    quebra nele com "'C:\Program' não é reconhecido como um comando".
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const pasta = process.argv[2] || mkdtempSync(path.join(os.tmpdir(), "central-preview-"));
const porta = Number(process.argv[3] || 3111);

process.env.LOCAL_DB_DIR = pasta;
// Um segredo de desenvolvimento, longo o bastante para o cadastro funcionar.
// Não é segredo de verdade: este banco é descartável e local.
process.env.DOCUMENT_HASH_SECRET ||= "preview-local-segredo-de-quarenta-caracteres-ok";

console.log(`Banco descartável em ${pasta}`);

const { createServer } = await import("vite");
const servidor = await createServer({
  configLoader: "runner",
  server: { port: porta, strictPort: true },
});
await servidor.listen();
servidor.printUrls();
