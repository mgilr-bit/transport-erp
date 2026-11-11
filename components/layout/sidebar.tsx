"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icono } from "@/components/layout/icono";
import type { ItemNav } from "@/lib/navegacion";

export function Sidebar({ secciones, alertas }: { secciones: { seccion: string; items: ItemNav[] }[]; alertas: number }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-slate-950 text-slate-300 lg:flex print:hidden">
      <div className="flex h-16 items-center gap-3 border-b border-white/5 px-5">
        <span className="grid size-8 place-items-center rounded-lg bg-blue-600 text-white">
          <Truck className="size-4.5" aria-hidden />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">TransPort ERP</p>
          <p className="text-[11px] text-slate-500">Guatemala</p>
        </div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Principal">
        {secciones.map((s) => (
          <div key={s.seccion}>
            <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{s.seccion}</p>
            <ul className="space-y-0.5">
              {s.items.map((item) => {
                const activo = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={activo ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        activo ? "bg-white/10 font-medium text-white" : "hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <Icono nombre={item.icono} className={cn("size-4", activo ? "text-blue-400" : "text-slate-500")} />
                      <span className="flex-1">{item.label}</span>
                      {item.href === "/alertas" && alertas > 0 && (
                        <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular">{alertas}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/5 px-5 py-4 text-[11px] text-slate-500">
        Sede central · Edificio Sixtino, Z10
      </div>
    </aside>
  );
}

/** Navegación horizontal para pantallas pequeñas */
export function MobileNav({ secciones }: { secciones: { seccion: string; items: ItemNav[] }[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 lg:hidden print:hidden" aria-label="Principal móvil">
      {secciones.flatMap((s) => s.items).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs",
            pathname.startsWith(item.href) ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
          )}
        >
          <Icono nombre={item.icono} className="size-3.5" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
