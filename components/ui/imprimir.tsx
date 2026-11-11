"use client";

import { Printer } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

/** Abre el diálogo de impresión; desde ahí se puede guardar como PDF. */
export function Imprimir({ texto = "Imprimir o guardar PDF" }: { texto?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primario", "sm")}>
      <Printer className="size-3.5" aria-hidden /> {texto}
    </button>
  );
}
