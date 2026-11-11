import "server-only";
import { prisma } from "@/lib/db";
import { esCorporativo, esInterno, puedeGestionarPedidos, puedeVerGiro, puedeVerReportes } from "@/lib/auth-rules";
import { filtroAlertas } from "@/lib/alertas";
import { CANALES_PEDIDO, CATEGORIAS_GASTO, ESTADOS_PEDIDO, GIROS, GIROS_OPERATIVOS, MODALIDADES, TIPOS_ALERTA } from "@/lib/constants";
import { aCSV, type ColumnaCSV } from "@/lib/csv";
import { toNumber } from "@/lib/utils";
import { ejecucionPresupuestaria } from "@/lib/services/finanzas";
import { ingresosDelMes } from "@/lib/services/dashboard";
import type { CategoriaGasto, EstadoPedido, GiroNegocio, Prisma, TipoViaje } from "@/app/generated/prisma/client";
import type { SessionPayload } from "@/lib/session";

/** Giros que el usuario puede consultar en reportes. */
export function girosDe(session: SessionPayload): GiroNegocio[] {
  if (esCorporativo(session)) return [...GIROS_OPERATIVOS, "CORPORATIVO"];
  return session.giro ? [session.giro] : [];
}

/** Periodo `AAAA-MM` (por omisión, el mes en curso). */
export function periodoDe(valor: string | null) {
  const m = valor?.match(/^(\d{4})-(\d{2})$/);
  const hoy = new Date();
  const anio = m ? Number(m[1]) : hoy.getFullYear();
  const mes = m ? Math.min(12, Math.max(1, Number(m[2]))) : hoy.getMonth() + 1;
  return { anio, mes, desde: new Date(anio, mes - 1, 1), hasta: new Date(anio, mes, 1) };
}

type Generado = { archivo: string; csv: string };
type Reporte = {
  /** Puede pedirlo el usuario; los datos se limitan además a sus giros. */
  permitido: (s: SessionPayload) => boolean;
  generar: (s: SessionPayload, p: URLSearchParams) => Promise<Generado>;
};

const csv = <T>(archivo: string, filas: T[], columnas: ColumnaCSV<T>[]): Generado => ({ archivo, csv: aCSV(filas, columnas) });
const ve = (...giros: GiroNegocio[]) => (s: SessionPayload) => esInterno(s) && giros.some((g) => puedeVerGiro(s, g));
const LIMITE = 5000;

export const REPORTES: Record<string, Reporte> = {
  gastos: {
    permitido: (s) => esInterno(s) && girosDe(s).length > 0,
    async generar(s, p) {
      const { anio, mes, desde, hasta } = periodoDe(p.get("periodo"));
      const giro = p.get("giro") as GiroNegocio | null;
      const categoria = p.get("categoria") as CategoriaGasto | null;
      const giros = girosDe(s).filter((g) => !giro || g === giro);
      const filas = await prisma.gasto.findMany({
        where: { giro: { in: giros }, fecha: { gte: desde, lt: hasta }, ...(categoria && categoria in CATEGORIAS_GASTO ? { categoria } : {}) },
        include: { sede: { select: { nombre: true } }, usuario: { select: { nombre: true } } },
        orderBy: { fecha: "asc" },
        take: LIMITE,
      });
      return csv(`gastos-${anio}-${String(mes).padStart(2, "0")}`, filas, [
        { titulo: "Fecha", valor: (g) => g.fecha },
        { titulo: "Giro", valor: (g) => GIROS[g.giro].nombre },
        { titulo: "Sede", valor: (g) => g.sede?.nombre },
        { titulo: "Categoría", valor: (g) => CATEGORIAS_GASTO[g.categoria] },
        { titulo: "Descripción", valor: (g) => g.descripcion },
        { titulo: "Documento", valor: (g) => g.documento },
        { titulo: "Monto (Q)", valor: (g) => toNumber(g.monto) },
        { titulo: "Registrado por", valor: (g) => g.usuario?.nombre },
      ]);
    },
  },

  presupuesto: {
    permitido: (s) => esInterno(s) && girosDe(s).length > 0,
    async generar(s, p) {
      const { anio, mes } = periodoDe(p.get("periodo"));
      const filas = await ejecucionPresupuestaria(anio, mes, girosDe(s));
      return csv(`presupuesto-${anio}-${String(mes).padStart(2, "0")}`, filas, [
        { titulo: "Giro", valor: (f) => GIROS[f.giro].nombre },
        { titulo: "Presupuesto (Q)", valor: (f) => f.presupuesto },
        { titulo: "Ejecutado (Q)", valor: (f) => f.ejecutado },
        { titulo: "Ejecución (%)", valor: (f) => Math.round(f.porcentaje * 10) / 10 },
        { titulo: "Disponible (Q)", valor: (f) => f.disponible },
        { titulo: "Nivel", valor: (f) => f.nivel },
      ]);
    },
  },

  viajes: {
    permitido: ve("TRANSPORTE_MP", "TRANSPORTE_PROD"),
    async generar(s, p) {
      const tipos: TipoViaje[] = [];
      if (puedeVerGiro(s, "TRANSPORTE_MP")) tipos.push("MATERIA_PRIMA");
      if (puedeVerGiro(s, "TRANSPORTE_PROD")) tipos.push("PRODUCTO");
      const tipo = p.get("tipo") as TipoViaje | null;
      const filas = await prisma.viaje.findMany({
        where: { tipo: tipo && tipos.includes(tipo) ? tipo : { in: tipos } },
        include: { cliente: { select: { nombre: true } }, camion: { select: { placa: true } }, piloto: { select: { nombre: true } } },
        orderBy: { fechaSalida: "desc" },
        take: LIMITE,
      });
      return csv("viajes", filas, [
        { titulo: "Código", valor: (v) => v.codigo },
        { titulo: "Tipo", valor: (v) => (v.tipo === "MATERIA_PRIMA" ? "Materia prima" : "Productos") },
        { titulo: "Modalidad", valor: (v) => MODALIDADES[v.modalidad] },
        { titulo: "Cliente", valor: (v) => v.cliente?.nombre ?? "Interno" },
        { titulo: "Origen", valor: (v) => v.origen },
        { titulo: "Destino", valor: (v) => v.destino },
        { titulo: "Carga", valor: (v) => v.carga },
        { titulo: "Toneladas", valor: (v) => toNumber(v.toneladas) },
        { titulo: "Distancia (km)", valor: (v) => v.distanciaKm },
        { titulo: "Tarifa (Q)", valor: (v) => toNumber(v.tarifa) },
        { titulo: "Estado", valor: (v) => v.estado },
        { titulo: "Salida", valor: (v) => v.fechaSalida },
        { titulo: "Entrega", valor: (v) => v.fechaEntrega },
        { titulo: "Camión", valor: (v) => v.camion.placa },
        { titulo: "Piloto", valor: (v) => v.piloto.nombre },
      ]);
    },
  },

  extraccion: {
    permitido: ve("EXTRACCION"),
    async generar() {
      const desde = new Date(Date.now() - 90 * 86_400_000);
      const filas = await prisma.registroExtraccion.findMany({
        where: { fecha: { gte: desde } },
        include: { sede: { select: { nombre: true } }, material: true },
        orderBy: { fecha: "desc" },
        take: LIMITE,
      });
      return csv("extraccion-90-dias", filas, [
        { titulo: "Fecha", valor: (r) => r.fecha },
        { titulo: "Planta", valor: (r) => r.sede.nombre },
        { titulo: "Material", valor: (r) => r.material.nombre },
        { titulo: "Turno", valor: (r) => r.turno },
        { titulo: "Toneladas", valor: (r) => toNumber(r.toneladas) },
        { titulo: "Valor de referencia (Q)", valor: (r) => toNumber(r.toneladas) * toNumber(r.material.precioRef) },
      ]);
    },
  },

  produccion: {
    permitido: ve("PROCESO"),
    async generar() {
      const filas = await prisma.ordenProduccion.findMany({ include: { producto: true, sede: { select: { nombre: true } } }, orderBy: { fechaInicio: "desc" }, take: LIMITE });
      return csv("ordenes-de-produccion", filas, [
        { titulo: "Código", valor: (o) => o.codigo },
        { titulo: "Producto", valor: (o) => o.producto.nombre },
        { titulo: "Planta", valor: (o) => o.sede.nombre },
        { titulo: "Cantidad", valor: (o) => toNumber(o.cantidad) },
        { titulo: "Unidad", valor: (o) => o.producto.unidad },
        { titulo: "Valor (Q)", valor: (o) => toNumber(o.cantidad) * toNumber(o.producto.precio) },
        { titulo: "Estado", valor: (o) => o.estado },
        { titulo: "Inicio", valor: (o) => o.fechaInicio },
        { titulo: "Fin", valor: (o) => o.fechaFin },
      ]);
    },
  },

  alquileres: {
    permitido: ve("MAQUINARIA"),
    async generar() {
      const filas = await prisma.contratoAlquiler.findMany({ include: { maquina: true, cliente: true }, orderBy: { fechaInicio: "desc" }, take: LIMITE });
      return csv("alquileres-de-maquinaria", filas, [
        { titulo: "Contrato", valor: (c) => c.codigo },
        { titulo: "Máquina", valor: (c) => `${c.maquina.codigo} ${c.maquina.tipo}` },
        { titulo: "Cliente", valor: (c) => c.cliente.nombre },
        { titulo: "Inicio", valor: (c) => c.fechaInicio },
        { titulo: "Fin", valor: (c) => c.fechaFin },
        { titulo: "Tarifa diaria (Q)", valor: (c) => toNumber(c.tarifaDiaria) },
        { titulo: "Total (Q)", valor: (c) => toNumber(c.total) },
        { titulo: "Depósito (Q)", valor: (c) => toNumber(c.deposito) },
        { titulo: "Estado", valor: (c) => c.estado },
      ]);
    },
  },

  pedidos: {
    permitido: (s) => esCorporativo(s) || puedeGestionarPedidos(s),
    async generar(_s, p) {
      const estado = p.get("estado") as EstadoPedido | null;
      const filas = await prisma.pedido.findMany({
        where: estado && estado in ESTADOS_PEDIDO ? { estado } : {},
        include: { cliente: { select: { nombre: true } }, planta: { select: { nombre: true } }, items: { include: { producto: { select: { codigo: true } } } } },
        orderBy: { createdAt: "desc" },
        take: LIMITE,
      });
      return csv("pedidos", filas, [
        { titulo: "Código", valor: (x) => x.codigo },
        { titulo: "Solicitante", valor: (x) => x.cliente?.nombre ?? (x.giroSolicitante ? GIROS[x.giroSolicitante].nombre : "") },
        { titulo: "Canal", valor: (x) => CANALES_PEDIDO[x.canal] },
        { titulo: "Estado", valor: (x) => ESTADOS_PEDIDO[x.estado] },
        { titulo: "Productos", valor: (x) => x.items.map((i) => `${i.producto.codigo} x ${toNumber(i.cantidad)}`).join(" | ") },
        { titulo: "Total (Q)", valor: (x) => toNumber(x.total) },
        { titulo: "Fecha requerida", valor: (x) => x.fechaRequerida },
        { titulo: "Planta", valor: (x) => x.planta?.nombre },
        { titulo: "Creado", valor: (x) => x.createdAt },
      ]);
    },
  },

  alertas: {
    permitido: esInterno,
    async generar(s) {
      const filas = await prisma.alerta.findMany({
        where: { ...filtroAlertas(s), createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
        orderBy: { createdAt: "desc" },
        take: LIMITE,
      });
      return csv("alertas-30-dias", filas, [
        { titulo: "Fecha", valor: (a) => a.createdAt },
        { titulo: "Tipo", valor: (a) => TIPOS_ALERTA[a.tipo] },
        { titulo: "Severidad", valor: (a) => a.severidad },
        { titulo: "Giro", valor: (a) => GIROS[a.giro].nombre },
        { titulo: "Alerta", valor: (a) => a.titulo },
        { titulo: "Detalle", valor: (a) => a.mensaje },
        { titulo: "Atendida", valor: (a) => a.leida },
      ]);
    },
  },

  inventario: {
    permitido: ve("EXTRACCION", "PROCESO"),
    async generar(s) {
      const giros = (["EXTRACCION", "PROCESO"] as GiroNegocio[]).filter((g) => puedeVerGiro(s, g));
      const filas = await prisma.inventario.findMany({ where: { sede: { giro: { in: giros } } }, include: { sede: true, material: true }, orderBy: [{ sedeId: "asc" }, { materialId: "asc" }] });
      return csv("inventario", filas, [
        { titulo: "Sede", valor: (i) => i.sede.nombre },
        { titulo: "Material", valor: (i) => i.material.nombre },
        { titulo: "Existencia", valor: (i) => toNumber(i.cantidad) },
        { titulo: "Unidad", valor: (i) => i.material.unidad },
        { titulo: "Mínimo", valor: (i) => toNumber(i.material.stockMinimo) },
        { titulo: "Bajo el mínimo", valor: (i) => toNumber(i.cantidad) < toNumber(i.material.stockMinimo) },
      ]);
    },
  },

  consolidado: {
    permitido: puedeVerReportes,
    async generar(s, p) {
      const { anio, mes } = periodoDe(p.get("periodo"));
      const r = await reporteConsolidado(anio, mes, girosDe(s));
      return csv(`consolidado-${anio}-${String(mes).padStart(2, "0")}`, r.porGiro, [
        { titulo: "Giro", valor: (f) => GIROS[f.giro].nombre },
        { titulo: "Ingresos (Q)", valor: (f) => f.ingresos },
        { titulo: "Presupuesto (Q)", valor: (f) => f.presupuesto },
        { titulo: "Gasto (Q)", valor: (f) => f.ejecutado },
        { titulo: "Ejecución (%)", valor: (f) => Math.round(f.porcentaje * 10) / 10 },
        { titulo: "Resultado (Q)", valor: (f) => f.resultado },
      ]);
    },
  },

  "estado-de-cuenta": {
    permitido: (s) => s.rol === "CLIENTE" && !!s.clienteId,
    async generar(s, p) {
      const anio = Number(p.get("anio")) || new Date().getFullYear();
      const movimientos = await estadoDeCuenta(s.clienteId!, anio);
      return csv(`estado-de-cuenta-${anio}`, movimientos, [
        { titulo: "Fecha", valor: (m) => m.fecha },
        { titulo: "Empresa", valor: (m) => m.empresa },
        { titulo: "Concepto", valor: (m) => m.concepto },
        { titulo: "Documento", valor: (m) => m.documento },
        { titulo: "Estado", valor: (m) => m.estado },
        { titulo: "Monto (Q)", valor: (m) => m.monto },
      ]);
    },
  },
};

// ─── Reporte consolidado para la sede central ──────────────────────────────

export async function reporteConsolidado(anio: number, mes: number, giros: GiroNegocio[]) {
  const desde = new Date(anio, mes - 1, 1);
  const hasta = new Date(anio, mes, 1);
  const rango = { gte: desde, lt: hasta };
  const ref = new Date(anio, mes - 1, 15);

  const [ingresos, ejecucion, extraido, produccion, viajes, alquileres, ventas, obras, pedidos, reuniones, alertas, clientes] = await Promise.all([
    ingresosDelMes(ref),
    ejecucionPresupuestaria(anio, mes, giros),
    prisma.registroExtraccion.aggregate({ where: { fecha: rango }, _sum: { toneladas: true } }),
    prisma.ordenProduccion.aggregate({ where: { estado: "COMPLETADA", fechaFin: rango }, _count: true }),
    prisma.viaje.groupBy({ by: ["tipo"], where: { estado: "ENTREGADO", fechaEntrega: rango }, _count: true, _sum: { distanciaKm: true, toneladas: true } }),
    prisma.contratoAlquiler.count({ where: { fechaInicio: rango, estado: { not: "CANCELADO" } } }),
    prisma.ventaMaquina.count({ where: { fecha: rango } }),
    prisma.proyectoConstruccion.findMany({ where: { estado: { in: ["PLANIFICACION", "EN_EJECUCION", "PAUSADO"] } }, select: { avance: true } }),
    prisma.pedido.aggregate({ where: { estado: "ENTREGADO", updatedAt: rango }, _count: true, _sum: { total: true } }),
    prisma.reunion.count({ where: { estado: "REALIZADA", fecha: rango } }),
    prisma.alerta.groupBy({ by: ["tipo"], where: { createdAt: rango, giro: { in: giros }, clienteId: null }, _count: true }),
    principalesClientes(rango),
  ]);

  // Construcción factura por estimaciones de obra, que el sistema no registra: su "ingreso" en el panel
  // es la cartera vigente, así que no se mezcla con los ingresos del mes
  const ingresoDe = (g: GiroNegocio) => (g === "CONSTRUCCION" || !(g in ingresos) ? 0 : (ingresos as unknown as Record<string, number>)[g]);
  const porGiro = ejecucion.map((e) => ({ ...e, ingresos: ingresoDe(e.giro), resultado: ingresoDe(e.giro) - e.ejecutado }));
  const total = porGiro.reduce(
    (s, f) => ({ ingresos: s.ingresos + f.ingresos, presupuesto: s.presupuesto + f.presupuesto, ejecutado: s.ejecutado + f.ejecutado }),
    { ingresos: 0, presupuesto: 0, ejecutado: 0 },
  );
  const viaje = (t: TipoViaje) => viajes.find((v) => v.tipo === t);

  return {
    porGiro,
    total: { ...total, resultado: total.ingresos - total.ejecutado },
    operacion: {
      toneladasExtraidas: toNumber(extraido._sum.toneladas),
      ordenesCompletadas: produccion._count,
      viajesMP: viaje("MATERIA_PRIMA")?._count ?? 0,
      viajesProductos: viaje("PRODUCTO")?._count ?? 0,
      kilometros: viajes.reduce((s, v) => s + (v._sum.distanciaKm ?? 0), 0),
      alquileres,
      ventasMaquinaria: ventas,
      obrasActivas: obras.length,
      carteraObras: ingresos.CONSTRUCCION,
      avancePromedio: obras.length ? Math.round(obras.reduce((s, o) => s + o.avance, 0) / obras.length) : 0,
      pedidosEntregados: pedidos._count,
      ventasPedidos: toNumber(pedidos._sum.total),
      reunionesRealizadas: reuniones,
    },
    alertas: alertas.map((a) => ({ tipo: TIPOS_ALERTA[a.tipo], cantidad: a._count })).sort((a, b) => b.cantidad - a.cantidad),
    clientes,
  };
}

/** Clientes con mayor facturación del periodo en todas las subempresas. */
async function principalesClientes(rango: Prisma.DateTimeFilter) {
  const [viajes, alquileres, ventas, pedidos] = await Promise.all([
    prisma.viaje.groupBy({ by: ["clienteId"], where: { estado: "ENTREGADO", fechaEntrega: rango, clienteId: { not: null } }, _sum: { tarifa: true } }),
    prisma.contratoAlquiler.groupBy({ by: ["clienteId"], where: { fechaInicio: rango, estado: { not: "CANCELADO" } }, _sum: { total: true } }),
    prisma.ventaMaquina.groupBy({ by: ["clienteId"], where: { fecha: rango }, _sum: { precio: true } }),
    prisma.pedido.groupBy({ by: ["clienteId"], where: { estado: "ENTREGADO", updatedAt: rango, clienteId: { not: null } }, _sum: { total: true } }),
  ]);
  const totales = new Map<number, number>();
  const sumar = (id: number | null, monto: unknown) => id && totales.set(id, (totales.get(id) ?? 0) + toNumber(monto as number));
  viajes.forEach((v) => sumar(v.clienteId, v._sum.tarifa));
  alquileres.forEach((a) => sumar(a.clienteId, a._sum.total));
  ventas.forEach((v) => sumar(v.clienteId, v._sum.precio));
  pedidos.forEach((p) => sumar(p.clienteId, p._sum.total));
  const top = [...totales].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const nombres = await prisma.cliente.findMany({ where: { id: { in: top.map(([id]) => id) } }, select: { id: true, nombre: true } });
  return top.map(([id, monto]) => ({ id, nombre: nombres.find((n) => n.id === id)?.nombre ?? `Cliente ${id}`, monto }));
}

// ─── Estado de cuenta de un cliente (portal) ───────────────────────────────

export async function estadoDeCuenta(clienteId: number, anio: number) {
  const rango = { gte: new Date(anio, 0, 1), lt: new Date(anio + 1, 0, 1) };
  const [viajes, contratos, compras, pedidos] = await Promise.all([
    prisma.viaje.findMany({ where: { clienteId, fechaSalida: rango, estado: { not: "CANCELADO" } }, orderBy: { fechaSalida: "asc" } }),
    prisma.contratoAlquiler.findMany({ where: { clienteId, fechaInicio: rango }, include: { maquina: true }, orderBy: { fechaInicio: "asc" } }),
    prisma.ventaMaquina.findMany({ where: { clienteId, fecha: rango }, include: { maquina: true } }),
    prisma.pedido.findMany({ where: { clienteId, createdAt: rango, estado: { not: "CANCELADO" } } }),
  ]);
  const movimientos = [
    ...viajes.map((v) => ({
      fecha: v.fechaEntrega ?? v.fechaSalida,
      empresa: GIROS[v.tipo === "MATERIA_PRIMA" ? "TRANSPORTE_MP" : "TRANSPORTE_PROD"].nombre,
      concepto: `Flete ${v.origen} → ${v.destino} (${v.carga})`,
      documento: v.codigo,
      estado: v.estado,
      monto: toNumber(v.tarifa),
    })),
    ...contratos.map((c) => ({ fecha: c.fechaInicio, empresa: GIROS.MAQUINARIA.nombre, concepto: `Alquiler ${c.maquina.tipo} ${c.maquina.codigo}`, documento: c.codigo, estado: c.estado, monto: toNumber(c.total) })),
    ...compras.map((v) => ({ fecha: v.fecha, empresa: GIROS.MAQUINARIA.nombre, concepto: `Compra ${v.maquina.tipo} ${v.maquina.marca} ${v.maquina.modelo}`, documento: v.codigo, estado: "VENDIDA", monto: toNumber(v.precio) })),
    ...pedidos.map((p) => ({ fecha: p.createdAt, empresa: GIROS.PROCESO.nombre, concepto: "Pedido de productos", documento: p.codigo, estado: p.estado, monto: toNumber(p.total) })),
  ];
  return movimientos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
}
