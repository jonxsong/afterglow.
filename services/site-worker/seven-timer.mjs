const WEATHER_ENDPOINT = "https://www.7timer.info/bin/api.pl";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_SAMPLE_DISTANCE_MS = 1.5 * HOUR_MS;
const FORECAST_DAYS = 7;

// METEO publishes ranges rather than exact percentages. These are their midpoints.
const CLOUD_PERCENT = [null, 3, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 97];

function cloudPercent(category) {
  return Number.isInteger(category) ? CLOUD_PERCENT[category] ?? null : null;
}

function humidityPercent(category) {
  if (!Number.isInteger(category) || category < -4 || category > 16) return null;
  if (category === 16) return 100;
  if (category === 15) return 97;
  return (category + 4) * 5 + 2.5;
}

function modelStart(init) {
  if (typeof init !== "string" || !/^\d{10}$/.test(init)) return NaN;
  const timestamp = Date.UTC(+init.slice(0, 4), +init.slice(4, 6) - 1, +init.slice(6, 8), +init.slice(8, 10));
  const normalized = new Date(timestamp).toISOString().slice(0, 13).replace(/\D/g, "");
  return normalized === init ? timestamp : NaN;
}

function localCalendarDay(timestamp, formatter) {
  const parts = Object.fromEntries(formatter.formatToParts(timestamp).map(({ type, value }) => [type, value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
}

function mod(value, divisor) {
  return (value % divisor + divisor) % divisor;
}

function sunsetOnLocalDay(day, latitude, longitude, formatter) {
  // Port of the approximate solar equation in services/api/app/solar.py.
  const radians = Math.PI / 180;
  const yearStart = Date.UTC(new Date(day).getUTCFullYear(), 0, 1);
  const dayOfYear = (day - yearStart) / DAY_MS + 1;
  const longitudeHours = longitude / 15;
  const approximateTime = dayOfYear + (18 - longitudeHours) / 24;
  const anomaly = .9856 * approximateTime - 3.289;
  const trueLongitude = mod(anomaly + 1.916 * Math.sin(anomaly * radians)
    + .020 * Math.sin(2 * anomaly * radians) + 282.634, 360);
  const ascension = mod(Math.atan(.91764 * Math.tan(trueLongitude * radians)) / radians, 360);
  const ascensionHours = (ascension + Math.floor(trueLongitude / 90) * 90 - Math.floor(ascension / 90) * 90) / 15;
  const sinDeclination = .39782 * Math.sin(trueLongitude * radians);
  const cosDeclination = Math.cos(Math.asin(sinDeclination));
  const cosHourAngle = (Math.cos(90.833 * radians) - sinDeclination * Math.sin(latitude * radians))
    / (cosDeclination * Math.cos(latitude * radians));
  if (cosHourAngle < -1 || cosHourAngle > 1) return null;

  const hourAngle = Math.acos(cosHourAngle) / radians / 15;
  const localMeanHours = hourAngle + ascensionHours - .06571 * approximateTime - 6.622;
  const utcHours = mod(localMeanHours - longitudeHours, 24);
  const utcTime = day + utcHours * HOUR_MS;

  // The UTC clock may belong to the adjacent UTC day, notably west of Greenwich.
  for (const shift of [0, DAY_MS, -DAY_MS]) {
    const candidate = Math.round((utcTime + shift) / 1000) * 1000;
    if (localCalendarDay(candidate, formatter) === day) return candidate;
  }
  return null;
}

export async function fetchSevenTimerForecast({ latitude, longitude, timezone, now = Date.now(), fetchImpl = fetch }) {
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude)
    || Math.abs(longitude) > 180 || !Number.isFinite(now) || typeof timezone !== "string") return null;

  try {
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
    const today = localCalendarDay(now, formatter);
    const url = new URL(WEATHER_ENDPOINT);
    url.search = new URLSearchParams({
      lat: latitude.toFixed(3), lon: longitude.toFixed(3), product: "meteo", output: "json",
    });
    const response = await fetchImpl(url.toString(), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }

    const forecast = await response.json();
    const start = modelStart(forecast?.init);
    if (forecast?.product !== "meteo" || !Array.isArray(forecast.dataseries)
      || !Number.isFinite(start) || start > now || now - start > 18 * HOUR_MS) return null;

    const points = new Map();
    for (const point of forecast.dataseries) {
      if (!Number.isInteger(point?.timepoint) || point.timepoint <= 0 || point.timepoint > 240) continue;
      const cloud = cloudPercent(point.cloudcover);
      if (cloud === null) continue;
      const time = start + point.timepoint * HOUR_MS;
      points.set(time, {
        time,
        cloud,
        low: cloudPercent(point.lowcloud),
        mid: cloudPercent(point.midcloud),
        high: cloudPercent(point.highcloud),
        humidity: humidityPercent(point.rh2m),
      });
    }

    const samples = [...points.values()].sort((first, second) => first.time - second.time);
    const sunsets = Array.from({ length: FORECAST_DAYS }, (_, index) => {
      const sunset = sunsetOnLocalDay(today + index * DAY_MS, latitude, longitude, formatter);
      if (sunset === null || !samples.some(({ time }) => Math.abs(time - sunset) <= MAX_SAMPLE_DISTANCE_MS)) return null;
      return sunset / 1000;
    });
    if (sunsets[0] === null) return null;

    return {
      payload: {
        hourly: {
          time: samples.map(({ time }) => time / 1000),
          cloud_cover: samples.map(({ cloud }) => cloud),
          cloud_cover_low: samples.map(({ low }) => low),
          cloud_cover_mid: samples.map(({ mid }) => mid),
          cloud_cover_high: samples.map(({ high }) => high),
          relative_humidity_2m: samples.map(({ humidity }) => humidity),
          visibility: samples.map(() => null),
          precipitation_probability: samples.map(() => null),
        },
        daily: { sunset: sunsets },
      },
      maxAge: 600,
    };
  } catch {
    return null;
  }
}
