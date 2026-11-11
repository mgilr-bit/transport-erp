import { prisma } from "@/lib/db";
import { ErrorApi, autenticar, exigirCliente, manejar, responderLista } from "@/lib/integraciones/api";
import { toNumber } from "@/lib/utils";
import type { EstadoViaje } from "@/app/generated/prisma/client";

const ESTADOS = ["PROGRAMADO", "EN_CURSO", "ENTREGADO", "CANCELADO"];

/** Seguimiento de los viajes del cliente (los 100 más recientes); filtro opcional `?estado=`. */
export const GET = manejar(async (request: Request) => {
  const clienteId = exigirCliente(await autenticar(request));
  const estado = new URL(request.url).searchParams.get("estado");
  if (estado && !ESTADOS.includes(estado)) throw new ErrorApi(422, `Estado inválido; use ${ESTADOS.join(", ")}`);
  const viajes = await prisma.viaje.findMany({
    where: { clienteId, ...(estado ? { estado: estado as EstadoViaje } : {}) },
    include: { pedido: { select: { codigo: true } } },
    orderBy: { fechaSalida: "desc" },
    take: 100,
  });
  const datos = viajes.map((v) => ({
    codigo: v.codigo,
    tipo: v.tipo,
    modalidad: v.modalidad,
    origen: v.origen,
    destino: v.destino,
    carga: v.carga,
    toneladas: toNumber(v.toneladas),
    distanciaKm: v.distanciaKm,
    tarifa: toNumber(v.tarifa),
    estado: v.estado,
    salida: v.fechaSalida.toISOString(),
    entrega: v.fechaEntrega?.toISOString() ?? null,
    pedido: v.pedido?.codigo ?? null,
  }));
  return responderLista(request, datos, [
    { titulo: "codigo", valor: (v) => v.codigo },
    { titulo: "estado", valor: (v) => v.estado },
    { titulo: "origen", valor: (v) => v.origen },
    { titulo: "destino", valor: (v) => v.destino },
    { titulo: "carga", valor: (v) => v.carga },
    { titulo: "toneladas", valor: (v) => v.toneladas },
    { titulo: "tarifa", valor: (v) => v.tarifa },
    { titulo: "salida", valor: (v) => new Date(v.salida) },
    { titulo: "entrega", valor: (v) => (v.entrega ? new Date(v.entrega) : null) },
  ], "viajes");
});
