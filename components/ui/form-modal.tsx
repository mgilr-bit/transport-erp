"use client";

import { Plus } from "lucide-react";
import { ActionForm, SubmitButton, type ActionState } from "@/components/ui/form";
import { Modal, ModalFooter } from "@/components/ui/modal";

/** Modal + formulario de server action con pie estándar. */
export function FormModal({
  boton,
  titulo,
  descripcion,
  action,
  enviar = "Guardar",
  variante = "primario",
  tamano = "md",
  icono = true,
  ancho,
  children,
}: {
  boton: React.ReactNode;
  titulo: string;
  descripcion?: string;
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  enviar?: string;
  variante?: "primario" | "secundario" | "fantasma";
  tamano?: "sm" | "md";
  icono?: boolean;
  ancho?: string;
  children: React.ReactNode;
}) {
  return (
    <Modal trigger={<>{icono && <Plus className="size-4" />}{boton}</>} titulo={titulo} descripcion={descripcion} variante={variante} tamano={tamano} ancho={ancho}>
      {(cerrar) => (
        <ActionForm action={action} onSuccess={cerrar}>
          {children}
          <ModalFooter>
            <button type="button" onClick={cerrar} className="px-3 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
            <SubmitButton>{enviar}</SubmitButton>
          </ModalFooter>
        </ActionForm>
      )}
    </Modal>
  );
}
