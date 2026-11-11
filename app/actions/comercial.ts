"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { ejecutarAccion, erroresDe, validar, zFechaHora, zId, zIdOpcional, zTexto, zTextoOpcional, type ActionState } from "@/lib/action";
import { puedeGestionarClientes, puedeGestionarPedidos, puedeGestionarReuniones } from "@/lib/auth-rules";
import { avanzarPedido } from "@/lib/services/pedidos";
import { asignarVendedor, cerrarReunion, confirmarReunion, crearCliente, enviarMensaje, reasignarReunion } from "@/lib/services/comercial";
import type { AccionPedido } from "@/lib/reglas";

const RUTAS = ["/ventas", "/dashboard", "/alertas"];

// ─── Pedidos ───────────────────────────────────────────────────────────────

const ConfirmarSchema = z.object({ pedidoId: zId, plantaId: zId });

export async function confirmarPedidoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(ConfirmarSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  return ejecutarAccion({
    giros: puedeGestionarPedidos,
    ejecutar: () => avanzarPedido(parsed.data.pedidoId, "confirmar", { plantaId: parsed.data.plantaId }),
    bitacora: { accion: "CONFIRMAR_PEDIDO", entidad: "Pedido", detalle: String(parsed.data.pedidoId) },
    revalidar: RUTAS,
    exito: "Pedido confirmado; la planta ya puede prepararlo.",
  });
}

const MENSAJES: Record<Exclude<AccionPedido, "confirmar">, string> = {
  preparar: "Pedido en preparación.",
  despachar: "Pedido despachado.",
  entregar: "Pedido entregado.",
  cancelar: "Pedido cancelado.",
};

export async function avanzarPedidoAction(id: number, accion: Exclude<AccionPedido, "confirmar">) {
  return ejecutarAccion({
    giros: puedeGestionarPedidos,
    ejecutar: () => avanzarPedido(id, accion),
    bitacora: { accion: `${accion.toUpperCase()}_PEDIDO`, entidad: "Pedido", detalle: String(id) },
    revalidar: [...RUTAS, "/transporte", "/construccion"],
    exito: MENSAJES[accion],
  });
}

// ─── Reuniones ─────────────────────────────────────────────────────────────

/** Las reuniones las atienden el gerente y los vendedores del giro de la reunión. */
async function reglaReunion(id: number) {
  const reunion = await prisma.reunion.findUnique({ where: { id }, select: { giro: true } });
  return (session: Parameters<typeof puedeGestionarReuniones>[0]) => !!reunion && puedeGestionarReuniones(session, reunion.giro);
}

const ConfirmarReunionSchema = z.object({
  reunionId: zId,
  fecha: zFechaHora,
  enlace: z.preprocess((v) => (v === "" ? null : v), z.url({ error: "Enlace inválido" }).nullable().optional()),
});

export async function confirmarReunionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(ConfirmarReunionSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  const { reunionId, fecha, enlace } = parsed.data;
  return ejecutarAccion({
    giros: await reglaReunion(reunionId),
    ejecutar: () => confirmarReunion(reunionId, { fecha, enlace }),
    bitacora: { accion: "CONFIRMAR_REUNION", entidad: "Reunion", detalle: String(reunionId) },
    revalidar: RUTAS,
    exito: "Reunión confirmada; se avisó al cliente.",
  });
}

const ReasignarSchema = z.object({ reunionId: zId, vendedorId: zId });

export async function reasignarReunionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(ReasignarSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  const { reunionId, vendedorId } = parsed.data;
  return ejecutarAccion({
    giros: await reglaReunion(reunionId),
    ejecutar: () => reasignarReunion(reunionId, vendedorId),
    bitacora: { accion: "REASIGNAR_REUNION", entidad: "Reunion", detalle: `${reunionId} → ${vendedorId}` },
    revalidar: RUTAS,
    exito: "Reunión reasignada.",
  });
}

export async function cerrarReunionAction(id: number, estado: "REALIZADA" | "CANCELADA") {
  return ejecutarAccion({
    giros: await reglaReunion(id),
    ejecutar: () => cerrarReunion(id, estado),
    bitacora: { accion: estado === "REALIZADA" ? "REUNION_REALIZADA" : "CANCELAR_REUNION", entidad: "Reunion", detalle: String(id) },
    revalidar: RUTAS,
    exito: estado === "REALIZADA" ? "Reunión marcada como realizada." : "Reunión cancelada.",
  });
}

// ─── Mensajes ──────────────────────────────────────────────────────────────

const MensajeSchema = z.object({ clienteId: zId, texto: zTexto(2).max(2000, { error: "Máximo 2,000 caracteres" }) });

/** Responden al cliente su vendedor, los gerentes y la administración. */
export async function responderClienteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(MensajeSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  const { clienteId, texto } = parsed.data;
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { vendedorId: true } });
  return ejecutarAccion({
    giros: (s) => !!cliente && (s.rol === "ADMIN" || s.rol === "GERENTE" || (s.rol === "VENDEDOR" && s.usuarioId === cliente.vendedorId)),
    ejecutar: (s) => enviarMensaje(clienteId, s, texto),
    revalidar: [`/ventas/mensajes/${clienteId}`, "/ventas"],
    exito: "Mensaje enviado.",
  });
}

// ─── Clientes ──────────────────────────────────────────────────────────────

const ClienteSchema = z.object({
  nombre: zTexto(3),
  nit: z.string().trim().toUpperCase().regex(/^[0-9A-Z-]{4,20}$/, { error: "NIT inválido" }),
  tipo: z.enum(["NACIONAL", "EXTRANJERO"]),
  pais: zTexto(),
  contacto: zTextoOpcional,
  telefono: zTextoOpcional,
  email: z.preprocess((v) => (v === "" ? null : v), z.email({ error: "Correo inválido" }).nullable().optional()),
  direccion: zTextoOpcional,
  vendedorId: zIdOpcional,
});

export async function crearClienteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(ClienteSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  return ejecutarAccion({
    giros: puedeGestionarClientes,
    ejecutar: () => crearCliente(parsed.data),
    bitacora: { accion: "CREAR_CLIENTE", entidad: "Cliente", detalle: parsed.data.nit },
    revalidar: ["/ventas"],
    exito: `Cliente ${parsed.data.nombre} registrado.`,
  });
}

const VendedorSchema = z.object({ clienteId: zId, vendedorId: zIdOpcional });

export async function asignarVendedorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(VendedorSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  return ejecutarAccion({
    giros: (s) => s.rol === "ADMIN" || s.rol === "GERENTE",
    ejecutar: () => asignarVendedor(parsed.data.clienteId, parsed.data.vendedorId),
    bitacora: { accion: "ASIGNAR_VENDEDOR", entidad: "Cliente", detalle: `${parsed.data.clienteId} → ${parsed.data.vendedorId ?? "sin vendedor"}` },
    revalidar: ["/ventas"],
    exito: "Vendedor asignado.",
  });
}
