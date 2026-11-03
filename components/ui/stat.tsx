import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stat({
  etiqueta,
  valor,
  detalle,
  icono: Icono,
  tono = "slate",
}: {
  etiqueta: string;
  valor: React.ReactNode;
  detalle?: React.ReactNode;
  icono?: LucideIcon;
  tono?: "slate" | "blue" | "green" | "amber" | "red" | "violet";
}) {
  const fondo = {
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    violet: "bg-violet-50 text-violet-600",
  }[tono];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{etiqueta}</p>
        {Icono && (
          <span className={cn("grid size-8 place-items-center rounded-lg", fondo)}>
            <Icono className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-slate-500">{detalle}</p>}
    </div>
  );
}

export function Progreso({ valor, tono, className }: { valor: number; tono?: "blue" | "amber" | "red" | "green"; className?: string }) {
  const color = { blue: "bg-blue-600", amber: "bg-amber-500", red: "bg-red-600", green: "bg-emerald-600" }[tono ?? "blue"];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)} role="progressbar" aria-valuenow={Math.round(valor)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100, Math.max(0, valor))}%` }} />
    </div>
  );
}
