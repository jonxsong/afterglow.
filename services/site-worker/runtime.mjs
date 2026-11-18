import { fetchSevenTimerForecast } from "./seven-timer.mjs";
import { readForecastSnapshot, saveForecastSnapshot } from "./forecast-store.mjs";
import { forecastFromWeather, forecastLocalDate, forecastWeatherFields } from "../../apps/web/lib/forecast-core.mjs";

const TEN_MINUTES = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const MAX_BODY_BYTES = 6 * 1024 * 1024;
const WEATHER_UPSTREAMS = {
  "/api/weather/forecast": { url: "https://api.open-meteo.com/v1/forecast", cacheSeconds: 300 },
  "/api/weather/geocoding": { url: "https://geocoding-api.open-meteo.com/v1/search", cacheSeconds: 86400 },
};
const FORECAST_PATH = "/api/weather/forecast";
const WEEKLY_FORECAST_PATH = "/api/v1/forecast/weekly";
const FORECAST_TIMEOUT_MS = 3000;
const SNAPSHOT_READ_TIMEOUT_MS = 1200;
const WEATHER_CACHE_LIMIT = 128;
const FORECAST_FORMAT = "v1";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const outputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "observed_mood", "color_story", "atmosphere_story", "forecast_match", "photography_tip", "confidence_note", "match_score"],
  properties: {
    title: { type: "string" },
    observed_mood: { type: "string" },
    color_story: { type: "string" },
    atmosphere_story: { type: "string" },
    forecast_match: { type: "string" },
    photography_tip: { type: "string" },
    confidence_note: { type: "string" },
    match_score: { type: "integer", minimum: 0, maximum: 100 },
  },
};

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

function errorResponse(message, status = 400, headers = {}) {
  return json({ error: { message } }, status, headers);
}

function extension(pathname) {
  const match = pathname.match(/\.[a-z0-9]+$/i);
  return match?.[0].toLowerCase() ?? "";
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function resolveAsset(pathname, assets) {
  const candidates = pathname === "/" ? ["/index.html"] : pathname.endsWith("/") ? [`${pathname}index.html`] : [pathname, `${pathname}.html`];
  return candidates.find((candidate) => assets[candidate]);
}

function extractOutputText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text) return payload.output_text;
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

function validImageDataUrl(value) {
  return typeof value === "string" && /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\r\n]+$/i.test(value) && value.length <= 5.5 * 1024 * 1024;
}

function safeForecast(value) {
  if (!value || typeof value !== "object") return null;
  return {
    date: String(value.date ?? "").slice(0, 20),
    location: String(value.location ?? "").slice(0, 180),
    sunset: String(value.sunset ?? "").slice(0, 40),
    palette: Array.isArray(value.palette) ? value.palette.slice(0, 8).map((item) => String(item).slice(0, 20)) : [],
    dominant_colors: Array.isArray(value.dominant_colors) ? value.dominant_colors.slice(0, 8).map((item) => String(item).slice(0, 40)) : [],
    vibrancy: Number(value.vibrancy) || 0,
    confidence: Number(value.confidence) || 0,
    summary: String(value.summary ?? "").slice(0, 400),
    atmosphere: value.atmosphere && typeof value.atmosphere === "object" ? value.atmosphere : {},
  };
}

function weatherSnapshotPayload(payload) {
  return {
    hourly: Object.fromEntries(["time", ...forecastWeatherFields]
      .filter((field) => Array.isArray(payload.hourly[field]))
      .map((field) => [field, payload.hourly[field]])),
    daily: { sunset: payload.daily.sunset },
  };
}

function locationLabel(value) {
  return value?.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "").trim().slice(0, 100) ?? "";
}

async function loadSavedForecast(db, key) {
  if (!db) return null;
  let timer;
  try {
    return await Promise.race([
      readForecastSnapshot(db, key, Date.now()),
      new Promise((resolve) => { timer = setTimeout(() => resolve(null), SNAPSHOT_READ_TIMEOUT_MS); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function createWorker(assets = {}) {
  const rateLimits = new Map();
  const recentWeather = new Map();
  const pendingWeather = new Map();
  let openMeteoRetryAt = 0;

  function forecastResult(result) {
    return json(result.payload, 200, {
      "cache-control": `public, max-age=${result.maxAge}`,
      "x-afterglow-weather-source": result.source,
      "x-afterglow-weather-fetched-at": new Date(result.fetchedAt).toISOString(),
      "x-content-type-options": "nosniff",
    });
  }

  async function loadLiveForecast(location, params) {
    if (Date.now() >= openMeteoRetryAt) {
      try {
        const response = await fetch(`${WEATHER_UPSTREAMS[FORECAST_PATH].url}?${params}`, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(FORECAST_TIMEOUT_MS),
        });
        if (response.status === 429) {
          const header = response.headers.get("retry-after");
          const retrySeconds = header && /^\d+$/.test(header) ? Number(header) : 0;
          const retryDate = header ? Date.parse(header) : NaN;
          openMeteoRetryAt = Math.max(Date.now() + Math.max(retrySeconds, 60) * 1000, Number.isFinite(retryDate) ? retryDate : 0);
        }
        if (response.ok) {
          const payload = await response.json();
          const fetchedAt = Date.now();
          if (forecastFromWeather(location, payload, "open-meteo", fetchedAt)) {
            return { payload, maxAge: 300, source: "open-meteo", fetchedAt };
          }
        } else {
          await response.body?.cancel();
        }
      } catch { /* Try the independent feed after a timeout or unreadable reply. */ }
    }

    const backup = await fetchSevenTimerForecast({ ...location, now: Date.now() }).catch(() => null);
    const fetchedAt = Date.now();
    if (!backup || !forecastFromWeather(location, backup.payload, "7timer", fetchedAt)) return null;
    return { ...backup, source: "7timer", fetchedAt };
  }

  async function currentWeather(origin, location, localDay, cityDayKey, db, ctx) {
    const upstream = new URLSearchParams({
      latitude: String(location.latitude), longitude: String(location.longitude), timezone: location.timezone,
      forecast_days: "7", timeformat: "unixtime", daily: "sunset",
      hourly: forecastWeatherFields.join(","),
    });
    const cacheKey = new URL(FORECAST_PATH, origin);
    cacheKey.searchParams.set("afterglow_cache_key", cityDayKey);
    const key = cacheKey.href;
    const recent = recentWeather.get(key);
    if (recent && recent.expires > Date.now()) {
      return { ...recent.result, maxAge: Math.max(0, Math.floor((recent.expires - Date.now()) / 1000)) };
    }
    const edgeCache = globalThis.caches?.default;
    if (edgeCache) {
      try {
        const response = await edgeCache.match(key);
        if (response?.ok) {
          const source = response.headers.get("x-afterglow-weather-source");
          const fetchedAt = Date.parse(response.headers.get("x-afterglow-weather-fetched-at"));
          const age = Date.now() - fetchedAt;
          const maxAge = (source === "7timer" ? 600 : 300) - Math.ceil(age / 1000);
          if ((source === "open-meteo" || source === "7timer") && age >= 0 && maxAge >= 0) {
            const payload = await response.json();
            if (forecastFromWeather(location, payload, source)) return { payload, source, fetchedAt, maxAge };
          }
        }
      } catch { /* Treat an unreadable edge entry as a cache miss. */ }
    }

    // Cloudflare fetch and cache I/O is scoped to the current request.
    let inflight = edgeCache ? undefined : pendingWeather.get(key);
    if (!inflight) {
      inflight = loadLiveForecast(location, upstream).then(async (result) => {
        if (!result) return null;
        if (forecastLocalDate(result.fetchedAt, location.timezone) !== localDay) return result;
        recentWeather.delete(key);
        recentWeather.set(key, { result, expires: result.fetchedAt + result.maxAge * 1000 });
        if (recentWeather.size > WEATHER_CACHE_LIMIT) recentWeather.delete(recentWeather.keys().next().value);
        const writes = Promise.all([
          saveForecastSnapshot(db, cityDayKey, {
            payload: weatherSnapshotPayload(result.payload), source: result.source, fetchedAt: result.fetchedAt,
          }).catch(() => {}),
          edgeCache?.put(key, forecastResult(result)).catch(() => {}),
        ]);
        if (ctx?.waitUntil) ctx.waitUntil(writes);
        else await writes;
        return result;
      });
      if (!edgeCache) {
        inflight = inflight.finally(() => pendingWeather.delete(key));
        pendingWeather.set(key, inflight);
      }
    }
    return inflight;
  }

  async function liveForecast(requestUrl, env, ctx, weekly = false) {
    const params = requestUrl.searchParams;
    const latitude = Number(params.get("latitude"));
    const longitude = Number(params.get("longitude"));
    const timezone = params.get("timezone");
    if (!params.get("latitude")?.trim() || !params.get("longitude")?.trim() || !timezone || timezone.length > 64 ||
      !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
      return errorResponse("Valid coordinates and a time zone are required.");
    }

    let localDay;
    try { localDay = forecastLocalDate(Date.now(), timezone); }
    catch { return errorResponse("A valid time zone is required."); }

    const rounded = { latitude: Number(latitude.toFixed(3)), longitude: Number(longitude.toFixed(3)), timezone };
    const cityDayKey = `${FORECAST_FORMAT}|${rounded.latitude}|${rounded.longitude}|${timezone}|${localDay}`;
    const result = await currentWeather(requestUrl.origin, rounded, localDay, cityDayKey, env?.DB, ctx);
    const unavailable = () => errorResponse("The atmosphere is temporarily out of reach.", 503, { "retry-after": "30" });
    if (!weekly) return result ? forecastResult(result) : unavailable();

    const snapshot = result ?? await loadSavedForecast(env?.DB, cityDayKey);
    if (!snapshot) return unavailable();
    const now = Date.now();
    if (!result && forecastLocalDate(snapshot.fetchedAt, timezone) !== forecastLocalDate(now, timezone)) return unavailable();
    // Weather is reusable across visitors; labels belong only to the current response.
    const location = {
      ...rounded,
      name: locationLabel(params.get("name")) || "Selected location",
      country: locationLabel(params.get("country")),
      region: locationLabel(params.get("region")) || null,
    };
    const forecast = forecastFromWeather(location, snapshot.payload, snapshot.source, now);
    if (!forecast) return unavailable();
    const freshness = { source: result ? "live" : "cache", fetched_at: new Date(snapshot.fetchedAt).toISOString() };
    return json({ ...forecast, freshness });
  }

  async function proxyWeather(request, pathname, env, ctx) {
    if (request.method !== "GET") return errorResponse("Method not allowed.", 405, { allow: "GET" });
    const upstream = WEATHER_UPSTREAMS[pathname];
    const requestUrl = new URL(request.url);
    if (pathname === FORECAST_PATH && requestUrl.searchParams.get("timeformat") === "unixtime") return liveForecast(requestUrl, env, ctx);
    const upstreamUrl = `${upstream.url}?${requestUrl.searchParams}`;
    let lastStatus = 503;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(upstreamUrl, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(FORECAST_TIMEOUT_MS),
        });
        lastStatus = response.status;
        if (response.ok || (response.status < 500 && response.status !== 429)) {
          return new Response(response.body, {
            status: response.status,
            headers: {
              "content-type": response.headers.get("content-type") || "application/json; charset=utf-8",
              "cache-control": `public, max-age=${upstream.cacheSeconds}, stale-while-revalidate=${upstream.cacheSeconds * 6}`,
              "x-content-type-options": "nosniff",
            },
          });
        }
        await response.body?.cancel();
        if (lastStatus === 429) break;
      } catch {
        lastStatus = 503;
      }
    }

    return errorResponse("The atmosphere is temporarily out of reach.", lastStatus === 429 ? 429 : 503, { "retry-after": "30" });
  }

  async function analyze(request, env) {
    if (request.method !== "POST") return errorResponse("Method not allowed.", 405, { allow: "POST" });
    if (!env?.OPENAI_API_KEY) return errorResponse("AI sky readings are not configured.", 503);
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BODY_BYTES) return errorResponse("The image is too large for an AI sky reading.", 413);

    const address = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
    const now = Date.now();
    const record = rateLimits.get(address);
    if (!record || now - record.startedAt >= TEN_MINUTES) rateLimits.set(address, { count: 1, startedAt: now });
    else if (record.count >= MAX_REQUESTS_PER_WINDOW) return errorResponse("Please wait a few minutes before requesting another AI reading.", 429, { "retry-after": "600" });
    else record.count += 1;

    let body;
    try { body = await request.json(); } catch { return errorResponse("The request could not be read."); }
    if (!validImageDataUrl(body?.image_data_url)) return errorResponse("Upload a JPEG, PNG, or WebP image under the size limit.");
    const forecast = safeForecast(body?.forecast);
    if (!forecast) return errorResponse("A forecast is required for comparison.");
    const locale = body?.locale === "zh" ? "zh" : "en";
    const language = locale === "zh" ? "Simplified Chinese" : "English";

    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "authorization": `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-4.1-mini",
        store: false,
        input: [
          {
            role: "developer",
            content: `You are Afterglow's visual atmospheric interpreter. Examine only what is visible in the sunset photograph, compare it with the supplied meteorological color forecast, and write an evocative but concise reading in ${language}. Clearly distinguish visible observations from atmospheric inference. Do not claim certainty about aerosols, pollution, safety, or weather conditions that cannot be established from a photograph. Each narrative field should be 1-3 short sentences. The title should be poetic but specific. The match score measures visual agreement with the forecast, not forecast quality in general.`,
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: `Forecast context:\n${JSON.stringify(forecast)}` },
              { type: "input_image", image_url: body.image_data_url, detail: "high" },
            ],
          },
        ],
        text: { format: { type: "json_schema", name: "afterglow_sky_reading", strict: true, schema: outputSchema } },
      }),
    });

    if (!openAIResponse.ok) return errorResponse("The AI sky reading is temporarily unavailable.", openAIResponse.status === 429 ? 429 : 502);
    let payload;
    try { payload = await openAIResponse.json(); } catch { return errorResponse("The AI sky reading returned an unreadable response.", 502); }
    const outputText = extractOutputText(payload);
    try { return json(JSON.parse(outputText)); } catch { return errorResponse("The AI sky reading returned an unreadable response.", 502); }
  }

  async function serveAsset(request) {
    const url = new URL(request.url);
    const assetPath = resolveAsset(url.pathname, assets);
    const selectedPath = assetPath ?? (assets["/404.html"] ? "/404.html" : null);
    if (!selectedPath) return new Response("Not found", { status: 404 });
    const asset = assets[selectedPath];
    const cacheControl = selectedPath.startsWith("/_next/static/") ? "public, max-age=31536000, immutable" : selectedPath.endsWith(".html") ? "no-cache" : "public, max-age=3600";
    return new Response(request.method === "HEAD" ? null : decodeBase64(asset.body), {
      status: assetPath ? 200 : 404,
      headers: {
        "content-type": asset.type || MIME_TYPES[extension(selectedPath)] || "application/octet-stream",
        "cache-control": cacheControl,
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
      },
    });
  }

  return {
    async fetch(request, env = {}, ctx) {
      const url = new URL(request.url);
      const { pathname } = url;
      if (pathname === "/health") return json({ status: "ok", service: "afterglow" });
      if (pathname === "/api/ai/analyze") return analyze(request, env);
      if (pathname === WEEKLY_FORECAST_PATH) {
        if (request.method !== "GET") return errorResponse("Method not allowed.", 405, { allow: "GET" });
        return liveForecast(url, env, ctx, true);
      }
      if (WEATHER_UPSTREAMS[pathname]) return proxyWeather(request, pathname, env, ctx);
      if (request.method !== "GET" && request.method !== "HEAD") return errorResponse("Method not allowed.", 405);
      return serveAsset(request);
    },
  };
}

export default createWorker({});
