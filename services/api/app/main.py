import logging
import time
import uuid
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import UnidentifiedImageError
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .color import compare_palettes, extract_palette
from .config import get_settings
from .db import Base, engine, get_db
from .models import PredictionEvaluation, SunsetPhoto, SunsetPrediction
from .providers.open_meteo import OpenMeteoClient, WeatherProviderError
from .schemas import EvaluationResponse, ForecastResponse, LocationResult, ObservationResponse, WeeklyForecastResponse
from .service import generate_weekly_forecast, prediction_response
from .storage import get_storage

settings = get_settings()
logging.basicConfig(
    level=settings.log_level,
    format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}',
)
logger = logging.getLogger("afterglow.api")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.upload_directory.mkdir(parents=True, exist_ok=True)
    if settings.environment == "test" or settings.database_url.startswith("sqlite"):
        Base.metadata.create_all(engine)
    yield


app = FastAPI(
    title="Afterglow API",
    version="1.0.0",
    description="Heuristic sunset color forecasts derived from weather data and solar geometry.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("unhandled_request_error", extra={"request_id": request_id})
        raise
    response.headers["x-request-id"] = request_id
    response.headers["x-response-time-ms"] = f"{(time.perf_counter() - started) * 1000:.1f}"
    return response


@app.exception_handler(WeatherProviderError)
async def weather_error(_: Request, exc: WeatherProviderError) -> JSONResponse:
    return JSONResponse(status_code=503, content={"error": {"code": "weather_provider_unavailable", "message": str(exc)}})


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def ready(db: Session = Depends(get_db)) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ready"}


@app.get("/api/v1/locations/search", response_model=list[LocationResult])
async def search_locations(q: str = Query(min_length=2, max_length=120), limit: int = Query(8, ge=1, le=10)):
    return await OpenMeteoClient().search_locations(q, limit)


def _location_data(
    latitude: float,
    longitude: float,
    name: str,
    timezone: str,
    region: str | None,
    country: str,
) -> dict:
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        raise HTTPException(status_code=422, detail="Coordinates are outside valid bounds")
    return {
        "latitude": latitude,
        "longitude": longitude,
        "name": name,
        "timezone": timezone,
        "region": region,
        "country": country,
    }


@app.get("/api/v1/forecast", response_model=ForecastResponse)
async def forecast(
    latitude: float,
    longitude: float,
    name: str,
    timezone: str,
    region: str | None = None,
    country: str = "",
    db: Session = Depends(get_db),
):
    weekly = await generate_weekly_forecast(db, _location_data(latitude, longitude, name, timezone, region, country))
    return weekly.days[0]


@app.get("/api/v1/forecast/weekly", response_model=WeeklyForecastResponse)
async def weekly_forecast(
    latitude: float,
    longitude: float,
    name: str,
    timezone: str,
    region: str | None = None,
    country: str = "",
    db: Session = Depends(get_db),
):
    return await generate_weekly_forecast(db, _location_data(latitude, longitude, name, timezone, region, country))


@app.get("/api/v1/forecast/{prediction_id}", response_model=ForecastResponse)
def get_forecast(prediction_id: str, db: Session = Depends(get_db)):
    result = prediction_response(db, prediction_id)
    if not result:
        raise HTTPException(status_code=404, detail="Forecast snapshot not found")
    return result


@app.post("/api/v1/observations", response_model=ObservationResponse, status_code=201)
async def create_observation(
    prediction_id: str = Form(...),
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    prediction = db.get(SunsetPrediction, prediction_id)
    if not prediction:
        raise HTTPException(status_code=404, detail="Forecast snapshot not found")
    if photo.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Upload a JPEG, PNG, or WebP image")
    content = await photo.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="Image exceeds the 10 MB upload limit")
    try:
        observed_palette = extract_palette(content)
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=422, detail="The uploaded file is not a valid image")

    observation_id = str(uuid.uuid4())
    extension = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[photo.content_type]
    object_key = f"{prediction_id}/{observation_id}{extension}"
    get_storage().put(object_key, content, photo.content_type)
    mean_delta_e, palette_accuracy = compare_palettes(prediction.palette, observed_palette)
    record = SunsetPhoto(
        id=observation_id,
        prediction_id=prediction_id,
        object_key=object_key,
        content_type=photo.content_type,
        size_bytes=len(content),
        observed_palette=observed_palette,
    )
    db.add(record)
    db.flush()
    evaluation = PredictionEvaluation(
        prediction_id=prediction_id,
        photo_id=observation_id,
        mean_delta_e=mean_delta_e,
        palette_accuracy=palette_accuracy,
        details={"metric": "CIE76 nearest-palette Delta E", "camera_bias_not_corrected": True},
    )
    db.add(evaluation)
    db.commit()
    return ObservationResponse(
        observation_id=observation_id,
        prediction_id=prediction_id,
        forecast_palette=prediction.palette,
        observed_palette=observed_palette,
        mean_delta_e=mean_delta_e,
        palette_accuracy=palette_accuracy,
        privacy_note="The image is stored privately for forecast evaluation and is not publicly listed.",
    )


@app.get("/api/v1/evaluations/{prediction_id}", response_model=EvaluationResponse)
def get_evaluation(prediction_id: str, db: Session = Depends(get_db)):
    evaluation = db.scalar(
        select(PredictionEvaluation).where(PredictionEvaluation.prediction_id == prediction_id).order_by(PredictionEvaluation.created_at.desc())
    )
    if not evaluation:
        raise HTTPException(status_code=404, detail="No observation has been evaluated for this forecast")
    photo = db.get(SunsetPhoto, evaluation.photo_id)
    prediction = db.get(SunsetPrediction, prediction_id)
    return EvaluationResponse(
        observation_id=photo.id,
        prediction_id=prediction_id,
        forecast_palette=prediction.palette,
        observed_palette=photo.observed_palette,
        mean_delta_e=evaluation.mean_delta_e,
        palette_accuracy=evaluation.palette_accuracy,
        privacy_note="The image is stored privately for forecast evaluation and is not publicly listed.",
    )

