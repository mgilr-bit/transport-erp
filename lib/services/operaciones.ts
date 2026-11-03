import "server-only";
import { prisma } from "@/lib/db";
import { ajustarInventario } from "@/lib/services/inventario";
import { siguienteCodigo } from "@/lib/services/flujo";
import { registrarGasto } from "@/lib/services/finanzas";
import { calcularAlquiler, calcularAvance, calcularRequerimientos, rangosSeSolapan } from "@/lib/reglas";
import { toNumber } from "@/lib/utils";
import type { CategoriaGasto, TipoObra } from "@/app/generated/prisma/client";

// ─── Extracción ────────────────────────────────────────────────────────────

export async function registrarExtraccion(data: {
  sedeId: number;
  materialId: number;
  toneladas: number;
  turno: string;
  fecha: Date;
  observaciones?: string | null;
}) {
  const sede = await prisma.sede.findUniqueOrThrow({ where: { id: data.sedeId } });
  if (sede.tipo !== "MINA") throw new Error("La sede seleccionada no es una planta de extracción");
  return prisma.$transaction(async (tx) => {
    const registro = await tx.registroExtraccion.create({ data });
    await ajustarInventario(tx, data.sedeId, data.materialId, data.toneladas);
    return registro;
  });
}

// ─── Producción ────────────────────────────────────────────────────────────

export async function crearOrdenProduccion(data: { sedeId: number; productoId: number; cantidad: number; fechaInicio: Date }) {
  return prisma.ordenProduccion.create({ data: { ...data, codigo: await siguienteCodigo("OP") } });
}

export async function requerimientosOrden(ordenId: number) {
  const orden = await prisma.ordenProduccion.findUniqueOrThrow({
    where: { id: ordenId },
    include: { producto: { include: { insumos: { include: { material: true } } } } },
  });
  const inventario = await prisma.inventario.findMany({ where: { sedeId: orden.sedeId } });
  return calcularRequerimientos(
    toNumber(orden.cantidad),
    orden.producto.insumos.map((i) => ({ materialId: i.materialId, nombre: i.material.nombre, cantidadPorUnidad: toNumber(i.cantidadPorUnidad) })),
    new Map(inventario.map((i) => [i.materialId, toNumber(i.cantidad)])),
  );
}

/** Inicia la orden consumiendo los insumos de la receta del inventario de la planta. */
export async function iniciarOrden(ordenId: number) {
  const { requerimientos, faltantes } = await requerimientosOrden(ordenId);
  if (faltantes.length) {
    throw new Error(`Faltan insumos: ${faltantes.map((f) => `${f.nombre} (${(f.requerido - f.disponible).toFixed(2)} t)`).join(", ")}`);
  }
  return prisma.$transaction(async (tx) => {
    const orden = await tx.ordenProduccion.update({ where: { id: ordenId, estado: "PLANIFICADA" }, data: { estado: "EN_PROCESO" } });
    for (const r of requerimientos) await ajustarInventario(tx, orden.sedeId, r.materialId, -r.requerido);
    return orden;
  });
}

export async function completarOrden(ordenId: number) {
  return prisma.ordenProduccion.update({
    where: { id: ordenId, estado: "EN_PROCESO" },
    data: { estado: "COMPLETADA", fechaFin: new Date() },
  });
}

// ─── Maquinaria ────────────────────────────────────────────────────────────

export async function crearContratoAlquiler(data: { maquinaId: number; clienteId: number; fechaInicio: Date; fechaFin: Date; deposito: number }) {
  const maquina = await prisma.maquina.findUniqueOrThrow({ where: { id: data.maquinaId }, include: { contratos: { where: { estado: "ACTIVO" } } } });
  if (maquina.estado !== "DISPONIBLE") throw new Error(`La máquina ${maquina.codigo} no está disponible`);
  if (maquina.contratos.some((c) => rangosSeSolapan(c.fechaInicio, c.fechaFin, data.fechaInicio, data.fechaFin))) {
    throw new Error("Existe un contrato activo que se cruza con esas fechas");
  }
  const tarifa = toNumber(maquina.tarifaDiaria);
  const { total } = calcularAlquiler(tarifa, data.fechaInicio, data.fechaFin);
  const codigo = await siguienteCodigo("ALQ");
  return prisma.$transaction(async (tx) => {
    await tx.maquina.update({ where: { id: maquina.id }, data: { estado: "ALQUILADA" } });
    return tx.contratoAlquiler.create({ data: { ...data, codigo, tarifaDiaria: tarifa, total } });
  });
}

export async function finalizarContrato(id: number) {
  return prisma.$transaction(async (tx) => {
    const c = await tx.contratoAlquiler.update({ where: { id, estado: "ACTIVO" }, data: { estado: "FINALIZADO" } });
    await tx.maquina.update({ where: { id: c.maquinaId }, data: { estado: "DISPONIBLE" } });
    return c;
  });
}

export async function venderMaquina(data: { maquinaId: number; clienteId: number; precio: number; fecha: Date }) {
  const maquina = await prisma.maquina.findUniqueOrThrow({ where: { id: data.maquinaId } });
  if (maquina.estado !== "DISPONIBLE") throw new Error(`La máquina ${maquina.codigo} no está disponible para venta`);
  const codigo = await siguienteCodigo("VTA");
  return prisma.$transaction(async (tx) => {
    await tx.maquina.update({ where: { id: maquina.id }, data: { estado: "VENDIDA" } });
    return tx.ventaMaquina.create({ data: { ...data, codigo } });
  });
}

// ─── Construcción ──────────────────────────────────────────────────────────

export async function crearProyecto(data: {
  nombre: string;
  tipo: TipoObra;
  clienteId: number;
  ubicacion: string;
  departamento: string;
  montoContrato: number;
  fechaInicio: Date;
  fechaFinEstimada: Date;
  descripcion?: string | null;
}) {
  if (data.fechaFinEstimada <= data.fechaInicio) throw new Error("La fecha de entrega debe ser posterior al inicio");
  return prisma.proyectoConstruccion.create({ data: { ...data, codigo: await siguienteCodigo("PRY") } });
}

export async function agregarHito(data: { proyectoId: number; nombre: string; peso: number; fechaMeta: Date }) {
  return prisma.$transaction(async (tx) => {
    const proyecto = await tx.proyectoConstruccion.findUniqueOrThrow({ where: { id: data.proyectoId } });
    if (proyecto.estado === "FINALIZADO") throw new Error("La obra ya está finalizada");
    await tx.hitoProyecto.create({ data });
    // Un hito nuevo cambia la ponderación del avance
    const hitos = await tx.hitoProyecto.findMany({ where: { proyectoId: data.proyectoId } });
    return tx.proyectoConstruccion.update({ where: { id: data.proyectoId }, data: { avance: calcularAvance(hitos) } });
  });
}

/** Registra un costo de obra como gasto del giro y lo acumula en el proyecto. */
export async function registrarCostoObra(data: { proyectoId: number; categoria: CategoriaGasto; descripcion: string; monto: number; fecha: Date; usuarioId?: number }) {
  const proyecto = await prisma.proyectoConstruccion.findUniqueOrThrow({ where: { id: data.proyectoId } });
  if (proyecto.estado === "FINALIZADO") throw new Error("La obra ya está finalizada");
  const sede = await prisma.sede.findFirst({ where: { tipo: "OFICINA_CONSTRUCCION" } });
  return registrarGasto(
    {
      giro: "CONSTRUCCION",
      sedeId: sede?.id,
      categoria: data.categoria,
      descripcion: `${proyecto.codigo} · ${data.descripcion}`,
      monto: data.monto,
      fecha: data.fecha,
      documento: proyecto.codigo,
      usuarioId: data.usuarioId,
    },
    (tx) => tx.proyectoConstruccion.update({ where: { id: proyecto.id }, data: { costoEjecutado: { increment: data.monto } } }),
  );
}

export async function cambiarEstadoProyecto(id: number, estado: "EN_EJECUCION" | "PAUSADO") {
  const proyecto = await prisma.proyectoConstruccion.findUniqueOrThrow({ where: { id } });
  if (proyecto.estado === "FINALIZADO") throw new Error("La obra ya está finalizada");
  return prisma.proyectoConstruccion.update({ where: { id }, data: { estado } });
}

export async function alternarHito(hitoId: number) {
  return prisma.$transaction(async (tx) => {
    const hito = await tx.hitoProyecto.findUniqueOrThrow({ where: { id: hitoId } });
    await tx.hitoProyecto.update({ where: { id: hitoId }, data: { completado: !hito.completado } });
    const hitos = await tx.hitoProyecto.findMany({ where: { proyectoId: hito.proyectoId } });
    const avance = calcularAvance(hitos);
    return tx.proyectoConstruccion.update({
      where: { id: hito.proyectoId },
      data: { avance, estado: avance === 100 ? "FINALIZADO" : avance > 0 ? "EN_EJECUCION" : undefined },
    });
  });
}

/** Asigna maquinaria propia a una obra (o la libera con proyectoId = null). */
export async function asignarMaquina(maquinaId: number, proyectoId: number | null) {
  const maquina = await prisma.maquina.findUniqueOrThrow({ where: { id: maquinaId } });
  if (proyectoId && maquina.estado !== "DISPONIBLE") throw new Error(`La máquina ${maquina.codigo} no está disponible`);
  return prisma.maquina.update({
    where: { id: maquinaId },
    data: { proyectoId, estado: proyectoId ? "EN_PROYECTO" : "DISPONIBLE" },
  });
}
