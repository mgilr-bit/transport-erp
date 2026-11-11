import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, OctagonAlert, Radar, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { esCorporativo, requireSession } from "@/lib/auth";
import { enlaceDeReferencia, filtroAlertas } from "@/lib/alertas";
import { GIROS, GIROS_OPERATIVOS, TIPOS_ALERTA as TIPOS } from "@/lib/constants";
import type { Alerta, GiroNegocio, Prisma, SeveridadAlerta, TipoAlerta } from "@/app/generated/prisma/client";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Filtro } from "@/components/ui/filtro";
import { POR_PAGINA, Paginacion, paginaDe } from "@/components/ui/paginacion";
import { ListaAlertas } from "@/components/dominio/lista-alertas";
import { Barras } from "@/components/charts/barras";
import { MarcarLeida, MarcarTodas } from "./acciones";

export const metadata: Metadata = { title: "Centro de alertas" };

const SEVERIDADES: Record<SeveridadAlerta, string> = { CRITICA: "Crítica", ADVERTENCIA: "Advertencia", INFO: "Informativa" };

export default async function AlertasPage({ searchParams }: PageProps<"/alertas">) {
  const session = await requireSession();
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const pick = <T extends string>(v: string | undefined, validos: readonly T[]) => (v && validos.includes(v as T) ? (v as T) : undefined);

  const corporativo = esCorporativo(session);
  const tipo = pick(str(sp.tipo), Object.keys(TIPOS) as TipoAlerta[]);
  const severidad = pick(str(sp.severidad), Object.keys(SEVERIDADES) as SeveridadAlerta[]);
  const giro = corporativo ? pick(str(sp.giro), GIROS_OPERATIVOS) : undefined;
  const vista = str(sp.vista) === "todas" ? "todas" : "pendientes";
  const pagina = paginaDe(sp.pagina);

  const base: Prisma.AlertaWhereInput = { ...filtroAlertas(session), ...(giro ? { giro } : {}) };
  const where: Prisma.AlertaWhereInput = { ...base, ...(tipo ? { tipo } : {}), ...(severidad ? { severidad } : {}), ...(vista === "pendientes" ? { leida: false } : {}) };
  const ahora = new Date();
  const hace30 = new Date(ahora.getTime() - 30 * 86_400_000);
  const hace24 = new Date(ahora.getTime() - 24 * 3_600_000);

  const [alertas, total, pendientes, criticas, ultimas24, porTipo, atendidas30] = await Promise.all([
    prisma.alerta.findMany({ where, orderBy: [{ leida: "asc" }, { createdAt: "desc" }], skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA }),
    prisma.alerta.count({ where }),
    prisma.alerta.count({ where: { ...base, leida: false } }),
    prisma.alerta.count({ where: { ...base, leida: false, severidad: "CRITICA" } }),
    prisma.alerta.count({ where: { ...base, createdAt: { gte: hace24 } } }),
    prisma.alerta.groupBy({ by: ["tipo"], where: { ...base, createdAt: { gte: hace30 } }, _count: true }),
    prisma.alerta.count({ where: { ...base, leida: true, createdAt: { gte: hace30 } } }),
  ]);
  const generadas30 = porTipo.reduce((s, t) => s + t._count, 0);
  const pendientesFiltro = vista === "pendientes" ? total : await prisma.alerta.count({ where: { ...where, leida: false } });

  // Enlaces al módulo de origen de cada alerta
  const ids = (prefijo: string) => alertas.flatMap((a) => (a.referencia?.startsWith(`${prefijo}:`) ? [Number(a.referencia.split(":")[1])] : []));
  const [camiones, maquinas, sedes] = await Promise.all([
    prisma.camion.findMany({ where: { id: { in: ids("camion") } }, select: { id: true, dispositivo: { select: { imei: true } } } }),
    prisma.maquina.findMany({ where: { id: { in: ids("maquina") } }, select: { id: true, dispositivo: { select: { imei: true } } } }),
    prisma.sede.findMany({ where: { id: { in: ids("inventario") } }, select: { id: true, giro: true } }),
  ]);
  const enlace = (a: Alerta): { href: string; texto: string } | null => {
    const [prefijo, id] = a.referencia?.split(":") ?? [];
    if (prefijo === "camion" || prefijo === "maquina") {
      const imei = (prefijo === "camion" ? camiones : maquinas).find((x) => x.id === Number(id))?.dispositivo?.imei;
      return imei ? { href: `/gps?imei=${imei}`, texto: "Ver recorrido" } : null;
    }
    if (prefijo === "inventario") {
      const sede = sedes.find((s) => s.id === Number(id));
      return sede?.giro === "PROCESO" ? { href: "/proceso?tab=inventario", texto: "Ver inventario" } : { href: "/extraccion", texto: "Ver inventario" };
    }
    return enlaceDeReferencia(a.referencia);
  };

  const datosTipo = porTipo.map((t) => ({ tipo: TIPOS[t.tipo], alertas: t._count })).sort((a, b) => b.alertas - a.alertas);

  return (
    <>
      <PageHeader
        titulo="Centro de alertas"
        descripcion="Alertas y recordatorios generados por TransPort ERP a partir del GPS, el presupuesto, los inventarios, los pedidos y la agenda comercial. Cada usuario ve las que corresponden a su rol y giro."
        acciones={<MarcarTodas filtro={{ tipo, severidad, giro }} total={pendientesFiltro} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat etiqueta="Sin atender" valor={pendientes} detalle={giro ? GIROS[giro].nombre : corporativo ? "Todos los giros" : GIROS[session.giro as GiroNegocio].nombre} icono={BellRing} tono={pendientes ? "amber" : "slate"} />
        <Stat etiqueta="Críticas sin atender" valor={criticas} detalle="Requieren acción inmediata" icono={OctagonAlert} tono={criticas ? "red" : "slate"} />
        <Stat etiqueta="Generadas en 24 h" valor={ultimas24} detalle="Por el monitoreo automático" icono={Radar} tono="blue" />
        <Stat etiqueta="Atendidas (30 días)" valor={`${generadas30 ? Math.round((atendidas30 / generadas30) * 100) : 100}%`} detalle={`${atendidas30} de ${generadas30} generadas en el periodo`} icono={ShieldCheck} tono="green" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-4 py-3">
            <Filtro param="vista" etiqueta="Mostrar" todos="Sin atender" opciones={[{ valor: "todas", texto: "Todas" }]} />
            <Filtro param="severidad" etiqueta="Severidad" todos="Todas" opciones={Object.entries(SEVERIDADES).map(([valor, texto]) => ({ valor, texto }))} />
            <Filtro param="tipo" etiqueta="Tipo" opciones={Object.entries(TIPOS).map(([valor, texto]) => ({ valor, texto }))} />
            {corporativo && <Filtro param="giro" etiqueta="Giro" opciones={GIROS_OPERATIVOS.map((g) => ({ valor: g, texto: GIROS[g].corto }))} />}
          </div>
          <CardBody className="py-1">
            <ListaAlertas
              alertas={alertas}
              acciones={(a) => {
                const e = enlace(a);
                return (
                  <div className="flex shrink-0 items-start gap-2">
                    {e && <Link href={e.href} className="mt-1.5 text-xs font-medium whitespace-nowrap text-brand-600 hover:underline">{e.texto}</Link>}
                    <MarcarLeida id={a.id} leida={a.leida} />
                  </div>
                );
              }}
            />
          </CardBody>
          <Paginacion total={total} pagina={pagina} base="/alertas" params={{ tipo, severidad, giro, vista: vista === "todas" ? "todas" : undefined }} />
        </Card>

        <Card>
          <CardHeader title="Alertas por tipo" description="Últimos 30 días" />
          <CardBody>
            <Barras datos={datosTipo} ejeX="tipo" valor="alertas" nombre="Alertas" color="#dc2626" horizontal altura={Math.max(200, datosTipo.length * 40)} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
