/**
 * TypeScript interfaces matching the BlueRegistry API contract.
 */

export interface Layer {
  id: string;
  name: string;
  type: "polygon" | "line" | "point";
  color: string;
  visible: boolean;
  source_name?: string | null;
  source_url?: string | null;
  geojson: GeoJSON.FeatureCollection;
}

export interface LayersResponse {
  layers: Layer[];
}

export interface ConflictCheckRequest {
  project_type: string;
  latitude: number;
  longitude: number;
  radius_km: number;
  name?: string;
}

export interface Conflict {
  layer_id: string;
  layer_name: string;
  type: "overlap" | "buffer" | "proximity";
  severity: "critical" | "warning" | "info";
  detail: string;
  overlap_area_km2?: number;
  distance_km?: number;
}

export interface Recommendation {
  action: "relocate" | "none";
  suggested_lat?: number;
  suggested_lon?: number;
  new_risk_score?: number;
  reasoning: string;
}

export interface ProjectCircle {
  center: [number, number];
  radius_km: number;
}

export interface ConflictCheckResponse {
  risk_score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  conflicts: Conflict[];
  recommendation: Recommendation;
  project_circle: ProjectCircle;
}
