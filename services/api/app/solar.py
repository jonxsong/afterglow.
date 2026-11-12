"""Solar calculations based on NOAA's published approximate equations.

Accuracy is appropriate for consumer sunset planning, not navigation.
"""

import math
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo


def _normalize_degrees(value: float) -> float:
    return value % 360.0


def calculate_sunset(day: date, latitude: float, longitude: float, timezone_name: str) -> datetime:
    """Return local sunset for a coordinate using the NOAA sunrise equation."""
    zenith = 90.833
    day_of_year = day.timetuple().tm_yday
    lng_hour = longitude / 15.0
    approximate_time = day_of_year + ((18.0 - lng_hour) / 24.0)
    mean_anomaly = (0.9856 * approximate_time) - 3.289
    true_longitude = mean_anomaly + 1.916 * math.sin(math.radians(mean_anomaly))
    true_longitude += 0.020 * math.sin(math.radians(2 * mean_anomaly)) + 282.634
    true_longitude = _normalize_degrees(true_longitude)
    right_ascension = math.degrees(math.atan(0.91764 * math.tan(math.radians(true_longitude))))
    right_ascension = _normalize_degrees(right_ascension)
    longitude_quadrant = math.floor(true_longitude / 90.0) * 90.0
    ascension_quadrant = math.floor(right_ascension / 90.0) * 90.0
    right_ascension = (right_ascension + longitude_quadrant - ascension_quadrant) / 15.0
    sin_declination = 0.39782 * math.sin(math.radians(true_longitude))
    cos_declination = math.cos(math.asin(sin_declination))
    cos_hour_angle = (
        math.cos(math.radians(zenith))
        - (sin_declination * math.sin(math.radians(latitude)))
    ) / (cos_declination * math.cos(math.radians(latitude)))
    if cos_hour_angle < -1 or cos_hour_angle > 1:
        raise ValueError("No sunset occurs at this location on the requested date")
    hour_angle = math.degrees(math.acos(cos_hour_angle)) / 15.0
    local_mean_time = hour_angle + right_ascension - (0.06571 * approximate_time) - 6.622
    utc_hours = (local_mean_time - lng_hour) % 24.0
    utc_midnight = datetime.combine(day, time.min, tzinfo=timezone.utc)
    sunset_utc = utc_midnight + timedelta(hours=utc_hours)
    return sunset_utc.astimezone(ZoneInfo(timezone_name))


def solar_position(moment: datetime, latitude: float, longitude: float) -> tuple[float, float]:
    """Approximate solar elevation and azimuth in degrees."""
    utc = moment.astimezone(timezone.utc)
    day = utc.timetuple().tm_yday
    fractional_hour = utc.hour + utc.minute / 60 + utc.second / 3600
    gamma = 2 * math.pi / 365 * (day - 1 + (fractional_hour - 12) / 24)
    equation_time = 229.18 * (
        0.000075 + 0.001868 * math.cos(gamma) - 0.032077 * math.sin(gamma)
        - 0.014615 * math.cos(2 * gamma) - 0.040849 * math.sin(2 * gamma)
    )
    declination = (
        0.006918 - 0.399912 * math.cos(gamma) + 0.070257 * math.sin(gamma)
        - 0.006758 * math.cos(2 * gamma) + 0.000907 * math.sin(2 * gamma)
        - 0.002697 * math.cos(3 * gamma) + 0.00148 * math.sin(3 * gamma)
    )
    true_solar_minutes = (fractional_hour * 60 + equation_time + 4 * longitude) % 1440
    hour_angle = math.radians(true_solar_minutes / 4 - 180)
    lat = math.radians(latitude)
    cos_zenith = math.sin(lat) * math.sin(declination) + math.cos(lat) * math.cos(declination) * math.cos(hour_angle)
    zenith = math.acos(max(-1.0, min(1.0, cos_zenith)))
    elevation = 90 - math.degrees(zenith)
    azimuth = math.degrees(math.atan2(math.sin(hour_angle), math.cos(hour_angle) * math.sin(lat) - math.tan(declination) * math.cos(lat))) + 180
    return elevation, _normalize_degrees(azimuth)

