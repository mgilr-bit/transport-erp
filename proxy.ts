import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLICAS = ["/login"];
const clave = new TextEncoder().encode(process.env.SESSION_SECRET);

/** Verificación optimista de sesión: la autorización por giro se hace en cada página. */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("transport_session")?.value;
  let valida = false;
  if (token) {
    try {
      await jwtVerify(token, clave, { algorithms: ["HS256"] });
      valida = true;
    } catch {
      valida = false;
    }
  }

  const publica = PUBLICAS.some((p) => pathname.startsWith(p));
  if (!valida && !publica) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (valida && (publica || pathname === "/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/gps/lecturas|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico)$).*)"],
};
