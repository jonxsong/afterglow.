import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staticRoot = path.join(root, "apps", "web", "out");
const runtimePath = path.join(root, "services", "site-worker", "runtime.mjs");
const outputPath = path.join(root, "dist", "server", "index.js");

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? filesIn(path.join(directory, entry.name)) : [path.join(directory, entry.name)]));
  return nested.flat();
}

function mimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return ({
    ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".ico": "image/x-icon",
    ".jpeg": "image/jpeg", ".jpg": "image/jpeg", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
    ".png": "image/png", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8", ".webp": "image/webp",
    ".woff": "font/woff", ".woff2": "font/woff2",
  })[extension] ?? "application/octet-stream";
}

const assets = {};
for (const filePath of await filesIn(staticRoot)) {
  const key = `/${path.relative(staticRoot, filePath).split(path.sep).join("/")}`;
  assets[key] = { body: (await readFile(filePath)).toString("base64"), type: mimeType(filePath) };
}

const runtime = await readFile(runtimePath, "utf8");
const marker = "export default createWorker({});";
if (!runtime.includes(marker)) throw new Error("Worker runtime marker was not found.");
const bundled = `const ASSETS = ${JSON.stringify(assets)};\n${runtime.replace(marker, "export default createWorker(ASSETS);")}`;
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, bundled);
console.log(`Built site worker with ${Object.keys(assets).length} assets.`);
