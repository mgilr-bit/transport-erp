"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNum } from "@/lib/utils";

const ejeTick = { fill: "#64748b", fontSize: 12 };
// Paleta categórica validada (orden fijo)
export const PALETA = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];

export function Lineas({ datos, series, ejeX, unidad = "", altura = 280 }: { datos: Record<string, number | string>[]; series: string[]; ejeX: string; unidad?: string; altura?: number }) {
  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey={ejeX} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} tick={ejeTick} />
          <YAxis tickLine={false} axisLine={false} tick={ejeTick} tickFormatter={(v) => formatNum(v)} width={56} />
          <Tooltip
            cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                  <p className="mb-1 font-semibold text-slate-900">{label}</p>
                  {payload.map((p) => (
                    <p key={String(p.dataKey)} className="flex items-center justify-between gap-6 text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <span className="h-0.5 w-3 rounded" style={{ background: p.color }} />
                        {p.name}
                      </span>
                      <span className="font-medium text-slate-900 tabular">
                        {formatNum(Number(p.value))} {unidad}
                      </span>
                    </p>
                  ))}
                </div>
              ) : null
            }
          />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "#475569", paddingTop: 8 }} />
          {series.map((s, i) => (
            <Line key={s} type="monotone" dataKey={s} stroke={PALETA[i]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
