import { spawn } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";

const applicationPort = 8080;
const publicPort = 3000;

const application = spawn(process.execPath, [".output/server/index.mjs"], {
  env: { ...process.env, PORT: String(applicationPort) },
  stdio: "inherit",
});

const proxy = createServer((clientRequest, clientResponse) => {
  const upstreamRequest = httpRequest(
    {
      hostname: "127.0.0.1",
      port: applicationPort,
      path: clientRequest.url,
      method: clientRequest.method,
      headers: clientRequest.headers,
    },
    (upstreamResponse) => {
      clientResponse.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(clientResponse);
    },
  );

  upstreamRequest.on("error", () => {
    if (!clientResponse.headersSent) {
      clientResponse.writeHead(502, { "content-type": "application/json" });
    }
    clientResponse.end(JSON.stringify({ ok: false, error: "Serviço iniciando" }));
  });

  clientRequest.pipe(upstreamRequest);
});

proxy.listen(publicPort, "0.0.0.0", () => {
  console.log(`Public proxy listening on http://0.0.0.0:${publicPort}`);
});

application.on("exit", (code) => {
  proxy.close(() => process.exit(code ?? 1));
});

function shutdown(signal) {
  proxy.close();
  application.kill(signal);
  setTimeout(() => process.exit(0), 5_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
