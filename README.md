# afterglow.

**Chase the beautiful.** Afterglow turns live weather forecasts and solar geometry
into a clear, calm outlook for tonight's sunset: likely colors, vibrancy, confidence,
and the best time to step outside.

This repository contains a working full-stack MVP. Its production forecast is a
transparent deterministic baseline—not a trained-ML claim. A separate training
pipeline is included for the point when a real, representative labeled dataset exists.

## What is implemented

- Premium responsive Next.js experience with a deterministic animated sky interpretation
- Open-Meteo geocoding and real hourly forecast integration with retries and validation
- Local-time sunset forecasts and seven-day outlook with horizon-aware confidence
- NOAA-style solar calculations and a documented atmospheric heuristic baseline
- Immutable PostgreSQL forecast snapshots and model-version records
- Private sunset photo upload, five-color extraction, CIE Lab Delta E, and palette similarity
- FastAPI/OpenAPI endpoints, Alembic migration, Redis/RQ worker, structured logs, and health checks
- Docker Compose, frontend/backend tests, Playwright and k6 configurations
- AWS Terraform starter, CI workflow, architecture, deployment, cost, and ML documentation

## Repository map

```text
apps/web/                 Next.js App Router frontend
services/api/             FastAPI, SQLAlchemy, Alembic, forecast domain
services/worker/          Redis/RQ background worker and idempotent refresh job
ml/                       Leakage-aware offline feature/training/evaluation pipeline
infrastructure/terraform/ AWS production starter
tests/load/               k6 smoke/load scenario
docs/                     Architecture and deployment notes
```

## Run everything with Docker

Requirements: Docker with Compose and internet access for Open-Meteo.

```bash
cp .env.example .env
docker compose up --build
```

- App: <http://localhost:3000>
- API: <http://localhost:8000>
- OpenAPI: <http://localhost:8000/docs>

The default Compose stack starts the web app, API, PostgreSQL, Redis, and RQ worker.

## Run without Docker

Use Python 3.12 and Node 22+ with pnpm.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r services/api/requirements.txt
set DATABASE_URL=sqlite:///./afterglow.sqlite3
uvicorn services.api.app.main:app --reload --port 8000
```

In a second terminal:

```bash
pnpm install
pnpm --dir apps/web dev
```

For PowerShell, environment variables can be set with
`$env:DATABASE_URL="sqlite:///./afterglow.sqlite3"`.

## Configuration

| Variable | Required | Default/purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | browser build | `http://localhost:8000` |
| `DATABASE_URL` | production | SQLite locally; Compose uses PostgreSQL |
| `REDIS_URL` | worker/production | `redis://localhost:6379/0` |
| `UPLOAD_DIRECTORY` | no | `data/uploads` |
| `MAX_UPLOAD_BYTES` | no | `10485760` (10 MB) |
| `S3_BUCKET` | production uploads | Private bucket; local disk when unset |
| `S3_ENDPOINT_URL` | no | Optional S3-compatible endpoint |
| `OPEN_METEO_TIMEOUT_SECONDS` | no | `10` |
| `ALLOWED_ORIGINS` | production | comma-separated web origins |
| `LOG_LEVEL` | no | `INFO` |

Open-Meteo does not require an API key. No credentials are committed. Production AWS
secrets should live in Secrets Manager and uploads in a private encrypted S3 bucket.

## API

- `GET /api/v1/locations/search?q=...`
- `GET /api/v1/forecast?...location fields...`
- `GET /api/v1/forecast/weekly?...location fields...`
- `GET /api/v1/forecast/{prediction_id}`
- `POST /api/v1/observations` (multipart `prediction_id` + `photo`)
- `GET /api/v1/evaluations/{prediction_id}`
- `GET /health` and `GET /ready`

## Tests

```bash
pytest
pnpm --dir apps/web test
pnpm --dir apps/web build
pnpm --dir apps/web test:e2e
k6 run tests/load/forecast.js
```

Playwright and k6 are optional local tools. Do not treat the configured k6 thresholds
as measured performance; run the scenario in the target environment and report the result.

## Forecast and ML limitations

Sunset colors cannot be observed directly from ordinary weather APIs. The baseline uses
cloud-layer distribution, low-cloud obstruction, humidity, visibility, precipitation,
solar position, and forecast horizon as imperfect proxies. It does not currently measure
all aerosols, smoke layers, terrain obstruction, or local marine-layer behavior.

Photo evaluation is also affected by exposure, white balance, HDR, editing, crop, and
foreground content. The current comparison uses dominant upper-image colors and CIE76
Delta E. It is useful for product feedback, not a peer-reviewed accuracy claim.

The training command only works when you supply real labels:

```bash
python -m ml.training.train --input data/labeled_sunsets.csv --output ml/artifacts
```

See [architecture](docs/architecture.md), [deployment](docs/deployment.md), and the
[evaluation contract](ml/evaluation/README.md) for the production path.

## Recommended next steps

1. Collect consented, timestamped, geolocated sunset images across seasons and cameras.
2. Add aerosol/smoke and terrain-horizon sources where coverage and licensing permit.
3. Replace local upload writes with an S3 adapter plus retention/deletion controls.
4. Add authentication before exposing a personal observation history.
5. Run a calibrated baseline-vs-trained-model study before enabling trained inference.

