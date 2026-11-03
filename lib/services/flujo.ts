import "server-only";
import { prisma } from "@/lib/db";
import { ajustarInventario } from "@/lib/services/inventario";
import { calcularTarifaViaje, validarCapacidad } from "@/lib/reglas";
import { codigoCorrelativo, toNumber } from "@/lib/utils";
import type { ModalidadViaje, TipoViaje } from "@/app/generated/prisma/client";

/**
 * Flujo entre giros de negocio:
 *   Planta de proceso ──solicita──▶ Mina propia o proveedor tercero
 *        ▲                                     │
 *        └──recibe◀── Transporte de MP ◀───────┘
 */

export async function siguienteCodigo(prefijo: "SMP" | "VJ" | "OP" | "ALQ" | "VTA" | "PRY") {
  const anio = new Date().getFullYear();
  const modelo = {
    SMP: () => prisma.solicitudMateriaPrima.count(),
    VJ: () => prisma.viaje.count(),
    OP: () => prisma.ordenProduccion.count(),
    ALQ: () => prisma.contratoAlquiler.count(),
    VTA: () => prisma.ventaMaquina.count(),
    PRY: () => prisma.proyectoConstruccion.count(),
  }[prefijo];
  return codigoCorrelativo(prefijo, (await modelo()) + 1, anio);
}

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
  return prisma.solicitudMateriaPrima.update({
    where: { id },
    data: { estado: "APROBADA", minaId: origen.minaId ?? null, proveedorId: origen.proveedorId ?? null },
  });
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
}) {
  const camion = await prisma.camion.findUniqueOrThrow({ where: { id: data.camionId } });
  if (camion.estado !== "DISPONIBLE") throw new Error(`El camión ${camion.placa} no está disponible`);
  if (!validarCapacidad(toNumber(camion.capacidadTon), data.toneladas)) {
    throw new Error(`La carga excede la capacidad del camión (${toNumber(camion.capacidadTon)} t)`);
  }
  const ocupado = await prisma.viaje.findFirst({ where: { pilotoId: data.pilotoId, estado: { in: ["PROGRAMADO", "EN_CURSO"] } } });
  if (ocupado) throw new Error(`El piloto ya tiene asignado el viaje ${ocupado.codigo}`);

  const codigo = await siguienteCodigo("VJ");
  const tarifa = calcularTarifaViaje(data.distanciaKm, data.toneladas, data.modalidad);

  return prisma.$transaction(async (tx) => {
    if (data.solicitudId) {
      const s = await tx.solicitudMateriaPrima.findUniqueOrThrow({ where: { id: data.solicitudId } });
      if (s.estado !== "APROBADA") throw new Error("La solicitud debe estar aprobada para programar el traslado");
      await tx.solicitudMateriaPrima.update({ where: { id: s.id }, data: { estado: "EN_TRANSITO" } });
    }
    return tx.viaje.create({ data: { ...data, codigo, tarifa } });
  });
}

export async function iniciarViaje(id: number) {
  return prisma.$transaction(async (tx) => {
    const viaje = await tx.viaje.update({ where: { id, estado: "PROGRAMADO" }, data: { estado: "EN_CURSO", fechaSalida: new Date() } });
    await tx.camion.update({ where: { id: viaje.camionId }, data: { estado: "EN_RUTA" } });
    return viaje;
  });
}

/** Entrega el viaje; si atiende una solicitud de MP, mueve el inventario mina → planta. */
export async function entregarViaje(id: number) {
  return prisma.$transaction(async (tx) => {
    const viaje = await tx.viaje.findUniqueOrThrow({ where: { id }, include: { solicitud: true } });
    if (viaje.estado !== "EN_CURSO") throw new Error("Solo un viaje en curso puede marcarse como entregado");

    const s = viaje.solicitud;
    if (s) {
      const ton = toNumber(s.toneladas);
      if (s.minaId) await ajustarInventario(tx, s.minaId, s.materialId, -ton);
      await ajustarInventario(tx, s.plantaId, s.materialId, ton);
      await tx.solicitudMateriaPrima.update({ where: { id: s.id }, data: { estado: "RECIBIDA" } });
    }
    await tx.camion.update({ where: { id: viaje.camionId }, data: { estado: "DISPONIBLE" } });
    return tx.viaje.update({ where: { id }, data: { estado: "ENTREGADO", fechaEntrega: new Date() } });
  });
}

export async function cancelarViaje(id: number) {
  return prisma.$transaction(async (tx) => {
    const viaje = await tx.viaje.findUniqueOrThrow({ where: { id } });
    if (viaje.estado === "ENTREGADO" || viaje.estado === "CANCELADO") throw new Error("El viaje ya está cerrado");
    if (viaje.solicitudId) {
      await tx.solicitudMateriaPrima.update({ where: { id: viaje.solicitudId }, data: { estado: "APROBADA" } });
    }
    await tx.camion.update({ where: { id: viaje.camionId }, data: { estado: "DISPONIBLE" } });
    // Libera el vínculo para que la solicitud pueda reprogramarse
    return tx.viaje.update({ where: { id }, data: { estado: "CANCELADO", solicitudId: null } });
  });
}
