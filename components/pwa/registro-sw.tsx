"use client";

import { useEffect } from "react";

/** Registra el service worker de la PWA (página sin conexión y notificaciones push). */
export function RegistroServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        // Sin service worker la aplicación funciona igual, solo sin modo sin conexión
      });
    }
  }, []);
  return null;
}
