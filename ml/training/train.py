"""Train and evaluate a sunset vibrancy model from a labeled CSV.

Usage:
  python -m ml.training.train --input data/labeled_sunsets.csv --output ml/artifacts
"""

import argparse
import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error

from ml.features.build import build_features


def split_without_leakage(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Hold out both later timestamps and locations absent from the training partition."""
    required = {"captured_at", "location_group", "vibrancy"}
    if missing := required - set(frame.columns):
        raise ValueError(f"Missing training columns: {sorted(missing)}")
    ordered = frame.assign(captured_at=pd.to_datetime(frame["captured_at"], utc=True)).sort_values("captured_at")
    cutoff = ordered["captured_at"].quantile(0.8)
    candidate_test = ordered[ordered["captured_at"] >= cutoff]
    held_out_locations = set(candidate_test["location_group"].drop_duplicates().iloc[::3])
    test = candidate_test[candidate_test["location_group"].isin(held_out_locations)]
    train = ordered[(ordered["captured_at"] < cutoff) & ~ordered["location_group"].isin(held_out_locations)]
    if train.empty or test.empty:
        raise ValueError("Dataset is too small or lacks enough time/location diversity for a leakage-safe split")
    return train, test


def train(input_path: Path, output_dir: Path) -> dict[str, float | int | str]:
    frame = pd.read_csv(input_path)
    train_frame, test_frame = split_without_leakage(frame)
    model = HistGradientBoostingRegressor(max_iter=250, learning_rate=0.055, max_leaf_nodes=20, random_state=42)
    model.fit(build_features(train_frame), train_frame["vibrancy"])
    predictions = model.predict(build_features(test_frame))
    metrics = {
        "vibrancy_mae": round(float(mean_absolute_error(test_frame["vibrancy"], predictions)), 4),
        "training_rows": len(train_frame),
        "test_rows": len(test_frame),
        "split": "time and held-out location",
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, output_dir / "vibrancy.joblib")
    (output_dir / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    return metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("ml/artifacts"))
    arguments = parser.parse_args()
    print(json.dumps(train(arguments.input, arguments.output), indent=2))

