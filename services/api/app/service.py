import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from redis import Redis
from redis.exceptions import RedisError
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import Location, ModelVersion, SunsetPrediction, WeatherForecast
from .prediction import predict_sunset
from .providers.open_meteo import OpenMeteoClient, sunset_weather
from .schemas import Atmosphere, ForecastResponse, LocationResult, WeeklyForecastResponse
from .solar import calculate_sunset


MODEL_VERSION = "baseline-heuristic-1.0.0"
logger = logging.getLogger("afterglow.forecast")


def _cache_key(location_data: dict) -> str:
    material = json.dumps(
        {
            "lat": round(float(location_data["latitude"]), 4),
            "lon": round(float(location_data["longitude"]), 4),
            "timezone": location_data["timezone"],
            "local_date": datetime.now(ZoneInfo(location_data["timezone"])).date().isoformat(),
            "model": MODEL_VERSION,
        },
        sort_keys=True,
    )
    return "afterglow:weekly:" + hashlib.sha256(material.encode()).hexdigest()[:24]


def _redis() -> Redis:
    return Redis.from_url(get_settings().redis_url, socket_connect_timeout=0.25, socket_timeout=0.25)


def _cached_week(location_data: dict) -> WeeklyForecastResponse | None:
    try:
        value = _redis().get(_cache_key(location_data))
        if value:
            logger.info("forecast_cache_hit")
            return WeeklyForecastResponse.model_validate_json(value)
        logger.info("forecast_cache_miss")
    except RedisError:
        logger.info("forecast_cache_unavailable")
    return None


def _store_cached_week(location_data: dict, result: WeeklyForecastResponse) -> None:
    try:
        _redis().setex(_cache_key(location_data), 900, result.model_dump_json())
    except RedisError:
        logger.info("forecast_cache_write_skipped")


def _clock(moment: datetime, meridiem: bool = True) -> str:
    pattern = "%I:%M %p" if meridiem else "%I:%M"
    return moment.strftime(pattern).lstrip("0")


def _location_schema(location: Location) -> LocationResult:
    return LocationResult(
        id=location.id,
        name=location.name,
        region=location.region,
        country=location.country,
        latitude=location.latitude,
        longitude=location.longitude,
        timezone=location.timezone,
    )


def _get_or_create_location(db: Session, location_data: dict) -> Location:
    latitude = round(float(location_data["latitude"]), 5)
    longitude = round(float(location_data["longitude"]), 5)
    location = db.scalar(select(Location).where(Location.latitude == latitude, Location.longitude == longitude))
    if location:
        return location
    location = Location(
        name=location_data["name"],
        region=location_data.get("region"),
        country=location_data.get("country", ""),
        latitude=latitude,
        longitude=longitude,
        timezone=location_data["timezone"],
    )
    db.add(location)
    db.flush()
    return location


def _get_model(db: Session) -> ModelVersion:
    model = db.scalar(select(ModelVersion).where(ModelVersion.version == MODEL_VERSION))
    if model:
        return model
    model = ModelVersion(
        name="Atmospheric heuristic baseline",
        version=MODEL_VERSION,
        kind="heuristic",
        parameters={"description": "Rule-based baseline using measured forecast fields and solar geometry"},
    )
    db.add(model)
    db.flush()
    return model


def _response(prediction: SunsetPrediction, location: Location) -> ForecastResponse:
    features = prediction.features
    timezone_name = location.timezone
    local_sunset = prediction.sunset_at.astimezone(ZoneInfo(timezone_name))
    local_start = prediction.best_window_start.astimezone(ZoneInfo(timezone_name))
    local_end = prediction.best_window_end.astimezone(ZoneInfo(timezone_name))
    return ForecastResponse(
        prediction_id=prediction.id,
        location=_location_schema(location),
        date=local_sunset.date(),
        sunset_at=local_sunset,
        sunset_display=_clock(local_sunset),
        best_window_start=local_start,
        best_window_end=local_end,
        best_window_display=f"{_clock(local_start, False)}–{_clock(local_end)}",
        palette=prediction.palette,
        dominant_colors=prediction.dominant_colors,
        vibrancy=prediction.vibrancy,
        confidence=prediction.confidence,
        summary=prediction.summary,
        atmosphere=Atmosphere(
            cloud_cover=round(features["cloud_cover"]),
            low_clouds=round(features["cloud_cover_low"]),
            mid_clouds=round(features["cloud_cover_mid"]),
            high_clouds=round(features["cloud_cover_high"]),
            humidity=round(features["humidity"]),
            visibility_km=round(features["visibility_km"], 1),
            precipitation_probability=round(features["precipitation_probability"]),
        ),
        forecast_horizon_hours=prediction.forecast_horizon_hours,
    )


async def generate_weekly_forecast(db: Session, location_data: dict, client: OpenMeteoClient | None = None) -> WeeklyForecastResponse:
    cached = _cached_week(location_data)
    if cached:
        return cached
    provider = client or OpenMeteoClient()
    payload = await provider.forecast(
        float(location_data["latitude"]),
        float(location_data["longitude"]),
        location_data["timezone"],
        days=7,
    )
    location = _get_or_create_location(db, location_data)
    model = _get_model(db)
    now = datetime.now(timezone.utc)
    results: list[ForecastResponse] = []
    daily_sunsets = payload["daily"]["sunset"]

    for sunset_value in daily_sunsets:
        sunset = datetime.fromisoformat(sunset_value).replace(tzinfo=ZoneInfo(location.timezone))
        point = sunset_weather(payload, sunset)
        horizon = max(0.0, (sunset.astimezone(timezone.utc) - now).total_seconds() / 3600)
        prediction_value = predict_sunset(point, sunset, location.latitude, location.longitude, horizon)
        weather = WeatherForecast(
            location_id=location.id,
            valid_at=point.valid_at.astimezone(timezone.utc),
            cloud_cover=point.cloud_cover,
            cloud_cover_low=point.cloud_cover_low,
            cloud_cover_mid=point.cloud_cover_mid,
            cloud_cover_high=point.cloud_cover_high,
            humidity=point.humidity,
            visibility_m=point.visibility_m,
            precipitation_probability=point.precipitation_probability,
            raw_payload={"provider": "open-meteo", "hour": point.valid_at.isoformat()},
        )
        db.add(weather)
        prediction = SunsetPrediction(
            location_id=location.id,
            model_version_id=model.id,
            sunset_at=sunset.astimezone(timezone.utc),
            best_window_start=(sunset - timedelta(minutes=24)).astimezone(timezone.utc),
            best_window_end=(sunset + timedelta(minutes=22)).astimezone(timezone.utc),
            vibrancy=prediction_value.vibrancy,
            confidence=prediction_value.confidence,
            palette=prediction_value.palette,
            dominant_colors=prediction_value.dominant_colors,
            summary=prediction_value.summary,
            features=prediction_value.features,
            forecast_horizon_hours=horizon,
        )
        db.add(prediction)
        db.flush()
        results.append(_response(prediction, location))

    db.commit()
    best = max(results, key=lambda result: result.vibrancy)
    weekly = WeeklyForecastResponse(location=_location_schema(location), best_prediction_id=best.prediction_id, days=results)
    _store_cached_week(location_data, weekly)
    return weekly


def prediction_response(db: Session, prediction_id: str) -> ForecastResponse | None:
    prediction = db.get(SunsetPrediction, prediction_id)
    if not prediction:
        return None
    location = db.get(Location, prediction.location_id)
    if not location:
        return None
    return _response(prediction, location)

