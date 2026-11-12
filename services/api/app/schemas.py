from datetime import date, datetime

from pydantic import BaseModel, Field


class LocationResult(BaseModel):
    id: int | None = None
    name: str
    region: str | None = None
    country: str
    latitude: float
    longitude: float
    timezone: str


class Atmosphere(BaseModel):
    cloud_cover: int = Field(ge=0, le=100)
    low_clouds: int = Field(ge=0, le=100)
    mid_clouds: int = Field(ge=0, le=100)
    high_clouds: int = Field(ge=0, le=100)
    humidity: int = Field(ge=0, le=100)
    visibility_km: float = Field(ge=0)
    precipitation_probability: int = Field(ge=0, le=100)


class ForecastResponse(BaseModel):
    prediction_id: str
    model_kind: str = "heuristic"
    location: LocationResult
    date: date
    sunset_at: datetime
    sunset_display: str
    best_window_start: datetime
    best_window_end: datetime
    best_window_display: str
    palette: list[str]
    dominant_colors: list[str]
    vibrancy: int
    confidence: int
    summary: str
    interpretation_label: str = "Forecast interpretation"
    atmosphere: Atmosphere
    forecast_horizon_hours: float


class WeeklyForecastResponse(BaseModel):
    location: LocationResult
    best_prediction_id: str
    days: list[ForecastResponse]


class ObservationResponse(BaseModel):
    observation_id: str
    prediction_id: str
    forecast_palette: list[str]
    observed_palette: list[str]
    mean_delta_e: float
    palette_accuracy: float
    privacy_note: str


class EvaluationResponse(ObservationResponse):
    pass


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail

