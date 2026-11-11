import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Check, MapPin, Phone } from "lucide-react";
import { prisma } from "@/lib/db";
import { GIROS, MODALIDADES, TIPOS_OBRA } from "@/lib/constants";
import { PAGINAS_GIRO, paginaDeGiro } from "@/lib/sitio";
import { formatNum, formatQ, toNumber } from "@/lib/utils";
import { Icono } from "@/components/layout/icono";
import { buttonClass } from "@/components/ui/button";

export function generateStaticParams() {
  return PAGINAS_GIRO.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/giros/[slug]">): Promise<Metadata> {
  const pagina = paginaDeGiro((await params).slug);
  return pagina ? { title: { absolute: `${pagina.titulo} · TransPort` }, description: pagina.descripcion } : {};
}

export default async function GiroPage({ params }: PageProps<"/giros/[slug]">) {
  const pagina = paginaDeGiro((await params).slug);
  if (!pagina) notFound();
  await connection();
  const { giro } = pagina;
  const color = GIROS[giro].color;
  const sedes = await prisma.sede.findMany({ where: { giro, activa: true }, orderBy: { nombre: "asc" } });

  return (
    <>
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <span className="grid size-12 place-items-center rounded-xl text-white" style={{ backgroundColor: color }}>
            <Icono nombre={GIROS[giro].icono} className="size-6" />
          </span>
          <p className="mt-5 text-sm font-medium" style={{ color }}>{pagina.lema}</p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight text-slate-900">{pagina.titulo}</h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-600">{pagina.descripcion}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/contacto?giro=${giro}`} className={buttonClass("primario")}>Agendar reunión con un asesor</Link>
            {giro === "PROCESO" && <Link href="/productos" className={buttonClass("secundario")}>Ver catálogo y pedir en línea</Link>}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold text-slate-900">Servicios</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {pagina.servicios.map((s) => (
              <li key={s} className="flex gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
                <Check className="mt-0.5 size-4 shrink-0" style={{ color }} aria-hidden /> {s}
              </li>
            ))}
          </ul>
          <div className="mt-10"><Detalle giro={giro} /></div>
        </div>
        <aside>
          <h2 className="text-xl font-semibold text-slate-900">Sedes</h2>
          <ul className="mt-4 space-y-3">
            {sedes.map((s) => (
              <li key={s.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                <p className="font-medium text-slate-900">{s.nombre}</p>
                <p className="mt-1 flex items-start gap-1.5 text-slate-600"><MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {s.direccion}, {s.departamento}</p>
                {s.telefono && <p className="mt-1 flex items-center gap-1.5 text-slate-600"><Phone className="size-3.5" aria-hidden /> {s.telefono}</p>}
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </>
  );
}

/** Información propia de cada giro, tomada de la operación real. */
async function Detalle({ giro }: { giro: keyof typeof GIROS }) {
  if (giro === "PROCESO") {
    const productos = await prisma.producto.findMany({ orderBy: [{ categoria: "asc" }, { nombre: "asc" }] });
    return (
      <>
        <h2 className="text-xl font-semibold text-slate-900">Productos</h2>
        <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {productos.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span><span className="font-medium text-slate-900">{p.nombre}</span><span className="block text-xs text-slate-500">{p.categoria}</span></span>
              <span className="text-slate-700 tabular">{formatQ(p.precio)} / {p.unidad}</span>
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (giro === "EXTRACCION") {
    const materiales = await prisma.material.findMany({ where: { esMateriaPrima: true }, orderBy: { nombre: "asc" } });
    return (
      <>
        <h2 className="text-xl font-semibold text-slate-900">Materiales disponibles</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {materiales.map((m) => <span key={m.id} className="rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-900 ring-1 ring-amber-200">{m.nombre}</span>)}
        </div>
      </>
    );
  }
  if (giro === "MAQUINARIA") {
    const tipos = await prisma.maquina.groupBy({ by: ["tipo"], where: { estado: { not: "VENDIDA" } }, _count: true, _min: { tarifaDiaria: true } });
    return (
      <>
        <h2 className="text-xl font-semibold text-slate-900">Flota disponible para alquiler y venta</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {tipos.sort((a, b) => b._count - a._count).map((t) => (
            <li key={t.tipo} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm">
              <span className="font-medium text-slate-900">{t.tipo}<span className="block text-xs font-normal text-slate-500">{t._count} unidades</span></span>
              <span className="text-xs text-slate-600">desde {formatQ(t._min.tarifaDiaria)} / día</span>
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (giro === "TRANSPORTE_MP" || giro === "TRANSPORTE_PROD") {
    const flota = await prisma.camion.groupBy({ by: ["tipo"], where: { giro, estado: { not: "INACTIVO" } }, _count: true, _max: { capacidadTon: true } });
    const modalidades = giro === "TRANSPORTE_PROD" ? Object.values(MODALIDADES) : [MODALIDADES.NACIONAL];
    return (
      <>
        <h2 className="text-xl font-semibold text-slate-900">Flota</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {flota.map((f) => (
            <li key={f.tipo} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
              <span className="font-medium text-slate-900">{f.tipo}</span>
              <span className="block text-xs text-slate-500">{f._count} unidades · hasta {formatNum(toNumber(f._max.capacidadTon))} t</span>
            </li>
          ))}
        </ul>
        <h2 className="mt-8 text-xl font-semibold text-slate-900">Modalidades</h2>
        <div className="mt-4 flex flex-wrap gap-2">{modalidades.map((m) => <span key={m} className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-800 ring-1 ring-blue-200">{m}</span>)}</div>
      </>
    );
  }
  if (giro === "CONSTRUCCION") {
    const porTipo = await prisma.proyectoConstruccion.groupBy({ by: ["tipo"], _count: true });
    return (
      <>
        <h2 className="text-xl font-semibold text-slate-900">Experiencia</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {porTipo.map((t) => (
            <li key={t.tipo} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
              <span className="text-2xl font-semibold text-slate-900 tabular">{t._count}</span>
              <span className="block text-slate-600">{TIPOS_OBRA[t.tipo]}{t._count === 1 ? "" : "s"}</span>
            </li>
          ))}
        </ul>
      </>
    );
  }
  return null;
}
