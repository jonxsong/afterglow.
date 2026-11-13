const TEN_MINUTES = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const MAX_BODY_BYTES = 6 * 1024 * 1024;

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

export function createWorker(assets = {}) {
  const rateLimits = new Map();

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
    async fetch(request, env = {}) {
      const pathname = new URL(request.url).pathname;
      if (pathname === "/api/ai/analyze") return analyze(request, env);
      if (request.method !== "GET" && request.method !== "HEAD") return errorResponse("Method not allowed.", 405);
      return serveAsset(request);
    },
  };
}

export default createWorker({});
