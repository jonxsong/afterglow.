import asyncio
import hashlib
import json

from redis import Redis

from services.api.app.config import get_settings
from services.api.app.db import SessionLocal
from services.api.app.service import generate_weekly_forecast


def refresh_location(location: dict) -> dict:
    """Idempotent RQ task used by scheduled ingestion jobs."""
    settings = get_settings()
    redis = Redis.from_url(settings.redis_url)
    digest = hashlib.sha256(json.dumps(location, sort_keys=True).encode()).hexdigest()[:20]
    lock = redis.lock(f"afterglow:refresh:{digest}", timeout=120, blocking_timeout=1)
    if not lock.acquire(blocking=True):
        return {"status": "skipped", "reason": "refresh already in progress"}
    try:
        with SessionLocal() as db:
            result = asyncio.run(generate_weekly_forecast(db, location))
            return {"status": "ok", "days": len(result.days), "location": result.location.name}
    finally:
        lock.release()

