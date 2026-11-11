import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { esRutaPublica, inicioSegunRol } from "@/lib/rutas";

const clave = new TextEncoder().encode(process.env.SESSION_SECRET);

/** Verificación optimista de sesión: la autorización por rol y giro se hace en cada página. */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get("transport_session")?.value;
  let valida = false;
  let rol: string | undefined;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, clave, { algorithms: ["HS256"] });
      valida = true;
      rol = typeof payload.rol === "string" ? payload.rol : undefined;
    } catch {
      valida = false;
    }
  }

  if (!valida && !esRutaPublica(pathname)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  // Con sesión, el login lleva directo al área de cada usuario
  if (valida && pathname === "/login") {
    return NextResponse.redirect(new URL(inicioSegunRol(rol), request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico)$).*)"],
};
