import type { Metadata } from "next";
import { Download } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireCliente } from "@/lib/auth";
import { toNumber } from "@/lib/utils";
import { claveDia } from "@/lib/reglas";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PedidoCatalogo, PedidoCsv } from "../../formularios";

export const metadata: Metadata = { title: "Nuevo pedido" };

export default async function NuevoPedidoPage({ searchParams }: PageProps<"/portal/pedidos/nuevo">) {
  const { clienteId } = await requireCliente();
  const { producto } = await searchParams;
  const [cliente, productos] = await Promise.all([
    prisma.cliente.findUniqueOrThrow({ where: { id: clienteId } }),
    prisma.producto.findMany({ orderBy: [{ categoria: "asc" }, { nombre: "asc" }] }),
  ]);
  const opciones = productos.map((p) => ({ id: p.id, nombre: p.nombre, unidad: p.unidad, precio: toNumber(p.precio) }));
  const inicial = Number(producto);
  const datos = { direccion: cliente.direccion ?? "", minima: claveDia(new Date()) };

  return (
    <>
      <PageHeader titulo="Nuevo pedido" descripcion="Precios de lista; su vendedor confirma la planta de despacho y la fecha de entrega." />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title="Desde el catálogo" />
          <CardBody><PedidoCatalogo productos={opciones} inicial={opciones.some((o) => o.id === inicial) ? inicial : undefined} {...datos} /></CardBody>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader
            title="Desde un archivo CSV"
            description="Útil si su sistema de compras exporta la lista de materiales."
            action={<a href="/api/reportes/plantilla-pedido" download className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"><Download className="size-3.5" aria-hidden /> Plantilla</a>}
          />
          <CardBody><PedidoCsv {...datos} /></CardBody>
        </Card>
      </div>
    </>
  );
}
