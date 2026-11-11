import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CircleDollarSign, Scale, ShoppingCart, Wallet } from "lucide-react";
import { esCorporativo, puedeVerReportes, requireSession } from "@/lib/auth";
import { GIROS } from "@/lib/constants";
import { girosDe, periodoDe, reporteConsolidado } from "@/lib/services/reportes";
import { cn, formatFecha, formatNum, formatPct, formatQ } from "@/lib/utils";
import type { GiroNegocio } from "@/app/generated/prisma/client";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Filtro } from "@/components/ui/filtro";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { Exportar } from "@/components/ui/exportar";
import { Imprimir } from "@/components/ui/imprimir";

export const metadata: Metadata = { title: "Reportes" };

const fmtMes = new Intl.DateTimeFormat("es-GT", { month: "long", year: "numeric" });
const clave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export default async function ReportesPage({ searchParams }: PageProps<"/reportes">) {
  const session = await requireSession();
  if (!puedeVerReportes(session)) redirect("/sin-acceso");
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const periodoParam = str(sp.periodo) ?? null;
  const { anio, mes } = periodoDe(periodoParam);
  const corporativo = esCorporativo(session);
  const visibles = girosDe(session);
  const giroParam = str(sp.giro) as GiroNegocio | undefined;
  const giros = giroParam && visibles.includes(giroParam) ? [giroParam] : visibles;
  const r = await reporteConsolidado(anio, mes, giros);

  const hoy = new Date();
  const periodos = Array.from({ length: 12 }, (_, i) => new Date(hoy.getFullYear(), hoy.getMonth() - i, 1));
  const nombreMes = fmtMes.format(new Date(anio, mes - 1, 1));
  const alcance = giros.length === 1 ? GIROS[giros[0]].nombre : "Todos los giros";
  const exportar = `/api/reportes/consolidado?periodo=${anio}-${String(mes).padStart(2, "0")}${giroParam ? `&giro=${giroParam}` : ""}`;
  const o = r.operacion;

  return (
    <>
      <PageHeader
        titulo="Reporte consolidado"
        descripcion={`${nombreMes.charAt(0).toUpperCase()}${nombreMes.slice(1)} · ${alcance}. Ingresos, gasto contra presupuesto, operación, alertas y principales clientes para la toma de decisiones.`}
        acciones={
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <Filtro param="periodo" etiqueta="Periodo" todos={null} opciones={periodos.map((d) => ({ valor: clave(d), texto: fmtMes.format(d) }))} />
            {corporativo && <Filtro param="giro" etiqueta="Giro" todos="Todos" opciones={visibles.map((g) => ({ valor: g, texto: GIROS[g].corto }))} />}
            <Exportar href={exportar} />
            <Imprimir />
          </div>
        }
      />
      <p className="mb-4 hidden text-xs text-slate-500 print:block">TransPort ERP · Generado el {formatFecha(hoy, true)} por {session.nombre}</p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat etiqueta="Ingresos del mes" valor={formatQ(r.total.ingresos, true)} detalle="Facturación de los giros operativos" icono={CircleDollarSign} tono="green" />
        <Stat etiqueta="Gasto ejecutado" valor={formatQ(r.total.ejecutado, true)} detalle={`${r.total.presupuesto ? formatPct((r.total.ejecutado / r.total.presupuesto) * 100) : "—"} de ${formatQ(r.total.presupuesto, true)}`} icono={Wallet} tono={r.total.ejecutado > r.total.presupuesto ? "red" : "blue"} />
        <Stat etiqueta="Resultado operativo" valor={formatQ(r.total.resultado, true)} detalle="Ingresos menos gasto del mes" icono={Scale} tono={r.total.resultado >= 0 ? "green" : "red"} />
        <Stat etiqueta="Pedidos entregados" valor={formatNum(o.pedidosEntregados)} detalle={`${formatQ(o.ventasPedidos, true)} en ventas en línea`} icono={ShoppingCart} tono="violet" />
      </div>

      <Card className="mt-6 break-inside-avoid">
        <CardHeader title="Resultado por giro" description="El gasto incluye todas las categorías registradas en el mes" />
        <Table>
          <thead><tr><Th>Giro</Th><Th className="text-right">Ingresos</Th><Th className="text-right">Presupuesto</Th><Th className="text-right">Gasto</Th><Th className="text-right">Ejecución</Th><Th className="text-right">Resultado</Th></tr></thead>
          <tbody>
            {r.porGiro.map((f) => (
              <Tr key={f.giro}>
                <Td className="font-medium text-slate-900">{GIROS[f.giro].nombre}</Td>
                <Td className="text-right">{f.giro === "CONSTRUCCION" ? <span className="text-slate-400">ver nota</span> : formatQ(f.ingresos)}</Td>
                <Td className="text-right">{formatQ(f.presupuesto)}</Td>
                <Td className="text-right">{formatQ(f.ejecutado)}</Td>
                <Td className={cn("text-right font-medium", f.nivel === "EXCEDIDO" ? "text-red-600" : f.nivel === "ADVERTENCIA" ? "text-amber-700" : "text-slate-900")}>{formatPct(f.porcentaje)}</Td>
                <Td className={cn("text-right font-medium", f.resultado < 0 ? "text-red-600" : "text-emerald-700")}>{formatQ(f.resultado)}</Td>
              </Tr>
            ))}
            <Tr className="bg-slate-50 font-semibold">
              <Td>Total</Td>
              <Td className="text-right">{formatQ(r.total.ingresos)}</Td>
              <Td className="text-right">{formatQ(r.total.presupuesto)}</Td>
              <Td className="text-right">{formatQ(r.total.ejecutado)}</Td>
              <Td className="text-right">{r.total.presupuesto ? formatPct((r.total.ejecutado / r.total.presupuesto) * 100) : "—"}</Td>
              <Td className={cn("text-right", r.total.resultado < 0 ? "text-red-600" : "text-emerald-700")}>{formatQ(r.total.resultado)}</Td>
            </Tr>
          </tbody>
        </Table>
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          Nota: Construcción factura por estimaciones de obra, que no se registran en el sistema; su cartera vigente es de {formatQ(o.carteraObras)} en {o.obrasActivas} obras. Plantas de proceso incluye la producción terminada; las ventas en línea se muestran aparte.
        </p>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="break-inside-avoid">
          <CardHeader title="Operación del mes" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {[
                ["Toneladas extraídas", formatNum(o.toneladasExtraidas, 1)],
                ["Órdenes de producción completadas", formatNum(o.ordenesCompletadas)],
                ["Viajes de materia prima entregados", formatNum(o.viajesMP)],
                ["Viajes de productos entregados", formatNum(o.viajesProductos)],
                ["Kilómetros recorridos", formatNum(o.kilometros)],
                ["Alquileres iniciados", formatNum(o.alquileres)],
                ["Máquinas vendidas", formatNum(o.ventasMaquinaria)],
                ["Avance promedio de obras", `${o.avancePromedio}%`],
                ["Reuniones de venta realizadas", formatNum(o.reunionesRealizadas)],
              ].map(([k, v]) => (
                <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-semibold text-slate-900 tabular">{v}</dd></div>
              ))}
            </dl>
          </CardBody>
        </Card>

        <Card className="break-inside-avoid">
          <CardHeader title="Alertas del periodo" description="Generadas por el monitoreo automático" />
          <Table>
            <thead><tr><Th>Tipo</Th><Th className="text-right">Cantidad</Th></tr></thead>
            <tbody>
              {r.alertas.map((a) => <Tr key={a.tipo}><Td>{a.tipo}</Td><Td className="text-right font-medium">{a.cantidad}</Td></Tr>)}
              {!r.alertas.length && <EmptyRow cols={2}>Sin alertas en el periodo</EmptyRow>}
            </tbody>
          </Table>
        </Card>

        <Card className="break-inside-avoid">
          <CardHeader title="Principales clientes" description="Facturación del mes en todas las subempresas" />
          <Table>
            <thead><tr><Th>Cliente</Th><Th className="text-right">Monto</Th></tr></thead>
            <tbody>
              {r.clientes.map((c) => <Tr key={c.id}><Td className="max-w-48 truncate">{c.nombre}</Td><Td className="text-right font-medium">{formatQ(c.monto)}</Td></Tr>)}
              {!r.clientes.length && <EmptyRow cols={2}>Sin facturación en el periodo</EmptyRow>}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}
