import type { Metadata } from "next";
import { Building2, CalendarClock, Video } from "lucide-react";
import { getUsuarioActual } from "@/lib/auth";
import { GIROS_OPERATIVOS, SEDE_CENTRAL } from "@/lib/constants";
import { PAGINAS_GIRO } from "@/lib/sitio";
import { entradaFechaHoraGT } from "@/lib/utils";
import { FormularioContacto } from "./formulario";

export const metadata: Metadata = {
  title: { absolute: "Contacto · TransPort" },
  description: "Agende una reunión presencial o por videoconferencia con un asesor de cualquiera de los giros de TransPort.",
};

export default async function ContactoPage({ searchParams }: PageProps<"/contacto">) {
  const { giro } = await searchParams;
  const session = await getUsuarioActual();
  const giros = PAGINAS_GIRO.map((p) => ({ valor: p.giro, texto: p.titulo }));
  const giroInicial = typeof giro === "string" && (GIROS_OPERATIVOS as string[]).includes(giro) ? giro : undefined;
  const ahora = new Date();
  const manana = new Date(ahora.getTime() + 86_400_000);
  manana.setUTCHours(16, 0, 0, 0); // 10:00 en Guatemala
  const fechas = { sugerida: entradaFechaHoraGT(manana), minima: entradaFechaHoraGT(ahora) };

  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Hablemos de su proyecto</h1>
        <p className="mt-3 text-slate-600">Solicite una reunión con un asesor del giro que le interesa. Le asignamos un vendedor que le acompañará durante toda la negociación.</p>
        <ul className="mt-8 space-y-5 text-sm text-slate-700">
          <li className="flex gap-3"><Building2 className="size-5 shrink-0 text-brand-600" aria-hidden /><span><strong className="block text-slate-900">Presencial</strong>En nuestra sede central, {SEDE_CENTRAL}.</span></li>
          <li className="flex gap-3"><Video className="size-5 shrink-0 text-brand-600" aria-hidden /><span><strong className="block text-slate-900">Videoconferencia</strong>Le enviamos el enlace al confirmar la fecha.</span></li>
          <li className="flex gap-3"><CalendarClock className="size-5 shrink-0 text-brand-600" aria-hidden /><span><strong className="block text-slate-900">Confirmación</strong>El asesor confirma la fecha y, si ya es cliente, la verá en su portal.</span></li>
        </ul>
      </div>
      <div className="rounded-2xl border border-slate-200 p-6 sm:p-8 lg:col-span-3">
        <FormularioContacto
          giros={giros}
          giroInicial={giroInicial}
          contacto={session?.rol === "CLIENTE" ? { nombre: session.nombre, email: session.email } : undefined}
          fechas={fechas}
        />
      </div>
    </div>
  );
}
