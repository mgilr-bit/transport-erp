"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui/form";
import { FormModal } from "@/components/ui/form-modal";
import { ActionButton } from "@/components/ui/action-button";
import { alternarSedeAction, crearSedeAction } from "@/app/actions/admin";
import { GIROS, TIPOS_SEDE } from "@/lib/constants";
import type { TipoSede } from "@/app/generated/prisma/client";

export function NuevaSede() {
  const [tipo, setTipo] = useState<TipoSede>("MINA");
  const giros = TIPOS_SEDE[tipo].giros;
  return (
    <FormModal boton="Nueva sede" titulo="Registrar sede" descripcion="Las coordenadas ubican la sede en el mapa y sirven de punto de partida del GPS." action={crearSedeAction} enviar="Registrar sede" ancho="max-w-xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Código" name="codigo"><Input name="codigo" placeholder="MIN-JUT" /></Field>
        <Field label="Tipo" name="tipo">
          <Select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoSede)}>
            {Object.entries(TIPOS_SEDE).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
          </Select>
        </Field>
        <Field label="Nombre" name="nombre" className="sm:col-span-2"><Input name="nombre" placeholder="Planta de Extracción Jutiapa" /></Field>
        <Field label="Giro" name="giro">
          <Select name="giro" key={tipo} defaultValue={giros[0]}>
            {giros.map((g) => <option key={g} value={g}>{GIROS[g].nombre}</option>)}
          </Select>
        </Field>
        <Field label="Departamento" name="departamento"><Input name="departamento" placeholder="Jutiapa" /></Field>
        <Field label="Dirección" name="direccion" className="sm:col-span-2"><Input name="direccion" /></Field>
        <Field label="Teléfono" name="telefono"><Input name="telefono" placeholder="+502 7844-1200" /></Field>
        <div className="hidden sm:block" />
        <Field label="Latitud" name="latitud"><Input name="latitud" type="number" step="0.0001" placeholder="14.2917" /></Field>
        <Field label="Longitud" name="longitud"><Input name="longitud" type="number" step="0.0001" placeholder="-89.8958" /></Field>
      </div>
    </FormModal>
  );
}

export function AlternarSede({ id, activa }: { id: number; activa: boolean }) {
  return (
    <ActionButton action={() => alternarSedeAction(id)} variante={activa ? "fantasma" : "secundario"} confirmar={activa ? "¿Desactivar esta sede?" : undefined}>
      {activa ? "Desactivar" : "Activar"}
    </ActionButton>
  );
}
