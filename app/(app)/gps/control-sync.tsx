"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { sincronizarGPSAction } from "@/app/actions/gps";

const INTERVALO_MS = 60_000;

/** Sincroniza con GPS-Inversiones a demanda o de forma periódica mientras la página está abierta. */
export function ControlSync({ puedeSincronizar }: { puedeSincronizar: boolean }) {
  const [pending, start] = useTransition();
  const [auto, setAuto] = useState(false);
  const [estado, setEstado] = useState<{ ok: boolean; texto: string } | null>(null);

  const sincronizar = useCallback(() => {
    start(async () => {
      const r = await sincronizarGPSAction();
      const ahora = new Intl.DateTimeFormat("es-GT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
      setEstado({ ok: r.ok, texto: r.ok ? `${ahora} · ${r.mensaje}` : (r.mensaje ?? "No se pudo sincronizar") });
    });
  }, []);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(sincronizar, INTERVALO_MS);
    return () => clearInterval(id);
  }, [auto, sincronizar]);

  if (!puedeSincronizar) return null;
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="size-4 rounded border-slate-300 accent-brand-600" />
          Automático (cada 60 s)
        </label>
        <button type="button" onClick={sincronizar} disabled={pending} className={buttonClass("primario")}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Sincronizar con GPS-Inversiones
        </button>
      </div>
      {estado && <p role="status" className={estado.ok ? "text-xs text-slate-500" : "text-xs text-red-600"}>{estado.texto}</p>}
    </div>
  );
}
