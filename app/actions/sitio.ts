"use server";

import { z } from "zod";
import { erroresDe, mensajeError, validar, zFechaHora, zTexto, zTextoOpcional, type ActionState } from "@/lib/action";
import { getUsuarioActual } from "@/lib/auth";
import { GIROS_OPERATIVOS } from "@/lib/constants";
import { solicitarReunion } from "@/lib/services/comercial";
import type { GiroNegocio } from "@/app/generated/prisma/client";

const SolicitudSchema = z.object({
  contacto: zTexto(3),
  empresa: zTextoOpcional,
  email: z.email({ error: "Correo inválido" }).trim().toLowerCase(),
  telefono: zTextoOpcional,
  giro: z.enum(GIROS_OPERATIVOS as [GiroNegocio, ...GiroNegocio[]], { error: "Seleccione un giro" }),
  modalidad: z.enum(["PRESENCIAL", "VIDEOCONFERENCIA"]),
  fecha: zFechaHora.refine((f) => f.getTime() < Date.now() + 180 * 86_400_000, { error: "Elija una fecha dentro de los próximos seis meses" }),
  motivo: zTexto(10).max(1000, { error: "Máximo 1,000 caracteres" }),
});

/**
 * Solicitud de reunión desde el sitio público (prospectos o clientes con sesión).
 * No exige sesión: se protege con un campo trampa y un límite diario por correo.
 */
export async function solicitarReunionPublicaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Los bots suelen llenar todos los campos, incluido este, que las personas no ven
  if (formData.get("sitio_web")) return { ok: true, mensaje: "Recibimos su solicitud." };
  const parsed = validar(SolicitudSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  try {
    const session = await getUsuarioActual();
    const reunion = await solicitarReunion({ ...parsed.data, clienteId: session?.rol === "CLIENTE" ? session.clienteId : null });
    return {
      ok: true,
      mensaje: `Recibimos su solicitud ${reunion.codigo}. ${reunion.vendedorId ? "Un asesor" : "Nuestro equipo"} se comunicará con usted para confirmar la fecha.`,
    };
  } catch (e) {
    return { ok: false, mensaje: mensajeError(e) };
  }
}
