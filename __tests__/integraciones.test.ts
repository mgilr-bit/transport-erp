import { describe, expect, it } from "vitest";
import { firmar } from "@/lib/integraciones/firma";
import { formatoLlaveValido, generarLlave, hashLlave, llaveCoincide, prefijoDe } from "@/lib/integraciones/llaves";

describe("firma de webhooks", () => {
  it("firma el cuerpo con HMAC-SHA256 del secreto del webhook", () => {
    expect(firmar("secreto-de-prueba", '{"evento":"prueba"}')).toBe("sha256=c5683db53cc448009755edc0e0c47f621e4395bc0b764a5cf1976bc66f71e9fa");
  });
});

describe("llaves de API", () => {
  it("genera llaves con prefijo reconocible y suficiente entropía", () => {
    const a = generarLlave();
    const b = generarLlave();
    expect(formatoLlaveValido(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(prefijoDe(a)).toBe(a.slice(0, 11));
    expect(prefijoDe(a).startsWith("tp_")).toBe(true);
  });

  it("guarda solo el hash SHA-256 y lo compara sin revelar la llave", () => {
    const llave = "tp_abcdefghijklmnopqrstuvwxyz012345";
    expect(hashLlave(llave)).toBe("610ab85c98a18ddc3d39663e2aec57a87446ae02dd8a190db4db900a32aac065");
    expect(llaveCoincide(llave, hashLlave(llave))).toBe(true);
    expect(llaveCoincide("tp_abcdefghijklmnopqrstuvwxyz012346", hashLlave(llave))).toBe(false);
  });

  it("rechaza formatos ajenos", () => {
    expect(formatoLlaveValido("Bearer algo")).toBe(false);
    expect(formatoLlaveValido("tp_corta")).toBe(false);
  });
});
