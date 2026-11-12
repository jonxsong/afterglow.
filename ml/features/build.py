"""Shared feature construction for offline training.

The production heuristic remains the only enabled inference model until a labeled
dataset is supplied and an artifact passes held-out time/location evaluation.
"""

from collections.abc import Iterable

import pandas as pd


REQUIRED_COLUMNS = {
    "cloud_cover",
    "cloud_cover_low",
    "cloud_cover_mid",
    "cloud_cover_high",
    "humidity",
    "visibility_km",
    "precipitation_probability",
    "solar_elevation",
    "solar_azimuth",
    "forecast_horizon_hours",
}


def build_features(frame: pd.DataFrame) -> pd.DataFrame:
    missing = REQUIRED_COLUMNS - set(frame.columns)
    if missing:
        raise ValueError(f"Missing required feature columns: {sorted(missing)}")
    features = frame.loc[:, sorted(REQUIRED_COLUMNS)].copy()
    features["high_mid_cloud_balance"] = (frame["cloud_cover_high"] + frame["cloud_cover_mid"]) / 2
    features["clear_horizon_proxy"] = 100 - frame["cloud_cover_low"]
    features["moisture_visibility_interaction"] = frame["humidity"] / frame["visibility_km"].clip(lower=0.5)
    return features.replace([float("inf"), float("-inf")], pd.NA).fillna(features.median(numeric_only=True))

