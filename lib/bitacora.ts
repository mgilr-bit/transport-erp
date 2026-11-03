import "server-only";
import { prisma } from "@/lib/db";
import { getUsuarioActual } from "@/lib/auth";

export async function registrarBitacora(accion: string, entidad: string, detalle?: string) {
  const session = await getUsuarioActual();
  await prisma.bitacora.create({
    data: { usuarioId: session?.usuarioId, accion, entidad, detalle },
  });
}
