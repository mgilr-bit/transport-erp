import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BellRing, Factory, Receipt, Tractor, Truck, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { esCorporativo, filtroGiro, requireSession } from "@/lib/auth";
import { GIROS, GIROS_OPERATIVOS } from "@/lib/constants";
import { ejecucionPresupuestaria } from "@/lib/services/finanzas";
import { GIROS_TODOS, gastosUltimos12Meses, ingresosDelMes, mesActual, resumenOperativo } from "@/lib/services/dashboard";
import { formatNum, formatQ } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { BarrasApiladas } from "@/components/charts/barras-apiladas";
import { EjecucionPresupuesto } from "@/components/dominio/ejecucion-presupuesto";
import { ListaAlertas } from "@/components/dominio/lista-alertas";
import { Icono } from "@/components/layout/icono";

export const metadata: Metadata = { title: "Panel general" };

export default async function DashboardPage() {
  const session = await requireSession();
  const corporativo = esCorporativo(session);
  const giros = corporativo ? GIROS_TODOS : session.giro ? [session.giro] : [];
  const { anio, mes } = mesActual();

  const [ejecucion, gastos, ingresos, resumen, alertas] = await Promise.all([
    ejecucionPresupuestaria(anio, mes, giros),
    gastosUltimos12Meses(giros),
    ingresosDelMes(),
    resumenOperativo(),
    prisma.alerta.findMany({ where: { leida: false, ...filtroGiro(session) }, orderBy: [{ severidad: "desc" }, { createdAt: "desc" }], take: 6 }),
  ]);

  const totalPresupuesto = ejecucion.reduce((s, e) => s + e.presupuesto, 0);
  const totalEjecutado = ejecucion.reduce((s, e) => s + e.ejecutado, 0);
  const totalIngresos = GIROS_OPERATIVOS.filter((g) => giros.includes(g) && g !== "CONSTRUCCION").reduce((s, g) => s + ingresos[g as keyof typeof ingresos], 0);
  const nombreMes = new Intl.DateTimeFormat("es-GT", { month: "long", year: "numeric" }).format(new Date());

  const tarjetas: Record<string, { valor: string; detalle: string }> = {
    EXTRACCION: { valor: formatQ(ingresos.EXTRACCION, true), detalle: "Valor de material extraído" },
    PROCESO: { valor: formatQ(ingresos.PROCESO, true), detalle: `Producción terminada · ${resumen.ordenesProceso} órdenes en proceso` },
    MAQUINARIA: { valor: formatQ(ingresos.MAQUINARIA, true), detalle: `${resumen.maquinas.alquiladas} alquiladas · ${resumen.maquinas.disponibles} disponibles` },
    TRANSPORTE_MP: { valor: formatQ(ingresos.TRANSPORTE_MP, true), detalle: "Fletes de materia prima entregados" },
    TRANSPORTE_PROD: { valor: formatQ(ingresos.TRANSPORTE_PROD, true), detalle: "Fletes de productos entregados" },
    CONSTRUCCION: { valor: formatQ(ingresos.CONSTRUCCION, true), detalle: `Cartera de ${ingresos.proyectosActivos} obras vigentes` },
  };

  return (
    <>
      <PageHeader
        titulo={`Hola, ${session.nombre.replace(/^(Ing|Lic|Lcda|Licda|Arq)\.\s*/, "").split(" ")[0]}`}
        descripcion={corporativo ? `Resumen consolidado de todos los giros de negocio · ${nombreMes}` : `Resumen de ${GIROS[session.giro!].nombre} · ${nombreMes}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat etiqueta="Facturación del mes" valor={formatQ(totalIngresos, true)} detalle={`${formatNum(ingresos.viajesEntregados)} viajes entregados`} icono={Receipt} tono="green" />
        <Stat
          etiqueta="Gasto ejecutado"
          valor={formatQ(totalEjecutado, true)}
          detalle={`${totalPresupuesto ? ((totalEjecutado / totalPresupuesto) * 100).toFixed(1) : 0}% de ${formatQ(totalPresupuesto, true)} presupuestado`}
          icono={Wallet}
          tono={totalEjecutado > totalPresupuesto ? "red" : "blue"}
        />
        <Stat etiqueta="Flota en ruta" valor={`${resumen.camiones.enRuta} / ${resumen.camiones.total}`} detalle={`${resumen.viajesActivos} viajes activos · ${resumen.camiones.mantenimiento} en taller`} icono={Truck} tono="violet" />
        <Stat etiqueta="Alertas críticas" valor={resumen.alertasCriticas} detalle={`${resumen.solicitudesPendientes} solicitudes de MP por aprobar`} icono={BellRing} tono={resumen.alertasCriticas ? "red" : "slate"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Gasto mensual por giro" description="Últimos 12 meses, en quetzales" />
          <CardBody>
            <BarrasApiladas datos={gastos.datos} series={gastos.series} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Ejecución presupuestaria" description={`Mes en curso · ${nombreMes}`} action={<Link href="/finanzas" className="text-xs font-medium text-brand-600 hover:underline">Ver detalle</Link>} />
          <CardBody>
            <EjecucionPresupuesto filas={ejecucion} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="grid content-start gap-4 sm:grid-cols-2 xl:col-span-2">
          {GIROS_OPERATIVOS.filter((g) => giros.includes(g)).map((g) => (
            <Link key={g} href={GIROS[g].ruta} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-lg text-white" style={{ background: GIROS[g].color }}>
                    <Icono nombre={GIROS[g].icono} className="size-4" />
                  </span>
                  <span className="text-sm font-semibold text-slate-900">{GIROS[g].nombre}</span>
                </span>
                <ArrowUpRight className="size-4 text-slate-400 transition group-hover:text-slate-700" aria-hidden />
              </div>
              <p className="mt-4 text-xl font-semibold text-slate-900 tabular">{tarjetas[g].valor}</p>
              <p className="mt-0.5 text-xs text-slate-500">{tarjetas[g].detalle}</p>
            </Link>
          ))}
        </div>
        <Card>
          <CardHeader title="Alertas recientes" description="Sin leer, por severidad" action={<Link href="/alertas" className="text-xs font-medium text-brand-600 hover:underline">Ver todas</Link>} />
          <CardBody className="py-2">
            <ListaAlertas alertas={alertas} />
          </CardBody>
        </Card>
      </div>
      {corporativo && (
        <p className="mt-6 flex items-center gap-2 text-xs text-slate-400">
          <Factory className="size-3.5" aria-hidden /> Construcción reporta cartera contratada; los demás giros, facturación del mes.
          <Tractor className="ml-2 size-3.5" aria-hidden /> Maquinaria incluye alquileres iniciados y ventas.
        </p>
      )}
    </>
  );
}
