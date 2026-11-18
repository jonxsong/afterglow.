import { createServer } from "node:http";
import worker from "../dist/server/index.js";
import { createLocalForecastDb } from "./local-forecast-db.mjs";

const port = Number(process.env.PORT || 4173);
const database = createLocalForecastDb();
const server = createServer(async (incoming, outgoing) => {
  try {
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(`http://localhost:${port}${incoming.url}`, {
      method: incoming.method,
      headers: incoming.headers,
      body,
      duplex: body ? "half" : undefined,
    });
    const response = await worker.fetch(request, {
      DB: database,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_MODEL: process.env.OPENAI_MODEL,
    });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    outgoing.end("Local preview failed.");
  }
});
server.on("close", () => database.close());
server.listen(port, "127.0.0.1", () => console.log(`Afterglow preview: http://localhost:${port}`));
