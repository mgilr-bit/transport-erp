import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { aCSV, type ColumnaCSV } from "@/lib/csv";
import { formatoLlaveValido, llaveCoincide, prefijoDe } from "@/lib/integraciones/llaves";

/**
 * Utilidades de la API REST v1 para sistemas de terceros (clientes y proveedores).
 * Autenticación: `Authorization: Bearer <llave>` o `X-Api-Key: <llave>`.
 */

export type Consumidor = { llaveId: number; clienteId: number | null; proveedorId: number | null };

export class ErrorApi extends Error {
  constructor(public estado: number, mensaje: string) {
    super(mensaje);
  }
}

export async function autenticar(request: Request): Promise<Consumidor> {
  const llave = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.headers.get("x-api-key") ?? "";
  if (!formatoLlaveValido(llave)) throw new ErrorApi(401, "Llave de API ausente o inválida");
  const registro = await prisma.apiKey.findUnique({ where: { prefijo: prefijoDe(llave) } });
  if (!registro || !registro.activa || !llaveCoincide(llave, registro.hash)) throw new ErrorApi(401, "Llave de API ausente o inválida");
  after(() => prisma.apiKey.update({ where: { id: registro.id }, data: { ultimoUso: new Date() } }));
  return { llaveId: registro.id, clienteId: registro.clienteId, proveedorId: registro.proveedorId };
}

export function exigirCliente(c: Consumidor) {
  if (!c.clienteId) throw new ErrorApi(403, "Este recurso requiere una llave de cliente");
  return c.clienteId;
}

export function exigirProveedor(c: Consumidor) {
  if (!c.proveedorId) throw new ErrorApi(403, "Este recurso requiere una llave de proveedor");
  return c.proveedorId;
}

/**
 * Traduce errores a respuestas JSON: los de autenticación con su código, las reglas de
 * negocio como 422 y cualquier otro como 500 sin detalles internos.
 */
export function manejar<C>(fn: (request: Request, ctx: C) => Promise<Response>) {
  return async (request: Request, ctx: C) => {
    try {
      return await fn(request, ctx);
    } catch (e) {
      if (e instanceof ErrorApi) return Response.json({ error: e.message }, { status: e.estado });
      // Las reglas de negocio lanzan Error simples con un mensaje para el usuario
      if (e instanceof Error && e.constructor === Error) return Response.json({ error: e.message }, { status: 422 });
      console.error("API v1", e);
      return Response.json({ error: "Error interno" }, { status: 500 });
    }
  };
}

/** Responde una lista en JSON o, con `?formato=csv`, como archivo CSV. */
export function responderLista<T>(request: Request, datos: T[], columnas: ColumnaCSV<T>[], archivo: string) {
  if (new URL(request.url).searchParams.get("formato") === "csv") {
    return new Response(aCSV(datos, columnas), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${archivo}.csv"` },
    });
  }
  return Response.json({ datos, total: datos.length });
}
