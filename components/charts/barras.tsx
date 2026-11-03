"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNum, formatQ } from "@/lib/utils";

const ejeTick = { fill: "#64748b", fontSize: 12 };

/** Barras de una sola serie. `moneda` formatea en quetzales. */
export function Barras({
  datos,
  ejeX,
  valor,
  nombre,
  color = "#2563eb",
  moneda = false,
  altura = 260,
  horizontal = false,
}: {
  datos: Record<string, number | string>[];
  ejeX: string;
  valor: string;
  nombre: string;
  color?: string;
  moneda?: boolean;
  altura?: number;
  horizontal?: boolean;
}) {
  const fmt = (v: number) => (moneda ? formatQ(v, true) : formatNum(v));
  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 16, right: horizontal ? 56 : 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke="#e2e8f0" />
          {horizontal ? (
            <>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey={ejeX} tickLine={false} axisLine={false} tick={ejeTick} width={130} />
            </>
          ) : (
            <>
              <XAxis dataKey={ejeX} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} tick={ejeTick} />
              <YAxis tickLine={false} axisLine={false} tick={ejeTick} tickFormatter={fmt} width={64} />
            </>
          )}
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                  <p className="font-semibold text-slate-900">{label}</p>
                  <p className="text-slate-600">
                    {nombre}: <span className="font-medium text-slate-900 tabular">{moneda ? formatQ(Number(payload[0].value)) : formatNum(Number(payload[0].value))}</span>
                  </p>
                </div>
              ) : null
            }
          />
          <Bar dataKey={valor} name={nombre} fill={color} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={44}>
            <LabelList dataKey={valor} position={horizontal ? "right" : "top"} formatter={(v) => fmt(Number(v))} style={{ fill: "#475569", fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
