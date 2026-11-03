import { AlertTriangle, CheckCircle2, OctagonAlert } from "lucide-react";
import { Progreso } from "@/components/ui/stat";
import { formatPct, formatQ } from "@/lib/utils";
import type { NivelPresupuesto } from "@/lib/reglas";

type Fila = { giro: string; nombre: string; color: string; presupuesto: number; ejecutado: number; porcentaje: number; nivel: NivelPresupuesto; disponible: number };

const NIVEL = {
  NORMAL: { icono: CheckCircle2, texto: "En rango", clase: "text-emerald-700", barra: "blue" as const },
  ADVERTENCIA: { icono: AlertTriangle, texto: "Sobre 80 %", clase: "text-amber-700", barra: "amber" as const },
  EXCEDIDO: { icono: OctagonAlert, texto: "Excedido", clase: "text-red-700", barra: "red" as const },
};

export function EjecucionPresupuesto({ filas }: { filas: Fila[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {filas.map((f) => {
        const n = NIVEL[f.nivel];
        return (
          <li key={f.giro} className="py-3 first:pt-0 last:pb-0">
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 font-medium text-slate-800">
                <span className="size-2.5 rounded-sm" style={{ background: f.color }} aria-hidden />
                {f.nombre}
              </span>
              <span className={`flex items-center gap-1 text-xs font-medium ${n.clase}`}>
                <n.icono className="size-3.5" aria-hidden />
                {n.texto} · {formatPct(f.porcentaje)}
              </span>
            </div>
            <Progreso valor={f.porcentaje} tono={n.barra} />
            <div className="mt-1.5 flex justify-between text-xs text-slate-500 tabular">
              <span>Ejecutado {formatQ(f.ejecutado)}</span>
              <span>Presupuesto {formatQ(f.presupuesto)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
