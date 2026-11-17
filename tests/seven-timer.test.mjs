import assert from "node:assert/strict";
import test from "node:test";
import { fetchSevenTimerForecast } from "../services/site-worker/seven-timer.mjs";

const now = Date.parse("2026-11-17T22:00:00Z");
const sanFrancisco = { latitude: 37.7749, longitude: -122.4194, timezone: "America/Los_Angeles" };
const tokyo = { latitude: 35.6895, longitude: 139.6917, timezone: "Asia/Tokyo" };
const dataseries = Array.from({ length: 64 }, (_, offset) => ({
  timepoint: (offset + 1) * 3,
  cloudcover: 5,
  highcloud: 4,
  midcloud: 1,
  lowcloud: 2,
  rh2m: 4,
  prec_type: "none",
  prec_amount: 0,
}));
const meteo = { product: "meteo", init: "2026111718", dataseries };

function fixture(payload) {
  return async () => Response.json(payload);
}

test("adapts global 7Timer measurements and aligns UTC samples to the city's sunset week", async () => {
  const result = await fetchSevenTimerForecast({
    ...sanFrancisco,
    now,
    async fetchImpl(requestUrl, options) {
      const url = new URL(requestUrl);
      assert.equal(url.origin, "https://www.7timer.info");
      assert.equal(url.searchParams.get("product"), "meteo");
      assert.equal(url.searchParams.get("lon"), "-122.419");
      assert.ok(options.signal instanceof AbortSignal);
      return Response.json(meteo);
    },
  });

  assert.ok(result);
  const { hourly, daily } = result.payload;
  assert.equal(new Date(hourly.time[0] * 1000).toISOString(), "2026-11-17T21:00:00.000Z");
  assert.equal(hourly.cloud_cover[0], 50);
  assert.equal(hourly.cloud_cover_high[0], 37.5);
  assert.equal(hourly.cloud_cover_mid[0], 3);
  assert.equal(hourly.cloud_cover_low[0], 12.5);
  assert.equal(hourly.relative_humidity_2m[0], 42.5);
  assert.equal(hourly.visibility[0], null);
  assert.equal(hourly.precipitation_probability[0], null);
  assert.equal(daily.sunset.length, 7);
  assert.ok(daily.sunset.every(Number.isFinite));
  // San Francisco's November 17 sunset falls on November 18 UTC.
  assert.ok(Math.abs(daily.sunset[0] * 1000 - Date.parse("2026-11-18T00:56:00Z")) < 2 * 60_000);

  const japaneseForecast = await fetchSevenTimerForecast({ ...tokyo, now, fetchImpl: fixture(meteo) });
  assert.ok(japaneseForecast);
  // At the same instant, Tokyo's local date is already November 18.
  assert.ok(Math.abs(japaneseForecast.payload.daily.sunset[0] * 1000 - Date.parse("2026-11-18T07:31:00Z")) < 2 * 60_000);
});

test("rejects stale runs, failed responses, and weather without a sample near today's sunset", async () => {
  const input = { ...sanFrancisco, now };
  assert.equal(await fetchSevenTimerForecast({ ...input, fetchImpl: fixture({ ...meteo, init: "2026111606" }) }), null);
  assert.equal(await fetchSevenTimerForecast({ ...input, fetchImpl: async () => new Response(null, { status: 429 }) }), null);
  assert.equal(await fetchSevenTimerForecast({ ...input, fetchImpl: fixture({ ...meteo, dataseries: [dataseries[0]] }) }), null);
});

test("preserves missing layer values and humidity instead of guessing them", async () => {
  const missingDetails = dataseries.map((point) => ({ ...point, highcloud: -9999, rh2m: -9999 }));
  const result = await fetchSevenTimerForecast({ ...sanFrancisco, now, fetchImpl: fixture({ ...meteo, dataseries: missingDetails }) });
  assert.ok(result);
  assert.equal(result.payload.hourly.cloud_cover_high[0], null);
  assert.equal(result.payload.hourly.relative_humidity_2m[0], null);
});
