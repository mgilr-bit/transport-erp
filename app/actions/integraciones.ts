"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ejecutarAccion, erroresDe, validar, zTexto, type ActionState } from "@/lib/action";
import { EVENTOS_WEBHOOK, type EventoWebhook } from "@/lib/constants";
import { generarLlave, hashLlave, prefijoDe } from "@/lib/integraciones/llaves";
import { enviarWebhook } from "@/lib/integraciones/webhooks";

const soloAdmin = (s: { rol: string }) => s.rol === "ADMIN";
const RUTAS = ["/admin/integraciones"];

const zPropietario = z
  .string()
  .regex(/^(cliente|proveedor):\d+$/, { error: "Seleccione el cliente o proveedor" })
  .transform((v) => {
    const [tipo, id] = v.split(":");
    return tipo === "cliente" ? { clienteId: Number(id) } : { proveedorId: Number(id) };
  });

// ─── Llaves de API ─────────────────────────────────────────────────────────

const LlaveSchema = z.object({ nombre: zTexto(3), propietario: zPropietario });

export async function crearLlaveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(LlaveSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  return ejecutarAccion({
    giros: soloAdmin,
    ejecutar: async () => {
      const llave = generarLlave();
      await prisma.apiKey.create({ data: { nombre: parsed.data.nombre, prefijo: prefijoDe(llave), hash: hashLlave(llave), ...parsed.data.propietario } });
      return llave;
    },
    bitacora: { accion: "CREAR_LLAVE_API", entidad: "ApiKey", detalle: parsed.data.nombre },
    revalidar: RUTAS,
    exito: (llave) => `Llave creada. Cópiela ahora; no se volverá a mostrar: ${llave}`,
  });
}

export async function alternarLlaveAction(id: number) {
  return ejecutarAccion({
    giros: soloAdmin,
    ejecutar: async () => {
      const llave = await prisma.apiKey.findUniqueOrThrow({ where: { id } });
      await prisma.apiKey.update({ where: { id }, data: { activa: !llave.activa } });
    },
    bitacora: { accion: "ALTERNAR_LLAVE_API", entidad: "ApiKey", detalle: String(id) },
    revalidar: RUTAS,
    exito: "Estado de la llave actualizado.",
  });
}

// ─── Webhooks ──────────────────────────────────────────────────────────────

const WebhookSchema = z.object({
  url: z
    .url({ error: "URL inválida" })
    // En producción solo HTTPS, para no enviar datos de clientes sin cifrar
    .refine((u) => process.env.NODE_ENV !== "production" || u.startsWith("https://"), { error: "Use una URL https://" }),
  propietario: zPropietario,
});

export async function crearWebhookAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(WebhookSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  const eventos = formData.getAll("eventos").filter((e): e is EventoWebhook => typeof e === "string" && e in EVENTOS_WEBHOOK);
  if (!eventos.length) return { ok: false, mensaje: "Seleccione al menos un evento." };
  return ejecutarAccion({
    giros: soloAdmin,
    ejecutar: async () => {
      const secreto = randomBytes(24).toString("hex");
      await prisma.webhook.create({ data: { url: parsed.data.url, secreto, eventos, ...parsed.data.propietario } });
      return secreto;
    },
    bitacora: { accion: "CREAR_WEBHOOK", entidad: "Webhook", detalle: parsed.data.url },
    revalidar: RUTAS,
    exito: (secreto) => `Webhook registrado. Secreto para verificar la firma (cópielo ahora): ${secreto}`,
  });
}

export async function alternarWebhookAction(id: number) {
  return ejecutarAccion({
    giros: soloAdmin,
    ejecutar: async () => {
      const w = await prisma.webhook.findUniqueOrThrow({ where: { id } });
      await prisma.webhook.update({ where: { id }, data: { activo: !w.activo } });
    },
    bitacora: { accion: "ALTERNAR_WEBHOOK", entidad: "Webhook", detalle: String(id) },
    revalidar: RUTAS,
    exito: "Estado del webhook actualizado.",
  });
}

export async function probarWebhookAction(id: number) {
  return ejecutarAccion({
    giros: soloAdmin,
    ejecutar: async () => {
      const w = await prisma.webhook.findUniqueOrThrow({ where: { id } });
      const r = await enviarWebhook(w, "prueba", { mensaje: "Prueba de conexión desde TransPort ERP" });
      if (r.error) throw new Error(r.error);
      return r.estado;
    },
    revalidar: RUTAS,
    exito: (estado) => `El receptor respondió HTTP ${estado}.`,
  });
}
