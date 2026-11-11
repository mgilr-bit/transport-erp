"use client";

import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { FormModal } from "@/components/ui/form-modal";
import { ActionButton } from "@/components/ui/action-button";
import {
  asignarVendedorAction, avanzarPedidoAction, cerrarReunionAction, confirmarPedidoAction, confirmarReunionAction,
  crearClienteAction, reasignarReunionAction, responderClienteAction,
} from "@/app/actions/comercial";
import { entradaFechaHoraGT } from "@/lib/utils";

type Opcion = { id: number; texto: string };

// ─── Pedidos ───────────────────────────────────────────────────────────────

export function AccionesPedido({ id, codigo, estado, viaje, plantas }: { id: number; codigo: string; estado: string; viaje: string | null; plantas: Opcion[] }) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {estado === "SOLICITADO" && (
        <FormModal boton="Confirmar" titulo={`Confirmar pedido ${codigo}`} descripcion="Elija la planta que lo preparará y despachará." action={confirmarPedidoAction} enviar="Confirmar" tamano="sm" icono={false}>
          <input type="hidden" name="pedidoId" value={id} />
          <Field label="Planta de despacho" name="plantaId">
            <Select name="plantaId" defaultValue="">
              <option value="" disabled>Seleccione…</option>
              {plantas.map((p) => <option key={p.id} value={p.id}>{p.texto}</option>)}
            </Select>
          </Field>
        </FormModal>
      )}
      {estado === "CONFIRMADO" && <ActionButton action={() => avanzarPedidoAction(id, "preparar")} variante="primario">Preparar</ActionButton>}
      {viaje && (estado === "EN_PREPARACION" || estado === "DESPACHADO") && <span className="self-center text-xs text-slate-500">Viaje {viaje}</span>}
      {!viaje && estado === "EN_PREPARACION" && <ActionButton action={() => avanzarPedidoAction(id, "despachar")} variante="primario">Despachar</ActionButton>}
      {!viaje && estado === "DESPACHADO" && <ActionButton action={() => avanzarPedidoAction(id, "entregar")} variante="primario">Entregar</ActionButton>}
      {!viaje && ["SOLICITADO", "CONFIRMADO", "EN_PREPARACION"].includes(estado) && (
        <ActionButton action={() => avanzarPedidoAction(id, "cancelar")} confirmar={`¿Cancelar el pedido ${codigo}? Se avisará al cliente.`} variante="fantasma">Cancelar</ActionButton>
      )}
    </div>
  );
}

// ─── Reuniones ─────────────────────────────────────────────────────────────

export function AccionesReunion({
  id, codigo, estado, fecha, modalidad, enlace, vendedores,
}: { id: number; codigo: string; estado: string; fecha: string; modalidad: string; enlace: string | null; vendedores: Opcion[] }) {
  if (estado !== "SOLICITADA" && estado !== "CONFIRMADA") return null;
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <FormModal
        boton={estado === "SOLICITADA" ? "Confirmar" : "Reprogramar"}
        titulo={`${estado === "SOLICITADA" ? "Confirmar" : "Reprogramar"} reunión ${codigo}`}
        descripcion="Se avisará al cliente en su portal."
        action={confirmarReunionAction}
        enviar="Guardar"
        tamano="sm"
        icono={false}
        variante={estado === "SOLICITADA" ? "primario" : "secundario"}
      >
        <input type="hidden" name="reunionId" value={id} />
        <div className="grid gap-4">
          <Field label="Fecha y hora" name="fecha"><Input name="fecha" type="datetime-local" defaultValue={entradaFechaHoraGT(new Date(fecha))} /></Field>
          {modalidad === "VIDEOCONFERENCIA" && (
            <Field label="Enlace de la videoconferencia" name="enlace"><Input name="enlace" type="url" defaultValue={enlace ?? ""} placeholder="https://meet.google.com/…" /></Field>
          )}
        </div>
      </FormModal>
      {vendedores.length > 0 && (
        <FormModal boton="Reasignar" titulo={`Reasignar reunión ${codigo}`} action={reasignarReunionAction} enviar="Reasignar" tamano="sm" icono={false} variante="fantasma">
          <input type="hidden" name="reunionId" value={id} />
          <Field label="Vendedor" name="vendedorId">
            <Select name="vendedorId" defaultValue="">
              <option value="" disabled>Seleccione…</option>
              {vendedores.map((v) => <option key={v.id} value={v.id}>{v.texto}</option>)}
            </Select>
          </Field>
        </FormModal>
      )}
      {estado === "CONFIRMADA" && <ActionButton action={() => cerrarReunionAction(id, "REALIZADA")}>Realizada</ActionButton>}
      <ActionButton action={() => cerrarReunionAction(id, "CANCELADA")} confirmar={`¿Cancelar la reunión ${codigo}?`} variante="fantasma">Cancelar</ActionButton>
    </div>
  );
}

// ─── Clientes ──────────────────────────────────────────────────────────────

export function NuevoCliente({ vendedores }: { vendedores: Opcion[] }) {
  return (
    <FormModal boton="Nuevo cliente" titulo="Registrar cliente" descripcion="Después, la administración puede darle acceso al portal en Usuarios." action={crearClienteAction} enviar="Registrar" ancho="max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre o razón social" name="nombre" className="sm:col-span-2"><Input name="nombre" /></Field>
        <Field label="NIT" name="nit"><Input name="nit" placeholder="1234567-8" /></Field>
        <Field label="Tipo" name="tipo">
          <Select name="tipo" defaultValue="NACIONAL"><option value="NACIONAL">Nacional</option><option value="EXTRANJERO">Extranjero</option></Select>
        </Field>
        <Field label="País" name="pais"><Input name="pais" defaultValue="Guatemala" /></Field>
        <Field label="Contacto" name="contacto"><Input name="contacto" /></Field>
        <Field label="Teléfono" name="telefono"><Input name="telefono" /></Field>
        <Field label="Correo" name="email"><Input name="email" type="email" /></Field>
        <Field label="Dirección" name="direccion" className="sm:col-span-2"><Input name="direccion" /></Field>
        <Field label="Vendedor asignado" name="vendedorId" className="sm:col-span-2">
          <Select name="vendedorId" defaultValue="">
            <option value="">— Sin asignar —</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.texto}</option>)}
          </Select>
        </Field>
      </div>
    </FormModal>
  );
}

export function AsignarVendedor({ clienteId, nombre, actual, vendedores }: { clienteId: number; nombre: string; actual: number | null; vendedores: Opcion[] }) {
  return (
    <FormModal boton="Vendedor" titulo={`Vendedor de ${nombre}`} action={asignarVendedorAction} enviar="Guardar" tamano="sm" icono={false} variante="fantasma">
      <input type="hidden" name="clienteId" value={clienteId} />
      <Field label="Vendedor asignado" name="vendedorId">
        <Select name="vendedorId" defaultValue={actual ?? ""}>
          <option value="">— Sin asignar —</option>
          {vendedores.map((v) => <option key={v.id} value={v.id}>{v.texto}</option>)}
        </Select>
      </Field>
    </FormModal>
  );
}

// ─── Mensajes ──────────────────────────────────────────────────────────────

export function ResponderCliente({ clienteId }: { clienteId: number }) {
  return (
    <ActionForm action={responderClienteAction} className="space-y-3">
      <input type="hidden" name="clienteId" value={clienteId} />
      <Field label="Respuesta" name="texto"><Textarea name="texto" rows={3} placeholder="Escriba su mensaje…" /></Field>
      <div className="flex justify-end"><SubmitButton>Enviar</SubmitButton></div>
    </ActionForm>
  );
}
