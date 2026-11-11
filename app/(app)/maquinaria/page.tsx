import type { Metadata } from "next";
import { CalendarClock, CircleDollarSign, Gauge, Wrench } from "lucide-react";
import { prisma } from "@/lib/db";
import { puedeOperar, requireGiro } from "@/lib/auth";
import { formatFecha, formatNum, formatQ, toNumber } from "@/lib/utils";
import type { EstadoMaquina, Prisma } from "@/app/generated/prisma/client";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Exportar } from "@/components/ui/exportar";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Tabs } from "@/components/ui/tabs";
import { Filtro } from "@/components/ui/filtro";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge, EstadoBadge } from "@/components/ui/badge";
import { POR_PAGINA, Paginacion, paginaDe } from "@/components/ui/paginacion";
import { Barras } from "@/components/charts/barras";
import { FinalizarContrato, Mantenimiento, NuevaMaquina, NuevaVenta, NuevoAlquiler } from "./formularios";

export const metadata: Metadata = { title: "Maquinaria" };

const ESTADOS: EstadoMaquina[] = ["DISPONIBLE", "ALQUILADA", "EN_PROYECTO", "MANTENIMIENTO", "VENDIDA"];

export default async function MaquinariaPage({ searchParams }: PageProps<"/maquinaria">) {
  const session = await requireGiro("MAQUINARIA");
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const tab = str(sp.tab) ?? "inventario";
  const sede = str(sp.sede);
  const estadoParam = str(sp.estado) as EstadoMaquina | undefined;
  const estado = estadoParam && ESTADOS.includes(estadoParam) ? estadoParam : undefined;
  const pagina = paginaDe(sp.pagina);
  const puede = puedeOperar(session, "MAQUINARIA");

  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const en7dias = new Date(ahora.getTime() + 7 * 86_400_000);
  const whereMaquina: Prisma.MaquinaWhereInput = { ...(sede ? { sedeId: Number(sede) } : {}), ...(estado ? { estado } : { estado: { not: "VENDIDA" } }) };

  const [maquinas, totalMaquinas, porEstado, sucursales, clientes, contratosActivos, historial, totalHistorial, ventas, alquilerMes, ventasMes, porTipo] = await Promise.all([
    prisma.maquina.findMany({
      where: whereMaquina,
      include: { sede: { select: { nombre: true } }, proyecto: { select: { codigo: true, nombre: true } }, contratos: { where: { estado: "ACTIVO" }, include: { cliente: { select: { nombre: true } } } } },
      orderBy: { codigo: "asc" },
      skip: tab === "inventario" ? (pagina - 1) * POR_PAGINA : 0,
      take: POR_PAGINA,
    }),
    prisma.maquina.count({ where: whereMaquina }),
    prisma.maquina.groupBy({ by: ["estado"], _count: true }),
    prisma.sede.findMany({ where: { tipo: "SUCURSAL_MAQUINARIA" }, orderBy: { nombre: "asc" } }),
    prisma.cliente.findMany({ select: { id: true, nombre: true, tipo: true }, orderBy: { nombre: "asc" } }),
    prisma.contratoAlquiler.findMany({ where: { estado: "ACTIVO" }, include: { maquina: true, cliente: true }, orderBy: { fechaFin: "asc" } }),
    prisma.contratoAlquiler.findMany({
      where: { estado: { not: "ACTIVO" } },
      include: { maquina: { select: { codigo: true, tipo: true } }, cliente: { select: { nombre: true } } },
      orderBy: { fechaInicio: "desc" },
      skip: tab === "contratos" ? (pagina - 1) * POR_PAGINA : 0,
      take: POR_PAGINA,
    }),
    prisma.contratoAlquiler.count({ where: { estado: { not: "ACTIVO" } } }),
    prisma.ventaMaquina.findMany({ include: { maquina: true, cliente: true }, orderBy: { fecha: "desc" } }),
    prisma.contratoAlquiler.aggregate({ where: { fechaInicio: { gte: inicioMes }, estado: { not: "CANCELADO" } }, _sum: { total: true }, _count: true }),
    prisma.ventaMaquina.aggregate({ where: { fecha: { gte: inicioMes } }, _sum: { precio: true }, _count: true }),
    prisma.maquina.groupBy({ by: ["tipo"], where: { estado: { not: "VENDIDA" } }, _count: true }),
  ]);

  const cuenta = (e: EstadoMaquina) => porEstado.find((p) => p.estado === e)?._count ?? 0;
  const flota = ESTADOS.filter((e) => e !== "VENDIDA").reduce((s, e) => s + cuenta(e), 0);
  const ocupadas = cuenta("ALQUILADA") + cuenta("EN_PROYECTO");
  const utilizacion = flota ? (ocupadas / flota) * 100 : 0;
  const porVencer = contratosActivos.filter((c) => c.fechaFin <= en7dias);

  const disponibles = puede
    ? await prisma.maquina.findMany({ where: { estado: "DISPONIBLE" }, include: { sede: { select: { departamento: true } } }, orderBy: { codigo: "asc" } })
    : [];
  const opcMaquinas = disponibles.map((m) => ({ id: m.id, texto: `${m.codigo} · ${m.tipo} ${m.marca} ${m.modelo} · ${formatQ(m.tarifaDiaria)}/día · ${m.sede.departamento}`, tarifa: toNumber(m.tarifaDiaria), precioVenta: toNumber(m.precioVenta) }));
  const opcClientes = clientes.map((c) => ({ id: c.id, texto: `${c.nombre}${c.tipo === "EXTRANJERO" ? " (extranjero)" : ""}` }));
  const datosTipo = porTipo.map((t) => ({ tipo: t.tipo, unidades: t._count })).sort((a, b) => b.unidades - a.unidades);

  return (
    <>
      <PageHeader
        titulo="Venta y alquiler de maquinaria"
        descripcion="Inventario de maquinaria de construcción en las sucursales de Guatemala, Xela, Zacapa y Petén."
        acciones={
          <>
            <Exportar href="/api/reportes/alquileres" texto="Alquileres CSV" />
            {puede && (
              <>
                <NuevaMaquina sedes={sucursales.map((s) => ({ id: s.id, texto: s.nombre }))} />
                <NuevaVenta maquinas={opcMaquinas} clientes={opcClientes} />
                <NuevoAlquiler maquinas={opcMaquinas} clientes={opcClientes} />
              </>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat etiqueta="Ingresos del mes" valor={formatQ(toNumber(alquilerMes._sum.total) + toNumber(ventasMes._sum.precio), true)} detalle={`${alquilerMes._count} alquileres · ${ventasMes._count} ventas`} icono={CircleDollarSign} tono="green" />
        <Stat etiqueta="Utilización de la flota" valor={`${utilizacion.toFixed(0)}%`} detalle={`${cuenta("ALQUILADA")} alquiladas · ${cuenta("EN_PROYECTO")} en obras propias`} icono={Gauge} tono="blue" />
        <Stat etiqueta="Contratos por vencer" valor={porVencer.length} detalle={`${contratosActivos.length} contratos activos · próximos 7 días`} icono={CalendarClock} tono={porVencer.length ? "amber" : "slate"} />
        <Stat etiqueta="En mantenimiento" valor={cuenta("MANTENIMIENTO")} detalle={`${cuenta("DISPONIBLE")} disponibles de ${flota}`} icono={Wrench} tono={cuenta("MANTENIMIENTO") ? "amber" : "slate"} />
      </div>

      <div className="mt-8">
        <Tabs
          base="/maquinaria"
          activa={tab}
          tabs={[
            { id: "inventario", label: "Inventario", total: flota },
            { id: "contratos", label: "Alquileres", total: contratosActivos.length },
            { id: "ventas", label: "Ventas", total: ventas.length },
          ]}
        />

        {tab === "inventario" && (
          <div className="grid gap-6 xl:grid-cols-4">
            <Card className="xl:col-span-3">
              <div className="flex flex-wrap gap-4 border-b border-slate-100 px-4 py-3">
                <Filtro param="sede" etiqueta="Sucursal" todos="Todas" opciones={sucursales.map((s) => ({ valor: String(s.id), texto: s.nombre.replace("Sucursal Maquinaria ", "") }))} />
                <Filtro param="estado" etiqueta="Estado" todos="En inventario" opciones={ESTADOS.map((e) => ({ valor: e, texto: e === "EN_PROYECTO" ? "En proyecto" : e.charAt(0) + e.slice(1).toLowerCase() }))} />
              </div>
              <Table>
                <thead><tr><Th>Código</Th><Th>Máquina</Th><Th>Sucursal</Th><Th className="text-right">Horas de uso</Th><Th className="text-right">Tarifa / día</Th><Th>Asignación</Th><Th>Estado</Th><Th /></tr></thead>
                <tbody>
                  {maquinas.map((m) => (
                    <Tr key={m.id}>
                      <Td className="font-mono text-xs font-medium text-slate-900">{m.codigo}</Td>
                      <Td><p className="font-medium text-slate-900">{m.tipo}</p><p className="text-xs text-slate-500">{m.marca} {m.modelo} · {m.anio}</p></Td>
                      <Td className="text-xs">{m.sede.nombre.replace("Sucursal Maquinaria ", "")}</Td>
                      <Td className="text-right">{formatNum(m.horasUso)} h</Td>
                      <Td className="text-right">{formatQ(m.tarifaDiaria)}</Td>
                      <Td className="max-w-56 text-xs">
                        {m.contratos[0] ? <><p className="truncate">{m.contratos[0].cliente.nombre}</p><p className="text-slate-500">hasta {formatFecha(m.contratos[0].fechaFin)}</p></>
                          : m.proyecto ? <><p className="truncate">{m.proyecto.nombre}</p><p className="font-mono text-slate-500">{m.proyecto.codigo}</p></>
                          : <span className="text-slate-400">—</span>}
                      </Td>
                      <Td><EstadoBadge estado={m.estado} /></Td>
                      <Td className="text-right">{puede && <Mantenimiento id={m.id} estado={m.estado} />}</Td>
                    </Tr>
                  ))}
                  {!maquinas.length && <EmptyRow cols={8} />}
                </tbody>
              </Table>
              <Paginacion total={totalMaquinas} pagina={pagina} base="/maquinaria" params={{ tab, sede, estado }} />
            </Card>
            <Card>
              <CardHeader title="Flota por tipo" description="Unidades en inventario" />
              <CardBody><Barras datos={datosTipo} ejeX="tipo" valor="unidades" nombre="Unidades" color="#ca8a04" horizontal altura={Math.max(220, datosTipo.length * 30)} /></CardBody>
            </Card>
          </div>
        )}

        {tab === "contratos" && (
          <>
            <Card>
              <CardHeader title="Contratos activos" description="Ordenados por fecha de devolución" />
              <Table>
                <thead><tr><Th>Contrato</Th><Th>Máquina</Th><Th>Cliente</Th><Th>Periodo</Th><Th className="text-right">Total</Th><Th className="text-right">Depósito</Th><Th>Devolución</Th><Th /></tr></thead>
                <tbody>
                  {contratosActivos.map((c) => {
                    const vencido = c.fechaFin < ahora;
                    const proximo = !vencido && c.fechaFin <= en7dias;
                    return (
                      <Tr key={c.id}>
                        <Td className="font-mono text-xs text-slate-900">{c.codigo}</Td>
                        <Td><p className="font-medium text-slate-900">{c.maquina.tipo}</p><p className="font-mono text-xs text-slate-500">{c.maquina.codigo}</p></Td>
                        <Td className="max-w-56 text-xs">{c.cliente.nombre}</Td>
                        <Td className="text-xs whitespace-nowrap">{formatFecha(c.fechaInicio)} – {formatFecha(c.fechaFin)}</Td>
                        <Td className="text-right font-medium text-slate-900">{formatQ(c.total)}</Td>
                        <Td className="text-right">{formatQ(c.deposito)}</Td>
                        <Td>{vencido ? <Badge tono="rojo">Vencido</Badge> : proximo ? <Badge tono="ambar">Próximo</Badge> : <Badge tono="verde">En plazo</Badge>}</Td>
                        <Td className="text-right">{puede && <FinalizarContrato id={c.id} />}</Td>
                      </Tr>
                    );
                  })}
                  {!contratosActivos.length && <EmptyRow cols={8}>No hay contratos activos</EmptyRow>}
                </tbody>
              </Table>
            </Card>
            <Card className="mt-6">
              <CardHeader title="Historial de alquileres" />
              <Table>
                <thead><tr><Th>Contrato</Th><Th>Máquina</Th><Th>Cliente</Th><Th>Periodo</Th><Th className="text-right">Tarifa / día</Th><Th className="text-right">Total</Th><Th>Estado</Th></tr></thead>
                <tbody>
                  {historial.map((c) => (
                    <Tr key={c.id}>
                      <Td className="font-mono text-xs text-slate-900">{c.codigo}</Td>
                      <Td className="text-xs"><span className="font-mono">{c.maquina.codigo}</span> · {c.maquina.tipo}</Td>
                      <Td className="max-w-56 text-xs">{c.cliente.nombre}</Td>
                      <Td className="text-xs whitespace-nowrap">{formatFecha(c.fechaInicio)} – {formatFecha(c.fechaFin)}</Td>
                      <Td className="text-right">{formatQ(c.tarifaDiaria)}</Td>
                      <Td className="text-right font-medium text-slate-900">{formatQ(c.total)}</Td>
                      <Td><EstadoBadge estado={c.estado} /></Td>
                    </Tr>
                  ))}
                  {!historial.length && <EmptyRow cols={7} />}
                </tbody>
              </Table>
              <Paginacion total={totalHistorial} pagina={pagina} base="/maquinaria" params={{ tab }} />
            </Card>
          </>
        )}

        {tab === "ventas" && (
          <Card>
            <Table>
              <thead><tr><Th>Venta</Th><Th>Máquina</Th><Th>Cliente</Th><Th>Fecha</Th><Th className="text-right">Precio de lista</Th><Th className="text-right">Precio de venta</Th></tr></thead>
              <tbody>
                {ventas.map((v) => (
                  <Tr key={v.id}>
                    <Td className="font-mono text-xs text-slate-900">{v.codigo}</Td>
                    <Td><p className="font-medium text-slate-900">{v.maquina.tipo} {v.maquina.marca} {v.maquina.modelo}</p><p className="font-mono text-xs text-slate-500">{v.maquina.codigo} · serie {v.maquina.serie}</p></Td>
                    <Td className="max-w-56 text-xs">{v.cliente.nombre}</Td>
                    <Td className="text-xs whitespace-nowrap">{formatFecha(v.fecha)}</Td>
                    <Td className="text-right text-slate-500">{formatQ(v.maquina.precioVenta)}</Td>
                    <Td className="text-right font-medium text-slate-900">{formatQ(v.precio)}</Td>
                  </Tr>
                ))}
                {!ventas.length && <EmptyRow cols={6} />}
              </tbody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
