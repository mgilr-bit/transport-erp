"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { ejecutarAccion, erroresDe, validar, zFecha, zId, zMonto, zTexto, type ActionState } from "@/lib/action";
import { crearContratoAlquiler, finalizarContrato, venderMaquina } from "@/lib/services/operaciones";

const RUTAS = ["/maquinaria", "/dashboard", "/gps"];

const ContratoSchema = z
  .object({
    maquinaId: zId,
    clienteId: zId,
    fechaInicio: zFecha,
    fechaFin: zFecha,
    deposito: z.coerce.number().min(0, { error: "No puede ser negativo" }).default(0),
  })
  .refine((d) => d.fechaFin >= d.fechaInicio, { error: "Debe ser igual o posterior al inicio", path: ["fechaFin"] });

export async function crearContratoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(ContratoSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  return ejecutarAccion({
    giros: ["MAQUINARIA"],
    ejecutar: () => crearContratoAlquiler(parsed.data),
    bitacora: { accion: "CREAR_ALQUILER", entidad: "ContratoAlquiler", detalle: `Máquina ${parsed.data.maquinaId}` },
    revalidar: RUTAS,
    exito: "Contrato de alquiler registrado; la máquina queda como alquilada.",
  });
}

export async function finalizarContratoAction(id: number) {
  return ejecutarAccion({
    giros: ["MAQUINARIA"],
    ejecutar: () => finalizarContrato(id),
    bitacora: { accion: "FINALIZAR_ALQUILER", entidad: "ContratoAlquiler", detalle: String(id) },
    revalidar: RUTAS,
    exito: "Contrato finalizado; la máquina vuelve a estar disponible.",
  });
}

const VentaSchema = z.object({ maquinaId: zId, clienteId: zId, precio: zMonto, fecha: zFecha });

export async function venderMaquinaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(VentaSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  return ejecutarAccion({
    giros: ["MAQUINARIA"],
    ejecutar: () => venderMaquina(parsed.data),
    bitacora: { accion: "VENDER_MAQUINA", entidad: "VentaMaquina", detalle: `Máquina ${parsed.data.maquinaId}` },
    revalidar: RUTAS,
    exito: "Venta registrada.",
  });
}

const MaquinaSchema = z.object({
  codigo: z.string().trim().toUpperCase().regex(/^MQ-\d{3,4}$/, { error: "Formato: MQ-001" }),
  tipo: zTexto(),
  marca: zTexto(),
  modelo: zTexto(),
  anio: z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1),
  serie: zTexto(4),
  sedeId: zId,
  tarifaDiaria: zMonto,
  precioVenta: zMonto,
});

export async function crearMaquinaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(MaquinaSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  const data = parsed.data;
  return ejecutarAccion({
    giros: ["MAQUINARIA"],
    ejecutar: async () => {
      // Igual que los camiones: cada máquina se registra con su dispositivo GPS-Inversiones
      const imei = `35693804${Date.now().toString().slice(-7)}`;
      await prisma.$transaction(async (tx) => {
        const dispositivo = await tx.dispositivoGPS.create({ data: { imei, tipoActivo: "MAQUINA" } });
        await tx.maquina.create({ data: { ...data, dispositivoId: dispositivo.id } });
      });
    },
    bitacora: { accion: "REGISTRAR_MAQUINA", entidad: "Maquina", detalle: data.codigo },
    revalidar: RUTAS,
    exito: `Máquina ${data.codigo} registrada con su dispositivo GPS.`,
  });
}

/** Envía a taller una máquina disponible, o la devuelve al inventario. */
export async function alternarMantenimientoAction(id: number) {
  return ejecutarAccion({
    giros: ["MAQUINARIA"],
    ejecutar: async () => {
      const m = await prisma.maquina.findUniqueOrThrow({ where: { id } });
      if (m.estado !== "DISPONIBLE" && m.estado !== "MANTENIMIENTO") {
        throw new Error(`La máquina ${m.codigo} está ${m.estado.toLowerCase().replace("_", " ")}; no puede ir a mantenimiento.`);
      }
      await prisma.maquina.update({ where: { id, estado: m.estado }, data: { estado: m.estado === "DISPONIBLE" ? "MANTENIMIENTO" : "DISPONIBLE" } });
    },
    bitacora: { accion: "MANTENIMIENTO_MAQUINA", entidad: "Maquina", detalle: String(id) },
    revalidar: RUTAS,
    exito: "Estado de la máquina actualizado.",
  });
}
