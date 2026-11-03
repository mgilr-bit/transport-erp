"use client";

import { createContext, useActionState, useContext, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClass } from "@/components/ui/button";

export type ActionState = { ok: boolean; mensaje?: string; errores?: Record<string, string[] | undefined> };
type Accion = (prev: ActionState, formData: FormData) => Promise<ActionState>;

// Los campos leen sus errores de validación desde el formulario contenedor
const Ctx = createContext<ActionState["errores"]>(undefined);

export function ActionForm({
  action,
  children,
  onSuccess,
  className,
  resetOnSuccess = true,
}: {
  action: Accion;
  children: React.ReactNode;
  onSuccess?: () => void;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, { ok: false });
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
  }, [state, onSuccess, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={cn("space-y-4", className)} noValidate>
      {state.mensaje && (
        <div
          role={state.ok ? "status" : "alert"}
          className={cn(
            "flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm",
            state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700",
          )}
        >
          {state.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
          {state.mensaje}
        </div>
      )}
      <Ctx.Provider value={state.errores}>{children}</Ctx.Provider>
    </form>
  );
}

const controlClass =
  "block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-500 aria-invalid:ring-red-400";

export function Field({
  label,
  name,
  hint,
  children,
  className,
}: {
  label: string;
  name: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const errores = useContext(Ctx);
  const error = errores?.[name]?.[0];
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

function useInvalid(name?: string) {
  const errores = useContext(Ctx);
  return name && errores?.[name] ? { "aria-invalid": true, "aria-describedby": `${name}-error` } : {};
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input id={props.name} className={cn(controlClass, "h-9", className)} {...useInvalid(props.name)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select id={props.name} className={cn(controlClass, "h-9 pr-8", className)} {...useInvalid(props.name)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea id={props.name} rows={3} className={cn(controlClass, className)} {...useInvalid(props.name)} {...props} />;
}

export function SubmitButton({ children, variante = "primario" }: { children: React.ReactNode; variante?: "primario" | "peligro" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variante)}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
