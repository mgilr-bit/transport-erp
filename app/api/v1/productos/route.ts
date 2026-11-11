import { prisma } from "@/lib/db";
import { autenticar, manejar, responderLista } from "@/lib/integraciones/api";
import { toNumber } from "@/lib/utils";

/** Catálogo de productos de las plantas de proceso, con precio de lista. */
export const GET = manejar(async (request: Request) => {
  await autenticar(request);
  const productos = await prisma.producto.findMany({ orderBy: [{ categoria: "asc" }, { codigo: "asc" }] });
  const datos = productos.map((p) => ({ codigo: p.codigo, nombre: p.nombre, categoria: p.categoria, unidad: p.unidad, precio: toNumber(p.precio) }));
  return responderLista(request, datos, [
    { titulo: "codigo", valor: (p) => p.codigo },
    { titulo: "nombre", valor: (p) => p.nombre },
    { titulo: "categoria", valor: (p) => p.categoria },
    { titulo: "unidad", valor: (p) => p.unidad },
    { titulo: "precio", valor: (p) => p.precio },
  ], "productos");
});
