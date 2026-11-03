import { redirect } from "next/navigation";
import { deleteSession } from "@/lib/session";

/** Cierra la sesión de un usuario desactivado y lo lleva al inicio de sesión. */
export async function GET() {
  await deleteSession();
  redirect("/login?motivo=inactivo");
}
