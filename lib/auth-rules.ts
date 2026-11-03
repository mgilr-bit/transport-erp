import type { GiroNegocio, Rol } from "@/app/generated/prisma/client";

type Sesion = { rol: Rol; giro: GiroNegocio | null };

/** ADMIN y CONTADOR tienen visión corporativa de todos los giros. */
export function esCorporativo(session: Pick<Sesion, "rol">) {
  return session.rol === "ADMIN" || session.rol === "CONTADOR";
}

export function puedeVerGiro(session: Sesion, giro: GiroNegocio) {
  return esCorporativo(session) || session.giro === giro;
}

/** El contador puede consultar todo pero no opera módulos; los operadores no aprueban. */
export function puedeOperar(session: Sesion, giro: GiroNegocio) {
  if (session.rol === "ADMIN") return true;
  if (session.rol === "CONTADOR") return false;
  return session.giro === giro;
}

export function puedeAprobar(session: Sesion, giro: GiroNegocio) {
  return session.rol === "ADMIN" || (session.rol === "GERENTE" && session.giro === giro);
}

/** La contabilidad central registra gastos de todos los giros; cada giro, los suyos. */
export function puedeRegistrarGasto(session: Sesion, giro: GiroNegocio) {
  return session.rol === "CONTADOR" || puedeOperar(session, giro);
}

/** El presupuesto de cada giro lo asigna la sede central. */
export function puedeDefinirPresupuesto(session: Pick<Sesion, "rol">) {
  return session.rol === "ADMIN" || session.rol === "CONTADOR";
}
