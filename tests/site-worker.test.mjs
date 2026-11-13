import assert from "node:assert/strict";
import test from "node:test";
import { createWorker } from "../services/site-worker/runtime.mjs";

const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const forecast = { date: "2026-11-12", location: "San Francisco, California", sunset: "4:59 PM", palette: ["#F8D6AE"], dominant_colors: ["Peach"], vibrancy: 78, confidence: 84, summary: "Warm afterglow.", atmosphere: { cloud_cover: 42 } };

test("serves embedded static assets", async () => {
  const worker = createWorker({ "/index.html": { body: btoa("<h1>Afterglow</h1>"), type: "text/html; charset=utf-8" } });
  const response = await worker.fetch(new Request("https://afterglow.test/"));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<h1>Afterglow</h1>");
});

test("keeps AI unavailable without a server-side key", async () => {
  const worker = createWorker();
  const response = await worker.fetch(new Request("https://afterglow.test/api/ai/analyze", { method: "POST", body: JSON.stringify({ image_data_url: image, forecast }) }));
  assert.equal(response.status, 503);
});

test("sends image and forecast through the Responses API with storage disabled", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: JSON.stringify({ title: "Rose hour", observed_mood: "Quiet", color_story: "Rose and amber.", atmosphere_story: "Layered cloud catches the light.", forecast_match: "The warm palette aligned.", photography_tip: "Expose for the highlights.", confidence_note: "Visual interpretation only.", match_score: 88 }) }] }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const worker = createWorker();
    const response = await worker.fetch(new Request("https://afterglow.test/api/ai/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image_data_url: image, locale: "en", forecast }) }), { OPENAI_API_KEY: "test-secret", OPENAI_MODEL: "gpt-test" });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.match_score, 88);
    assert.equal(captured.url, "https://api.openai.com/v1/responses");
    assert.equal(captured.body.model, "gpt-test");
    assert.equal(captured.body.store, false);
    assert.equal(captured.init.headers.authorization, "Bearer test-secret");
    assert.equal(captured.body.input[1].content[1].type, "input_image");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
