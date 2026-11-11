import { describe, expect, it } from "vitest";
import { calcularPedido, claveDia, diasHasta, elegirVendedor, transicionPedido } from "@/lib/reglas";

describe("cálculo de pedidos", () => {
  const precios = new Map([
    [1, 95.5],
    [2, 12],
  ]);

  it("calcula subtotales y total con el precio de catálogo", () => {
    const r = calcularPedido([{ productoId: 1, cantidad: 10 }, { productoId: 2, cantidad: 2.5 }], precios);
    expect(r.lineas).toEqual([
      { productoId: 1, cantidad: 10, precioUnitario: 95.5, subtotal: 955 },
      { productoId: 2, cantidad: 2.5, precioUnitario: 12, subtotal: 30 },
    ]);
    expect(r.total).toBe(985);
  });

  it("agrupa el mismo producto en una sola línea", () => {
    const r = calcularPedido([{ productoId: 2, cantidad: 1 }, { productoId: 2, cantidad: 4 }], precios);
    expect(r.lineas).toEqual([{ productoId: 2, cantidad: 5, precioUnitario: 12, subtotal: 60 }]);
  });

  it("rechaza pedidos vacíos, cantidades no positivas y productos desconocidos", () => {
    expect(() => calcularPedido([], precios)).toThrow(/no tiene productos/);
    expect(() => calcularPedido([{ productoId: 1, cantidad: 0 }], precios)).toThrow(/mayores a 0/);
    expect(() => calcularPedido([{ productoId: 9, cantidad: 1 }], precios)).toThrow(/no está disponible/);
  });
});

describe("estados de un pedido", () => {
  it("avanza de solicitado a entregado en orden", () => {
    expect(transicionPedido("SOLICITADO", "confirmar")).toBe("CONFIRMADO");
    expect(transicionPedido("CONFIRMADO", "preparar")).toBe("EN_PREPARACION");
    expect(transicionPedido("EN_PREPARACION", "despachar")).toBe("DESPACHADO");
    expect(transicionPedido("DESPACHADO", "entregar")).toBe("ENTREGADO");
  });

  it("no permite saltar pasos ni reabrir pedidos cerrados", () => {
    expect(() => transicionPedido("SOLICITADO", "despachar")).toThrow();
    expect(() => transicionPedido("ENTREGADO", "cancelar")).toThrow();
    expect(() => transicionPedido("CANCELADO", "confirmar")).toThrow();
  });

  it("la empresa cancela hasta la preparación; el cliente, solo lo que no se ha confirmado", () => {
    expect(transicionPedido("EN_PREPARACION", "cancelar")).toBe("CANCELADO");
    expect(() => transicionPedido("DESPACHADO", "cancelar")).toThrow();
    expect(transicionPedido("SOLICITADO", "cancelar", true)).toBe("CANCELADO");
    expect(() => transicionPedido("CONFIRMADO", "cancelar", true)).toThrow();
    expect(() => transicionPedido("SOLICITADO", "confirmar", true)).toThrow();
  });
});

describe("asignación de vendedor", () => {
  const candidatos = [
    { id: 4, pendientes: 3 },
    { id: 7, pendientes: 1 },
    { id: 2, pendientes: 1 },
  ];

  it("respeta al vendedor del cliente si atiende el giro", () => {
    expect(elegirVendedor(candidatos, 4)).toBe(4);
  });

  it("si no, asigna al vendedor con menos reuniones pendientes (y desempata por antigüedad)", () => {
    expect(elegirVendedor(candidatos, 99)).toBe(2);
    expect(elegirVendedor(candidatos)).toBe(2);
  });

  it("sin vendedores en el giro no asigna a nadie", () => {
    expect(elegirVendedor([], 4)).toBeNull();
  });
});

describe("fechas para recordatorios (hora de Guatemala)", () => {
  it("usa el día calendario de Guatemala, no el de UTC", () => {
    expect(claveDia(new Date("2026-11-11T03:00:00Z"))).toBe("2026-11-10");
    expect(claveDia(new Date("2026-11-11T07:00:00Z"))).toBe("2026-11-11");
  });

  it("cuenta días calendario hasta una fecha (negativo si ya pasó)", () => {
    const ahora = new Date("2026-11-10T15:00:00Z");
    expect(diasHasta(new Date("2026-11-10T23:00:00Z"), ahora)).toBe(0);
    expect(diasHasta(new Date("2026-11-12T01:00:00Z"), ahora)).toBe(1);
    expect(diasHasta(new Date("2026-11-13T16:00:00Z"), ahora)).toBe(3);
    expect(diasHasta(new Date("2026-11-08T12:00:00Z"), ahora)).toBe(-2);
  });
});
