import { describe, expect, it } from "vitest";
import { aCSV, parseCSV, registrosCSV } from "@/lib/csv";

describe("exportación a CSV", () => {
  const columnas = [
    { titulo: "Código", valor: (f: { codigo: string }) => f.codigo },
    { titulo: "Monto", valor: (f: { monto: number | null }) => f.monto },
  ];

  it("incluye BOM para Excel, encabezado y filas separadas por CRLF", () => {
    const csv = aCSV([{ codigo: "VJ-1", monto: 1500.5 }], columnas);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1)).toBe("Código,Monto\r\nVJ-1,1500.5\r\n");
  });

  it("escapa comas, comillas y saltos de línea", () => {
    const csv = aCSV([{ codigo: 'Block 15×20, "liviano"\nsaco', monto: null }], columnas);
    expect(csv.slice(1).split("\r\n")[1]).toBe('"Block 15×20, ""liviano""\nsaco",');
  });

  it("formatea fechas en hora de Guatemala y booleanos en español", () => {
    const csv = aCSV([{ f: new Date("2026-11-10T20:30:00Z"), b: true }], [
      { titulo: "Fecha", valor: (x: { f: Date }) => x.f },
      { titulo: "Leída", valor: (x: { b: boolean }) => x.b },
    ]);
    expect(csv.slice(1).split("\r\n")[1]).toBe("2026-11-10 14:30,Sí");
  });

  it("neutraliza textos que Excel interpretaría como fórmulas", () => {
    const csv = aCSV([{ codigo: "=HYPERLINK(1)", monto: -5 }], columnas);
    expect(csv.slice(1).split("\r\n")[1]).toBe("'=HYPERLINK(1),-5");
  });
});

describe("lectura de CSV", () => {
  it("lee campos con comillas, comillas dobles escapadas y CRLF", () => {
    expect(parseCSV('codigo,nota\r\nPT-PC33,"piso, gris ""mate"""\r\n')).toEqual([
      ["codigo", "nota"],
      ["PT-PC33", 'piso, gris "mate"'],
    ]);
  });

  it("acepta BOM, separador punto y coma y omite líneas vacías", () => {
    expect(parseCSV("﻿codigo;cantidad\n\nPT-TEJ;120\n")).toEqual([
      ["codigo", "cantidad"],
      ["PT-TEJ", "120"],
    ]);
  });

  it("admite saltos de línea dentro de un campo entre comillas", () => {
    expect(parseCSV('a,b\n"x\ny",z')).toEqual([["a", "b"], ["x\ny", "z"]]);
  });

  it("convierte las filas en registros con encabezados normalizados", () => {
    expect(registrosCSV(" Código ;Cantidad\nPT-ADH;40")).toEqual([{ codigo: "PT-ADH", cantidad: "40" }]);
  });
});
