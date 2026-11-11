"use client";

import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/ui/form";
import { ActionButton } from "@/components/ui/action-button";
import { alternarLlaveAction, alternarWebhookAction, crearLlaveAction, crearWebhookAction, probarWebhookAction } from "@/app/actions/integraciones";
import { EVENTOS_WEBHOOK } from "@/lib/constants";

type Opcion = { valor: string; texto: string };

function Propietario({ clientes, proveedores }: { clientes: Opcion[]; proveedores: Opcion[] }) {
  return (
    <Field label="Sistema de" name="propietario">
      <Select name="propietario" defaultValue="">
        <option value="" disabled>Seleccione…</option>
        <optgroup label="Clientes">{clientes.map((c) => <option key={c.valor} value={c.valor}>{c.texto}</option>)}</optgroup>
        <optgroup label="Proveedores de materia prima">{proveedores.map((p) => <option key={p.valor} value={p.valor}>{p.texto}</option>)}</optgroup>
      </Select>
    </Field>
  );
}

export function NuevaLlave(props: { clientes: Opcion[]; proveedores: Opcion[] }) {
  return (
    <ActionForm action={crearLlaveAction}>
      <Field label="Nombre" name="nombre"><Input name="nombre" placeholder="ERP de compras de Cemex" /></Field>
      <Propietario {...props} />
      <SubmitButton>Crear llave</SubmitButton>
    </ActionForm>
  );
}

export function NuevoWebhook(props: { clientes: Opcion[]; proveedores: Opcion[] }) {
  return (
    <ActionForm action={crearWebhookAction}>
      <Field label="URL del receptor" name="url"><Input name="url" type="url" placeholder="https://erp.cliente.com/webhooks/transport" /></Field>
      <Propietario {...props} />
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-sm font-medium text-slate-700">Eventos</legend>
        {Object.entries(EVENTOS_WEBHOOK).map(([clave, texto]) => (
          <label key={clave} className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" name="eventos" value={clave} defaultChecked className="mt-0.5 size-4 rounded border-slate-300 accent-brand-600" />
            <span><span className="font-mono text-xs">{clave}</span> · {texto}</span>
          </label>
        ))}
      </fieldset>
      <SubmitButton>Registrar webhook</SubmitButton>
    </ActionForm>
  );
}

export function AlternarLlave({ id, activa }: { id: number; activa: boolean }) {
  return (
    <ActionButton action={() => alternarLlaveAction(id)} confirmar={activa ? "¿Revocar esta llave? El sistema que la usa dejará de tener acceso." : undefined} variante="fantasma">
      {activa ? "Revocar" : "Reactivar"}
    </ActionButton>
  );
}

export function AccionesWebhook({ id, activo }: { id: number; activo: boolean }) {
  return (
    <div className="flex justify-end gap-1.5">
      <ActionButton action={() => probarWebhookAction(id)}>Enviar prueba</ActionButton>
      <ActionButton action={() => alternarWebhookAction(id)} variante="fantasma">{activo ? "Desactivar" : "Activar"}</ActionButton>
    </div>
  );
}
