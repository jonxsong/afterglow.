from datetime import date, datetime, timezone

from services.api.app.solar import calculate_sunset, solar_position


def test_san_francisco_summer_sunset_is_plausible() -> None:
    sunset = calculate_sunset(date(2025, 6, 21), 37.7749, -122.4194, "America/Los_Angeles")
    assert sunset.hour == 20
    assert 20 <= sunset.minute <= 45


def test_solar_position_near_sunset_is_near_horizon() -> None:
    sunset = calculate_sunset(date(2025, 3, 20), 37.7749, -122.4194, "America/Los_Angeles")
    elevation, azimuth = solar_position(sunset, 37.7749, -122.4194)
    assert -2.0 < elevation < 1.0
    assert 240 < azimuth < 300


def test_solar_position_returns_normalized_azimuth() -> None:
    elevation, azimuth = solar_position(datetime(2025, 1, 1, 20, tzinfo=timezone.utc), 40.0, -74.0)
    assert -90 <= elevation <= 90
    assert 0 <= azimuth < 360

