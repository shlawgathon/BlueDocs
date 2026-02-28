"""Analysis routes — POST /api/conflict-check."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.models import (
    ConflictCheckRequest,
    ConflictCheckResponse,
    ProjectCircle,
)
from app.services.conflict_engine import ConflictEngine
from app.services.recommender import find_recommendation
from app.services.scorer import compute_risk_score

router = APIRouter(prefix="/api", tags=["analysis"])

_engine = ConflictEngine()


@router.post("/conflict-check", response_model=ConflictCheckResponse)
async def conflict_check(
    body: ConflictCheckRequest,
    request: Request,
) -> ConflictCheckResponse:
    """Run full conflict analysis pipeline."""
    geodata = request.app.state.geodata

    # 1. Detect conflicts
    conflicts = _engine.check_conflicts(
        lat=body.latitude,
        lon=body.longitude,
        radius_km=body.radius_km,
        layers=geodata.layers,
    )

    # 2. Score
    risk_score, risk_level = compute_risk_score(conflicts)

    # 3. Recommend
    recommendation = find_recommendation(
        lat=body.latitude,
        lon=body.longitude,
        radius_km=body.radius_km,
        original_score=risk_score,
        layers=geodata.layers,
        engine=_engine,
    )

    return ConflictCheckResponse(
        risk_score=risk_score,
        risk_level=risk_level,
        conflicts=conflicts,
        recommendation=recommendation,
        project_circle=ProjectCircle(
            center=[body.latitude, body.longitude],
            radius_km=body.radius_km,
        ),
    )
