"use server";

import { z } from "zod";
import { ejecutarAccion, erroresDe, validar, zFecha, zIdOpcional, zMonto, zTexto, zTextoOpcional, type ActionState } from "@/lib/action";
import { puedeDefinirPresupuesto, puedeRegistrarGasto } from "@/lib/auth";
import { GIROS_OPERATIVOS } from "@/lib/constants";
import { definirPresupuestos, registrarGasto } from "@/lib/services/finanzas";
import type { GiroNegocio } from "@/app/generated/prisma/client";

const GIROS = ["CORPORATIVO", ...GIROS_OPERATIVOS] as [GiroNegocio, ...GiroNegocio[]];
const RUTAS = ["/finanzas", "/dashboard", "/alertas"];

const GastoSchema = z.object({
  giro: z.enum(GIROS),
  sedeId: zIdOpcional,
  categoria: z.enum(["PLANILLA", "COMBUSTIBLE", "MANTENIMIENTO", "MATERIALES", "ARRENDAMIENTO", "SERVICIOS", "GPS", "OTROS"]),
  descripcion: zTexto(3),
  monto: zMonto,
  fecha: zFecha,
  documento: zTextoOpcional,
});

export async function registrarGastoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(GastoSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  const data = parsed.data;
  return ejecutarAccion({
    giros: (session) => puedeRegistrarGasto(session, data.giro),
    ejecutar: (session) => registrarGasto({ ...data, usuarioId: session.usuarioId }),
    bitacora: { accion: "REGISTRAR_GASTO", entidad: "Gasto", detalle: `${data.giro} · ${data.descripcion}` },
    revalidar: RUTAS,
    exito: "Gasto registrado.",
  });
}

const PeriodoSchema = z.object({ anio: z.coerce.number().int().min(2020).max(2100), mes: z.coerce.number().int().min(1).max(12) });
const MontoOpcional = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number({ error: "Ingrese un número" }).min(0, { error: "No puede ser negativo" }).optional());

export async function definirPresupuestoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const periodo = validar(PeriodoSchema, formData);
  if (!periodo.success) return erroresDe(periodo.error);
  const MontosSchema = z.object(Object.fromEntries(GIROS.map((g) => [g, MontoOpcional])) as Record<GiroNegocio, typeof MontoOpcional>);
  const montos = validar(MontosSchema, formData);
  if (!montos.success) return erroresDe(montos.error);
  const definidos = Object.fromEntries(Object.entries(montos.data).filter(([, v]) => v !== undefined)) as Partial<Record<GiroNegocio, number>>;
  if (!Object.keys(definidos).length) return { ok: false, mensaje: "Ingrese al menos un monto." };

  const { anio, mes } = periodo.data;
  return ejecutarAccion({
    giros: puedeDefinirPresupuesto,
    ejecutar: () => definirPresupuestos(anio, mes, definidos),
    bitacora: { accion: "DEFINIR_PRESUPUESTO", entidad: "Presupuesto", detalle: `${String(mes).padStart(2, "0")}/${anio}` },
    revalidar: RUTAS,
    exito: (r) => `Presupuesto de ${r.giros} giro${r.giros === 1 ? "" : "s"} actualizado${r.alertas ? ` · ${r.alertas} alerta${r.alertas === 1 ? "" : "s"} generada${r.alertas === 1 ? "" : "s"}` : ""}.`,
  });
}
