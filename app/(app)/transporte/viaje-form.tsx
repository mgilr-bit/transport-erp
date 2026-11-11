"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/ui/form";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { crearViaje } from "@/app/actions/transporte";
import { MODALIDADES } from "@/lib/constants";
import { entradaFechaHoraGT } from "@/lib/utils";

type Opcion = { id: number; texto: string };
type Camion = Opcion & { tipo: "MATERIA_PRIMA" | "PRODUCTO"; capacidad: number };
type Solicitud = Opcion & { origen: string; destino: string; carga: string; toneladas?: number };

export function NuevoViaje({
  tipos,
  camiones,
  pilotos,
  clientes,
  solicitudes,
  pedidos = [],
}: {
  tipos: ("MATERIA_PRIMA" | "PRODUCTO")[];
  camiones: Camion[];
  pilotos: Opcion[];
  clientes: Opcion[];
  solicitudes: Solicitud[];
  pedidos?: Solicitud[];
}) {
  const [tipo, setTipo] = useState(tipos[0]);
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [pedido, setPedido] = useState<Solicitud | null>(null);
  const precarga = solicitud ?? pedido;
  const hoy = entradaFechaHoraGT(new Date());

  return (
    <Modal trigger={<><Plus className="size-4" /> Programar viaje</>} titulo="Programar viaje" descripcion="La tarifa se calcula según distancia, carga y modalidad." ancho="max-w-2xl">
      {(cerrar) => (
        <ActionForm action={crearViaje} onSuccess={cerrar}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de transporte" name="tipo">
              <Select name="tipo" value={tipo} onChange={(e) => { setTipo(e.target.value as typeof tipo); setSolicitud(null); setPedido(null); }}>
                {tipos.map((t) => <option key={t} value={t}>{t === "MATERIA_PRIMA" ? "Materia prima" : "Productos"}</option>)}
              </Select>
            </Field>
            <Field label="Modalidad" name="modalidad">
              <Select name="modalidad" defaultValue="NACIONAL">
                {Object.entries(MODALIDADES)
                  .filter(([k]) => tipo === "PRODUCTO" || k === "NACIONAL")
                  .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            {tipo === "MATERIA_PRIMA" && solicitudes.length > 0 && (
              <Field label="Atiende solicitud de planta (opcional)" name="solicitudId" className="sm:col-span-2" hint="Al entregar, el inventario se mueve automáticamente de la mina a la planta.">
                <Select name="solicitudId" defaultValue="" onChange={(e) => setSolicitud(solicitudes.find((s) => s.id === Number(e.target.value)) ?? null)}>
                  <option value="">— Viaje para cliente externo —</option>
                  {solicitudes.map((s) => <option key={s.id} value={s.id}>{s.texto}</option>)}
                </Select>
              </Field>
            )}
            {tipo === "PRODUCTO" && pedidos.length > 0 && (
              <Field label="Despacha pedido de Plantas de proceso (opcional)" name="pedidoId" className="sm:col-span-2" hint="Al iniciar el viaje el pedido queda despachado y al entregarlo, entregado.">
                <Select name="pedidoId" defaultValue="" onChange={(e) => setPedido(pedidos.find((p) => p.id === Number(e.target.value)) ?? null)}>
                  <option value="">— Viaje sin pedido —</option>
                  {pedidos.map((p) => <option key={p.id} value={p.id}>{p.texto}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Camión" name="camionId">
              <Select name="camionId" defaultValue="">
                <option value="" disabled>Seleccione…</option>
                {camiones.filter((c) => c.tipo === tipo).map((c) => <option key={c.id} value={c.id}>{c.texto}</option>)}
              </Select>
            </Field>
            <Field label="Piloto" name="pilotoId">
              <Select name="pilotoId" defaultValue="">
                <option value="" disabled>Seleccione…</option>
                {pilotos.map((p) => <option key={p.id} value={p.id}>{p.texto}</option>)}
              </Select>
            </Field>
            {!precarga && (
              <Field label="Cliente" name="clienteId" className="sm:col-span-2">
                <Select name="clienteId" defaultValue="">
                  <option value="">— Interno —</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.texto}</option>)}
                </Select>
              </Field>
            )}
            {/* key fuerza a reiniciar los valores al elegir otra solicitud */}
            <div key={solicitud ? `s${solicitud.id}` : pedido ? `p${pedido.id}` : "libre"} className="contents">
              <Field label="Origen" name="origen"><Input name="origen" defaultValue={precarga?.origen} placeholder="Puerto Quetzal" /></Field>
              <Field label="Destino" name="destino"><Input name="destino" defaultValue={precarga?.destino} placeholder="Bodega Zona 12" /></Field>
              <Field label="Carga" name="carga"><Input name="carga" defaultValue={precarga?.carga} placeholder="Contenedor 40'" /></Field>
              <Field label="Toneladas" name="toneladas"><Input name="toneladas" type="number" step="0.01" min="0" defaultValue={precarga?.toneladas} /></Field>
            </div>
            <Field label="Distancia (km)" name="distanciaKm"><Input name="distanciaKm" type="number" min="1" /></Field>
            <Field label="Fecha y hora de salida" name="fechaSalida"><Input name="fechaSalida" type="datetime-local" defaultValue={hoy} /></Field>
          </div>
          <ModalFooter>
            <button type="button" onClick={cerrar} className="px-3 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
            <SubmitButton>Programar viaje</SubmitButton>
          </ModalFooter>
        </ActionForm>
      )}
    </Modal>
  );
}
