"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { erroresDe, lineasDePedido, mensajeError, validar, zFechaHora, zTexto, zTextoOpcional, type ActionState } from "@/lib/action";
import { autorizarCliente } from "@/lib/auth";
import { registrarBitacora } from "@/lib/bitacora";
import { GIROS_OPERATIVOS } from "@/lib/constants";
import { registrosCSV } from "@/lib/csv";
import { avanzarPedido, crearPedido } from "@/lib/services/pedidos";
import { cerrarReunion, enviarMensaje, solicitarReunion } from "@/lib/services/comercial";
import type { GiroNegocio } from "@/app/generated/prisma/client";

type SesionCliente = Awaited<ReturnType<typeof autorizarCliente>>;

/**
 * Envoltorio de las acciones del portal: el cliente sale siempre de la sesión (nunca del
 * formulario), la operación queda en la bitácora y los errores se muestran al usuario.
 */
async function ejecutarCliente<T>(o: {
  ejecutar: (s: SesionCliente) => Promise<T>;
  bitacora?: { accion: string; entidad: string; detalle?: (r: T) => string };
  revalidar: string[];
  exito: string | ((r: T) => string);
}): Promise<ActionState> {
  let resultado: T;
  try {
    const session = await autorizarCliente();
    resultado = await o.ejecutar(session);
    if (o.bitacora) await registrarBitacora(o.bitacora.accion, o.bitacora.entidad, o.bitacora.detalle?.(resultado));
  } catch (e) {
    return { ok: false, mensaje: mensajeError(e) };
  }
  for (const ruta of o.revalidar) revalidatePath(ruta);
  return { ok: true, mensaje: typeof o.exito === "function" ? o.exito(resultado) : o.exito };
}

const zFechaRequerida = z.preprocess((v) => (v === "" || v == null ? null : v), z.iso.date({ error: "Fecha inválida" }).nullable().optional());
const aFecha = (d: string | null | undefined) => (d ? new Date(`${d}T12:00:00-06:00`) : null);

// ─── Pedidos ───────────────────────────────────────────────────────────────

const PedidoSchema = z.object({ direccionEntrega: zTexto(5), fechaRequerida: zFechaRequerida, notas: zTextoOpcional });

export async function crearPedidoPortalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(PedidoSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  const items = lineasDePedido(formData);
  if (!items.length) return { ok: false, mensaje: "Agregue al menos un producto con su cantidad." };
  return ejecutarCliente({
    ejecutar: (s) => crearPedido({ clienteId: s.clienteId, canal: "PORTAL", items, ...parsed.data, fechaRequerida: aFecha(parsed.data.fechaRequerida) }),
    bitacora: { accion: "PEDIDO_PORTAL", entidad: "Pedido", detalle: (p) => p.codigo },
    revalidar: ["/portal", "/portal/pedidos"],
    exito: (p) => `Pedido ${p.codigo} enviado. Su vendedor lo confirmará y verá cada cambio en Pedidos.`,
  });
}

const LIMITE_ARCHIVO = 200 * 1024;

/** Pedido desde un archivo CSV con columnas `codigo` y `cantidad` (las demás se ignoran). */
export async function importarPedidoCsvAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(PedidoSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, mensaje: "Seleccione un archivo CSV.", errores: { archivo: ["Seleccione un archivo CSV"] } };
  if (archivo.size > LIMITE_ARCHIVO) return { ok: false, mensaje: "El archivo supera 200 KB." };

  const filas = registrosCSV(await archivo.text());
  if (!filas.length || !("codigo" in filas[0]) || !("cantidad" in filas[0])) {
    return { ok: false, mensaje: "El archivo debe tener las columnas codigo y cantidad en la primera fila." };
  }
  const conCantidad = filas.filter((f) => f.cantidad !== "");
  if (conCantidad.length > 200) return { ok: false, mensaje: "Máximo 200 productos por archivo." };
  const productos = await prisma.producto.findMany({ where: { codigo: { in: conCantidad.map((f) => f.codigo.toUpperCase()) } } });
  const errores: string[] = [];
  const items = conCantidad.flatMap((f, i) => {
    const producto = productos.find((p) => p.codigo === f.codigo.toUpperCase());
    const cantidad = Number(f.cantidad.replace(",", "."));
    if (!producto) errores.push(`fila ${i + 2}: el código ${f.codigo || "(vacío)"} no existe`);
    else if (!(cantidad > 0)) errores.push(`fila ${i + 2}: cantidad inválida`);
    return producto && cantidad > 0 ? [{ productoId: producto.id, cantidad }] : [];
  });
  if (errores.length) return { ok: false, mensaje: `Revise el archivo: ${errores.slice(0, 5).join("; ")}${errores.length > 5 ? "…" : ""}.` };
  if (!items.length) return { ok: false, mensaje: "El archivo no tiene cantidades." };

  return ejecutarCliente({
    ejecutar: (s) => crearPedido({ clienteId: s.clienteId, canal: "CSV", items, ...parsed.data, fechaRequerida: aFecha(parsed.data.fechaRequerida) }),
    bitacora: { accion: "PEDIDO_CSV", entidad: "Pedido", detalle: (p) => `${p.codigo} · ${archivo.name}` },
    revalidar: ["/portal", "/portal/pedidos"],
    exito: (p) => `Pedido ${p.codigo} creado con ${items.length} producto${items.length === 1 ? "" : "s"} del archivo.`,
  });
}

export async function cancelarPedidoPortalAction(id: number) {
  return ejecutarCliente({
    ejecutar: (s) => avanzarPedido(id, "cancelar", { clienteId: s.clienteId }),
    bitacora: { accion: "CANCELAR_PEDIDO_PORTAL", entidad: "Pedido", detalle: () => String(id) },
    revalidar: ["/portal", "/portal/pedidos"],
    exito: "Pedido cancelado.",
  });
}

// ─── Reuniones ─────────────────────────────────────────────────────────────

const ReunionSchema = z.object({
  giro: z.enum(GIROS_OPERATIVOS as [GiroNegocio, ...GiroNegocio[]], { error: "Seleccione un giro" }),
  modalidad: z.enum(["PRESENCIAL", "VIDEOCONFERENCIA"]),
  fecha: zFechaHora,
  motivo: zTexto(10).max(1000, { error: "Máximo 1,000 caracteres" }),
});

export async function solicitarReunionPortalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(ReunionSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  return ejecutarCliente({
    ejecutar: async (s) => {
      const cliente = await prisma.cliente.findUniqueOrThrow({ where: { id: s.clienteId } });
      return solicitarReunion({ ...parsed.data, clienteId: s.clienteId, contacto: s.nombre, email: s.email, empresa: cliente.nombre, telefono: cliente.telefono });
    },
    bitacora: { accion: "REUNION_PORTAL", entidad: "Reunion", detalle: (r) => r.codigo },
    revalidar: ["/portal", "/portal/reuniones"],
    exito: (r) => `Solicitud ${r.codigo} enviada. Le avisaremos aquí cuando se confirme.`,
  });
}

export async function cancelarReunionPortalAction(id: number) {
  return ejecutarCliente({
    ejecutar: (s) => cerrarReunion(id, "CANCELADA", s.clienteId),
    bitacora: { accion: "CANCELAR_REUNION_PORTAL", entidad: "Reunion", detalle: () => String(id) },
    revalidar: ["/portal", "/portal/reuniones"],
    exito: "Reunión cancelada.",
  });
}

// ─── Mensajes y notificaciones ─────────────────────────────────────────────

const MensajeSchema = z.object({ texto: zTexto(2).max(2000, { error: "Máximo 2,000 caracteres" }) });

export async function enviarMensajePortalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(MensajeSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  return ejecutarCliente({
    ejecutar: (s) => enviarMensaje(s.clienteId, s, parsed.data.texto),
    revalidar: ["/portal/mensajes"],
    exito: "Mensaje enviado.",
  });
}

export async function marcarNotificacionesAction() {
  return ejecutarCliente({
    ejecutar: (s) => prisma.alerta.updateMany({ where: { clienteId: s.clienteId, leida: false }, data: { leida: true } }),
    revalidar: ["/portal"],
    exito: "Notificaciones marcadas como leídas.",
  });
}
