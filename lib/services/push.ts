import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/db";
import { alertaVisiblePara, enlaceDeReferencia } from "@/lib/alertas";

const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privada = process.env.VAPID_PRIVATE_KEY;

/** Las notificaciones push solo funcionan si se configuraron las claves VAPID. */
export const pushActivo = Boolean(publica && privada);
if (pushActivo) webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:sistemas@transport.gt", publica!, privada!);

/** Enlace del portal para las notificaciones de clientes. */
function enlacePortal(referencia: string | null) {
  const [prefijo, clase] = referencia?.split(":") ?? [];
  if (prefijo === "pedido" || clase === "pedido") return "/portal/pedidos";
  if (prefijo === "reunion" || clase === "reunion-cliente") return "/portal/reuniones";
  if (prefijo === "mensaje") return "/portal/mensajes";
  return "/portal";
}

/**
 * Envía una alerta a los navegadores suscritos de quienes la verían en el sistema
 * (misma regla de visibilidad que el centro de alertas y el portal).
 */
export async function enviarPushDeAlerta(alertaId: number) {
  if (!pushActivo) return;
  const alerta = await prisma.alerta.findUnique({ where: { id: alertaId } });
  if (!alerta) return;
  const suscripciones = await prisma.pushSuscripcion.findMany({
    where: { usuario: { activo: true } },
    include: { usuario: { select: { id: true, rol: true, giro: true, clienteId: true } } },
  });
  const destino = suscripciones.filter((s) => alertaVisiblePara(alerta, { usuarioId: s.usuario.id, rol: s.usuario.rol, giro: s.usuario.giro, clienteId: s.usuario.clienteId }));
  const url = alerta.clienteId ? enlacePortal(alerta.referencia) : (enlaceDeReferencia(alerta.referencia)?.href ?? "/alertas");
  const cuerpo = JSON.stringify({ title: alerta.titulo, body: alerta.mensaje, url, tag: `${alerta.tipo}-${alerta.id}` });

  await Promise.all(
    destino.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, cuerpo, { TTL: 60 * 60 * 24 });
      } catch (e) {
        // 404 o 410: el navegador anuló la suscripción
        const estado = (e as { statusCode?: number }).statusCode;
        if (estado === 404 || estado === 410) await prisma.pushSuscripcion.delete({ where: { id: s.id } }).catch(() => {});
      }
    }),
  );
}
