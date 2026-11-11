import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireCliente } from "@/lib/auth";
import { estadoDeCuenta } from "@/lib/services/reportes";
import { formatFecha, formatQ } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Filtro } from "@/components/ui/filtro";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { EstadoBadge } from "@/components/ui/badge";
import { Exportar } from "@/components/ui/exportar";
import { Imprimir } from "@/components/ui/imprimir";

export const metadata: Metadata = { title: "Estado de cuenta" };

export default async function EstadoDeCuentaPage({ searchParams }: PageProps<"/portal/estado-de-cuenta">) {
  const { clienteId } = await requireCliente();
  const actual = new Date().getFullYear();
  const anios = [actual, actual - 1, actual - 2];
  const param = Number((await searchParams).anio);
  const anio = anios.includes(param) ? param : actual;
  const [cliente, movimientos] = await Promise.all([prisma.cliente.findUniqueOrThrow({ where: { id: clienteId } }), estadoDeCuenta(clienteId, anio)]);
  const total = movimientos.filter((m) => m.estado !== "CANCELADO").reduce((s, m) => s + m.monto, 0);

  return (
    <>
      <PageHeader
        titulo="Estado de cuenta"
        descripcion={`${cliente.nombre} · NIT ${cliente.nit} · Año ${anio}. Fletes, alquileres, compras de maquinaria y pedidos con todas las empresas del grupo.`}
        acciones={
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <Filtro param="anio" etiqueta="Año" todos={null} opciones={anios.map((a) => ({ valor: String(a), texto: String(a) }))} />
            <Exportar href={`/api/reportes/estado-de-cuenta?anio=${anio}`} />
            <Imprimir />
          </div>
        }
      />
      <Card>
        <Table>
          <thead><tr><Th>Fecha</Th><Th>Empresa</Th><Th>Concepto</Th><Th>Documento</Th><Th>Estado</Th><Th className="text-right">Monto</Th></tr></thead>
          <tbody>
            {movimientos.map((m) => (
              <Tr key={m.documento}>
                <Td className="text-xs whitespace-nowrap">{formatFecha(m.fecha)}</Td>
                <Td className="text-xs">{m.empresa}</Td>
                <Td className="max-w-80 text-xs"><p className="truncate">{m.concepto}</p></Td>
                <Td className="font-mono text-xs">{m.documento}</Td>
                <Td><EstadoBadge estado={m.estado} /></Td>
                <Td className="text-right font-medium text-slate-900">{formatQ(m.monto)}</Td>
              </Tr>
            ))}
            {!movimientos.length && <EmptyRow cols={6}>Sin movimientos en {anio}</EmptyRow>}
            {movimientos.length > 0 && (
              <Tr className="bg-slate-50 font-semibold"><Td colSpan={5}>Total del año</Td><Td className="text-right">{formatQ(total)}</Td></Tr>
            )}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
