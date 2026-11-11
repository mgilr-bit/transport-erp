import type { Metadata } from "next";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { EVENTOS_WEBHOOK } from "@/lib/constants";
import { formatFecha } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AccionesWebhook, AlternarLlave, NuevaLlave, NuevoWebhook } from "./formularios";

export const metadata: Metadata = { title: "Integraciones" };

const ENDPOINTS = [
  { metodo: "GET", ruta: "/api/v1/productos", llave: "Cliente o proveedor", descripcion: "Catálogo de productos con precio de lista" },
  { metodo: "GET", ruta: "/api/v1/pedidos", llave: "Cliente", descripcion: "Pedidos del cliente; filtro ?estado=" },
  { metodo: "POST", ruta: "/api/v1/pedidos", llave: "Cliente", descripcion: "Crea un pedido (productos por código)" },
  { metodo: "GET", ruta: "/api/v1/pedidos/{codigo}", llave: "Cliente", descripcion: "Estado y detalle de un pedido" },
  { metodo: "DELETE", ruta: "/api/v1/pedidos/{codigo}", llave: "Cliente", descripcion: "Cancela un pedido aún no confirmado" },
  { metodo: "GET", ruta: "/api/v1/viajes", llave: "Cliente", descripcion: "Seguimiento de los viajes del cliente; filtro ?estado=" },
  { metodo: "GET", ruta: "/api/v1/solicitudes", llave: "Proveedor", descripcion: "Compras de materia prima asignadas al proveedor" },
  { metodo: "POST", ruta: "/api/gps/lecturas", llave: "Token GPS_WEBHOOK_TOKEN", descripcion: "Lecturas del proveedor GPS (entrante)" },
];

const Codigo = ({ children }: { children: string }) => (
  <pre className="overflow-x-auto rounded-lg bg-slate-950 px-4 py-3 font-mono text-xs leading-relaxed text-slate-100">{children}</pre>
);

export default async function IntegracionesPage({ searchParams }: PageProps<"/admin/integraciones">) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = ["llaves", "webhooks", "documentacion"].includes(String(sp.tab)) ? String(sp.tab) : "llaves";
  const h = await headers();
  const base = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  const [llaves, webhooks, clientes, proveedores] = await Promise.all([
    prisma.apiKey.findMany({ include: { cliente: { select: { nombre: true } }, proveedor: { select: { nombre: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.webhook.findMany({ include: { cliente: { select: { nombre: true } }, proveedor: { select: { nombre: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.cliente.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.proveedor.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
  ]);
  const opciones = {
    clientes: clientes.map((c) => ({ valor: `cliente:${c.id}`, texto: c.nombre })),
    proveedores: proveedores.map((p) => ({ valor: `proveedor:${p.id}`, texto: p.nombre })),
  };

  return (
    <>
      <PageHeader
        titulo="Integraciones"
        descripcion="Conexión con los sistemas de clientes y proveedores: API REST con llaves, webhooks salientes firmados e intercambio de archivos CSV."
      />
      <Tabs
        base="/admin/integraciones"
        activa={tab}
        tabs={[
          { id: "llaves", label: "Llaves de API", total: llaves.filter((l) => l.activa).length },
          { id: "webhooks", label: "Webhooks", total: webhooks.filter((w) => w.activo).length },
          { id: "documentacion", label: "Documentación" },
        ]}
      />

      {tab === "llaves" && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <Table>
              <thead><tr><Th>Nombre</Th><Th>Sistema de</Th><Th>Llave</Th><Th>Último uso</Th><Th>Estado</Th><Th /></tr></thead>
              <tbody>
                {llaves.map((l) => (
                  <Tr key={l.id}>
                    <Td className="font-medium text-slate-900">{l.nombre}<p className="text-xs font-normal text-slate-500">Creada {formatFecha(l.createdAt)}</p></Td>
                    <Td className="text-xs">{l.cliente?.nombre ?? l.proveedor?.nombre}<p className="text-slate-500">{l.clienteId ? "Cliente" : "Proveedor"}</p></Td>
                    <Td className="font-mono text-xs">{l.prefijo}…</Td>
                    <Td className="text-xs">{formatFecha(l.ultimoUso, true)}</Td>
                    <Td>{l.activa ? <Badge tono="verde">Activa</Badge> : <Badge tono="rojo">Revocada</Badge>}</Td>
                    <Td className="text-right"><AlternarLlave id={l.id} activa={l.activa} /></Td>
                  </Tr>
                ))}
                {!llaves.length && <EmptyRow cols={6}>Aún no hay llaves de API</EmptyRow>}
              </tbody>
            </Table>
          </Card>
          <Card>
            <CardHeader title="Nueva llave" description="Se muestra una sola vez; la base guarda solo su huella SHA-256." />
            <CardBody><NuevaLlave {...opciones} /></CardBody>
          </Card>
        </div>
      )}

      {tab === "webhooks" && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <Table>
              <thead><tr><Th>Receptor</Th><Th>Eventos</Th><Th>Último envío</Th><Th>Estado</Th><Th /></tr></thead>
              <tbody>
                {webhooks.map((w) => (
                  <Tr key={w.id}>
                    <Td className="max-w-64 text-xs"><p className="truncate font-mono text-slate-900">{w.url}</p><p className="text-slate-500">{w.cliente?.nombre ?? w.proveedor?.nombre}</p></Td>
                    <Td className="text-xs">{w.eventos.map((e) => <span key={e} className="mr-1 inline-block font-mono">{e}</span>)}</Td>
                    <Td className="text-xs">
                      {w.ultimoEnvio ? (
                        <>
                          <p>{formatFecha(w.ultimoEnvio, true)}</p>
                          {w.ultimoError ? <p className="text-red-600">{w.ultimoError}</p> : <p className="text-emerald-700">HTTP {w.ultimoEstado}</p>}
                        </>
                      ) : "—"}
                    </Td>
                    <Td>{w.activo ? <Badge tono="verde">Activo</Badge> : <Badge>Inactivo</Badge>}</Td>
                    <Td><AccionesWebhook id={w.id} activo={w.activo} /></Td>
                  </Tr>
                ))}
                {!webhooks.length && <EmptyRow cols={5}>Aún no hay webhooks</EmptyRow>}
              </tbody>
            </Table>
          </Card>
          <Card>
            <CardHeader title="Nuevo webhook" description="TransPort enviará un POST JSON firmado a esta URL en cada evento." />
            <CardBody><NuevoWebhook {...opciones} /></CardBody>
          </Card>
        </div>
      )}

      {tab === "documentacion" && (
        <div className="grid gap-6">
          <Card>
            <CardHeader title="API REST v1" description={`URL base: ${base}. Autenticación: Authorization: Bearer <llave> (o X-Api-Key). Respuestas en JSON; los GET aceptan ?formato=csv.`} />
            <Table>
              <thead><tr><Th>Método</Th><Th>Ruta</Th><Th>Llave</Th><Th>Descripción</Th></tr></thead>
              <tbody>
                {ENDPOINTS.map((e) => (
                  <Tr key={e.metodo + e.ruta}>
                    <Td><Badge tono={e.metodo === "GET" ? "azul" : e.metodo === "POST" ? "verde" : "rojo"}>{e.metodo}</Badge></Td>
                    <Td className="font-mono text-xs text-slate-900">{e.ruta}</Td>
                    <Td className="text-xs">{e.llave}</Td>
                    <Td className="text-xs">{e.descripcion}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Crear un pedido" description="Errores: 401 llave inválida, 403 tipo de llave, 404 no encontrado, 422 datos o reglas de negocio." />
              <CardBody>
                <Codigo>{`curl -X POST ${base}/api/v1/pedidos \\
  -H "Authorization: Bearer $LLAVE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "items": [{ "producto": "PT-PC33", "cantidad": 250 }],
    "direccionEntrega": "Bodega central, zona 12",
    "fechaRequerida": "2026-12-01"
  }'`}</Codigo>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Verificar un webhook" description="Cabeceras: X-TransPort-Evento y X-TransPort-Firma (HMAC-SHA256 del cuerpo con el secreto)." />
              <CardBody>
                <Codigo>{`// Node.js
import { createHmac, timingSafeEqual } from "node:crypto";

const esperada = "sha256=" + createHmac("sha256", SECRETO).update(cuerpo).digest("hex");
const valida = timingSafeEqual(Buffer.from(esperada), Buffer.from(req.headers["x-transport-firma"]));`}</Codigo>
                <p className="mt-3 text-xs text-slate-500">Eventos: {Object.keys(EVENTOS_WEBHOOK).join(", ")}. Cuerpo: {"{ evento, fecha, datos }"}.</p>
              </CardBody>
            </Card>
            <Card className="xl:col-span-2">
              <CardHeader title="Intercambio de archivos CSV" description="Para sistemas sin API: exportación e importación con encabezados, UTF-8 y coma o punto y coma." />
              <CardBody className="space-y-2 text-sm text-slate-600">
                <p><strong className="text-slate-900">Exportar:</strong> los reportes de cada módulo y todos los GET de la API con <span className="font-mono">?formato=csv</span>.</p>
                <p><strong className="text-slate-900">Importar pedidos:</strong> en el portal de clientes, un archivo con columnas <span className="font-mono">codigo,cantidad</span> (por ejemplo, <span className="font-mono">PT-PC33,250</span>).</p>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
