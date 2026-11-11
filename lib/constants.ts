import type {
  CanalPedido,
  CategoriaGasto,
  EstadoPedido,
  EstadoReunion,
  GiroNegocio,
  ModalidadReunion,
  ModalidadViaje,
  Rol,
  TipoAlerta,
  TipoObra,
  TipoSede,
} from "@/app/generated/prisma/client";

export const GIROS: Record<
  GiroNegocio,
  { nombre: string; corto: string; ruta: string; color: string; icono: string }
> = {
  EXTRACCION: { nombre: "Extracción Minera", corto: "Extracción", ruta: "/extraccion", color: "#b45309", icono: "Pickaxe" },
  PROCESO: { nombre: "Plantas de Proceso", corto: "Proceso", ruta: "/proceso", color: "#7c3aed", icono: "Factory" },
  MAQUINARIA: { nombre: "Venta y Alquiler de Maquinaria", corto: "Maquinaria", ruta: "/maquinaria", color: "#ca8a04", icono: "Tractor" },
  TRANSPORTE_MP: { nombre: "Transporte de Materia Prima", corto: "Transp. MP", ruta: "/transporte?tipo=MATERIA_PRIMA", color: "#0891b2", icono: "Truck" },
  TRANSPORTE_PROD: { nombre: "Transporte de Productos", corto: "Transp. Productos", ruta: "/transporte?tipo=PRODUCTO", color: "#2563eb", icono: "Container" },
  CONSTRUCCION: { nombre: "Servicios de Construcción", corto: "Construcción", ruta: "/construccion", color: "#dc2626", icono: "HardHat" },
  CORPORATIVO: { nombre: "Corporativo (Sede Z10)", corto: "Corporativo", ruta: "/dashboard", color: "#475569", icono: "Building2" },
};

export const GIROS_OPERATIVOS: GiroNegocio[] = [
  "EXTRACCION",
  "PROCESO",
  "MAQUINARIA",
  "TRANSPORTE_MP",
  "TRANSPORTE_PROD",
  "CONSTRUCCION",
];

export const ROLES: Record<Rol, string> = {
  ADMIN: "Administrador general",
  GERENTE: "Gerente de giro",
  CONTADOR: "Contabilidad",
  OPERADOR: "Operador de sede",
  VENDEDOR: "Vendedor",
  CLIENTE: "Cliente (portal)",
  DIRECCION: "Dirección (dueños)",
};

export const CATEGORIAS_GASTO: Record<CategoriaGasto, string> = {
  PLANILLA: "Planilla",
  COMBUSTIBLE: "Combustible",
  MANTENIMIENTO: "Mantenimiento",
  MATERIALES: "Materiales",
  ARRENDAMIENTO: "Arrendamiento",
  SERVICIOS: "Servicios",
  GPS: "Servicio GPS",
  OTROS: "Otros",
};

export const MODALIDADES: Record<ModalidadViaje, string> = {
  NACIONAL: "Nacional",
  INTER_PUERTOS: "Inter puertos",
  INTER_FRONTERAS: "Inter fronteras",
  PUERTO_A_BODEGA: "Puerto → Bodega",
  BODEGA_A_PUERTO: "Bodega → Puerto",
};

export const TIPOS_OBRA: Record<TipoObra, string> = {
  PUENTE: "Puente",
  CARRETERA: "Carretera",
  EDIFICIO: "Edificio",
  OTRO: "Otro",
};

/** Roles del giro que reciben cada tipo de alerta (el administrador ve todas). */
export const AUDIENCIA_ALERTAS: Record<TipoAlerta, Rol[]> = {
  EXCESO_VELOCIDAD: ["GERENTE", "OPERADOR", "DIRECCION"],
  USO_EXCESIVO: ["GERENTE", "OPERADOR"],
  SIN_SENAL: ["GERENTE", "OPERADOR"],
  PRESUPUESTO_80: ["GERENTE", "CONTADOR", "DIRECCION"],
  PRESUPUESTO_100: ["GERENTE", "CONTADOR", "DIRECCION"],
  INVENTARIO_BAJO: ["GERENTE", "OPERADOR"],
  PEDIDO: ["VENDEDOR", "GERENTE", "OPERADOR"],
  REUNION: ["VENDEDOR", "GERENTE"],
  MENSAJE: ["VENDEDOR", "GERENTE"],
  RECORDATORIO: ["GERENTE", "OPERADOR"],
};

export const TIPOS_ALERTA: Record<TipoAlerta, string> = {
  EXCESO_VELOCIDAD: "Exceso de velocidad",
  USO_EXCESIVO: "Uso continuo prolongado",
  SIN_SENAL: "Sin señal GPS",
  PRESUPUESTO_80: "Presupuesto al 80 %",
  PRESUPUESTO_100: "Presupuesto excedido",
  INVENTARIO_BAJO: "Inventario bajo",
  PEDIDO: "Pedido",
  REUNION: "Reunión",
  MENSAJE: "Mensaje de cliente",
  RECORDATORIO: "Recordatorio",
};

/** Reglas de negocio configurables */
export const REGLAS = {
  velocidadMaximaCamion: 80, // km/h — Reglamento de tránsito para vehículos pesados
  horasUsoContinuoMax: 10, // horas de motor encendido continuo antes de alertar
  minutosSinSenal: 60,
  umbralPresupuestoAdvertencia: 0.8,
};

export const TIPOS_SEDE: Record<TipoSede, { nombre: string; giros: GiroNegocio[] }> = {
  OFICINA_CENTRAL: { nombre: "Oficina central", giros: ["CORPORATIVO"] },
  MINA: { nombre: "Planta de extracción", giros: ["EXTRACCION"] },
  PLANTA_PROCESO: { nombre: "Planta de proceso", giros: ["PROCESO"] },
  SUCURSAL_MAQUINARIA: { nombre: "Sucursal de maquinaria", giros: ["MAQUINARIA"] },
  CENTRO_TRANSPORTE: { nombre: "Centro de transporte", giros: ["TRANSPORTE_MP", "TRANSPORTE_PROD"] },
  OFICINA_CONSTRUCCION: { nombre: "Oficina de construcción", giros: ["CONSTRUCCION"] },
};

// ─── Comercial ─────────────────────────────────────────────────────────────

export const SEDE_CENTRAL = "Edificio Sixtino, zona 10, Ciudad de Guatemala";

export const ESTADOS_PEDIDO: Record<EstadoPedido, string> = {
  SOLICITADO: "Solicitado",
  CONFIRMADO: "Confirmado",
  EN_PREPARACION: "En preparación",
  DESPACHADO: "Despachado",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

export const CANALES_PEDIDO: Record<CanalPedido, string> = {
  PORTAL: "Portal de clientes",
  API: "API",
  CSV: "Archivo CSV",
  INTERNO: "Pedido entre giros",
};

export const ESTADOS_REUNION: Record<EstadoReunion, string> = {
  SOLICITADA: "Solicitada",
  CONFIRMADA: "Confirmada",
  REALIZADA: "Realizada",
  CANCELADA: "Cancelada",
};

export const MODALIDADES_REUNION: Record<ModalidadReunion, string> = {
  PRESENCIAL: "Presencial (Edificio Sixtino, zona 10)",
  VIDEOCONFERENCIA: "Videoconferencia",
};

/** Eventos que un sistema externo puede recibir por webhook. */
export const EVENTOS_WEBHOOK = {
  "pedido.creado": "Un cliente registró un pedido",
  "pedido.actualizado": "Un pedido cambió de estado",
  "viaje.actualizado": "Un viaje del cliente salió o fue entregado",
  "solicitud.aprobada": "Se asignó una compra de materia prima al proveedor",
} as const;
export type EventoWebhook = keyof typeof EVENTOS_WEBHOOK;
