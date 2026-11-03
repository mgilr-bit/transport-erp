"use server";

import { ejecutarAccion } from "@/lib/action";
import { sincronizarGPS } from "@/lib/services/gps";

/** Consulta a GPS-Inversiones las posiciones de todos los dispositivos y evalúa alertas. */
export async function sincronizarGPSAction() {
  return ejecutarAccion({
    giros: ["MAQUINARIA", "TRANSPORTE_MP", "TRANSPORTE_PROD"],
    ejecutar: () => sincronizarGPS(),
    revalidar: ["/gps", "/alertas", "/dashboard", "/maquinaria", "/transporte"],
    exito: (r) => `${r.lecturas} de ${r.dispositivos} dispositivos reportaron · ${r.alertas} alerta${r.alertas === 1 ? "" : "s"} nueva${r.alertas === 1 ? "" : "s"}.`,
  });
}
