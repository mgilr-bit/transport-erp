"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing } from "lucide-react";
import { eliminarSuscripcionAction, guardarSuscripcionAction } from "@/app/actions/push";

const CLAVE_PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function aUint8Array(base64: string) {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const bruto = window.atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
}

/** Activa o desactiva las notificaciones push en este dispositivo. No aparece si el push no está configurado. */
export function BotonNotificaciones() {
  // En el servidor no hay navigator: se resuelve al montar (ambos estados no muestran nada)
  const [estado, setEstado] = useState<"cargando" | "no-soportado" | "inactivo" | "activo">(() =>
    typeof window !== "undefined" && (!CLAVE_PUBLICA || !("serviceWorker" in navigator) || !("PushManager" in window)) ? "no-soportado" : "cargando",
  );

  useEffect(() => {
    if (estado !== "cargando") return;
    navigator.serviceWorker.ready
      .then((r) => r.pushManager.getSubscription())
      .then((s) => setEstado(s ? "activo" : "inactivo"))
      .catch(() => setEstado("no-soportado"));
  }, [estado]);

  if (estado === "cargando" || estado === "no-soportado") return null;

  async function alternar() {
    const registro = await navigator.serviceWorker.ready;
    const actual = await registro.pushManager.getSubscription();
    if (actual) {
      await actual.unsubscribe();
      await eliminarSuscripcionAction(actual.endpoint);
      setEstado("inactivo");
      return;
    }
    if ((await Notification.requestPermission()) !== "granted") return;
    const nueva = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aUint8Array(CLAVE_PUBLICA!) });
    const r = await guardarSuscripcionAction(JSON.parse(JSON.stringify(nueva)));
    setEstado(r.ok ? "activo" : "inactivo");
  }

  const activo = estado === "activo";
  return (
    <button
      type="button"
      onClick={alternar}
      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      aria-label={activo ? "Desactivar notificaciones en este dispositivo" : "Activar notificaciones en este dispositivo"}
      title={activo ? "Notificaciones activas en este dispositivo" : "Activar notificaciones"}
    >
      {activo ? <BellRing className="size-4.5 text-brand-600" /> : <BellOff className="size-4.5" />}
    </button>
  );
}
