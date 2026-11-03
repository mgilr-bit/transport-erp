"use client";

import { Plus } from "lucide-react";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/ui/form";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { crearCamion } from "@/app/actions/transporte";

export function NuevoCamion({ giros, sedes }: { giros: { valor: string; texto: string }[]; sedes: { id: number; texto: string }[] }) {
  return (
    <Modal trigger={<><Plus className="size-4" /> Registrar camión</>} titulo="Registrar camión" descripcion="Se le asigna automáticamente un dispositivo GPS." variante="secundario">
      {(cerrar) => (
        <ActionForm action={crearCamion} onSuccess={cerrar}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Placa" name="placa"><Input name="placa" placeholder="C-123ABC" /></Field>
            <Field label="Giro" name="giro">
              <Select name="giro">{giros.map((g) => <option key={g.valor} value={g.valor}>{g.texto}</option>)}</Select>
            </Field>
            <Field label="Marca" name="marca"><Input name="marca" placeholder="Volvo" /></Field>
            <Field label="Modelo" name="modelo"><Input name="modelo" placeholder="FMX 460" /></Field>
            <Field label="Año" name="anio"><Input name="anio" type="number" defaultValue={new Date().getFullYear()} /></Field>
            <Field label="Capacidad (t)" name="capacidadTon"><Input name="capacidadTon" type="number" step="0.5" /></Field>
            <Field label="Tipo de unidad" name="tipo"><Input name="tipo" placeholder="Volteo 14 m³" /></Field>
            <Field label="Centro de operación" name="sedeId">
              <Select name="sedeId">{sedes.map((s) => <option key={s.id} value={s.id}>{s.texto}</option>)}</Select>
            </Field>
          </div>
          <ModalFooter>
            <button type="button" onClick={cerrar} className="px-3 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
            <SubmitButton>Registrar</SubmitButton>
          </ModalFooter>
        </ActionForm>
      )}
    </Modal>
  );
}
