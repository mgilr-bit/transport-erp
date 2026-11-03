"use server";

import { z } from "zod";
import { ejecutarAccion, erroresDe, validar, zFecha, zId, zMonto, zTexto, zTextoOpcional, type ActionState } from "@/lib/action";
import { agregarHito, alternarHito, asignarMaquina, cambiarEstadoProyecto, crearProyecto, registrarCostoObra } from "@/lib/services/operaciones";

const RUTAS = ["/construccion", "/dashboard"];
const rutasProyecto = (id: number) => [...RUTAS, `/construccion/${id}`];

const ProyectoSchema = z
  .object({
    nombre: zTexto(5),
    tipo: z.enum(["PUENTE", "CARRETERA", "EDIFICIO", "OTRO"]),
    clienteId: zId,
    ubicacion: zTexto(3),
    departamento: zTexto(),
    montoContrato: zMonto,
    fechaInicio: zFecha,
    fechaFinEstimada: zFecha,
    descripcion: zTextoOpcional,
  })
  .refine((d) => d.fechaFinEstimada > d.fechaInicio, { error: "Debe ser posterior al inicio", path: ["fechaFinEstimada"] });

export async function crearProyectoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(ProyectoSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  return ejecutarAccion({
    giros: ["CONSTRUCCION"],
    ejecutar: () => crearProyecto(parsed.data),
    bitacora: { accion: "CREAR_PROYECTO", entidad: "ProyectoConstruccion", detalle: parsed.data.nombre },
    revalidar: RUTAS,
    exito: "Proyecto registrado en planificación.",
  });
}

const HitoSchema = z.object({ proyectoId: zId, nombre: zTexto(3), peso: z.coerce.number().int().min(1, { error: "Mínimo 1" }).max(100, { error: "Máximo 100" }), fechaMeta: zFecha });

export async function agregarHitoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(HitoSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  return ejecutarAccion({
    giros: ["CONSTRUCCION"],
    ejecutar: () => agregarHito(parsed.data),
    bitacora: { accion: "AGREGAR_HITO", entidad: "HitoProyecto", detalle: parsed.data.nombre },
    revalidar: rutasProyecto(parsed.data.proyectoId),
    exito: "Hito agregado; el avance se recalculó.",
  });
}

export async function alternarHitoAction(hitoId: number, proyectoId: number) {
  return ejecutarAccion({
    giros: ["CONSTRUCCION"],
    ejecutar: () => alternarHito(hitoId),
    bitacora: { accion: "ACTUALIZAR_HITO", entidad: "HitoProyecto", detalle: String(hitoId) },
    revalidar: rutasProyecto(proyectoId),
    exito: "Avance actualizado.",
  });
}

const CostoSchema = z.object({
  proyectoId: zId,
  categoria: z.enum(["PLANILLA", "COMBUSTIBLE", "MANTENIMIENTO", "MATERIALES", "ARRENDAMIENTO", "SERVICIOS", "OTROS"]),
  descripcion: zTexto(3),
  monto: zMonto,
  fecha: zFecha,
});

export async function registrarCostoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(CostoSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  return ejecutarAccion({
    giros: ["CONSTRUCCION"],
    ejecutar: (session) => registrarCostoObra({ ...parsed.data, usuarioId: session.usuarioId }),
    bitacora: { accion: "REGISTRAR_COSTO_OBRA", entidad: "Gasto", detalle: parsed.data.descripcion },
    revalidar: [...rutasProyecto(parsed.data.proyectoId), "/finanzas"],
    exito: "Costo registrado y cargado al presupuesto de Construcción.",
  });
}

const AsignarSchema = z.object({ proyectoId: zId, maquinaId: zId });

export async function asignarMaquinaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(AsignarSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  return ejecutarAccion({
    // La máquina pertenece al giro de Maquinaria, pero la solicita la obra
    giros: ["CONSTRUCCION", "MAQUINARIA"],
    ejecutar: () => asignarMaquina(parsed.data.maquinaId, parsed.data.proyectoId),
    bitacora: { accion: "ASIGNAR_MAQUINA", entidad: "Maquina", detalle: `Proyecto ${parsed.data.proyectoId}` },
    revalidar: [...rutasProyecto(parsed.data.proyectoId), "/maquinaria"],
    exito: "Máquina asignada a la obra.",
  });
}

export async function liberarMaquinaAction(maquinaId: number, proyectoId: number) {
  return ejecutarAccion({
    giros: ["CONSTRUCCION", "MAQUINARIA"],
    ejecutar: () => asignarMaquina(maquinaId, null),
    bitacora: { accion: "LIBERAR_MAQUINA", entidad: "Maquina", detalle: String(maquinaId) },
    revalidar: [...rutasProyecto(proyectoId), "/maquinaria"],
    exito: "Máquina devuelta a su sucursal.",
  });
}

const EstadoSchema = z.object({ id: zId, estado: z.enum(["EN_EJECUCION", "PAUSADO"]) });

export async function cambiarEstadoProyectoAction(id: number, estado: "EN_EJECUCION" | "PAUSADO") {
  const parsed = EstadoSchema.safeParse({ id, estado });
  if (!parsed.success) return { ok: false, mensaje: "Estado inválido." };
  return ejecutarAccion({
    giros: ["CONSTRUCCION"],
    ejecutar: () => cambiarEstadoProyecto(id, estado),
    bitacora: { accion: estado === "PAUSADO" ? "PAUSAR_PROYECTO" : "REANUDAR_PROYECTO", entidad: "ProyectoConstruccion", detalle: String(id) },
    revalidar: rutasProyecto(id),
    exito: estado === "PAUSADO" ? "Obra pausada." : "Obra en ejecución.",
  });
}
