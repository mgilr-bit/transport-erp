"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui/form";
import { FormModal } from "@/components/ui/form-modal";
import { ActionButton } from "@/components/ui/action-button";
import { alternarMantenimientoAction, crearContratoAction, crearMaquinaAction, finalizarContratoAction, venderMaquinaAction } from "@/app/actions/maquinaria";
import { calcularAlquiler } from "@/lib/reglas";
import { formatQ } from "@/lib/utils";

type Opcion = { id: number; texto: string };
type MaquinaOpcion = Opcion & { tarifa: number; precioVenta: number };
const hoy = () => new Date().toISOString().slice(0, 10);
const enDias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export function NuevoAlquiler({ maquinas, clientes }: { maquinas: MaquinaOpcion[]; clientes: Opcion[] }) {
  const [maquinaId, setMaquinaId] = useState("");
  const [inicio, setInicio] = useState(hoy());
  const [fin, setFin] = useState(enDias(6));
  const tarifa = maquinas.find((m) => m.id === Number(maquinaId))?.tarifa;

  let calculo: ReturnType<typeof calcularAlquiler> | null = null;
  if (tarifa && inicio && fin && fin >= inicio) calculo = calcularAlquiler(tarifa, new Date(`${inicio}T00:00`), new Date(`${fin}T00:00`));

  return (
    <FormModal boton="Nuevo alquiler" titulo="Contrato de alquiler" descripcion="Descuento automático: 5 % desde 7 días y 10 % desde 30 días." action={crearContratoAction} enviar="Registrar contrato" ancho="max-w-xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Máquina disponible" name="maquinaId" className="sm:col-span-2">
          <Select name="maquinaId" value={maquinaId} onChange={(e) => setMaquinaId(e.target.value)}>
            <option value="" disabled>Seleccione…</option>
            {maquinas.map((m) => <option key={m.id} value={m.id}>{m.texto}</option>)}
          </Select>
        </Field>
        <Field label="Cliente" name="clienteId" className="sm:col-span-2">
          <Select name="clienteId" defaultValue="">
            <option value="" disabled>Seleccione…</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.texto}</option>)}
          </Select>
        </Field>
        <Field label="Desde" name="fechaInicio"><Input name="fechaInicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></Field>
        <Field label="Hasta" name="fechaFin"><Input name="fechaFin" type="date" value={fin} min={inicio} onChange={(e) => setFin(e.target.value)} /></Field>
        <Field label="Depósito (Q)" name="deposito"><Input name="deposito" type="number" min="0" step="100" defaultValue={0} /></Field>
      </div>
      <dl className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm" aria-live="polite">
        <div><dt className="text-xs text-slate-500">Días</dt><dd className="font-medium text-slate-900 tabular">{calculo?.dias ?? "—"}</dd></div>
        <div><dt className="text-xs text-slate-500">Descuento</dt><dd className="font-medium text-slate-900 tabular">{calculo ? `${calculo.descuento * 100}%` : "—"}</dd></div>
        <div><dt className="text-xs text-slate-500">Total</dt><dd className="font-semibold text-slate-900 tabular">{calculo ? formatQ(calculo.total) : "—"}</dd></div>
      </dl>
    </FormModal>
  );
}

export function NuevaVenta({ maquinas, clientes }: { maquinas: MaquinaOpcion[]; clientes: Opcion[] }) {
  const [precio, setPrecio] = useState<number | "">("");
  return (
    <FormModal boton="Registrar venta" titulo="Venta de maquinaria" descripcion="La máquina sale del inventario de forma definitiva." action={venderMaquinaAction} enviar="Registrar venta" variante="secundario">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Máquina" name="maquinaId" className="sm:col-span-2">
          <Select name="maquinaId" defaultValue="" onChange={(e) => setPrecio(maquinas.find((m) => m.id === Number(e.target.value))?.precioVenta ?? "")}>
            <option value="" disabled>Seleccione…</option>
            {maquinas.map((m) => <option key={m.id} value={m.id}>{m.texto}</option>)}
          </Select>
        </Field>
        <Field label="Cliente" name="clienteId" className="sm:col-span-2">
          <Select name="clienteId" defaultValue="">
            <option value="" disabled>Seleccione…</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.texto}</option>)}
          </Select>
        </Field>
        <Field label="Precio (Q)" name="precio" hint="Sugerido: precio de lista."><Input name="precio" type="number" min="0" step="1000" value={precio} onChange={(e) => setPrecio(e.target.value === "" ? "" : Number(e.target.value))} /></Field>
        <Field label="Fecha" name="fecha"><Input name="fecha" type="date" defaultValue={hoy()} /></Field>
      </div>
    </FormModal>
  );
}

export function NuevaMaquina({ sedes }: { sedes: Opcion[] }) {
  return (
    <FormModal boton="Registrar máquina" titulo="Registrar máquina" descripcion="Se le asigna automáticamente un dispositivo GPS." action={crearMaquinaAction} enviar="Registrar" variante="secundario">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Código interno" name="codigo"><Input name="codigo" placeholder="MQ-045" /></Field>
        <Field label="Tipo" name="tipo"><Input name="tipo" placeholder="Excavadora" /></Field>
        <Field label="Marca" name="marca"><Input name="marca" placeholder="Caterpillar" /></Field>
        <Field label="Modelo" name="modelo"><Input name="modelo" placeholder="320 GC" /></Field>
        <Field label="Año" name="anio"><Input name="anio" type="number" defaultValue={new Date().getFullYear()} /></Field>
        <Field label="No. de serie" name="serie"><Input name="serie" /></Field>
        <Field label="Tarifa diaria (Q)" name="tarifaDiaria"><Input name="tarifaDiaria" type="number" min="0" step="50" /></Field>
        <Field label="Precio de venta (Q)" name="precioVenta"><Input name="precioVenta" type="number" min="0" step="1000" /></Field>
        <Field label="Sucursal" name="sedeId" className="sm:col-span-2">
          <Select name="sedeId">{sedes.map((s) => <option key={s.id} value={s.id}>{s.texto}</option>)}</Select>
        </Field>
      </div>
    </FormModal>
  );
}

export function FinalizarContrato({ id }: { id: number }) {
  return <ActionButton action={() => finalizarContratoAction(id)} confirmar="¿Finalizar el contrato y devolver la máquina al inventario?">Finalizar</ActionButton>;
}

export function Mantenimiento({ id, estado }: { id: number; estado: string }) {
  if (estado === "DISPONIBLE") return <ActionButton action={() => alternarMantenimientoAction(id)} variante="fantasma">A taller</ActionButton>;
  if (estado === "MANTENIMIENTO") return <ActionButton action={() => alternarMantenimientoAction(id)}>Habilitar</ActionButton>;
  return null;
}
