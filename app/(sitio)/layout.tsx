import Link from "next/link";
import { Truck } from "lucide-react";
import { getSession } from "@/lib/session";
import { SEDE_CENTRAL } from "@/lib/constants";
import { PAGINAS_GIRO } from "@/lib/sitio";
import { buttonClass } from "@/components/ui/button";

const ENLACES = [
  { href: "/#giros", texto: "Giros de negocio" },
  { href: "/productos", texto: "Productos" },
  { href: "/contacto", texto: "Contacto" },
];

/** Sitio público: sala de ventas de los seis giros y puerta de entrada al portal de clientes. */
export default async function SitioLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const acceso = !session
    ? { href: "/login?next=/portal", texto: "Portal de clientes" }
    : session.rol === "CLIENTE"
      ? { href: "/portal", texto: "Mi portal" }
      : { href: "/dashboard", texto: "Ir al sistema" };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-slate-900">
            <span className="grid size-8 place-items-center rounded-lg bg-blue-600 text-white"><Truck className="size-4.5" aria-hidden /></span>
            TransPort
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex" aria-label="Sitio">
            {ENLACES.map((e) => <Link key={e.href} href={e.href} className="hover:text-slate-900">{e.texto}</Link>)}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/contacto" className={`${buttonClass("secundario", "sm")} hidden sm:inline-flex`}>Agendar reunión</Link>
            <Link href={acceso.href} className={buttonClass("primario", "sm")}>{acceso.texto}</Link>
          </div>
        </div>
        <nav className="flex gap-5 overflow-x-auto border-t border-slate-100 px-4 py-2 text-sm text-slate-600 md:hidden" aria-label="Sitio móvil">
          {ENLACES.map((e) => <Link key={e.href} href={e.href} className="whitespace-nowrap">{e.texto}</Link>)}
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-slate-950 text-sm text-slate-400">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
          <div>
            <p className="flex items-center gap-2 font-semibold text-white"><Truck className="size-4" aria-hidden /> TransPort</p>
            <p className="mt-3">Sede central: {SEDE_CENTRAL}.</p>
            <p className="mt-1">Reuniones presenciales y por videoconferencia.</p>
          </div>
          <div>
            <p className="font-medium text-white">Giros de negocio</p>
            <ul className="mt-3 space-y-1.5">
              {PAGINAS_GIRO.map((p) => <li key={p.slug}><Link href={`/giros/${p.slug}`} className="hover:text-white">{p.titulo}</Link></li>)}
            </ul>
          </div>
          <div>
            <p className="font-medium text-white">Clientes</p>
            <ul className="mt-3 space-y-1.5">
              <li><Link href="/portal" className="hover:text-white">Portal de clientes</Link></li>
              <li><Link href="/productos" className="hover:text-white">Catálogo y pedidos en línea</Link></li>
              <li><Link href="/contacto" className="hover:text-white">Solicitar una reunión</Link></li>
            </ul>
          </div>
        </div>
        <p className="border-t border-white/5 py-4 text-center text-xs text-slate-500">© {new Date().getFullYear()} TransPort · Guatemala</p>
      </footer>
    </div>
  );
}
