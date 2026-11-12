from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = "sqlite:///./afterglow.sqlite3"
    redis_url: str = "redis://localhost:6379/0"
    upload_directory: Path = Path("data/uploads")
    max_upload_bytes: int = 10 * 1024 * 1024
    s3_bucket: str | None = None
    s3_endpoint_url: str | None = None
    open_meteo_timeout_seconds: float = 10.0
    allowed_origins: str = "http://localhost:3000"
    log_level: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


