import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { GIROS, ROLES } from "@/lib/constants";
import { formatFecha } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlternarUsuario, NuevoUsuario, RestablecerPassword } from "./formularios";

export const metadata: Metadata = { title: "Usuarios" };

const TONO_ROL = { ADMIN: "violeta", DIRECCION: "violeta", CONTADOR: "azul", GERENTE: "verde", VENDEDOR: "ambar", OPERADOR: "gris", CLIENTE: "gris" } as const;

export default async function UsuariosPage() {
  const session = await requireAdmin();
  const [usuarios, sedes] = await Promise.all([
    prisma.usuario.findMany({ include: { sede: { select: { nombre: true } }, _count: { select: { bitacora: true } } }, orderBy: [{ activo: "desc" }, { rol: "asc" }, { nombre: "asc" }] }),
    prisma.sede.findMany({ where: { activa: true }, select: { id: true, nombre: true, giro: true }, orderBy: { nombre: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        titulo="Usuarios"
        descripcion="Cuentas del personal de la sede central y de cada giro de negocio. El rol y el giro determinan qué módulos ve y opera cada persona."
        acciones={<NuevoUsuario sedes={sedes.map((s) => ({ id: s.id, texto: s.nombre, giro: s.giro }))} />}
      />
      <Card>
        <Table>
          <thead><tr><Th>Nombre</Th><Th>Rol</Th><Th>Giro</Th><Th>Sede</Th><Th>Último acceso</Th><Th className="text-right">Acciones registradas</Th><Th>Estado</Th><Th /></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <Tr key={u.id} className={u.activo ? undefined : "opacity-60"}>
                <Td><p className="font-medium text-slate-900">{u.nombre}{u.id === session.usuarioId && <span className="ml-2 text-xs font-normal text-slate-400">(usted)</span>}</p><p className="text-xs text-slate-500">{u.email}</p></Td>
                <Td><Badge tono={TONO_ROL[u.rol]}>{ROLES[u.rol]}</Badge></Td>
                <Td className="text-xs">{u.giro ? <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: GIROS[u.giro].color }} />{GIROS[u.giro].corto}</span> : <span className="text-slate-500">Corporativo</span>}</Td>
                <Td className="text-xs">{u.sede?.nombre ?? "—"}</Td>
                <Td className="text-xs whitespace-nowrap">{u.ultimoAcceso ? formatFecha(u.ultimoAcceso, true) : "Nunca"}</Td>
                <Td className="text-right">{u._count.bitacora}</Td>
                <Td>{u.activo ? <Badge tono="verde">Activo</Badge> : <Badge>Inactivo</Badge>}</Td>
                <Td>
                  <div className="flex justify-end gap-1.5">
                    <RestablecerPassword id={u.id} nombre={u.nombre} />
                    {u.id !== session.usuarioId && <AlternarUsuario id={u.id} activo={u.activo} />}
                  </div>
                </Td>
              </Tr>
            ))}
            {!usuarios.length && <EmptyRow cols={8} />}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
