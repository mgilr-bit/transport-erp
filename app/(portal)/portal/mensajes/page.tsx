import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireCliente } from "@/lib/auth";
import { marcarConversacionLeida } from "@/lib/services/comercial";
import { cn, formatFecha } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EnviarMensaje } from "../formularios";

export const metadata: Metadata = { title: "Mensajes" };

export default async function MensajesPortalPage() {
  const { clienteId } = await requireCliente();
  const [cliente, mensajes] = await Promise.all([
    prisma.cliente.findUniqueOrThrow({ where: { id: clienteId }, include: { vendedor: { select: { nombre: true } } } }),
    prisma.mensaje.findMany({ where: { clienteId }, include: { autor: { select: { nombre: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  await Promise.all([
    marcarConversacionLeida(clienteId, "cliente"),
    prisma.alerta.updateMany({ where: { clienteId, tipo: "MENSAJE", leida: false }, data: { leida: true } }),
  ]);

  return (
    <>
      <PageHeader titulo="Mensajes" descripcion={cliente.vendedor ? `Conversación con ${cliente.vendedor.nombre}, su vendedor asignado.` : "Conversación con la sede central de TransPort."} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardBody>
            <ol className="flex flex-col-reverse gap-3">
              {mensajes.map((m) => (
                <li key={m.id} className={cn("max-w-[80%] rounded-xl px-4 py-2.5", m.deCliente ? "self-end bg-brand-50" : "self-start bg-slate-100")}>
                  <p className="text-sm whitespace-pre-line text-slate-900">{m.texto}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{m.deCliente ? "Usted" : m.autor.nombre} · {formatFecha(m.createdAt, true)}</p>
                </li>
              ))}
              {!mensajes.length && <li className="py-10 text-center text-sm text-slate-400">Escríbanos su consulta; le respondemos aquí mismo.</li>}
            </ol>
          </CardBody>
        </Card>
        <Card><CardBody><EnviarMensaje /></CardBody></Card>
      </div>
    </>
  );
}
