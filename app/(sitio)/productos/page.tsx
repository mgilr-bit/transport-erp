import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { formatQ } from "@/lib/utils";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = {
  title: { absolute: "Productos · TransPort" },
  description: "Pisos cerámicos, porcelanato, azulejo, block, ladrillo, teja y materiales de construcción de las plantas de TransPort.",
};

export default async function ProductosPage() {
  await connection();
  const productos = await prisma.producto.findMany({ orderBy: [{ categoria: "asc" }, { nombre: "asc" }] });
  const categorias = [...new Set(productos.map((p) => p.categoria))];

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Productos</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Fabricados en nuestras plantas de Zacapa, Huehuetenango y Petén. Los clientes con acceso al portal pueden pedir en línea; si aún no tiene cuenta, solicítela a un asesor.
      </p>
      {categorias.map((c) => (
        <section key={c} className="mt-10">
          <h2 className="text-xl font-semibold text-slate-900">{c}</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {productos.filter((p) => p.categoria === c).map((p) => (
              <li key={p.id} className="flex flex-col rounded-xl border border-slate-200 p-5">
                <p className="font-mono text-xs text-slate-400">{p.codigo}</p>
                <p className="mt-1 flex-1 font-medium text-slate-900">{p.nombre}</p>
                <p className="mt-3 text-lg font-semibold text-slate-900 tabular">{formatQ(p.precio)} <span className="text-sm font-normal text-slate-500">/ {p.unidad}</span></p>
                <Link href={`/portal/pedidos/nuevo?producto=${p.id}`} className={`${buttonClass("primario", "sm")} mt-4 justify-center`}>Pedir en línea</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="mt-12 rounded-xl bg-slate-50 p-6 ring-1 ring-slate-200">
        <p className="font-medium text-slate-900">¿Necesita volumen, entrega programada o precio por proyecto?</p>
        <p className="mt-1 text-sm text-slate-600">Un asesor de Plantas de proceso le prepara una propuesta.</p>
        <Link href="/contacto?giro=PROCESO" className={`${buttonClass("secundario", "sm")} mt-4`}>Agendar reunión</Link>
      </div>
    </div>
  );
}
