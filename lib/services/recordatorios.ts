import "server-only";
import { prisma } from "@/lib/db";
import { GIROS } from "@/lib/constants";
import { claveDia, diasHasta, plazoTexto } from "@/lib/reglas";
import { formatFecha, toNumber } from "@/lib/utils";
import { crearAlerta, type NuevaAlerta } from "@/lib/services/alertas";
import type { GiroNegocio } from "@/app/generated/prisma/client";

/**
 * Recordatorios diarios para empleados y clientes. Se ejecuta una vez al día (cron) y es
 * idempotente: cada recordatorio lleva la fecha en su referencia y no se repite ese día.
 */
export async function generarRecordatorios(ahora = new Date()) {
  const hoy = claveDia(ahora);
  const ref = (clase: string, id: string | number) => `recordatorio:${clase}:${id}:${hoy}`;
  const enDias = (n: number) => new Date(ahora.getTime() + n * 86_400_000);
  const candidatos: NuevaAlerta[] = [];

  const [contratos, solicitudes, hitos, reuniones, viajes, pedidos] = await Promise.all([
    prisma.contratoAlquiler.findMany({ where: { estado: "ACTIVO", fechaFin: { lte: enDias(4) } }, include: { cliente: true, maquina: true } }),
    prisma.solicitudMateriaPrima.findMany({
      where: { estado: { in: ["PENDIENTE", "APROBADA", "EN_TRANSITO"] }, fechaRequerida: { lte: enDias(3) } },
      include: { material: true, planta: { select: { nombre: true } } },
    }),
    prisma.hitoProyecto.findMany({
      where: { completado: false, fechaMeta: { lt: ahora }, proyecto: { estado: { not: "FINALIZADO" } } },
      include: { proyecto: { select: { id: true, codigo: true, nombre: true } } },
    }),
    prisma.reunion.findMany({ where: { estado: "CONFIRMADA", fecha: { gte: ahora, lte: enDias(2) } } }),
    prisma.viaje.findMany({ where: { estado: "PROGRAMADO", fechaSalida: { gte: ahora, lte: enDias(2) } } }),
    prisma.pedido.findMany({ where: { estado: "SOLICITADO", createdAt: { lt: enDias(-1) } }, select: { id: true, codigo: true } }),
  ]);

  // Contratos de alquiler por vencer o vencidos sin devolver
  for (const c of contratos) {
    const dias = diasHasta(c.fechaFin, ahora);
    if (dias > 3) continue;
    candidatos.push({
      tipo: "RECORDATORIO",
      severidad: dias < 0 ? "CRITICA" : "ADVERTENCIA",
      giro: "MAQUINARIA",
      rolesDestino: ["GERENTE", "OPERADOR", "VENDEDOR"],
      titulo: `Contrato ${c.codigo} ${plazoTexto(dias)}`,
      mensaje: `${c.maquina.tipo} ${c.maquina.codigo} alquilada a ${c.cliente.nombre}; devolución el ${formatFecha(c.fechaFin)}.`,
      referencia: ref("contrato", c.id),
    });
    if (dias >= 0) {
      candidatos.push({
        tipo: "RECORDATORIO",
        severidad: "INFO",
        giro: "MAQUINARIA",
        clienteId: c.clienteId,
        titulo: `Su alquiler ${c.codigo} ${plazoTexto(dias)}`,
        mensaje: `Devolución de ${c.maquina.tipo} ${c.maquina.codigo} el ${formatFecha(c.fechaFin)}. Si necesita extenderlo, escríbanos desde el portal.`,
        referencia: ref("contrato-cliente", c.id),
      });
    }
  }

  // Materia prima que una planta necesita pronto: se recuerda al giro que debe actuar
  const RESPONSABLE: Record<string, { giro: GiroNegocio; pendiente: string }> = {
    PENDIENTE: { giro: "EXTRACCION", pendiente: "está por aprobar" },
    APROBADA: { giro: "TRANSPORTE_MP", pendiente: "no tiene traslado programado" },
    EN_TRANSITO: { giro: "TRANSPORTE_MP", pendiente: "sigue en tránsito" },
  };
  for (const s of solicitudes) {
    const dias = diasHasta(s.fechaRequerida, ahora);
    if (dias > 2) continue;
    const r = RESPONSABLE[s.estado];
    candidatos.push({
      tipo: "RECORDATORIO",
      severidad: dias < 0 ? "CRITICA" : "ADVERTENCIA",
      giro: r.giro,
      rolesDestino: ["GERENTE", "OPERADOR"],
      titulo: `Materia prima ${s.codigo}: la fecha requerida ${plazoTexto(dias).replace("vence", "es").replace("venció", "fue")}`,
      mensaje: `${toNumber(s.toneladas)} t de ${s.material.nombre} para ${s.planta.nombre} ${r.pendiente}.`,
      referencia: ref("solicitud", s.id),
    });
  }

  // Hitos de obra vencidos, agrupados por obra
  const porObra = new Map<number, { codigo: string; nombre: string; hitos: string[] }>();
  for (const h of hitos) {
    const o = porObra.get(h.proyecto.id) ?? { codigo: h.proyecto.codigo, nombre: h.proyecto.nombre, hitos: [] };
    o.hitos.push(h.nombre);
    porObra.set(h.proyecto.id, o);
  }
  for (const [id, o] of porObra) {
    candidatos.push({
      tipo: "RECORDATORIO",
      severidad: "ADVERTENCIA",
      giro: "CONSTRUCCION",
      rolesDestino: ["GERENTE"],
      titulo: `Obra ${o.codigo}: ${o.hitos.length} hito${o.hitos.length === 1 ? "" : "s"} vencido${o.hitos.length === 1 ? "" : "s"}`,
      mensaje: `${o.nombre}: ${o.hitos.slice(0, 3).join(", ")}${o.hitos.length > 3 ? "…" : ""}.`,
      referencia: ref("hito", `${id}-${o.hitos.length}`),
    });
  }

  // Reuniones confirmadas para mañana: vendedor y cliente
  for (const r of reuniones) {
    if (diasHasta(r.fecha, ahora) !== 1) continue;
    const lugar = r.modalidad === "PRESENCIAL" ? "en el Edificio Sixtino, zona 10" : "por videoconferencia";
    if (r.vendedorId) {
      candidatos.push({
        tipo: "RECORDATORIO", severidad: "INFO", giro: r.giro, usuarioId: r.vendedorId,
        titulo: `Mañana: reunión ${r.codigo}`,
        mensaje: `${formatFecha(r.fecha, true)} con ${r.empresa || r.contacto} ${lugar}: ${r.motivo}.`,
        referencia: ref("reunion", r.id),
      });
    }
    if (r.clienteId) {
      candidatos.push({
        tipo: "RECORDATORIO", severidad: "INFO", giro: r.giro, clienteId: r.clienteId,
        titulo: "Mañana tiene una reunión con TransPort",
        mensaje: `${formatFecha(r.fecha, true)} ${lugar}${r.enlace ? `: ${r.enlace}` : ""}.`,
        referencia: ref("reunion-cliente", r.id),
      });
    }
  }

  // Viajes programados para mañana, por giro de transporte
  const viajesPorGiro = new Map<GiroNegocio, string[]>();
  for (const v of viajes) {
    if (diasHasta(v.fechaSalida, ahora) !== 1) continue;
    const giro: GiroNegocio = v.tipo === "MATERIA_PRIMA" ? "TRANSPORTE_MP" : "TRANSPORTE_PROD";
    viajesPorGiro.set(giro, [...(viajesPorGiro.get(giro) ?? []), v.codigo]);
  }
  for (const [giro, codigos] of viajesPorGiro) {
    candidatos.push({
      tipo: "RECORDATORIO", severidad: "INFO", giro, rolesDestino: ["OPERADOR", "GERENTE"],
      titulo: `Mañana salen ${codigos.length} viaje${codigos.length === 1 ? "" : "s"}`,
      mensaje: `${GIROS[giro].nombre}: ${codigos.join(", ")}. Verifique unidades y pilotos.`,
      referencia: ref("viaje", giro),
    });
  }

  // Pedidos de clientes sin confirmar desde hace más de un día
  if (pedidos.length) {
    candidatos.push({
      tipo: "RECORDATORIO", severidad: "ADVERTENCIA", giro: "PROCESO", rolesDestino: ["VENDEDOR", "GERENTE"],
      titulo: `${pedidos.length} pedido${pedidos.length === 1 ? "" : "s"} sin confirmar desde hace más de un día`,
      mensaje: pedidos.slice(0, 6).map((p) => p.codigo).join(", "),
      referencia: ref("pedido", "pendientes"),
    });
  }

  const existentes = new Set(
    (await prisma.alerta.findMany({ where: { referencia: { in: candidatos.map((c) => c.referencia!) } }, select: { referencia: true } })).map((a) => a.referencia),
  );
  let creados = 0;
  for (const c of candidatos) {
    if (existentes.has(c.referencia!)) continue;
    await crearAlerta(c);
    creados++;
  }
  return { fecha: hoy, revisados: candidatos.length, creados };
}
