import type { Evaluation, Forecast, Location, WeeklyForecast } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.error?.message ?? payload?.detail ?? "Afterglow could not reach the forecast service.";
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function searchLocations(query: string): Promise<Location[]> {
  if (!API_URL) return searchOpenMeteoLocations(query);
  return request(`/api/v1/locations/search?q=${encodeURIComponent(query)}`);
}

function locationQuery(location: Location): string {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    name: location.name,
    timezone: location.timezone,
    country: location.country,
  });
  if (location.region) params.set("region", location.region);
  return params.toString();
}

export function getForecast(location: Location): Promise<Forecast> {
  if (!API_URL) return getOpenMeteoWeekly(location).then((result) => result.days[0]);
  return request(`/api/v1/forecast?${locationQuery(location)}`);
}

export function getWeeklyForecast(location: Location): Promise<WeeklyForecast> {
  if (!API_URL) return getOpenMeteoWeekly(location);
  return request(`/api/v1/forecast/weekly?${locationQuery(location)}`);
}

export function uploadObservation(predictionId: string, photo: File): Promise<Evaluation> {
  if (!API_URL) return evaluateInBrowser(predictionId, photo);
  const body = new FormData();
  body.set("prediction_id", predictionId);
  body.set("photo", photo);
  return request("/api/v1/observations", { method: "POST", body });
}

const PALETTES = {
  clear: ["#F8D6AE", "#F4B184", "#E88772", "#B9798D", "#6F6A9B"],
  dramatic: ["#F9C58B", "#F08B6E", "#CF6683", "#8E638F", "#4C5278"],
  soft: ["#F0D3BE", "#E6B4B1", "#C99BB5", "#9A8FB2", "#777A9B"],
  muted: ["#D9CFBF", "#C9B4AA", "#A89DA4", "#84858E", "#666D78"],
};

type OpenMeteoPayload = {
  hourly: Record<string, Array<string | number | null>>;
  daily: { sunset: string[] };
};

async function searchOpenMeteoLocations(query: string): Promise<Location[]> {
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`);
  if (!response.ok) throw new Error("Location search is temporarily unavailable.");
  const payload = await response.json();
  return (payload.results ?? []).filter((item: Record<string, unknown>) => item.name && item.country && item.timezone).map((item: Record<string, unknown>) => ({
    name: String(item.name), region: item.admin1 ? String(item.admin1) : null, country: String(item.country),
    latitude: Number(item.latitude), longitude: Number(item.longitude), timezone: String(item.timezone),
  }));
}

function clock(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(date);
}

function hexId(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  return `web-${(hash >>> 0).toString(16)}-${input.slice(0, 10).replaceAll("-", "")}`;
}

function at<T extends string | number | null>(payload: OpenMeteoPayload, field: string, index: number, fallback = 0): number {
  const raw = payload.hourly[field]?.[index];
  return raw === null || raw === undefined ? fallback : Number(raw);
}

async function getOpenMeteoWeekly(location: Location): Promise<WeeklyForecast> {
  const variables = ["cloud_cover", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high", "relative_humidity_2m", "visibility", "precipitation_probability"];
  const params = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), timezone: location.timezone, forecast_days: "7", hourly: variables.join(","), daily: "sunset" });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error("The atmosphere is temporarily out of reach.");
  const payload = await response.json() as OpenMeteoPayload;
  const hourlyTimes = payload.hourly.time.map((value) => new Date(String(value)));
  const days = payload.daily.sunset.map((sunsetValue, dayIndex): Forecast => {
    const sunset = new Date(sunsetValue);
    const sunsetLocalMs = sunset.getTime();
    let index = 0;
    for (let i = 1; i < hourlyTimes.length; i += 1) if (Math.abs(hourlyTimes[i].getTime() - sunsetLocalMs) < Math.abs(hourlyTimes[index].getTime() - sunsetLocalMs)) index = i;
    const cloud = at(payload, "cloud_cover", index);
    const low = at(payload, "cloud_cover_low", index);
    const mid = at(payload, "cloud_cover_mid", index);
    const high = at(payload, "cloud_cover_high", index);
    const humidity = at(payload, "relative_humidity_2m", index);
    const visibilityKm = at(payload, "visibility", index, 10000) / 1000;
    const rain = at(payload, "precipitation_probability", index);
    const illumination = 1 - Math.min(1, Math.abs((high + mid) / 2 - 48) / 55);
    const clearHorizon = Math.max(0, 1 - low / 92);
    const visibilityBonus = Math.min(12, Math.max(-8, (visibilityKm - 10) * 0.6));
    const horizon = Math.max(0, (sunset.getTime() - Date.now()) / 3_600_000);
    const vibrancy = Math.max(8, Math.min(98, Math.round(28 + 42 * illumination + 28 * clearHorizon + visibilityBonus - Math.max(0, (humidity - 72) * .32) - rain * .22)));
    const confidence = Math.max(38, Math.min(94, Math.round(94 - Math.min(32, Math.max(0, horizon - 12) * .18) - Math.min(12, rain * .08))));
    let palette = PALETTES.soft, dominant = ["Peach", "Rose", "Lavender"], summary = "Soft color with a gentle, lingering afterglow.";
    if (low > 78 || rain > 72) { palette = PALETTES.muted; dominant = ["Pewter", "Mauve", "Slate"]; summary = "Quiet color behind a soft, clouded horizon."; }
    else if (high + mid > 85 && clearHorizon > .45) { palette = PALETTES.dramatic; dominant = ["Amber", "Rose", "Plum"]; summary = "A layered sky with a strong chance of dramatic color."; }
    else if (cloud < 22) { palette = PALETTES.clear; dominant = ["Apricot", "Coral", "Violet"]; summary = "A clean horizon, warm at first and violet after."; }
    const start = new Date(sunset.getTime() - 24 * 60_000), end = new Date(sunset.getTime() + 22 * 60_000);
    return {
      prediction_id: hexId(`${location.latitude}-${location.longitude}-${sunsetValue}`), model_kind: "heuristic", location,
      date: sunsetValue.slice(0, 10), sunset_at: sunset.toISOString(), sunset_display: clock(sunset, location.timezone),
      best_window_start: start.toISOString(), best_window_end: end.toISOString(), best_window_display: `${clock(start, location.timezone)}–${clock(end, location.timezone)}`,
      palette, dominant_colors: dominant, vibrancy, confidence, summary, interpretation_label: "Forecast interpretation",
      atmosphere: { cloud_cover: Math.round(cloud), low_clouds: Math.round(low), mid_clouds: Math.round(mid), high_clouds: Math.round(high), humidity: Math.round(humidity), visibility_km: Math.round(visibilityKm * 10) / 10, precipitation_probability: Math.round(rain) },
      forecast_horizon_hours: horizon,
    };
  });
  const best = days.reduce((left, right) => right.vibrancy > left.vibrancy ? right : left);
  return { location, best_prediction_id: best.prediction_id, days };
}

const savedPalettes = new Map<string, string[]>();

async function evaluateInBrowser(predictionId: string, photo: File): Promise<Evaluation> {
  if (photo.size > 10 * 1024 * 1024) throw new Error("Image exceeds the 10 MB upload limit.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) throw new Error("Upload a JPEG, PNG, or WebP image.");
  const bitmap = await createImageBitmap(photo);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 240 / bitmap.width);
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale * .8));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This browser could not read the image.");
  context.drawImage(bitmap, 0, 0, canvas.width, Math.round(bitmap.height * scale));
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < pixels.length; i += 64) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`; const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1; bucket.r += r; bucket.g += g; bucket.b += b; buckets.set(key, bucket);
  }
  const observed = [...buckets.values()].sort((a, b) => b.count - a.count).slice(0, 5).map(({count, r, g, b}) => `#${[r/count, g/count, b/count].map(value => Math.round(value).toString(16).padStart(2, "0")).join("").toUpperCase()}`);
  while (observed.length < 5) observed.push(observed.at(-1) ?? "#888888");
  const forecast = savedPalettes.get(predictionId) ?? PALETTES.soft;
  const rgb = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  const differences = forecast.map(color => Math.min(...observed.map(actual => Math.sqrt(rgb(color).reduce((sum, value, index) => sum + (value - rgb(actual)[index]) ** 2, 0)))) / 4.42);
  const mean = differences.reduce((sum, value) => sum + value, 0) / differences.length;
  return { observation_id: crypto.randomUUID(), prediction_id: predictionId, forecast_palette: forecast, observed_palette: observed, mean_delta_e: Math.round(mean * 100) / 100, palette_accuracy: Math.max(0, Math.round((100 - mean * 2.2) * 10) / 10), privacy_note: "This comparison ran privately in your browser; the image was not uploaded." };
}

export function rememberForecastPalette(predictionId: string, palette: string[]): void {
  savedPalettes.set(predictionId, palette);
}

