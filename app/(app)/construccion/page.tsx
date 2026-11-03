import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Briefcase, CalendarX, HardHat, Tractor } from "lucide-react";
import { prisma } from "@/lib/db";
import { puedeOperar, requireGiro } from "@/lib/auth";
import { TIPOS_OBRA } from "@/lib/constants";
import { avanceEsperado, estaRezagada } from "@/lib/reglas";
import { formatFecha, formatPct, formatQ, toNumber } from "@/lib/utils";
import type { EstadoProyecto } from "@/app/generated/prisma/client";
import { PageHeader } from "@/components/ui/page-header";
import { Stat, Progreso } from "@/components/ui/stat";
import { Filtro } from "@/components/ui/filtro";
import { Badge, EstadoBadge } from "@/components/ui/badge";
import { NuevoProyecto } from "./formularios";

export const metadata: Metadata = { title: "Construcción" };

const ESTADOS: EstadoProyecto[] = ["PLANIFICACION", "EN_EJECUCION", "PAUSADO", "FINALIZADO"];
const VIGENTES: EstadoProyecto[] = ["PLANIFICACION", "EN_EJECUCION", "PAUSADO"];

export default async function ConstruccionPage({ searchParams }: PageProps<"/construccion">) {
  const session = await requireGiro("CONSTRUCCION");
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const estadoParam = str(sp.estado) as EstadoProyecto | undefined;
  const estado = estadoParam && ESTADOS.includes(estadoParam) ? estadoParam : undefined;
  const ahora = new Date();

  const [proyectos, clientes, maquinasEnObra] = await Promise.all([
    prisma.proyectoConstruccion.findMany({
      where: estado ? { estado } : {},
      include: { cliente: { select: { nombre: true } }, _count: { select: { maquinas: true, hitos: true } }, hitos: { where: { completado: false }, orderBy: { fechaMeta: "asc" }, take: 1 } },
      orderBy: [{ estado: "asc" }, { fechaFinEstimada: "asc" }],
    }),
    prisma.cliente.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.maquina.count({ where: { estado: "EN_PROYECTO" } }),
  ]);

  const vigentes = proyectos.filter((p) => VIGENTES.includes(p.estado));
  const cartera = vigentes.reduce((s, p) => s + toNumber(p.montoContrato), 0);
  const ejecutado = vigentes.reduce((s, p) => s + toNumber(p.costoEjecutado), 0);
  const atrasados = vigentes.filter((p) => p.fechaFinEstimada < ahora || estaRezagada(p.avance, avanceEsperado(p.fechaInicio, p.fechaFinEstimada, ahora)));

  return (
    <>
      <PageHeader
        titulo="Servicios de construcción"
        descripcion="Obras de puentes, carreteras y edificios: avance por hitos, costo ejecutado y maquinaria asignada."
        acciones={puedeOperar(session, "CONSTRUCCION") && <NuevoProyecto clientes={clientes.map((c) => ({ id: c.id, texto: c.nombre }))} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat etiqueta="Cartera vigente" valor={formatQ(cartera, true)} detalle={`${vigentes.length} obras sin finalizar`} icono={Briefcase} tono="green" />
        <Stat etiqueta="Costo ejecutado" valor={formatQ(ejecutado, true)} detalle={`${cartera ? formatPct((ejecutado / cartera) * 100) : "0%"} del monto contratado`} icono={HardHat} tono="blue" />
        <Stat etiqueta="Obras con atraso" valor={atrasados.length} detalle="Plazo vencido o avance por debajo de lo esperado" icono={CalendarX} tono={atrasados.length ? "red" : "slate"} />
        <Stat etiqueta="Maquinaria en obra" valor={maquinasEnObra} detalle="Unidades propias asignadas a proyectos" icono={Tractor} tono="amber" />
      </div>

      <div className="mt-8 mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Proyectos</h2>
        <Filtro param="estado" etiqueta="Estado" opciones={ESTADOS.map((e) => ({ valor: e, texto: e === "EN_EJECUCION" ? "En ejecución" : e === "PLANIFICACION" ? "Planificación" : e.charAt(0) + e.slice(1).toLowerCase() }))} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {proyectos.map((p) => {
          const esperado = avanceEsperado(p.fechaInicio, p.fechaFinEstimada, ahora);
          const vencido = p.estado !== "FINALIZADO" && p.fechaFinEstimada < ahora;
          const rezagado = !vencido && p.estado !== "FINALIZADO" && estaRezagada(p.avance, esperado);
          const pctCosto = toNumber(p.montoContrato) ? (toNumber(p.costoEjecutado) / toNumber(p.montoContrato)) * 100 : 0;
          const sobrecosto = p.estado !== "FINALIZADO" && pctCosto > p.avance + 10;
          return (
            <Link key={p.id} href={`/construccion/${p.id}`} className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] text-slate-400">{p.codigo} · {TIPOS_OBRA[p.tipo]}</p>
                  <h3 className="mt-0.5 text-sm font-semibold text-slate-900">{p.nombre}</h3>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{p.cliente.nombre} · {p.departamento}</p>
                </div>
                <ArrowUpRight className="size-4 shrink-0 text-slate-400 transition group-hover:text-slate-700" aria-hidden />
              </div>

              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">Avance {p.avance}%</span>
                {p.estado !== "FINALIZADO" && <span className="text-slate-400 tabular">esperado {esperado.toFixed(0)}%</span>}
              </div>
              <Progreso valor={p.avance} tono={p.estado === "FINALIZADO" ? "green" : vencido || rezagado ? "red" : "blue"} className="mt-1.5" />

              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div><dt className="text-slate-500">Contrato</dt><dd className="font-medium text-slate-900 tabular">{formatQ(p.montoContrato, true)}</dd></div>
                <div><dt className="text-slate-500">Ejecutado</dt><dd className="font-medium text-slate-900 tabular">{formatQ(p.costoEjecutado, true)} <span className="font-normal text-slate-400">({pctCosto.toFixed(0)}%)</span></dd></div>
                <div><dt className="text-slate-500">Entrega</dt><dd className="text-slate-900">{formatFecha(p.fechaFinEstimada)}</dd></div>
                <div><dt className="text-slate-500">Próximo hito</dt><dd className="truncate text-slate-900">{p.hitos[0]?.nombre ?? "—"}</dd></div>
              </dl>

              <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
                <EstadoBadge estado={p.estado} />
                {vencido && <Badge tono="rojo">Plazo vencido</Badge>}
                {rezagado && <Badge tono="ambar">Rezagado</Badge>}
                {sobrecosto && <Badge tono="ambar">Costo sobre avance</Badge>}
                <span className="ml-auto flex items-center gap-1 text-xs text-slate-500"><Tractor className="size-3.5" aria-hidden />{p._count.maquinas}</span>
              </div>
            </Link>
          );
        })}
        {!proyectos.length && <p className="col-span-full py-10 text-center text-sm text-slate-400">Sin proyectos</p>}
      </div>
    </>
  );
}
