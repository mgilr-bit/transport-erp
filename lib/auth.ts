import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { GiroNegocio } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getSession, type SessionPayload } from "@/lib/session";
import { esCorporativo, esInterno, puedeOperar, puedeVerGiro } from "@/lib/auth-rules";

/**
 * Sesión del usuario validada contra la base de datos: un usuario desactivado
 * pierde el acceso de inmediato y los cambios de rol o giro aplican sin
 * esperar a que expire el token.
 */
export const getUsuarioActual = cache(async (): Promise<SessionPayload | null> => {
  const session = await getSession();
  if (!session) return null;
  const usuario = await prisma.usuario.findUnique({
    where: { id: session.usuarioId },
    select: { activo: true, rol: true, giro: true, nombre: true, clienteId: true },
  });
  if (!usuario?.activo) return null;
  return { ...session, rol: usuario.rol, giro: usuario.giro, nombre: usuario.nombre, clienteId: usuario.clienteId };
});

/** Sesión activa (de cualquier rol); redirige a /login si no existe. */
async function sesionActiva(): Promise<SessionPayload> {
  const session = await getUsuarioActual();
  // Token válido pero usuario desactivado: hay que borrar la cookie o el proxy
  // lo devolvería al panel en un ciclo infinito
  if (!session) redirect((await getSession()) ? "/salir" : "/login");
  return session;
}

/** Exige sesión de personal interno; los clientes van a su portal. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await sesionActiva();
  if (!esInterno(session)) redirect("/portal");
  return session;
}

/** Exige sesión de un usuario de cliente; el personal interno va a su panel. */
export async function requireCliente(): Promise<SessionPayload & { clienteId: number }> {
  const session = await sesionActiva();
  if (session.rol !== "CLIENTE" || !session.clienteId) redirect("/dashboard");
  return { ...session, clienteId: session.clienteId };
}

export {
  esCorporativo,
  esInterno,
  puedeAprobar,
  puedeDefinirPresupuesto,
  puedeGestionarClientes,
  puedeGestionarPedidos,
  puedeGestionarReuniones,
  puedeOperar,
  puedeRegistrarGasto,
  puedeVerComercial,
  puedeVerGiro,
  puedeVerReportes,
} from "@/lib/auth-rules";

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
  // Sin esta guarda, un usuario sin giro (como un cliente) vería todos los giros
  if (!esInterno(session)) throw new Error("Los clientes no tienen acceso a la información interna.");
  return esCorporativo(session) || !session.giro ? {} : { giro: session.giro };
}

/** Para server actions: exige permiso de operación sobre un giro o lanza error. */
export async function autorizarOperacion(...giros: GiroNegocio[]) {
  return autorizar((session) => giros.some((g) => puedeOperar(session, g)));
}

/** Para server actions con reglas propias (finanzas, administración). Nunca autoriza a clientes. */
export async function autorizar(regla: (session: SessionPayload) => boolean) {
  const session = await getUsuarioActual();
  if (!session) throw new Error("Su sesión expiró. Inicie sesión nuevamente.");
  if (!esInterno(session) || !regla(session)) throw new Error("No tiene permiso para realizar esta operación.");
  return session;
}

/** Para server actions del portal: exige un usuario de cliente y devuelve su cliente. */
export async function autorizarCliente() {
  const session = await getUsuarioActual();
  if (!session) throw new Error("Su sesión expiró. Inicie sesión nuevamente.");
  if (session.rol !== "CLIENTE" || !session.clienteId) throw new Error("No tiene permiso para realizar esta operación.");
  return { ...session, clienteId: session.clienteId };
}
