import type { GiroNegocio } from "@/app/generated/prisma/client";
import type { SessionPayload } from "@/lib/session";
import { esCorporativo } from "@/lib/auth-rules";

export type ItemNav = { href: string; label: string; icono: string; giros?: GiroNegocio[]; soloAdmin?: boolean };

export const NAVEGACION: { seccion: string; items: ItemNav[] }[] = [
  {
    seccion: "General",
    items: [{ href: "/dashboard", label: "Panel general", icono: "LayoutDashboard" }],
  },
  {
    seccion: "Operaciones",
    items: [
      { href: "/extraccion", label: "Extracción minera", icono: "Pickaxe", giros: ["EXTRACCION"] },
      { href: "/proceso", label: "Plantas de proceso", icono: "Factory", giros: ["PROCESO"] },
      { href: "/flujo", label: "Flujo de materia prima", icono: "Workflow", giros: ["PROCESO", "EXTRACCION", "TRANSPORTE_MP"] },
      { href: "/maquinaria", label: "Maquinaria", icono: "Tractor", giros: ["MAQUINARIA"] },
      { href: "/transporte", label: "Transporte", icono: "Truck", giros: ["TRANSPORTE_MP", "TRANSPORTE_PROD"] },
      { href: "/construccion", label: "Construcción", icono: "HardHat", giros: ["CONSTRUCCION"] },
    ],
  },
  {
    seccion: "Control",
    items: [
      { href: "/gps", label: "Monitoreo GPS", icono: "MapPinned", giros: ["MAQUINARIA", "TRANSPORTE_MP", "TRANSPORTE_PROD"] },
      { href: "/alertas", label: "Centro de alertas", icono: "BellRing" },
      { href: "/finanzas", label: "Presupuesto y gastos", icono: "Wallet" },
    ],
  },
  {
    seccion: "Administración",
    items: [
      { href: "/admin/usuarios", label: "Usuarios", icono: "Users", soloAdmin: true },
      { href: "/admin/sedes", label: "Sedes", icono: "Building2", soloAdmin: true },
      { href: "/admin/bitacora", label: "Bitácora", icono: "ScrollText", soloAdmin: true },
    ],
  },
];

export function navegacionPara(session: SessionPayload) {
  return NAVEGACION.map((s) => ({
    ...s,
    items: s.items.filter((i) => {
      if (i.soloAdmin) return session.rol === "ADMIN";
      if (!i.giros || esCorporativo(session)) return true;
      return session.giro ? i.giros.includes(session.giro) : false;
    }),
  })).filter((s) => s.items.length > 0);
}
