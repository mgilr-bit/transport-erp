"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { latLngBounds } from "leaflet";
import { GIROS, REGLAS } from "@/lib/constants";
import type { GiroNegocio } from "@/app/generated/prisma/client";

export type ActivoMapa = {
  imei: string;
  tipo: "CAMION" | "MAQUINA";
  nombre: string;
  detalle: string;
  giro: GiroNegocio;
  latitud: number;
  longitud: number;
  velocidad: number;
  motorEncendido: boolean;
  timestamp: string;
  sinSenal: boolean;
  excesoVelocidad: boolean;
};

export type PuntoRuta = { latitud: number; longitud: number; velocidad: number; timestamp: string };

const GUATEMALA: [number, number] = [15.6, -90.3];
const hora = new Intl.DateTimeFormat("es-GT", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short", timeZone: "America/Guatemala" });

/** Encuadra el mapa en el recorrido seleccionado o en toda la flota. */
function Encuadre({ puntos }: { puntos: [number, number][] }) {
  const map = useMap();
  const clave = puntos.length ? `${puntos[0]}|${puntos.at(-1)}|${puntos.length}` : "";
  useEffect(() => {
    if (puntos.length > 1) map.fitBounds(latLngBounds(puntos), { padding: [32, 32], maxZoom: 13 });
    else if (puntos.length === 1) map.setView(puntos[0], 12);
    // Solo re-encuadrar cuando cambia el conjunto, no en cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, map]);
  return null;
}

export default function MapaFlota({ activos, ruta = [], seleccionado, altura = 520 }: { activos: ActivoMapa[]; ruta?: PuntoRuta[]; seleccionado?: string; altura?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const seleccionar = (imei: string) => {
    const qs = new URLSearchParams(search);
    qs.set("imei", imei);
    router.push(`${pathname}?${qs}`, { scroll: false });
  };

  const encuadre: [number, number][] = ruta.length > 1 ? ruta.map((p) => [p.latitud, p.longitud]) : activos.map((a) => [a.latitud, a.longitud]);
  // Tramos con exceso de velocidad se dibujan en rojo sobre la ruta
  const excesos = ruta.slice(1).flatMap((p, i) => (p.velocidad > REGLAS.velocidadMaximaCamion ? [[[ruta[i].latitud, ruta[i].longitud], [p.latitud, p.longitud]] as [number, number][]] : []));

  return (
    <div style={{ height: altura }} className="overflow-hidden rounded-b-xl">
      <MapContainer center={GUATEMALA} zoom={7} scrollWheelZoom className="size-full" attributionControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <Encuadre puntos={encuadre} />

        {ruta.length > 1 && (
          <>
            <Polyline positions={ruta.map((p) => [p.latitud, p.longitud])} pathOptions={{ color: "#1d4ed8", weight: 3, opacity: 0.8 }} />
            {excesos.map((tramo, i) => <Polyline key={i} positions={tramo} pathOptions={{ color: "#dc2626", weight: 5, opacity: 0.9 }} />)}
            <CircleMarker center={[ruta[0].latitud, ruta[0].longitud]} radius={5} pathOptions={{ color: "#fff", weight: 2, fillColor: "#64748b", fillOpacity: 1 }}>
              <Tooltip>Inicio · {hora.format(new Date(ruta[0].timestamp))}</Tooltip>
            </CircleMarker>
          </>
        )}

        {activos.map((a) => {
          const activo = a.imei === seleccionado;
          const color = a.sinSenal ? "#94a3b8" : GIROS[a.giro].color;
          return (
            <CircleMarker
              key={a.imei}
              center={[a.latitud, a.longitud]}
              radius={activo ? 10 : a.tipo === "CAMION" ? 7 : 6}
              pathOptions={{
                color: a.excesoVelocidad ? "#dc2626" : activo ? "#0f172a" : "#ffffff",
                weight: a.excesoVelocidad || activo ? 3 : 1.5,
                fillColor: color,
                fillOpacity: a.motorEncendido && !a.sinSenal ? 0.95 : 0.5,
                dashArray: a.sinSenal ? "3 3" : undefined,
              }}
              eventHandlers={{ click: () => seleccionar(a.imei) }}
            >
              <Tooltip direction="top" offset={[0, -6]}>{a.nombre}</Tooltip>
              <Popup>
                <div className="min-w-44 text-xs leading-relaxed">
                  <p className="text-sm font-semibold text-slate-900">{a.nombre}</p>
                  <p className="text-slate-500">{a.detalle} · {GIROS[a.giro].corto}</p>
                  <p className="mt-1.5">
                    <span className={a.excesoVelocidad ? "font-semibold text-red-600" : "text-slate-900"}>{a.velocidad.toFixed(0)} km/h</span>
                    {" · "}motor {a.motorEncendido ? "encendido" : "apagado"}
                  </p>
                  <p className={a.sinSenal ? "font-medium text-amber-700" : "text-slate-500"}>
                    {a.sinSenal ? "Sin señal desde " : "Actualizado "}{hora.format(new Date(a.timestamp))}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
