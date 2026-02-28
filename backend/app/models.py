"""Pydantic models matching the BlueRegistry API contract."""

from __future__ import annotations

from pydantic import BaseModel, Field


# ── Request models ──────────────────────────────────────────────


class ConflictCheckRequest(BaseModel):
    project_type: str = Field(
        ...,
        description="offshore_wind | aquaculture | oae | cable",
    )
    latitude: float
    longitude: float
    radius_km: float = Field(ge=1, le=200)
    name: str | None = None


# ── Response models ─────────────────────────────────────────────


class Conflict(BaseModel):
    layer_id: str
    layer_name: str
    type: str  # overlap | buffer | proximity
    severity: str  # critical | warning | info
    detail: str
    overlap_area_km2: float | None = None
    distance_km: float | None = None


class Recommendation(BaseModel):
    action: str  # relocate | none
    suggested_lat: float | None = None
    suggested_lon: float | None = None
    new_risk_score: float | None = None
    reasoning: str


class ProjectCircle(BaseModel):
    center: list[float]  # [lat, lon]
    radius_km: float


class ConflictCheckResponse(BaseModel):
    risk_score: float
    risk_level: str  # low | medium | high | critical
    conflicts: list[Conflict]
    recommendation: Recommendation
    project_circle: ProjectCircle


# ── Layer models (for GET /api/layers) ──────────────────────────


class Layer(BaseModel):
    id: str
    name: str
    type: str  # polygon | line | point
    color: str  # hex color
    visible: bool = True
    geojson: dict  # raw GeoJSON FeatureCollection


class LayersResponse(BaseModel):
    layers: list[Layer]
