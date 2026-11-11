import { prisma } from "@/lib/db";
import { autenticar, exigirProveedor, manejar, responderLista } from "@/lib/integraciones/api";
import { toNumber } from "@/lib/utils";

/** Compras de materia prima asignadas al proveedor dueño de la llave. */
export const GET = manejar(async (request: Request) => {
  const proveedorId = exigirProveedor(await autenticar(request));
  const solicitudes = await prisma.solicitudMateriaPrima.findMany({
    where: { proveedorId },
    include: { material: true, planta: { select: { nombre: true, direccion: true } }, viaje: { select: { codigo: true, estado: true } } },
    orderBy: { fechaRequerida: "desc" },
    take: 100,
  });
  const datos = solicitudes.map((s) => ({
    codigo: s.codigo,
    estado: s.estado,
    material: s.material.codigo,
    nombreMaterial: s.material.nombre,
    toneladas: toNumber(s.toneladas),
    planta: s.planta.nombre,
    direccion: s.planta.direccion,
    fechaRequerida: s.fechaRequerida.toISOString(),
    viaje: s.viaje?.codigo ?? null,
  }));
  return responderLista(request, datos, [
    { titulo: "codigo", valor: (s) => s.codigo },
    { titulo: "estado", valor: (s) => s.estado },
    { titulo: "material", valor: (s) => s.material },
    { titulo: "toneladas", valor: (s) => s.toneladas },
    { titulo: "planta", valor: (s) => s.planta },
    { titulo: "fecha_requerida", valor: (s) => new Date(s.fechaRequerida) },
    { titulo: "viaje", valor: (s) => s.viaje },
  ], "solicitudes");
});
