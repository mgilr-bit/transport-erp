import "server-only";
import { prisma } from "@/lib/db";
import { GIROS, GIROS_OPERATIVOS } from "@/lib/constants";
import { toNumber } from "@/lib/utils";
import type { GiroNegocio, Prisma } from "@/app/generated/prisma/client";

export function mesActual(ref = new Date()) {
  return { anio: ref.getFullYear(), mes: ref.getMonth() + 1, desde: new Date(ref.getFullYear(), ref.getMonth(), 1), hasta: new Date(ref.getFullYear(), ref.getMonth() + 1, 1) };
}

/** Facturación / valor de producción del mes por giro. */
export async function ingresosDelMes(ref = new Date()) {
  const { desde, hasta } = mesActual(ref);
  const rango = { gte: desde, lt: hasta };
  const [extraccion, ordenes, alquileres, ventas, viajes, proyectos] = await Promise.all([
    prisma.registroExtraccion.findMany({ where: { fecha: rango }, select: { toneladas: true, material: { select: { precioRef: true } } } }),
    prisma.ordenProduccion.findMany({ where: { estado: "COMPLETADA", fechaFin: rango }, select: { cantidad: true, producto: { select: { precio: true } } } }),
    prisma.contratoAlquiler.aggregate({ where: { fechaInicio: rango, estado: { not: "CANCELADO" } }, _sum: { total: true } }),
    prisma.ventaMaquina.aggregate({ where: { fecha: rango }, _sum: { precio: true } }),
    prisma.viaje.groupBy({ by: ["tipo"], where: { estado: "ENTREGADO", fechaEntrega: rango }, _sum: { tarifa: true }, _count: true }),
    prisma.proyectoConstruccion.aggregate({ where: { estado: { in: ["EN_EJECUCION", "PLANIFICACION", "PAUSADO"] } }, _sum: { montoContrato: true }, _count: true }),
  ]);
  const viajeMP = viajes.find((v) => v.tipo === "MATERIA_PRIMA");
  const viajePR = viajes.find((v) => v.tipo === "PRODUCTO");
  return {
    EXTRACCION: extraccion.reduce((s, e) => s + toNumber(e.toneladas) * toNumber(e.material.precioRef), 0),
    PROCESO: ordenes.reduce((s, o) => s + toNumber(o.cantidad) * toNumber(o.producto.precio), 0),
    MAQUINARIA: toNumber(alquileres._sum.total) + toNumber(ventas._sum.precio),
    TRANSPORTE_MP: toNumber(viajeMP?._sum.tarifa),
    TRANSPORTE_PROD: toNumber(viajePR?._sum.tarifa),
    CONSTRUCCION: toNumber(proyectos._sum.montoContrato),
    viajesEntregados: (viajeMP?._count ?? 0) + (viajePR?._count ?? 0),
    proyectosActivos: proyectos._count,
  };
}

/** Gasto mensual de los últimos 12 meses, por giro (para gráfica apilada). */
export async function gastosUltimos12Meses(giros: GiroNegocio[], ref = new Date()) {
  const desde = new Date(ref.getFullYear(), ref.getMonth() - 11, 1);
  const filas = await prisma.$queryRaw<{ mes: Date; giro: GiroNegocio; total: number }[]>`
    SELECT date_trunc('month', fecha) AS mes, giro, SUM(monto)::float AS total
    FROM "Gasto"
    WHERE fecha >= ${desde}
    GROUP BY 1, 2
    ORDER BY 1`;
  const meses: Record<string, Record<string, number | string>> = {};
  for (let i = 0; i < 12; i++) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - 11 + i, 1);
    const clave = `${d.getFullYear()}-${d.getMonth()}`;
    meses[clave] = { mes: new Intl.DateTimeFormat("es-GT", { month: "short", year: "2-digit" }).format(d) };
  }
  for (const f of filas) {
    if (!giros.includes(f.giro)) continue;
    const d = new Date(f.mes);
    const clave = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    if (meses[clave]) meses[clave][f.giro] = Math.round(f.total);
  }
  return {
    datos: Object.values(meses),
    series: giros.map((g) => ({ clave: g, nombre: GIROS[g].corto, color: GIROS[g].color })),
  };
}

/** `alertas` limita el conteo de alertas críticas a las que ve el usuario. */
export async function resumenOperativo(alertas: Prisma.AlertaWhereInput = {}) {
  const [camiones, maquinas, viajesActivos, solicitudesPendientes, ordenesProceso, alertasCriticas] = await Promise.all([
    prisma.camion.groupBy({ by: ["estado"], _count: true }),
    prisma.maquina.groupBy({ by: ["estado"], _count: true }),
    prisma.viaje.count({ where: { estado: { in: ["EN_CURSO", "PROGRAMADO"] } } }),
    prisma.solicitudMateriaPrima.count({ where: { estado: "PENDIENTE" } }),
    prisma.ordenProduccion.count({ where: { estado: "EN_PROCESO" } }),
    prisma.alerta.count({ where: { ...alertas, leida: false, severidad: "CRITICA" } }),
  ]);
  const cuenta = <T extends string>(arr: { estado: T; _count: number }[], estado: T) => arr.find((a) => a.estado === estado)?._count ?? 0;
  const totalCamiones = camiones.reduce((s, c) => s + c._count, 0);
  const totalMaquinas = maquinas.filter((m) => m.estado !== "VENDIDA").reduce((s, c) => s + c._count, 0);
  return {
    camiones: { total: totalCamiones, enRuta: cuenta(camiones, "EN_RUTA"), disponibles: cuenta(camiones, "DISPONIBLE"), mantenimiento: cuenta(camiones, "MANTENIMIENTO") },
    maquinas: { total: totalMaquinas, alquiladas: cuenta(maquinas, "ALQUILADA"), enProyecto: cuenta(maquinas, "EN_PROYECTO"), disponibles: cuenta(maquinas, "DISPONIBLE") },
    viajesActivos,
    solicitudesPendientes,
    ordenesProceso,
    alertasCriticas,
  };
}

export const GIROS_TODOS: GiroNegocio[] = [...GIROS_OPERATIVOS, "CORPORATIVO"];
