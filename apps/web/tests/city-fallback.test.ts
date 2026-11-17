import { describe, expect, it } from "vitest";
import { searchFallbackCities } from "@/lib/city-fallback";

describe("searchFallbackCities", () => {
  it("ranks exact names ahead of prefixes and can disambiguate by country", () => {
    expect(searchFallbackCities("Paris")[0]).toMatchObject({ name: "Paris", timezone: "Europe/Paris" });
    expect(searchFallbackCities("London, Canada")[0]).toMatchObject({ name: "London", timezone: "America/Toronto" });
    expect(searchFallbackCities("San Fra")[0]).toMatchObject({ name: "San Francisco", timezone: "America/Los_Angeles" });
  });

  it("recognizes common Chinese aliases and accent-insensitive queries", () => {
    expect(searchFallbackCities("舊金山", "zh")[0]).toMatchObject({ name: "旧金山", timezone: "America/Los_Angeles" });
    expect(searchFallbackCities("Sao Paulo")[0]).toMatchObject({ name: "São Paulo", timezone: "America/Sao_Paulo" });
    expect(searchFallbackCities("东京", "zh")[0]).toMatchObject({ name: "东京", timezone: "Asia/Tokyo" });
    expect(searchFallbackCities("维也纳", "zh")[0]).toMatchObject({ name: "维也纳", timezone: "Europe/Vienna" });
  });

  it("does not substitute a different city for unsupported or too-short queries", () => {
    expect(searchFallbackCities("ZZZZ-Not-A-City")).toEqual([]);
    expect(searchFallbackCities("北", "zh")).toEqual([]);
  });
});
