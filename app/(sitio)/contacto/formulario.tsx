"use client";

import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { solicitarReunionPublicaAction } from "@/app/actions/sitio";

export function FormularioContacto({
  giros,
  giroInicial,
  contacto,
  fechas,
}: {
  giros: { valor: string; texto: string }[];
  giroInicial?: string;
  contacto?: { nombre: string; email: string };
  /** Valores datetime-local en hora de Guatemala: sugerida y mínima. */
  fechas: { sugerida: string; minima: string };
}) {
  return (
    <ActionForm action={solicitarReunionPublicaAction}>
      {/* Campo trampa para bots: oculto a las personas */}
      <div aria-hidden className="absolute -left-[9999px]">
        <label>Sitio web <input name="sitio_web" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" name="contacto"><Input name="contacto" autoComplete="name" defaultValue={contacto?.nombre} /></Field>
        <Field label="Empresa" name="empresa"><Input name="empresa" autoComplete="organization" /></Field>
        <Field label="Correo" name="email"><Input name="email" type="email" autoComplete="email" defaultValue={contacto?.email} /></Field>
        <Field label="Teléfono" name="telefono"><Input name="telefono" type="tel" autoComplete="tel" /></Field>
        <Field label="Giro de interés" name="giro">
          <Select name="giro" defaultValue={giroInicial ?? ""}>
            <option value="" disabled>Seleccione…</option>
            {giros.map((g) => <option key={g.valor} value={g.valor}>{g.texto}</option>)}
          </Select>
        </Field>
        <Field label="Modalidad" name="modalidad">
          <Select name="modalidad" defaultValue="VIDEOCONFERENCIA">
            <option value="VIDEOCONFERENCIA">Videoconferencia</option>
            <option value="PRESENCIAL">Presencial en el Edificio Sixtino</option>
          </Select>
        </Field>
        <Field label="Fecha y hora preferida" name="fecha" className="sm:col-span-2">
          <Input name="fecha" type="datetime-local" defaultValue={fechas.sugerida} min={fechas.minima} />
        </Field>
        <Field label="¿En qué le podemos ayudar?" name="motivo" className="sm:col-span-2">
          <Textarea name="motivo" rows={4} placeholder="Ejemplo: cotizar el alquiler de dos excavadoras por 45 días para una obra en Escuintla." />
        </Field>
      </div>
      <SubmitButton>Solicitar reunión</SubmitButton>
    </ActionForm>
  );
}
