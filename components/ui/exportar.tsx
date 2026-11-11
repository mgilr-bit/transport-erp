import { Download } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

/** Descarga un reporte en CSV desde /api/reportes con los filtros de la pantalla. */
export function Exportar({ href, texto = "Exportar CSV" }: { href: string; texto?: string }) {
  return (
    <a href={href} download className={buttonClass("secundario", "sm")}>
      <Download className="size-3.5" aria-hidden /> {texto}
    </a>
  );
}
