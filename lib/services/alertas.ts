import "server-only";
import { prisma } from "@/lib/db";
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
  return tx.alerta.create({ data: { ...datos, rolesDestino } });
}
