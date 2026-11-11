"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { ejecutarAccion, erroresDe, validar, zFecha, zId, zIdOpcional, zMonto, zTexto, type ActionState } from "@/lib/action";
import { cancelarViaje, entregarViaje, iniciarViaje, programarViaje } from "@/lib/services/flujo";
import type { GiroNegocio, TipoViaje } from "@/app/generated/prisma/client";

const giroDe = (tipo: TipoViaje): GiroNegocio => (tipo === "MATERIA_PRIMA" ? "TRANSPORTE_MP" : "TRANSPORTE_PROD");
const RUTAS = ["/transporte", "/flujo", "/dashboard", "/gps"];

const ViajeSchema = z.object({
  tipo: z.enum(["MATERIA_PRIMA", "PRODUCTO"]),
  modalidad: z.enum(["NACIONAL", "INTER_PUERTOS", "INTER_FRONTERAS", "PUERTO_A_BODEGA", "BODEGA_A_PUERTO"]),
  camionId: zId,
  pilotoId: zId,
  clienteId: zIdOpcional,
  origen: zTexto(3),
  destino: zTexto(3),
  carga: zTexto(3),
  toneladas: zMonto,
  distanciaKm: z.coerce.number().int().positive({ error: "Debe ser mayor a 0" }),
  fechaSalida: zFecha,
  solicitudId: zIdOpcional,
  pedidoId: zIdOpcional,
});

export async function crearViaje(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(ViajeSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  const data = parsed.data;
  return ejecutarAccion({
    giros: [giroDe(data.tipo)],
    ejecutar: () => programarViaje(data),
    bitacora: { accion: "PROGRAMAR_VIAJE", entidad: "Viaje", detalle: `${data.origen} → ${data.destino}` },
    revalidar: RUTAS,
    exito: "Viaje programado correctamente.",
  });
}

async function accionViaje(id: number, fn: (id: number) => Promise<unknown>, accion: string, exito: string) {
  const viaje = await prisma.viaje.findUnique({ where: { id }, select: { tipo: true, codigo: true } });
  if (!viaje) return { ok: false, mensaje: "El viaje no existe." };
  return ejecutarAccion({
    giros: [giroDe(viaje.tipo)],
    ejecutar: () => fn(id),
    bitacora: { accion, entidad: "Viaje", detalle: viaje.codigo },
    revalidar: RUTAS,
    exito,
  });
}

export async function iniciarViajeAction(id: number) {
  return accionViaje(id, iniciarViaje, "INICIAR_VIAJE", "Viaje en curso.");
}

export async function entregarViajeAction(id: number) {
  return accionViaje(id, entregarViaje, "ENTREGAR_VIAJE", "Viaje entregado.");
}

export async function cancelarViajeAction(id: number) {
  return accionViaje(id, cancelarViaje, "CANCELAR_VIAJE", "Viaje cancelado.");
}

const CamionSchema = z.object({
  placa: z.string().trim().toUpperCase().regex(/^C-\d{3}[A-Z]{3}$/, { error: "Formato de placa: C-123ABC" }),
  marca: zTexto(),
  modelo: zTexto(),
  anio: z.coerce.number().int().min(1990).max(new Date().getFullYear() + 1),
  capacidadTon: zMonto,
  tipo: zTexto(),
  giro: z.enum(["TRANSPORTE_MP", "TRANSPORTE_PROD"]),
  sedeId: zId,
});

export async function crearCamion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(CamionSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  const data = parsed.data;
  return ejecutarAccion({
    giros: [data.giro],
    ejecutar: async () => {
      // Cada unidad nueva se registra con su dispositivo GPS-Inversiones
      const imei = `35693803${Date.now().toString().slice(-7)}`;
      await prisma.$transaction(async (tx) => {
        const dispositivo = await tx.dispositivoGPS.create({ data: { imei, tipoActivo: "CAMION" } });
        await tx.camion.create({ data: { ...data, dispositivoId: dispositivo.id } });
      });
    },
    bitacora: { accion: "REGISTRAR_CAMION", entidad: "Camion", detalle: data.placa },
    revalidar: ["/transporte", "/gps"],
    exito: `Camión ${data.placa} registrado con su dispositivo GPS.`,
  });
}
