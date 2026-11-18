import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forecastFromWeather } from "@/lib/forecast-core.mjs";
import type { Location, WeeklyForecast } from "@/lib/types";

const tokyo: Location = {
  name: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503, timezone: "Asia/Tokyo",
};
const retrievedAt = "2026-11-17T00:00:00.000Z";
const sunsetAt = "2026-11-17T07:32:00.000Z";

function weather() {
  const sunset = Date.parse(sunsetAt) / 1000;
  return {
    hourly: { time: [sunset - 45 * 60, sunset + 15 * 60], cloud_cover: [12, 48] },
    daily: { sunset: [sunset] },
  };
}

function serverForecast(source: "open-meteo" | "7timer" = "open-meteo", freshness?: WeeklyForecast["freshness"]) {
  const forecast = forecastFromWeather(tokyo, weather(), source, Date.parse(retrievedAt));
  if (!forecast) throw new Error("Invalid test forecast");
  return Response.json({ ...forecast, freshness });
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
    const fetch = vi.fn(() => Promise.resolve(serverForecast("7timer")));
    vi.stubGlobal("fetch", fetch);
    const { getWeeklyForecast } = await import("@/lib/api");
    const forecast = await getWeeklyForecast(tokyo);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(forecast.weather_source).toBe("7timer");
    expect(forecast.days[0].atmosphere).toMatchObject({ cloud_cover: 48, visibility_km: null, precipitation_probability: null });
  });

  it("uses the shared API and keeps the saved weather timestamp for a first-time visitor", async () => {
    const fetch = vi.fn((url: string) => Promise.resolve(serverForecast("7timer", { source: "cache", fetched_at: retrievedAt })));
    vi.stubGlobal("fetch", fetch);
    const { getWeeklyForecast } = await import("@/lib/api");

    vi.setSystemTime(new Date("2026-11-17T06:30:00.000Z"));
    const forecast = await getWeeklyForecast(tokyo);
    expect(fetch.mock.calls.map(([url]) => url.split("?")[0])).toEqual(["/api/v1/forecast/weekly"]);
    expect(forecast.freshness).toEqual({ source: "cache", fetched_at: retrievedAt });
    expect(forecast.days[0].sunset_display).toBe("4:32 PM");
  });

  it("uses the same calculation for direct Open-Meteo in standalone development", async () => {
    vi.stubEnv("NEXT_PUBLIC_WEATHER_PROXY", "");
    const fetch = vi.fn((url: string) => Promise.resolve(Response.json(weather())));
    vi.stubGlobal("fetch", fetch);
    const { getWeeklyForecast } = await import("@/lib/api");

    const forecast = await getWeeklyForecast(tokyo);

    expect(fetch.mock.calls.map(([url]) => url.split("?")[0])).toEqual([
      "https://api.open-meteo.com/v1/forecast",
    ]);
    expect(fetch.mock.calls[0][0]).toContain("timeformat=unixtime");
    expect(forecast.freshness).toEqual({ source: "live", fetched_at: retrievedAt });
    expect(forecast.days[0]).toMatchObject({
      date: "2026-11-17",
      sunset_at: sunsetAt,
      sunset_display: "4:32 PM",
      atmosphere: { cloud_cover: 48 },
    });
  });

  it("restores that location's saved forecast when both live routes fail and expires it after 12 hours", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(serverForecast()).mockImplementation(() =>
      Promise.resolve(Response.json({ error: { message: "The atmosphere is temporarily out of reach." } }, { status: 503 })),
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
    const fetch = vi.fn().mockResolvedValueOnce(serverForecast()).mockImplementation(() =>
      Promise.resolve(Response.json({ error: { message: "The atmosphere is temporarily out of reach." } }, { status: 503 })),
    );
    vi.stubGlobal("fetch", fetch);
    const { getWeeklyForecast } = await import("@/lib/api");
    vi.setSystemTime(new Date("2026-11-17T14:50:00.000Z"));
    await getWeeklyForecast(tokyo);

    vi.setSystemTime(new Date("2026-11-17T15:01:00.000Z"));
    await expect(getWeeklyForecast(tokyo)).rejects.toThrow("out of reach");
  });
});
