import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, CircleDollarSign, MessageSquare, ShoppingCart } from "lucide-react";
import { prisma } from "@/lib/db";
import { esCorporativo, puedeGestionarClientes, puedeGestionarPedidos, puedeGestionarReuniones, puedeVerComercial, requireSession } from "@/lib/auth";
import { CANALES_PEDIDO, ESTADOS_PEDIDO, ESTADOS_REUNION, GIROS, SEDE_CENTRAL } from "@/lib/constants";
import { formatFecha, formatNum, formatQ } from "@/lib/utils";
import type { EstadoPedido, EstadoReunion, Prisma } from "@/app/generated/prisma/client";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Tabs } from "@/components/ui/tabs";
import { Filtro } from "@/components/ui/filtro";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge, EstadoBadge } from "@/components/ui/badge";
import { POR_PAGINA, Paginacion, paginaDe } from "@/components/ui/paginacion";
import { Exportar } from "@/components/ui/exportar";
import { AccionesPedido, AccionesReunion, AsignarVendedor, NuevoCliente } from "./formularios";

export const metadata: Metadata = { title: "Clientes y pedidos" };

const ACTIVOS: EstadoPedido[] = ["SOLICITADO", "CONFIRMADO", "EN_PREPARACION", "DESPACHADO"];
const PENDIENTES: EstadoReunion[] = ["SOLICITADA", "CONFIRMADA"];

export default async function VentasPage({ searchParams }: PageProps<"/ventas">) {
  const session = await requireSession();
  if (!puedeVerComercial(session)) redirect("/sin-acceso");
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const pick = <T extends string>(v: string | undefined, validos: readonly T[]) => (v && validos.includes(v as T) ? (v as T) : undefined);

  const corporativo = esCorporativo(session);
  const gestionaPedidos = puedeGestionarPedidos(session);
  const vePedidos = corporativo || gestionaPedidos;
  const veCartera = corporativo || session.rol === "GERENTE" || session.rol === "VENDEDOR";
  const tabsVisibles = [
    vePedidos && { id: "pedidos", label: "Pedidos" },
    veCartera && { id: "reuniones", label: "Reuniones" },
    veCartera && { id: "clientes", label: "Clientes" },
    veCartera && { id: "mensajes", label: "Mensajes" },
  ].filter((t): t is { id: string; label: string } => !!t);
  const tab = pick(str(sp.tab), tabsVisibles.map((t) => t.id)) ?? tabsVisibles[0].id;
  const pagina = paginaDe(sp.pagina);

  // Alcance: el vendedor ve su cartera y sus reuniones; el gerente, las de su giro; la sede central, todo
  const esVendedor = session.rol === "VENDEDOR";
  const whereReunion: Prisma.ReunionWhereInput = corporativo
    ? {}
    : esVendedor
      ? { giro: session.giro ?? undefined, OR: [{ vendedorId: session.usuarioId }, { vendedorId: null }] }
      : { giro: session.giro ?? undefined };
  const whereCliente: Prisma.ClienteWhereInput = esVendedor ? { vendedorId: session.usuarioId } : {};
  const estadoPedido = pick(str(sp.estado), Object.keys(ESTADOS_PEDIDO) as EstadoPedido[]);
  const wherePedido: Prisma.PedidoWhereInput = { estado: estadoPedido ?? { in: ACTIVOS } };
  const estadoReunion = pick(str(sp.reunion), Object.keys(ESTADOS_REUNION) as EstadoReunion[]);
  const whereReunionLista: Prisma.ReunionWhereInput = { ...whereReunion, estado: estadoReunion ?? { in: PENDIENTES } };

  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const en7 = new Date(ahora.getTime() + 7 * 86_400_000);

  const [porEstado, ventasMes, porConfirmar, proximas, sinLeer] = await Promise.all([
    vePedidos ? prisma.pedido.groupBy({ by: ["estado"], _count: true }) : [],
    vePedidos ? prisma.pedido.aggregate({ where: { estado: "ENTREGADO", updatedAt: { gte: inicioMes } }, _sum: { total: true }, _count: true }) : null,
    veCartera ? prisma.reunion.count({ where: { ...whereReunion, estado: "SOLICITADA" } }) : 0,
    veCartera ? prisma.reunion.count({ where: { ...whereReunion, estado: "CONFIRMADA", fecha: { gte: ahora, lte: en7 } } }) : 0,
    veCartera ? prisma.mensaje.count({ where: { deCliente: true, leido: false, cliente: whereCliente } }) : 0,
  ]);
  const cuenta = (e: EstadoPedido) => porEstado.find((p) => p.estado === e)?._count ?? 0;

  return (
    <>
      <PageHeader
        titulo="Clientes y pedidos"
        descripcion="Pedidos en línea de los clientes y de otros giros, agenda de reuniones para cerrar tratos, cartera de clientes y mensajes del portal."
        acciones={tab === "clientes" && puedeGestionarClientes(session) && <NuevoCliente vendedores={await opcionesVendedores()} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {vePedidos && <Stat etiqueta="Pedidos por confirmar" valor={cuenta("SOLICITADO")} detalle={`${cuenta("CONFIRMADO") + cuenta("EN_PREPARACION") + cuenta("DESPACHADO")} en curso`} icono={ShoppingCart} tono={cuenta("SOLICITADO") ? "amber" : "slate"} />}
        {vePedidos && <Stat etiqueta="Ventas del mes" valor={formatQ(ventasMes?._sum.total, true)} detalle={`${ventasMes?._count ?? 0} pedidos entregados`} icono={CircleDollarSign} tono="green" />}
        {veCartera && <Stat etiqueta="Reuniones próximas" valor={proximas} detalle={`Próximos 7 días · ${porConfirmar} por confirmar`} icono={CalendarClock} tono={porConfirmar ? "amber" : "blue"} />}
        {veCartera && <Stat etiqueta="Mensajes sin leer" valor={sinLeer} detalle={esVendedor ? "De su cartera de clientes" : "De clientes en el portal"} icono={MessageSquare} tono={sinLeer ? "violet" : "slate"} />}
      </div>

      <div className="mt-8">
        <Tabs base="/ventas" activa={tab} tabs={tabsVisibles} />
        {tab === "pedidos" && <Pedidos where={wherePedido} pagina={pagina} estado={estadoPedido} gestiona={gestionaPedidos} />}
        {tab === "reuniones" && <Reuniones where={whereReunionLista} pagina={pagina} estado={estadoReunion} session={session} />}
        {tab === "clientes" && <Clientes where={whereCliente} pagina={pagina} asigna={session.rol === "ADMIN" || session.rol === "GERENTE"} />}
        {tab === "mensajes" && <Conversaciones where={whereCliente} />}
      </div>
    </>
  );
}

async function opcionesVendedores(giro?: Prisma.UsuarioWhereInput["giro"]) {
  const vendedores = await prisma.usuario.findMany({ where: { rol: "VENDEDOR", activo: true, ...(giro ? { giro } : {}) }, orderBy: { nombre: "asc" } });
  return vendedores.map((v) => ({ id: v.id, texto: `${v.nombre}${v.giro ? ` · ${GIROS[v.giro].corto}` : ""}`, giro: v.giro }));
}

async function Pedidos({ where, pagina, estado, gestiona }: { where: Prisma.PedidoWhereInput; pagina: number; estado?: EstadoPedido; gestiona: boolean }) {
  const [pedidos, total, plantas] = await Promise.all([
    prisma.pedido.findMany({
      where,
      include: {
        cliente: { select: { nombre: true } },
        proyecto: { select: { codigo: true } },
        vendedor: { select: { nombre: true } },
        planta: { select: { nombre: true } },
        viaje: { select: { codigo: true } },
        items: { include: { producto: { select: { nombre: true } } } },
      },
      orderBy: [{ fechaRequerida: "asc" }, { createdAt: "asc" }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    prisma.pedido.count({ where }),
    gestiona ? prisma.sede.findMany({ where: { tipo: "PLANTA_PROCESO", activa: true }, orderBy: { nombre: "asc" } }) : [],
  ]);
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-4 py-3">
        <Filtro param="estado" etiqueta="Estado" todos="Activos" opciones={Object.entries(ESTADOS_PEDIDO).map(([valor, texto]) => ({ valor, texto }))} />
        <Exportar href={`/api/reportes/pedidos${estado ? `?estado=${estado}` : ""}`} />
      </div>
      <Table>
        <thead><tr><Th>Pedido</Th><Th>Solicitante</Th><Th>Productos</Th><Th className="text-right">Total</Th><Th>Requerido</Th><Th>Planta</Th><Th>Estado</Th><Th /></tr></thead>
        <tbody>
          {pedidos.map((p) => (
            <Tr key={p.id}>
              <Td><p className="font-mono text-xs font-medium text-slate-900">{p.codigo}</p><p className="text-[11px] text-slate-500">{CANALES_PEDIDO[p.canal]} · {formatFecha(p.createdAt)}</p></Td>
              <Td className="max-w-56 text-xs">
                <p className="truncate font-medium text-slate-900">{p.cliente?.nombre ?? (p.giroSolicitante ? GIROS[p.giroSolicitante].nombre : "—")}</p>
                <p className="text-slate-500">{p.proyecto ? `Obra ${p.proyecto.codigo}` : p.vendedor ? `Vendedor: ${p.vendedor.nombre}` : "Sin vendedor"}</p>
              </Td>
              <Td className="max-w-64 text-xs"><p className="truncate">{p.items.map((i) => `${i.producto.nombre} × ${formatNum(i.cantidad, 2)}`).join(" · ")}</p></Td>
              <Td className="text-right font-medium text-slate-900">{formatQ(p.total)}</Td>
              <Td className="text-xs whitespace-nowrap">{formatFecha(p.fechaRequerida)}</Td>
              <Td className="text-xs">{p.planta?.nombre.replace("Planta de Proceso ", "") ?? "—"}</Td>
              <Td><EstadoBadge estado={p.estado} /></Td>
              <Td>{gestiona && <AccionesPedido id={p.id} codigo={p.codigo} estado={p.estado} viaje={p.viaje?.codigo ?? null} plantas={plantas.map((s) => ({ id: s.id, texto: s.nombre }))} />}</Td>
            </Tr>
          ))}
          {!pedidos.length && <EmptyRow cols={8}>No hay pedidos {estado ? ESTADOS_PEDIDO[estado].toLowerCase() + "s" : "activos"}</EmptyRow>}
        </tbody>
      </Table>
      <Paginacion total={total} pagina={pagina} base="/ventas" params={{ tab: "pedidos", estado }} />
    </Card>
  );
}

async function Reuniones({ where, pagina, estado, session }: { where: Prisma.ReunionWhereInput; pagina: number; estado?: EstadoReunion; session: Parameters<typeof puedeGestionarReuniones>[0] }) {
  const [reuniones, total, vendedores] = await Promise.all([
    prisma.reunion.findMany({
      where,
      include: { cliente: { select: { nombre: true } }, vendedor: { select: { nombre: true } } },
      orderBy: { fecha: "asc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    prisma.reunion.count({ where }),
    opcionesVendedores(),
  ]);
  const ahora = new Date();
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-4 py-3">
        <Filtro param="reunion" etiqueta="Estado" todos="Pendientes" opciones={Object.entries(ESTADOS_REUNION).map(([valor, texto]) => ({ valor, texto }))} />
      </div>
      <Table>
        <thead><tr><Th>Reunión</Th><Th>Contacto</Th><Th>Giro</Th><Th>Fecha</Th><Th>Vendedor</Th><Th>Estado</Th><Th /></tr></thead>
        <tbody>
          {reuniones.map((r) => (
            <Tr key={r.id}>
              <Td className="max-w-64"><p className="font-mono text-xs font-medium text-slate-900">{r.codigo}</p><p className="truncate text-xs text-slate-600">{r.motivo}</p></Td>
              <Td className="max-w-56 text-xs">
                <p className="truncate font-medium text-slate-900">{r.cliente?.nombre ?? r.empresa ?? r.contacto}</p>
                <p className="truncate text-slate-500">{r.contacto} · {r.email}{r.telefono ? ` · ${r.telefono}` : ""}</p>
                {!r.clienteId && <Badge tono="violeta" className="mt-1">Prospecto del sitio web</Badge>}
              </Td>
              <Td className="text-xs">{GIROS[r.giro].corto}</Td>
              <Td className="text-xs whitespace-nowrap">
                <p className={r.estado === "CONFIRMADA" && r.fecha < ahora ? "font-medium text-red-600" : "text-slate-900"}>{formatFecha(r.fecha, true)}</p>
                <p className="text-slate-500">{r.modalidad === "PRESENCIAL" ? "Presencial · Sixtino" : "Videoconferencia"}</p>
                {r.enlace && <a href={r.enlace} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Abrir enlace</a>}
              </Td>
              <Td className="text-xs">{r.vendedor?.nombre ?? <span className="text-amber-700">Sin asignar</span>}</Td>
              <Td><EstadoBadge estado={r.estado} /></Td>
              <Td>
                {puedeGestionarReuniones(session, r.giro) && (
                  <AccionesReunion
                    id={r.id}
                    codigo={r.codigo}
                    estado={r.estado}
                    fecha={r.fecha.toISOString()}
                    modalidad={r.modalidad}
                    enlace={r.enlace}
                    vendedores={vendedores.filter((v) => v.giro === r.giro && v.id !== r.vendedorId)}
                  />
                )}
              </Td>
            </Tr>
          ))}
          {!reuniones.length && <EmptyRow cols={7}>No hay reuniones {estado ? ESTADOS_REUNION[estado].toLowerCase() + "s" : "pendientes"}</EmptyRow>}
        </tbody>
      </Table>
      <Paginacion total={total} pagina={pagina} base="/ventas" params={{ tab: "reuniones", reunion: estado }} />
      <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Las reuniones presenciales se realizan en el {SEDE_CENTRAL}.</p>
    </Card>
  );
}

async function Clientes({ where, pagina, asigna }: { where: Prisma.ClienteWhereInput; pagina: number; asigna: boolean }) {
  const [clientes, total, vendedores] = await Promise.all([
    prisma.cliente.findMany({
      where,
      include: {
        vendedor: { select: { nombre: true } },
        _count: { select: { usuarios: true, pedidos: { where: { estado: { in: ACTIVOS } } }, viajes: true, contratos: true, proyectos: true } },
      },
      orderBy: { nombre: "asc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    prisma.cliente.count({ where }),
    asigna ? opcionesVendedores() : [],
  ]);
  return (
    <Card>
      <Table>
        <thead><tr><Th>Cliente</Th><Th>Contacto</Th><Th>Vendedor</Th><Th className="text-right">Negocios</Th><Th>Portal</Th><Th /></tr></thead>
        <tbody>
          {clientes.map((c) => (
            <Tr key={c.id}>
              <Td className="max-w-64"><p className="truncate font-medium text-slate-900">{c.nombre}</p><p className="text-xs text-slate-500">NIT {c.nit} · {c.tipo === "EXTRANJERO" ? c.pais : "Nacional"}</p></Td>
              <Td className="max-w-56 text-xs"><p className="truncate">{c.contacto ?? "—"}</p><p className="truncate text-slate-500">{[c.email, c.telefono].filter(Boolean).join(" · ")}</p></Td>
              <Td className="text-xs">{c.vendedor?.nombre ?? <span className="text-amber-700">Sin asignar</span>}</Td>
              <Td className="text-right text-xs text-slate-600">
                {c._count.viajes} viajes · {c._count.contratos} alquileres · {c._count.proyectos} obras
                {c._count.pedidos > 0 && <span className="block font-medium text-slate-900">{c._count.pedidos} pedidos activos</span>}
              </Td>
              <Td>{c._count.usuarios ? <Badge tono="verde">{c._count.usuarios} usuario{c._count.usuarios === 1 ? "" : "s"}</Badge> : <Badge>Sin acceso</Badge>}</Td>
              <Td>
                <div className="flex justify-end gap-1.5">
                  {asigna && <AsignarVendedor clienteId={c.id} nombre={c.nombre} actual={c.vendedorId} vendedores={vendedores} />}
                  <Link href={`/ventas/mensajes/${c.id}`} className="rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50">Mensajes</Link>
                </div>
              </Td>
            </Tr>
          ))}
          {!clientes.length && <EmptyRow cols={6}>No hay clientes en esta cartera</EmptyRow>}
        </tbody>
      </Table>
      <Paginacion total={total} pagina={pagina} base="/ventas" params={{ tab: "clientes" }} />
    </Card>
  );
}

async function Conversaciones({ where }: { where: Prisma.ClienteWhereInput }) {
  const clientes = await prisma.cliente.findMany({
    where: { ...where, mensajes: { some: {} } },
    include: {
      mensajes: { orderBy: { createdAt: "desc" }, take: 1, include: { autor: { select: { nombre: true } } } },
      _count: { select: { mensajes: { where: { deCliente: true, leido: false } } } },
    },
  });
  const ordenados = clientes.sort((a, b) => b.mensajes[0].createdAt.getTime() - a.mensajes[0].createdAt.getTime());
  return (
    <Card>
      <ul className="divide-y divide-slate-100">
        {ordenados.map((c) => {
          const ultimo = c.mensajes[0];
          return (
            <li key={c.id}>
              <Link href={`/ventas/mensajes/${c.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{c.nombre}</p>
                  <p className="truncate text-sm text-slate-500">{ultimo.deCliente ? "" : "Usted: "}{ultimo.texto}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-slate-400">{formatFecha(ultimo.createdAt, true)}</span>
                  {c._count.mensajes > 0 && <Badge tono="violeta">{c._count.mensajes} sin leer</Badge>}
                </div>
              </Link>
            </li>
          );
        })}
        {!ordenados.length && <li className="py-10 text-center text-sm text-slate-400">Aún no hay conversaciones con clientes.</li>}
      </ul>
    </Card>
  );
}
