import { cn } from "@/lib/utils";

const tonos = {
  gris: "bg-slate-100 text-slate-700 ring-slate-200",
  azul: "bg-blue-50 text-blue-700 ring-blue-200",
  verde: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ambar: "bg-amber-50 text-amber-800 ring-amber-200",
  rojo: "bg-red-50 text-red-700 ring-red-200",
  violeta: "bg-violet-50 text-violet-700 ring-violet-200",
} as const;

export type Tono = keyof typeof tonos;

export function Badge({ tono = "gris", className, children }: { tono?: Tono; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", tonos[tono], className)}>
      {children}
    </span>
  );
}

/** Mapa de estados del dominio a etiqueta + tono. */
const ESTADOS: Record<string, [string, Tono]> = {
  DISPONIBLE: ["Disponible", "verde"],
  ALQUILADA: ["Alquilada", "azul"],
  EN_PROYECTO: ["En proyecto", "violeta"],
  MANTENIMIENTO: ["Mantenimiento", "ambar"],
  VENDIDA: ["Vendida", "gris"],
  EN_RUTA: ["En ruta", "azul"],
  INACTIVO: ["Inactivo", "gris"],
  ACTIVO: ["Activo", "verde"],
  FINALIZADO: ["Finalizado", "gris"],
  CANCELADO: ["Cancelado", "rojo"],
  PROGRAMADO: ["Programado", "gris"],
  EN_CURSO: ["En curso", "azul"],
  ENTREGADO: ["Entregado", "verde"],
  PENDIENTE: ["Pendiente", "ambar"],
  APROBADA: ["Aprobada", "azul"],
  EN_TRANSITO: ["En tránsito", "violeta"],
  RECIBIDA: ["Recibida", "verde"],
  RECHAZADA: ["Rechazada", "rojo"],
  PLANIFICADA: ["Planificada", "gris"],
  EN_PROCESO: ["En proceso", "azul"],
  COMPLETADA: ["Completada", "verde"],
  CANCELADA: ["Cancelada", "rojo"],
  SOLICITADO: ["Solicitado", "ambar"],
  CONFIRMADO: ["Confirmado", "azul"],
  EN_PREPARACION: ["En preparación", "violeta"],
  DESPACHADO: ["Despachado", "azul"],
  SOLICITADA: ["Solicitada", "ambar"],
  CONFIRMADA: ["Confirmada", "azul"],
  REALIZADA: ["Realizada", "verde"],
  PLANIFICACION: ["Planificación", "gris"],
  EN_EJECUCION: ["En ejecución", "azul"],
  PAUSADO: ["Pausado", "ambar"],
  INFO: ["Info", "azul"],
  ADVERTENCIA: ["Advertencia", "ambar"],
  CRITICA: ["Crítica", "rojo"],
};

export function EstadoBadge({ estado }: { estado: string }) {
  const [texto, tono] = ESTADOS[estado] ?? [estado, "gris"];
  return <Badge tono={tono}>{texto}</Badge>;
}
