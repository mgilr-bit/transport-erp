import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { GiroNegocio } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getSession, type SessionPayload } from "@/lib/session";
import { esCorporativo, puedeOperar, puedeVerGiro } from "@/lib/auth-rules";

/**
 * Sesión del usuario validada contra la base de datos: un usuario desactivado
 * pierde el acceso de inmediato y los cambios de rol o giro aplican sin
 * esperar a que expire el token.
 */
export const getUsuarioActual = cache(async (): Promise<SessionPayload | null> => {
  const session = await getSession();
  if (!session) return null;
  const usuario = await prisma.usuario.findUnique({ where: { id: session.usuarioId }, select: { activo: true, rol: true, giro: true, nombre: true } });
  if (!usuario?.activo) return null;
  return { ...session, rol: usuario.rol, giro: usuario.giro, nombre: usuario.nombre };
});

/** Exige sesión activa; redirige a /login si no existe. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getUsuarioActual();
  // Token válido pero usuario desactivado: hay que borrar la cookie o el proxy
  // lo devolvería al panel en un ciclo infinito
  if (!session) redirect((await getSession()) ? "/salir" : "/login");
  return session;
}

export { esCorporativo, puedeAprobar, puedeDefinirPresupuesto, puedeOperar, puedeRegistrarGasto, puedeVerGiro } from "@/lib/auth-rules";

/** Exige acceso a al menos uno de los giros indicados. */
export async function requireGiro(...giros: GiroNegocio[]) {
  const session = await requireSession();
  if (!giros.some((g) => puedeVerGiro(session, g))) redirect("/sin-acceso");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.rol !== "ADMIN") redirect("/sin-acceso");
  return session;
}

/** Filtro Prisma por giro según el usuario: corporativos ven todo. */
export function filtroGiro(session: SessionPayload): { giro?: GiroNegocio } {
  return esCorporativo(session) || !session.giro ? {} : { giro: session.giro };
}

/** Para server actions: exige permiso de operación sobre un giro o lanza error. */
export async function autorizarOperacion(...giros: GiroNegocio[]) {
  return autorizar((session) => giros.some((g) => puedeOperar(session, g)));
}

/** Para server actions con reglas propias (finanzas, administración). */
export async function autorizar(regla: (session: SessionPayload) => boolean) {
  const session = await getUsuarioActual();
  if (!session) throw new Error("Su sesión expiró. Inicie sesión nuevamente.");
  if (!regla(session)) throw new Error("No tiene permiso para realizar esta operación.");
  return session;
}
