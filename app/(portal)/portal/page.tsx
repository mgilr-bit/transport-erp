import Link from "next/link";
import { CalendarClock, HardHat, MessageSquare, ShoppingCart, Tractor, Truck } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireCliente } from "@/lib/auth";
import { cn, formatFecha, formatQ } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Progreso, Stat } from "@/components/ui/stat";
import { EstadoBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { MarcarNotificaciones } from "./formularios";

/** Enlace del portal para una notificación según su referencia. */
function enlacePortal(referencia: string | null) {
  const [prefijo, clase] = referencia?.split(":") ?? [];
  if (prefijo === "pedido" || clase === "pedido") return "/portal/pedidos";
  if (prefijo === "reunion" || clase === "reunion-cliente") return "/portal/reuniones";
  if (prefijo === "mensaje") return "/portal/mensajes";
  return null;
}

export default async function PortalPage() {
  const session = await requireCliente();
  const clienteId = session.clienteId;
  const [cliente, viajes, contratos, compras, obras, pedidos, notificaciones, proximaReunion] = await Promise.all([
    prisma.cliente.findUniqueOrThrow({ where: { id: clienteId }, include: { vendedor: { select: { nombre: true, email: true, giro: true } } } }),
    prisma.viaje.findMany({ where: { clienteId }, orderBy: { fechaSalida: "desc" }, take: 5 }),
    prisma.contratoAlquiler.findMany({ where: { clienteId, estado: "ACTIVO" }, include: { maquina: true }, orderBy: { fechaFin: "asc" } }),
    prisma.ventaMaquina.count({ where: { clienteId } }),
    prisma.proyectoConstruccion.findMany({ where: { clienteId }, include: { hitos: { where: { completado: false }, orderBy: { fechaMeta: "asc" }, take: 1 } }, orderBy: { fechaInicio: "desc" } }),
    prisma.pedido.findMany({ where: { clienteId, estado: { notIn: ["ENTREGADO", "CANCELADO"] } }, orderBy: { createdAt: "desc" } }),
    prisma.alerta.findMany({ where: { clienteId }, orderBy: [{ leida: "asc" }, { createdAt: "desc" }], take: 8 }),
    prisma.reunion.findFirst({ where: { clienteId, estado: "CONFIRMADA", fecha: { gte: new Date() } }, orderBy: { fecha: "asc" } }),
  ]);
  const viajesActivos = viajes.filter((v) => v.estado === "PROGRAMADO" || v.estado === "EN_CURSO").length;
  const obrasActivas = obras.filter((o) => o.estado !== "FINALIZADO");
  const sinLeer = notificaciones.filter((n) => !n.leida).length;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Hola, {session.nombre.replace(/^(Ing|Lic|Lcda|Licda|Arq|Sr|Sra)\.\s*/, "").split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-slate-500">Los negocios de {cliente.nombre} con las empresas de TransPort.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat etiqueta="Pedidos activos" valor={pedidos.length} detalle="Plantas de proceso" icono={ShoppingCart} tono={pedidos.length ? "blue" : "slate"} />
        <Stat etiqueta="Viajes en curso" valor={viajesActivos} detalle="Transporte de materia prima y productos" icono={Truck} tono={viajesActivos ? "violet" : "slate"} />
        <Stat etiqueta="Alquileres activos" valor={contratos.length} detalle={`${compras} máquina${compras === 1 ? "" : "s"} comprada${compras === 1 ? "" : "s"}`} icono={Tractor} tono={contratos.length ? "amber" : "slate"} />
        <Stat etiqueta="Obras en ejecución" valor={obrasActivas.length} detalle={`${obras.length} obra${obras.length === 1 ? "" : "s"} con TransPort`} icono={HardHat} tono={obrasActivas.length ? "green" : "slate"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="grid content-start gap-6 xl:col-span-2">
          {pedidos.length > 0 && (
            <Card>
              <CardHeader title="Pedidos en curso" description="Plantas de proceso" action={<Link href="/portal/pedidos" className="text-sm text-brand-600 hover:underline">Ver todos</Link>} />
              <ul className="divide-y divide-slate-100 px-5 py-1">
                {pedidos.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span><span className="font-mono text-xs text-slate-900">{p.codigo}</span><span className="block text-xs text-slate-500">Requerido {formatFecha(p.fechaRequerida)}</span></span>
                    <span className="flex items-center gap-3"><span className="tabular">{formatQ(p.total)}</span><EstadoBadge estado={p.estado} /></span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Viajes recientes" description="Transporte de materia prima y de productos" action={<Link href="/portal/estado-de-cuenta" className="text-sm text-brand-600 hover:underline">Estado de cuenta</Link>} />
            <ul className="divide-y divide-slate-100 px-5 py-1">
              {viajes.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0"><span className="block truncate text-slate-900">{v.origen} → {v.destino}</span><span className="block text-xs text-slate-500">{v.codigo} · {v.carga} · {formatFecha(v.fechaSalida)}</span></span>
                  <EstadoBadge estado={v.estado} />
                </li>
              ))}
              {!viajes.length && <li className="py-6 text-center text-sm text-slate-400">Sin viajes registrados</li>}
            </ul>
          </Card>

          {(contratos.length > 0 || obras.length > 0) && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader title="Maquinaria alquilada" />
                <ul className="divide-y divide-slate-100 px-5 py-1">
                  {contratos.map((c) => (
                    <li key={c.id} className="py-2.5 text-sm">
                      <p className="text-slate-900">{c.maquina.tipo} {c.maquina.marca}</p>
                      <p className={cn("text-xs", c.fechaFin < new Date() ? "font-medium text-red-600" : "text-slate-500")}>{c.codigo} · devolución {formatFecha(c.fechaFin)} · {formatQ(c.total)}</p>
                    </li>
                  ))}
                  {!contratos.length && <li className="py-6 text-center text-sm text-slate-400">Sin alquileres activos</li>}
                </ul>
              </Card>
              <Card>
                <CardHeader title="Sus obras" />
                <ul className="divide-y divide-slate-100 px-5 py-1">
                  {obras.map((o) => (
                    <li key={o.id} className="py-3 text-sm">
                      <div className="flex items-center justify-between gap-2"><p className="truncate text-slate-900">{o.nombre}</p><EstadoBadge estado={o.estado} /></div>
                      <Progreso valor={o.avance} tono={o.estado === "FINALIZADO" ? "green" : "blue"} className="mt-2" />
                      <p className="mt-1 text-xs text-slate-500">{o.avance}% de avance · entrega {formatFecha(o.fechaFinEstimada)}{o.hitos[0] ? ` · próximo hito: ${o.hitos[0].nombre}` : ""}</p>
                    </li>
                  ))}
                  {!obras.length && <li className="py-6 text-center text-sm text-slate-400">Sin obras</li>}
                </ul>
              </Card>
            </div>
          )}
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader title="Su vendedor" />
            <CardBody className="space-y-3 text-sm">
              {cliente.vendedor ? (
                <p><span className="block font-medium text-slate-900">{cliente.vendedor.nombre}</span><span className="text-slate-500">{cliente.vendedor.email}</span></p>
              ) : (
                <p className="text-slate-500">Aún no tiene un vendedor asignado; sus mensajes los atiende la sede central.</p>
              )}
              {proximaReunion && (
                <p className="flex gap-2 rounded-lg bg-blue-50 px-3 py-2 text-blue-900"><CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />Próxima reunión: {formatFecha(proximaReunion.fecha, true)}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Link href="/portal/mensajes" className={buttonClass("secundario", "sm")}><MessageSquare className="size-3.5" aria-hidden /> Enviar mensaje</Link>
                <Link href="/portal/reuniones" className={buttonClass("secundario", "sm")}><CalendarClock className="size-3.5" aria-hidden /> Agendar reunión</Link>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Notificaciones" description={sinLeer ? `${sinLeer} sin leer` : "Al día"} action={sinLeer > 0 && <MarcarNotificaciones />} />
            <ul className="divide-y divide-slate-100 px-5 py-1">
              {notificaciones.map((n) => {
                const href = enlacePortal(n.referencia);
                const contenido = (
                  <>
                    <p className={cn("text-sm", n.leida ? "text-slate-500" : "font-medium text-slate-900")}>{n.titulo}</p>
                    <p className="text-xs text-slate-500">{n.mensaje}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{formatFecha(n.createdAt, true)}</p>
                  </>
                );
                return <li key={n.id} className="py-2.5">{href ? <Link href={href} className="block hover:opacity-80">{contenido}</Link> : contenido}</li>;
              })}
              {!notificaciones.length && <li className="py-6 text-center text-sm text-slate-400">Sin notificaciones</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

