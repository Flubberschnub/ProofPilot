import { createReadStream, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 8080);
const distDir = resolve("dist");
const backendUrl = process.env.BACKEND_URL ?? process.env.API_BASE_URL ?? process.env.VITE_API_BASE_URL;
const publicApiBaseUrl = process.env.PUBLIC_API_BASE_URL ?? "";

await mkdir(distDir, { recursive: true });
await writeFile(
  join(distDir, "config.js"),
  `window.__PROOFPILOT_CONFIG__=${JSON.stringify({ apiBaseUrl: publicApiBaseUrl })};\n`,
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

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    await proxyApiRequest(req, res, url);
    return;
  }

  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = resolve(join(distDir, requestedPath));
  const indexPath = join(distDir, "index.html");
  const safePath = filePath.startsWith(distDir) && existsSync(filePath) ? filePath : indexPath;

  res.setHeader("Content-Type", mimeTypes.get(extname(safePath)) ?? "application/octet-stream");
  createReadStream(safePath).pipe(res);
}).listen(port, "0.0.0.0", () => {
  console.log(`ProofPilot frontend listening on http://0.0.0.0:${port}`);
});

async function proxyApiRequest(req, res, url) {
  if (!backendUrl) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "BACKEND_URL is not configured for frontend API proxy." }));
    return;
  }

  try {
    const body = await readBody(req);
    const targetUrl = new URL(`${url.pathname}${url.search}`, backendUrl);
    const headers = copyHeaders(req.headers);
    const token = await getIdentityToken(backendUrl);
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: body.length ? body : undefined
    });

    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : "API proxy failed." }));
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function copyHeaders(headers) {
  const copied = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (!value || hopByHopHeaders.has(name.toLowerCase())) continue;
    copied.set(name, Array.isArray(value) ? value.join(",") : value);
  }
  return copied;
}

async function getIdentityToken(audience) {
  if (process.env.SKIP_BACKEND_AUTH === "true") return undefined;

  try {
    const response = await fetch(
      `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`,
      { headers: { "Metadata-Flavor": "Google" } }
    );
    return response.ok ? await response.text() : undefined;
  } catch {
    return undefined;
  }
}

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host"
]);
