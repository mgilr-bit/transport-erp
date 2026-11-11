import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, BellRing, FileText, MapPinned, MessageSquare, PackageCheck, ShoppingCart } from "lucide-react";
import { prisma } from "@/lib/db";
import { GIROS } from "@/lib/constants";
import { PAGINAS_GIRO } from "@/lib/sitio";
import { formatNum } from "@/lib/utils";
import { Icono } from "@/components/layout/icono";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = {
  title: { absolute: "TransPort · Extracción, producción, maquinaria, transporte y construcción" },
  description: "Grupo guatemalteco con seis giros de negocio: minas, plantas de pisos cerámicos y materiales, maquinaria, transporte de materia prima y de productos, y construcción.",
};

const PORTAL = [
  { icono: MapPinned, texto: "Seguimiento de sus viajes de materia prima y de productos" },
  { icono: ShoppingCart, texto: "Pedidos en línea de pisos y materiales, también desde un archivo CSV" },
  { icono: PackageCheck, texto: "Estado de sus alquileres, compras de maquinaria y obras" },
  { icono: FileText, texto: "Estado de cuenta descargable" },
  { icono: MessageSquare, texto: "Mensajes directos con su vendedor asignado" },
  { icono: BellRing, texto: "Notificaciones de pedidos, viajes, reuniones y vencimientos" },
];

export default async function InicioPage() {
  await connection();
  const [sedes, camiones, maquinas, obras, clientes, porGiro] = await Promise.all([
    prisma.sede.count({ where: { activa: true } }),
    prisma.camion.count({ where: { estado: { not: "INACTIVO" } } }),
    prisma.maquina.count({ where: { estado: { not: "VENDIDA" } } }),
    prisma.proyectoConstruccion.count(),
    prisma.cliente.count(),
    prisma.sede.groupBy({ by: ["giro"], where: { activa: true }, _count: true }),
  ]);
  const sedesDe = (giro: string) => porGiro.find((g) => g.giro === giro)?._count ?? 0;

  return (
    <>
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div aria-hidden className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
        <div aria-hidden className="absolute -right-40 -bottom-40 size-[560px] rounded-full bg-blue-600/30 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="text-sm font-medium text-blue-300">Grupo TransPort · Guatemala</p>
          <h1 className="mt-3 max-w-3xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            De la mina a su obra: extracción, producción, maquinaria, transporte y construcción.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-300">
            Seis empresas coordinadas desde nuestra sede central para abastecer, mover y construir en todo el país, con seguimiento en línea de cada operación.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/productos" className={buttonClass("primario")}>Ver productos <ArrowRight className="size-4" aria-hidden /></Link>
            <Link href="/contacto" className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/20 hover:bg-white/15">Agendar una reunión</Link>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-5 sm:px-6">
          {[
            ["Sedes en el país", sedes],
            ["Camiones de carga", camiones],
            ["Máquinas de construcción", maquinas],
            ["Obras ejecutadas y en curso", obras],
            ["Clientes nacionales y extranjeros", clientes],
          ].map(([k, v]) => (
            <div key={k as string}>
              <dt className="text-xs text-slate-500">{k}</dt>
              <dd className="mt-1 text-3xl font-semibold text-slate-900 tabular">{formatNum(v as number)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="giros" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Nuestros giros de negocio</h2>
        <p className="mt-2 max-w-2xl text-slate-600">Cada empresa opera con su propio equipo y presupuesto, y todas se abastecen entre sí para entregar a tiempo.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PAGINAS_GIRO.map((p) => (
            <Link key={p.slug} href={`/giros/${p.slug}`} className="group rounded-xl border border-slate-200 bg-white p-6 transition hover:border-slate-300 hover:shadow-sm">
              <span className="grid size-10 place-items-center rounded-lg text-white" style={{ backgroundColor: GIROS[p.giro].color }}>
                <Icono nombre={GIROS[p.giro].icono} className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold text-slate-900 group-hover:text-brand-600">{p.titulo}</h3>
              <p className="mt-1 text-sm text-slate-600">{p.lema}</p>
              <p className="mt-4 text-xs text-slate-500">{sedesDe(p.giro)} sede{sedesDe(p.giro) === 1 ? "" : "s"} · Ver servicios →</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Una cadena integrada</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-4">
            {[
              ["Extraemos", "La materia prima sale de nuestras minas en Cobán, El Progreso, Xela y Petén."],
              ["Producimos", "Nuestras plantas la convierten en pisos cerámicos y materiales de construcción."],
              ["Transportamos", "Nuestra flota monitoreada por GPS mueve materia prima, productos y contenedores."],
              ["Construimos", "Ejecutamos obras con maquinaria y materiales del propio grupo."],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
                <span className="text-sm font-semibold text-brand-600">0{i + 1}</span>
                <p className="mt-2 font-semibold text-slate-900">{t}</p>
                <p className="mt-1 text-sm text-slate-600">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Portal de clientes</h2>
          <p className="mt-2 text-slate-600">Su relación con todas las empresas del grupo en un solo lugar, desde la computadora o el teléfono.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/login?next=/portal" className={buttonClass("primario")}>Ingresar al portal</Link>
            <Link href="/contacto" className={buttonClass("secundario")}>Solicitar acceso</Link>
          </div>
          <p className="mt-6 text-sm text-slate-500">¿Su empresa usa un ERP? Conéctelo con nuestra API REST, webhooks o archivos CSV.</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {PORTAL.map(({ icono: I, texto }) => (
            <li key={texto} className="flex gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
              <I className="size-5 shrink-0 text-brand-600" aria-hidden /> {texto}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-slate-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-12 sm:px-6">
          <div>
            <p className="text-sm text-blue-300">Confían en nosotros</p>
            <p className="mt-1 text-lg font-medium">Cemex · Cementos Progreso · Hispacensa · navieras y distribuidores de la región</p>
          </div>
          <Link href="/contacto" className={buttonClass("primario")}>Hablar con un asesor</Link>
        </div>
      </section>
    </>
  );
}
