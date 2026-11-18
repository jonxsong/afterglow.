const FORECAST_DAY_MS = 86_400_000;
const MAX_HOURLY_SAMPLES = 200;

export const forecastWeatherFields = Object.freeze([
  "cloud_cover",
  "cloud_cover_low",
  "cloud_cover_mid",
  "cloud_cover_high",
  "relative_humidity_2m",
  "visibility",
  "precipitation_probability",
]);

const skyTypes = {
  clear: {
    palette: ["#F8D6AE", "#F4B184", "#E88772", "#B9798D", "#6F6A9B"],
    colors: ["Apricot", "Coral", "Violet"],
    summary: "A clean horizon, warm at first and violet after.",
  },
  dramatic: {
    palette: ["#F9C58B", "#F08B6E", "#CF6683", "#8E638F", "#4C5278"],
    colors: ["Amber", "Rose", "Plum"],
    summary: "A layered sky with a strong chance of dramatic color.",
  },
  soft: {
    palette: ["#F0D3BE", "#E6B4B1", "#C99BB5", "#9A8FB2", "#777A9B"],
    colors: ["Peach", "Rose", "Lavender"],
    summary: "Soft color with a gentle, lingering afterglow.",
  },
  muted: {
    palette: ["#D9CFBF", "#C9B4AA", "#A89DA4", "#84858E", "#666D78"],
    colors: ["Pewter", "Mauve", "Slate"],
    summary: "Quiet color behind a soft, clouded horizon.",
  },
};

export const defaultForecastPalette = Object.freeze(skyTypes.soft.palette);

function localDateFormatter(timeZone) {
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", day: "2-digit", timeZone });
}

function formatLocalDate(formatter, time) {
  const parts = formatter.formatToParts(time);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function forecastLocalDate(time, timezone) {
  return formatLocalDate(localDateFormatter(timezone), time);
}

function forecastId(location, sunset) {
  const input = `${location.latitude}-${location.longitude}-${sunset}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  return `web-${(hash >>> 0).toString(16)}-${input.slice(0, 10).replaceAll("-", "")}`;
}

function isTimestamp(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= 8_640_000_000_000;
}

function hasValidWeatherShape(payload) {
  const times = payload?.hourly?.time;
  const sunsets = payload?.daily?.sunset;
  const clouds = payload?.hourly?.cloud_cover;
  if (!Array.isArray(times) || !times.length || times.length > MAX_HOURLY_SAMPLES ||
      !Array.isArray(sunsets) || !sunsets.length || sunsets.length > 7 || !Array.isArray(clouds)) return false;
  if (!times.every((time, index) => isTimestamp(time) && (index === 0 || time > times[index - 1])) ||
      !sunsets.every((sunset) => sunset === null || isTimestamp(sunset))) return false;

  for (const field of forecastWeatherFields) {
    const values = payload.hourly[field];
    if (values === undefined) continue;
    const max = field === "visibility" ? Infinity : 100;
    if (!Array.isArray(values) || values.length !== times.length ||
        !values.every((value) => value === null || (Number.isFinite(value) && value >= 0 && value <= max))) return false;
  }
  return true;
}

function closestSample(times, sunset) {
  let index = 0;
  for (let i = 1; i < times.length; i += 1) {
    if (Math.abs(times[i] - sunset) < Math.abs(times[index] - sunset)) index = i;
  }
  return index;
}

function skyType({ low, mid, high, cloud, rain, clearHorizon }) {
  if ((low ?? cloud) > 78 || (rain ?? 0) > 72) return skyTypes.muted;
  if (high !== null && mid !== null && high + mid > 85 && clearHorizon > .45) return skyTypes.dramatic;
  if (cloud < 22) return skyTypes.clear;
  return skyTypes.soft;
}

function forecastDay(location, hourly, index, sunsetValue, date, clock, weatherSource, now) {
  const cloud = hourly.cloud_cover[index];
  const low = hourly.cloud_cover_low?.[index] ?? null;
  const mid = hourly.cloud_cover_mid?.[index] ?? null;
  const high = hourly.cloud_cover_high?.[index] ?? null;
  const humidity = hourly.relative_humidity_2m?.[index] ?? null;
  const visibility = hourly.visibility?.[index] ?? null;
  const visibilityKm = visibility === null ? null : visibility / 1000;
  const rain = hourly.precipitation_probability?.[index] ?? null;
  const illuminatedClouds = mid === null || high === null ? cloud : (high + mid) / 2;
  const illumination = 1 - Math.min(1, Math.abs(illuminatedClouds - 48) / 55);
  const clearHorizon = Math.max(0, 1 - (low ?? cloud) / 92);
  const visibilityBonus = visibilityKm === null ? 0 : Math.min(12, Math.max(-8, (visibilityKm - 10) * .6));
  const rainPenalty = (rain ?? 0) * .22;
  const humidityPenalty = humidity === null ? 0 : Math.max(0, (humidity - 72) * .32);
  const vibrancy = Math.max(8, Math.min(98,
    Math.round(28 + 42 * illumination + 28 * clearHorizon + visibilityBonus - humidityPenalty - rainPenalty)));

  const sunset = new Date(sunsetValue * 1000);
  const horizon = Math.max(0, (sunset.getTime() - now) / 3_600_000);
  const baselineConfidence = weatherSource === "7timer" ? 80 : 94;
  const confidence = Math.max(38,
    Math.round(baselineConfidence - Math.min(32, Math.max(0, horizon - 12) * .18) - Math.min(12, (rain ?? 0) * .08)));
  const { palette, colors, summary } = skyType({ low, mid, high, cloud, rain, clearHorizon });
  const start = new Date(sunset.getTime() - 24 * 60_000);
  const end = new Date(sunset.getTime() + 22 * 60_000);

  return {
    prediction_id: forecastId(location, sunsetValue),
    model_kind: "heuristic",
    location,
    date,
    sunset_at: sunset.toISOString(),
    sunset_display: clock.format(sunset),
    best_window_start: start.toISOString(),
    best_window_end: end.toISOString(),
    best_window_display: `${clock.format(start)}–${clock.format(end)}`,
    palette: [...palette],
    dominant_colors: [...colors],
    vibrancy,
    confidence,
    summary,
    interpretation_label: "Forecast interpretation",
    atmosphere: {
      cloud_cover: Math.round(cloud),
      low_clouds: low,
      mid_clouds: mid,
      high_clouds: high,
      humidity,
      visibility_km: visibilityKm === null ? null : Math.round(visibilityKm * 10) / 10,
      precipitation_probability: rain,
    },
    forecast_horizon_hours: horizon,
  };
}

export function forecastFromWeather(location, payload, weatherSource, now = Date.now()) {
  if (!hasValidWeatherShape(payload)) return null;

  const dateFormatter = localDateFormatter(location.timezone);
  const today = formatLocalDate(dateFormatter, now);
  const endOfWeek = new Date(Date.parse(today) + 6 * FORECAST_DAY_MS).toISOString().slice(0, 10);
  const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: location.timezone });
  const maxSampleDistance = weatherSource === "7timer" ? 5400 : 3600;
  const times = payload.hourly.time;
  const daysByDate = new Map();

  for (const sunset of payload.daily.sunset) {
    if (sunset === null) continue;
    const date = formatLocalDate(dateFormatter, sunset * 1000);
    if (date < today || date > endOfWeek || daysByDate.has(date)) continue;
    const index = closestSample(times, sunset);
    if (Math.abs(times[index] - sunset) > maxSampleDistance || payload.hourly.cloud_cover[index] === null) continue;
    daysByDate.set(date, forecastDay(location, payload.hourly, index, sunset, date, clock, weatherSource, now));
  }

  if (!daysByDate.has(today)) return null;
  const days = [...daysByDate.values()].sort((left, right) => left.date.localeCompare(right.date));
  const best = days.reduce((left, right) => right.vibrancy > left.vibrancy ? right : left);
  return { location, best_prediction_id: best.prediction_id, days, weather_source: weatherSource };
}
