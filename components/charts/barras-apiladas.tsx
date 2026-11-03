"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatQ } from "@/lib/utils";

type Serie = { clave: string; nombre: string; color: string };

const ejeTick = { fill: "#64748b", fontSize: 12 };

export function BarrasApiladas({ datos, series, ejeX = "mes", altura = 300 }: { datos: Record<string, number | string>[]; series: Serie[]; ejeX?: string; altura?: number }) {
  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey={ejeX} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} tick={ejeTick} />
          <YAxis tickLine={false} axisLine={false} tick={ejeTick} tickFormatter={(v) => formatQ(v, true)} width={72} />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                  <p className="mb-1.5 font-semibold text-slate-900">{label}</p>
                  {[...payload].reverse().map((p) => (
                    <p key={String(p.dataKey)} className="flex items-center justify-between gap-6 text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-sm" style={{ background: p.color }} />
                        {p.name}
                      </span>
                      <span className="font-medium text-slate-900 tabular">{formatQ(Number(p.value))}</span>
                    </p>
                  ))}
                  <p className="mt-1.5 flex justify-between border-t border-slate-100 pt-1.5 font-semibold text-slate-900">
                    <span>Total</span>
                    <span className="tabular">{formatQ(payload.reduce((s, p) => s + Number(p.value ?? 0), 0))}</span>
                  </p>
                </div>
              ) : null
            }
          />
          <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: "#475569", paddingTop: 8 }} />
          {series.map((s, i) => (
            <Bar
              key={s.clave}
              dataKey={s.clave}
              name={s.nombre}
              stackId="a"
              fill={s.color}
              stroke="#fff"
              strokeWidth={1}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
