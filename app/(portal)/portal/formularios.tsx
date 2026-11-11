"use client";

import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { ActionButton } from "@/components/ui/action-button";
import { LineasPedido, type ProductoPedido } from "@/components/dominio/lineas-pedido";
import {
  cancelarPedidoPortalAction, cancelarReunionPortalAction, crearPedidoPortalAction, enviarMensajePortalAction,
  importarPedidoCsvAction, marcarNotificacionesAction, solicitarReunionPortalAction,
} from "@/app/actions/portal";

function DatosEntrega({ direccion, minima }: { direccion: string; minima: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Dirección de entrega" name="direccionEntrega" className="sm:col-span-2"><Input name="direccionEntrega" defaultValue={direccion} /></Field>
      <Field label="Fecha requerida" name="fechaRequerida"><Input name="fechaRequerida" type="date" min={minima} /></Field>
      <Field label="Notas" name="notas"><Input name="notas" placeholder="Horario de recepción, contacto…" /></Field>
    </div>
  );
}

export function PedidoCatalogo({ productos, inicial, direccion, minima }: { productos: ProductoPedido[]; inicial?: number; direccion: string; minima: string }) {
  return (
    <ActionForm action={crearPedidoPortalAction}>
      <LineasPedido productos={productos} inicial={inicial} />
      <DatosEntrega direccion={direccion} minima={minima} />
      <SubmitButton>Enviar pedido</SubmitButton>
    </ActionForm>
  );
}

export function PedidoCsv({ direccion, minima }: { direccion: string; minima: string }) {
  return (
    <ActionForm action={importarPedidoCsvAction}>
      <Field label="Archivo CSV" name="archivo" hint="Columnas codigo y cantidad; separadas por coma o punto y coma.">
        <Input name="archivo" type="file" accept=".csv,text/csv" />
      </Field>
      <DatosEntrega direccion={direccion} minima={minima} />
      <SubmitButton>Importar pedido</SubmitButton>
    </ActionForm>
  );
}

export function CancelarPedido({ id, codigo }: { id: number; codigo: string }) {
  return <ActionButton action={() => cancelarPedidoPortalAction(id)} confirmar={`¿Cancelar el pedido ${codigo}?`} variante="fantasma">Cancelar</ActionButton>;
}

export function SolicitarReunion({ giros, fechas }: { giros: { valor: string; texto: string }[]; fechas: { sugerida: string; minima: string } }) {
  return (
    <ActionForm action={solicitarReunionPortalAction}>
      <Field label="Empresa del grupo" name="giro">
        <Select name="giro" defaultValue="">
          <option value="" disabled>Seleccione…</option>
          {giros.map((g) => <option key={g.valor} value={g.valor}>{g.texto}</option>)}
        </Select>
      </Field>
      <Field label="Modalidad" name="modalidad">
        <Select name="modalidad" defaultValue="VIDEOCONFERENCIA">
          <option value="VIDEOCONFERENCIA">Videoconferencia</option>
          <option value="PRESENCIAL">Presencial en el Edificio Sixtino</option>
        </Select>
      </Field>
      <Field label="Fecha y hora preferida" name="fecha"><Input name="fecha" type="datetime-local" defaultValue={fechas.sugerida} min={fechas.minima} /></Field>
      <Field label="Tema" name="motivo"><Textarea name="motivo" rows={3} placeholder="Ejemplo: renovar el contrato de alquiler de la excavadora." /></Field>
      <SubmitButton>Solicitar reunión</SubmitButton>
    </ActionForm>
  );
}

export function CancelarReunion({ id, codigo }: { id: number; codigo: string }) {
  return <ActionButton action={() => cancelarReunionPortalAction(id)} confirmar={`¿Cancelar la reunión ${codigo}?`} variante="fantasma">Cancelar</ActionButton>;
}

export function EnviarMensaje() {
  return (
    <ActionForm action={enviarMensajePortalAction} className="space-y-3">
      <Field label="Mensaje" name="texto"><Textarea name="texto" rows={3} placeholder="Escriba su consulta…" /></Field>
      <div className="flex justify-end"><SubmitButton>Enviar</SubmitButton></div>
    </ActionForm>
  );
}

export function MarcarNotificaciones() {
  return <ActionButton action={() => marcarNotificacionesAction()} variante="fantasma">Marcar como leídas</ActionButton>;
}
