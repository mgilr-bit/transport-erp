"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui/form";
import { FormModal } from "@/components/ui/form-modal";
import { ActionButton } from "@/components/ui/action-button";
import { alternarUsuarioAction, crearUsuarioAction, restablecerPasswordAction } from "@/app/actions/admin";
import { GIROS, GIROS_OPERATIVOS, ROLES } from "@/lib/constants";

type Sede = { id: number; texto: string; giro: string };
const REQUISITO = "Mínimo 8 caracteres, una mayúscula y un número.";

export function NuevoUsuario({ sedes }: { sedes: Sede[] }) {
  const [rol, setRol] = useState("GERENTE");
  const [giro, setGiro] = useState<string>(GIROS_OPERATIVOS[0]);
  const corporativo = rol === "ADMIN" || rol === "CONTADOR";
  const giroSede = corporativo ? "CORPORATIVO" : giro;

  return (
    <FormModal boton="Nuevo usuario" titulo="Nuevo usuario" descripcion="Administración y contabilidad tienen vista corporativa; gerentes y operadores, la de su giro." action={crearUsuarioAction} enviar="Crear usuario" ancho="max-w-xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre completo" name="nombre" className="sm:col-span-2"><Input name="nombre" placeholder="Ing. Ana López" /></Field>
        <Field label="Correo" name="email"><Input name="email" type="email" placeholder="ana.lopez@transport.gt" autoComplete="off" /></Field>
        <Field label="Contraseña inicial" name="password" hint={REQUISITO}><Input name="password" type="password" autoComplete="new-password" /></Field>
        <Field label="Rol" name="rol">
          <Select name="rol" value={rol} onChange={(e) => setRol(e.target.value)}>
            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Giro de negocio" name="giro">
          {/* Un select deshabilitado no se envía: el valor vacío va en un campo oculto */}
          {corporativo && <input type="hidden" name="giro" value="" />}
          <Select name={corporativo ? undefined : "giro"} id="giro" value={corporativo ? "" : giro} disabled={corporativo} onChange={(e) => setGiro(e.target.value)}>
            {corporativo && <option value="">Corporativo (todos)</option>}
            {GIROS_OPERATIVOS.map((g) => <option key={g} value={g}>{GIROS[g].nombre}</option>)}
          </Select>
        </Field>
        <Field label="Sede" name="sedeId" className="sm:col-span-2">
          <Select name="sedeId" key={giroSede} defaultValue="">
            <option value="">— Sin sede fija —</option>
            {sedes.filter((s) => s.giro === giroSede).map((s) => <option key={s.id} value={s.id}>{s.texto}</option>)}
          </Select>
        </Field>
      </div>
    </FormModal>
  );
}

export function RestablecerPassword({ id, nombre }: { id: number; nombre: string }) {
  return (
    <FormModal boton="Contraseña" titulo="Restablecer contraseña" descripcion={nombre} action={restablecerPasswordAction} enviar="Restablecer" variante="fantasma" tamano="sm" icono={false}>
      <input type="hidden" name="usuarioId" value={id} />
      <Field label="Nueva contraseña" name="password" hint={REQUISITO}><Input name="password" type="password" autoComplete="new-password" /></Field>
    </FormModal>
  );
}

export function AlternarUsuario({ id, activo }: { id: number; activo: boolean }) {
  return (
    <ActionButton action={() => alternarUsuarioAction(id)} variante={activo ? "fantasma" : "secundario"} confirmar={activo ? "¿Desactivar este usuario? Perderá el acceso de inmediato." : undefined}>
      {activo ? "Desactivar" : "Activar"}
    </ActionButton>
  );
}
