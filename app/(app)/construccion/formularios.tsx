"use client";

import { Check } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormModal } from "@/components/ui/form-modal";
import { ActionButton } from "@/components/ui/action-button";
import {
  agregarHitoAction, alternarHitoAction, asignarMaquinaAction, cambiarEstadoProyectoAction,
  crearProyectoAction, liberarMaquinaAction, pedirMaterialesAction, registrarCostoAction,
} from "@/app/actions/construccion";
import { LineasPedido, type ProductoPedido } from "@/components/dominio/lineas-pedido";
import { CATEGORIAS_GASTO, TIPOS_OBRA } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Opcion = { id: number; texto: string };
const hoy = () => new Date().toISOString().slice(0, 10);

const DEPARTAMENTOS = [
  "Alta Verapaz", "Baja Verapaz", "Chimaltenango", "Chiquimula", "El Progreso", "Escuintla", "Guatemala", "Huehuetenango",
  "Izabal", "Jalapa", "Jutiapa", "Petén", "Quetzaltenango", "Quiché", "Retalhuleu", "Sacatepéquez", "San Marcos",
  "Santa Rosa", "Sololá", "Suchitepéquez", "Totonicapán", "Zacapa",
];

export function NuevoProyecto({ clientes }: { clientes: Opcion[] }) {
  return (
    <FormModal boton="Nuevo proyecto" titulo="Nuevo proyecto de construcción" descripcion="Inicia en planificación; el avance se calcula con los hitos." action={crearProyectoAction} enviar="Registrar proyecto" ancho="max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre de la obra" name="nombre" className="sm:col-span-2"><Input name="nombre" placeholder="Puente vehicular Río Dulce" /></Field>
        <Field label="Tipo de obra" name="tipo">
          <Select name="tipo">{Object.entries(TIPOS_OBRA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        </Field>
        <Field label="Cliente" name="clienteId">
          <Select name="clienteId" defaultValue="">
            <option value="" disabled>Seleccione…</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.texto}</option>)}
          </Select>
        </Field>
        <Field label="Ubicación" name="ubicacion"><Input name="ubicacion" placeholder="Km 245 CA-9" /></Field>
        <Field label="Departamento" name="departamento">
          <Select name="departamento" defaultValue="Guatemala">{DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}</Select>
        </Field>
        <Field label="Monto del contrato (Q)" name="montoContrato" className="sm:col-span-2"><Input name="montoContrato" type="number" min="0" step="10000" /></Field>
        <Field label="Inicio" name="fechaInicio"><Input name="fechaInicio" type="date" defaultValue={hoy()} /></Field>
        <Field label="Entrega estimada" name="fechaFinEstimada"><Input name="fechaFinEstimada" type="date" /></Field>
        <Field label="Descripción" name="descripcion" className="sm:col-span-2"><Textarea name="descripcion" /></Field>
      </div>
    </FormModal>
  );
}

export function NuevoHito({ proyectoId }: { proyectoId: number }) {
  return (
    <FormModal boton="Hito" titulo="Agregar hito" descripcion="El peso indica cuánto aporta al avance total de la obra." action={agregarHitoAction} enviar="Agregar" variante="secundario" tamano="sm">
      <input type="hidden" name="proyectoId" value={proyectoId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" name="nombre" className="sm:col-span-2"><Input name="nombre" placeholder="Fundición de losa" /></Field>
        <Field label="Peso (1–100)" name="peso"><Input name="peso" type="number" min="1" max="100" defaultValue={10} /></Field>
        <Field label="Fecha meta" name="fechaMeta"><Input name="fechaMeta" type="date" defaultValue={hoy()} /></Field>
      </div>
    </FormModal>
  );
}

export function NuevoCosto({ proyectoId }: { proyectoId: number }) {
  return (
    <FormModal boton="Registrar costo" titulo="Registrar costo de obra" descripcion="Se carga como gasto al presupuesto mensual de Construcción." action={registrarCostoAction} enviar="Registrar">
      <input type="hidden" name="proyectoId" value={proyectoId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Categoría" name="categoria">
          <Select name="categoria" defaultValue="MATERIALES">
            {Object.entries(CATEGORIAS_GASTO).filter(([k]) => k !== "GPS").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Monto (Q)" name="monto"><Input name="monto" type="number" min="0" step="100" /></Field>
        <Field label="Descripción" name="descripcion" className="sm:col-span-2"><Input name="descripcion" placeholder="Cemento 500 sacos" /></Field>
        <Field label="Fecha" name="fecha"><Input name="fecha" type="date" defaultValue={hoy()} /></Field>
      </div>
    </FormModal>
  );
}

export function AsignarMaquina({ proyectoId, maquinas }: { proyectoId: number; maquinas: Opcion[] }) {
  return (
    <FormModal boton="Asignar" titulo="Asignar maquinaria a la obra" descripcion="Solo se muestran las máquinas disponibles en sucursal." action={asignarMaquinaAction} enviar="Asignar" variante="secundario" tamano="sm">
      <input type="hidden" name="proyectoId" value={proyectoId} />
      <Field label="Máquina" name="maquinaId">
        <Select name="maquinaId" defaultValue="">
          <option value="" disabled>Seleccione…</option>
          {maquinas.map((m) => <option key={m.id} value={m.id}>{m.texto}</option>)}
        </Select>
      </Field>
    </FormModal>
  );
}

export function LiberarMaquina({ maquinaId, proyectoId }: { maquinaId: number; proyectoId: number }) {
  return <ActionButton action={() => liberarMaquinaAction(maquinaId, proyectoId)} variante="fantasma" confirmar="¿Devolver la máquina a su sucursal?">Liberar</ActionButton>;
}

export function EstadoProyecto({ id, estado }: { id: number; estado: string }) {
  if (estado === "EN_EJECUCION") return <ActionButton action={() => cambiarEstadoProyectoAction(id, "PAUSADO")} confirmar="¿Pausar la obra?">Pausar obra</ActionButton>;
  if (estado === "PAUSADO" || estado === "PLANIFICACION") return <ActionButton action={() => cambiarEstadoProyectoAction(id, "EN_EJECUCION")} variante="primario">{estado === "PAUSADO" ? "Reanudar obra" : "Iniciar obra"}</ActionButton>;
  return null;
}

/** Casilla de un hito: al marcarla se recalcula el avance ponderado. */
export function CasillaHito({ id, proyectoId, completado, habilitado }: { id: number; proyectoId: number; completado: boolean; habilitado: boolean }) {
  const caja = (
    <span className={cn("grid size-5 place-items-center rounded-md ring-1 ring-inset", completado ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white ring-slate-300")}>
      {completado && <Check className="size-3.5" aria-hidden />}
    </span>
  );
  if (!habilitado) return <span aria-label={completado ? "Completado" : "Pendiente"}>{caja}</span>;
  return (
    <span className="[&_button]:h-auto [&_button]:bg-transparent [&_button]:p-0 [&_button]:shadow-none [&_button]:ring-0 [&_button:hover]:bg-transparent">
      <ActionButton action={() => alternarHitoAction(id, proyectoId)} variante="fantasma">
        <span className="sr-only">{completado ? "Marcar como pendiente" : "Marcar como completado"}</span>
        {caja}
      </ActionButton>
    </span>
  );
}

export function PedirMateriales({ proyectoId, direccion, productos }: { proyectoId: number; direccion: string; productos: ProductoPedido[] }) {
  return (
    <FormModal
      boton="Pedir materiales"
      titulo="Pedido de materiales a Plantas de proceso"
      descripcion="Al entregarse, el total se registra como costo de materiales de la obra."
      action={pedirMaterialesAction}
      enviar="Enviar pedido"
      variante="secundario"
      ancho="max-w-2xl"
    >
      <input type="hidden" name="proyectoId" value={proyectoId} />
      <div className="grid gap-4">
        <LineasPedido productos={productos} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Entregar en" name="direccionEntrega"><Input name="direccionEntrega" defaultValue={direccion} /></Field>
          <Field label="Fecha requerida" name="fechaRequerida"><Input name="fechaRequerida" type="date" min={hoy()} /></Field>
        </div>
        <Field label="Notas" name="notas"><Textarea name="notas" rows={2} placeholder="Horario de recepción, contacto en obra…" /></Field>
      </div>
    </FormModal>
  );
}
