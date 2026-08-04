import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const sourceDir = path.resolve("node_modules", "@electric-sql", "pglite", "dist");
const destinationDir = path.resolve(".output", "server", "_libs");
const assets = ["pglite.data", "pglite.wasm", "initdb.wasm"];

await mkdir(destinationDir, { recursive: true });
await Promise.all(
  assets.map((asset) => copyFile(path.join(sourceDir, asset), path.join(destinationDir, asset))),
);

console.log("PGlite runtime assets copied.");
