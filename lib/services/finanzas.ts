import "server-only";
import { prisma } from "@/lib/db";
import { crearAlerta } from "@/lib/services/alertas";
import { GIROS, GIROS_OPERATIVOS } from "@/lib/constants";
import { evaluarPresupuesto, umbralCruzado } from "@/lib/reglas";
import { formatQ, toNumber } from "@/lib/utils";
import type { CategoriaGasto, GiroNegocio, Prisma } from "@/app/generated/prisma/client";

function rangoMes(anio: number, mes: number) {
  return { gte: new Date(anio, mes - 1, 1), lt: new Date(anio, mes, 1) };
}

export async function totalGastado(giro: GiroNegocio, anio: number, mes: number, tx: Prisma.TransactionClient = prisma) {
  const r = await tx.gasto.aggregate({
    where: { giro, fecha: rangoMes(anio, mes) },
    _sum: { monto: true },
  });
  return toNumber(r._sum.monto);
}

/** Ejecución presupuestaria del mes para los giros indicados. */
export async function ejecucionPresupuestaria(anio: number, mes: number, giros: GiroNegocio[] = [...GIROS_OPERATIVOS, "CORPORATIVO"]) {
  const [presupuestos, gastos] = await Promise.all([
    prisma.presupuesto.findMany({ where: { anio, mes, giro: { in: giros } } }),
    prisma.gasto.groupBy({
      by: ["giro"],
      where: { fecha: rangoMes(anio, mes), giro: { in: giros } },
      _sum: { monto: true },
    }),
  ]);
  return giros.map((giro) => {
    const presupuesto = toNumber(presupuestos.find((p) => p.giro === giro)?.monto);
    const ejecutado = toNumber(gastos.find((g) => g.giro === giro)?._sum.monto);
    return { giro, nombre: GIROS[giro].corto, color: GIROS[giro].color, presupuesto, ejecutado, ...evaluarPresupuesto(presupuesto, ejecutado) };
  });
}

/**
 * Registra un gasto y genera alerta si se cruza el 80 % o 100 % del presupuesto.
 * `junto` permite actualizar otro registro dentro de la misma transacción
 * (p. ej. el costo ejecutado de una obra).
 */
export async function registrarGasto(
  data: {
    giro: GiroNegocio;
    sedeId?: number | null;
    categoria: CategoriaGasto;
    descripcion: string;
    monto: number;
    fecha: Date;
    documento?: string | null;
    usuarioId?: number;
  },
  junto?: (tx: Prisma.TransactionClient) => Promise<unknown>,
) {
  const anio = data.fecha.getFullYear();
  const mes = data.fecha.getMonth() + 1;

  return prisma.$transaction(async (tx) => {
    const antes = await totalGastado(data.giro, anio, mes, tx);
    const gasto = await tx.gasto.create({ data });
    if (junto) await junto(tx);
    const presupuesto = await tx.presupuesto.findUnique({ where: { giro_anio_mes: { giro: data.giro, anio, mes } } });
    const monto = toNumber(presupuesto?.monto);
    const umbral = umbralCruzado(monto, antes, antes + data.monto);
    if (umbral) {
      await crearAlerta({
        tipo: umbral,
        severidad: umbral === "PRESUPUESTO_100" ? "CRITICA" : "ADVERTENCIA",
        giro: data.giro,
        titulo: `${GIROS[data.giro].nombre}: presupuesto ${umbral === "PRESUPUESTO_100" ? "excedido" : "al 80 %"}`,
        mensaje: `Ejecutado ${formatQ(antes + data.monto)} de ${formatQ(monto)} en ${String(mes).padStart(2, "0")}/${anio}.`,
        referencia: `presupuesto:${data.giro}:${anio}-${mes}`,
      }, tx);
    }
    return gasto;
  });
}

/**
 * Asigna el presupuesto mensual de varios giros. Si con el nuevo monto el gasto
 * ya ejecutado supera el 80 % o el 100 %, se genera la alerta correspondiente
 * (una sola vez por giro, periodo y umbral).
 */
export async function definirPresupuestos(anio: number, mes: number, montos: Partial<Record<GiroNegocio, number>>) {
  const entradas = Object.entries(montos) as [GiroNegocio, number][];
  return prisma.$transaction(async (tx) => {
    let alertas = 0;
    for (const [giro, monto] of entradas) {
      await tx.presupuesto.upsert({
        where: { giro_anio_mes: { giro, anio, mes } },
        update: { monto },
        create: { giro, anio, mes, monto },
      });
      const ejecutado = await totalGastado(giro, anio, mes, tx);
      const { nivel } = evaluarPresupuesto(monto, ejecutado);
      if (nivel === "NORMAL") continue;
      const tipo = nivel === "EXCEDIDO" ? "PRESUPUESTO_100" : "PRESUPUESTO_80";
      const referencia = `presupuesto:${giro}:${anio}-${mes}`;
      if (await tx.alerta.findFirst({ where: { tipo, referencia } })) continue;
      await crearAlerta({
        tipo,
        severidad: tipo === "PRESUPUESTO_100" ? "CRITICA" : "ADVERTENCIA",
        giro,
        titulo: `${GIROS[giro].nombre}: presupuesto ${tipo === "PRESUPUESTO_100" ? "excedido" : "al 80 %"}`,
        mensaje: `Con el nuevo presupuesto de ${formatQ(monto)}, lo ejecutado (${formatQ(ejecutado)}) ya supera el umbral en ${String(mes).padStart(2, "0")}/${anio}.`,
        referencia,
      }, tx);
      alertas++;
    }
    return { giros: entradas.length, alertas };
  });
}
