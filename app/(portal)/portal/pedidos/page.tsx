import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireCliente } from "@/lib/auth";
import { CANALES_PEDIDO } from "@/lib/constants";
import { formatFecha, formatNum, formatQ } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { EstadoBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { CancelarPedido } from "../formularios";

export const metadata: Metadata = { title: "Pedidos" };

export default async function PedidosPortalPage() {
  const { clienteId } = await requireCliente();
  const pedidos = await prisma.pedido.findMany({
    where: { clienteId },
    include: { items: { include: { producto: { select: { nombre: true, unidad: true } } } }, viaje: { select: { codigo: true, estado: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <>
      <PageHeader
        titulo="Pedidos"
        descripcion="Pisos cerámicos y materiales de las plantas de proceso. Puede cancelar un pedido mientras la planta no lo confirme."
        acciones={<Link href="/portal/pedidos/nuevo" className={buttonClass("primario")}>Nuevo pedido</Link>}
      />
      <Card>
        <Table>
          <thead><tr><Th>Pedido</Th><Th>Productos</Th><Th className="text-right">Total</Th><Th>Requerido</Th><Th>Despacho</Th><Th>Estado</Th><Th /></tr></thead>
          <tbody>
            {pedidos.map((p) => (
              <Tr key={p.id}>
                <Td><p className="font-mono text-xs font-medium text-slate-900">{p.codigo}</p><p className="text-[11px] text-slate-500">{formatFecha(p.createdAt)} · {CANALES_PEDIDO[p.canal]}</p></Td>
                <Td className="max-w-80 text-xs">
                  {p.items.map((i) => <p key={i.id} className="truncate">{i.producto.nombre} · {formatNum(i.cantidad, 2)} {i.producto.unidad}</p>)}
                </Td>
                <Td className="text-right font-medium text-slate-900">{formatQ(p.total)}</Td>
                <Td className="text-xs whitespace-nowrap">{formatFecha(p.fechaRequerida)}</Td>
                <Td className="text-xs">{p.viaje ? <>Viaje {p.viaje.codigo}<EstadoBadge estado={p.viaje.estado} /></> : "—"}</Td>
                <Td><EstadoBadge estado={p.estado} /></Td>
                <Td className="text-right">{p.estado === "SOLICITADO" && <CancelarPedido id={p.id} codigo={p.codigo} />}</Td>
              </Tr>
            ))}
            {!pedidos.length && <EmptyRow cols={7}>Aún no tiene pedidos</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
