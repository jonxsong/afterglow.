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

test("reports public worker health", async () => {
  const response = await createWorker().fetch(new Request("https://afterglow.test/health"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", service: "afterglow" });
});

test("proxies and caches Open-Meteo forecast requests", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ daily: { sunset: ["2026-11-14T16:58"] }, hourly: { time: [] } }), {
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const response = await createWorker().fetch(new Request("https://afterglow.test/api/weather/forecast?latitude=37.7749&longitude=-122.4194"));
    assert.equal(response.status, 200);
    assert.equal(captured.url, "https://api.open-meteo.com/v1/forecast?latitude=37.7749&longitude=-122.4194");
    assert.equal(captured.init.headers.accept, "application/json");
    assert.match(response.headers.get("cache-control"), /max-age=300/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("uses fresh 7Timer weather when Open-Meteo returns 429 and backs off during the limit", async (t) => {
  const calls = [];
  t.mock.method(Date, "now", () => Date.parse("2026-11-17T22:00:00Z"));
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    calls.push(url.hostname);
    if (url.hostname === "api.open-meteo.com") return new Response(null, { status: 429, headers: { "retry-after": "90" } });
    assert.equal(url.hostname, "www.7timer.info");
    return Response.json({
      product: "meteo", init: "2026111718",
      dataseries: Array.from({ length: 64 }, (_, i) => ({ timepoint: (i + 1) * 3, cloudcover: 5, rh2m: 4 })),
    });
  });
  const worker = createWorker();
  const forecastRequest = (latitude, longitude, timezone) => new Request(
    `https://afterglow.test/api/weather/forecast?${new URLSearchParams({ latitude, longitude, timezone, timeformat: "unixtime" })}`,
  );
  const sf = forecastRequest("37.7749", "-122.4194", "America/Los_Angeles");
  const response = await worker.fetch(sf);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-afterglow-weather-source"), "7timer");
  const data = await response.json();
  assert.equal(data.hourly.cloud_cover[0], 50);
  assert.equal(data.hourly.visibility[0], null);
  assert.equal(data.daily.sunset.length, 7);
  assert.equal((await worker.fetch(sf)).status, 200);
  const tokyo = await worker.fetch(forecastRequest("35.6762", "139.6503", "Asia/Tokyo"));
  assert.equal(tokyo.headers.get("x-afterglow-weather-source"), "7timer");
  assert.deepEqual(calls, ["api.open-meteo.com", "www.7timer.info", "www.7timer.info"]);
});

test("retries transient weather failures", async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts < 3) return new Response("unavailable", { status: 503 });
    return new Response(JSON.stringify({ results: [] }), { headers: { "content-type": "application/json" } });
  };
  try {
    const response = await createWorker().fetch(new Request("https://afterglow.test/api/weather/geocoding?name=San%20Francisco"));
    assert.equal(response.status, 200);
    assert.equal(attempts, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
