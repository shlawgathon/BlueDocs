"""Layer routes — GET /api/layers."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.models import LayersResponse

router = APIRouter(prefix="/api", tags=["layers"])


@router.get("/layers", response_model=LayersResponse)
async def get_layers(request: Request) -> LayersResponse:
    """Return all cached map layers as GeoJSON."""
    geodata = request.app.state.geodata
    return LayersResponse(layers=geodata.get_all_layers_json())


@router.get("/layer/{layer_id}")
async def get_layer(layer_id: str, request: Request) -> dict:
    """Return a single layer by ID (for lazy loading)."""
    geodata = request.app.state.geodata
    layer = geodata.layers.get(layer_id)
    if not layer:
        return {"error": f"Layer '{layer_id}' not found"}
    return {
        "id": layer.id,
        "name": layer.name,
        "type": layer.layer_type,
        "color": layer.color,
        "visible": True,
        "geojson": layer.geojson,
    }
