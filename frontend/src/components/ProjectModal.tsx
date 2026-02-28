"use client";

import { useState } from "react";

interface ProjectModalProps {
  lat: number;
  lng: number;
  onAnalyze: (projectType: string, radiusKm: number, name: string) => void;
  onClose: () => void;
}

const PROJECT_TYPES = [
  { value: "offshore_wind", label: "Offshore Wind" },
  { value: "aquaculture", label: "Aquaculture" },
  { value: "oae", label: "OAE Site" },
  { value: "cable", label: "Subsea Cable" },
];

export function ProjectModal({ lat, lng, onAnalyze, onClose }: ProjectModalProps) {
  const [projectType, setProjectType] = useState("offshore_wind");
  const [radiusKm, setRadiusKm] = useState(25);
  const [name, setName] = useState("");

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-30 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute top-1/2 left-1/2 z-40 w-[340px] -translate-x-1/2 -translate-y-1/2 animate-scale-in rounded-xl border border-white/10 bg-[#0A1628]/90 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Project Configuration</h2>
          <button
            onClick={onClose}
            className="text-slate-500 transition-colors hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Coordinates */}
        <p className="mb-5 text-xs text-slate-500">
          {lat.toFixed(4)}°N, {Math.abs(lng).toFixed(4)}°W
        </p>

        {/* Project Type */}
        <div className="mb-4">
          <label className="mb-2 block text-xs font-medium text-slate-400">
            Project Type
          </label>
          <select
            value={projectType}
            onChange={(e) => setProjectType(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-[#14B8A6]"
          >
            {PROJECT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Radius */}
        <div className="mb-4">
          <label className="mb-2 flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Radius</span>
            <span className="text-[#14B8A6]">{radiusKm} km</span>
          </label>
          <input
            type="range"
            min={5}
            max={100}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="slider w-full"
          />
        </div>

        {/* Name */}
        <div className="mb-6">
          <label className="mb-2 block text-xs font-medium text-slate-400">
            Project Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Wind Farm"
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-[#14B8A6]"
          />
        </div>

        {/* Analyze button */}
        <button
          onClick={() => onAnalyze(projectType, radiusKm, name)}
          className="w-full rounded-lg bg-[#14B8A6] py-3 text-sm font-semibold text-[#0A1628] shadow-[0_0_15px_rgba(20,184,166,0.3)] transition-all hover:shadow-[0_0_25px_rgba(20,184,166,0.5)]"
        >
          Analyze Conflicts
        </button>
      </div>
    </>
  );
}
