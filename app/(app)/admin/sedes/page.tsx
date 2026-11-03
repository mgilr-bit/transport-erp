import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { GIROS, TIPOS_SEDE } from "@/lib/constants";
import type { GiroNegocio } from "@/app/generated/prisma/client";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Icono } from "@/components/layout/icono";
import { AlternarSede, NuevaSede } from "./formularios";

export const metadata: Metadata = { title: "Sedes" };

const ORDEN: GiroNegocio[] = ["CORPORATIVO", "EXTRACCION", "PROCESO", "MAQUINARIA", "TRANSPORTE_MP", "TRANSPORTE_PROD", "CONSTRUCCION"];

export default async function SedesPage() {
  await requireAdmin();
  const sedes = await prisma.sede.findMany({
    include: { _count: { select: { usuarios: true, camiones: true, maquinas: true, gastos: true } } },
    orderBy: { nombre: "asc" },
  });

  return (
    <>
      <PageHeader
        titulo="Sedes"
        descripcion="Oficina central en el Edificio Sixtino (Z10) y las oficinas administrativas de cada giro de negocio."
        acciones={<NuevaSede />}
      />
      <div className="space-y-6">
        {ORDEN.map((giro) => {
          const grupo = sedes.filter((s) => s.giro === giro);
          if (!grupo.length) return null;
          return (
            <Card key={giro}>
              <CardHeader
                title={GIROS[giro].nombre}
                description={`${grupo.length} sede${grupo.length === 1 ? "" : "s"}`}
                action={<span className="grid size-7 place-items-center rounded-lg text-white" style={{ background: GIROS[giro].color }}><Icono nombre={GIROS[giro].icono} className="size-3.5" /></span>}
              />
              <Table>
                <thead><tr><Th>Código</Th><Th>Sede</Th><Th>Tipo</Th><Th>Ubicación</Th><Th className="text-right">Personal</Th><Th className="text-right">Activos</Th><Th>Estado</Th><Th /></tr></thead>
                <tbody>
                  {grupo.map((s) => (
                    <Tr key={s.id} className={s.activa ? undefined : "opacity-60"}>
                      <Td className="font-mono text-xs font-medium text-slate-900">{s.codigo}</Td>
                      <Td><p className="font-medium text-slate-900">{s.nombre}</p><p className="text-xs text-slate-500">{s.telefono ?? "Sin teléfono"}</p></Td>
                      <Td className="text-xs">{TIPOS_SEDE[s.tipo].nombre}</Td>
                      <Td className="max-w-64 text-xs"><p>{s.direccion}</p><p className="text-slate-500">{s.departamento} · <span className="font-mono">{s.latitud.toFixed(4)}, {s.longitud.toFixed(4)}</span></p></Td>
                      <Td className="text-right">{s._count.usuarios}</Td>
                      <Td className="text-right text-xs">{s._count.camiones ? `${s._count.camiones} camiones` : s._count.maquinas ? `${s._count.maquinas} máquinas` : "—"}</Td>
                      <Td>{s.activa ? <Badge tono="verde">Activa</Badge> : <Badge>Inactiva</Badge>}</Td>
                      <Td className="text-right">{s.tipo !== "OFICINA_CENTRAL" && <AlternarSede id={s.id} activa={s.activa} />}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          );
        })}
      </div>
    </>
  );
}
