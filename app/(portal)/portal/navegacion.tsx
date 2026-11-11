"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ENLACES = [
  { href: "/portal", texto: "Resumen" },
  { href: "/portal/pedidos", texto: "Pedidos" },
  { href: "/portal/reuniones", texto: "Reuniones" },
  { href: "/portal/mensajes", texto: "Mensajes" },
  { href: "/portal/estado-de-cuenta", texto: "Estado de cuenta" },
];

export function NavegacionPortal({ mensajes }: { mensajes: number }) {
  const ruta = usePathname();
  return (
    <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6" aria-label="Portal">
      {ENLACES.map((e) => {
        const activo = e.href === "/portal" ? ruta === "/portal" : ruta.startsWith(e.href);
        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={activo ? "page" : undefined}
            className={cn("flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm whitespace-nowrap", activo ? "border-brand-600 font-medium text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900")}
          >
            {e.texto}
            {e.href === "/portal/mensajes" && mensajes > 0 && <span className="rounded-full bg-violet-600 px-1.5 text-[10px] font-semibold text-white">{mensajes}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
