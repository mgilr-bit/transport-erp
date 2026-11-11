"use server";

import { z } from "zod";
import { ejecutarAccion, erroresDe, validar, zFecha, zId, zMonto, zTexto, zTextoOpcional, type ActionState } from "@/lib/action";
import { puedeAprobar } from "@/lib/auth-rules";
import type { GiroNegocio } from "@/app/generated/prisma/client";
import { aprobarSolicitud, crearSolicitud, rechazarSolicitud } from "@/lib/services/flujo";
import { completarOrden, crearOrdenProduccion, iniciarOrden, registrarExtraccion } from "@/lib/services/operaciones";

// ─── Extracción ────────────────────────────────────────────────────────────

const ExtraccionSchema = z.object({
  sedeId: zId,
  materialId: zId,
  toneladas: zMonto.max(2000, { error: "Máximo 2,000 t por turno" }),
  turno: z.enum(["Matutino", "Vespertino", "Nocturno"]),
  fecha: zFecha,
  observaciones: zTextoOpcional,
});

export async function crearExtraccion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(ExtraccionSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  return ejecutarAccion({
    giros: ["EXTRACCION"],
    ejecutar: () => registrarExtraccion(parsed.data),
    bitacora: { accion: "REGISTRAR_EXTRACCION", entidad: "RegistroExtraccion", detalle: `${parsed.data.toneladas} t` },
    revalidar: ["/extraccion", "/dashboard"],
    exito: "Extracción registrada y sumada al inventario de la mina.",
  });
}

// ─── Producción ────────────────────────────────────────────────────────────

const OrdenSchema = z.object({ sedeId: zId, productoId: zId, cantidad: zMonto, fechaInicio: zFecha });

export async function crearOrden(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(OrdenSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  return ejecutarAccion({
    giros: ["PROCESO"],
    ejecutar: () => crearOrdenProduccion(parsed.data),
    bitacora: { accion: "CREAR_ORDEN", entidad: "OrdenProduccion" },
    revalidar: ["/proceso"],
    exito: "Orden de producción planificada.",
  });
}

export async function iniciarOrdenAction(id: number) {
  return ejecutarAccion({
    giros: ["PROCESO"],
    ejecutar: () => iniciarOrden(id),
    bitacora: { accion: "INICIAR_ORDEN", entidad: "OrdenProduccion", detalle: String(id) },
    revalidar: ["/proceso", "/dashboard"],
    exito: "Orden en proceso; insumos descontados del inventario.",
  });
}

export async function completarOrdenAction(id: number) {
  return ejecutarAccion({
    giros: ["PROCESO"],
    ejecutar: () => completarOrden(id),
    bitacora: { accion: "COMPLETAR_ORDEN", entidad: "OrdenProduccion", detalle: String(id) },
    revalidar: ["/proceso", "/dashboard"],
    exito: "Orden completada.",
  });
}

// ─── Solicitudes de materia prima ──────────────────────────────────────────

const SolicitudSchema = z.object({ plantaId: zId, materialId: zId, toneladas: zMonto, fechaRequerida: zFecha, notas: zTextoOpcional });

export async function crearSolicitudAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(SolicitudSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  return ejecutarAccion({
    giros: ["PROCESO"],
    ejecutar: () => crearSolicitud(parsed.data),
    bitacora: { accion: "SOLICITAR_MP", entidad: "SolicitudMateriaPrima" },
    revalidar: ["/flujo", "/proceso", "/dashboard"],
    exito: "Solicitud enviada; queda pendiente de aprobación.",
  });
}

const APRUEBAN_MINA: GiroNegocio[] = ["EXTRACCION", "PROCESO"];
const APRUEBAN_PROVEEDOR: GiroNegocio[] = ["PROCESO"];

const AprobarSchema = z.object({
  solicitudId: zId,
  origen: z.string().regex(/^(mina|proveedor):\d+$/, { error: "Seleccione el origen" }),
});

/** La aprueba la gerencia de Extracción o de Proceso (mina propia) o la de Proceso (compra a tercero); los operadores no aprueban. */
export async function aprobarSolicitudAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(AprobarSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  const [tipo, id] = parsed.data.origen.split(":");
  const origen = tipo === "mina" ? { minaId: Number(id) } : { proveedorId: Number(id) };
  return ejecutarAccion({
    giros: (session) => (tipo === "mina" ? APRUEBAN_MINA : APRUEBAN_PROVEEDOR).some((g) => puedeAprobar(session, g)),
    ejecutar: () => aprobarSolicitud(parsed.data.solicitudId, origen),
    bitacora: { accion: "APROBAR_SOLICITUD", entidad: "SolicitudMateriaPrima", detalle: parsed.data.origen },
    revalidar: ["/flujo", "/transporte", "/dashboard"],
    exito: "Solicitud aprobada; Transporte de MP ya puede programar el traslado.",
  });
}

const RechazarSchema = z.object({ solicitudId: zId, motivo: zTexto(5) });

export async function rechazarSolicitudAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(RechazarSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  return ejecutarAccion({
    giros: (session) => APRUEBAN_MINA.some((g) => puedeAprobar(session, g)),
    ejecutar: () => rechazarSolicitud(parsed.data.solicitudId, parsed.data.motivo),
    bitacora: { accion: "RECHAZAR_SOLICITUD", entidad: "SolicitudMateriaPrima", detalle: parsed.data.motivo },
    revalidar: ["/flujo", "/dashboard"],
    exito: "Solicitud rechazada.",
  });
}
