"use client";

import dynamic from "next/dynamic";

const MapDashboard = dynamic(() => import("@/components/MapDashboard"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-[#0A1628]">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-[#14B8A6] border-t-transparent" />
        <p className="text-sm text-slate-400">Initializing BlueRegistry...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return <MapDashboard />;
}
