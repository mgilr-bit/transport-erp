import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleCheck, Clock, Mountain, Truck } from "lucide-react";
import { prisma } from "@/lib/db";
import { puedeAprobar, puedeOperar, requireGiro } from "@/lib/auth";
import { cn, formatFecha, formatNum, toNumber } from "@/lib/utils";
import type { EstadoSolicitud, Prisma } from "@/app/generated/prisma/client";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Filtro } from "@/components/ui/filtro";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge, EstadoBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { POR_PAGINA, Paginacion, paginaDe } from "@/components/ui/paginacion";
import { Barras } from "@/components/charts/barras";
import { NuevaSolicitud } from "@/app/(app)/proceso/formularios";
import { AprobarSolicitud, RechazarSolicitud } from "./formularios";

export const metadata: Metadata = { title: "Flujo de materia prima" };

const ETAPAS: { estado: EstadoSolicitud; titulo: string; detalle: string }[] = [
  { estado: "PENDIENTE", titulo: "Solicitada", detalle: "La planta pide material" },
  { estado: "APROBADA", titulo: "Aprobada", detalle: "Origen asignado: mina o proveedor" },
  { estado: "EN_TRANSITO", titulo: "En tránsito", detalle: "Transporte de MP en ruta" },
  { estado: "RECIBIDA", titulo: "Recibida", detalle: "Ingresa al inventario de la planta" },
];
const ESTADOS: EstadoSolicitud[] = ["PENDIENTE", "APROBADA", "EN_TRANSITO", "RECIBIDA", "RECHAZADA"];

export default async function FlujoPage({ searchParams }: PageProps<"/flujo">) {
  const session = await requireGiro("PROCESO", "EXTRACCION", "TRANSPORTE_MP");
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const estadoParam = str(sp.estado) as EstadoSolicitud | undefined;
  const estado = estadoParam && ESTADOS.includes(estadoParam) ? estadoParam : undefined;
  const pagina = paginaDe(sp.pagina);

  const operaProceso = puedeOperar(session, "PROCESO");
  const operaTransporte = puedeOperar(session, "TRANSPORTE_MP");
  // Aprobar es de la gerencia: Extracción solo despacha desde minas; Proceso también compra a terceros
  const apruebaProceso = puedeAprobar(session, "PROCESO");
  const apruebaExtraccion = puedeAprobar(session, "EXTRACCION");
  const hace90 = new Date(new Date().getTime() - 90 * 86_400_000);
  const where: Prisma.SolicitudMateriaPrimaWhereInput = estado ? { estado } : {};

  const [solicitudes, total, porEstado, porOrigen, minas, proveedores, plantas, materiales] = await Promise.all([
    prisma.solicitudMateriaPrima.findMany({
      where,
      include: { planta: true, mina: true, proveedor: true, material: true, viaje: { select: { codigo: true, estado: true } } },
      orderBy: [{ createdAt: "desc" }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    prisma.solicitudMateriaPrima.count({ where }),
    prisma.solicitudMateriaPrima.groupBy({ by: ["estado"], _count: true, _sum: { toneladas: true } }),
    prisma.solicitudMateriaPrima.groupBy({
      by: ["minaId", "proveedorId"],
      where: { estado: { in: ["APROBADA", "EN_TRANSITO", "RECIBIDA"] }, createdAt: { gte: hace90 } },
      _sum: { toneladas: true },
    }),
    prisma.sede.findMany({ where: { tipo: "MINA" }, include: { inventarios: true }, orderBy: { nombre: "asc" } }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
    prisma.sede.findMany({ where: { tipo: "PLANTA_PROCESO" }, orderBy: { nombre: "asc" } }),
    prisma.material.findMany({ where: { esMateriaPrima: true }, orderBy: { nombre: "asc" } }),
  ]);

  const etapa = (e: EstadoSolicitud) => porEstado.find((p) => p.estado === e);
  const ton = (e: EstadoSolicitud) => toNumber(etapa(e)?._sum.toneladas);
  const cuenta = (e: EstadoSolicitud) => etapa(e)?._count ?? 0;

  const tonMinas = porOrigen.filter((o) => o.minaId).reduce((s, o) => s + toNumber(o._sum.toneladas), 0);
  const tonTerceros = porOrigen.filter((o) => o.proveedorId).reduce((s, o) => s + toNumber(o._sum.toneladas), 0);
  const pctPropio = tonMinas + tonTerceros > 0 ? (tonMinas / (tonMinas + tonTerceros)) * 100 : 0;
  const datosOrigen = porOrigen
    .map((o) => ({
      origen: o.minaId
        ? (minas.find((m) => m.id === o.minaId)?.nombre.replace("Planta de Extracción ", "Mina ") ?? "")
        : (proveedores.find((p) => p.id === o.proveedorId)?.nombre ?? ""),
      toneladas: Math.round(toNumber(o._sum.toneladas)),
    }))
    .sort((a, b) => b.toneladas - a.toneladas);

  const nombreMina = (n: string) => n.replace("Planta de Extracción ", "Mina ");

  return (
    <>
      <PageHeader
        titulo="Flujo de materia prima"
        descripcion="Las plantas de proceso solicitan materia prima; Extracción la despacha desde sus minas o se compra a un proveedor tercero, y Transporte de MP la traslada."
        acciones={operaProceso && <NuevaSolicitud plantas={plantas.map((p) => ({ id: p.id, texto: p.nombre }))} materiales={materiales.map((m) => ({ id: m.id, texto: m.nombre }))} variante="primario" />}
      />

      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ETAPAS.map((e, i) => (
          <li key={e.estado} className="relative">
            <Link
              href={`/flujo?estado=${e.estado}`}
              className={cn(
                "block rounded-xl border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300",
                estado === e.estado ? "border-brand-500 ring-1 ring-brand-500" : "border-slate-200",
              )}
            >
              <p className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <span className="grid size-5 place-items-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">{i + 1}</span>
                {e.titulo}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 tabular">{cuenta(e.estado)}</p>
              <p className="text-xs text-slate-500 tabular">{formatNum(ton(e.estado))} t · {e.detalle}</p>
            </Link>
            {i < ETAPAS.length - 1 && <ArrowRight className="absolute top-1/2 -right-3 z-10 hidden size-4 -translate-y-1/2 text-slate-300 xl:block" aria-hidden />}
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="grid content-start gap-4">
          <Stat etiqueta="Abastecimiento propio" valor={`${pctPropio.toFixed(0)}%`} detalle={`${formatNum(tonMinas)} t de minas propias · ${formatNum(tonTerceros)} t de terceros (90 días)`} icono={Mountain} tono="amber" />
          <Stat etiqueta="Esperando transporte" valor={cuenta("APROBADA")} detalle="Solicitudes aprobadas sin viaje programado" icono={Truck} tono={cuenta("APROBADA") ? "violet" : "slate"} />
          <Stat etiqueta="Por aprobar" valor={cuenta("PENDIENTE")} detalle={`${formatNum(ton("PENDIENTE"))} t solicitadas`} icono={Clock} tono={cuenta("PENDIENTE") ? "blue" : "slate"} />
        </div>
        <Card className="lg:col-span-2">
          <CardHeader title="Toneladas por origen" description="Solicitudes aprobadas en los últimos 90 días" />
          <CardBody><Barras datos={datosOrigen} ejeX="origen" valor="toneladas" nombre="Toneladas" color="#b45309" horizontal altura={Math.max(220, datosOrigen.length * 34)} /></CardBody>
        </Card>
      </div>

      <Card className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-4 py-3">
          <Filtro param="estado" etiqueta="Estado" opciones={ESTADOS.map((e) => ({ valor: e, texto: e === "EN_TRANSITO" ? "En tránsito" : e.charAt(0) + e.slice(1).toLowerCase() }))} />
          {cuenta("APROBADA") > 0 && operaTransporte && (
            <Link href="/transporte?tipo=MATERIA_PRIMA" className={buttonClass("secundario", "sm")}>
              <Truck className="size-3.5" /> Programar traslados
            </Link>
          )}
        </div>
        <Table>
          <thead>
            <tr><Th>Código</Th><Th>Material</Th><Th>Planta solicitante</Th><Th>Origen</Th><Th>Requerida</Th><Th>Traslado</Th><Th>Estado</Th><Th /></tr>
          </thead>
          <tbody>
            {solicitudes.map((s) => {
              const tonS = toNumber(s.toneladas);
              const opcMinas = minas.map((m) => {
                const stock = toNumber(m.inventarios.find((i) => i.materialId === s.materialId)?.cantidad);
                return { valor: `mina:${m.id}`, texto: `${nombreMina(m.nombre)} · ${formatNum(stock)} t disponibles`, suficiente: stock >= tonS };
              });
              const opcProv = apruebaProceso
                ? proveedores.map((p) => ({ valor: `proveedor:${p.id}`, texto: `${p.nombre} · ${p.materiales}`, suficiente: true }))
                : [];
              return (
                <Tr key={s.id}>
                  <Td className="font-mono text-xs whitespace-nowrap text-slate-900">{s.codigo}</Td>
                  <Td><p className="font-medium text-slate-900">{s.material.nombre}</p><p className="text-xs text-slate-500 tabular">{formatNum(tonS, 1)} t</p></Td>
                  <Td className="text-xs">{s.planta.nombre}</Td>
                  <Td className="text-xs">
                    {s.mina ? <span className="inline-flex items-center gap-1.5"><Mountain className="size-3.5 text-amber-600" aria-hidden />{nombreMina(s.mina.nombre)}</span>
                      : s.proveedor ? <span className="inline-flex items-center gap-1.5"><Badge>Tercero</Badge>{s.proveedor.nombre}</span>
                      : <span className="text-slate-400">Sin asignar</span>}
                  </Td>
                  <Td className="text-xs whitespace-nowrap">{formatFecha(s.fechaRequerida)}</Td>
                  <Td className="text-xs">
                    {s.viaje ? <span className="inline-flex items-center gap-1.5 font-mono">{s.viaje.codigo}{s.viaje.estado === "ENTREGADO" && <CircleCheck className="size-3.5 text-emerald-600" aria-label="Entregado" />}</span> : <span className="text-slate-400">—</span>}
                  </Td>
                  <Td>
                    <EstadoBadge estado={s.estado} />
                    {s.estado === "RECHAZADA" && s.notas && <p className="mt-1 max-w-48 text-xs text-slate-500">{s.notas}</p>}
                  </Td>
                  <Td>
                    {s.estado === "PENDIENTE" && (apruebaProceso || apruebaExtraccion) && (
                      <div className="flex justify-end gap-1.5">
                        <AprobarSolicitud id={s.id} codigo={s.codigo} minas={opcMinas} proveedores={opcProv} />
                        <RechazarSolicitud id={s.id} codigo={s.codigo} />
                      </div>
                    )}
                  </Td>
                </Tr>
              );
            })}
            {!solicitudes.length && <EmptyRow cols={8} />}
          </tbody>
        </Table>
        <Paginacion total={total} pagina={pagina} base="/flujo" params={{ estado }} />
      </Card>
    </>
  );
}
