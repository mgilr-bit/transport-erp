"use client";

import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormModal } from "@/components/ui/form-modal";
import { ActionButton } from "@/components/ui/action-button";
import { completarOrdenAction, crearOrden, crearSolicitudAction, iniciarOrdenAction } from "@/app/actions/produccion";

type Opcion = { id: number; texto: string };
const hoy = () => new Date().toISOString().slice(0, 10);

export function NuevaOrden({ plantas, productos }: { plantas: Opcion[]; productos: Opcion[] }) {
  return (
    <FormModal boton="Nueva orden" titulo="Nueva orden de producción" descripcion="Al iniciarla se descuentan los insumos de la receta." action={crearOrden}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Planta" name="sedeId" className="sm:col-span-2"><Select name="sedeId">{plantas.map((p) => <option key={p.id} value={p.id}>{p.texto}</option>)}</Select></Field>
        <Field label="Producto" name="productoId" className="sm:col-span-2"><Select name="productoId">{productos.map((p) => <option key={p.id} value={p.id}>{p.texto}</option>)}</Select></Field>
        <Field label="Cantidad" name="cantidad"><Input name="cantidad" type="number" min="1" /></Field>
        <Field label="Fecha de inicio" name="fechaInicio"><Input name="fechaInicio" type="date" defaultValue={hoy()} /></Field>
      </div>
    </FormModal>
  );
}

export function NuevaSolicitud({ plantas, materiales, variante = "secundario" }: { plantas: Opcion[]; materiales: Opcion[]; variante?: "primario" | "secundario" }) {
  return (
    <FormModal boton="Solicitar materia prima" titulo="Solicitud de materia prima" descripcion="Se envía a Extracción; si no hay existencias se compra a un proveedor." action={crearSolicitudAction} enviar="Enviar solicitud" variante={variante}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Planta solicitante" name="plantaId" className="sm:col-span-2"><Select name="plantaId">{plantas.map((p) => <option key={p.id} value={p.id}>{p.texto}</option>)}</Select></Field>
        <Field label="Material" name="materialId"><Select name="materialId">{materiales.map((m) => <option key={m.id} value={m.id}>{m.texto}</option>)}</Select></Field>
        <Field label="Toneladas" name="toneladas"><Input name="toneladas" type="number" step="0.5" min="0" /></Field>
        <Field label="Fecha requerida" name="fechaRequerida" className="sm:col-span-2"><Input name="fechaRequerida" type="date" defaultValue={hoy()} /></Field>
        <Field label="Notas" name="notas" className="sm:col-span-2"><Textarea name="notas" /></Field>
      </div>
    </FormModal>
  );
}

export function AccionesOrden({ id, estado }: { id: number; estado: string }) {
  if (estado === "PLANIFICADA") return <ActionButton action={() => iniciarOrdenAction(id)} variante="primario">Iniciar</ActionButton>;
  if (estado === "EN_PROCESO") return <ActionButton action={() => completarOrdenAction(id)} variante="primario">Completar</ActionButton>;
  return null;
}
