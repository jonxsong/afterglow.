import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { buildForecastShareUrl, readForecastShareLocation } from "../apps/web/lib/forecast-share.ts";

const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");

const origin = "https://afterglow.jonzhang.dev";
const snapshotMaxAgeMs = 12 * 60 * 60 * 1000;
const cities = [
  { name: "San Francisco", region: "California", country: "United States", latitude: 37.7749, longitude: -122.4194, timezone: "America/Los_Angeles" },
  { name: "Bogotá", country: "Colombia", latitude: 4.711, longitude: -74.0721, timezone: "America/Bogota" },
  { name: "Accra", country: "Ghana", latitude: 5.6037, longitude: -0.187, timezone: "Africa/Accra" },
  { name: "Nairobi", country: "Kenya", latitude: -1.2921, longitude: 36.8219, timezone: "Africa/Nairobi" },
  { name: "Bangkok", country: "Thailand", latitude: 13.7563, longitude: 100.5018, timezone: "Asia/Bangkok" },
  { name: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503, timezone: "Asia/Tokyo" },
  { name: "Auckland", country: "New Zealand", latitude: -36.8509, longitude: 174.7645, timezone: "Pacific/Auckland" },
  { name: "Honolulu", region: "Hawaii", country: "United States", latitude: 21.3069, longitude: -157.8583, timezone: "Pacific/Honolulu" },
];

function localDay(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return [fields.year, fields.month, fields.day].join("-");
}

function nearestLocalNoon(now) {
  function hoursFromNoon(city) {
    const hour = new Intl.DateTimeFormat("en", {
      timeZone: city.timezone, hour: "numeric", hourCycle: "h23",
    }).format(now);
    return Math.abs(12 - Number(hour));
  }
  return cities.reduce((closest, city) => hoursFromNoon(city) < hoursFromNoon(closest) ? city : closest);
}

const shareUrl = new URL(process.argv[2] ?? buildForecastShareUrl(nearestLocalNoon(new Date()), origin));
const location = readForecastShareLocation(shareUrl.search);
assert.ok(location && shareUrl.hash === "#forecast" && ["http:", "https:"].includes(shareUrl.protocol), "Expected an Afterglow city share URL ending in #forecast.");

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", locale: "en-US", timezoneId: "UTC" });
  const forecastRequest = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.origin === shareUrl.origin && url.pathname === "/api/v1/forecast/weekly";
  }, { timeout: 25000 });
  const [home, forecast] = await Promise.all([
    page.goto(shareUrl.href, { waitUntil: "domcontentloaded", timeout: 20000 }),
    forecastRequest,
  ]);
  assert.equal(home?.status(), 200, "The public city share link must load successfully.");
  assert.equal(new URL(page.url()).hash, "#forecast");

  const query = new URL(forecast.url()).searchParams;
  assert.equal(query.get("name"), location.name, "The browser must request the shared city on first load.");
  assert.equal(query.get("timezone"), location.timezone);
  assert.equal(query.get("latitude"), String(location.latitude));
  assert.equal(query.get("longitude"), String(location.longitude));
  assert.equal(forecast.status(), 200, `No usable forecast was returned for ${location.name}.`);

  const data = await forecast.json();
  assert.equal(data.location?.name, location.name);
  assert.equal(data.location?.timezone, location.timezone);
  assert.ok(["open-meteo", "7timer"].includes(data.weather_source), "The forecast must identify its weather source.");
  assert.ok(["live", "cache"].includes(data.freshness?.source), "The forecast must identify freshness.");
  const fetchedAt = Date.parse(data.freshness.fetched_at);
  const receivedAt = Date.now();
  const age = receivedAt - fetchedAt;
  assert.ok(Number.isFinite(age) && age >= -60000 && age <= snapshotMaxAgeMs, "The forecast must report a recent retrieval time.");

  const tonight = data.days?.[0];
  assert.equal(tonight?.date, localDay(receivedAt, location.timezone), "The forecast must be for today in the selected city's time zone.");
  const sunset = new Date(tonight.sunset_at);
  assert.ok(Number.isFinite(sunset.getTime()), "The forecast must include a usable sunset timestamp.");
  assert.equal(localDay(sunset, location.timezone), tonight.date);
  assert.ok(Array.isArray(tonight.palette) && tonight.palette.length === 5 && tonight.palette.every((color) => /^#[0-9a-f]{6}$/i.test(color)), "The forecast must include a usable sunset palette.");
  assert.ok(Number.isFinite(tonight.vibrancy) && tonight.vibrancy >= 0 && tonight.vibrancy <= 100, "The forecast must include a usable vibrancy score.");

  const sunsetTime = new Intl.DateTimeFormat("en-US", { timeZone: location.timezone, hour: "numeric", minute: "2-digit" }).format(sunset);
  await expect(page.locator("#forecast-heading")).toContainText(location.name);
  const card = page.locator("#forecast .forecast-card:not(.forecast-preview)");
  await expect(card).toBeVisible();
  await expect(card.getByRole("slider", { name: "Explore the evening" })).toHaveAttribute("aria-valuetext", `${sunsetTime}, Sunset`);
  console.log(`Afterglow forecast OK: ${location.name} on ${tonight.date} at ${sunsetTime} (${data.weather_source}, ${data.freshness.source}).`);
} finally {
  await browser.close();
}
