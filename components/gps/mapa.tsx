"use client";

import dynamic from "next/dynamic";

/** Leaflet usa `window`, así que el mapa solo se renderiza en el navegador. */
export const Mapa = dynamic(() => import("@/components/gps/mapa-flota"), {
  ssr: false,
  loading: () => <div className="grid h-[520px] place-items-center rounded-b-xl bg-slate-50 text-sm text-slate-400">Cargando mapa…</div>,
});
