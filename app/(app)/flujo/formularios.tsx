"use client";

import { Field, Select, Textarea } from "@/components/ui/form";
import { FormModal } from "@/components/ui/form-modal";
import { aprobarSolicitudAction, rechazarSolicitudAction } from "@/app/actions/produccion";

type Origen = { valor: string; texto: string; suficiente: boolean };

export function AprobarSolicitud({ id, codigo, minas, proveedores }: { id: number; codigo: string; minas: Origen[]; proveedores: Origen[] }) {
  return (
    <FormModal boton="Aprobar" titulo={`Aprobar ${codigo}`} descripcion="Asigne el origen del material: una mina propia con existencias o un proveedor tercero." action={aprobarSolicitudAction} enviar="Aprobar solicitud" tamano="sm" icono={false}>
      <input type="hidden" name="solicitudId" value={id} />
      <Field label="Origen del material" name="origen" hint="Las minas sin existencias suficientes aparecen deshabilitadas.">
        <Select name="origen" defaultValue="">
          <option value="" disabled>Seleccione…</option>
          {minas.length > 0 && (
            <optgroup label="Minas propias">
              {minas.map((m) => <option key={m.valor} value={m.valor} disabled={!m.suficiente}>{m.texto}</option>)}
            </optgroup>
          )}
          {proveedores.length > 0 && (
            <optgroup label="Proveedores terceros">
              {proveedores.map((p) => <option key={p.valor} value={p.valor}>{p.texto}</option>)}
            </optgroup>
          )}
        </Select>
      </Field>
    </FormModal>
  );
}

export function RechazarSolicitud({ id, codigo }: { id: number; codigo: string }) {
  return (
    <FormModal boton="Rechazar" titulo={`Rechazar ${codigo}`} action={rechazarSolicitudAction} enviar="Rechazar" variante="fantasma" tamano="sm" icono={false}>
      <input type="hidden" name="solicitudId" value={id} />
      <Field label="Motivo del rechazo" name="motivo"><Textarea name="motivo" placeholder="Ej. material fuera de especificación" /></Field>
    </FormModal>
  );
}
