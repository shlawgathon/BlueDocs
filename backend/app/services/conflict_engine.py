"""ConflictEngine — spatial conflict detection using Shapely."""

from __future__ import annotations

import math
from typing import Any

from shapely.geometry import Point

from app.models import Conflict
from app.services.geodata import CachedLayer


# Approximate degrees per km at mid-latitudes
_DEG_PER_KM_LAT = 1.0 / 111.0
_DEG_PER_KM_LON_AT_40 = 1.0 / 85.0  # cos(40°) ≈ 0.766


def _km_to_deg(km: float) -> float:
    """Rough conversion for buffer calculations."""
    return km * _DEG_PER_KM_LAT


def _deg_distance_to_km(deg: float, lat: float) -> float:
    """Convert degree distance to approximate km at given latitude."""
    return deg * 111.0  # Simplified — good enough for scoring


class ConflictEngine:
    """Runs spatial conflict checks against cached layers."""

    def check_conflicts(
        self,
        lat: float,
        lon: float,
        radius_km: float,
        layers: dict[str, CachedLayer],
    ) -> list[Conflict]:
        """Check for overlaps and buffer violations across all layers."""
        # Create project circle as a Shapely polygon
        center = Point(lon, lat)
        radius_deg = _km_to_deg(radius_km)
        project_circle = center.buffer(radius_deg)

        conflicts: list[Conflict] = []

        for layer in layers.values():
            layer_conflicts = self._check_layer(
                project_circle, center, radius_km, layer
            )
            conflicts.extend(layer_conflicts)

        # Sort: critical first, then warning, then info
        severity_order = {"critical": 0, "warning": 1, "info": 2}
        conflicts.sort(key=lambda c: severity_order.get(c.severity, 3))
        return conflicts

    def _check_layer(
        self,
        project_circle: Any,
        center: Point,
        radius_km: float,
        layer: CachedLayer,
    ) -> list[Conflict]:
        """Check a single layer for conflicts."""
        conflicts: list[Conflict] = []
        buffer_deg = _km_to_deg(layer.buffer_km)
        buffered_circle = center.buffer(_km_to_deg(radius_km) + buffer_deg)

        for geom, props in layer.geometries:
            try:
                # Direct overlap check
                if project_circle.intersects(geom):
                    intersection = project_circle.intersection(geom)
                    area_km2 = self._area_deg2_to_km2(intersection.area, center.y)

                    feature_name = self._get_feature_name(props, layer.name)
                    severity = "critical" if layer.id == "marine-protected-areas" else "warning"

                    conflicts.append(
                        Conflict(
                            layer_id=layer.id,
                            layer_name=layer.name,
                            type="overlap",
                            severity=severity,
                            detail=f"Overlaps with {feature_name}",
                            overlap_area_km2=round(area_km2, 1),
                        )
                    )

                # Buffer / proximity check (only if not already overlapping)
                elif buffered_circle.intersects(geom):
                    dist_deg = project_circle.distance(geom)
                    dist_km = _deg_distance_to_km(dist_deg, center.y)

                    feature_name = self._get_feature_name(props, layer.name)

                    conflicts.append(
                        Conflict(
                            layer_id=layer.id,
                            layer_name=layer.name,
                            type="buffer",
                            severity="warning",
                            detail=f"Within {dist_km:.1f}km of {feature_name}",
                            distance_km=round(dist_km, 1),
                        )
                    )
            except Exception:
                continue

        return conflicts

    @staticmethod
    def _get_feature_name(props: dict, fallback: str) -> str:
        """Extract a human-readable name from feature properties."""
        for key in ("Site_Name", "LEASE_NUMB", "NAME", "name", "OBJECTID"):
            if key in props and props[key]:
                return str(props[key])
        return fallback

    @staticmethod
    def _area_deg2_to_km2(area_deg2: float, lat: float) -> float:
        """Convert area in square degrees to approximate km²."""
        km_per_deg_lat = 111.0
        km_per_deg_lon = 111.0 * math.cos(math.radians(lat))
        return area_deg2 * km_per_deg_lat * km_per_deg_lon
