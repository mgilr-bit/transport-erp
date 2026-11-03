"use client";

import { useTransition, useState } from "react";
import { Loader2 } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import type { ActionState } from "@/components/ui/form";

/** Botón que ejecuta una server action sin formulario (aprobar, iniciar, entregar…). */
export function ActionButton({
  action,
  children,
  confirmar,
  variante = "secundario",
}: {
  action: () => Promise<ActionState>;
  children: React.ReactNode;
  confirmar?: string;
  variante?: "primario" | "secundario" | "peligro" | "fantasma";
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        className={buttonClass(variante, "sm")}
        onClick={() => {
          if (confirmar && !window.confirm(confirmar)) return;
          setError(null);
          start(async () => {
            const r = await action();
            if (!r.ok) setError(r.mensaje ?? "No se pudo completar la acción");
          });
        }}
      >
        {pending && <Loader2 className="size-3.5 animate-spin" />}
        {children}
      </button>
      {error && <span role="alert" className="max-w-56 text-right text-xs text-red-600">{error}</span>}
    </span>
  );
}
