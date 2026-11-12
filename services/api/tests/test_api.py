import io
import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from PIL import Image

from services.api.app.db import SessionLocal
from services.api.app.main import app
from services.api.app.models import Location, ModelVersion, SunsetPrediction


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_location_search_validates_short_query() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/locations/search?q=x")
    assert response.status_code == 422


def test_observation_upload_evaluates_saved_prediction() -> None:
    unique = uuid.uuid4().hex
    with TestClient(app):
        with SessionLocal() as db:
            location = Location(
                name="Test Sky", region=None, country="Test", latitude=12.34567,
                longitude=round(34 + (int(unique[:8], 16) % 100000) / 1_000_000, 5), timezone="UTC",
            )
            model = ModelVersion(name="Test", version=f"test-{unique}", kind="heuristic", parameters={})
            db.add_all([location, model])
            db.flush()
            sunset = datetime.now(timezone.utc) + timedelta(hours=2)
            prediction = SunsetPrediction(
                location_id=location.id, model_version_id=model.id, sunset_at=sunset,
                best_window_start=sunset - timedelta(minutes=20), best_window_end=sunset + timedelta(minutes=20),
                vibrancy=72, confidence=88,
                palette=["#F2B28D", "#E88772", "#D58CA6", "#8D83BA", "#625B78"],
                dominant_colors=["Peach", "Rose", "Lavender"], summary="Test sky",
                features={"cloud_cover": 40}, forecast_horizon_hours=2,
            )
            db.add(prediction)
            db.commit()
            prediction_id = prediction.id

        image = Image.new("RGB", (80, 80), "#F2B28D")
        content = io.BytesIO()
        image.save(content, format="PNG")
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/observations",
                data={"prediction_id": prediction_id},
                files={"photo": ("sunset.png", content.getvalue(), "image/png")},
            )
    assert response.status_code == 201
    assert response.json()["prediction_id"] == prediction_id
    assert len(response.json()["observed_palette"]) == 5

