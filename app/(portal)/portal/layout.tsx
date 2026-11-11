import type { Metadata } from "next";
import Link from "next/link";
import { LogOut, Truck } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireCliente } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { NavegacionPortal } from "./navegacion";

export const metadata: Metadata = { title: { default: "Portal de clientes", template: "%s · Portal TransPort" } };

/** Portal de clientes: sus negocios con todas las empresas del grupo. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireCliente();
  const [cliente, mensajes] = await Promise.all([
    prisma.cliente.findUniqueOrThrow({ where: { id: session.clienteId }, select: { nombre: true } }),
    prisma.mensaje.count({ where: { clienteId: session.clienteId, deCliente: false, leido: false } }),
  ]);
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-slate-900">
            <span className="grid size-8 place-items-center rounded-lg bg-blue-600 text-white"><Truck className="size-4.5" aria-hidden /></span>
            <span>TransPort <span className="font-normal text-slate-500">· Portal de clientes</span></span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-right sm:block">
              <span className="block font-medium text-slate-900">{session.nombre}</span>
              <span className="block text-xs text-slate-500">{cliente.nombre}</span>
            </span>
            <form action={logout}>
              <button type="submit" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar sesión" title="Cerrar sesión">
                <LogOut className="size-4.5" />
              </button>
            </form>
          </div>
        </div>
        <NavegacionPortal mensajes={mensajes} />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
