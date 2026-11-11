import "server-only";
import { prisma } from "@/lib/db";
import { codigoCorrelativo } from "@/lib/utils";

const CONTADORES = {
  SMP: () => prisma.solicitudMateriaPrima.count(),
  VJ: () => prisma.viaje.count(),
  OP: () => prisma.ordenProduccion.count(),
  ALQ: () => prisma.contratoAlquiler.count(),
  VTA: () => prisma.ventaMaquina.count(),
  PRY: () => prisma.proyectoConstruccion.count(),
  PED: () => prisma.pedido.count(),
  REU: () => prisma.reunion.count(),
};

/** Siguiente código legible de un documento, p. ej. VJ-2026-00042. */
export async function siguienteCodigo(prefijo: keyof typeof CONTADORES) {
  return codigoCorrelativo(prefijo, (await CONTADORES[prefijo]()) + 1, new Date().getFullYear());
}
