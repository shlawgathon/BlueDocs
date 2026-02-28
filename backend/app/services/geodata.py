"""GeoDataService — loads bundled GeoJSON data files with real-world coordinates."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from shapely.geometry import shape

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).parent.parent / "data"

# ── Layer definitions ───────────────────────────────────────────

_LAYER_DEFS: list[dict[str, Any]] = [
    {
        "id": "wind-leases",
        "name": "Offshore Wind Leases",
        "type": "polygon",
        "color": "#3B82F6",
        "file": "wind_leases.geojson",
        "buffer_km": 5.0,
        "source_name": "BOEM Renewable Energy GIS Data",
        "source_url": "https://www.boem.gov/renewable-energy/mapping-and-data/renewable-energy-gis-data",
    },
    {
        "id": "marine-protected-areas",
        "name": "Marine Protected Areas",
        "type": "polygon",
        "color": "#10B981",
        "file": "marine_protected_areas.geojson",
        "buffer_km": 5.0,
        "source_name": "NOAA MPA Inventory",
        "source_url": "https://marineprotectedareas.noaa.gov/dataanalysis/mpainventory/",
    },
    {
        "id": "shipping-lanes",
        "name": "Shipping Lanes",
        "type": "polygon",
        "color": "#F59E0B",
        "file": "shipping_lanes.geojson",
        "buffer_km": 10.0,
        "source_name": "MarineCadastre AIS Data",
        "source_url": "https://marinecadastre.gov/ais/",
    },
    {
        "id": "submarine-cables",
        "name": "Submarine Cables",
        "type": "line",
        "color": "#8B5CF6",
        "file": "submarine_cables.geojson",
        "buffer_km": 2.0,
        "source_name": "TeleGeography Submarine Cable Map",
        "source_url": "https://www.submarinecablemap.com/",
    },
]


# ── Cached data store ───────────────────────────────────────────


class CachedLayer:
    """Holds both raw GeoJSON and parsed Shapely geometries for a layer."""

    __slots__ = (
        "id",
        "name",
        "layer_type",
        "color",
        "buffer_km",
        "source_name",
        "source_url",
        "geojson",
        "geometries",
    )

    def __init__(
        self,
        id: str,
        name: str,
        layer_type: str,
        color: str,
        buffer_km: float,
        source_name: str | None,
        source_url: str | None,
        geojson: dict,
    ) -> None:
        self.id = id
        self.name = name
        self.layer_type = layer_type
        self.color = color
        self.buffer_km = buffer_km
        self.source_name = source_name
        self.source_url = source_url
        self.geojson = geojson
        self.geometries: list[tuple[Any, dict]] = []

        # Parse Shapely geometries from features
        for feat in geojson.get("features", []):
            try:
                geom = shape(feat["geometry"])
                if geom.is_valid:
                    self.geometries.append((geom, feat.get("properties", {})))
            except Exception:
                continue


class GeoDataService:
    """Loads all GeoJSON from bundled data files at startup."""

    def __init__(self) -> None:
        self.layers: dict[str, CachedLayer] = {}

    async def load_all(self) -> None:
        """Load all layers from static GeoJSON files."""
        for defn in _LAYER_DEFS:
            self._load_file(defn)

        logger.info(
            "GeoDataService loaded %d layers: %s",
            len(self.layers),
            ", ".join(f"{lid}({len(l.geometries)} features)" for lid, l in self.layers.items()),
        )

    def _load_file(self, defn: dict) -> None:
        layer_id = defn["id"]
        filepath = _DATA_DIR / defn["file"]

        try:
            geojson = json.loads(filepath.read_text())
        except FileNotFoundError:
            logger.warning("%s not found at %s, creating empty layer", layer_id, filepath)
            geojson = {"type": "FeatureCollection", "features": []}

        self.layers[layer_id] = CachedLayer(
            id=layer_id,
            name=defn["name"],
            layer_type=defn["type"],
            color=defn["color"],
            buffer_km=defn["buffer_km"],
            source_name=defn.get("source_name"),
            source_url=defn.get("source_url"),
            geojson=geojson,
        )

    def get_all_layers_json(self) -> list[dict]:
        """Return all layers in the API contract format."""
        return [
            {
                "id": cl.id,
                "name": cl.name,
                "type": cl.layer_type,
                "color": cl.color,
                "visible": True,
                "source_name": cl.source_name,
                "source_url": cl.source_url,
                "geojson": cl.geojson,
            }
            for cl in self.layers.values()
        ]
