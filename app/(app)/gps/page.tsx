import type { Metadata } from "next";
import Link from "next/link";
import { Gauge, MapPinned, Navigation, SignalZero, X } from "lucide-react";
import { prisma } from "@/lib/db";
import { puedeOperar, puedeVerGiro, requireGiro } from "@/lib/auth";
import { GIROS, REGLAS } from "@/lib/constants";
import { posicionesActuales, recorrido } from "@/lib/services/gps";
import { cn, formatFecha, formatNum, formatQ } from "@/lib/utils";
import type { GiroNegocio } from "@/app/generated/prisma/client";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Filtro } from "@/components/ui/filtro";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Mapa } from "@/components/gps/mapa";
import { GraficaVelocidad } from "@/components/charts/velocidad";
import { ControlSync } from "./control-sync";

export const metadata: Metadata = { title: "Monitoreo GPS" };

const GIROS_GPS: GiroNegocio[] = ["MAQUINARIA", "TRANSPORTE_MP", "TRANSPORTE_PROD"];
const SITUACIONES = [
  { valor: "movimiento", texto: "En movimiento" },
  { valor: "detenido", texto: "Detenido" },
  { valor: "exceso", texto: "Exceso de velocidad" },
  { valor: "sinsenal", texto: "Sin señal" },
];

export default async function GPSPage({ searchParams }: PageProps<"/gps">) {
  const session = await requireGiro(...GIROS_GPS);
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const tipo = str(sp.tipo);
  const situacion = str(sp.situacion);
  const imei = str(sp.imei);

  const girosVisibles = GIROS_GPS.filter((g) => puedeVerGiro(session, g));
  const ahora = new Date();
  const hace24 = new Date(ahora.getTime() - 24 * 3_600_000);
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

  const [todas, excesos24, costoGPS] = await Promise.all([
    posicionesActuales(),
    prisma.alerta.count({ where: { tipo: "EXCESO_VELOCIDAD", giro: { in: girosVisibles }, createdAt: { gte: hace24 } } }),
    prisma.gasto.aggregate({ where: { categoria: "GPS", giro: { in: girosVisibles }, fecha: { gte: inicioMes } }, _sum: { monto: true } }),
  ]);

  const visibles = todas.filter((a) => girosVisibles.includes(a.giro as GiroNegocio));
  const enMovimiento = (a: (typeof visibles)[number]) => !a.sinSenal && a.motorEncendido && a.velocidad > 0;
  const filtradas = visibles
    .filter((a) => !tipo || a.tipo === tipo)
    .filter((a) => {
      if (situacion === "movimiento") return enMovimiento(a);
      if (situacion === "detenido") return !a.sinSenal && !enMovimiento(a);
      if (situacion === "exceso") return a.excesoVelocidad && !a.sinSenal;
      if (situacion === "sinsenal") return a.sinSenal;
      return true;
    })
    // Primero las unidades con novedades, luego por nombre
    .sort((a, b) => Number(b.excesoVelocidad) - Number(a.excesoVelocidad) || Number(b.sinSenal) - Number(a.sinSenal) || a.nombre.localeCompare(b.nombre));

  const seleccion = imei && visibles.some((a) => a.imei === imei) ? await recorrido(imei) : null;
  const activoSel = seleccion ? visibles.find((a) => a.imei === imei) : undefined;
  const esCamionSel = seleccion?.dispositivo.tipoActivo === "CAMION";
  const sinSenal = visibles.filter((a) => a.sinSenal).length;
  const camiones = visibles.filter((a) => a.tipo === "CAMION").length;
  const cerrarHref = `/gps?${new URLSearchParams(Object.entries({ tipo, situacion }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <>
      <PageHeader
        titulo="Monitoreo GPS"
        descripcion="Posición, velocidad y uso de camiones y maquinaria con datos de GPS-Inversiones. TransPort ERP evalúa cada lectura y genera las alertas que el proveedor no ofrece."
        acciones={<ControlSync puedeSincronizar={girosVisibles.some((g) => puedeOperar(session, g))} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat etiqueta="Activos monitoreados" valor={visibles.length} detalle={`${camiones} camiones · ${visibles.length - camiones} máquinas`} icono={MapPinned} tono="blue" />
        <Stat etiqueta="En movimiento" valor={visibles.filter(enMovimiento).length} detalle="Motor encendido y velocidad mayor a 0" icono={Navigation} tono="green" />
        <Stat etiqueta="Excesos de velocidad" valor={excesos24} detalle={`Últimas 24 h · límite ${REGLAS.velocidadMaximaCamion} km/h para camiones`} icono={Gauge} tono={excesos24 ? "red" : "slate"} />
        <Stat etiqueta="Sin señal" valor={sinSenal} detalle={`Sin reportar en ${REGLAS.minutosSinSenal} min · servicio ${formatQ(costoGPS._sum.monto, true)}/mes`} icono={SignalZero} tono={sinSenal ? "amber" : "slate"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-4 py-3">
            <Filtro param="tipo" etiqueta="Activo" opciones={[{ valor: "CAMION", texto: "Camiones" }, { valor: "MAQUINA", texto: "Maquinaria" }]} />
            <Filtro param="situacion" etiqueta="Situación" opciones={SITUACIONES} />
            <ul className="ml-auto flex flex-wrap gap-3 text-xs text-slate-500" aria-label="Leyenda">
              {girosVisibles.map((g) => (
                <li key={g} className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: GIROS[g].color }} />{GIROS[g].corto}</li>
              ))}
              <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full ring-2 ring-red-600" />Exceso</li>
              <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-slate-400" />Sin señal</li>
            </ul>
          </div>
          <Mapa activos={filtradas} ruta={seleccion?.puntos ?? []} seleccionado={imei} />
        </Card>

        {seleccion && activoSel ? (
          <Card>
            <CardHeader
              title={activoSel.nombre}
              description={`${activoSel.detalle} · ${GIROS[activoSel.giro as GiroNegocio].corto} · IMEI ${seleccion.dispositivo.imei}`}
              action={<Link href={cerrarHref} scroll={false} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Cerrar recorrido"><X className="size-4" /></Link>}
            />
            <CardBody className="space-y-5">
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div><dt className="text-xs text-slate-500">Recorrido 24 h</dt><dd className="font-semibold text-slate-900 tabular">{formatNum(seleccion.km, 1)} km</dd></div>
                <div><dt className="text-xs text-slate-500">Motor encendido</dt><dd className="font-semibold text-slate-900 tabular">{formatNum(seleccion.horasMotor, 1)} h</dd></div>
                <div><dt className="text-xs text-slate-500">Velocidad máxima</dt><dd className={cn("font-semibold tabular", esCamionSel && seleccion.velocidadMax > REGLAS.velocidadMaximaCamion ? "text-red-600" : "text-slate-900")}>{formatNum(seleccion.velocidadMax)} km/h</dd></div>
                <div><dt className="text-xs text-slate-500">{esCamionSel ? "Lecturas con exceso" : "Horas de uso acumuladas"}</dt><dd className="font-semibold text-slate-900 tabular">{esCamionSel ? seleccion.excesos : `${formatNum(seleccion.dispositivo.maquina?.horasUso)} h`}</dd></div>
              </dl>
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Velocidad (km/h)</p>
                <GraficaVelocidad puntos={seleccion.puntos} limite={esCamionSel ? REGLAS.velocidadMaximaCamion : undefined} />
              </div>
              <p className="text-xs text-slate-500">
                {seleccion.dispositivo.camion ? <>Base: {seleccion.dispositivo.camion.sede.nombre} · {formatNum(seleccion.dispositivo.camion.kilometraje)} km de odómetro</>
                  : seleccion.dispositivo.maquina ? <>Sucursal: {seleccion.dispositivo.maquina.sede.nombre}{seleccion.dispositivo.maquina.proyecto ? ` · en obra: ${seleccion.dispositivo.maquina.proyecto.nombre}` : ""}</> : null}
                {" · "}{seleccion.puntos.length} lecturas en 24 h
              </p>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader title="Unidades con novedades" description="Haga clic en una unidad del mapa o de la tabla para ver su recorrido de 24 h" />
            <ul className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto px-5 py-1">
              {visibles.filter((a) => a.excesoVelocidad || a.sinSenal).map((a) => (
                <li key={a.imei}>
                  <Link href={`/gps?imei=${a.imei}`} scroll={false} className="flex items-center justify-between gap-3 py-2.5 hover:text-brand-700">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">{a.nombre}</span>
                      <span className="text-xs text-slate-500">{GIROS[a.giro as GiroNegocio].corto} · {formatFecha(a.timestamp, true)}</span>
                    </span>
                    {a.sinSenal ? <Badge tono="ambar">Sin señal</Badge> : <Badge tono="rojo">{a.velocidad.toFixed(0)} km/h</Badge>}
                  </Link>
                </li>
              ))}
              {!visibles.some((a) => a.excesoVelocidad || a.sinSenal) && <li className="py-8 text-center text-sm text-slate-400">Toda la flota reporta con normalidad.</li>}
            </ul>
          </Card>
        )}
      </div>

      <Card className="mt-6">
        <CardHeader title="Última lectura por unidad" description={`${filtradas.length} unidades`} />
        <Table>
          <thead><tr><Th>Unidad</Th><Th>Giro</Th><Th className="text-right">Velocidad</Th><Th>Motor</Th><Th>Posición</Th><Th>Última señal</Th><Th>Situación</Th></tr></thead>
          <tbody>
            {filtradas.map((a) => (
              <Tr key={a.imei} className={a.imei === imei ? "bg-brand-50/60" : undefined}>
                <Td>
                  <Link href={`/gps?${new URLSearchParams({ ...(tipo ? { tipo } : {}), ...(situacion ? { situacion } : {}), imei: a.imei })}`} scroll={false} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">{a.nombre}</Link>
                  <p className="text-xs text-slate-500">{a.detalle}</p>
                </Td>
                <Td className="text-xs"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: GIROS[a.giro as GiroNegocio].color }} />{GIROS[a.giro as GiroNegocio].corto}</span></Td>
                <Td className={cn("text-right", a.excesoVelocidad && "font-semibold text-red-600")}>{a.velocidad.toFixed(0)} km/h</Td>
                <Td className="text-xs">{a.motorEncendido ? "Encendido" : "Apagado"}</Td>
                <Td className="font-mono text-xs text-slate-500">{a.latitud.toFixed(4)}, {a.longitud.toFixed(4)}</Td>
                <Td className="text-xs whitespace-nowrap">{formatFecha(a.timestamp, true)}</Td>
                <Td>{a.sinSenal ? <Badge tono="ambar">Sin señal</Badge> : a.excesoVelocidad ? <Badge tono="rojo">Exceso</Badge> : enMovimiento(a) ? <Badge tono="verde">En movimiento</Badge> : <Badge>Detenido</Badge>}</Td>
              </Tr>
            ))}
            {!filtradas.length && <EmptyRow cols={7} />}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
