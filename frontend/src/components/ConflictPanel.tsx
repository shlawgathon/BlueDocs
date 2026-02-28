"use client";

import type { ConflictCheckResponse } from "@/lib/types";

interface ConflictPanelProps {
  result: ConflictCheckResponse;
  projectName?: string;
  analyzing: boolean;
  onClose: () => void;
  onApplySuggestion: () => void;
  onConflictHover: (layerId: string | null) => void;
}

/** SVG icons per severity — no emojis. */
function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "critical") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    );
  }
  if (severity === "warning") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  // info / success
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function riskColor(level: string): string {
  switch (level) {
    case "critical": return "#EF4444";
    case "high": return "#F59E0B";
    case "medium": return "#FBBF24";
    case "low": return "#10B981";
    default: return "#94A3B8";
  }
}

function riskGradient(score: number): string {
  if (score >= 75) return "linear-gradient(90deg, #10B981, #F59E0B, #EF4444)";
  if (score >= 50) return "linear-gradient(90deg, #10B981, #F59E0B)";
  if (score >= 25) return "linear-gradient(90deg, #10B981, #FBBF24)";
  return "#10B981";
}

export function ConflictPanel({
  result,
  projectName,
  analyzing,
  onClose,
  onApplySuggestion,
  onConflictHover,
}: ConflictPanelProps) {
  const color = riskColor(result.risk_level);

  return (
    <div className="absolute top-[80px] right-6 bottom-6 z-20 w-[380px] animate-slide-in-right overflow-y-auto rounded-xl border border-white/10 bg-[#0A1628]/80 p-6 shadow-[-10px_0_40px_rgba(0,0,0,0.4)] backdrop-blur-xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between border-b border-white/5 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Conflict Analysis</h2>
          {projectName && (
            <p className="mt-1 text-sm font-medium text-slate-300">{projectName}</p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            {result.project_circle.center[0].toFixed(2)}°N,{" "}
            {Math.abs(result.project_circle.center[1]).toFixed(2)}°W ·{" "}
            {result.project_circle.radius_km}km radius
          </p>
        </div>
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

      {/* Risk Score */}
      <div className="mb-6 rounded-lg bg-black/30 p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
          <span>RISK SCORE</span>
          <span className="font-mono font-semibold" style={{ color }}>
            {result.risk_score}/100
          </span>
        </div>
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${result.risk_score}%`,
              background: riskGradient(result.risk_score),
            }}
          />
        </div>
        <span
          className="inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase"
          style={{
            color,
            backgroundColor: `${color}20`,
          }}
        >
          {result.risk_level} risk
        </span>
      </div>

      {/* Conflicts */}
      <div className="space-y-3">
        {result.conflicts.length === 0 && (
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 text-center">
            <SeverityIcon severity="info" />
            <p className="mt-2 text-sm text-slate-400">No conflicts detected</p>
          </div>
        )}
        {result.conflicts.map((conflict, i) => (
          <div
            key={i}
            className="flex cursor-default gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.06]"
            onMouseEnter={() => onConflictHover(conflict.layer_id)}
            onMouseLeave={() => onConflictHover(null)}
          >
            <div className="mt-0.5 shrink-0">
              <SeverityIcon severity={conflict.severity} />
            </div>
            <div>
              <p
                className="text-sm font-semibold"
                style={{
                  color:
                    conflict.severity === "critical"
                      ? "#EF4444"
                      : conflict.severity === "warning"
                        ? "#F59E0B"
                        : "#10B981",
                }}
              >
                {conflict.detail.split("with ").pop() ||
                  conflict.layer_name}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {conflict.type === "overlap" && conflict.overlap_area_km2
                  ? `${conflict.layer_name} overlap (${conflict.overlap_area_km2} km²)`
                  : conflict.type === "buffer" && conflict.distance_km
                    ? `Within ${conflict.distance_km}km (buffer zone)`
                    : conflict.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Recommendation */}
      {result.recommendation.action === "relocate" && (
        <div className="mt-6 rounded-lg border border-[#14B8A6]/30 bg-gradient-to-br from-[#14B8A6]/10 to-transparent p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#14B8A6]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            AI RECOMMENDATION
          </div>
          <p className="mb-4 text-[13px] leading-relaxed text-slate-300">
            {result.recommendation.reasoning}
            {result.recommendation.new_risk_score != null && (
              <span className="ml-1 font-semibold text-[#10B981]">
                New score: {result.recommendation.new_risk_score}/100
              </span>
            )}
          </p>
          <button
            onClick={onApplySuggestion}
            disabled={analyzing}
            className="w-full rounded-lg border border-[#14B8A6] bg-transparent py-2.5 text-sm font-semibold text-[#14B8A6] transition-all hover:bg-[#14B8A6]/10 disabled:opacity-50"
          >
            {analyzing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#14B8A6] border-t-transparent" />
                Re-analyzing...
              </span>
            ) : (
              "Apply Suggestion"
            )}
          </button>
        </div>
      )}

      {result.recommendation.action === "none" && (
        <div className="mt-6 rounded-lg border border-white/5 bg-white/[0.02] p-4 text-center">
          <p className="text-xs text-slate-500">
            {result.recommendation.reasoning}
          </p>
        </div>
      )}
    </div>
  );
}
