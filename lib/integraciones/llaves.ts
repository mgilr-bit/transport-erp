import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Llaves de API para sistemas de terceros. La llave completa se muestra una sola vez;
 * la base guarda su prefijo (para buscarla) y el hash SHA-256 (para verificarla).
 */
export function generarLlave() {
  return `tp_${randomBytes(24).toString("base64url")}`;
}

export function formatoLlaveValido(llave: string) {
  return /^tp_[A-Za-z0-9_-]{32}$/.test(llave);
}

export function prefijoDe(llave: string) {
  return llave.slice(0, 11);
}

export function hashLlave(llave: string) {
  return createHash("sha256").update(llave).digest("hex");
}

export function llaveCoincide(llave: string, hash: string) {
  const a = Buffer.from(hashLlave(llave), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
