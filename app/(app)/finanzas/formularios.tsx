"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/form";
import { FormModal } from "@/components/ui/form-modal";
import { definirPresupuestoAction, registrarGastoAction } from "@/app/actions/finanzas";
import { CATEGORIAS_GASTO } from "@/lib/constants";
import { evaluarPresupuesto, umbralCruzado } from "@/lib/reglas";
import { cn, formatPct, formatQ } from "@/lib/utils";

type GiroOpcion = { valor: string; texto: string; presupuesto: number; ejecutado: number };
type Sede = { id: number; texto: string; giro: string };

export function NuevoGasto({ giros, sedes, periodo }: { giros: GiroOpcion[]; sedes: Sede[]; periodo: { anio: number; mes: number } }) {
  const [giro, setGiro] = useState(giros[0]?.valor ?? "");
  const [monto, setMonto] = useState("");
  const enPeriodo = (() => {
    const hoy = new Date();
    return hoy.getFullYear() === periodo.anio && hoy.getMonth() + 1 === periodo.mes;
  })();
  const [fecha, setFecha] = useState(
    enPeriodo ? new Date().toISOString().slice(0, 10) : `${periodo.anio}-${String(periodo.mes).padStart(2, "0")}-01`,
  );

  const g = giros.find((x) => x.valor === giro);
  const valor = Number(monto) || 0;
  const mismoPeriodo = fecha.startsWith(`${periodo.anio}-${String(periodo.mes).padStart(2, "0")}`);
  const impacto = g && valor > 0 && mismoPeriodo ? evaluarPresupuesto(g.presupuesto, g.ejecutado + valor) : null;
  const cruza = g && impacto ? umbralCruzado(g.presupuesto, g.ejecutado, g.ejecutado + valor) : null;

  return (
    <FormModal boton="Registrar gasto" titulo="Registrar gasto" descripcion="Se descuenta del presupuesto mensual del giro." action={registrarGastoAction} enviar="Registrar gasto" ancho="max-w-xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Giro de negocio" name="giro">
          <Select name="giro" value={giro} onChange={(e) => setGiro(e.target.value)}>
            {giros.map((x) => <option key={x.valor} value={x.valor}>{x.texto}</option>)}
          </Select>
        </Field>
        <Field label="Sede" name="sedeId">
          <Select name="sedeId" key={giro} defaultValue="">
            <option value="">— General del giro —</option>
            {sedes.filter((s) => s.giro === giro).map((s) => <option key={s.id} value={s.id}>{s.texto}</option>)}
          </Select>
        </Field>
        <Field label="Categoría" name="categoria">
          <Select name="categoria" defaultValue="OTROS">{Object.entries(CATEGORIAS_GASTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        </Field>
        <Field label="Monto (Q)" name="monto"><Input name="monto" type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
        <Field label="Descripción" name="descripcion" className="sm:col-span-2"><Input name="descripcion" placeholder="Compra de repuestos" /></Field>
        <Field label="Fecha" name="fecha"><Input name="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
        <Field label="No. de documento" name="documento" hint="Factura o recibo (opcional)"><Input name="documento" /></Field>
      </div>
      {g && impacto && (
        <div aria-live="polite" className={cn("rounded-lg px-4 py-3 text-sm", cruza ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-700")}>
          <p className="flex items-center gap-2 font-medium">
            {cruza && <AlertTriangle className="size-4 shrink-0" aria-hidden />}
            Tras este gasto: {formatPct(impacto.porcentaje)} del presupuesto de {g.texto}
          </p>
          <p className="mt-0.5 text-xs">
            {g.presupuesto > 0 ? `Quedarían ${formatQ(impacto.disponible)} disponibles de ${formatQ(g.presupuesto)}.` : "El giro no tiene presupuesto asignado este mes."}
            {cruza && ` Se generará una alerta (${cruza === "PRESUPUESTO_100" ? "presupuesto excedido" : "umbral del 80 %"}).`}
          </p>
        </div>
      )}
    </FormModal>
  );
}

export function DefinirPresupuesto({ giros, periodo, nombrePeriodo }: { giros: GiroOpcion[]; periodo: { anio: number; mes: number }; nombrePeriodo: string }) {
  return (
    <FormModal boton="Asignar presupuesto" titulo={`Presupuesto de ${nombrePeriodo}`} descripcion="Deje en blanco los giros que no desea modificar." action={definirPresupuestoAction} enviar="Guardar presupuesto" variante="secundario" ancho="max-w-xl">
      <input type="hidden" name="anio" value={periodo.anio} />
      <input type="hidden" name="mes" value={periodo.mes} />
      <div className="divide-y divide-slate-100">
        {giros.map((g) => (
          <div key={g.valor} className="grid grid-cols-[1fr_auto] items-center gap-4 py-2.5">
            <div>
              <label htmlFor={g.valor} className="text-sm font-medium text-slate-800">{g.texto}</label>
              <p className="text-xs text-slate-500">Ejecutado {formatQ(g.ejecutado)}</p>
            </div>
            <Field label="" name={g.valor} className="w-44 [&>label]:hidden">
              <Input name={g.valor} type="number" min="0" step="1000" defaultValue={g.presupuesto || ""} placeholder="Sin asignar" className="text-right" />
            </Field>
          </div>
        ))}
      </div>
    </FormModal>
  );
}
