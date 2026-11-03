"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ejecutarAccion, erroresDe, validar, zId, zIdOpcional, zTexto, zTextoOpcional, type ActionState } from "@/lib/action";
import { GIROS_OPERATIVOS, TIPOS_SEDE } from "@/lib/constants";
import type { GiroNegocio, TipoSede } from "@/app/generated/prisma/client";

const soloAdmin = (s: { rol: string }) => s.rol === "ADMIN";
const zPassword = z.string().min(8, { error: "Mínimo 8 caracteres" }).regex(/[A-Z]/, { error: "Incluya una mayúscula" }).regex(/\d/, { error: "Incluya un número" });

// ─── Usuarios ──────────────────────────────────────────────────────────────

const UsuarioSchema = z
  .object({
    nombre: zTexto(3),
    email: z.email({ error: "Correo inválido" }).trim().toLowerCase(),
    password: zPassword,
    rol: z.enum(["ADMIN", "GERENTE", "CONTADOR", "OPERADOR"]),
    giro: z.preprocess((v) => (v === "" ? null : v), z.enum(GIROS_OPERATIVOS as [GiroNegocio, ...GiroNegocio[]]).nullable()),
    sedeId: zIdOpcional,
  })
  // ADMIN y CONTADOR son corporativos; GERENTE y OPERADOR pertenecen a un giro
  .refine((d) => (d.rol === "ADMIN" || d.rol === "CONTADOR" ? d.giro === null : d.giro !== null), { error: "Gerentes y operadores requieren giro; administración y contabilidad no", path: ["giro"] });

export async function crearUsuarioAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(UsuarioSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  const { password, ...data } = parsed.data;
  return ejecutarAccion({
    giros: soloAdmin,
    ejecutar: async () => {
      if (data.sedeId) {
        const sede = await prisma.sede.findUniqueOrThrow({ where: { id: data.sedeId } });
        const giroEsperado = data.giro ?? "CORPORATIVO";
        if (sede.giro !== giroEsperado) throw new Error(`La sede ${sede.nombre} no pertenece al giro seleccionado`);
      }
      await prisma.usuario.create({ data: { ...data, password: await bcrypt.hash(password, 10) } });
    },
    bitacora: { accion: "CREAR_USUARIO", entidad: "Usuario", detalle: data.email },
    revalidar: ["/admin/usuarios"],
    exito: `Usuario ${data.email} creado.`,
  });
}

export async function alternarUsuarioAction(id: number) {
  return ejecutarAccion({
    giros: soloAdmin,
    ejecutar: async (session) => {
      if (id === session.usuarioId) throw new Error("No puede desactivar su propia cuenta.");
      const u = await prisma.usuario.findUniqueOrThrow({ where: { id } });
      await prisma.usuario.update({ where: { id }, data: { activo: !u.activo } });
    },
    bitacora: { accion: "ALTERNAR_USUARIO", entidad: "Usuario", detalle: String(id) },
    revalidar: ["/admin/usuarios"],
    exito: "Estado del usuario actualizado.",
  });
}

const PasswordSchema = z.object({ usuarioId: zId, password: zPassword });

export async function restablecerPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(PasswordSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  return ejecutarAccion({
    giros: soloAdmin,
    ejecutar: async () => prisma.usuario.update({ where: { id: parsed.data.usuarioId }, data: { password: await bcrypt.hash(parsed.data.password, 10) } }),
    bitacora: { accion: "RESTABLECER_PASSWORD", entidad: "Usuario", detalle: String(parsed.data.usuarioId) },
    revalidar: ["/admin/usuarios"],
    exito: "Contraseña restablecida.",
  });
}

// ─── Sedes ─────────────────────────────────────────────────────────────────

const SedeSchema = z
  .object({
    codigo: z.string().trim().toUpperCase().regex(/^[A-Z]{3}-[A-Z0-9]{2,4}$/, { error: "Formato: MIN-COB" }),
    nombre: zTexto(5),
    tipo: z.enum(Object.keys(TIPOS_SEDE) as [TipoSede, ...TipoSede[]]),
    giro: z.enum(["CORPORATIVO", ...GIROS_OPERATIVOS] as [GiroNegocio, ...GiroNegocio[]]),
    departamento: zTexto(),
    direccion: zTexto(5),
    telefono: zTextoOpcional,
    // Límites aproximados del territorio guatemalteco
    latitud: z.coerce.number().min(13.7, { error: "Fuera de Guatemala" }).max(17.9, { error: "Fuera de Guatemala" }),
    longitud: z.coerce.number().min(-92.3, { error: "Fuera de Guatemala" }).max(-88.1, { error: "Fuera de Guatemala" }),
  })
  .refine((d) => TIPOS_SEDE[d.tipo].giros.includes(d.giro), { error: "El tipo de sede no corresponde al giro", path: ["giro"] });

export async function crearSedeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = validar(SedeSchema, formData);
  if (!parsed.success) return erroresDe(parsed.error);
  return ejecutarAccion({
    giros: soloAdmin,
    ejecutar: () => prisma.sede.create({ data: parsed.data }),
    bitacora: { accion: "CREAR_SEDE", entidad: "Sede", detalle: parsed.data.codigo },
    revalidar: ["/admin/sedes"],
    exito: `Sede ${parsed.data.nombre} registrada.`,
  });
}

export async function alternarSedeAction(id: number) {
  return ejecutarAccion({
    giros: soloAdmin,
    ejecutar: async () => {
      const s = await prisma.sede.findUniqueOrThrow({ where: { id } });
      if (s.tipo === "OFICINA_CENTRAL") throw new Error("La oficina central no puede desactivarse.");
      await prisma.sede.update({ where: { id }, data: { activa: !s.activa } });
    },
    bitacora: { accion: "ALTERNAR_SEDE", entidad: "Sede", detalle: String(id) },
    revalidar: ["/admin/sedes"],
    exito: "Estado de la sede actualizado.",
  });
}
