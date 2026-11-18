import assert from "node:assert/strict";
import test from "node:test";
import { createLocalForecastDb } from "../scripts/local-forecast-db.mjs";
import { readForecastSnapshot, saveForecastSnapshot } from "../services/site-worker/forecast-store.mjs";

const HOUR_MS = 60 * 60 * 1000;
const now = Date.parse("2026-11-17T23:00:00Z");
const key = "forecast:v1:37.775:-122.419:America/Los_Angeles:2026-11-17";
const payload = { hourly: { time: [1794960000], cloud_cover: [40] }, daily: { sunset: [1794960000] } };
const snapshot = { source: "7timer", fetchedAt: now, payload };

function openDb(t) {
  const db = createLocalForecastDb();
  t.after(() => db.close());
  return db;
}

test("shares a validated forecast payload for the same city day and expires it after 12 hours", async (t) => {
  const db = openDb(t);
  assert.equal(await saveForecastSnapshot(db, key, {
    ...snapshot,
    payload: { ...payload, location: { name: "Private label" } },
  }), true);
  assert.deepEqual(await readForecastSnapshot(db, key, now + HOUR_MS), snapshot);
  assert.equal(await readForecastSnapshot(db, key, now - 1), null);
  assert.equal(await readForecastSnapshot(db, key, now + 12 * HOUR_MS), null);
  assert.equal(await readForecastSnapshot(db, key.replace("2026-11-17", "2026-11-18"), now), null);
});

test("keeps the newest successful snapshot when requests finish out of order", async (t) => {
  const db = openDb(t);
  assert.equal(await saveForecastSnapshot(db, key, snapshot), true);
  assert.equal(await saveForecastSnapshot(db, key, { ...snapshot, source: "open-meteo", fetchedAt: now - 1 }), true);
  assert.deepEqual(await readForecastSnapshot(db, key, now), snapshot);
});

test("prunes a bounded batch of expired records while leaving recent forecasts accessible", async (t) => {
  const db = openDb(t);
  const expiredAt = now - 13 * HOUR_MS;
  const insert = db.prepare("INSERT INTO forecast_snapshots VALUES (?, ?, ?, ?)");
  for (let count = 0; count < 20; count += 1) {
    insert.bind(`expired:${count}`, "7timer", expiredAt, JSON.stringify(payload)).run();
  }
  await saveForecastSnapshot(db, key, snapshot);
  const row = await db.prepare("SELECT count(*) AS total FROM forecast_snapshots").first();
  assert.equal(row.total, 5);
  assert.equal(await readForecastSnapshot(db, "expired:19", now), null);
  assert.deepEqual(await readForecastSnapshot(db, key, now), snapshot);
});

test("an unavailable database cannot block the live forecast path", async () => {
  const unavailable = { prepare() { throw new Error("Database unavailable"); } };
  for (const db of [undefined, unavailable]) {
    assert.equal(await readForecastSnapshot(db, key, now), null);
    assert.equal(await saveForecastSnapshot(db, key, snapshot), false);
  }
});
