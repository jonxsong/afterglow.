import type { Location, WeeklyForecast } from "./types";

export const forecastWeatherFields: readonly string[];
export const defaultForecastPalette: readonly string[];

export function forecastLocalDate(time: number, timezone: string): string;

export function forecastFromWeather(
  location: Location,
  payload: unknown,
  weatherSource: "open-meteo" | "7timer",
  now?: number,
): WeeklyForecast | null;
