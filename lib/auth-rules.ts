import type { GiroNegocio, Rol } from "@/app/generated/prisma/client";

type Sesion = { rol: Rol; giro: GiroNegocio | null };

/** ADMIN, CONTADOR y DIRECCION tienen visión corporativa de todos los giros. */
export function esCorporativo(session: Pick<Sesion, "rol">) {
  return session.rol === "ADMIN" || session.rol === "CONTADOR" || session.rol === "DIRECCION";
}

/** Personal de TransPort; los clientes solo acceden al portal. */
export function esInterno(session: Pick<Sesion, "rol">) {
  return session.rol !== "CLIENTE";
}

export function puedeVerGiro(session: Sesion, giro: GiroNegocio) {
  if (!esInterno(session)) return false;
  return esCorporativo(session) || session.giro === giro;
}

/** Solo administración, gerentes y operadores operan módulos; los demás roles consultan o atienden clientes. */
export function puedeOperar(session: Sesion, giro: GiroNegocio) {
  if (session.rol === "ADMIN") return true;
  if (session.rol !== "GERENTE" && session.rol !== "OPERADOR") return false;
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

// ─── Área comercial ────────────────────────────────────────────────────────

/** Los pedidos en línea son de productos de las plantas de proceso. */
export function puedeGestionarPedidos(session: Sesion) {
  if (session.rol === "ADMIN") return true;
  return session.giro === "PROCESO" && (session.rol === "GERENTE" || session.rol === "VENDEDOR" || session.rol === "OPERADOR");
}

export function puedeGestionarReuniones(session: Sesion, giro: GiroNegocio) {
  if (session.rol === "ADMIN") return true;
  return (session.rol === "GERENTE" || session.rol === "VENDEDOR") && session.giro === giro;
}

/** Alta de clientes y asignación de cartera. */
export function puedeGestionarClientes(session: Pick<Sesion, "rol">) {
  return session.rol === "ADMIN" || session.rol === "GERENTE" || session.rol === "VENDEDOR";
}

export function puedeVerComercial(session: Sesion) {
  if (esCorporativo(session) || session.rol === "VENDEDOR" || session.rol === "GERENTE") return true;
  return session.rol === "OPERADOR" && session.giro === "PROCESO";
}

/** Reportes consolidados: la sede central (todos los giros) y los gerentes (el suyo). */
export function puedeVerReportes(session: Pick<Sesion, "rol">) {
  return esCorporativo(session) || session.rol === "GERENTE";
}
