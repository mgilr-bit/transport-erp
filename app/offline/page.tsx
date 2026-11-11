import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "Sin conexión" };

/** Página que muestra el service worker cuando no hay red. No consulta la base de datos. */
export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center p-6 text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-slate-200 text-slate-600"><WifiOff className="size-6" aria-hidden /></span>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Sin conexión</h1>
        <p className="mt-2 text-sm text-slate-600">TransPort necesita internet para mostrar datos actualizados. Revise su conexión e intente de nuevo.</p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- recarga completa: esta página la sirve el service worker sin red */}
        <a href="/" className="mt-6 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Reintentar</a>
      </div>
    </main>
  );
}
