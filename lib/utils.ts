import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Numeric = number | string | { toString(): string } | null | undefined;

export function toNumber(value: Numeric): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}

const quetzales = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  maximumFractionDigits: 2,
});

const quetzalesCompacto = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatQ(value: Numeric, compacto = false) {
  return (compacto ? quetzalesCompacto : quetzales).format(toNumber(value));
}

export function formatNum(value: Numeric, decimales = 0) {
  return new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(toNumber(value));
}

export function formatFecha(fecha: Date | string | null | undefined, conHora = false) {
  if (!fecha) return "—";
  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(conHora ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "America/Guatemala",
  }).format(new Date(fecha));
}

export function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

/** Días calendario entre dos fechas, mínimo 1 (un alquiler de un día cuenta como 1). */
export function diasEntre(inicio: Date, fin: Date) {
  const ms = new Date(fin).setHours(0, 0, 0, 0) - new Date(inicio).setHours(0, 0, 0, 0);
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/** Genera un código correlativo legible, p. ej. VJ-2026-00042 */
export function codigoCorrelativo(prefijo: string, n: number, anio = new Date().getFullYear()) {
  return `${prefijo}-${anio}-${String(n).padStart(5, "0")}`;
}

/** Guatemala no tiene horario de verano: siempre UTC−6. */
const ZONA_GT = "-06:00";

/**
 * Convierte el valor de un campo datetime-local ("2026-11-12T10:00") en una fecha en hora
 * de Guatemala. Sin esto, un servidor en UTC lo interpretaría seis horas antes.
 */
export function fechaHoraGT(valor: string) {
  const texto = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(valor) ? `${valor.length === 16 ? `${valor}:00` : valor}${ZONA_GT}` : valor;
  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** Valor para un campo datetime-local en hora de Guatemala. */
export function entradaFechaHoraGT(fecha: Date) {
  return new Date(fecha.getTime() - 6 * 3_600_000).toISOString().slice(0, 16);
}
