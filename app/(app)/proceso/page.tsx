import type { Metadata } from "next";
import { Boxes, ClipboardList, Factory, PackageCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { puedeOperar, requireGiro } from "@/lib/auth";
import { formatFecha, formatNum, formatQ, toNumber } from "@/lib/utils";
import type { Prisma } from "@/app/generated/prisma/client";
import { Card, CardHeader } from "@/components/ui/card";
import { Exportar } from "@/components/ui/exportar";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Tabs } from "@/components/ui/tabs";
import { Filtro } from "@/components/ui/filtro";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge, EstadoBadge } from "@/components/ui/badge";
import { POR_PAGINA, Paginacion, paginaDe } from "@/components/ui/paginacion";
import { AccionesOrden, NuevaOrden, NuevaSolicitud } from "./formularios";

export const metadata: Metadata = { title: "Plantas de proceso" };

export default async function ProcesoPage({ searchParams }: PageProps<"/proceso">) {
  const session = await requireGiro("PROCESO");
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const tab = str(sp.tab) ?? "ordenes";
  const planta = str(sp.planta);
  const pagina = paginaDe(sp.pagina);
  const puede = puedeOperar(session, "PROCESO");
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const where: Prisma.OrdenProduccionWhereInput = planta ? { sedeId: Number(planta) } : {};
  const [plantas, productos, materiales, ordenes, totalOrdenes, conteo, completadasMes] = await Promise.all([
    prisma.sede.findMany({ where: { tipo: "PLANTA_PROCESO" }, include: { inventarios: { include: { material: true }, orderBy: { material: { nombre: "asc" } } } }, orderBy: { nombre: "asc" } }),
    prisma.producto.findMany({ include: { insumos: { include: { material: true } } }, orderBy: { categoria: "asc" } }),
    prisma.material.findMany({ orderBy: { nombre: "asc" } }),
    prisma.ordenProduccion.findMany({ where, include: { sede: true, producto: true }, orderBy: [{ fechaInicio: "desc" }], skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA }),
    prisma.ordenProduccion.count({ where }),
    prisma.ordenProduccion.groupBy({ by: ["estado"], where, _count: true }),
    prisma.ordenProduccion.findMany({ where: { ...where, estado: "COMPLETADA", fechaFin: { gte: inicioMes } }, include: { producto: true } }),
  ]);
  const cuenta = (e: string) => conteo.find((c) => c.estado === e)?._count ?? 0;
  const valorMes = completadasMes.reduce((s, o) => s + toNumber(o.cantidad) * toNumber(o.producto.precio), 0);
  const opcPlantas = plantas.map((p) => ({ id: p.id, texto: p.nombre }));

  return (
    <>
      <PageHeader
        titulo="Plantas de proceso"
        descripcion="Producción de pisos cerámicos y materiales de construcción en Zacapa, Huehuetenango y Petén."
        acciones={
          <>
            <Exportar href="/api/reportes/produccion" texto="Producción CSV" />
            <Exportar href="/api/reportes/inventario" texto="Inventario CSV" />
            {puede && (
              <>
                <NuevaSolicitud plantas={opcPlantas} materiales={materiales.map((m) => ({ id: m.id, texto: m.nombre }))} />
                <NuevaOrden plantas={opcPlantas} productos={productos.map((p) => ({ id: p.id, texto: `${p.nombre} (${p.unidad})` }))} />
              </>
            )}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat etiqueta="Producción terminada (mes)" valor={formatQ(valorMes, true)} detalle={`${completadasMes.length} órdenes completadas`} icono={PackageCheck} tono="green" />
        <Stat etiqueta="Órdenes en proceso" valor={cuenta("EN_PROCESO")} detalle={`${cuenta("PLANIFICADA")} planificadas`} icono={ClipboardList} tono="violet" />
        <Stat etiqueta="Catálogo" valor={productos.length} detalle="Productos con receta definida" icono={Boxes} tono="blue" />
        <Stat etiqueta="Plantas" valor={plantas.length} detalle={plantas.map((p) => p.departamento).join(" · ")} icono={Factory} />
      </div>

      <div className="mt-8">
        <Tabs base="/proceso" activa={tab} params={{ planta }} tabs={[{ id: "ordenes", label: "Órdenes de producción", total: totalOrdenes }, { id: "inventario", label: "Inventario de insumos" }, { id: "productos", label: "Productos y recetas", total: productos.length }]} />

        {tab === "ordenes" && (
          <Card>
            <div className="border-b border-slate-100 px-4 py-3">
              <Filtro param="planta" etiqueta="Planta" todos="Todas" opciones={plantas.map((p) => ({ valor: String(p.id), texto: p.nombre }))} />
            </div>
            <Table>
              <thead><tr><Th>Código</Th><Th>Producto</Th><Th>Planta</Th><Th className="text-right">Cantidad</Th><Th className="text-right">Valor</Th><Th>Inicio</Th><Th>Fin</Th><Th>Estado</Th><Th /></tr></thead>
              <tbody>
                {ordenes.map((o) => (
                  <Tr key={o.id}>
                    <Td className="font-mono text-xs text-slate-900">{o.codigo}</Td>
                    <Td><p className="font-medium text-slate-900">{o.producto.nombre}</p><p className="text-xs text-slate-500">{o.producto.categoria}</p></Td>
                    <Td className="text-xs">{o.sede.nombre}</Td>
                    <Td className="text-right whitespace-nowrap">{formatNum(o.cantidad)} {o.producto.unidad}</Td>
                    <Td className="text-right">{formatQ(toNumber(o.cantidad) * toNumber(o.producto.precio), true)}</Td>
                    <Td className="text-xs whitespace-nowrap">{formatFecha(o.fechaInicio)}</Td>
                    <Td className="text-xs whitespace-nowrap">{formatFecha(o.fechaFin)}</Td>
                    <Td><EstadoBadge estado={o.estado} /></Td>
                    <Td className="text-right">{puede && <AccionesOrden id={o.id} estado={o.estado} />}</Td>
                  </Tr>
                ))}
                {!ordenes.length && <EmptyRow cols={9} />}
              </tbody>
            </Table>
            <Paginacion total={totalOrdenes} pagina={pagina} base="/proceso" params={{ planta, tab }} />
          </Card>
        )}

        {tab === "inventario" && (
          <Card>
            <Table>
              <thead>
                <tr><Th>Material</Th>{plantas.map((p) => <Th key={p.id} className="text-right">{p.nombre.replace("Planta de Proceso ", "")}</Th>)}<Th className="text-right">Mínimo</Th></tr>
              </thead>
              <tbody>
                {materiales.map((m) => (
                  <Tr key={m.id}>
                    <Td className="font-medium text-slate-900">{m.nombre}</Td>
                    {plantas.map((p) => {
                      const cant = toNumber(p.inventarios.find((i) => i.materialId === m.id)?.cantidad);
                      const bajo = cant < toNumber(m.stockMinimo);
                      return (
                        <Td key={p.id} className="text-right">
                          <span className="inline-flex items-center gap-2">
                            {bajo && <Badge tono="ambar">Bajo</Badge>}
                            <span className={bajo ? "font-medium text-amber-800" : ""}>{formatNum(cant, 1)} t</span>
                          </span>
                        </Td>
                      );
                    })}
                    <Td className="text-right text-slate-500">{formatNum(m.stockMinimo)} t</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}

        {tab === "productos" && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {productos.map((p) => (
              <Card key={p.id}>
                <CardHeader title={p.nombre} description={`${p.categoria} · ${formatQ(p.precio)} / ${p.unidad}`} />
                <div className="px-5 py-3">
                  <p className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase">Receta por {p.unidad}</p>
                  <ul className="space-y-1.5 text-sm">
                    {p.insumos.map((i) => (
                      <li key={i.id} className="flex justify-between">
                        <span className="text-slate-700">{i.material.nombre}</span>
                        <span className="text-slate-900 tabular">{formatNum(toNumber(i.cantidadPorUnidad) * 1000, 1)} kg</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
