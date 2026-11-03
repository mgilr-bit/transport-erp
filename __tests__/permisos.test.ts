import { describe, expect, it } from "vitest";
import { esCorporativo, puedeAprobar, puedeDefinirPresupuesto, puedeOperar, puedeRegistrarGasto, puedeVerGiro } from "@/lib/auth-rules";
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
  });
});
