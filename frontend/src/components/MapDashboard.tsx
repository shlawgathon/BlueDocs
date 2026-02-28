"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import Map, {
  Source,
  Layer,
  MapRef,
  MapMouseEvent,
  Popup,
} from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

import type {
  Layer as LayerData,
  ConflictCheckResponse,
} from "@/lib/types";
import { fetchLayers, checkConflicts } from "@/lib/api";
import { Header } from "@/components/Header";
import { LayerPanel } from "@/components/LayerPanel";
import { ProjectModal } from "@/components/ProjectModal";
import { ConflictPanel } from "@/components/ConflictPanel";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

export default function MapDashboard() {
  const mapRef = useRef<MapRef>(null);

  // Data
  const [layers, setLayers] = useState<LayerData[]>([]);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interaction state
  const [placementMode, setPlacementMode] = useState(false);
  const [pinLocation, setPinLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ConflictCheckResponse | null>(null);
  const [showConflictPanel, setShowConflictPanel] = useState(false);
  const [hoveredConflictLayer, setHoveredConflictLayer] = useState<string | null>(null);

  // Popup
  const [popup, setPopup] = useState<{
    lng: number;
    lat: number;
    text: string;
  } | null>(null);

  // Fetch layers on mount
  useEffect(() => {
    fetchLayers()
      .then((data) => {
        setLayers(data.layers);
        const vis: Record<string, boolean> = {};
        data.layers.forEach((l) => (vis[l.id] = l.visible));
        setLayerVisibility(vis);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Toggle layer
  const toggleLayer = useCallback((layerId: string) => {
    setLayerVisibility((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  }, []);

  // Enter placement mode
  const startPlacement = useCallback(() => {
    setPlacementMode(true);
    setShowConflictPanel(false);
    setAnalysisResult(null);
    setPinLocation(null);
  }, []);

  // Map click
  const onMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (!placementMode) {
        // Check if clicking a feature for popup
        const features = mapRef.current?.queryRenderedFeatures(e.point);
        if (features && features.length > 0) {
          const f = features[0];
          const name =
            f.properties?.Site_Name ||
            f.properties?.LEASE_NUMB ||
            f.properties?.NAME ||
            f.properties?.name ||
            f.layer?.id ||
            "Selected feature";
          setPopup({ lng: e.lngLat.lng, lat: e.lngLat.lat, text: String(name) });
        }
        return;
      }
      setPinLocation({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      setShowModal(true);
      setPlacementMode(false);
    },
    [placementMode]
  );

  // Run analysis
  const runAnalysis = useCallback(
    async (projectType: string, radiusKm: number, name: string) => {
      if (!pinLocation) return;
      setAnalyzing(true);
      setShowModal(false);
      try {
        const result = await checkConflicts({
          project_type: projectType,
          latitude: pinLocation.lat,
          longitude: pinLocation.lng,
          radius_km: radiusKm,
          name: name || undefined,
        });
        setAnalysisResult(result);
        setShowConflictPanel(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Analysis failed");
      } finally {
        setAnalyzing(false);
      }
    },
    [pinLocation]
  );

  // Apply suggestion
  const applySuggestion = useCallback(async () => {
    if (!analysisResult?.recommendation.suggested_lat) return;
    const rec = analysisResult.recommendation;
    const newLat = rec.suggested_lat!;
    const newLon = rec.suggested_lon!;

    // Fly to new location
    mapRef.current?.flyTo({
      center: [newLon, newLat],
      zoom: 8,
      duration: 2000,
    });

    setPinLocation({ lat: newLat, lng: newLon });

    // Re-analyze at new location
    setAnalyzing(true);
    try {
      const result = await checkConflicts({
        project_type: "offshore_wind",
        latitude: newLat,
        longitude: newLon,
        radius_km: analysisResult.project_circle.radius_km,
      });
      setAnalysisResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Re-analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, [analysisResult]);

  // Create circle GeoJSON from pin
  const circleGeoJSON = pinLocation
    ? createCircleGeoJSON(
        pinLocation.lng,
        pinLocation.lat,
        analysisResult?.project_circle.radius_km ?? 25
      )
    : null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0A1628]">
      <Header
        onNewProject={startPlacement}
        placementMode={placementMode}
      />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0A1628]">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-[#14B8A6] border-t-transparent" />
            <p className="text-sm text-slate-400">Loading ocean data layers...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute top-20 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400 backdrop-blur-md">
          {error}
          <button onClick={() => setError(null)} className="ml-3 text-red-300 hover:text-white">&times;</button>
        </div>
      )}

      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: -71,
          latitude: 41,
          zoom: 6,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        cursor={placementMode ? "crosshair" : "grab"}
        onClick={onMapClick}
        interactiveLayerIds={layers
          .filter((l) => layerVisibility[l.id])
          .map((l) => `${l.id}-layer`)}
      >
        {/* Render all GeoJSON layers */}
        {layers.map((layer) => {
          if (!layerVisibility[layer.id]) return null;
          const isHighlighted = hoveredConflictLayer === layer.id;
          return (
            <Source
              key={layer.id}
              id={layer.id}
              type="geojson"
              data={layer.geojson}
            >
              {layer.type === "polygon" && (
                <Layer
                  id={`${layer.id}-layer`}
                  type="fill"
                  paint={{
                    "fill-color": layer.color,
                    "fill-opacity": isHighlighted ? 0.5 : 0.2,
                  }}
                />
              )}
              {layer.type === "polygon" && (
                <Layer
                  id={`${layer.id}-border`}
                  type="line"
                  paint={{
                    "line-color": layer.color,
                    "line-width": isHighlighted ? 3 : 1.5,
                    "line-opacity": isHighlighted ? 1 : 0.7,
                  }}
                />
              )}
              {layer.type === "line" && (
                <Layer
                  id={`${layer.id}-layer`}
                  type="line"
                  paint={{
                    "line-color": layer.color,
                    "line-width": isHighlighted ? 4 : 2,
                    "line-opacity": isHighlighted ? 1 : 0.7,
                    "line-dasharray": [2, 2],
                  }}
                />
              )}
            </Source>
          );
        })}

        {/* Project circle */}
        {circleGeoJSON && (
          <Source id="project-circle" type="geojson" data={circleGeoJSON}>
            <Layer
              id="project-circle-fill"
              type="fill"
              paint={{
                "fill-color": "#3B82F6",
                "fill-opacity": analyzing ? 0.35 : 0.15,
              }}
            />
            <Layer
              id="project-circle-border"
              type="line"
              paint={{
                "line-color": analyzing ? "#14B8A6" : "#3B82F6",
                "line-width": 2,
              }}
            />
          </Source>
        )}

        {/* Pin marker */}
        {pinLocation && (
          <Source
            id="pin-marker"
            type="geojson"
            data={{
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "Point",
                    coordinates: [pinLocation.lng, pinLocation.lat],
                  },
                },
              ],
            }}
          >
            <Layer
              id="pin-marker-layer"
              type="circle"
              paint={{
                "circle-radius": 8,
                "circle-color": "#14B8A6",
                "circle-stroke-width": 3,
                "circle-stroke-color": "#ffffff",
              }}
            />
          </Source>
        )}

        {popup && (
          <Popup
            longitude={popup.lng}
            latitude={popup.lat}
            closeOnClick
            onClose={() => setPopup(null)}
            className="map-popup"
          >
            <p className="text-sm font-medium text-slate-800">{popup.text}</p>
          </Popup>
        )}
      </Map>

      {/* Layer Panel */}
      <LayerPanel
        layers={layers}
        visibility={layerVisibility}
        onToggle={toggleLayer}
      />

      {/* Project Setup Modal */}
      {showModal && pinLocation && (
        <ProjectModal
          lat={pinLocation.lat}
          lng={pinLocation.lng}
          onAnalyze={runAnalysis}
          onClose={() => {
            setShowModal(false);
            setPinLocation(null);
          }}
        />
      )}

      {/* Conflict Panel */}
      {showConflictPanel && analysisResult && (
        <ConflictPanel
          result={analysisResult}
          analyzing={analyzing}
          onClose={() => {
            setShowConflictPanel(false);
            setAnalysisResult(null);
            setPinLocation(null);
          }}
          onApplySuggestion={applySuggestion}
          onConflictHover={setHoveredConflictLayer}
        />
      )}

      {/* Placement mode toast */}
      {placementMode && (
        <div className="absolute bottom-10 left-1/2 z-30 -translate-x-1/2 animate-fade-in-up rounded-full border border-white/10 bg-black/80 px-6 py-3 text-sm text-slate-300 backdrop-blur-md">
          Click anywhere on the map to propose a project
        </div>
      )}

      {/* Analyzing overlay */}
      {analyzing && !showModal && (
        <div className="absolute bottom-10 left-1/2 z-30 -translate-x-1/2 flex items-center gap-3 rounded-full border border-[#14B8A6]/30 bg-black/80 px-6 py-3 text-sm text-[#14B8A6] backdrop-blur-md">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#14B8A6] border-t-transparent" />
          Analyzing conflicts...
        </div>
      )}
    </div>
  );
}

/**
 * Generate a GeoJSON polygon approximating a circle.
 */
function createCircleGeoJSON(
  lng: number,
  lat: number,
  radiusKm: number,
  steps = 64
): GeoJSON.FeatureCollection {
  const coords: [number, number][] = [];
  const distRadians = radiusKm / 6371; // Earth radius in km

  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = distRadians * Math.cos(angle);
    const dLng =
      distRadians * Math.sin(angle) / Math.cos((lat * Math.PI) / 180);
    coords.push([lng + (dLng * 180) / Math.PI, lat + (dLat * 180) / Math.PI]);
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [coords] },
      },
    ],
  };
}
