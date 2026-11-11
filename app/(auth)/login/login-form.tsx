"use client";

import { ActionForm, Field, Input, SubmitButton } from "@/components/ui/form";
import { login } from "@/app/actions/auth";

export function LoginForm({ siguiente }: { siguiente?: string }) {
  return (
    <ActionForm action={login} className="mt-8" resetOnSuccess={false}>
      {siguiente && <input type="hidden" name="next" value={siguiente} />}
      <Field label="Correo electrónico" name="email">
        <Input name="email" type="email" autoComplete="email" placeholder="usuario@transport.gt" required />
      </Field>
      <Field label="Contraseña" name="password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <div className="pt-2 [&>button]:w-full">
        <SubmitButton>Ingresar</SubmitButton>
      </div>
    </ActionForm>
  );
}
