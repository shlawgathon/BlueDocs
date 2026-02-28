"use client";

import { useState } from "react";
import type { Layer } from "@/lib/types";
import { getLayerSourceMeta } from "@/lib/layerSources";

interface LayerPanelProps {
  layers: Layer[];
  visibility: Record<string, boolean>;
  onToggle: (layerId: string) => void;
}

export function LayerPanel({ layers, visibility, onToggle }: LayerPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute top-[80px] left-6 z-20 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[#0A1628]/70 backdrop-blur-xl transition-all hover:border-white/20"
        title="Show layers"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      </button>
    );
  }

  return (
    <div className="absolute top-[80px] left-6 z-20 w-[260px] animate-slide-in-left rounded-xl border border-white/10 bg-[#0A1628]/70 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">Layers</span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="text-slate-500 transition-colors hover:text-slate-300"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Layer list */}
      <div className="space-y-3">
        {layers.map((layer) => (
          <div key={layer.id} className="flex items-center justify-between">
            {(() => {
              const sourceMeta = getLayerSourceMeta(layer);
              return (
                <>
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: layer.color }}
                      />
                      <span className="truncate text-sm text-slate-300">{layer.name}</span>
                    </div>
                    {sourceMeta && (
                      <a
                        href={sourceMeta.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-5 block pt-0.5 text-[11px] text-cyan-300 transition-colors hover:text-cyan-200 hover:underline"
                      >
                        Source: {sourceMeta.source_name}
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => onToggle(layer.id)}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-300 ${
                      visibility[layer.id] ? "bg-[#14B8A6]" : "bg-white/10"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-300 ${
                        visibility[layer.id] ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </>
              );
            })()}
          </div>
        ))}
      </div>

      {/* Feature count */}
      <div className="mt-4 border-t border-white/5 pt-3">
        <p className="text-[11px] text-slate-500">
          {layers.filter((l) => visibility[l.id]).length} of {layers.length} layers visible
        </p>
      </div>
    </div>
  );
}
