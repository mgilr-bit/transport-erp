"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const ejeTick = { fill: "#64748b", fontSize: 12 };
const hora = new Intl.DateTimeFormat("es-GT", { hour: "2-digit", minute: "2-digit", timeZone: "America/Guatemala" });

/** Velocidad a lo largo del tiempo, con el límite permitido como referencia. */
export function GraficaVelocidad({ puntos, limite, altura = 220 }: { puntos: { timestamp: string; velocidad: number }[]; limite?: number; altura?: number }) {
  const datos = puntos.map((p) => ({ t: hora.format(new Date(p.timestamp)), velocidad: p.velocidad }));
  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={datos} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="relleno-velocidad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="t" tickLine={false} axisLine={{ stroke: "#cbd5e1" }} tick={ejeTick} minTickGap={32} />
          <YAxis tickLine={false} axisLine={false} tick={ejeTick} width={44} unit=" " domain={[0, (max: number) => Math.max(max, (limite ?? 0) + 10)]} />
          <Tooltip
            cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                  <p className="font-semibold text-slate-900">{label}</p>
                  <p className={limite && Number(payload[0].value) > limite ? "font-medium text-red-600" : "text-slate-600"}>{Number(payload[0].value).toFixed(0)} km/h</p>
                </div>
              ) : null
            }
          />
          {limite && <ReferenceLine y={limite} stroke="#dc2626" strokeDasharray="4 4" label={{ value: `Límite ${limite} km/h`, position: "insideTopRight", fill: "#dc2626", fontSize: 11 }} />}
          <Area type="monotone" dataKey="velocidad" stroke="#2563eb" strokeWidth={2} fill="url(#relleno-velocidad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
