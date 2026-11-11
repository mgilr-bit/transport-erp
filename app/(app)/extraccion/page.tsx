import type { Metadata } from "next";
import { Gem, Layers, Mountain, Pickaxe } from "lucide-react";
import { prisma } from "@/lib/db";
import { puedeOperar, requireGiro } from "@/lib/auth";
import { formatFecha, formatNum, formatQ, toNumber } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Exportar } from "@/components/ui/exportar";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Barras } from "@/components/charts/barras";
import { NuevaExtraccion } from "./formularios";

export const metadata: Metadata = { title: "Extracción minera" };

export default async function ExtraccionPage() {
  const session = await requireGiro("EXTRACCION");
  const ahora = new Date();
  const hace30 = new Date(ahora.getTime() - 30 * 86_400_000);
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

  const [minas, materiales, registros, porMina, porMaterial, delMes] = await Promise.all([
    prisma.sede.findMany({ where: { tipo: "MINA" }, include: { inventarios: { include: { material: true }, orderBy: { material: { nombre: "asc" } } } }, orderBy: { nombre: "asc" } }),
    prisma.material.findMany({ where: { esMateriaPrima: true }, orderBy: { nombre: "asc" } }),
    prisma.registroExtraccion.findMany({ include: { sede: true, material: true }, orderBy: [{ fecha: "desc" }, { id: "desc" }], take: 25 }),
    prisma.registroExtraccion.groupBy({ by: ["sedeId"], where: { fecha: { gte: hace30 } }, _sum: { toneladas: true } }),
    prisma.registroExtraccion.groupBy({ by: ["materialId"], where: { fecha: { gte: hace30 } }, _sum: { toneladas: true } }),
    prisma.registroExtraccion.findMany({ where: { fecha: { gte: inicioMes } }, select: { toneladas: true, material: { select: { precioRef: true } } } }),
  ]);

  const tonMes = delMes.reduce((s, r) => s + toNumber(r.toneladas), 0);
  const valorMes = delMes.reduce((s, r) => s + toNumber(r.toneladas) * toNumber(r.material.precioRef), 0);
  const inventarioTotal = minas.flatMap((m) => m.inventarios).reduce((s, i) => s + toNumber(i.cantidad), 0);
  const ton30 = porMina.reduce((s, m) => s + toNumber(m._sum.toneladas), 0);

  const datosMina = minas.map((m) => ({ mina: m.nombre.replace("Planta de Extracción ", ""), toneladas: Math.round(toNumber(porMina.find((p) => p.sedeId === m.id)?._sum.toneladas)) }));
  const datosMaterial = porMaterial
    .map((p) => ({ material: materiales.find((m) => m.id === p.materialId)?.nombre ?? "", toneladas: Math.round(toNumber(p._sum.toneladas)) }))
    .sort((a, b) => b.toneladas - a.toneladas);

  return (
    <>
      <PageHeader
        titulo="Extracción minera"
        descripcion="Producción de las plantas de extracción e inventario de materia prima disponible para las plantas de proceso."
        acciones={
          <>
            <Exportar href="/api/reportes/extraccion" texto="Extracción CSV" />
            <Exportar href="/api/reportes/inventario" texto="Inventario CSV" />
            {puedeOperar(session, "EXTRACCION") && <NuevaExtraccion minas={minas.map((m) => ({ id: m.id, texto: `${m.nombre} (${m.departamento})` }))} materiales={materiales.map((m) => ({ id: m.id, texto: m.nombre }))} />}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat etiqueta="Extraído este mes" valor={`${formatNum(tonMes)} t`} detalle={`${formatNum(ton30)} t en los últimos 30 días`} icono={Pickaxe} tono="amber" />
        <Stat etiqueta="Valor de lo extraído" valor={formatQ(valorMes, true)} detalle="Mes en curso, a precio de referencia" icono={Gem} tono="green" />
        <Stat etiqueta="Inventario en minas" valor={`${formatNum(inventarioTotal)} t`} detalle="Disponible para las plantas" icono={Layers} tono="blue" />
        <Stat etiqueta="Plantas de extracción" valor={minas.length} detalle={minas.map((m) => m.departamento).join(" · ")} icono={Mountain} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Toneladas por planta" description="Últimos 30 días" />
          <CardBody><Barras datos={datosMina} ejeX="mina" valor="toneladas" nombre="Toneladas" color="#b45309" /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Toneladas por material" description="Últimos 30 días" />
          <CardBody><Barras datos={datosMaterial} ejeX="material" valor="toneladas" nombre="Toneladas" color="#b45309" horizontal altura={280} /></CardBody>
        </Card>
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-slate-900">Inventario por planta</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {minas.map((m) => (
          <Card key={m.id}>
            <CardHeader title={m.nombre.replace("Planta de Extracción ", "")} description={m.direccion} />
            <ul className="divide-y divide-slate-100 px-5 py-2 text-sm">
              {m.inventarios.filter((i) => toNumber(i.cantidad) > 0).map((i) => {
                const bajo = toNumber(i.cantidad) < toNumber(i.material.stockMinimo);
                return (
                  <li key={i.id} className="flex items-center justify-between py-2">
                    <span className="text-slate-700">{i.material.nombre}</span>
                    <span className="flex items-center gap-2 tabular">
                      {bajo && <Badge tono="ambar">Bajo</Badge>}
                      <span className="font-medium text-slate-900">{formatNum(i.cantidad)} t</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader title="Últimos registros de extracción" />
        <Table>
          <thead><tr><Th>Fecha</Th><Th>Planta</Th><Th>Material</Th><Th>Turno</Th><Th className="text-right">Toneladas</Th><Th className="text-right">Valor ref.</Th></tr></thead>
          <tbody>
            {registros.map((r) => (
              <Tr key={r.id}>
                <Td className="whitespace-nowrap">{formatFecha(r.fecha)}</Td>
                <Td>{r.sede.nombre}</Td>
                <Td>{r.material.nombre}</Td>
                <Td>{r.turno}</Td>
                <Td className="text-right font-medium text-slate-900">{formatNum(r.toneladas, 2)}</Td>
                <Td className="text-right">{formatQ(toNumber(r.toneladas) * toNumber(r.material.precioRef))}</Td>
              </Tr>
            ))}
            {!registros.length && <EmptyRow cols={6} />}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
