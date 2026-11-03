import { describe, expect, it } from "vitest";
import { SimuladorGPSInversiones } from "@/lib/gps/proveedor";

/** Generador pseudoaleatorio con semilla para pruebas reproducibles (mulberry32). */
function semilla(s: number) {
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const flota = Array.from({ length: 200 }, (_, i) => ({ imei: String(i), latitud: 14.6, longitud: -90.5, motorEncendido: true, esCamion: i % 2 === 0 }));
const ahora = new Date("2026-10-12T12:00:00Z");

describe("simulador de GPS-Inversiones", () => {
  it("reporta todos los dispositivos cuando hay cobertura total", async () => {
    const lecturas = await new SimuladorGPSInversiones(semilla(1), 0).obtenerPosiciones(flota, ahora);
    expect(lecturas).toHaveLength(flota.length);
    expect(lecturas.every((l) => l.timestamp === ahora)).toBe(true);
  });

  it("simula pérdida de señal en una fracción de los dispositivos", async () => {
    const lecturas = await new SimuladorGPSInversiones(semilla(2), 0.1).obtenerPosiciones(flota, ahora);
    expect(lecturas.length).toBeLessThan(flota.length);
    expect(lecturas.length).toBeGreaterThan(flota.length * 0.75);
  });

  it("mantiene las posiciones dentro de Guatemala y velocidades coherentes", async () => {
    const lecturas = await new SimuladorGPSInversiones(semilla(3), 0).obtenerPosiciones(flota, ahora);
    for (const l of lecturas) {
      expect(l.latitud).toBeGreaterThanOrEqual(13.7);
      expect(l.latitud).toBeLessThanOrEqual(17.8);
      if (!l.motorEncendido) expect(l.velocidad).toBe(0);
      // La maquinaria se mueve lento dentro de la obra
      if (Number(l.imei) % 2 === 1) expect(l.velocidad).toBeLessThanOrEqual(15);
    }
  });
});
