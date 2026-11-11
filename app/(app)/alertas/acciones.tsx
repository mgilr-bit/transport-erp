"use client";

import { ActionButton } from "@/components/ui/action-button";
import { generarRecordatoriosAction, marcarLeidaAction, marcarTodasLeidasAction } from "@/app/actions/alertas";
import type { GiroNegocio, SeveridadAlerta, TipoAlerta } from "@/app/generated/prisma/client";

export function MarcarLeida({ id, leida }: { id: number; leida: boolean }) {
  return (
    <ActionButton action={() => marcarLeidaAction(id)} variante={leida ? "fantasma" : "secundario"}>
      {leida ? "Reabrir" : "Atendida"}
    </ActionButton>
  );
}

export function MarcarTodas({ filtro, total }: { filtro: { tipo?: TipoAlerta; severidad?: SeveridadAlerta; giro?: GiroNegocio }; total: number }) {
  if (!total) return null;
  return (
    <ActionButton action={() => marcarTodasLeidasAction(filtro)} confirmar={`¿Marcar ${total} alertas como atendidas?`}>
      Marcar {total} como atendidas
    </ActionButton>
  );
}

export function GenerarRecordatorios() {
  return <ActionButton action={() => generarRecordatoriosAction()}>Generar recordatorios</ActionButton>;
}
