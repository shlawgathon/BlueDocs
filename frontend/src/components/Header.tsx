"use client";

interface HeaderProps {
  onNewProject: () => void;
  onMapStyleChange: (style: "dark" | "light" | "satellite") => void;
  placementMode: boolean;
  mapStyle: "dark" | "light" | "satellite";
}

export function Header({
  onNewProject,
  onMapStyleChange,
  placementMode,
  mapStyle,
}: HeaderProps) {
  return (
    <header className="absolute top-0 right-0 left-0 z-20 flex h-[60px] items-center justify-between border-b border-white/10 bg-[#0A1628]/70 px-3 backdrop-blur-xl sm:px-6">
      <div className="min-w-0 flex items-center gap-2 sm:gap-3">
        {/* Logo icon */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#14B8A6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 sm:h-7 sm:w-7"
        >
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        <span className="truncate text-base font-bold text-[#14B8A6] sm:hidden">
          BlueReg
        </span>
        <span className="hidden truncate text-lg font-bold text-[#14B8A6] sm:inline">
          BlueRegistry
        </span>
        <span className="hidden text-sm font-light text-slate-500 sm:inline">
          Spatial Intelligence for the Blue Economy
        </span>
      </div>

      <div className="ml-2 flex shrink-0 items-center gap-1.5 sm:gap-2">
        <select
          value={mapStyle}
          onChange={(e) =>
            onMapStyleChange(e.target.value as "dark" | "light" | "satellite")
          }
          className="max-w-[108px] rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] font-medium text-slate-200 outline-none transition-colors focus:border-[#14B8A6] sm:max-w-none sm:px-2.5 sm:py-2 sm:text-xs"
          aria-label="Map style"
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="satellite">Satellite</option>
        </select>

        <button
          onClick={onNewProject}
          disabled={placementMode}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-300 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm ${
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
          <span className="sm:hidden">New</span>
          <span className="hidden sm:inline">New Project</span>
        </button>
      </div>
    </header>
  );
}
