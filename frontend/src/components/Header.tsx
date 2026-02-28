"use client";

import { useState, useRef, useEffect } from "react";

interface HeaderProps {
  onNewProject: () => void;
  onMapStyleChange: (style: "dark" | "light" | "satellite") => void;
  onOpenAccount: () => void;
  onLogout: () => void;
  onSimulateApiChange?: () => void;
  placementMode: boolean;
  mapStyle: "dark" | "light" | "satellite";
  accountEmail: string | null;
  authChecking: boolean;
}

export function Header({
  onNewProject,
  onMapStyleChange,
  onOpenAccount,
  onLogout,
  onSimulateApiChange,
  placementMode,
  mapStyle,
  accountEmail,
  authChecking,
}: HeaderProps) {
  const [notifyOpen, setNotifyOpen] = useState(false);
  const notifyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifyRef.current && !notifyRef.current.contains(e.target as Node)) {
        setNotifyOpen(false);
      }
    }
    if (notifyOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifyOpen]);

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
          BlueDocs
        </span>
        <span className="hidden truncate text-lg font-bold text-[#14B8A6] sm:inline">
          BlueDocs
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

        {/* Simulate API Change dropdown */}
        {accountEmail && onSimulateApiChange && (
          <div ref={notifyRef} className="relative">
            <button
              type="button"
              onClick={() => setNotifyOpen((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-black/50 sm:px-2.5 sm:py-2 sm:text-xs"
              aria-label="Notifications"
              title="Simulate API change"
            >
              {/* Bell icon */}
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              <span className="hidden sm:inline">Notify</span>
            </button>

            {notifyOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 rounded-lg border border-white/10 bg-[#0A1628]/95 p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Notifications
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onSimulateApiChange();
                    setNotifyOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs text-slate-200 transition-colors hover:bg-white/5"
                >
                  {/* Zap icon */}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                  <div>
                    <p className="font-medium">Simulate API Change</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Send analysis email to {accountEmail.split("@")[0]}
                    </p>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

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

        {accountEmail ? (
          <>
            <span className="hidden max-w-[180px] truncate rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-xs font-medium text-slate-200 sm:inline">
              {accountEmail}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-white/15 bg-black/30 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition-colors hover:bg-black/50 sm:px-3 sm:py-2 sm:text-xs"
            >
              Logout
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onOpenAccount}
            className="rounded-lg border border-[#14B8A6]/40 bg-[#14B8A6]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#14B8A6] transition-colors hover:bg-[#14B8A6]/20 sm:px-3 sm:py-2 sm:text-xs"
          >
            {authChecking ? "Checking..." : "Account"}
          </button>
        )}
      </div>
    </header>
  );
}
