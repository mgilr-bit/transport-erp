import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const POR_PAGINA = 20;

export function paginaDe(valor: string | string[] | undefined) {
  const n = Number(Array.isArray(valor) ? valor[0] : valor);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function Paginacion({ total, pagina, base, params }: { total: number; pagina: number; base: string; params: Record<string, string | undefined> }) {
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const href = (p: number) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries({ ...params, pagina: String(p) }).filter(([, v]) => v)) as Record<string, string>);
    return `${base}?${qs}`;
  };
  const desde = total === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1;
  const hasta = Math.min(total, pagina * POR_PAGINA);
  const boton = "inline-flex size-8 items-center justify-center rounded-lg ring-1 ring-slate-200 ring-inset";
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
      <span className="tabular">
        {desde}–{hasta} de {total}
      </span>
      <div className="flex gap-1.5">
        {pagina > 1 ? <Link href={href(pagina - 1)} className={cn(boton, "hover:bg-slate-50")} aria-label="Anterior"><ChevronLeft className="size-4" /></Link> : <span className={cn(boton, "opacity-40")}><ChevronLeft className="size-4" /></span>}
        {pagina < paginas ? <Link href={href(pagina + 1)} className={cn(boton, "hover:bg-slate-50")} aria-label="Siguiente"><ChevronRight className="size-4" /></Link> : <span className={cn(boton, "opacity-40")}><ChevronRight className="size-4" /></span>}
      </div>
    </div>
  );
}
