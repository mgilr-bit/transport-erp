"use client";

import { ActionButton } from "@/components/ui/action-button";
import { cancelarViajeAction, entregarViajeAction, iniciarViajeAction } from "@/app/actions/transporte";

export function AccionesViaje({ id, estado }: { id: number; estado: string }) {
  return (
    <div className="flex justify-end gap-1.5">
      {estado === "PROGRAMADO" && <ActionButton action={() => iniciarViajeAction(id)} variante="primario">Iniciar</ActionButton>}
      {estado === "EN_CURSO" && <ActionButton action={() => entregarViajeAction(id)} variante="primario">Entregar</ActionButton>}
      {(estado === "PROGRAMADO" || estado === "EN_CURSO") && (
        <ActionButton action={() => cancelarViajeAction(id)} confirmar="¿Cancelar este viaje?" variante="fantasma">Cancelar</ActionButton>
      )}
    </div>
  );
}
