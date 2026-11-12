import json
from datetime import datetime, timezone

from services.api.app.prediction import predict_sunset
from services.api.app.providers.open_meteo import WeatherPoint


def weather(**overrides: float) -> WeatherPoint:
    values = {
        "cloud_cover": 48,
        "cloud_cover_low": 12,
        "cloud_cover_mid": 42,
        "cloud_cover_high": 58,
        "humidity": 52,
        "visibility_m": 24000,
        "precipitation_probability": 4,
    }
    values.update(overrides)
    return WeatherPoint(valid_at=datetime.now(timezone.utc), **values)


def test_layered_clouds_produce_vibrant_forecast() -> None:
    prediction = predict_sunset(weather(), datetime(2025, 6, 1, 3, tzinfo=timezone.utc), 37.7, -122.4, 8)
    assert prediction.vibrancy >= 75
    assert prediction.confidence >= 80
    assert len(prediction.palette) == 5


def test_low_overcast_suppresses_vibrancy() -> None:
    clear = predict_sunset(weather(), datetime(2025, 6, 1, 3, tzinfo=timezone.utc), 37.7, -122.4, 8)
    overcast = predict_sunset(
        weather(cloud_cover_low=95, cloud_cover=100, precipitation_probability=90, humidity=96),
        datetime(2025, 6, 1, 3, tzinfo=timezone.utc), 37.7, -122.4, 8,
    )
    assert overcast.vibrancy < clear.vibrancy
    assert overcast.dominant_colors == ["Pewter", "Mauve", "Slate"]


def test_confidence_decreases_with_horizon() -> None:
    near = predict_sunset(weather(), datetime(2025, 6, 1, 3, tzinfo=timezone.utc), 37.7, -122.4, 6)
    far = predict_sunset(weather(), datetime(2025, 6, 1, 3, tzinfo=timezone.utc), 37.7, -122.4, 150)
    assert far.confidence < near.confidence


def test_features_are_json_serializable() -> None:
    prediction = predict_sunset(weather(), datetime(2025, 6, 1, 3, tzinfo=timezone.utc), 37.7, -122.4, 8)
    assert json.loads(json.dumps(prediction.features))["weather_valid_at"]

