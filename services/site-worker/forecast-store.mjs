const SNAPSHOT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const PRUNE_LIMIT = 16;
const MAX_PAYLOAD_LENGTH = 64 * 1024;
const weatherSources = new Set(["open-meteo", "7timer"]);

function weatherFields(payload) {
  return payload?.hourly && payload?.daily ? { hourly: payload.hourly, daily: payload.daily } : null;
}

export async function readForecastSnapshot(db, key, now = Date.now()) {
  if (!db) return null;
  try {
    const row = await db.prepare(`
      SELECT source, fetched_at, payload_json
      FROM forecast_snapshots
      WHERE cache_key = ? AND fetched_at > ? AND fetched_at <= ?
    `).bind(key, now - SNAPSHOT_MAX_AGE_MS, now).first();
    if (!row || !weatherSources.has(row.source)) return null;

    const payload = weatherFields(JSON.parse(row.payload_json));
    return payload ? { payload, source: row.source, fetchedAt: row.fetched_at } : null;
  } catch {
    return null;
  }
}

export async function saveForecastSnapshot(db, key, { payload, source, fetchedAt }) {
  if (!db || !weatherSources.has(source) || !Number.isSafeInteger(fetchedAt) || fetchedAt <= 0) return false;
  try {
    const weather = weatherFields(payload);
    if (!weather) return false;
    const serialized = JSON.stringify(weather);
    if (serialized.length > MAX_PAYLOAD_LENGTH) return false;

    const upsert = db.prepare(`
      INSERT INTO forecast_snapshots (cache_key, source, fetched_at, payload_json)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (cache_key) DO UPDATE SET
        source = excluded.source,
        fetched_at = excluded.fetched_at,
        payload_json = excluded.payload_json
      WHERE excluded.fetched_at > forecast_snapshots.fetched_at
    `).bind(key, source, fetchedAt, serialized);
    const prune = db.prepare(`
      DELETE FROM forecast_snapshots WHERE cache_key IN (
        SELECT cache_key FROM forecast_snapshots WHERE fetched_at <= ? ORDER BY fetched_at LIMIT ?
      )
    `).bind(fetchedAt - SNAPSHOT_MAX_AGE_MS, PRUNE_LIMIT);
    await db.batch([upsert, prune]);
    return true;
  } catch {
    return false;
  }
}
