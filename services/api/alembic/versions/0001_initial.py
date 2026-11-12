"""Initial Afterglow schema."""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "locations",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(160), nullable=False),
        sa.Column("region", sa.String(160)), sa.Column("country", sa.String(120), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False), sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("timezone", sa.String(80), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("latitude", "longitude", name="uq_location_coordinates"),
    )
    op.create_table(
        "model_versions", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(80), nullable=False),
        sa.Column("version", sa.String(40), nullable=False, unique=True), sa.Column("kind", sa.String(30), nullable=False),
        sa.Column("parameters", sa.JSON(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "weather_forecasts", sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("location_id", sa.Integer(), sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("valid_at", sa.DateTime(timezone=True), nullable=False), sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cloud_cover", sa.Float(), nullable=False), sa.Column("cloud_cover_low", sa.Float(), nullable=False),
        sa.Column("cloud_cover_mid", sa.Float(), nullable=False), sa.Column("cloud_cover_high", sa.Float(), nullable=False),
        sa.Column("humidity", sa.Float(), nullable=False), sa.Column("visibility_m", sa.Float(), nullable=False),
        sa.Column("precipitation_probability", sa.Float(), nullable=False), sa.Column("raw_payload", sa.JSON(), nullable=False),
    )
    op.create_index("ix_weather_location_valid", "weather_forecasts", ["location_id", "valid_at"])
    op.create_table(
        "sunset_predictions", sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("location_id", sa.Integer(), sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("model_version_id", sa.Integer(), sa.ForeignKey("model_versions.id"), nullable=False),
        sa.Column("sunset_at", sa.DateTime(timezone=True), nullable=False), sa.Column("best_window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("best_window_end", sa.DateTime(timezone=True), nullable=False), sa.Column("vibrancy", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.Integer(), nullable=False), sa.Column("palette", sa.JSON(), nullable=False),
        sa.Column("dominant_colors", sa.JSON(), nullable=False), sa.Column("summary", sa.String(180), nullable=False),
        sa.Column("features", sa.JSON(), nullable=False), sa.Column("forecast_horizon_hours", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_prediction_location_sunset", "sunset_predictions", ["location_id", "sunset_at"])
    op.create_table(
        "sunset_photos", sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("prediction_id", sa.String(36), sa.ForeignKey("sunset_predictions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("object_key", sa.String(500), nullable=False), sa.Column("content_type", sa.String(80), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False), sa.Column("observed_palette", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "prediction_evaluations", sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("prediction_id", sa.String(36), sa.ForeignKey("sunset_predictions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("photo_id", sa.String(36), sa.ForeignKey("sunset_photos.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("mean_delta_e", sa.Float(), nullable=False), sa.Column("palette_accuracy", sa.Float(), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_prediction_evaluations_prediction_id", "prediction_evaluations", ["prediction_id"])


def downgrade() -> None:
    op.drop_table("prediction_evaluations")
    op.drop_table("sunset_photos")
    op.drop_table("sunset_predictions")
    op.drop_table("weather_forecasts")
    op.drop_table("model_versions")
    op.drop_table("locations")
