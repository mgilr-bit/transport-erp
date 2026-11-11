import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma, type GiroNegocio } from "@/app/generated/prisma/client";
import { autorizar, autorizarOperacion } from "@/lib/auth";
import { registrarBitacora } from "@/lib/bitacora";
import type { SessionPayload } from "@/lib/session";

export type ActionState = {
  ok: boolean;
  mensaje?: string;
  errores?: Record<string, string[] | undefined>;
};

export const estadoInicial: ActionState = { ok: false };

/** Valida FormData con un esquema Zod. */
export function validar<T extends z.ZodType>(schema: T, formData: FormData) {
  const datos = Object.fromEntries([...formData.entries()].filter(([k]) => !k.startsWith("$ACTION")));
  return schema.safeParse(datos);
}

/** Líneas de un pedido enviadas como campos `productoId` y `cantidad` repetidos; omite las filas vacías. */
export function lineasDePedido(formData: FormData) {
  const ids = formData.getAll("productoId");
  const cantidades = formData.getAll("cantidad");
  return ids
    .map((id, i) => ({ productoId: Number(id), cantidad: Number(cantidades[i]) }))
    .filter((l) => Number.isInteger(l.productoId) && l.productoId > 0 && Number.isFinite(l.cantidad));
}

export function erroresDe(error: z.ZodError): ActionState {
  return { ok: false, mensaje: "Revise los campos marcados.", errores: z.flattenError(error).fieldErrors as ActionState["errores"] };
}

/** Convierte excepciones de negocio o de base de datos en un mensaje legible. */
export function mensajeError(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return "Ya existe un registro con ese valor único.";
    if (e.code === "P2025") return "El registro cambió de estado o ya no existe. Actualice la página.";
  }
  if (e instanceof Error) return e.message;
  return "Ocurrió un error inesperado.";
}

// Esquemas reutilizables (FormData siempre entrega strings)
export const zId = z.coerce.number().int().positive({ error: "Seleccione una opción" });
export const zIdOpcional = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().positive().nullable());
export const zMonto = z.coerce.number({ error: "Ingrese un número" }).positive({ error: "Debe ser mayor a 0" });
export const zFecha = z.coerce.date({ error: "Fecha inválida" });
export const zTexto = (min = 1) => z.string().trim().min(min, { error: "Campo requerido" });
export const zTextoOpcional = z.preprocess((v) => (v === "" ? null : v), z.string().trim().nullable().optional());

/**
 * Envoltorio estándar de server actions: autoriza, ejecuta, registra en bitácora,
 * revalida rutas y traduce errores a un ActionState.
 */
export async function ejecutarAccion<T>(opciones: {
  /** Giros sobre los que se exige permiso de operación, o una regla propia. */
  giros: GiroNegocio[] | ((session: SessionPayload) => boolean);
  ejecutar: (session: SessionPayload) => Promise<T>;
  bitacora?: { accion: string; entidad: string; detalle?: string };
  revalidar: string[];
  exito: string | ((resultado: T) => string);
}): Promise<ActionState> {
  let resultado: T;
  try {
    const session = typeof opciones.giros === "function" ? await autorizar(opciones.giros) : await autorizarOperacion(...opciones.giros);
    resultado = await opciones.ejecutar(session);
    if (opciones.bitacora) {
      const { accion, entidad, detalle } = opciones.bitacora;
      await registrarBitacora(accion, entidad, detalle);
    }
  } catch (e) {
    return { ok: false, mensaje: mensajeError(e) };
  }
  for (const ruta of opciones.revalidar) revalidatePath(ruta);
  return { ok: true, mensaje: typeof opciones.exito === "function" ? opciones.exito(resultado) : opciones.exito };
}
