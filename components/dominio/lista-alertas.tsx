import { AlertTriangle, Gauge, Info, OctagonAlert, PackageMinus, SignalZero, Timer, Wallet } from "lucide-react";
import type { Alerta } from "@/app/generated/prisma/client";
import { GIROS } from "@/lib/constants";
import { cn, formatFecha } from "@/lib/utils";

const ICONO_TIPO = {
  EXCESO_VELOCIDAD: Gauge,
  USO_EXCESIVO: Timer,
  SIN_SENAL: SignalZero,
  PRESUPUESTO_80: Wallet,
  PRESUPUESTO_100: Wallet,
  INVENTARIO_BAJO: PackageMinus,
};

const SEVERIDAD = {
  INFO: { icono: Info, clase: "bg-blue-50 text-blue-600", texto: "Info" },
  ADVERTENCIA: { icono: AlertTriangle, clase: "bg-amber-50 text-amber-600", texto: "Advertencia" },
  CRITICA: { icono: OctagonAlert, clase: "bg-red-50 text-red-600", texto: "Crítica" },
};

export function ListaAlertas({ alertas, acciones }: { alertas: Alerta[]; acciones?: (a: Alerta) => React.ReactNode }) {
  if (!alertas.length) return <p className="py-8 text-center text-sm text-slate-400">No hay alertas pendientes.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {alertas.map((a) => {
        const s = SEVERIDAD[a.severidad];
        const Icono = ICONO_TIPO[a.tipo];
        return (
          <li key={a.id} className={cn("flex gap-3 py-3", a.leida && "opacity-60")}>
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", s.clase)} title={s.texto}>
              <Icono className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">
                {a.titulo}
                <span className="sr-only"> — severidad {s.texto}</span>
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{a.mensaje}</p>
              <p className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                <span className={cn("inline-flex items-center gap-1 font-medium", a.severidad === "CRITICA" ? "text-red-600" : a.severidad === "ADVERTENCIA" ? "text-amber-700" : "text-blue-600")}>
                  <s.icono className="size-3" aria-hidden />
                  {s.texto}
                </span>
                · {GIROS[a.giro].corto} · {formatFecha(a.createdAt, true)}
              </p>
            </div>
            {acciones?.(a)}
          </li>
        );
      })}
    </ul>
  );
}
