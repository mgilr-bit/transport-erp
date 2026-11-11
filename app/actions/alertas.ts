"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { esInterno, getUsuarioActual, puedeVerGiro } from "@/lib/auth";
import { alertaVisiblePara, filtroAlertas } from "@/lib/alertas";
import { mensajeError, type ActionState } from "@/lib/action";
import type { GiroNegocio, SeveridadAlerta, TipoAlerta } from "@/app/generated/prisma/client";

function revalidar() {
  for (const r of ["/alertas", "/dashboard"]) revalidatePath(r);
  // El contador de la barra lateral vive en el layout
  revalidatePath("/", "layout");
}

/** Cualquier usuario que ve el giro de la alerta puede darla por atendida. */
export async function marcarLeidaAction(id: number): Promise<ActionState> {
  try {
    const session = await getUsuarioActual();
    if (!session) throw new Error("Su sesión expiró. Inicie sesión nuevamente.");
    const alerta = await prisma.alerta.findUniqueOrThrow({ where: { id } });
    if (!alertaVisiblePara(alerta, session)) throw new Error("No tiene acceso a esta alerta.");
    await prisma.alerta.update({ where: { id }, data: { leida: !alerta.leida } });
  } catch (e) {
    return { ok: false, mensaje: mensajeError(e) };
  }
  revalidar();
  return { ok: true };
}

export async function marcarTodasLeidasAction(filtro: { tipo?: TipoAlerta; severidad?: SeveridadAlerta; giro?: GiroNegocio }): Promise<ActionState> {
  try {
    const session = await getUsuarioActual();
    if (!session) throw new Error("Su sesión expiró. Inicie sesión nuevamente.");
    if (!esInterno(session) || (filtro.giro && !puedeVerGiro(session, filtro.giro))) throw new Error("No tiene acceso a ese giro.");
    const { count } = await prisma.alerta.updateMany({
      where: { leida: false, ...filtroAlertas(session), ...(filtro.giro ? { giro: filtro.giro } : {}), ...(filtro.tipo ? { tipo: filtro.tipo } : {}), ...(filtro.severidad ? { severidad: filtro.severidad } : {}) },
      data: { leida: true },
    });
    revalidar();
    return { ok: true, mensaje: `${count} alertas marcadas como atendidas.` };
  } catch (e) {
    return { ok: false, mensaje: mensajeError(e) };
  }
}
