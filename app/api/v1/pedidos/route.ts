import { z } from "zod";
import { prisma } from "@/lib/db";
import { ErrorApi, autenticar, exigirCliente, manejar, responderLista } from "@/lib/integraciones/api";
import { INCLUIR_PEDIDO, crearPedido, resumenPedido } from "@/lib/services/pedidos";
import type { EstadoPedido } from "@/app/generated/prisma/client";

const ESTADOS = ["SOLICITADO", "CONFIRMADO", "EN_PREPARACION", "DESPACHADO", "ENTREGADO", "CANCELADO"];

/** Pedidos del cliente dueño de la llave (los 100 más recientes); filtro opcional `?estado=`. */
export const GET = manejar(async (request: Request) => {
  const clienteId = exigirCliente(await autenticar(request));
  const estado = new URL(request.url).searchParams.get("estado");
  if (estado && !ESTADOS.includes(estado)) throw new ErrorApi(422, `Estado inválido; use ${ESTADOS.join(", ")}`);
  const pedidos = await prisma.pedido.findMany({
    where: { clienteId, ...(estado ? { estado: estado as EstadoPedido } : {}) },
    include: INCLUIR_PEDIDO,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const datos = pedidos.map(resumenPedido);
  return responderLista(request, datos, [
    { titulo: "codigo", valor: (p) => p.codigo },
    { titulo: "estado", valor: (p) => p.estado },
    { titulo: "total", valor: (p) => p.total },
    { titulo: "productos", valor: (p) => p.items.map((i) => `${i.producto} x ${i.cantidad}`).join(" | ") },
    { titulo: "fecha_requerida", valor: (p) => p.fechaRequerida?.slice(0, 10) },
    { titulo: "viaje", valor: (p) => p.viaje },
    { titulo: "creado", valor: (p) => new Date(p.creado) },
  ], "pedidos");
});

const NuevoPedido = z.object({
  items: z
    .array(z.object({ producto: z.string().trim().min(1), cantidad: z.number().positive() }))
    .min(1, { error: "Incluya al menos un producto" })
    .max(50),
  direccionEntrega: z.string().trim().min(5, { error: "Indique la dirección de entrega" }),
  fechaRequerida: z.iso.date().optional(),
  notas: z.string().trim().max(500).optional(),
});

/** Crea un pedido para el cliente dueño de la llave. Los productos se indican por código. */
export const POST = manejar(async (request: Request) => {
  const clienteId = exigirCliente(await autenticar(request));
  const cuerpo = await request.json().catch(() => {
    throw new ErrorApi(400, "El cuerpo debe ser JSON");
  });
  const parsed = NuevoPedido.safeParse(cuerpo);
  if (!parsed.success) return Response.json({ error: "Pedido inválido", detalle: z.flattenError(parsed.error) }, { status: 422 });

  const codigos = parsed.data.items.map((i) => i.producto.toUpperCase());
  const productos = await prisma.producto.findMany({ where: { codigo: { in: codigos } } });
  const faltantes = codigos.filter((c) => !productos.some((p) => p.codigo === c));
  if (faltantes.length) throw new ErrorApi(422, `Productos inexistentes: ${faltantes.join(", ")}`);

  const pedido = await crearPedido({
    clienteId,
    canal: "API",
    items: parsed.data.items.map((i) => ({ productoId: productos.find((p) => p.codigo === i.producto.toUpperCase())!.id, cantidad: i.cantidad })),
    direccionEntrega: parsed.data.direccionEntrega,
    fechaRequerida: parsed.data.fechaRequerida ? new Date(`${parsed.data.fechaRequerida}T12:00:00-06:00`) : null,
    notas: parsed.data.notas ?? null,
  });
  return Response.json(resumenPedido(pedido), { status: 201 });
});
