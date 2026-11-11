import { describe, expect, it } from "vitest";
import { destinoTrasLogin, esRutaPublica, inicioSegunRol } from "@/lib/rutas";

describe("rutas públicas", () => {
  it("el sitio web, el login y los recursos de la PWA no exigen sesión", () => {
    for (const ruta of ["/", "/giros/proceso", "/productos", "/contacto", "/login", "/offline", "/manifest.webmanifest", "/sw.js", "/icons/icon-192.png"]) {
      expect(esRutaPublica(ruta), ruta).toBe(true);
    }
  });

  it("las APIs con autenticación propia no pasan por la sesión", () => {
    expect(esRutaPublica("/api/v1/pedidos")).toBe(true);
    expect(esRutaPublica("/api/cron/recordatorios")).toBe(true);
    expect(esRutaPublica("/api/gps/lecturas")).toBe(true);
  });

  it("el sistema interno, el portal y los reportes exigen sesión", () => {
    for (const ruta of ["/dashboard", "/portal", "/portal/pedidos", "/ventas", "/api/reportes/gastos", "/admin/usuarios"]) {
      expect(esRutaPublica(ruta), ruta).toBe(false);
    }
  });

  it("compara segmentos completos, no prefijos de texto", () => {
    expect(esRutaPublica("/girosx")).toBe(false);
    expect(esRutaPublica("/productos-internos")).toBe(false);
    expect(esRutaPublica("/api/v10")).toBe(false);
  });

  it("cada rol inicia en su área", () => {
    expect(inicioSegunRol("CLIENTE")).toBe("/portal");
    expect(inicioSegunRol("VENDEDOR")).toBe("/dashboard");
    expect(inicioSegunRol(undefined)).toBe("/dashboard");
  });
});

describe("destino después de iniciar sesión", () => {
  it("respeta la ruta solicitada si pertenece al área del usuario", () => {
    expect(destinoTrasLogin("CLIENTE", "/portal/pedidos/nuevo?producto=3")).toBe("/portal/pedidos/nuevo?producto=3");
    expect(destinoTrasLogin("GERENTE", "/finanzas")).toBe("/finanzas");
  });

  it("ignora rutas de otra área, externas o inválidas", () => {
    expect(destinoTrasLogin("CLIENTE", "/dashboard")).toBe("/portal");
    expect(destinoTrasLogin("ADMIN", "/portal")).toBe("/dashboard");
    expect(destinoTrasLogin("ADMIN", "//evil.example.com")).toBe("/dashboard");
    expect(destinoTrasLogin("ADMIN", "https://evil.example.com")).toBe("/dashboard");
    expect(destinoTrasLogin("ADMIN", "/login")).toBe("/dashboard");
    expect(destinoTrasLogin("ADMIN", null)).toBe("/dashboard");
  });
});
