import { timingSafeEqual } from "node:crypto";
import { generarRecordatorios } from "@/lib/services/recordatorios";

/** Lo ejecuta el cron diario de Vercel (vercel.json) con `Authorization: Bearer <CRON_SECRET>`. */
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return Response.json({ error: "Cron no configurado (falta CRON_SECRET)" }, { status: 503 });
  const recibido = Buffer.from(request.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${secreto}`);
  if (recibido.length !== esperado.length || !timingSafeEqual(recibido, esperado)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  return Response.json(await generarRecordatorios());
}
