import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { puedeVerComercial, requireSession } from "@/lib/auth";
import { marcarConversacionLeida } from "@/lib/services/comercial";
import { cn, formatFecha } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ResponderCliente } from "../../formularios";

export const metadata: Metadata = { title: "Mensajes con cliente" };

export default async function ConversacionPage({ params }: PageProps<"/ventas/mensajes/[clienteId]">) {
  const session = await requireSession();
  if (!puedeVerComercial(session)) redirect("/sin-acceso");
  const id = Number((await params).clienteId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const cliente = await prisma.cliente.findUnique({ where: { id }, include: { vendedor: { select: { nombre: true } } } });
  if (!cliente) notFound();
  // Un vendedor solo atiende su cartera
  if (session.rol === "VENDEDOR" && cliente.vendedorId !== session.usuarioId) redirect("/sin-acceso");
  const puedeResponder = session.rol === "ADMIN" || session.rol === "GERENTE" || (session.rol === "VENDEDOR" && cliente.vendedorId === session.usuarioId);

  const mensajes = await prisma.mensaje.findMany({
    where: { clienteId: id },
    include: { autor: { select: { nombre: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  if (puedeResponder) await marcarConversacionLeida(id, "empresa");

  return (
    <>
      <Link href="/ventas?tab=mensajes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" aria-hidden /> Mensajes
      </Link>
      <PageHeader titulo={cliente.nombre} descripcion={`Conversación del portal de clientes · Vendedor: ${cliente.vendedor?.nombre ?? "sin asignar"}`} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardBody>
            <ol className="flex flex-col-reverse gap-3">
              {mensajes.map((m) => (
                <li key={m.id} className={cn("max-w-[80%] rounded-xl px-4 py-2.5", m.deCliente ? "self-start bg-slate-100" : "self-end bg-brand-50")}>
                  <p className="text-sm whitespace-pre-line text-slate-900">{m.texto}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{m.autor.nombre} · {formatFecha(m.createdAt, true)}</p>
                </li>
              ))}
              {!mensajes.length && <li className="py-10 text-center text-sm text-slate-400">Aún no hay mensajes con este cliente.</li>}
            </ol>
          </CardBody>
        </Card>
        {puedeResponder && (
          <Card>
            <CardBody><ResponderCliente clienteId={id} /></CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
