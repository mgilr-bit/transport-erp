import { prisma } from "@/lib/db";
import { ErrorApi, autenticar, exigirCliente, manejar } from "@/lib/integraciones/api";
import { INCLUIR_PEDIDO, avanzarPedido, resumenPedido } from "@/lib/services/pedidos";

async function pedidoDelCliente(codigo: string, clienteId: number) {
  const pedido = await prisma.pedido.findUnique({ where: { codigo: codigo.toUpperCase() }, include: INCLUIR_PEDIDO });
  // Un pedido de otro cliente se responde igual que uno inexistente
  if (!pedido || pedido.clienteId !== clienteId) throw new ErrorApi(404, "Pedido no encontrado");
  return pedido;
}

export const GET = manejar(async (request: Request, ctx: RouteContext<"/api/v1/pedidos/[codigo]">) => {
  const clienteId = exigirCliente(await autenticar(request));
  const pedido = await pedidoDelCliente((await ctx.params).codigo, clienteId);
  return Response.json(resumenPedido(pedido));
});

/** Cancela el pedido; solo mientras la planta no lo haya confirmado. */
export const DELETE = manejar(async (request: Request, ctx: RouteContext<"/api/v1/pedidos/[codigo]">) => {
  const clienteId = exigirCliente(await autenticar(request));
  const pedido = await pedidoDelCliente((await ctx.params).codigo, clienteId);
  await avanzarPedido(pedido.id, "cancelar", { clienteId });
  return Response.json(resumenPedido(await pedidoDelCliente(pedido.codigo, clienteId)));
});
