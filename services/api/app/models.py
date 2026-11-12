import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Location(Base):
    __tablename__ = "locations"
    __table_args__ = (UniqueConstraint("latitude", "longitude", name="uq_location_coordinates"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    region: Mapped[str | None] = mapped_column(String(160))
    country: Mapped[str] = mapped_column(String(120))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    timezone: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    version: Mapped[str] = mapped_column(String(40), unique=True)
    kind: Mapped[str] = mapped_column(String(30), default="heuristic")
    parameters: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class WeatherForecast(Base):
    __tablename__ = "weather_forecasts"
    __table_args__ = (Index("ix_weather_location_valid", "location_id", "valid_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id", ondelete="CASCADE"))
    valid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    cloud_cover: Mapped[float] = mapped_column(Float)
    cloud_cover_low: Mapped[float] = mapped_column(Float)
    cloud_cover_mid: Mapped[float] = mapped_column(Float)
    cloud_cover_high: Mapped[float] = mapped_column(Float)
    humidity: Mapped[float] = mapped_column(Float)
    visibility_m: Mapped[float] = mapped_column(Float)
    precipitation_probability: Mapped[float] = mapped_column(Float)
    raw_payload: Mapped[dict] = mapped_column(JSON)


class SunsetPrediction(Base):
    __tablename__ = "sunset_predictions"
    __table_args__ = (Index("ix_prediction_location_sunset", "location_id", "sunset_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id", ondelete="CASCADE"))
    model_version_id: Mapped[int] = mapped_column(ForeignKey("model_versions.id"))
    sunset_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    best_window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    best_window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    vibrancy: Mapped[int] = mapped_column(Integer)
    confidence: Mapped[int] = mapped_column(Integer)
    palette: Mapped[list] = mapped_column(JSON)
    dominant_colors: Mapped[list] = mapped_column(JSON)
    summary: Mapped[str] = mapped_column(String(180))
    features: Mapped[dict] = mapped_column(JSON)
    forecast_horizon_hours: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    location: Mapped[Location] = relationship()
    observations: Mapped[list["SunsetPhoto"]] = relationship(back_populates="prediction")


class SunsetPhoto(Base):
    __tablename__ = "sunset_photos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    prediction_id: Mapped[str] = mapped_column(ForeignKey("sunset_predictions.id", ondelete="CASCADE"))
    object_key: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str] = mapped_column(String(80))
    size_bytes: Mapped[int] = mapped_column(Integer)
    observed_palette: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    prediction: Mapped[SunsetPrediction] = relationship(back_populates="observations")
    evaluation: Mapped["PredictionEvaluation"] = relationship(back_populates="photo", uselist=False)


class PredictionEvaluation(Base):
    __tablename__ = "prediction_evaluations"

    id: Mapped[int] = mapped_column(primary_key=True)
    prediction_id: Mapped[str] = mapped_column(ForeignKey("sunset_predictions.id", ondelete="CASCADE"), index=True)
    photo_id: Mapped[str] = mapped_column(ForeignKey("sunset_photos.id", ondelete="CASCADE"), unique=True)
    mean_delta_e: Mapped[float] = mapped_column(Float)
    palette_accuracy: Mapped[float] = mapped_column(Float)
    details: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    photo: Mapped[SunsetPhoto] = relationship(back_populates="evaluation")

