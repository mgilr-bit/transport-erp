"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";
import type { ActionState } from "@/lib/action";

const LoginSchema = z.object({
  email: z.email({ error: "Correo inválido" }).trim().toLowerCase(),
  password: z.string().min(1, { error: "Ingrese su contraseña" }),
});

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errores: z.flattenError(parsed.error).fieldErrors };

  const usuario = await prisma.usuario.findUnique({ where: { email: parsed.data.email } });
  // Mismo mensaje para usuario inexistente y contraseña incorrecta
  if (!usuario || !usuario.activo || !(await bcrypt.compare(parsed.data.password, usuario.password))) {
    return { ok: false, mensaje: "Credenciales incorrectas o usuario inactivo." };
  }

  await createSession({
    usuarioId: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol,
    giro: usuario.giro,
    expiresAt: new Date(),
  });
  await prisma.$transaction([
    prisma.usuario.update({ where: { id: usuario.id }, data: { ultimoAcceso: new Date() } }),
    prisma.bitacora.create({ data: { usuarioId: usuario.id, accion: "INICIO_SESION", entidad: "Usuario", detalle: usuario.email } }),
  ]);
  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
