"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Select que actualiza un parámetro de la URL (filtros de listados). */
export function Filtro({ param, opciones, etiqueta, todos = "Todos" }: { param: string; opciones: { valor: string; texto: string }[]; etiqueta: string; todos?: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
      {etiqueta}
      <select
        className="h-8 rounded-lg border-0 bg-white py-0 pr-8 pl-2.5 text-sm text-slate-800 shadow-sm ring-1 ring-slate-300 ring-inset focus:ring-2 focus:ring-brand-500"
        value={search.get(param) ?? ""}
        onChange={(e) => {
          const qs = new URLSearchParams(search);
          if (e.target.value) qs.set(param, e.target.value);
          else qs.delete(param);
          qs.delete("pagina");
          router.push(`${pathname}?${qs}`);
        }}
      >
        {todos !== null && <option value="">{todos}</option>}
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </label>
  );
}
