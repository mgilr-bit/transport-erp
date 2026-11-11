import type { GiroNegocio, Prisma, Rol } from "@/app/generated/prisma/client";
import { esCorporativo, esInterno } from "@/lib/auth-rules";

type SesionAlertas = { usuarioId: number; rol: Rol; giro: GiroNegocio | null; clienteId?: number | null };
type Destino = { giro: GiroNegocio; rolesDestino: Rol[]; usuarioId: number | null; clienteId: number | null };

/**
 * Quién ve una alerta:
 * - un cliente, solo las notificaciones de su cliente (portal);
 * - el administrador, todo lo interno;
 * - una alerta dirigida a un usuario, solo ese usuario;
 * - el resto, el personal que ve el giro y cuyo rol está entre los destinatarios (o no hay destinatarios).
 */
export function alertaVisiblePara(alerta: Destino, sesion: SesionAlertas) {
  if (!esInterno(sesion)) return alerta.clienteId !== null && alerta.clienteId === sesion.clienteId;
  if (alerta.clienteId !== null) return false;
  if (sesion.rol === "ADMIN") return true;
  if (alerta.usuarioId !== null) return alerta.usuarioId === sesion.usuarioId;
  const veGiro = esCorporativo(sesion) || sesion.giro === alerta.giro;
  return veGiro && (alerta.rolesDestino.length === 0 || alerta.rolesDestino.includes(sesion.rol));
}

/** La misma regla que `alertaVisiblePara`, como filtro de Prisma. */
export function filtroAlertas(sesion: SesionAlertas): Prisma.AlertaWhereInput {
  if (!esInterno(sesion)) return { clienteId: sesion.clienteId ?? -1 };
  if (sesion.rol === "ADMIN") return { clienteId: null };
  // Un usuario interno sin giro y sin rol corporativo no ve ningún giro
  if (!esCorporativo(sesion) && !sesion.giro) return { id: -1 };
  return {
    clienteId: null,
    OR: [
      { usuarioId: sesion.usuarioId },
      {
        usuarioId: null,
        ...(esCorporativo(sesion) || !sesion.giro ? {} : { giro: sesion.giro }),
        OR: [{ rolesDestino: { isEmpty: true } }, { rolesDestino: { has: sesion.rol } }],
      },
    ],
  };
}

const ENLACES_RECORDATORIO: Record<string, (id: string) => { href: string; texto: string }> = {
  contrato: () => ({ href: "/maquinaria?tab=alquileres", texto: "Ver contratos" }),
  solicitud: () => ({ href: "/flujo", texto: "Ver solicitud" }),
  hito: (id) => ({ href: `/construccion/${id.split("-")[0]}`, texto: "Ver obra" }),
  reunion: () => ({ href: "/ventas?tab=reuniones", texto: "Ver agenda" }),
  viaje: () => ({ href: "/transporte", texto: "Ver viajes" }),
  pedido: () => ({ href: "/ventas?tab=pedidos", texto: "Ver pedidos" }),
};

/** Enlace al módulo de origen de una alerta, para las referencias que no requieren consultar la base. */
export function enlaceDeReferencia(referencia: string | null | undefined): { href: string; texto: string } | null {
  const [prefijo, a, b] = referencia?.split(":") ?? [];
  switch (prefijo) {
    case "presupuesto":
      return { href: "/finanzas", texto: "Ver presupuesto" };
    case "pedido":
      return { href: "/ventas?tab=pedidos", texto: "Ver pedidos" };
    case "reunion":
      return { href: "/ventas?tab=reuniones", texto: "Ver agenda" };
    case "mensaje":
      return { href: `/ventas/mensajes/${a}`, texto: "Responder" };
    case "recordatorio":
      return ENLACES_RECORDATORIO[a]?.(b ?? "") ?? null;
    default:
      return null;
  }
}
