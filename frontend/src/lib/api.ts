/**
 * API client for BlueRegistry backend.
 */

import type {
  LayersResponse,
  ConflictCheckRequest,
  ConflictCheckResponse,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchLayers(): Promise<LayersResponse> {
  const res = await fetch(`${API_URL}/api/layers`);
  if (!res.ok) throw new Error(`Failed to fetch layers: ${res.statusText}`);
  return res.json();
}

export async function checkConflicts(
  params: ConflictCheckRequest
): Promise<ConflictCheckResponse> {
  const res = await fetch(`${API_URL}/api/conflict-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok)
    throw new Error(`Failed to check conflicts: ${res.statusText}`);
  return res.json();
}
