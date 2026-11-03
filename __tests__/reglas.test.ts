import { describe, expect, it } from "vitest";
import {
  avanceEsperado, calcularAlquiler, calcularAvance, calcularRequerimientos, calcularTarifaViaje, distanciaKm,
  estaRezagada, evaluarLecturaGPS, evaluarPresupuesto, horasCruzadas, rangosSeSolapan, umbralCruzado, validarCapacidad,
} from "@/lib/reglas";

const d = (s: string) => new Date(s);
const h = (base: Date, horas: number) => new Date(base.getTime() + horas * 3_600_000);

describe("presupuesto", () => {
  it("clasifica la ejecución en normal, advertencia (80 %) y excedido (100 %)", () => {
    expect(evaluarPresupuesto(1000, 500).nivel).toBe("NORMAL");
    expect(evaluarPresupuesto(1000, 800).nivel).toBe("ADVERTENCIA");
    expect(evaluarPresupuesto(1000, 1000).nivel).toBe("EXCEDIDO");
    expect(evaluarPresupuesto(1000, 1200).disponible).toBe(-200);
  });

  it("sin presupuesto asignado, cualquier gasto cuenta como excedido", () => {
    expect(evaluarPresupuesto(0, 0)).toMatchObject({ porcentaje: 0, nivel: "NORMAL" });
    expect(evaluarPresupuesto(0, 50).nivel).toBe("EXCEDIDO");
  });

  it("detecta el umbral solo cuando se cruza, para no repetir alertas", () => {
    expect(umbralCruzado(1000, 700, 850)).toBe("PRESUPUESTO_80");
    expect(umbralCruzado(1000, 900, 1050)).toBe("PRESUPUESTO_100");
    expect(umbralCruzado(1000, 500, 1100)).toBe("PRESUPUESTO_100");
    expect(umbralCruzado(1000, 850, 900)).toBeNull();
    expect(umbralCruzado(1000, 1100, 1200)).toBeNull();
    expect(umbralCruzado(0, 0, 500)).toBeNull();
  });
});

describe("alquiler de maquinaria", () => {
  it("cobra por día calendario, contando el primero", () => {
    expect(calcularAlquiler(1000, d("2026-03-01T00:00"), d("2026-03-01T00:00"))).toMatchObject({ dias: 1, total: 1000 });
    expect(calcularAlquiler(1000, d("2026-03-01T00:00"), d("2026-03-03T00:00"))).toMatchObject({ dias: 3, total: 3000 });
  });

  it("aplica 5 % desde 7 días y 10 % desde 30 días", () => {
    expect(calcularAlquiler(1000, d("2026-03-01T00:00"), d("2026-03-07T00:00"))).toMatchObject({ dias: 7, descuento: 0.05, total: 6650 });
    expect(calcularAlquiler(1000, d("2026-03-01T00:00"), d("2026-03-30T00:00"))).toMatchObject({ dias: 30, descuento: 0.1, total: 27000 });
  });

  it("rechaza un periodo invertido", () => {
    expect(() => calcularAlquiler(1000, d("2026-03-05"), d("2026-03-01"))).toThrow();
  });

  it("detecta contratos que se cruzan, incluidos los que comparten un día", () => {
    expect(rangosSeSolapan(d("2026-03-01"), d("2026-03-10"), d("2026-03-10"), d("2026-03-20"))).toBe(true);
    expect(rangosSeSolapan(d("2026-03-01"), d("2026-03-10"), d("2026-03-11"), d("2026-03-20"))).toBe(false);
  });
});

describe("transporte", () => {
  it("calcula el flete por km y tonelada-km con recargo por modalidad", () => {
    // 100 km × Q12 + 100 km × 10 t × Q0.85 = Q2,050
    expect(calcularTarifaViaje(100, 10, "NACIONAL")).toBe(2050);
    expect(calcularTarifaViaje(100, 10, "INTER_FRONTERAS")).toBe(2767.5);
  });

  it("valida que la carga quepa en el camión", () => {
    expect(validarCapacidad(14, 14)).toBe(true);
    expect(validarCapacidad(14, 14.5)).toBe(false);
    expect(validarCapacidad(14, 0)).toBe(false);
  });
});

describe("producción", () => {
  it("calcula los insumos de una orden y reporta faltantes", () => {
    const receta = [
      { materialId: 1, nombre: "Arcilla", cantidadPorUnidad: 0.02 },
      { materialId: 2, nombre: "Feldespato", cantidadPorUnidad: 0.005 },
    ];
    const r = calcularRequerimientos(1000, receta, new Map([[1, 25], [2, 3]]));
    expect(r.requerimientos.map((x) => x.requerido)).toEqual([20, 5]);
    expect(r.factible).toBe(false);
    expect(r.faltantes).toEqual([{ materialId: 2, nombre: "Feldespato", requerido: 5, disponible: 3 }]);
  });
});

describe("monitoreo GPS", () => {
  const t0 = d("2026-10-12T06:00:00Z");

  it("alerta exceso de velocidad solo en camiones", () => {
    const lectura = { velocidad: 95, motorEncendido: true, timestamp: t0 };
    expect(evaluarLecturaGPS(lectura, [], true).excesoVelocidad).toBe(true);
    expect(evaluarLecturaGPS(lectura, [], false).excesoVelocidad).toBe(false);
    expect(evaluarLecturaGPS({ ...lectura, velocidad: 80 }, [], true).excesoVelocidad).toBe(false);
  });

  it("mide el uso continuo del motor y lo reinicia al apagarse", () => {
    const encendido = (horas: number) => ({ velocidad: 40, motorEncendido: true, timestamp: h(t0, horas) });
    const continuo = evaluarLecturaGPS(encendido(11), [encendido(0), encendido(5), encendido(10)], true);
    expect(continuo.horasUsoContinuo).toBe(11);
    expect(continuo.usoExcesivo).toBe(true);

    const conPausa = evaluarLecturaGPS(encendido(11), [encendido(0), { ...encendido(5), motorEncendido: false }, encendido(6)], true);
    expect(conPausa.horasUsoContinuo).toBe(5);
    expect(conPausa.usoExcesivo).toBe(false);
  });

  it("calcula distancias con Haversine (Ciudad de Guatemala → Antigua ≈ 25 km)", () => {
    const km = distanciaKm(14.6349, -90.5069, 14.5586, -90.7295);
    expect(km).toBeGreaterThan(24);
    expect(km).toBeLessThan(27);
    expect(distanciaKm(14.6, -90.5, 14.6, -90.5)).toBe(0);
  });

  it("acumula horas de uso exactas aunque las lecturas sean cada 15 minutos", () => {
    // Antes se sumaba Math.round(0.25) = 0 en cada lectura y las horas nunca subían
    let total = 0;
    for (let i = 1; i <= 12; i++) total += horasCruzadas(h(t0, (i - 1) * 0.25), h(t0, i * 0.25));
    expect(total).toBe(3);
    expect(horasCruzadas(h(t0, 2), h(t0, 1))).toBe(0);
  });
});

describe("construcción", () => {
  it("pondera el avance por el peso de los hitos completados", () => {
    expect(calcularAvance([])).toBe(0);
    expect(calcularAvance([{ peso: 30, completado: true }, { peso: 70, completado: false }])).toBe(30);
    expect(calcularAvance([{ peso: 1, completado: true }, { peso: 2, completado: true }])).toBe(100);
  });

  it("estima el avance esperado según el plazo y detecta obras rezagadas", () => {
    const inicio = d("2026-01-01");
    const fin = d("2026-12-31");
    expect(avanceEsperado(inicio, fin, d("2025-12-01"))).toBe(0);
    expect(avanceEsperado(inicio, fin, d("2027-02-01"))).toBe(100);
    expect(avanceEsperado(inicio, fin, d("2026-07-02"))).toBeCloseTo(50, 0);
    expect(estaRezagada(30, 50)).toBe(true);
    expect(estaRezagada(40, 50)).toBe(false);
  });
});
