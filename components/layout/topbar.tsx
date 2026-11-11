import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { GIROS, ROLES } from "@/lib/constants";
import type { SessionPayload } from "@/lib/session";
import { BotonNotificaciones } from "@/components/pwa/notificaciones";

export function Topbar({ session, alertas }: { session: SessionPayload; alertas: number }) {
  const iniciales = session.nombre
    .replace(/^(Ing\.|Lic\.|Lcda\.|Licda\.|Arq\.)\s*/, "")
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/85 px-4 backdrop-blur sm:px-8 print:hidden">
      <div className="text-sm text-slate-500">
        <span className="font-medium text-slate-900">{session.giro ? GIROS[session.giro].nombre : "Vista corporativa"}</span>
        <span className="hidden sm:inline"> · {ROLES[session.rol]}</span>
      </div>
      <div className="flex items-center gap-2">
        <BotonNotificaciones />
        <Link href="/alertas" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label={`${alertas} alertas sin leer`}>
          <Bell className="size-5" />
          {alertas > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-red-500 ring-2 ring-white" />}
        </Link>
        <div className="mx-2 h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white">{iniciales}</span>
          <div className="hidden leading-tight md:block">
            <p className="text-sm font-medium text-slate-900">{session.nombre}</p>
            <p className="text-xs text-slate-500">{session.email}</p>
          </div>
          <form action={logout}>
            <button type="submit" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut className="size-4.5" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
