"""Recommendation engine — grid-search for lower-risk positions."""

from __future__ import annotations

import math

from app.models import Recommendation
from app.services.conflict_engine import ConflictEngine
from app.services.geodata import CachedLayer
from app.services.scorer import compute_risk_score


# 8 compass directions (bearing in degrees)
_DIRECTIONS = [0, 45, 90, 135, 180, 225, 270, 315]
_DISTANCES_KM = [10, 20, 30]


def _offset_point(lat: float, lon: float, bearing_deg: float, dist_km: float) -> tuple[float, float]:
    """Move a point by distance (km) in a compass direction."""
    bearing = math.radians(bearing_deg)
    d_lat = dist_km / 111.0 * math.cos(bearing)
    d_lon = dist_km / (111.0 * math.cos(math.radians(lat))) * math.sin(bearing)
    return round(lat + d_lat, 4), round(lon + d_lon, 4)


def find_recommendation(
    lat: float,
    lon: float,
    radius_km: float,
    original_score: float,
    layers: dict[str, CachedLayer],
    engine: ConflictEngine,
) -> Recommendation:
    """Search nearby positions for a lower-risk alternative."""

    if original_score <= 15:
        return Recommendation(
            action="none",
            reasoning="Current location already has low risk.",
        )

    best_score = original_score
    best_lat = lat
    best_lon = lon
    best_reasoning = ""

    for bearing in _DIRECTIONS:
        for dist in _DISTANCES_KM:
            new_lat, new_lon = _offset_point(lat, lon, bearing, dist)

            # Quick ocean bounds check (very rough)
            if new_lat < 24 or new_lat > 50 or new_lon < -82 or new_lon > -60:
                continue

            conflicts = engine.check_conflicts(new_lat, new_lon, radius_km, layers)
            score, _ = compute_risk_score(conflicts)

            if score < best_score:
                best_score = score
                best_lat = new_lat
                best_lon = new_lon

                # Build reasoning
                direction_name = _bearing_to_name(bearing)
                best_reasoning = (
                    f"Moving {dist}km {direction_name} reduces risk from "
                    f"{original_score} to {score}."
                )
                if conflicts:
                    avoided = original_score - score
                    best_reasoning += f" Avoids {avoided:.0f} points of conflict risk."

    if best_score >= original_score:
        return Recommendation(
            action="none",
            reasoning="No significantly lower-risk location found within 30km. Consider a different region.",
        )

    return Recommendation(
        action="relocate",
        suggested_lat=best_lat,
        suggested_lon=best_lon,
        new_risk_score=best_score,
        reasoning=best_reasoning,
    )


def _bearing_to_name(bearing: int) -> str:
    names = {0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SW", 270: "W", 315: "NW"}
    return names.get(bearing, "")
