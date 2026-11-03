import type { Metadata } from "next";
import { AlertTriangle, Landmark, PiggyBank, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { esCorporativo, puedeDefinirPresupuesto, puedeRegistrarGasto, requireSession } from "@/lib/auth";
import { CATEGORIAS_GASTO, GIROS } from "@/lib/constants";
import { ejecucionPresupuestaria } from "@/lib/services/finanzas";
import { GIROS_TODOS, gastosUltimos12Meses } from "@/lib/services/dashboard";
import { formatFecha, formatPct, formatQ, toNumber } from "@/lib/utils";
import type { CategoriaGasto, GiroNegocio, Prisma } from "@/app/generated/prisma/client";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Filtro } from "@/components/ui/filtro";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { POR_PAGINA, Paginacion, paginaDe } from "@/components/ui/paginacion";
import { BarrasApiladas } from "@/components/charts/barras-apiladas";
import { Barras } from "@/components/charts/barras";
import { EjecucionPresupuesto } from "@/components/dominio/ejecucion-presupuesto";
import { DefinirPresupuesto, NuevoGasto } from "./formularios";

export const metadata: Metadata = { title: "Presupuesto y gastos" };

const fmtMes = new Intl.DateTimeFormat("es-GT", { month: "long", year: "numeric" });

export default async function FinanzasPage({ searchParams }: PageProps<"/finanzas">) {
  const session = await requireSession();
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const corporativo = esCorporativo(session);
  const visibles: GiroNegocio[] = corporativo ? GIROS_TODOS : session.giro ? [session.giro] : [];

  // Periodo: 12 meses atrás y 2 adelante (para planificar presupuestos)
  const hoy = new Date();
  const periodos = Array.from({ length: 15 }, (_, i) => new Date(hoy.getFullYear(), hoy.getMonth() + 2 - i, 1));
  const clave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const periodoParam = str(sp.periodo);
  const ref = periodos.find((d) => clave(d) === periodoParam) ?? new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const anio = ref.getFullYear();
  const mes = ref.getMonth() + 1;
  const nombrePeriodo = fmtMes.format(ref);

  const giroParam = str(sp.giro) as GiroNegocio | undefined;
  const giro = giroParam && visibles.includes(giroParam) ? giroParam : undefined;
  const catParam = str(sp.categoria) as CategoriaGasto | undefined;
  const categoria = catParam && catParam in CATEGORIAS_GASTO ? catParam : undefined;
  const pagina = paginaDe(sp.pagina);

  const rango = { gte: new Date(anio, mes - 1, 1), lt: new Date(anio, mes, 1) };
  const whereGasto: Prisma.GastoWhereInput = { fecha: rango, giro: giro ?? { in: visibles }, ...(categoria ? { categoria } : {}) };

  const [ejecucion, tendencia, gastos, totalGastos, porCategoria, sedes] = await Promise.all([
    ejecucionPresupuestaria(anio, mes, visibles),
    gastosUltimos12Meses(giro ? [giro] : visibles, ref),
    prisma.gasto.findMany({ where: whereGasto, include: { sede: { select: { nombre: true } }, usuario: { select: { nombre: true } } }, orderBy: [{ fecha: "desc" }, { id: "desc" }], skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA }),
    prisma.gasto.count({ where: whereGasto }),
    prisma.gasto.groupBy({ by: ["categoria"], where: { fecha: rango, giro: giro ?? { in: visibles } }, _sum: { monto: true } }),
    prisma.sede.findMany({ where: { giro: { in: visibles } }, select: { id: true, nombre: true, giro: true }, orderBy: { nombre: "asc" } }),
  ]);

  const filas = giro ? ejecucion.filter((e) => e.giro === giro) : ejecucion;
  const presupuesto = filas.reduce((s, e) => s + e.presupuesto, 0);
  const ejecutado = filas.reduce((s, e) => s + e.ejecutado, 0);
  const enRiesgo = ejecucion.filter((e) => e.nivel !== "NORMAL");
  const sumaGastos = await prisma.gasto.aggregate({ where: whereGasto, _sum: { monto: true } });

  const operables = visibles.filter((g) => puedeRegistrarGasto(session, g));
  const opciones = ejecucion.map((e) => ({ valor: e.giro, texto: GIROS[e.giro].nombre, presupuesto: e.presupuesto, ejecutado: e.ejecutado }));
  const datosCategoria = porCategoria.map((c) => ({ categoria: CATEGORIAS_GASTO[c.categoria], monto: Math.round(toNumber(c._sum.monto)) })).sort((a, b) => b.monto - a.monto);

  return (
    <>
      <PageHeader
        titulo="Presupuesto y gastos"
        descripcion={`Cada giro de negocio lleva su propio presupuesto mensual; el gasto se registra por sede y categoría. Periodo: ${nombrePeriodo}.`}
        acciones={
          <>
            {puedeDefinirPresupuesto(session) && <DefinirPresupuesto giros={opciones} periodo={{ anio, mes }} nombrePeriodo={nombrePeriodo} />}
            {operables.length > 0 && <NuevoGasto giros={opciones.filter((o) => operables.includes(o.valor))} sedes={sedes.map((s) => ({ id: s.id, texto: s.nombre, giro: s.giro }))} periodo={{ anio, mes }} />}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-4">
        <Filtro param="periodo" etiqueta="Periodo" todos={null} opciones={periodos.map((d) => ({ valor: clave(d), texto: fmtMes.format(d) }))} />
        {corporativo && <Filtro param="giro" etiqueta="Giro" opciones={visibles.map((g) => ({ valor: g, texto: GIROS[g].corto }))} />}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat etiqueta="Presupuesto del mes" valor={formatQ(presupuesto, true)} detalle={giro ? GIROS[giro].nombre : `${filas.length} giros`} icono={Landmark} tono="blue" />
        <Stat etiqueta="Ejecutado" valor={formatQ(ejecutado, true)} detalle={`${presupuesto ? formatPct((ejecutado / presupuesto) * 100) : "—"} del presupuesto`} icono={Wallet} tono={ejecutado > presupuesto && presupuesto > 0 ? "red" : "violet"} />
        <Stat etiqueta="Disponible" valor={formatQ(presupuesto - ejecutado, true)} detalle={presupuesto - ejecutado < 0 ? "Sobregiro del periodo" : "Saldo por ejecutar"} icono={PiggyBank} tono={presupuesto - ejecutado < 0 ? "red" : "green"} />
        <Stat etiqueta="Giros en riesgo" valor={enRiesgo.length} detalle={enRiesgo.length ? enRiesgo.map((e) => e.nombre).join(" · ") : "Todos por debajo del 80 %"} icono={AlertTriangle} tono={enRiesgo.length ? "amber" : "slate"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Ejecución por giro" description={nombrePeriodo} />
          <CardBody><EjecucionPresupuesto filas={filas} /></CardBody>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Gasto mensual" description={`12 meses hasta ${nombrePeriodo}`} />
          <CardBody><BarrasApiladas datos={tendencia.datos} series={tendencia.series} /></CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Gasto por categoría" description={nombrePeriodo} />
          <CardBody><Barras datos={datosCategoria} ejeX="categoria" valor="monto" nombre="Gasto" color="#475569" moneda horizontal altura={Math.max(220, datosCategoria.length * 36)} /></CardBody>
        </Card>
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-4 py-3">
            <Filtro param="categoria" etiqueta="Categoría" todos="Todas" opciones={Object.entries(CATEGORIAS_GASTO).map(([valor, texto]) => ({ valor, texto }))} />
            <p className="text-xs text-slate-500">Total filtrado: <span className="font-semibold text-slate-900 tabular">{formatQ(sumaGastos._sum.monto)}</span></p>
          </div>
          <Table>
            <thead><tr><Th>Fecha</Th><Th>Giro / sede</Th><Th>Concepto</Th><Th>Documento</Th><Th className="text-right">Monto</Th></tr></thead>
            <tbody>
              {gastos.map((g) => (
                <Tr key={g.id}>
                  <Td className="text-xs whitespace-nowrap">{formatFecha(g.fecha)}</Td>
                  <Td className="text-xs">
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-800"><span className="size-2 rounded-full" style={{ background: GIROS[g.giro].color }} />{GIROS[g.giro].corto}</span>
                    <p className="text-slate-500">{g.sede?.nombre ?? "General"}</p>
                  </Td>
                  <Td><p className="text-sm text-slate-900">{g.descripcion}</p><p className="text-xs text-slate-500">{CATEGORIAS_GASTO[g.categoria]}{g.usuario ? ` · ${g.usuario.nombre}` : ""}</p></Td>
                  <Td className="font-mono text-xs text-slate-500">{g.documento ?? "—"}</Td>
                  <Td className="text-right font-medium text-slate-900">{formatQ(g.monto)}</Td>
                </Tr>
              ))}
              {!gastos.length && <EmptyRow cols={5}>Sin gastos en {nombrePeriodo}</EmptyRow>}
            </tbody>
          </Table>
          <Paginacion total={totalGastos} pagina={pagina} base="/finanzas" params={{ periodo: periodoParam, giro, categoria }} />
        </Card>
      </div>
    </>
  );
}
