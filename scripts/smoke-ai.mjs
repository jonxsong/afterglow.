import { deflateSync } from "node:zlib";
import { createWorker } from "../services/site-worker/runtime.mjs";

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function sunsetPng() {
  const width = 512, height = 320;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const t = y / (height - 1); raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = y * (width * 3 + 1) + 1 + x * 3;
      const glow = Math.max(0, 1 - Math.hypot((x / width - .32) * 1.5, t - .74) * 2.2);
      raw[offset] = Math.round(82 + 160 * t + 12 * glow);
      raw[offset + 1] = Math.round(76 + 76 * t + 80 * glow);
      raw[offset + 2] = Math.round(135 - 36 * t + 20 * glow);
    }
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not available.");
const image_data_url = `data:image/png;base64,${sunsetPng().toString("base64")}`;
const request = new Request("https://afterglow.test/api/ai/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image_data_url, locale: "en", forecast: { date: "2026-11-12", location: "San Francisco, California", sunset: "4:59 PM", palette: ["#F8D6AE", "#F4B184", "#E88772", "#B9798D", "#6F6A9B"], dominant_colors: ["Peach", "Rose", "Lavender"], vibrancy: 82, confidence: 86, summary: "A warm, layered afterglow.", atmosphere: { cloud_cover: 46, high_clouds: 38, humidity: 61, visibility_km: 18 } } }) });
const response = await createWorker().fetch(request, { OPENAI_API_KEY: process.env.OPENAI_API_KEY, OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4.1-mini" });
const payload = await response.json();
console.log(JSON.stringify({ status: response.status, valid_reading: typeof payload.title === "string" && Number.isInteger(payload.match_score), match_score: payload.match_score ?? null }));
if (!response.ok) process.exitCode = 1;
