"use client";

import { useCallback, useState } from "react";
import { X } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Diálogo modal nativo. `children` recibe `cerrar` para cerrarlo tras guardar.
 */
export function Modal({
  trigger,
  titulo,
  descripcion,
  children,
  variante = "primario",
  tamano = "md",
  ancho = "max-w-lg",
}: {
  trigger: React.ReactNode;
  titulo: string;
  descripcion?: string;
  children: (cerrar: () => void) => React.ReactNode;
  variante?: "primario" | "secundario" | "fantasma";
  tamano?: "sm" | "md";
  ancho?: string;
}) {
  // Callback ref con estado: `cerrar` no lee refs durante el render
  const [dialogo, setDialogo] = useState<HTMLDialogElement | null>(null);
  const cerrar = useCallback(() => dialogo?.close(), [dialogo]);

  return (
    <>
      <button type="button" className={buttonClass(variante, tamano)} onClick={() => dialogo?.showModal()}>
        {trigger}
      </button>
      <dialog
        ref={setDialogo}
        className={cn("m-auto w-full rounded-2xl p-0 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-[2px]", ancho)}
        onClick={(e) => e.target === dialogo && cerrar()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
            {descripcion && <p className="mt-0.5 text-sm text-slate-500">{descripcion}</p>}
          </div>
          <button type="button" onClick={cerrar} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>
        <div className="px-6 py-5 text-left">{children(cerrar)}</div>
      </dialog>
    </>
  );
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="-mx-6 -mb-5 mt-6 flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3">{children}</div>;
}
