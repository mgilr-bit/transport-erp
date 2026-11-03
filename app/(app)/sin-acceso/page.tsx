import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export default function SinAcceso() {
  return (
    <div className="mx-auto mt-24 max-w-md text-center">
      <ShieldAlert className="mx-auto size-12 text-amber-500" aria-hidden />
      <h1 className="mt-4 text-xl font-semibold text-slate-900">Acceso restringido</h1>
      <p className="mt-2 text-sm text-slate-500">Su rol no tiene permiso para ver este módulo. Si lo necesita, solicite acceso al administrador general.</p>
      <Link href="/dashboard" className={`${buttonClass("secundario")} mt-6`}>Volver al panel</Link>
    </div>
  );
}
