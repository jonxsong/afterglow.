# Architecture

Afterglow is a modular monolith. The browser uses a single Next.js application;
FastAPI owns location lookup, forecast generation, immutable prediction snapshots,
photo validation, and evaluation. PostgreSQL is the system of record, Redis backs
RQ jobs, forecast caching, and refresh locks, and uploaded photos use a storage
adapter that maps to a local volume in development and private S3-compatible storage
when `S3_BUCKET` is configured.

## Forecast flow

1. The user selects a city from Open-Meteo's geocoding API or supplies browser coordinates.
2. FastAPI requests hourly cloud layers, humidity, visibility, precipitation probability,
   and daily sunset times from Open-Meteo with bounded retries and timeouts.
3. The baseline combines the nearest sunset-hour weather with NOAA-style solar geometry.
4. It emits a palette, vibrancy, confidence, and viewing window. Confidence decays with horizon.
5. The weather input, feature vector, model version, and output are stored together as a snapshot.
6. A later photo is validated, privately stored, quantized to five colors, and compared in CIE Lab.

The baseline is deterministic and is always labeled **heuristic**. The offline training
pipeline is intentionally disconnected from production inference until a real labeled
dataset exists and a leakage-safe evaluation shows improvement.

## Reliability and privacy

- External requests use timeouts, schema checks, and exponential retry.
- Database uniqueness/indexes protect coordinates and common access patterns.
- Uploads are limited to 10 MB and JPEG/PNG/WebP, decoded before persistence, and never listed publicly.
- RQ refresh jobs use Redis locks so retries are idempotent for a location.
- API responses include request IDs and response-time headers; logs are structured JSON.
- In production, use private S3 buckets, SSE-S3 or KMS encryption, lifecycle retention, and presigned access.

