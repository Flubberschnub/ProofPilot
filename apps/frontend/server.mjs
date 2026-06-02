import { createReadStream, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 8080);
const distDir = resolve("dist");
const apiBaseUrl = process.env.API_BASE_URL ?? process.env.VITE_API_BASE_URL ?? "http://localhost:8080";

await mkdir(distDir, { recursive: true });
await writeFile(
  join(distDir, "config.js"),
  `window.__PROOFPILOT_CONFIG__=${JSON.stringify({ apiBaseUrl })};\n`,
  "utf8"
);

const mimeTypes = new Map([
  [".css", "text/css"],
  [".html", "text/html"],
  [".js", "text/javascript"],
  [".json", "application/json"],
  [".map", "application/json"],
  [".svg", "image/svg+xml"]
]);

createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = resolve(join(distDir, requestedPath));
  const indexPath = join(distDir, "index.html");
  const safePath = filePath.startsWith(distDir) && existsSync(filePath) ? filePath : indexPath;

  res.setHeader("Content-Type", mimeTypes.get(extname(safePath)) ?? "application/octet-stream");
  createReadStream(safePath).pipe(res);
}).listen(port, "0.0.0.0", () => {
  console.log(`ProofPilot frontend listening on http://0.0.0.0:${port}`);
});
