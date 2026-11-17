import type { Location } from "./types";

const labelMaxLength = 100;

function placeLabel(value: string | null | undefined): string {
  if (!value) return "";
  const printable = value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "");
  return Array.from(printable.trim()).slice(0, labelMaxLength).join("");
}

function readCoordinate(value: string | null, max: number): number | null {
  if (!value || !/^-?\d{1,3}(?:\.\d{1,8})?$/.test(value)) return null;
  const coordinate = Number(value);
  return Math.abs(coordinate) <= max ? coordinate : null;
}

function isTimeZone(value: string): boolean {
  if (value.length > 64 || !/^[a-z][\w.+-]*(?:\/[\w.+-]+)*$/i.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function buildForecastShareUrl(location: Location, origin: string): string {
  const url = new URL("/#forecast", origin);
  const country = placeLabel(location.country);
  const region = placeLabel(location.region);
  const precision = !country && !region && location.id === undefined ? 2 : 4;

  url.searchParams.set("city", placeLabel(location.name));
  url.searchParams.set("lat", String(Number(location.latitude.toFixed(precision))));
  url.searchParams.set("lon", String(Number(location.longitude.toFixed(precision))));
  url.searchParams.set("tz", location.timezone);
  if (region) url.searchParams.set("region", region);
  if (country) url.searchParams.set("country", country);
  return url.href;
}

export function readForecastShareLocation(search: string): Location | null {
  const params = new URLSearchParams(search);
  const name = placeLabel(params.get("city"));
  const latitude = readCoordinate(params.get("lat"), 90);
  const longitude = readCoordinate(params.get("lon"), 180);
  const timezone = params.get("tz");

  if (!name || latitude === null || longitude === null || !timezone || !isTimeZone(timezone)) return null;

  return {
    name,
    latitude,
    longitude,
    timezone,
    region: placeLabel(params.get("region")) || null,
    country: placeLabel(params.get("country")),
  };
}
