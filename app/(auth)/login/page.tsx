import type { Metadata } from "next";
import { Container, Factory, HardHat, Pickaxe, Tractor, Truck } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

const giros = [
  { icono: Pickaxe, texto: "Extracción minera" },
  { icono: Factory, texto: "Plantas de proceso" },
  { icono: Tractor, texto: "Maquinaria" },
  { icono: Truck, texto: "Transporte de materia prima" },
  { icono: Container, texto: "Transporte de productos" },
  { icono: HardHat, texto: "Construcción" },
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { motivo, next } = await searchParams;
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "48px 48px" }}
        />
        <div aria-hidden className="absolute -right-32 -bottom-32 size-[520px] rounded-full bg-blue-600/30 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <Logo />
          <span className="text-lg font-semibold tracking-tight">TransPort ERP</span>
        </div>
        <div className="relative max-w-lg">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight">
            Todas las operaciones de TransPort en una sola plataforma.
          </h1>
          <p className="mt-4 text-slate-300">
            Producción, flota, maquinaria, obras y finanzas de cada giro de negocio, con monitoreo GPS y alertas en tiempo real.
          </p>
          <ul className="mt-10 grid grid-cols-2 gap-3">
            {giros.map(({ icono: Icono, texto }) => (
              <li key={texto} className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2.5 text-sm text-slate-200 ring-1 ring-white/10">
                <Icono className="size-4 text-blue-300" aria-hidden />
                {texto}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">Sede central · Edificio Sixtino, Zona 10, Ciudad de Guatemala</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo />
            <span className="text-lg font-semibold">TransPort ERP</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-slate-500">Ingrese con su cuenta corporativa.</p>
          {motivo === "inactivo" && (
            <p role="alert" className="mt-6 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              Su cuenta fue desactivada. Comuníquese con el administrador general.
            </p>
          )}
          <LoginForm siguiente={typeof next === "string" ? next : undefined} />
          <details className="mt-8 rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-600">
            <summary className="cursor-pointer font-medium text-slate-700">Cuentas de demostración</summary>
            <ul className="mt-3 space-y-1.5 font-mono">
              <li>admin@transport.gt · Admin2026!</li>
              <li>contabilidad@transport.gt · Conta2026!</li>
              <li>transportemp@transport.gt · Gerente2026!</li>
              <li>proceso@transport.gt · Gerente2026!</li>
            </ul>
            <p className="mt-2 text-slate-500">Hay una cuenta de gerente por cada giro (ver README).</p>
          </details>
        </div>
      </section>
    </main>
  );
}

function Logo() {
  return (
    <span className="grid size-9 place-items-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-600/30">
      <Truck className="size-5" aria-hidden />
    </span>
  );
}
