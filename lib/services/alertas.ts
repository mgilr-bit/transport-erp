import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { enviarPushDeAlerta } from "@/lib/services/push";
import { AUDIENCIA_ALERTAS } from "@/lib/constants";
import type { GiroNegocio, Prisma, Rol, SeveridadAlerta, TipoAlerta } from "@/app/generated/prisma/client";

export type NuevaAlerta = {
  tipo: TipoAlerta;
  severidad: SeveridadAlerta;
  giro: GiroNegocio;
  titulo: string;
  mensaje: string;
  referencia?: string | null;
  /** Por omisión, la audiencia del tipo; se ignora si la alerta va a un usuario o a un cliente. */
  rolesDestino?: Rol[];
  usuarioId?: number | null;
  clienteId?: number | null;
};

/** Crea una alerta con sus destinatarios. Todas las alertas del sistema pasan por aquí. */
export async function crearAlerta(datos: NuevaAlerta, tx: Prisma.TransactionClient = prisma) {
  const dirigida = datos.usuarioId != null || datos.clienteId != null;
  const rolesDestino = dirigida ? [] : (datos.rolesDestino ?? AUDIENCIA_ALERTAS[datos.tipo]);
  const alerta = await tx.alerta.create({ data: { ...datos, rolesDestino } });
  // Después de responder: para entonces la transacción ya terminó (si se revirtió, no hay alerta que enviar)
  try {
    after(() => enviarPushDeAlerta(alerta.id));
  } catch {
    // Fuera de una petición (scripts) no se envían notificaciones
  }
  return alerta;
}
