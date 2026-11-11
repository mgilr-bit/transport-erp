import { describe, expect, it } from "vitest";
import {
  esCorporativo,
  esInterno,
  puedeAprobar,
  puedeDefinirPresupuesto,
  puedeGestionarPedidos,
  puedeGestionarReuniones,
  puedeOperar,
  puedeRegistrarGasto,
  puedeVerGiro,
} from "@/lib/auth-rules";
import { navegacionPara } from "@/lib/navegacion";
import type { GiroNegocio, Rol } from "@/app/generated/prisma/client";

const sesion = (rol: Rol, giro: GiroNegocio | null = null) => ({ usuarioId: 1, email: "x@transport.gt", nombre: "X", rol, giro, expiresAt: new Date() });

describe("permisos por rol y giro", () => {
  it("administración y contabilidad ven todos los giros", () => {
    expect(esCorporativo(sesion("ADMIN"))).toBe(true);
    expect(puedeVerGiro(sesion("CONTADOR"), "PROCESO")).toBe(true);
    expect(puedeVerGiro(sesion("GERENTE", "MAQUINARIA"), "PROCESO")).toBe(false);
  });

  it("el contador consulta pero no opera módulos; sí registra gastos de cualquier giro", () => {
    expect(puedeOperar(sesion("CONTADOR"), "TRANSPORTE_MP")).toBe(false);
    expect(puedeRegistrarGasto(sesion("CONTADOR"), "TRANSPORTE_MP")).toBe(true);
    expect(puedeRegistrarGasto(sesion("GERENTE", "PROCESO"), "TRANSPORTE_MP")).toBe(false);
    expect(puedeRegistrarGasto(sesion("OPERADOR", "PROCESO"), "PROCESO")).toBe(true);
  });

  it("solo administración y contabilidad asignan presupuesto", () => {
    expect(puedeDefinirPresupuesto(sesion("ADMIN"))).toBe(true);
    expect(puedeDefinirPresupuesto(sesion("CONTADOR"))).toBe(true);
    expect(puedeDefinirPresupuesto(sesion("GERENTE", "PROCESO"))).toBe(false);
  });

  it("los operadores no aprueban", () => {
    expect(puedeAprobar(sesion("GERENTE", "EXTRACCION"), "EXTRACCION")).toBe(true);
    expect(puedeAprobar(sesion("OPERADOR", "EXTRACCION"), "EXTRACCION")).toBe(false);
  });
});

describe("roles nuevos", () => {
  it("dirección consulta todos los giros pero no opera, no registra gastos ni asigna presupuesto", () => {
    const d = sesion("DIRECCION");
    expect(esCorporativo(d)).toBe(true);
    expect(puedeVerGiro(d, "CONSTRUCCION")).toBe(true);
    expect(puedeOperar(d, "CONSTRUCCION")).toBe(false);
    expect(puedeRegistrarGasto(d, "CONSTRUCCION")).toBe(false);
    expect(puedeDefinirPresupuesto(d)).toBe(false);
  });

  it("el vendedor ve su giro pero no opera los módulos ni registra gastos", () => {
    const v = sesion("VENDEDOR", "PROCESO");
    expect(puedeVerGiro(v, "PROCESO")).toBe(true);
    expect(puedeVerGiro(v, "MAQUINARIA")).toBe(false);
    expect(puedeOperar(v, "PROCESO")).toBe(false);
    expect(puedeRegistrarGasto(v, "PROCESO")).toBe(false);
  });

  it("un cliente no ve ni opera nada del sistema interno", () => {
    const c = { ...sesion("CLIENTE"), clienteId: 3 };
    expect(esInterno(c)).toBe(false);
    expect(esInterno(sesion("OPERADOR", "PROCESO"))).toBe(true);
    expect(esCorporativo(c)).toBe(false);
    for (const g of ["EXTRACCION", "PROCESO", "MAQUINARIA", "TRANSPORTE_MP", "TRANSPORTE_PROD", "CONSTRUCCION", "CORPORATIVO"] as GiroNegocio[]) {
      expect(puedeVerGiro(c, g)).toBe(false);
      expect(puedeOperar(c, g)).toBe(false);
      expect(puedeRegistrarGasto(c, g)).toBe(false);
    }
  });

  it("los pedidos los gestionan administración y el personal comercial y operativo de Proceso", () => {
    expect(puedeGestionarPedidos(sesion("ADMIN"))).toBe(true);
    expect(puedeGestionarPedidos(sesion("VENDEDOR", "PROCESO"))).toBe(true);
    expect(puedeGestionarPedidos(sesion("OPERADOR", "PROCESO"))).toBe(true);
    expect(puedeGestionarPedidos(sesion("GERENTE", "PROCESO"))).toBe(true);
    expect(puedeGestionarPedidos(sesion("VENDEDOR", "MAQUINARIA"))).toBe(false);
    expect(puedeGestionarPedidos(sesion("CONTADOR"))).toBe(false);
    expect(puedeGestionarPedidos(sesion("DIRECCION"))).toBe(false);
  });

  it("las reuniones de un giro las atienden su gerente y sus vendedores", () => {
    expect(puedeGestionarReuniones(sesion("VENDEDOR", "MAQUINARIA"), "MAQUINARIA")).toBe(true);
    expect(puedeGestionarReuniones(sesion("GERENTE", "MAQUINARIA"), "MAQUINARIA")).toBe(true);
    expect(puedeGestionarReuniones(sesion("VENDEDOR", "MAQUINARIA"), "PROCESO")).toBe(false);
    expect(puedeGestionarReuniones(sesion("OPERADOR", "MAQUINARIA"), "MAQUINARIA")).toBe(false);
    expect(puedeGestionarReuniones(sesion("ADMIN"), "CONSTRUCCION")).toBe(true);
  });
});

describe("menú según el usuario", () => {
  const rutas = (rol: Rol, giro: GiroNegocio | null = null) => navegacionPara(sesion(rol, giro)).flatMap((s) => s.items.map((i) => i.href));

  it("un gerente de maquinaria ve su módulo y el GPS, pero no otros giros ni administración", () => {
    const r = rutas("GERENTE", "MAQUINARIA");
    expect(r).toEqual(expect.arrayContaining(["/dashboard", "/maquinaria", "/gps", "/alertas", "/finanzas"]));
    expect(r).not.toContain("/proceso");
    expect(r).not.toContain("/admin/usuarios");
  });

  it("el flujo de materia prima es visible para los tres giros que participan", () => {
    for (const giro of ["PROCESO", "EXTRACCION", "TRANSPORTE_MP"] as GiroNegocio[]) expect(rutas("GERENTE", giro)).toContain("/flujo");
    expect(rutas("GERENTE", "CONSTRUCCION")).not.toContain("/flujo");
  });

  it("solo el administrador ve la sección de administración", () => {
    expect(rutas("ADMIN")).toContain("/admin/bitacora");
    expect(rutas("CONTADOR")).not.toContain("/admin/bitacora");
    expect(rutas("ADMIN")).toContain("/admin/integraciones");
    expect(rutas("DIRECCION")).not.toContain("/admin/integraciones");
  });

  it("el vendedor ve el área comercial y su giro, sin administración", () => {
    const r = rutas("VENDEDOR", "PROCESO");
    expect(r).toEqual(expect.arrayContaining(["/dashboard", "/ventas", "/proceso"]));
    expect(r).not.toContain("/maquinaria");
    expect(r).not.toContain("/admin/usuarios");
    expect(r).not.toContain("/reportes");
  });

  it("los reportes consolidados son para corporativos y gerentes", () => {
    expect(rutas("DIRECCION")).toEqual(expect.arrayContaining(["/reportes", "/ventas", "/proceso", "/gps"]));
    expect(rutas("GERENTE", "EXTRACCION")).toContain("/reportes");
    expect(rutas("OPERADOR", "EXTRACCION")).not.toContain("/reportes");
  });

  it("el área comercial no aparece para operadores fuera de Proceso", () => {
    expect(rutas("OPERADOR", "EXTRACCION")).not.toContain("/ventas");
    expect(rutas("OPERADOR", "PROCESO")).toContain("/ventas");
  });
});
