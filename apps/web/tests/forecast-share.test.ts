import { describe, expect, it } from "vitest";
import { buildForecastShareUrl, readForecastShareLocation } from "@/lib/forecast-share";

describe("forecast share links", () => {
  it("preserves the selected city, region, time zone, and coordinates without a location lookup", () => {
    const city = {
      name: "São Paulo", region: "São Paulo", country: "Brasil",
      latitude: -23.55052, longitude: -46.633308, timezone: "America/Sao_Paulo",
    };
    const url = new URL(buildForecastShareUrl(city, "https://afterglow.test/?previous=value#old"));

    expect(url.origin).toBe("https://afterglow.test");
    expect(url.hash).toBe("#forecast");
    expect(url.searchParams.has("previous")).toBe(false);
    expect(readForecastShareLocation(url.search)).toEqual({ ...city, latitude: -23.5505, longitude: -46.6333 });
  });

  it("uses approximate coordinates for a shared current location", () => {
    const url = new URL(buildForecastShareUrl({
      name: "当前位置", country: "", latitude: 37.7749231, longitude: -122.4194681, timezone: "America/Los_Angeles",
    }, "https://afterglow.test"));

    expect(readForecastShareLocation(url.search)).toMatchObject({ name: "当前位置", latitude: 37.77, longitude: -122.42 });
    expect(url.href).not.toContain("37.7749231");
  });

  it("ignores incomplete or malformed URLs and keeps zero coordinates", () => {
    const link = "?city=Open+Ocean&lat=0&lon=0&tz=Etc%2FUTC";
    expect(readForecastShareLocation(link)).toMatchObject({ latitude: 0, longitude: 0 });

    for (const invalid of [
      "?city=Open+Ocean",
      link.replace("lat=0", "lat="),
      link.replace("lon=0", "lon=180.1"),
      link.replace("lat=0", "lat=Infinity"),
      link.replace("lat=0", "lat=0x10"),
      link.replace("Etc%2FUTC", "Bogus%2FZone"),
    ]) expect(readForecastShareLocation(invalid)).toBeNull();
  });
});
