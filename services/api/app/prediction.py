from dataclasses import dataclass
from datetime import datetime, timezone

from .providers.open_meteo import WeatherPoint
from .solar import solar_position


PALETTES = {
    "clear": ["#F8D6AE", "#F4B184", "#E88772", "#B9798D", "#6F6A9B"],
    "dramatic": ["#F9C58B", "#F08B6E", "#CF6683", "#8E638F", "#4C5278"],
    "soft": ["#F0D3BE", "#E6B4B1", "#C99BB5", "#9A8FB2", "#777A9B"],
    "muted": ["#D9CFBF", "#C9B4AA", "#A89DA4", "#84858E", "#666D78"],
}


@dataclass(frozen=True)
class Prediction:
    vibrancy: int
    confidence: int
    palette: list[str]
    dominant_colors: list[str]
    summary: str
    features: dict[str, float | str]


def predict_sunset(weather: WeatherPoint, sunset: datetime, latitude: float, longitude: float, horizon_hours: float) -> Prediction:
    """Deterministic baseline; this is not a trained machine-learning model."""
    high = weather.cloud_cover_high
    mid = weather.cloud_cover_mid
    low = weather.cloud_cover_low
    humidity = weather.humidity
    visibility_km = weather.visibility_m / 1000
    rain = weather.precipitation_probability

    # Broken high/mid cloud can catch undersun light; low overcast and rain obscure it.
    illumination = 1 - min(1.0, abs((high + mid) / 2 - 48) / 55)
    clear_horizon = max(0.0, 1 - low / 92)
    moisture_penalty = max(0.0, (humidity - 72) * 0.32)
    visibility_bonus = min(12.0, max(-8.0, (visibility_km - 10) * 0.6))
    rain_penalty = rain * 0.22
    vibrancy = round(28 + 42 * illumination + 28 * clear_horizon + visibility_bonus - moisture_penalty - rain_penalty)
    vibrancy = max(8, min(98, vibrancy))

    horizon_penalty = min(32.0, max(0.0, horizon_hours - 12) * 0.18)
    completeness = 94 if weather.visibility_m > 0 else 70
    confidence = round(completeness - horizon_penalty - min(12, rain * 0.08))
    confidence = max(38, min(94, confidence))

    if low > 78 or rain > 72:
        palette_key, colors, summary = "muted", ["Pewter", "Mauve", "Slate"], "Quiet color behind a soft, clouded horizon."
    elif high + mid > 85 and clear_horizon > 0.45:
        palette_key, colors, summary = "dramatic", ["Amber", "Rose", "Plum"], "A layered sky with a strong chance of dramatic color."
    elif weather.cloud_cover < 22:
        palette_key, colors, summary = "clear", ["Apricot", "Coral", "Violet"], "A clean horizon, warm at first and violet after."
    else:
        palette_key, colors, summary = "soft", ["Peach", "Rose", "Lavender"], "Soft color with a gentle, lingering afterglow."

    elevation, azimuth = solar_position(sunset, latitude, longitude)
    return Prediction(
        vibrancy=vibrancy,
        confidence=confidence,
        palette=PALETTES[palette_key],
        dominant_colors=colors,
        summary=summary,
        features={
            "weather_valid_at": weather.valid_at.isoformat(),
            "cloud_cover": weather.cloud_cover,
            "cloud_cover_low": weather.cloud_cover_low,
            "cloud_cover_mid": weather.cloud_cover_mid,
            "cloud_cover_high": weather.cloud_cover_high,
            "humidity": weather.humidity,
            "visibility_m": weather.visibility_m,
            "precipitation_probability": weather.precipitation_probability,
            "visibility_km": round(visibility_km, 2),
            "solar_elevation": round(elevation, 2),
            "solar_azimuth": round(azimuth, 2),
            "forecast_horizon_hours": round(horizon_hours, 1),
        },
    )

