import type { MetadataRoute } from "next";

/** Manifest de la PWA: instala TransPort en iOS, Android y escritorio. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TransPort ERP",
    short_name: "TransPort",
    description: "Sistema integrado de TransPort: operaciones de cada giro, portal de clientes, alertas y monitoreo GPS.",
    lang: "es-GT",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Panel general", url: "/dashboard" },
      { name: "Centro de alertas", url: "/alertas" },
      { name: "Portal de clientes", url: "/portal" },
    ],
  };
}
