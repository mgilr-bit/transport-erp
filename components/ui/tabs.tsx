import Link from "next/link";
import { cn } from "@/lib/utils";

/** Pestañas basadas en URL (?tab=), funcionan sin JavaScript. */
export function Tabs({ tabs, activa, base, params = {} }: { tabs: { id: string; label: string; total?: number }[]; activa: string; base: string; params?: Record<string, string | undefined> }) {
  return (
    <div className="mb-5 border-b border-slate-200">
      <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Pestañas">
        {tabs.map((t) => {
          const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)), tab: t.id } as Record<string, string>);
          const activo = t.id === activa;
          return (
            <Link
              key={t.id}
              href={`${base}?${qs}`}
              aria-current={activo ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium whitespace-nowrap transition-colors",
                activo ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700",
              )}
            >
              {t.label}
              {t.total !== undefined && (
                <span className={cn("rounded-full px-2 py-0.5 text-xs tabular", activo ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-600")}>{t.total}</span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
