import "server-only";
import { prisma } from "@/lib/db";
import { GIROS, MODALIDADES_REUNION } from "@/lib/constants";
import { elegirVendedor } from "@/lib/reglas";
import { formatFecha } from "@/lib/utils";
import { crearAlerta } from "@/lib/services/alertas";
import { siguienteCodigo } from "@/lib/services/codigos";
import type { GiroNegocio, ModalidadReunion, Rol, TipoCliente } from "@/app/generated/prisma/client";

// ─── Reuniones para cerrar tratos ──────────────────────────────────────────

export type DatosReunion = {
  clienteId?: number | null;
  contacto: string;
  empresa?: string | null;
  email: string;
  telefono?: string | null;
  giro: GiroNegocio;
  fecha: Date;
  modalidad: ModalidadReunion;
  motivo: string;
};

/** Máximo de solicitudes por correo al día desde el sitio público. */
const LIMITE_DIARIO = 5;

/** Registra una solicitud de reunión y la asigna a un vendedor del giro. */
export async function solicitarReunion(datos: DatosReunion) {
  if (datos.fecha.getTime() < Date.now()) throw new Error("La fecha de la reunión debe ser futura");
  const hace24 = new Date(Date.now() - 86_400_000);
  const recientes = await prisma.reunion.count({ where: { email: datos.email, createdAt: { gte: hace24 } } });
  if (recientes >= LIMITE_DIARIO) throw new Error("Ya recibimos varias solicitudes de este correo hoy. Un asesor se comunicará con usted.");

  const [vendedores, cliente] = await Promise.all([
    prisma.usuario.findMany({
      where: { rol: "VENDEDOR", giro: datos.giro, activo: true },
      select: { id: true, _count: { select: { reuniones: { where: { estado: { in: ["SOLICITADA", "CONFIRMADA"] } } } } } },
    }),
    datos.clienteId ? prisma.cliente.findUnique({ where: { id: datos.clienteId }, select: { vendedorId: true } }) : null,
  ]);
  const vendedorId = elegirVendedor(
    vendedores.map((v) => ({ id: v.id, pendientes: v._count.reuniones })),
    cliente?.vendedorId,
  );
  const codigo = await siguienteCodigo("REU");

  return prisma.$transaction(async (tx) => {
    const reunion = await tx.reunion.create({ data: { ...datos, codigo, vendedorId } });
    await crearAlerta(
      {
        tipo: "REUNION",
        severidad: "INFO",
        giro: datos.giro,
        titulo: `Reunión solicitada por ${datos.empresa || datos.contacto}`,
        mensaje: `${datos.motivo} · ${MODALIDADES_REUNION[datos.modalidad]} · propuesta para el ${formatFecha(datos.fecha, true)}.`,
        referencia: `reunion:${reunion.id}`,
        ...(vendedorId ? { usuarioId: vendedorId } : { rolesDestino: ["GERENTE", "VENDEDOR"] }),
      },
      tx,
    );
    return reunion;
  });
}

/** Confirma (o reprograma) una reunión y avisa al cliente. */
export async function confirmarReunion(id: number, datos: { fecha: Date; enlace?: string | null }) {
  const reunion = await prisma.reunion.findUniqueOrThrow({ where: { id } });
  if (reunion.estado !== "SOLICITADA" && reunion.estado !== "CONFIRMADA") throw new Error("La reunión ya está cerrada");
  if (datos.fecha.getTime() < Date.now()) throw new Error("La fecha de la reunión debe ser futura");
  if (reunion.modalidad === "VIDEOCONFERENCIA" && !datos.enlace && !reunion.enlace) throw new Error("Indique el enlace de la videoconferencia");
  return prisma.$transaction(async (tx) => {
    const r = await tx.reunion.update({
      where: { id, estado: reunion.estado },
      data: { estado: "CONFIRMADA", fecha: datos.fecha, enlace: datos.enlace || reunion.enlace },
    });
    if (r.clienteId) {
      await crearAlerta(
        {
          tipo: "REUNION",
          severidad: "INFO",
          giro: r.giro,
          clienteId: r.clienteId,
          titulo: `Reunión ${r.codigo} confirmada`,
          mensaje: `${formatFecha(r.fecha, true)} · ${r.modalidad === "PRESENCIAL" ? MODALIDADES_REUNION.PRESENCIAL : `Videoconferencia: ${r.enlace}`}`,
          referencia: `reunion:${r.id}`,
        },
        tx,
      );
    }
    return r;
  });
}

export async function reasignarReunion(id: number, vendedorId: number) {
  const [reunion, vendedor] = await Promise.all([
    prisma.reunion.findUniqueOrThrow({ where: { id } }),
    prisma.usuario.findUniqueOrThrow({ where: { id: vendedorId } }),
  ]);
  if (vendedor.rol !== "VENDEDOR" || !vendedor.activo || vendedor.giro !== reunion.giro) {
    throw new Error(`Seleccione un vendedor activo de ${GIROS[reunion.giro].nombre}`);
  }
  return prisma.$transaction(async (tx) => {
    const r = await tx.reunion.update({ where: { id }, data: { vendedorId } });
    await crearAlerta(
      {
        tipo: "REUNION",
        severidad: "INFO",
        giro: r.giro,
        usuarioId: vendedorId,
        titulo: `Se le asignó la reunión ${r.codigo}`,
        mensaje: `${r.empresa || r.contacto}: ${r.motivo}`,
        referencia: `reunion:${r.id}`,
      },
      tx,
    );
    return r;
  });
}

/** Cierra una reunión. `clienteId` indica que la cancela el propio cliente. */
export async function cerrarReunion(id: number, estado: "REALIZADA" | "CANCELADA", clienteId?: number) {
  const reunion = await prisma.reunion.findUniqueOrThrow({ where: { id } });
  if (clienteId !== undefined && (reunion.clienteId !== clienteId || estado !== "CANCELADA")) throw new Error("La reunión no existe.");
  if (estado === "REALIZADA" && reunion.estado !== "CONFIRMADA") throw new Error("Solo una reunión confirmada puede marcarse como realizada");
  if (reunion.estado !== "SOLICITADA" && reunion.estado !== "CONFIRMADA") throw new Error("La reunión ya está cerrada");
  return prisma.$transaction(async (tx) => {
    const r = await tx.reunion.update({ where: { id, estado: reunion.estado }, data: { estado } });
    if (estado === "CANCELADA") {
      const aviso = {
        tipo: "REUNION" as const,
        severidad: "ADVERTENCIA" as const,
        giro: r.giro,
        titulo: `Reunión ${r.codigo} cancelada`,
        referencia: `reunion:${r.id}`,
      };
      const cuando = formatFecha(r.fecha, true);
      if (clienteId !== undefined) {
        const destino = r.vendedorId ? { usuarioId: r.vendedorId } : { rolesDestino: ["GERENTE", "VENDEDOR"] as Rol[] };
        await crearAlerta({ ...aviso, ...destino, mensaje: `${r.empresa || r.contacto} canceló la reunión del ${cuando}.` }, tx);
      } else if (r.clienteId) {
        await crearAlerta({ ...aviso, clienteId: r.clienteId, mensaje: `La reunión del ${cuando} fue cancelada. Puede solicitar una nueva fecha.` }, tx);
      }
    }
    return r;
  });
}

// ─── Mensajes entre clientes y la empresa ──────────────────────────────────

/**
 * Agrega un mensaje a la conversación del cliente y avisa al otro lado. Mientras haya un
 * aviso sin leer de la misma conversación, se actualiza en lugar de crear otro.
 */
export async function enviarMensaje(clienteId: number, autor: { usuarioId: number; rol: string; nombre: string }, texto: string) {
  const deCliente = autor.rol === "CLIENTE";
  const cliente = await prisma.cliente.findUniqueOrThrow({
    where: { id: clienteId },
    select: { nombre: true, vendedorId: true, vendedor: { select: { giro: true } } },
  });
  const referencia = `mensaje:${clienteId}`;
  const resumen = texto.length > 140 ? `${texto.slice(0, 137)}…` : texto;
  const giro: GiroNegocio = cliente.vendedor?.giro ?? "CORPORATIVO";
  // Sin vendedor asignado, el mensaje del cliente le llega a la administración
  const destino = deCliente
    ? cliente.vendedorId
      ? { usuarioId: cliente.vendedorId, giro }
      : { rolesDestino: ["ADMIN"] as Rol[], giro: "CORPORATIVO" as GiroNegocio }
    : { clienteId, giro };

  return prisma.$transaction(async (tx) => {
    const mensaje = await tx.mensaje.create({ data: { clienteId, autorId: autor.usuarioId, texto, deCliente } });
    const pendiente = await tx.alerta.findFirst({
      where: { tipo: "MENSAJE", referencia, leida: false, clienteId: deCliente ? null : clienteId },
    });
    const titulo = deCliente ? `Mensaje de ${cliente.nombre}` : "Nuevo mensaje de TransPort";
    const cuerpo = deCliente ? resumen : `${autor.nombre}: ${resumen}`;
    if (pendiente) {
      await tx.alerta.update({ where: { id: pendiente.id }, data: { titulo, mensaje: cuerpo, createdAt: new Date() } });
    } else {
      await crearAlerta({ tipo: "MENSAJE", severidad: "INFO", titulo, mensaje: cuerpo, referencia, ...destino }, tx);
    }
    return mensaje;
  });
}

/** Marca como leídos los mensajes que el otro lado envió. */
export async function marcarConversacionLeida(clienteId: number, lector: "cliente" | "empresa") {
  await prisma.mensaje.updateMany({ where: { clienteId, deCliente: lector === "empresa", leido: false }, data: { leido: true } });
}

// ─── Cartera de clientes ───────────────────────────────────────────────────

export type DatosCliente = {
  nombre: string;
  nit: string;
  tipo: TipoCliente;
  pais: string;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  vendedorId?: number | null;
};

async function validarVendedor(vendedorId: number | null | undefined) {
  if (!vendedorId) return;
  const v = await prisma.usuario.findUniqueOrThrow({ where: { id: vendedorId } });
  if (v.rol !== "VENDEDOR" || !v.activo) throw new Error("Seleccione un vendedor activo");
}

export async function crearCliente(datos: DatosCliente) {
  await validarVendedor(datos.vendedorId);
  return prisma.cliente.create({ data: datos });
}

export async function asignarVendedor(clienteId: number, vendedorId: number | null) {
  await validarVendedor(vendedorId);
  return prisma.cliente.update({ where: { id: clienteId }, data: { vendedorId } });
}
