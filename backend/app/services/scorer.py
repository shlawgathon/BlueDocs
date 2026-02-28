"""Rule-based risk scorer for conflict analysis."""

from __future__ import annotations

from app.models import Conflict


# Severity weights
_WEIGHTS = {
    "critical": 35,
    "warning": 15,
    "info": 5,
}

# Layer-specific multipliers
_LAYER_MULTIPLIERS = {
    "marine-protected-areas": 1.5,
    "shipping-lanes": 1.2,
    "submarine-cables": 1.0,
    "wind-leases": 0.8,
}


def compute_risk_score(conflicts: list[Conflict]) -> tuple[float, str]:
    """Compute a 0-100 risk score and level from a list of conflicts.

    Returns (score, level) where level is low | medium | high | critical.
    """
    if not conflicts:
        return 0.0, "low"

    raw = 0.0
    for c in conflicts:
        base = _WEIGHTS.get(c.severity, 5)
        mult = _LAYER_MULTIPLIERS.get(c.layer_id, 1.0)
        raw += base * mult

        # Bonus for overlap area
        if c.overlap_area_km2 and c.overlap_area_km2 > 0:
            raw += min(c.overlap_area_km2 / 50.0, 10.0)

    score = min(max(raw, 0.0), 100.0)

    if score >= 75:
        level = "critical"
    elif score >= 50:
        level = "high"
    elif score >= 25:
        level = "medium"
    else:
        level = "low"

    return round(score, 1), level
