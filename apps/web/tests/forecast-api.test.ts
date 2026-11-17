import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Location } from "@/lib/types";

const tokyo: Location = {
  name: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503, timezone: "Asia/Tokyo",
};
const retrievedAt = "2026-11-17T00:00:00.000Z";
const sunsetAt = "2026-11-17T07:32:00.000Z";

function providerForecast() {
  const sunset = Date.parse(sunsetAt) / 1000;
  return Response.json({
    hourly: { time: [sunset - 45 * 60, sunset + 15 * 60], cloud_cover: [12, 48] },
    daily: { sunset: [sunset] },
  });
}

beforeEach(() => {
  window.localStorage.clear();
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(retrievedAt));
  vi.stubEnv("NEXT_PUBLIC_API_URL", "");
  vi.stubEnv("NEXT_PUBLIC_WEATHER_PROXY", "/api/weather");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("the hosted weather forecast", () => {
  it("uses the backup weather response directly and preserves its missing metrics", async () => {
    const fetch = vi.fn(async () => {
      const payload = await providerForecast().json();
      return Response.json(payload, { headers: { "x-afterglow-weather-source": "7timer" } });
    });
    vi.stubGlobal("fetch", fetch);
    const { getWeeklyForecast } = await import("@/lib/api");
    const forecast = await getWeeklyForecast(tokyo);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(forecast.weather_source).toBe("7timer");
    expect(forecast.days[0].atmosphere).toMatchObject({ cloud_cover: 48, visibility_km: null, precipitation_probability: null });
  });

  it("uses the direct provider when the relay is limited and formats the sunset in Tokyo", async () => {
    const fetch = vi.fn((url: string) =>
      Promise.resolve(url.startsWith("/api/") ? new Response(null, { status: 429 }) : providerForecast()),
    );
    vi.stubGlobal("fetch", fetch);
    const { getWeeklyForecast } = await import("@/lib/api");

    const forecast = await getWeeklyForecast(tokyo);

    expect(fetch.mock.calls.map(([url]) => url.split("?")[0])).toEqual([
      "/api/weather/forecast",
      "https://api.open-meteo.com/v1/forecast",
    ]);
    expect(fetch.mock.calls[1][0]).toContain("timeformat=unixtime");
    expect(forecast.freshness).toEqual({ source: "live", fetched_at: retrievedAt });
    expect(forecast.days[0]).toMatchObject({
      date: "2026-11-17",
      sunset_at: sunsetAt,
      sunset_display: "4:32 PM",
      atmosphere: { cloud_cover: 48 },
    });
  });

  it("restores that location's saved forecast when both live routes fail and expires it after 12 hours", async () => {
    const fetch = vi.fn().mockImplementationOnce(providerForecast).mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 429 })),
    );
    vi.stubGlobal("fetch", fetch);
    const { getWeeklyForecast } = await import("@/lib/api");
    const live = await getWeeklyForecast(tokyo);

    vi.setSystemTime(new Date("2026-11-17T05:00:00.000Z"));
    const saved = await getWeeklyForecast(tokyo);
    expect(saved.days).toEqual(live.days);
    expect(saved.freshness).toEqual({ source: "cache", fetched_at: retrievedAt });
    await expect(getWeeklyForecast({ ...tokyo, latitude: 36 })).rejects.toThrow("out of reach");

    vi.setSystemTime(new Date("2026-11-17T12:00:00.000Z"));
    await expect(getWeeklyForecast(tokyo)).rejects.toThrow("out of reach");
  });

  it("never uses yesterday's forecast after midnight in the selected location", async () => {
    const fetch = vi.fn().mockImplementationOnce(providerForecast).mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 503 })),
    );
    vi.stubGlobal("fetch", fetch);
    const { getWeeklyForecast } = await import("@/lib/api");
    vi.setSystemTime(new Date("2026-11-17T14:50:00.000Z"));
    await getWeeklyForecast(tokyo);

    vi.setSystemTime(new Date("2026-11-17T15:01:00.000Z"));
    await expect(getWeeklyForecast(tokyo)).rejects.toThrow("out of reach");
  });
});
