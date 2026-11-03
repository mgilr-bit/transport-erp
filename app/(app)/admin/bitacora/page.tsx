import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatFecha } from "@/lib/utils";
import type { Prisma } from "@/app/generated/prisma/client";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Filtro } from "@/components/ui/filtro";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge, type Tono } from "@/components/ui/badge";
import { POR_PAGINA, Paginacion, paginaDe } from "@/components/ui/paginacion";

export const metadata: Metadata = { title: "Bitácora" };

/** Color de la acción según su verbo, para escanear la bitácora rápidamente. */
function tonoAccion(accion: string): Tono {
  if (/^(CANCELAR|RECHAZAR|ALTERNAR|LIBERAR|PAUSAR)/.test(accion)) return "ambar";
  if (/^(CREAR|REGISTRAR|PROGRAMAR|SOLICITAR|AGREGAR|DEFINIR)/.test(accion)) return "azul";
  if (/^(APROBAR|ENTREGAR|COMPLETAR|FINALIZAR|VENDER)/.test(accion)) return "verde";
  if (accion === "INICIO_SESION") return "gris";
  return "violeta";
}

export default async function BitacoraPage({ searchParams }: PageProps<"/admin/bitacora">) {
  await requireAdmin();
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const usuario = str(sp.usuario);
  const entidad = str(sp.entidad);
  const pagina = paginaDe(sp.pagina);

  const where: Prisma.BitacoraWhereInput = { ...(usuario ? { usuarioId: Number(usuario) } : {}), ...(entidad ? { entidad } : {}) };
  const [registros, total, usuarios, entidades] = await Promise.all([
    prisma.bitacora.findMany({ where, include: { usuario: { select: { nombre: true, email: true } } }, orderBy: { createdAt: "desc" }, skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA }),
    prisma.bitacora.count({ where }),
    prisma.usuario.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.bitacora.findMany({ distinct: ["entidad"], select: { entidad: true }, orderBy: { entidad: "asc" } }),
  ]);

  return (
    <>
      <PageHeader titulo="Bitácora" descripcion="Registro de auditoría de todas las operaciones realizadas en el sistema: quién hizo qué y cuándo." />
      <Card>
        <div className="flex flex-wrap gap-4 border-b border-slate-100 px-4 py-3">
          <Filtro param="usuario" etiqueta="Usuario" opciones={usuarios.map((u) => ({ valor: String(u.id), texto: u.nombre }))} />
          <Filtro param="entidad" etiqueta="Entidad" todos="Todas" opciones={entidades.map((e) => ({ valor: e.entidad, texto: e.entidad }))} />
        </div>
        <Table>
          <thead><tr><Th>Fecha y hora</Th><Th>Usuario</Th><Th>Acción</Th><Th>Entidad</Th><Th>Detalle</Th></tr></thead>
          <tbody>
            {registros.map((r) => (
              <Tr key={r.id}>
                <Td className="text-xs whitespace-nowrap">{formatFecha(r.createdAt, true)}</Td>
                <Td>{r.usuario ? <><p className="text-sm text-slate-900">{r.usuario.nombre}</p><p className="text-xs text-slate-500">{r.usuario.email}</p></> : <span className="text-xs text-slate-400">Sistema</span>}</Td>
                <Td><Badge tono={tonoAccion(r.accion)}>{r.accion.replaceAll("_", " ").toLowerCase()}</Badge></Td>
                <Td className="text-xs">{r.entidad}</Td>
                <Td className="max-w-md text-xs text-slate-600">{r.detalle ?? "—"}</Td>
              </Tr>
            ))}
            {!registros.length && <EmptyRow cols={5} />}
          </tbody>
        </Table>
        <Paginacion total={total} pagina={pagina} base="/admin/bitacora" params={{ usuario, entidad }} />
      </Card>
    </>
  );
}
