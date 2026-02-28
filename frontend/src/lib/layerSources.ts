import type { Layer } from "./types";

export interface LayerSourceMeta {
  source_name: string;
  source_url: string;
}

const SOURCE_FALLBACK_BY_LAYER_ID: Record<string, LayerSourceMeta> = {
  "wind-leases": {
    source_name: "BOEM Renewable Energy GIS Data",
    source_url:
      "https://www.boem.gov/renewable-energy/mapping-and-data/renewable-energy-gis-data",
  },
  "marine-protected-areas": {
    source_name: "NOAA MPA Inventory",
    source_url: "https://marineprotectedareas.noaa.gov/dataanalysis/mpainventory/",
  },
  "shipping-lanes": {
    source_name: "MarineCadastre AIS Data",
    source_url: "https://marinecadastre.gov/ais/",
  },
  "submarine-cables": {
    source_name: "TeleGeography Submarine Cable Map",
    source_url: "https://www.submarinecablemap.com/",
  },
};

export function getLayerSourceMeta(layer: Layer): LayerSourceMeta | null {
  if (layer.source_url) {
    return {
      source_name: layer.source_name ?? layer.name,
      source_url: layer.source_url,
    };
  }
  return SOURCE_FALLBACK_BY_LAYER_ID[layer.id] ?? null;
}

export function getLayerSourceMetaById(layerId: string): LayerSourceMeta | null {
  return SOURCE_FALLBACK_BY_LAYER_ID[layerId] ?? null;
}
