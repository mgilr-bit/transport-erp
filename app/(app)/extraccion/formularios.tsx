"use client";

import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormModal } from "@/components/ui/form-modal";
import { crearExtraccion } from "@/app/actions/produccion";

type Opcion = { id: number; texto: string };

export function NuevaExtraccion({ minas, materiales }: { minas: Opcion[]; materiales: Opcion[] }) {
  return (
    <FormModal boton="Registrar extracción" titulo="Registrar extracción" descripcion="Las toneladas se suman al inventario de la mina." action={crearExtraccion}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Planta de extracción" name="sedeId" className="sm:col-span-2">
          <Select name="sedeId">{minas.map((m) => <option key={m.id} value={m.id}>{m.texto}</option>)}</Select>
        </Field>
        <Field label="Material" name="materialId">
          <Select name="materialId">{materiales.map((m) => <option key={m.id} value={m.id}>{m.texto}</option>)}</Select>
        </Field>
        <Field label="Toneladas" name="toneladas"><Input name="toneladas" type="number" step="0.01" min="0" /></Field>
        <Field label="Turno" name="turno">
          <Select name="turno">{["Matutino", "Vespertino", "Nocturno"].map((t) => <option key={t}>{t}</option>)}</Select>
        </Field>
        <Field label="Fecha" name="fecha"><Input name="fecha" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
        <Field label="Observaciones" name="observaciones" className="sm:col-span-2"><Textarea name="observaciones" /></Field>
      </div>
    </FormModal>
  );
}
