/**
 * Reglas de negocio puras (sin acceso a base de datos).
 * Se mantienen aisladas para poder probarlas de forma unitaria.
 */
import { REGLAS } from "@/lib/constants";
import { diasEntre } from "@/lib/utils";
import type { EstadoPedido } from "@/app/generated/prisma/client";

// ─── Presupuesto ───────────────────────────────────────────────────────────

export type NivelPresupuesto = "NORMAL" | "ADVERTENCIA" | "EXCEDIDO";

export function evaluarPresupuesto(presupuesto: number, ejecutado: number) {
  const porcentaje = presupuesto > 0 ? (ejecutado / presupuesto) * 100 : ejecutado > 0 ? 100 : 0;
  let nivel: NivelPresupuesto = "NORMAL";
  if (porcentaje >= 100) nivel = "EXCEDIDO";
  else if (porcentaje >= REGLAS.umbralPresupuestoAdvertencia * 100) nivel = "ADVERTENCIA";
  return {
    porcentaje,
    nivel,
    disponible: presupuesto - ejecutado,
  };
}

/**
 * Determina si un nuevo gasto hace cruzar un umbral (80 % o 100 %).
 * Solo devuelve el umbral cuando se cruza por primera vez, para no repetir alertas.
 */
export function umbralCruzado(presupuesto: number, antes: number, despues: number) {
  if (presupuesto <= 0) return null;
  const limite80 = presupuesto * REGLAS.umbralPresupuestoAdvertencia;
  if (antes < presupuesto && despues >= presupuesto) return "PRESUPUESTO_100" as const;
  if (antes < limite80 && despues >= limite80) return "PRESUPUESTO_80" as const;
  return null;
}

// ─── Alquiler de maquinaria ────────────────────────────────────────────────

export function calcularAlquiler(tarifaDiaria: number, inicio: Date, fin: Date) {
  if (fin < inicio) throw new Error("La fecha de fin debe ser posterior a la de inicio");
  const dias = diasEntre(inicio, fin);
  // Descuento por volumen: 10 % desde 30 días, 5 % desde 7 días
  const descuento = dias >= 30 ? 0.1 : dias >= 7 ? 0.05 : 0;
  const subtotal = tarifaDiaria * dias;
  const total = Math.round(subtotal * (1 - descuento) * 100) / 100;
  return { dias, subtotal, descuento, total };
}

export function rangosSeSolapan(aInicio: Date, aFin: Date, bInicio: Date, bFin: Date) {
  return aInicio <= bFin && bInicio <= aFin;
}

// ─── Transporte ────────────────────────────────────────────────────────────

/** Tarifa de flete: base por km + recargo por tonelada y modalidad. */
export function calcularTarifaViaje(
  distanciaKm: number,
  toneladas: number,
  modalidad: "NACIONAL" | "INTER_PUERTOS" | "INTER_FRONTERAS" | "PUERTO_A_BODEGA" | "BODEGA_A_PUERTO",
) {
  const porKm = 12; // Q por km
  const porTonKm = 0.85; // Q por tonelada-km
  const recargo = { NACIONAL: 1, INTER_PUERTOS: 1.15, INTER_FRONTERAS: 1.35, PUERTO_A_BODEGA: 1.1, BODEGA_A_PUERTO: 1.1 }[modalidad];
  return Math.round((distanciaKm * porKm + distanciaKm * toneladas * porTonKm) * recargo * 100) / 100;
}

export function validarCapacidad(capacidadTon: number, toneladas: number) {
  return toneladas > 0 && toneladas <= capacidadTon;
}

// ─── Producción ────────────────────────────────────────────────────────────

export type Requerimiento = { materialId: number; nombre: string; requerido: number; disponible: number };

/** Calcula los insumos que necesita una orden y cuáles faltan en inventario. */
export function calcularRequerimientos(
  cantidad: number,
  receta: { materialId: number; nombre: string; cantidadPorUnidad: number }[],
  inventario: Map<number, number>,
) {
  const requerimientos: Requerimiento[] = receta.map((r) => ({
    materialId: r.materialId,
    nombre: r.nombre,
    requerido: Math.round(r.cantidadPorUnidad * cantidad * 100) / 100,
    disponible: inventario.get(r.materialId) ?? 0,
  }));
  const faltantes = requerimientos.filter((r) => r.disponible < r.requerido);
  return { requerimientos, faltantes, factible: faltantes.length === 0 };
}

// ─── Monitoreo GPS ─────────────────────────────────────────────────────────

export type LecturaSimple = { velocidad: number; motorEncendido: boolean; timestamp: Date };

export type ResultadoGPS = {
  excesoVelocidad: boolean;
  horasUsoContinuo: number;
  usoExcesivo: boolean;
};

/**
 * Evalúa una lectura nueva contra el historial reciente (ordenado ascendente).
 * - Exceso de velocidad: supera el límite configurado.
 * - Uso excesivo: motor encendido de forma continua más horas que el máximo.
 */
export function evaluarLecturaGPS(
  nueva: LecturaSimple,
  historial: LecturaSimple[],
  esCamion: boolean,
): ResultadoGPS {
  const excesoVelocidad = esCamion && nueva.velocidad > REGLAS.velocidadMaximaCamion;

  let inicioContinuo: Date | null = nueva.motorEncendido ? nueva.timestamp : null;
  if (nueva.motorEncendido) {
    for (let i = historial.length - 1; i >= 0; i--) {
      if (!historial[i].motorEncendido) break;
      inicioContinuo = historial[i].timestamp;
    }
  }
  const horasUsoContinuo = inicioContinuo
    ? (nueva.timestamp.getTime() - inicioContinuo.getTime()) / 3_600_000
    : 0;

  return {
    excesoVelocidad,
    horasUsoContinuo,
    usoExcesivo: horasUsoContinuo > REGLAS.horasUsoContinuoMax,
  };
}

/** Distancia en km entre dos coordenadas (fórmula de Haversine). */
export function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Horas de reloj completas cruzadas entre dos instantes. Sumar este valor en cada
 * lectura con motor encendido da el total exacto de horas de uso usando enteros.
 */
export function horasCruzadas(desde: Date, hasta: Date) {
  return Math.max(0, Math.floor(hasta.getTime() / 3_600_000) - Math.floor(desde.getTime() / 3_600_000));
}

// ─── Construcción ──────────────────────────────────────────────────────────

/** Avance ponderado de un proyecto según el peso de sus hitos completados. */
export function calcularAvance(hitos: { peso: number; completado: boolean }[]) {
  const total = hitos.reduce((s, h) => s + h.peso, 0);
  if (total === 0) return 0;
  const hecho = hitos.filter((h) => h.completado).reduce((s, h) => s + h.peso, 0);
  return Math.round((hecho / total) * 100);
}

/** Avance esperado (%) según el tiempo transcurrido del plazo contractual. */
export function avanceEsperado(inicio: Date, fin: Date, ahora = new Date()) {
  const total = fin.getTime() - inicio.getTime();
  if (total <= 0) return 100;
  return Math.min(100, Math.max(0, ((ahora.getTime() - inicio.getTime()) / total) * 100));
}

/** Rezagada: el avance real está más de `tolerancia` puntos por debajo del esperado. */
export function estaRezagada(avance: number, esperado: number, tolerancia = 15) {
  return avance + tolerancia < esperado;
}

// ─── Comercial: pedidos y reuniones ────────────────────────────────────────

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Líneas y total de un pedido con el precio de catálogo; agrupa productos repetidos. */
export function calcularPedido(items: { productoId: number; cantidad: number }[], precios: Map<number, number>) {
  const cantidades = new Map<number, number>();
  for (const item of items) {
    if (!(item.cantidad > 0)) throw new Error("Las cantidades deben ser mayores a 0");
    cantidades.set(item.productoId, (cantidades.get(item.productoId) ?? 0) + item.cantidad);
  }
  if (!cantidades.size) throw new Error("El pedido no tiene productos");
  const lineas = [...cantidades].map(([productoId, cantidad]) => {
    const precioUnitario = precios.get(productoId);
    if (precioUnitario === undefined) throw new Error(`El producto ${productoId} no está disponible`);
    return { productoId, cantidad: redondear(cantidad), precioUnitario, subtotal: redondear(cantidad * precioUnitario) };
  });
  return { lineas, total: redondear(lineas.reduce((s, l) => s + l.subtotal, 0)) };
}

export type AccionPedido = "confirmar" | "preparar" | "despachar" | "entregar" | "cancelar";

const TRANSICIONES: Record<AccionPedido, { desde: EstadoPedido[]; hacia: EstadoPedido; verbo: string }> = {
  confirmar: { desde: ["SOLICITADO"], hacia: "CONFIRMADO", verbo: "confirmar" },
  preparar: { desde: ["CONFIRMADO"], hacia: "EN_PREPARACION", verbo: "preparar" },
  despachar: { desde: ["EN_PREPARACION"], hacia: "DESPACHADO", verbo: "despachar" },
  entregar: { desde: ["DESPACHADO"], hacia: "ENTREGADO", verbo: "entregar" },
  cancelar: { desde: ["SOLICITADO", "CONFIRMADO", "EN_PREPARACION"], hacia: "CANCELADO", verbo: "cancelar" },
};

/**
 * Estado siguiente de un pedido. La empresa avanza el pedido paso a paso y puede
 * cancelarlo hasta la preparación; el cliente solo cancela lo que aún no se confirma.
 */
export function transicionPedido(estado: EstadoPedido, accion: AccionPedido, porCliente = false): EstadoPedido {
  const t = TRANSICIONES[accion];
  if (porCliente && accion !== "cancelar") throw new Error("El cliente solo puede cancelar sus pedidos");
  const desde = porCliente ? (["SOLICITADO"] as EstadoPedido[]) : t.desde;
  if (!desde.includes(estado)) {
    throw new Error(`No se puede ${t.verbo} un pedido en estado ${estado.toLowerCase().replace("_", " ")}`);
  }
  return t.hacia;
}

/**
 * Vendedor para una reunión: el del cliente si atiende el giro; si no, el que tiene
 * menos reuniones pendientes (a igualdad, el más antiguo).
 */
export function elegirVendedor(candidatos: { id: number; pendientes: number }[], preferido?: number | null) {
  if (preferido != null && candidatos.some((c) => c.id === preferido)) return preferido;
  if (!candidatos.length) return null;
  return [...candidatos].sort((a, b) => a.pendientes - b.pendientes || a.id - b.id)[0].id;
}

// ─── Recordatorios ─────────────────────────────────────────────────────────

const diaGT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guatemala", year: "numeric", month: "2-digit", day: "2-digit" });

/** Día calendario en Guatemala (AAAA-MM-DD), independiente de la zona horaria del servidor. */
export function claveDia(fecha: Date) {
  return diaGT.format(fecha);
}

/** Días calendario de Guatemala desde hoy hasta la fecha (0 = hoy, negativo = ya pasó). */
export function diasHasta(fecha: Date, ahora = new Date()) {
  return Math.round((Date.parse(claveDia(fecha)) - Date.parse(claveDia(ahora))) / 86_400_000);
}
