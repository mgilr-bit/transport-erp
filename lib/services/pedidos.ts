import "server-only";
import { prisma } from "@/lib/db";
import { ESTADOS_PEDIDO, GIROS } from "@/lib/constants";
import { calcularPedido, diasHasta, transicionPedido, type AccionPedido } from "@/lib/reglas";
import { formatQ, toNumber } from "@/lib/utils";
import { crearAlerta } from "@/lib/services/alertas";
import { siguienteCodigo } from "@/lib/services/codigos";
import { registrarCostoObra } from "@/lib/services/operaciones";
import { emitirEvento } from "@/lib/integraciones/webhooks";
import type { CanalPedido, EstadoPedido, GiroNegocio, Prisma } from "@/app/generated/prisma/client";

/**
 * Pedidos de productos a las plantas de proceso, hechos por clientes (portal, API o CSV)
 * o por otro giro de la empresa (p. ej. Construcción para una obra).
 */

export const INCLUIR_PEDIDO = {
  items: { include: { producto: { select: { codigo: true, nombre: true, unidad: true } } } },
  cliente: { select: { id: true, nombre: true } },
  viaje: { select: { codigo: true, estado: true } },
} satisfies Prisma.PedidoInclude;

export type PedidoCompleto = Prisma.PedidoGetPayload<{ include: typeof INCLUIR_PEDIDO }>;

/** Representación pública de un pedido para la API, los webhooks y los CSV. */
export function resumenPedido(p: PedidoCompleto) {
  return {
    codigo: p.codigo,
    estado: p.estado,
    canal: p.canal,
    total: toNumber(p.total),
    direccionEntrega: p.direccionEntrega,
    fechaRequerida: p.fechaRequerida?.toISOString() ?? null,
    viaje: p.viaje?.codigo ?? null,
    creado: p.createdAt.toISOString(),
    actualizado: p.updatedAt.toISOString(),
    items: p.items.map((i) => ({
      producto: i.producto.codigo,
      nombre: i.producto.nombre,
      unidad: i.producto.unidad,
      cantidad: toNumber(i.cantidad),
      precioUnitario: toNumber(i.precioUnitario),
      subtotal: toNumber(i.subtotal),
    })),
  };
}

type Solicitante = { clienteId: number } | { giroSolicitante: GiroNegocio; proyectoId?: number | null };

export type DatosPedido = Solicitante & {
  items: { productoId: number; cantidad: number }[];
  direccionEntrega: string;
  fechaRequerida?: Date | null;
  notas?: string | null;
  canal: CanalPedido;
};

export async function crearPedido(datos: DatosPedido) {
  const productos = await prisma.producto.findMany({ where: { id: { in: datos.items.map((i) => i.productoId) } } });
  const { lineas, total } = calcularPedido(datos.items, new Map(productos.map((p) => [p.id, toNumber(p.precio)])));
  if (datos.fechaRequerida && diasHasta(datos.fechaRequerida) < 0) throw new Error("La fecha requerida ya pasó");

  const cliente =
    "clienteId" in datos
      ? await prisma.cliente.findUniqueOrThrow({ where: { id: datos.clienteId }, include: { vendedor: { select: { id: true, giro: true, activo: true } } } })
      : null;
  // El pedido lo atiende el vendedor del cliente si es de Proceso; si no, cualquier vendedor de Proceso
  const vendedorId = cliente?.vendedor?.activo && cliente.vendedor.giro === "PROCESO" ? cliente.vendedor.id : null;
  const interno = "giroSolicitante" in datos ? datos : null;
  const origen = cliente ? cliente.nombre : GIROS[interno!.giroSolicitante].nombre;
  const codigo = await siguienteCodigo("PED");

  const pedido = await prisma.$transaction(async (tx) => {
    const p = await tx.pedido.create({
      data: {
        codigo,
        clienteId: cliente?.id ?? null,
        giroSolicitante: interno?.giroSolicitante ?? null,
        proyectoId: interno?.proyectoId ?? null,
        vendedorId,
        total,
        direccionEntrega: datos.direccionEntrega,
        fechaRequerida: datos.fechaRequerida ?? null,
        notas: datos.notas ?? null,
        canal: datos.canal,
        items: { create: lineas },
      },
      include: INCLUIR_PEDIDO,
    });
    await crearAlerta(
      {
        tipo: "PEDIDO",
        severidad: "INFO",
        giro: "PROCESO",
        titulo: `Nuevo pedido ${codigo} de ${origen}`,
        mensaje: `${lineas.length} producto${lineas.length === 1 ? "" : "s"} por ${formatQ(total)}; entrega en ${datos.direccionEntrega}.`,
        referencia: `pedido:${p.id}`,
        ...(vendedorId ? { usuarioId: vendedorId } : { rolesDestino: ["VENDEDOR", "GERENTE"] }),
      },
      tx,
    );
    return p;
  });
  if (pedido.clienteId) emitirEvento("pedido.creado", { clienteId: pedido.clienteId }, resumenPedido(pedido));
  return pedido;
}

const AVISO_CLIENTE: Record<EstadoPedido, string> = {
  SOLICITADO: "Recibimos su pedido.",
  CONFIRMADO: "La planta confirmó su pedido y lo programará para producción.",
  EN_PREPARACION: "Su pedido se está preparando en planta.",
  DESPACHADO: "Su pedido salió de la planta.",
  ENTREGADO: "Su pedido fue entregado. Gracias por su compra.",
  CANCELADO: "Su pedido fue cancelado. Su vendedor se comunicará con usted.",
};

type PedidoBase = { id: number; codigo: string; clienteId: number | null; giroSolicitante: GiroNegocio | null; plantaId: number | null };

/** Avisos de un cambio de estado. Se ejecuta dentro de la transacción del cambio. */
export async function avisarCambioPedido(tx: Prisma.TransactionClient, pedido: PedidoBase, estado: EstadoPedido, detalle?: string) {
  const referencia = `pedido:${pedido.id}`;
  if (pedido.clienteId) {
    await crearAlerta(
      {
        tipo: "PEDIDO",
        severidad: estado === "CANCELADO" ? "ADVERTENCIA" : "INFO",
        giro: "PROCESO",
        clienteId: pedido.clienteId,
        titulo: `Pedido ${pedido.codigo}: ${ESTADOS_PEDIDO[estado].toLowerCase()}`,
        mensaje: detalle ?? AVISO_CLIENTE[estado],
        referencia,
      },
      tx,
    );
  }
  if (estado === "CONFIRMADO") {
    const planta = pedido.plantaId ? await tx.sede.findUnique({ where: { id: pedido.plantaId }, select: { nombre: true } }) : null;
    await crearAlerta(
      {
        tipo: "PEDIDO",
        severidad: "INFO",
        giro: "PROCESO",
        rolesDestino: ["OPERADOR", "GERENTE"],
        titulo: `Preparar pedido ${pedido.codigo}`,
        mensaje: `Pedido confirmado para despacho desde ${planta?.nombre ?? "la planta asignada"}.`,
        referencia,
      },
      tx,
    );
  }
  if (pedido.giroSolicitante && (estado === "DESPACHADO" || estado === "ENTREGADO" || estado === "CANCELADO")) {
    await crearAlerta(
      {
        tipo: "PEDIDO",
        severidad: estado === "CANCELADO" ? "ADVERTENCIA" : "INFO",
        giro: pedido.giroSolicitante,
        rolesDestino: ["GERENTE", "OPERADOR"],
        titulo: `Materiales ${pedido.codigo}: ${ESTADOS_PEDIDO[estado].toLowerCase()}`,
        mensaje: detalle ?? `El pedido a Plantas de proceso quedó ${ESTADOS_PEDIDO[estado].toLowerCase()}.`,
        referencia,
      },
      tx,
    );
  }
}

/**
 * Después de confirmar el cambio: webhook al cliente y, si un pedido interno para una obra
 * se entregó, su total se registra como costo de materiales de la obra.
 */
export async function despuesDeCambioPedido(id: number) {
  const p = await prisma.pedido.findUniqueOrThrow({ where: { id }, include: INCLUIR_PEDIDO });
  if (p.clienteId) emitirEvento("pedido.actualizado", { clienteId: p.clienteId }, resumenPedido(p));
  if (p.estado === "ENTREGADO" && p.proyectoId) {
    await registrarCostoObra({
      proyectoId: p.proyectoId,
      categoria: "MATERIALES",
      descripcion: `Materiales del pedido ${p.codigo}`,
      monto: toNumber(p.total),
      fecha: new Date(),
    });
  }
}

/**
 * Cambia el estado de un pedido. `clienteId` indica que lo hace el propio cliente
 * desde el portal o la API (solo puede cancelar lo que aún no se confirma).
 */
export async function avanzarPedido(id: number, accion: AccionPedido, opciones: { plantaId?: number; clienteId?: number } = {}) {
  const pedido = await prisma.pedido.findUniqueOrThrow({ where: { id }, include: { viaje: { select: { codigo: true } } } });
  const porCliente = opciones.clienteId !== undefined;
  if (porCliente && pedido.clienteId !== opciones.clienteId) throw new Error("El pedido no existe.");
  const nuevo = transicionPedido(pedido.estado, accion, porCliente);
  if (pedido.viaje && accion !== "confirmar" && accion !== "preparar") {
    throw new Error(`El pedido va en el viaje ${pedido.viaje.codigo}; su despacho y entrega se registran desde Transporte.`);
  }

  let plantaId = pedido.plantaId;
  if (accion === "confirmar") {
    if (!opciones.plantaId) throw new Error("Seleccione la planta que despachará el pedido");
    const planta = await prisma.sede.findUniqueOrThrow({ where: { id: opciones.plantaId } });
    if (planta.tipo !== "PLANTA_PROCESO") throw new Error("La sede seleccionada no es una planta de proceso");
    plantaId = planta.id;
  }

  await prisma.$transaction(async (tx) => {
    await tx.pedido.update({ where: { id, estado: pedido.estado }, data: { estado: nuevo, plantaId } });
    await avisarCambioPedido(tx, { ...pedido, plantaId }, nuevo);
  });
  await despuesDeCambioPedido(id);
  return nuevo;
}
