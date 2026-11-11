import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireCliente } from "@/lib/auth";
import { GIROS, SEDE_CENTRAL } from "@/lib/constants";
import { PAGINAS_GIRO } from "@/lib/sitio";
import { entradaFechaHoraGT, fechaGT, formatFecha } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { EstadoBadge } from "@/components/ui/badge";
import { CancelarReunion, SolicitarReunion } from "../formularios";

export const metadata: Metadata = { title: "Reuniones" };

export default async function ReunionesPortalPage() {
  const { clienteId } = await requireCliente();
  const reuniones = await prisma.reunion.findMany({ where: { clienteId }, include: { vendedor: { select: { nombre: true } } }, orderBy: { fecha: "desc" }, take: 50 });

  return (
    <>
      <PageHeader titulo="Reuniones" descripcion={`Presenciales en el ${SEDE_CENTRAL}, o por videoconferencia con el enlace que le enviamos al confirmar.`} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <Table>
            <thead><tr><Th>Reunión</Th><Th>Empresa</Th><Th>Fecha</Th><Th>Asesor</Th><Th>Estado</Th><Th /></tr></thead>
            <tbody>
              {reuniones.map((r) => (
                <Tr key={r.id}>
                  <Td className="max-w-64"><p className="font-mono text-xs text-slate-900">{r.codigo}</p><p className="truncate text-xs text-slate-600">{r.motivo}</p></Td>
                  <Td className="text-xs">{GIROS[r.giro].corto}</Td>
                  <Td className="text-xs whitespace-nowrap">
                    <p>{formatFecha(r.fecha, true)}</p>
                    <p className="text-slate-500">{r.modalidad === "PRESENCIAL" ? "Presencial" : "Videoconferencia"}</p>
                    {r.enlace && r.estado === "CONFIRMADA" && <a href={r.enlace} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Unirse</a>}
                  </Td>
                  <Td className="text-xs">{r.vendedor?.nombre ?? "Por asignar"}</Td>
                  <Td><EstadoBadge estado={r.estado} /></Td>
                  <Td className="text-right">{(r.estado === "SOLICITADA" || r.estado === "CONFIRMADA") && <CancelarReunion id={r.id} codigo={r.codigo} />}</Td>
                </Tr>
              ))}
              {!reuniones.length && <EmptyRow cols={6}>Aún no tiene reuniones</EmptyRow>}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHeader title="Solicitar reunión" description="La asignamos a un asesor de la empresa que elija." />
          <CardBody>
            <SolicitarReunion
              giros={PAGINAS_GIRO.map((p) => ({ valor: p.giro, texto: p.titulo }))}
              fechas={{ sugerida: entradaFechaHoraGT(fechaGT(1, 10)), minima: entradaFechaHoraGT(new Date()) }}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
