import type { GiroNegocio } from "@/app/generated/prisma/client";

/** Contenido del sitio público: una página por giro de negocio. */
export type PaginaGiro = {
  slug: string;
  giro: GiroNegocio;
  titulo: string;
  lema: string;
  descripcion: string;
  servicios: string[];
};

export const PAGINAS_GIRO: PaginaGiro[] = [
  {
    slug: "extraccion",
    giro: "EXTRACCION",
    titulo: "Extracción minera",
    lema: "Materia prima de nuestras propias minas",
    descripcion:
      "Plantas de extracción en Cobán, El Progreso, Quetzaltenango y Petén que abastecen a nuestras plantas de proceso y a la industria de la construcción del país.",
    servicios: [
      "Arcilla, arena sílica, piedra caliza, caolín, feldespato, grava, basalto y yeso",
      "Venta por tonelada a plantas propias y de terceros",
      "Abastecimiento programado según la fecha que necesita su planta",
      "Traslado con nuestra flota de transporte de materia prima",
    ],
  },
  {
    slug: "proceso",
    giro: "PROCESO",
    titulo: "Plantas de proceso",
    lema: "Pisos cerámicos y materiales de construcción",
    descripcion:
      "En Zacapa, Huehuetenango y Petén transformamos la materia prima de nuestras minas en pisos cerámicos, porcelanato, azulejo, block, ladrillo, teja y otros materiales de construcción.",
    servicios: [
      "Pisos cerámicos, porcelanato y azulejo para interiores y exteriores",
      "Block, ladrillo, teja, cal y adhesivo para obra gris",
      "Pedidos en línea desde el portal de clientes o por integración con su sistema",
      "Entrega en obra o bodega con nuestra flota de transporte de productos",
    ],
  },
  {
    slug: "maquinaria",
    giro: "MAQUINARIA",
    titulo: "Venta y alquiler de maquinaria",
    lema: "Equipo pesado listo para su obra",
    descripcion:
      "Sucursales en Guatemala, Xela, Zacapa y Petén con maquinaria de construcción para alquiler o venta. Cada equipo está monitoreado por GPS.",
    servicios: [
      "Alquiler por día, con 5 % de descuento desde 7 días y 10 % desde 30 días",
      "Venta de equipo con historial de horas de uso",
      "Mantenimiento programado de toda la flota",
      "Ubicación y horas de uso del equipo alquilado registradas por GPS",
    ],
  },
  {
    slug: "transporte-materia-prima",
    giro: "TRANSPORTE_MP",
    titulo: "Transporte de materia prima",
    lema: "Flete pesado para la industria",
    descripcion:
      "Desde Sanarate transportamos materia prima para Cemex, Cementos Progreso, Hispacensa y nuestras propias plantas, con unidades monitoreadas por GPS.",
    servicios: [
      "Volteo y góndola para agregados y minerales",
      "Tarifa por kilómetro y por tonelada transportada",
      "Monitoreo de velocidad y recorrido de cada unidad",
      "Seguimiento de sus viajes desde el portal de clientes o por API",
    ],
  },
  {
    slug: "transporte-productos",
    giro: "TRANSPORTE_PROD",
    titulo: "Transporte de productos",
    lema: "Puertos, fronteras y bodegas",
    descripcion:
      "Desde Puerto Quetzal y Santo Tomás de Castilla movemos carga de empresas nacionales y extranjeras: inter puertos, inter fronteras, de puerto a bodega y de bodega a puerto.",
    servicios: [
      "Contenedores de 20 y 40 pies y carga general",
      "Rutas inter puertos e inter fronteras",
      "Entregas de puerto a bodega y de bodega a puerto",
      "Seguimiento de cada viaje desde el portal y notificaciones al salir y al entregar",
    ],
  },
  {
    slug: "construccion",
    giro: "CONSTRUCCION",
    titulo: "Servicios de construcción",
    lema: "Puentes, carreteras y edificios",
    descripcion:
      "Ejecutamos obra pública y privada con maquinaria y materiales del propio grupo, con control del avance por hitos y de los costos de cada obra.",
    servicios: [
      "Puentes vehiculares y peatonales",
      "Pavimentación y mantenimiento de carreteras",
      "Edificios comerciales e industriales",
      "Avance de su obra visible en el portal de clientes",
    ],
  },
];

export const paginaDeGiro = (slug: string) => PAGINAS_GIRO.find((p) => p.slug === slug);
export const slugDeGiro = (giro: GiroNegocio) => PAGINAS_GIRO.find((p) => p.giro === giro)?.slug;
