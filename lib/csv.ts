/**
 * Intercambio de archivos CSV: exportación de reportes e importación de pedidos.
 * El formato es compatible con Excel en español (BOM UTF-8, coma como separador y punto decimal).
 */

export type ColumnaCSV<T> = { titulo: string; valor: (fila: T) => string | number | boolean | Date | null | undefined };

const fechaGT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Guatemala",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatearFecha(fecha: Date) {
  const p = Object.fromEntries(fechaGT.formatToParts(fecha).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

function celda(valor: string | number | boolean | Date | null | undefined) {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : "";
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  let texto = valor instanceof Date ? formatearFecha(valor) : valor;
  // Evita que Excel ejecute un texto como fórmula (inyección CSV)
  if (!(valor instanceof Date) && /^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[",;\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function aCSV<T>(filas: T[], columnas: ColumnaCSV<T>[]) {
  const lineas = [columnas.map((c) => celda(c.titulo)).join(","), ...filas.map((f) => columnas.map((c) => celda(c.valor(f))).join(","))];
  return `﻿${lineas.join("\r\n")}\r\n`;
}

/** Detecta el separador (coma o punto y coma) contando en la primera línea fuera de comillas. */
function separadorDe(texto: string) {
  let comas = 0;
  let puntoComa = 0;
  let enComillas = false;
  for (const c of texto) {
    if (c === '"') enComillas = !enComillas;
    else if (!enComillas && (c === "\n" || c === "\r")) break;
    else if (!enComillas && c === ",") comas++;
    else if (!enComillas && c === ";") puntoComa++;
  }
  return puntoComa > comas ? ";" : ",";
}

/** Lee un CSV (RFC 4180) y devuelve sus filas, sin las líneas vacías. */
export function parseCSV(entrada: string): string[][] {
  const texto = entrada.replace(/^﻿/, "");
  const sep = separadorDe(texto);
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let enComillas = false;

  const cerrarFila = () => {
    fila.push(campo);
    if (fila.some((v) => v.trim() !== "")) filas.push(fila);
    fila = [];
    campo = "";
  };

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') enComillas = false;
      else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === sep) {
      fila.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      cerrarFila();
    } else campo += c;
  }
  if (campo !== "" || fila.length) cerrarFila();
  return filas;
}

/** Normaliza un encabezado: minúsculas, sin tildes ni espacios. */
const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, "_");

/** Convierte un CSV con encabezado en una lista de registros. */
export function registrosCSV(texto: string): Record<string, string>[] {
  const [encabezado, ...filas] = parseCSV(texto);
  if (!encabezado) return [];
  const claves = encabezado.map(normalizar);
  return filas.map((f) => Object.fromEntries(claves.map((k, i) => [k, (f[i] ?? "").trim()])));
}
