import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Coins, Gauge, Receipt } from "lucide-react";
import { prisma } from "@/lib/db";
import { puedeOperar, requireGiro } from "@/lib/auth";
import { CATEGORIAS_GASTO, TIPOS_OBRA } from "@/lib/constants";
import { avanceEsperado, estaRezagada } from "@/lib/reglas";
import { formatFecha, formatNum, formatQ, toNumber } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Progreso, Stat } from "@/components/ui/stat";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge, EstadoBadge } from "@/components/ui/badge";
import { AsignarMaquina, CasillaHito, EstadoProyecto, LiberarMaquina, NuevoCosto, NuevoHito, PedirMateriales } from "../formularios";

export async function generateMetadata({ params }: PageProps<"/construccion/[id]">): Promise<Metadata> {
  const { id } = await params;
  const p = Number.isInteger(Number(id)) ? await prisma.proyectoConstruccion.findUnique({ where: { id: Number(id) }, select: { nombre: true } }) : null;
  return { title: p?.nombre ?? "Proyecto" };
}

export default async function ProyectoPage({ params }: PageProps<"/construccion/[id]">) {
  const session = await requireGiro("CONSTRUCCION");
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const proyecto = await prisma.proyectoConstruccion.findUnique({
    where: { id },
    include: {
      cliente: true,
      hitos: { orderBy: [{ fechaMeta: "asc" }, { id: "asc" }] },
      maquinas: { include: { sede: { select: { nombre: true } } }, orderBy: { codigo: "asc" } },
    },
  });
  if (!proyecto) notFound();

  const puede = puedeOperar(session, "CONSTRUCCION");
  const abierta = proyecto.estado !== "FINALIZADO";
  const [costos, disponibles, pedidos, productos] = await Promise.all([
    prisma.gasto.findMany({ where: { giro: "CONSTRUCCION", documento: proyecto.codigo }, orderBy: { fecha: "desc" }, take: 15 }),
    puede && abierta ? prisma.maquina.findMany({ where: { estado: "DISPONIBLE" }, include: { sede: { select: { departamento: true } } }, orderBy: { codigo: "asc" } }) : [],
    prisma.pedido.findMany({ where: { proyectoId: id }, include: { _count: { select: { items: true } } }, orderBy: { createdAt: "desc" }, take: 10 }),
    puede && abierta ? prisma.producto.findMany({ orderBy: [{ categoria: "asc" }, { nombre: "asc" }] }) : [],
  ]);

  const ahora = new Date();
  const esperado = avanceEsperado(proyecto.fechaInicio, proyecto.fechaFinEstimada, ahora);
  const monto = toNumber(proyecto.montoContrato);
  const costo = toNumber(proyecto.costoEjecutado);
  const pctCosto = monto ? (costo / monto) * 100 : 0;
  const diasRestantes = Math.ceil((proyecto.fechaFinEstimada.getTime() - ahora.getTime()) / 86_400_000);
  const pesoTotal = proyecto.hitos.reduce((s, h) => s + h.peso, 0);
  const rezagado = abierta && estaRezagada(proyecto.avance, esperado);

  return (
    <>
      <Link href="/construccion" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" aria-hidden /> Proyectos
      </Link>
      <PageHeader
        etiqueta={<span className="flex items-center gap-2"><span className="font-mono text-xs text-slate-500">{proyecto.codigo}</span><Badge>{TIPOS_OBRA[proyecto.tipo]}</Badge><EstadoBadge estado={proyecto.estado} /></span>}
        titulo={proyecto.nombre}
        descripcion={`${proyecto.cliente.nombre} · ${proyecto.ubicacion}, ${proyecto.departamento}${proyecto.descripcion ? ` — ${proyecto.descripcion}` : ""}`}
        acciones={puede && abierta && (
          <>
            <EstadoProyecto id={proyecto.id} estado={proyecto.estado} />
            <PedirMateriales
              proyectoId={proyecto.id}
              direccion={`${proyecto.ubicacion}, ${proyecto.departamento}`}
              productos={productos.map((p) => ({ id: p.id, nombre: p.nombre, unidad: p.unidad, precio: toNumber(p.precio) }))}
            />
            <NuevoCosto proyectoId={proyecto.id} />
          </>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat etiqueta="Avance físico" valor={`${proyecto.avance}%`} detalle={abierta ? `Esperado a la fecha: ${esperado.toFixed(0)}%` : "Obra finalizada"} icono={Gauge} tono={rezagado ? "red" : "blue"} />
        <Stat etiqueta="Monto del contrato" valor={formatQ(monto, true)} detalle={`Inicio ${formatFecha(proyecto.fechaInicio)}`} icono={Coins} tono="green" />
        <Stat etiqueta="Costo ejecutado" valor={formatQ(costo, true)} detalle={`${pctCosto.toFixed(1)}% del contrato · margen ${formatQ(monto - costo, true)}`} icono={Receipt} tono={pctCosto > proyecto.avance + 10 && abierta ? "amber" : "slate"} />
        <Stat
          etiqueta="Plazo"
          valor={!abierta ? "Entregada" : diasRestantes >= 0 ? `${formatNum(diasRestantes)} días` : `${formatNum(-diasRestantes)} días de atraso`}
          detalle={`Entrega estimada ${formatFecha(proyecto.fechaFinEstimada)}`}
          icono={CalendarClock}
          tono={abierta && diasRestantes < 0 ? "red" : "slate"}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title="Hitos de la obra" description={`El avance se pondera por peso · ${pesoTotal} puntos en total`} action={puede && abierta && <NuevoHito proyectoId={proyecto.id} />} />
          <div className="px-5 pt-4"><Progreso valor={proyecto.avance} tono={!abierta ? "green" : rezagado ? "red" : "blue"} /></div>
          <ul className="divide-y divide-slate-100 px-5 py-2">
            {proyecto.hitos.map((h) => {
              const atrasado = !h.completado && h.fechaMeta < ahora;
              return (
                <li key={h.id} className="flex items-center gap-3 py-3">
                  <CasillaHito id={h.id} proyectoId={proyecto.id} completado={h.completado} habilitado={puede} />
                  <div className="min-w-0 flex-1">
                    <p className={h.completado ? "text-sm text-slate-500 line-through" : "text-sm font-medium text-slate-900"}>{h.nombre}</p>
                    <p className="text-xs text-slate-500">Meta {formatFecha(h.fechaMeta)}</p>
                  </div>
                  {atrasado && <Badge tono="rojo">Atrasado</Badge>}
                  <span className="w-20 text-right text-xs text-slate-500 tabular">{pesoTotal ? ((h.peso / pesoTotal) * 100).toFixed(0) : 0}% del total</span>
                </li>
              );
            })}
            {!proyecto.hitos.length && <li className="py-8 text-center text-sm text-slate-400">Agregue hitos para medir el avance.</li>}
          </ul>
        </Card>

        <div className="grid content-start gap-6 xl:col-span-2">
          <Card>
            <CardHeader
              title="Maquinaria asignada"
              description="Equipo propio del giro de Maquinaria"
              action={puede && abierta && <AsignarMaquina proyectoId={proyecto.id} maquinas={disponibles.map((m) => ({ id: m.id, texto: `${m.codigo} · ${m.tipo} ${m.marca} · ${m.sede.departamento}` }))} />}
            />
            <ul className="divide-y divide-slate-100 px-5 py-1">
              {proyecto.maquinas.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{m.tipo} <span className="font-normal text-slate-500">{m.marca} {m.modelo}</span></p>
                    <p className="text-xs text-slate-500"><span className="font-mono">{m.codigo}</span> · {formatNum(m.horasUso)} h de uso</p>
                  </div>
                  {puede && <LiberarMaquina maquinaId={m.id} proyectoId={proyecto.id} />}
                </li>
              ))}
              {!proyecto.maquinas.length && <li className="py-6 text-center text-sm text-slate-400">Sin maquinaria asignada</li>}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Pedidos de materiales" description="A Plantas de proceso; se cargan como costo al entregarse" />
            <ul className="divide-y divide-slate-100 px-5 py-1">
              {pedidos.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="font-mono text-xs text-slate-900">{p.codigo}</p>
                    <p className="text-xs text-slate-500">{p._count.items} producto{p._count.items === 1 ? "" : "s"} · {formatFecha(p.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 tabular">{formatQ(p.total)}</span>
                    <EstadoBadge estado={p.estado} />
                  </div>
                </li>
              ))}
              {!pedidos.length && <li className="py-6 text-center text-sm text-slate-400">Sin pedidos de materiales</li>}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Costos registrados" description="Últimos 15 cargos a la obra" />
            <Table>
              <thead><tr><Th>Fecha</Th><Th>Concepto</Th><Th className="text-right">Monto</Th></tr></thead>
              <tbody>
                {costos.map((g) => (
                  <Tr key={g.id}>
                    <Td className="text-xs whitespace-nowrap">{formatFecha(g.fecha)}</Td>
                    <Td><p className="text-xs text-slate-900">{g.descripcion.replace(`${proyecto.codigo} · `, "")}</p><p className="text-[11px] text-slate-500">{CATEGORIAS_GASTO[g.categoria]}</p></Td>
                    <Td className="text-right font-medium text-slate-900">{formatQ(g.monto)}</Td>
                  </Tr>
                ))}
                {!costos.length && <EmptyRow cols={3}>Sin costos registrados desde el sistema</EmptyRow>}
              </tbody>
            </Table>
          </Card>
        </div>
      </div>
    </>
  );
}
