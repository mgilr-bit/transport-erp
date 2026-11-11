import type { Metadata } from "next";
import { CircleDollarSign, Route, Truck, Wrench } from "lucide-react";
import { prisma } from "@/lib/db";
import { puedeOperar, puedeVerGiro, requireGiro } from "@/lib/auth";
import { GIROS, MODALIDADES } from "@/lib/constants";
import { formatFecha, formatNum, formatQ, toNumber } from "@/lib/utils";
import type { GiroNegocio, Prisma, TipoViaje } from "@/app/generated/prisma/client";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Tabs } from "@/components/ui/tabs";
import { Filtro } from "@/components/ui/filtro";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge, EstadoBadge } from "@/components/ui/badge";
import { POR_PAGINA, Paginacion, paginaDe } from "@/components/ui/paginacion";
import { NuevoViaje } from "./viaje-form";
import { NuevoCamion } from "./camion-form";
import { AccionesViaje } from "./acciones-viaje";

export const metadata: Metadata = { title: "Transporte" };

const GIRO_DE: Record<TipoViaje, GiroNegocio> = { MATERIA_PRIMA: "TRANSPORTE_MP", PRODUCTO: "TRANSPORTE_PROD" };

export default async function TransportePage({ searchParams }: PageProps<"/transporte">) {
  const session = await requireGiro("TRANSPORTE_MP", "TRANSPORTE_PROD");
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const tiposVisibles = (["MATERIA_PRIMA", "PRODUCTO"] as TipoViaje[]).filter((t) => puedeVerGiro(session, GIRO_DE[t]));
  const tiposOperables = tiposVisibles.filter((t) => puedeOperar(session, GIRO_DE[t]));
  const tipoParam = str(sp.tipo) as TipoViaje | undefined;
  const tipo = tipoParam && tiposVisibles.includes(tipoParam) ? tipoParam : tiposVisibles.length === 1 ? tiposVisibles[0] : undefined;
  const estado = str(sp.estado);
  const tab = str(sp.tab) ?? "viajes";
  const pagina = paginaDe(sp.pagina);
  const girosVisibles = tiposVisibles.map((t) => GIRO_DE[t]);

  const whereViaje: Prisma.ViajeWhereInput = {
    tipo: tipo ?? { in: tiposVisibles },
    ...(estado ? { estado: estado as Prisma.EnumEstadoViajeFilter["equals"] } : {}),
  };
  const whereCamion: Prisma.CamionWhereInput = { giro: tipo ? GIRO_DE[tipo] : { in: girosVisibles } };
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [viajes, totalViajes, camiones, pilotos, flota, facturado, kmMes, clientes, solicitudes, centros, pedidos] = await Promise.all([
    prisma.viaje.findMany({
      where: whereViaje,
      include: { camion: { select: { placa: true } }, piloto: { select: { nombre: true } }, cliente: { select: { nombre: true } }, solicitud: { select: { codigo: true } }, pedido: { select: { codigo: true } } },
      orderBy: { fechaSalida: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    prisma.viaje.count({ where: whereViaje }),
    prisma.camion.findMany({ where: whereCamion, include: { sede: { select: { nombre: true } }, _count: { select: { viajes: true } } }, orderBy: { placa: "asc" } }),
    prisma.piloto.findMany({ include: { viajes: { where: { estado: { in: ["PROGRAMADO", "EN_CURSO"] } }, select: { codigo: true } }, _count: { select: { viajes: true } } }, orderBy: { nombre: "asc" } }),
    prisma.camion.groupBy({ by: ["estado"], where: whereCamion, _count: true }),
    prisma.viaje.aggregate({ where: { ...whereViaje, estado: "ENTREGADO", fechaEntrega: { gte: inicioMes } }, _sum: { tarifa: true }, _count: true }),
    prisma.viaje.aggregate({ where: { tipo: tipo ?? { in: tiposVisibles }, estado: "ENTREGADO", fechaEntrega: { gte: inicioMes } }, _sum: { distanciaKm: true } }),
    prisma.cliente.findMany({ select: { id: true, nombre: true, tipo: true }, orderBy: { nombre: "asc" } }),
    prisma.solicitudMateriaPrima.findMany({ where: { estado: "APROBADA" }, include: { planta: true, mina: true, proveedor: true, material: true } }),
    prisma.sede.findMany({ where: { tipo: "CENTRO_TRANSPORTE", giro: { in: girosVisibles } }, select: { id: true, nombre: true } }),
    // Pedidos de Plantas de proceso listos para despacho
    prisma.pedido.findMany({
      where: { estado: "EN_PREPARACION", viaje: null },
      include: { cliente: { select: { nombre: true } }, planta: { select: { nombre: true } }, items: { include: { producto: { select: { nombre: true } } } } },
      orderBy: { fechaRequerida: "asc" },
    }),
  ]);
  const cuenta = (e: string) => flota.find((f) => f.estado === e)?._count ?? 0;
  const params = { tipo: str(sp.tipo), estado, tab };

  return (
    <>
      <PageHeader
        titulo="Transporte"
        descripcion="Viajes de materia prima (Cemex, Cementos Progreso, Hispacensa y plantas propias) y de productos: inter puertos, inter fronteras y puerto ↔ bodega."
        acciones={
          tiposOperables.length > 0 && (
            <>
              <NuevoCamion giros={tiposOperables.map((t) => ({ valor: GIRO_DE[t], texto: t === "MATERIA_PRIMA" ? "Transporte de materia prima" : "Transporte de productos" }))} sedes={centros.map((c) => ({ id: c.id, texto: c.nombre }))} />
              <NuevoViaje
                tipos={tiposOperables}
                camiones={camiones.filter((c) => c.estado === "DISPONIBLE" && tiposOperables.some((t) => GIRO_DE[t] === c.giro)).map((c) => ({ id: c.id, texto: `${c.placa} · ${c.tipo} · ${toNumber(c.capacidadTon)} t`, tipo: c.giro === "TRANSPORTE_MP" ? "MATERIA_PRIMA" : "PRODUCTO", capacidad: toNumber(c.capacidadTon) }))}
                pilotos={pilotos.filter((p) => p.activo && p.viajes.length === 0).map((p) => ({ id: p.id, texto: `${p.nombre} · Lic. ${p.licencia}` }))}
                clientes={clientes.map((c) => ({ id: c.id, texto: `${c.nombre}${c.tipo === "EXTRANJERO" ? " (extranjero)" : ""}` }))}
                solicitudes={solicitudes.map((s) => ({
                  id: s.id,
                  texto: `${s.codigo} · ${s.material.nombre} ${toNumber(s.toneladas)} t → ${s.planta.nombre}`,
                  origen: s.mina?.nombre ?? s.proveedor?.nombre ?? "",
                  destino: s.planta.nombre,
                  carga: s.material.nombre,
                  toneladas: toNumber(s.toneladas),
                }))}
                pedidos={pedidos.map((p) => ({
                  id: p.id,
                  texto: `${p.codigo} · ${p.cliente?.nombre ?? (p.giroSolicitante ? GIROS[p.giroSolicitante].corto : "Interno")} · ${p.items.length} producto${p.items.length === 1 ? "" : "s"}`,
                  origen: p.planta?.nombre ?? "Planta de proceso",
                  destino: p.direccionEntrega,
                  carga: p.items.map((i) => i.producto.nombre).join(", ").slice(0, 120),
                }))}
              />
            </>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat etiqueta="Facturado este mes" valor={formatQ(facturado._sum.tarifa, true)} detalle={`${facturado._count} viajes entregados`} icono={CircleDollarSign} tono="green" />
        <Stat etiqueta="Kilómetros recorridos" valor={formatNum(kmMes._sum.distanciaKm)} detalle="Viajes entregados en el mes" icono={Route} tono="blue" />
        <Stat etiqueta="Unidades en ruta" valor={`${cuenta("EN_RUTA")} / ${camiones.length}`} detalle={`${cuenta("DISPONIBLE")} disponibles`} icono={Truck} tono="violet" />
        <Stat etiqueta="En mantenimiento" valor={cuenta("MANTENIMIENTO")} detalle="Unidades fuera de servicio" icono={Wrench} tono={cuenta("MANTENIMIENTO") ? "amber" : "slate"} />
      </div>

      <div className="mt-8">
        <Tabs base="/transporte" activa={tab} params={{ tipo: str(sp.tipo) }} tabs={[{ id: "viajes", label: "Viajes", total: totalViajes }, { id: "flota", label: "Flota", total: camiones.length }, { id: "pilotos", label: "Pilotos", total: pilotos.length }]} />

        {tab === "viajes" && (
          <Card>
            <div className="flex flex-wrap gap-4 border-b border-slate-100 px-4 py-3">
              {tiposVisibles.length > 1 && <Filtro param="tipo" etiqueta="Tipo" opciones={[{ valor: "MATERIA_PRIMA", texto: "Materia prima" }, { valor: "PRODUCTO", texto: "Productos" }]} />}
              <Filtro param="estado" etiqueta="Estado" opciones={["PROGRAMADO", "EN_CURSO", "ENTREGADO", "CANCELADO"].map((e) => ({ valor: e, texto: e.replace("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) }))} />
            </div>
            <Table>
              <thead>
                <tr><Th>Código</Th><Th>Ruta</Th><Th>Carga</Th><Th>Unidad / piloto</Th><Th>Cliente</Th><Th>Salida</Th><Th className="text-right">Tarifa</Th><Th>Estado</Th><Th /></tr>
              </thead>
              <tbody>
                {viajes.map((v) => (
                  <Tr key={v.id}>
                    <Td className="font-mono text-xs whitespace-nowrap text-slate-900">{v.codigo}</Td>
                    <Td>
                      <p className="font-medium text-slate-900">{v.origen}</p>
                      <p className="text-xs text-slate-500">→ {v.destino}</p>
                      <p className="mt-1 flex gap-1"><Badge tono={v.tipo === "MATERIA_PRIMA" ? "ambar" : "azul"}>{v.tipo === "MATERIA_PRIMA" ? "Materia prima" : "Producto"}</Badge>{v.modalidad !== "NACIONAL" && <Badge>{MODALIDADES[v.modalidad]}</Badge>}</p>
                    </Td>
                    <Td><p>{v.carga}</p><p className="text-xs text-slate-500 tabular">{formatNum(v.toneladas, 1)} t · {formatNum(v.distanciaKm)} km</p></Td>
                    <Td><p className="font-mono text-xs">{v.camion.placa}</p><p className="text-xs text-slate-500">{v.piloto.nombre}</p></Td>
                    <Td className="max-w-48 text-xs">{v.cliente?.nombre ?? (v.solicitud ? <span className="text-slate-500">Interno · {v.solicitud.codigo}</span> : v.pedido ? <span className="text-slate-500">Interno · {v.pedido.codigo}</span> : "—")}{v.cliente && v.pedido && <span className="block text-slate-500">Pedido {v.pedido.codigo}</span>}</Td>
                    <Td className="text-xs whitespace-nowrap">{formatFecha(v.fechaSalida, true)}</Td>
                    <Td className="text-right font-medium whitespace-nowrap text-slate-900">{formatQ(v.tarifa)}</Td>
                    <Td><EstadoBadge estado={v.estado} /></Td>
                    <Td>{puedeOperar(session, GIRO_DE[v.tipo]) && <AccionesViaje id={v.id} estado={v.estado} />}</Td>
                  </Tr>
                ))}
                {!viajes.length && <EmptyRow cols={9} />}
              </tbody>
            </Table>
            <Paginacion total={totalViajes} pagina={pagina} base="/transporte" params={params} />
          </Card>
        )}

        {tab === "flota" && (
          <Card>
            <Table>
              <thead><tr><Th>Placa</Th><Th>Unidad</Th><Th>Tipo</Th><Th className="text-right">Capacidad</Th><Th>Centro</Th><Th className="text-right">Kilometraje</Th><Th className="text-right">Viajes</Th><Th>Estado</Th></tr></thead>
              <tbody>
                {camiones.map((c) => (
                  <Tr key={c.id}>
                    <Td className="font-mono text-xs font-medium text-slate-900">{c.placa}</Td>
                    <Td>{c.marca} {c.modelo} <span className="text-slate-400">· {c.anio}</span></Td>
                    <Td>{c.tipo}<p className="text-xs text-slate-500">{c.giro === "TRANSPORTE_MP" ? "Materia prima" : "Productos"}</p></Td>
                    <Td className="text-right">{formatNum(c.capacidadTon)} t</Td>
                    <Td className="text-xs">{c.sede.nombre}</Td>
                    <Td className="text-right">{formatNum(c.kilometraje)} km</Td>
                    <Td className="text-right">{c._count.viajes}</Td>
                    <Td><EstadoBadge estado={c.estado} /></Td>
                  </Tr>
                ))}
                {!camiones.length && <EmptyRow cols={8} />}
              </tbody>
            </Table>
          </Card>
        )}

        {tab === "pilotos" && (
          <Card>
            <Table>
              <thead><tr><Th>Nombre</Th><Th>DPI</Th><Th>Licencia</Th><Th>Teléfono</Th><Th className="text-right">Viajes</Th><Th>Situación</Th></tr></thead>
              <tbody>
                {pilotos.map((p) => (
                  <Tr key={p.id}>
                    <Td className="font-medium text-slate-900">{p.nombre}</Td>
                    <Td className="font-mono text-xs">{p.dpi}</Td>
                    <Td className="font-mono text-xs">{p.licencia} <span className="text-slate-400">(tipo {p.tipoLicencia})</span></Td>
                    <Td className="text-xs">{p.telefono}</Td>
                    <Td className="text-right">{p._count.viajes}</Td>
                    <Td>{!p.activo ? <Badge>Inactivo</Badge> : p.viajes.length ? <Badge tono="azul">Asignado · {p.viajes[0].codigo}</Badge> : <Badge tono="verde">Disponible</Badge>}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
