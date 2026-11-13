import asyncio
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

import httpx

from ..config import get_settings


class WeatherProviderError(RuntimeError):
    pass


@dataclass(frozen=True)
class WeatherPoint:
    valid_at: datetime
    cloud_cover: float
    cloud_cover_low: float
    cloud_cover_mid: float
    cloud_cover_high: float
    humidity: float
    visibility_m: float
    precipitation_probability: float


class OpenMeteoClient:
    geocoding_url = "https://geocoding-api.open-meteo.com/v1/search"
    forecast_url = "https://api.open-meteo.com/v1/forecast"

    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self.settings = get_settings()
        self._external_client = client

    async def _request(self, url: str, params: dict[str, Any]) -> dict[str, Any]:
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                if self._external_client:
                    response = await self._external_client.get(url, params=params)
                else:
                    async with httpx.AsyncClient(timeout=self.settings.open_meteo_timeout_seconds) as client:
                        response = await client.get(url, params=params)
                response.raise_for_status()
                payload = response.json()
                if not isinstance(payload, dict):
                    raise WeatherProviderError("Weather provider returned an invalid response")
                return payload
            except (httpx.HTTPError, ValueError, WeatherProviderError) as exc:
                last_error = exc
                if attempt < 2:
                    await asyncio.sleep(0.2 * (2**attempt))
        raise WeatherProviderError("Open-Meteo is temporarily unavailable") from last_error

    async def search_locations(self, query: str, count: int = 8, language: str = "en") -> list[dict[str, Any]]:
        payload = await self._request(
            self.geocoding_url,
            {"name": query, "count": min(count, 10), "language": language if language in {"en", "zh"} else "en", "format": "json"},
        )
        results = []
        for item in payload.get("results", []):
            if not all(key in item for key in ("name", "country", "latitude", "longitude", "timezone")):
                continue
            results.append(
                {
                    "name": item["name"],
                    "region": item.get("admin1"),
                    "country": item["country"],
                    "latitude": float(item["latitude"]),
                    "longitude": float(item["longitude"]),
                    "timezone": item["timezone"],
                }
            )
        return results

    async def forecast(self, latitude: float, longitude: float, timezone_name: str, days: int = 7) -> dict[str, Any]:
        payload = await self._request(
            self.forecast_url,
            {
                "latitude": latitude,
                "longitude": longitude,
                "timezone": timezone_name,
                "forecast_days": min(days, 7),
                "hourly": ",".join(
                    [
                        "cloud_cover",
                        "cloud_cover_low",
                        "cloud_cover_mid",
                        "cloud_cover_high",
                        "relative_humidity_2m",
                        "visibility",
                        "precipitation_probability",
                    ]
                ),
                "daily": "sunset",
            },
        )
        hourly = payload.get("hourly", {})
        required = [
            "time", "cloud_cover", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high",
            "relative_humidity_2m", "visibility", "precipitation_probability",
        ]
        if not all(key in hourly for key in required) or "sunset" not in payload.get("daily", {}):
            raise WeatherProviderError("Weather provider response is missing required fields")
        return payload


def sunset_weather(payload: dict[str, Any], sunset: datetime) -> WeatherPoint:
    hourly = payload["hourly"]
    times = [datetime.fromisoformat(value).replace(tzinfo=sunset.tzinfo) for value in hourly["time"]]
    index = min(range(len(times)), key=lambda i: abs((times[i] - sunset).total_seconds()))

    def value(name: str, fallback: float = 0.0) -> float:
        raw = hourly[name][index]
        return fallback if raw is None else float(raw)

    return WeatherPoint(
        valid_at=times[index],
        cloud_cover=value("cloud_cover"),
        cloud_cover_low=value("cloud_cover_low"),
        cloud_cover_mid=value("cloud_cover_mid"),
        cloud_cover_high=value("cloud_cover_high"),
        humidity=value("relative_humidity_2m"),
        visibility_m=value("visibility", 10000),
        precipitation_probability=value("precipitation_probability"),
    )

