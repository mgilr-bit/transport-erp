import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { firmar } from "@/lib/integraciones/firma";
import type { EventoWebhook } from "@/lib/constants";

type Destinatario = { clienteId?: number | null; proveedorId?: number | null };

/**
 * Envía el evento a los webhooks activos del cliente o proveedor después de responder
 * al usuario, para que un sistema externo lento no retrase la operación.
 */
export function emitirEvento(evento: EventoWebhook, destinatario: Destinatario, datos: unknown) {
  if (!destinatario.clienteId && !destinatario.proveedorId) return;
  try {
    after(() => entregarEvento(evento, destinatario, datos));
  } catch {
    // Fuera de una petición (scripts) no hay a quién notificar
  }
}

async function entregarEvento(evento: EventoWebhook, destinatario: Destinatario, datos: unknown) {
  const webhooks = await prisma.webhook.findMany({
    where: {
      activo: true,
      eventos: { has: evento },
      ...(destinatario.clienteId ? { clienteId: destinatario.clienteId } : { proveedorId: destinatario.proveedorId }),
    },
  });
  await Promise.all(webhooks.map((w) => enviarWebhook(w, evento, datos)));
}

/** Hace el POST firmado y guarda el resultado en el webhook. */
export async function enviarWebhook(webhook: { id: number; url: string; secreto: string }, evento: EventoWebhook | "prueba", datos: unknown) {
  const cuerpo = JSON.stringify({ evento, fecha: new Date().toISOString(), datos });
  let estado: number | null = null;
  let error: string | null = null;
  try {
    const respuesta = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "TransPort-ERP-Webhooks/1.0",
        "X-TransPort-Evento": evento,
        "X-TransPort-Firma": firmar(webhook.secreto, cuerpo),
      },
      body: cuerpo,
      signal: AbortSignal.timeout(5000),
      redirect: "manual",
    });
    estado = respuesta.status;
    if (!respuesta.ok) error = `El receptor respondió HTTP ${respuesta.status}`;
  } catch (e) {
    error = e instanceof Error ? e.message : "Error de red";
  }
  await prisma.webhook.update({ where: { id: webhook.id }, data: { ultimoEnvio: new Date(), ultimoEstado: estado, ultimoError: error } });
  return { estado, error };
}
