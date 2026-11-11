import { getUsuarioActual } from "@/lib/auth";
import { REPORTES } from "@/lib/services/reportes";

/** Descarga de reportes en CSV, con los permisos y el alcance del usuario que la pide. */
export async function GET(request: Request, ctx: RouteContext<"/api/reportes/[tipo]">) {
  const { tipo } = await ctx.params;
  if (!Object.hasOwn(REPORTES, tipo)) return Response.json({ error: "Reporte inexistente" }, { status: 404 });
  const session = await getUsuarioActual();
  if (!session) return Response.json({ error: "Inicie sesión" }, { status: 401 });
  const reporte = REPORTES[tipo];
  if (!reporte.permitido(session)) return Response.json({ error: "No tiene acceso a este reporte" }, { status: 403 });

  const { archivo, csv } = await reporte.generar(session, new URL(request.url).searchParams);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${archivo}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
