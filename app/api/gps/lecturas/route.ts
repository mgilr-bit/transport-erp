import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { procesarLectura } from "@/lib/services/gps";

/**
 * Webhook para que GPS-Inversiones empuje lecturas en lugar de consultarlas.
 *
 *   POST /api/gps/lecturas
 *   Authorization: Bearer <GPS_WEBHOOK_TOKEN>
 *   [{ "imei": "...", "latitud": 14.6, "longitud": -90.5, "velocidad": 62,
 *      "motorEncendido": true, "timestamp": "2026-10-12T15:30:00Z" }, ...]
 */
const LecturaSchema = z.object({
  imei: z.string().min(5),
  latitud: z.number().min(-90).max(90),
  longitud: z.number().min(-180).max(180),
  velocidad: z.number().min(0).max(250),
  motorEncendido: z.boolean(),
  timestamp: z.coerce.date(),
});
const LoteSchema = z.array(LecturaSchema).min(1).max(500);

function tokenValido(cabecera: string | null) {
  const esperado = process.env.GPS_WEBHOOK_TOKEN;
  const recibido = cabecera?.replace(/^Bearer\s+/i, "") ?? "";
  if (!esperado || recibido.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado));
}

export async function POST(request: Request) {
  if (!process.env.GPS_WEBHOOK_TOKEN) {
    return Response.json({ error: "Webhook no configurado (falta GPS_WEBHOOK_TOKEN)" }, { status: 503 });
  }
  if (!tokenValido(request.headers.get("authorization"))) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "El cuerpo debe ser JSON" }, { status: 400 });
  }
  const parsed = LoteSchema.safeParse(Array.isArray(cuerpo) ? cuerpo : [cuerpo]);
  if (!parsed.success) {
    return Response.json({ error: "Lecturas inválidas", detalle: z.flattenError(parsed.error) }, { status: 422 });
  }

  // En orden cronológico para que la evaluación de uso continuo sea correcta
  const lecturas = [...parsed.data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  let alertas = 0;
  for (const lectura of lecturas) alertas += await procesarLectura(lectura);
  return Response.json({ recibidas: lecturas.length, alertas });
}
