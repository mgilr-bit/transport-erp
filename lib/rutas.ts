import type { Rol } from "@/app/generated/prisma/client";

/** Rutas sin sesión: sitio web, inicio de sesión, PWA y APIs con autenticación propia (llave, token o secreto). */
const RUTAS_EXACTAS = ["/", "/manifest.webmanifest", "/sw.js"];
const SECCIONES_PUBLICAS = ["/giros", "/productos", "/contacto", "/login", "/offline", "/icons", "/api/v1", "/api/cron", "/api/gps/lecturas"];

/** Compara segmentos completos: `/giros` incluye `/giros/proceso`, pero no `/girosx`. */
function enSeccion(ruta: string, seccion: string) {
  const camino = ruta.split(/[?#]/)[0];
  return camino === seccion || camino.startsWith(`${seccion}/`);
}

export function esRutaPublica(pathname: string) {
  return RUTAS_EXACTAS.includes(pathname) || SECCIONES_PUBLICAS.some((s) => enSeccion(pathname, s));
}

export function inicioSegunRol(rol: Rol | string | undefined) {
  return rol === "CLIENTE" ? "/portal" : "/dashboard";
}

/**
 * Ruta a la que vuelve el usuario al iniciar sesión. Solo acepta rutas internas del
 * área que le corresponde (portal para clientes, sistema para el personal).
 */
export function destinoTrasLogin(rol: Rol | string, siguiente: string | null | undefined) {
  const inicio = inicioSegunRol(rol);
  if (!siguiente || !siguiente.startsWith("/") || siguiente.startsWith("//") || enSeccion(siguiente, "/login")) return inicio;
  const esPortal = enSeccion(siguiente, "/portal");
  return (rol === "CLIENTE") === esPortal ? siguiente : inicio;
}
