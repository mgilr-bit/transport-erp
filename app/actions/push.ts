"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { getUsuarioActual } from "@/lib/auth";
import type { ActionState } from "@/lib/action";

const SuscripcionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

/** Guarda la suscripción push del navegador para el usuario con sesión (personal o cliente). */
export async function guardarSuscripcionAction(datos: unknown): Promise<ActionState> {
  const session = await getUsuarioActual();
  if (!session) return { ok: false, mensaje: "Inicie sesión para activar las notificaciones." };
  const parsed = SuscripcionSchema.safeParse(datos);
  if (!parsed.success) return { ok: false, mensaje: "Suscripción inválida." };
  const { endpoint, keys } = parsed.data;
  await prisma.pushSuscripcion.upsert({
    where: { endpoint },
    update: { usuarioId: session.usuarioId, p256dh: keys.p256dh, auth: keys.auth },
    create: { usuarioId: session.usuarioId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });
  return { ok: true, mensaje: "Notificaciones activadas en este dispositivo." };
}

export async function eliminarSuscripcionAction(endpoint: string): Promise<ActionState> {
  const session = await getUsuarioActual();
  if (!session) return { ok: false };
  await prisma.pushSuscripcion.deleteMany({ where: { endpoint, usuarioId: session.usuarioId } });
  return { ok: true, mensaje: "Notificaciones desactivadas en este dispositivo." };
}
