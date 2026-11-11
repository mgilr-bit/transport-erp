import { describe, expect, it } from "vitest";
import { alertaVisiblePara, enlaceDeReferencia, filtroAlertas } from "@/lib/alertas";
import { AUDIENCIA_ALERTAS } from "@/lib/constants";
import type { GiroNegocio, Rol } from "@/app/generated/prisma/client";

const sesion = (rol: Rol, giro: GiroNegocio | null = null, extra: { usuarioId?: number; clienteId?: number } = {}) => ({
  usuarioId: extra.usuarioId ?? 1,
  rol,
  giro,
  clienteId: extra.clienteId ?? null,
});
const alerta = (datos: { giro?: GiroNegocio; rolesDestino?: Rol[]; usuarioId?: number | null; clienteId?: number | null } = {}) => ({
  giro: datos.giro ?? "TRANSPORTE_MP",
  rolesDestino: datos.rolesDestino ?? [],
  usuarioId: datos.usuarioId ?? null,
  clienteId: datos.clienteId ?? null,
});

describe("visibilidad de alertas según rol e interés", () => {
  it("una alerta sin destinatarios la ve todo el personal del giro y la sede central", () => {
    const a = alerta();
    expect(alertaVisiblePara(a, sesion("OPERADOR", "TRANSPORTE_MP"))).toBe(true);
    expect(alertaVisiblePara(a, sesion("CONTADOR"))).toBe(true);
    expect(alertaVisiblePara(a, sesion("GERENTE", "PROCESO"))).toBe(false);
  });

  it("los roles destino limitan quién la recibe dentro del giro", () => {
    const velocidad = alerta({ rolesDestino: AUDIENCIA_ALERTAS.EXCESO_VELOCIDAD });
    expect(alertaVisiblePara(velocidad, sesion("OPERADOR", "TRANSPORTE_MP"))).toBe(true);
    expect(alertaVisiblePara(velocidad, sesion("DIRECCION"))).toBe(true);
    expect(alertaVisiblePara(velocidad, sesion("CONTADOR"))).toBe(false);
    expect(alertaVisiblePara(velocidad, sesion("VENDEDOR", "TRANSPORTE_MP"))).toBe(false);

    const presupuesto = alerta({ giro: "PROCESO", rolesDestino: AUDIENCIA_ALERTAS.PRESUPUESTO_100 });
    expect(alertaVisiblePara(presupuesto, sesion("CONTADOR"))).toBe(true);
    expect(alertaVisiblePara(presupuesto, sesion("OPERADOR", "PROCESO"))).toBe(false);
  });

  it("una alerta dirigida a un usuario solo la ve ese usuario y el administrador", () => {
    const a = alerta({ giro: "PROCESO", usuarioId: 7 });
    expect(alertaVisiblePara(a, sesion("VENDEDOR", "PROCESO", { usuarioId: 7 }))).toBe(true);
    expect(alertaVisiblePara(a, sesion("VENDEDOR", "PROCESO", { usuarioId: 8 }))).toBe(false);
    expect(alertaVisiblePara(a, sesion("GERENTE", "PROCESO"))).toBe(false);
    expect(alertaVisiblePara(a, sesion("ADMIN"))).toBe(true);
  });

  it("las notificaciones de un cliente solo aparecen en su portal", () => {
    const a = alerta({ giro: "PROCESO", clienteId: 3 });
    expect(alertaVisiblePara(a, sesion("CLIENTE", null, { clienteId: 3 }))).toBe(true);
    expect(alertaVisiblePara(a, sesion("CLIENTE", null, { clienteId: 4 }))).toBe(false);
    expect(alertaVisiblePara(a, sesion("ADMIN"))).toBe(false);
    expect(alertaVisiblePara(alerta(), sesion("CLIENTE", null, { clienteId: 3 }))).toBe(false);
  });

  it("cada tipo de alerta tiene una audiencia definida", () => {
    expect(AUDIENCIA_ALERTAS.PRESUPUESTO_80).toEqual(expect.arrayContaining(["GERENTE", "CONTADOR", "DIRECCION"]));
    expect(AUDIENCIA_ALERTAS.PEDIDO).toContain("VENDEDOR");
    expect(AUDIENCIA_ALERTAS.INVENTARIO_BAJO).not.toContain("VENDEDOR");
  });
});

describe("filtro de alertas para la base de datos", () => {
  it("al cliente solo le devuelve sus notificaciones", () => {
    expect(filtroAlertas(sesion("CLIENTE", null, { clienteId: 3 }))).toEqual({ clienteId: 3 });
  });

  it("al administrador le devuelve todo lo interno", () => {
    expect(filtroAlertas(sesion("ADMIN"))).toEqual({ clienteId: null });
  });

  it("al personal de un giro lo limita a su giro, su rol y lo dirigido a él", () => {
    expect(filtroAlertas(sesion("OPERADOR", "PROCESO", { usuarioId: 5 }))).toEqual({
      clienteId: null,
      OR: [
        { usuarioId: 5 },
        { usuarioId: null, giro: "PROCESO", OR: [{ rolesDestino: { isEmpty: true } }, { rolesDestino: { has: "OPERADOR" } }] },
      ],
    });
  });
});

describe("enlace de cada alerta a su módulo", () => {
  it("resuelve las referencias que no requieren consultar la base", () => {
    expect(enlaceDeReferencia("presupuesto:PROCESO:2026-11")?.href).toBe("/finanzas");
    expect(enlaceDeReferencia("pedido:12")?.href).toBe("/ventas?tab=pedidos");
    expect(enlaceDeReferencia("reunion:4")?.href).toBe("/ventas?tab=reuniones");
    expect(enlaceDeReferencia("mensaje:3")?.href).toBe("/ventas/mensajes/3");
    expect(enlaceDeReferencia("recordatorio:contrato:8:2026-11-10")?.href).toBe("/maquinaria?tab=alquileres");
    expect(enlaceDeReferencia("recordatorio:hito:5-31:2026-11-10")?.href).toBe("/construccion/5");
    expect(enlaceDeReferencia("recordatorio:solicitud:2:2026-11-10")?.href).toBe("/flujo");
  });

  it("devuelve null para referencias desconocidas o vacías", () => {
    expect(enlaceDeReferencia(null)).toBeNull();
    expect(enlaceDeReferencia("otra:1")).toBeNull();
  });
});
