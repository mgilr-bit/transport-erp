import "server-only";
import { prisma } from "@/lib/db";
import { ajustarInventario } from "@/lib/services/inventario";
import { crearAlerta } from "@/lib/services/alertas";
import { calcularTarifaViaje, validarCapacidad } from "@/lib/reglas";
import { formatFecha, toNumber } from "@/lib/utils";
import { siguienteCodigo } from "@/lib/services/codigos";
import { avisarCambioPedido, despuesDeCambioPedido } from "@/lib/services/pedidos";
import { emitirEvento } from "@/lib/integraciones/webhooks";
import { transicionPedido } from "@/lib/reglas";
import type { ModalidadViaje, Prisma, TipoViaje } from "@/app/generated/prisma/client";

/**
 * Flujo entre giros de negocio:
 *   Planta de proceso ──solicita──▶ Mina propia o proveedor tercero
 *        ▲                                     │
 *        └──recibe◀── Transporte de MP ◀───────┘
 */

export async function crearSolicitud(data: {
  plantaId: number;
  materialId: number;
  toneladas: number;
  fechaRequerida: Date;
  notas?: string | null;
}) {
  const planta = await prisma.sede.findUniqueOrThrow({ where: { id: data.plantaId } });
  if (planta.tipo !== "PLANTA_PROCESO") throw new Error("Solo una planta de proceso puede solicitar materia prima");
  return prisma.solicitudMateriaPrima.create({ data: { ...data, codigo: await siguienteCodigo("SMP") } });
}

/** Aprueba la solicitud asignando el origen: una mina propia o un proveedor tercero. */
export async function aprobarSolicitud(id: number, origen: { minaId?: number; proveedorId?: number }) {
  if (!origen.minaId === !origen.proveedorId) throw new Error("Seleccione una mina o un proveedor (solo uno)");
  const solicitud = await prisma.solicitudMateriaPrima.findUniqueOrThrow({ where: { id } });
  if (solicitud.estado !== "PENDIENTE") throw new Error("La solicitud ya fue procesada");

  if (origen.minaId) {
    const inv = await prisma.inventario.findUnique({
      where: { sedeId_materialId: { sedeId: origen.minaId, materialId: solicitud.materialId } },
    });
    if (toNumber(inv?.cantidad) < toNumber(solicitud.toneladas)) {
      throw new Error("La mina seleccionada no tiene existencias suficientes del material");
    }
  }
  const aprobada = await prisma.solicitudMateriaPrima.update({
    where: { id },
    data: { estado: "APROBADA", minaId: origen.minaId ?? null, proveedorId: origen.proveedorId ?? null },
    include: { material: true, planta: { select: { nombre: true, direccion: true } } },
  });
  // Compra a un tercero: su sistema recibe el pedido por webhook
  if (aprobada.proveedorId) {
    emitirEvento("solicitud.aprobada", { proveedorId: aprobada.proveedorId }, {
      codigo: aprobada.codigo,
      material: aprobada.material.codigo,
      nombreMaterial: aprobada.material.nombre,
      toneladas: toNumber(aprobada.toneladas),
      planta: aprobada.planta.nombre,
      direccion: aprobada.planta.direccion,
      fechaRequerida: aprobada.fechaRequerida.toISOString(),
    });
  }
  return aprobada;
}

export async function rechazarSolicitud(id: number, motivo: string) {
  return prisma.solicitudMateriaPrima.update({
    where: { id, estado: "PENDIENTE" },
    data: { estado: "RECHAZADA", notas: motivo },
  });
}

export async function programarViaje(data: {
  tipo: TipoViaje;
  modalidad: ModalidadViaje;
  camionId: number;
  pilotoId: number;
  clienteId?: number | null;
  origen: string;
  destino: string;
  carga: string;
  toneladas: number;
  distanciaKm: number;
  fechaSalida: Date;
  solicitudId?: number | null;
  pedidoId?: number | null;
}) {
  const camion = await prisma.camion.findUniqueOrThrow({ where: { id: data.camionId } });
  if (camion.estado !== "DISPONIBLE") throw new Error(`El camión ${camion.placa} no está disponible`);
  if (!validarCapacidad(toNumber(camion.capacidadTon), data.toneladas)) {
    throw new Error(`La carga excede la capacidad del camión (${toNumber(camion.capacidadTon)} t)`);
  }
  const ocupado = await prisma.viaje.findFirst({ where: { pilotoId: data.pilotoId, estado: { in: ["PROGRAMADO", "EN_CURSO"] } } });
  if (ocupado) throw new Error(`El piloto ya tiene asignado el viaje ${ocupado.codigo}`);

  if (data.pedidoId) {
    if (data.tipo !== "PRODUCTO") throw new Error("Los pedidos de clientes se despachan con viajes de producto");
    if (data.solicitudId) throw new Error("Un viaje atiende una solicitud de materia prima o un pedido, no ambos");
  }

  const codigo = await siguienteCodigo("VJ");
  const tarifa = calcularTarifaViaje(data.distanciaKm, data.toneladas, data.modalidad);

  return prisma.$transaction(async (tx) => {
    if (data.pedidoId) {
      const pedido = await tx.pedido.findUniqueOrThrow({ where: { id: data.pedidoId }, include: { viaje: true } });
      if (pedido.estado !== "EN_PREPARACION") throw new Error(`El pedido ${pedido.codigo} debe estar en preparación para programar su despacho`);
      if (pedido.viaje) throw new Error(`El pedido ${pedido.codigo} ya tiene el viaje ${pedido.viaje.codigo}`);
      data = { ...data, clienteId: data.clienteId ?? pedido.clienteId };
      if (pedido.clienteId) {
        await crearAlerta(
          {
            tipo: "PEDIDO",
            severidad: "INFO",
            giro: "TRANSPORTE_PROD",
            clienteId: pedido.clienteId,
            titulo: `Pedido ${pedido.codigo}: despacho programado`,
            mensaje: `Saldrá en el viaje ${codigo} el ${formatFecha(data.fechaSalida, true)} hacia ${data.destino}.`,
            referencia: `pedido:${pedido.id}`,
          },
          tx,
        );
      }
    }
    if (data.solicitudId) {
      const s = await tx.solicitudMateriaPrima.findUniqueOrThrow({ where: { id: data.solicitudId } });
      if (s.estado !== "APROBADA") throw new Error("La solicitud debe estar aprobada para programar el traslado");
      await tx.solicitudMateriaPrima.update({ where: { id: s.id }, data: { estado: "EN_TRANSITO" } });
    }
    return tx.viaje.create({ data: { ...data, codigo, tarifa } });
  });
}

export async function iniciarViaje(id: number) {
  const viaje = await prisma.$transaction(async (tx) => {
    const viaje = await tx.viaje.update({ where: { id, estado: "PROGRAMADO" }, data: { estado: "EN_CURSO", fechaSalida: new Date() } });
    await tx.camion.update({ where: { id: viaje.camionId }, data: { estado: "EN_RUTA" } });
    if (viaje.pedidoId) await moverPedidoConViaje(tx, viaje.pedidoId, "despachar", `Salió en el viaje ${viaje.codigo} hacia ${viaje.destino}.`);
    return viaje;
  });
  if (viaje.pedidoId) await despuesDeCambioPedido(viaje.pedidoId);
  notificarViaje(viaje);
  return viaje;
}

/** Un pedido despachado en un viaje avanza con el viaje. */
async function moverPedidoConViaje(tx: Prisma.TransactionClient, pedidoId: number, accion: "despachar" | "entregar", detalle: string) {
  const pedido = await tx.pedido.findUniqueOrThrow({ where: { id: pedidoId } });
  const estado = transicionPedido(pedido.estado, accion);
  await tx.pedido.update({ where: { id: pedidoId, estado: pedido.estado }, data: { estado } });
  await avisarCambioPedido(tx, pedido, estado, detalle);
}

/** Webhook al cliente cuando su viaje sale o se entrega. */
function notificarViaje(v: { codigo: string; estado: string; clienteId: number | null; origen: string; destino: string; carga: string; fechaSalida: Date; fechaEntrega: Date | null }) {
  if (!v.clienteId) return;
  emitirEvento("viaje.actualizado", { clienteId: v.clienteId }, {
    codigo: v.codigo,
    estado: v.estado,
    origen: v.origen,
    destino: v.destino,
    carga: v.carga,
    salida: v.fechaSalida.toISOString(),
    entrega: v.fechaEntrega?.toISOString() ?? null,
  });
}

/** Entrega el viaje; si atiende una solicitud de MP, mueve el inventario mina → planta. */
export async function entregarViaje(id: number) {
  const viaje = await prisma.$transaction(async (tx) => {
    const viaje = await tx.viaje.findUniqueOrThrow({ where: { id }, include: { solicitud: true } });
    if (viaje.estado !== "EN_CURSO") throw new Error("Solo un viaje en curso puede marcarse como entregado");

    const s = viaje.solicitud;
    if (s) {
      const ton = toNumber(s.toneladas);
      if (s.minaId) await ajustarInventario(tx, s.minaId, s.materialId, -ton);
      await ajustarInventario(tx, s.plantaId, s.materialId, ton);
      await tx.solicitudMateriaPrima.update({ where: { id: s.id }, data: { estado: "RECIBIDA" } });
    }
    if (viaje.pedidoId) await moverPedidoConViaje(tx, viaje.pedidoId, "entregar", `Entregado por el viaje ${viaje.codigo} en ${viaje.destino}.`);
    await tx.camion.update({ where: { id: viaje.camionId }, data: { estado: "DISPONIBLE" } });
    return tx.viaje.update({ where: { id }, data: { estado: "ENTREGADO", fechaEntrega: new Date() } });
  });
  if (viaje.pedidoId) await despuesDeCambioPedido(viaje.pedidoId);
  notificarViaje(viaje);
  return viaje;
}

export async function cancelarViaje(id: number) {
  return prisma.$transaction(async (tx) => {
    const viaje = await tx.viaje.findUniqueOrThrow({ where: { id } });
    if (viaje.estado === "ENTREGADO" || viaje.estado === "CANCELADO") throw new Error("El viaje ya está cerrado");
    if (viaje.solicitudId) {
      await tx.solicitudMateriaPrima.update({ where: { id: viaje.solicitudId }, data: { estado: "APROBADA" } });
    }
    if (viaje.pedidoId) {
      // El pedido vuelve a preparación para despacharse en otro viaje
      const pedido = await tx.pedido.update({ where: { id: viaje.pedidoId }, data: { estado: "EN_PREPARACION" } });
      await avisarCambioPedido(tx, pedido, "EN_PREPARACION", `El despacho en el viaje ${viaje.codigo} se canceló; se reprogramará.`);
    }
    await tx.camion.update({ where: { id: viaje.camionId }, data: { estado: "DISPONIBLE" } });
    // Libera el vínculo para que la solicitud o el pedido puedan reprogramarse
    return tx.viaje.update({ where: { id }, data: { estado: "CANCELADO", solicitudId: null, pedidoId: null } });
  });
}
