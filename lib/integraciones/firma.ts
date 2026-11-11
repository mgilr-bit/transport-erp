import { createHmac } from "node:crypto";

/** Firma de un webhook saliente: el receptor la recalcula con su secreto para verificar el origen. */
export function firmar(secreto: string, cuerpo: string) {
  return `sha256=${createHmac("sha256", secreto).update(cuerpo).digest("hex")}`;
}
