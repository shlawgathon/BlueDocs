"use client";

interface HeaderProps {
  onNewProject: () => void;
  onEditProject: () => void;
  onRemoveProject: () => void;
  onMapStyleChange: (style: "dark" | "light" | "satellite") => void;
  placementMode: boolean;
  hasProject: boolean;
  mapStyle: "dark" | "light" | "satellite";
}

export function Header({
  onNewProject,
  onEditProject,
  onRemoveProject,
  onMapStyleChange,
  placementMode,
  hasProject,
  mapStyle,
}: HeaderProps) {
  return (
    <header className="absolute top-0 right-0 left-0 z-20 flex h-[60px] items-center justify-between border-b border-white/10 bg-[#0A1628]/70 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        {/* Logo icon */}
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#14B8A6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        <span className="text-lg font-bold text-[#14B8A6]">BlueRegistry</span>
        <span className="hidden text-sm font-light text-slate-500 sm:inline">
          Spatial Intelligence for the Blue Economy
        </span>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={mapStyle}
          onChange={(e) =>
            onMapStyleChange(e.target.value as "dark" | "light" | "satellite")
          }
          className="hidden rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-xs font-medium text-slate-200 outline-none transition-colors focus:border-[#14B8A6] md:block"
          aria-label="Map style"
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="satellite">Satellite</option>
        </select>

        {hasProject && (
          <>
            <button
              onClick={onEditProject}
              className="hidden rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.08] md:block"
            >
              Edit
            </button>
            <button
              onClick={onRemoveProject}
              className="hidden rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20 md:block"
            >
              Remove
            </button>
          </>
        )}

        <button
          onClick={onNewProject}
          disabled={placementMode}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-300 ${
            placementMode
              ? "cursor-not-allowed bg-[#14B8A6]/20 text-[#14B8A6]/50"
              : "bg-[#14B8A6] text-[#0A1628] shadow-[0_0_15px_rgba(20,184,166,0.3)] hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(20,184,166,0.5)]"
          }`}
        >
          {/* Pin icon */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          New Project
        </button>
      </div>
    </header>
  );
}
