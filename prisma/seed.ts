/**
 * Datos de demostración de TransPort ERP.
 * Usa un generador pseudoaleatorio con semilla fija: cada ejecución produce los mismos datos.
 *   npm run seed
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma, type GiroNegocio, type CategoriaGasto } from "../app/generated/prisma/client";
import { calcularAlquiler, calcularAvance, calcularPedido, calcularTarifaViaje, evaluarLecturaGPS } from "../lib/reglas";
import { AUDIENCIA_ALERTAS, REGLAS } from "../lib/constants";
import { hashLlave, prefijoDe } from "../lib/integraciones/llaves";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// ─── Utilidades ────────────────────────────────────────────────────────────

let semilla = 20261012;
function rnd() {
  semilla |= 0;
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (min: number, max: number) => min + rnd() * (max - min);
const entero = (min: number, max: number) => Math.floor(entre(min, max + 1));
const elegir = <T,>(arr: ReadonlyArray<T>): T => arr[Math.floor(rnd() * arr.length)];
const dec = (n: number) => new Prisma.Decimal(Math.round(n * 100) / 100);
const codigo = (p: string, n: number, anio = 2026) => `${p}-${anio}-${String(n).padStart(5, "0")}`;

const AHORA = new Date();
const diasAtras = (d: number, hora = 8) => {
  const f = new Date(AHORA);
  f.setDate(f.getDate() - d);
  f.setHours(hora, entero(0, 59), 0, 0);
  return f;
};

// ─── Catálogos ─────────────────────────────────────────────────────────────

const SEDES = [
  { codigo: "CORP-Z10", nombre: "Oficina Central — Edificio Sixtino", tipo: "OFICINA_CENTRAL", giro: "CORPORATIVO", departamento: "Guatemala", direccion: "6a Avenida 6-63, Zona 10, Edificio Sixtino II, Nivel 8", lat: 14.5995, lng: -90.5115 },
  { codigo: "MIN-COB", nombre: "Planta de Extracción Cobán", tipo: "MINA", giro: "EXTRACCION", departamento: "Alta Verapaz", direccion: "Km 212 Ruta CA-14, Cobán", lat: 15.4703, lng: -90.3708 },
  { codigo: "MIN-PRO", nombre: "Planta de Extracción El Progreso", tipo: "MINA", giro: "EXTRACCION", departamento: "El Progreso", direccion: "Km 74 Ruta al Atlántico, Guastatoya", lat: 14.8536, lng: -90.0694 },
  { codigo: "MIN-XEL", nombre: "Planta de Extracción Quetzaltenango", tipo: "MINA", giro: "EXTRACCION", departamento: "Quetzaltenango", direccion: "Aldea Llano del Pinal, Quetzaltenango", lat: 14.8064, lng: -91.5452 },
  { codigo: "MIN-PET", nombre: "Planta de Extracción Petén", tipo: "MINA", giro: "EXTRACCION", departamento: "Petén", direccion: "Km 480 Ruta a Melchor de Mencos, Santa Ana", lat: 16.8067, lng: -89.8284 },
  { codigo: "PLA-ZAC", nombre: "Planta de Proceso Zacapa", tipo: "PLANTA_PROCESO", giro: "PROCESO", departamento: "Zacapa", direccion: "Km 146 Ruta CA-10, Estanzuela", lat: 14.9986, lng: -89.5711 },
  { codigo: "PLA-HUE", nombre: "Planta de Proceso Huehuetenango", tipo: "PLANTA_PROCESO", giro: "PROCESO", departamento: "Huehuetenango", direccion: "Km 264 Ruta Interamericana, Chiantla", lat: 15.3536, lng: -91.4572 },
  { codigo: "PLA-PET", nombre: "Planta de Proceso Petén", tipo: "PLANTA_PROCESO", giro: "PROCESO", departamento: "Petén", direccion: "Zona Industrial, San Benito", lat: 16.9167, lng: -89.9133 },
  { codigo: "MAQ-GUA", nombre: "Sucursal Maquinaria Guatemala", tipo: "SUCURSAL_MAQUINARIA", giro: "MAQUINARIA", departamento: "Guatemala", direccion: "Calzada Aguilar Batres 34-70, Zona 12", lat: 14.5906, lng: -90.5531 },
  { codigo: "MAQ-XEL", nombre: "Sucursal Maquinaria Xela", tipo: "SUCURSAL_MAQUINARIA", giro: "MAQUINARIA", departamento: "Quetzaltenango", direccion: "Diagonal 2, Zona 5, Quetzaltenango", lat: 14.8444, lng: -91.5233 },
  { codigo: "MAQ-ZAC", nombre: "Sucursal Maquinaria Zacapa", tipo: "SUCURSAL_MAQUINARIA", giro: "MAQUINARIA", departamento: "Zacapa", direccion: "Barrio El Centro, Zacapa", lat: 14.9722, lng: -89.5308 },
  { codigo: "MAQ-PET", nombre: "Sucursal Maquinaria Petén", tipo: "SUCURSAL_MAQUINARIA", giro: "MAQUINARIA", departamento: "Petén", direccion: "Calle Principal, Santa Elena", lat: 16.9264, lng: -89.892 },
  { codigo: "TMP-SAN", nombre: "Centro de Transporte MP Sanarate", tipo: "CENTRO_TRANSPORTE", giro: "TRANSPORTE_MP", departamento: "El Progreso", direccion: "Km 54 Ruta al Atlántico, Sanarate", lat: 14.795, lng: -90.192 },
  { codigo: "TPR-QTZ", nombre: "Centro de Transporte Puerto Quetzal", tipo: "CENTRO_TRANSPORTE", giro: "TRANSPORTE_PROD", departamento: "Escuintla", direccion: "Puerto Quetzal, San José", lat: 13.9333, lng: -90.7833 },
  { codigo: "TPR-STO", nombre: "Centro de Transporte Santo Tomás", tipo: "CENTRO_TRANSPORTE", giro: "TRANSPORTE_PROD", departamento: "Izabal", direccion: "Santo Tomás de Castilla, Puerto Barrios", lat: 15.6958, lng: -88.6175 },
  { codigo: "CON-GUA", nombre: "Oficina de Proyectos de Construcción", tipo: "OFICINA_CONSTRUCCION", giro: "CONSTRUCCION", departamento: "Guatemala", direccion: "Avenida Petapa 45-20, Zona 12", lat: 14.5784, lng: -90.5447 },
] as const;

const MATERIALES = [
  { codigo: "MP-CAL", nombre: "Piedra caliza", precio: 145, min: 400 },
  { codigo: "MP-ARC", nombre: "Arcilla roja", precio: 110, min: 500 },
  { codigo: "MP-FEL", nombre: "Feldespato", precio: 260, min: 150 },
  { codigo: "MP-ARS", nombre: "Arena sílica", precio: 175, min: 300 },
  { codigo: "MP-CAO", nombre: "Caolín", precio: 320, min: 120 },
  { codigo: "MP-YES", nombre: "Yeso", precio: 210, min: 100 },
  { codigo: "MP-GRA", nombre: "Grava triturada", precio: 125, min: 300 },
  { codigo: "MP-BAS", nombre: "Basalto", precio: 155, min: 200 },
] as const;

// Qué extrae cada mina
const MINA_MATERIALES: Record<string, string[]> = {
  "MIN-COB": ["MP-CAL", "MP-ARC", "MP-YES"],
  "MIN-PRO": ["MP-FEL", "MP-ARS", "MP-GRA"],
  "MIN-XEL": ["MP-BAS", "MP-ARS", "MP-CAO"],
  "MIN-PET": ["MP-CAL", "MP-ARC", "MP-GRA"],
};

const PRODUCTOS = [
  { codigo: "PT-PC33", nombre: "Piso cerámico 33×33 cm", categoria: "Pisos cerámicos", unidad: "m²", precio: 68, receta: { "MP-ARC": 0.018, "MP-FEL": 0.004, "MP-ARS": 0.003 } },
  { codigo: "PT-PP60", nombre: "Porcelanato 60×60 cm", categoria: "Pisos cerámicos", unidad: "m²", precio: 165, receta: { "MP-CAO": 0.012, "MP-FEL": 0.01, "MP-ARS": 0.004 } },
  { codigo: "PT-AZ2030", nombre: "Azulejo de pared 20×30 cm", categoria: "Pisos cerámicos", unidad: "m²", precio: 59, receta: { "MP-ARC": 0.012, "MP-CAO": 0.003 } },
  { codigo: "PT-BLK15", nombre: "Block de concreto 15×20×40", categoria: "Materiales de construcción", unidad: "unidad", precio: 5.25, receta: { "MP-GRA": 0.009, "MP-ARS": 0.004, "MP-CAL": 0.002 } },
  { codigo: "PT-LAD", nombre: "Ladrillo tayuyo", categoria: "Materiales de construcción", unidad: "unidad", precio: 2.4, receta: { "MP-ARC": 0.0028 } },
  { codigo: "PT-TEJ", nombre: "Teja de barro", categoria: "Materiales de construcción", unidad: "unidad", precio: 4.1, receta: { "MP-ARC": 0.0022 } },
  { codigo: "PT-CAL", nombre: "Cal hidratada (saco 25 kg)", categoria: "Materiales de construcción", unidad: "saco", precio: 38, receta: { "MP-CAL": 0.032 } },
  { codigo: "PT-ADH", nombre: "Adhesivo cerámico (saco 20 kg)", categoria: "Materiales de construcción", unidad: "saco", precio: 62, receta: { "MP-ARS": 0.014, "MP-YES": 0.005, "MP-CAL": 0.002 } },
] as const;

const CLIENTES = [
  { nombre: "Cemex Guatemala, S.A.", nit: "1234567-8", tipo: "NACIONAL", pais: "Guatemala", contacto: "Lic. Andrea Morales" },
  { nombre: "Cementos Progreso, S.A.", nit: "502147-3", tipo: "NACIONAL", pais: "Guatemala", contacto: "Ing. Roberto Castillo" },
  { nombre: "Hispacensa, S.A.", nit: "8890123-1", tipo: "NACIONAL", pais: "Guatemala", contacto: "Licda. Marta Ixcot" },
  { nombre: "Ministerio de Comunicaciones (CIV)", nit: "330221-K", tipo: "NACIONAL", pais: "Guatemala", contacto: "Ing. Carlos Pineda" },
  { nombre: "Municipalidad de Guatemala", nit: "333033-2", tipo: "NACIONAL", pais: "Guatemala", contacto: "Arq. Lucía Barrios" },
  { nombre: "Constructora Sigma, S.A.", nit: "6543210-9", tipo: "NACIONAL", pais: "Guatemala", contacto: "Ing. Pedro Ajú" },
  { nombre: "Distribuidora El Martillo", nit: "4455667-0", tipo: "NACIONAL", pais: "Guatemala", contacto: "Sr. Julio Coy" },
  { nombre: "Maersk Line Guatemala", nit: "7788990-5", tipo: "EXTRANJERO", pais: "Dinamarca", contacto: "Mr. Lars Nielsen" },
  { nombre: "Holcim El Salvador", nit: "SV-0614-2001", tipo: "EXTRANJERO", pais: "El Salvador", contacto: "Ing. Diana Flores" },
  { nombre: "Cementos Argos Honduras", nit: "HN-08019000", tipo: "EXTRANJERO", pais: "Honduras", contacto: "Lic. Óscar Reyes" },
  { nombre: "Grupo Walmart Centroamérica", nit: "1122334-4", tipo: "EXTRANJERO", pais: "Costa Rica", contacto: "Licda. Sofía Mora" },
  { nombre: "Interceramic México", nit: "MX-ICE850101", tipo: "EXTRANJERO", pais: "México", contacto: "Ing. Raúl Treviño" },
] as const;

const PROVEEDORES = [
  { nombre: "Agregados de Guatemala, S.A.", nit: "9001234-1", contacto: "Ing. Héctor Lima", materiales: "Grava triturada, Arena sílica" },
  { nombre: "Minerales del Norte, S.A.", nit: "9005678-2", contacto: "Lic. Alba Choc", materiales: "Caolín, Feldespato" },
  { nombre: "Canteras San Miguel", nit: "9009012-3", contacto: "Sr. Mario Tzul", materiales: "Piedra caliza, Yeso" },
] as const;

const TIPOS_MAQUINA = [
  { tipo: "Excavadora", marcas: [["Caterpillar", "320 GC"], ["Komatsu", "PC210"], ["John Deere", "210G"]], tarifa: [3200, 4200], precio: [950000, 1400000] },
  { tipo: "Retroexcavadora", marcas: [["Caterpillar", "416F2"], ["JCB", "3CX"], ["Case", "580N"]], tarifa: [1400, 1900], precio: [450000, 680000] },
  { tipo: "Cargador frontal", marcas: [["Caterpillar", "950M"], ["Volvo", "L120H"]], tarifa: [2800, 3600], precio: [1100000, 1500000] },
  { tipo: "Motoniveladora", marcas: [["Caterpillar", "140K"], ["John Deere", "672G"]], tarifa: [3000, 3800], precio: [1300000, 1700000] },
  { tipo: "Vibrocompactadora", marcas: [["Dynapac", "CA2500"], ["Bomag", "BW 211"]], tarifa: [1500, 2100], precio: [520000, 780000] },
  { tipo: "Grúa telescópica", marcas: [["Liebherr", "LTM 1050"], ["Grove", "GMK3060"]], tarifa: [6500, 8500], precio: [2800000, 3600000] },
  { tipo: "Bulldozer", marcas: [["Caterpillar", "D6"], ["Komatsu", "D61PX"]], tarifa: [3800, 4800], precio: [1600000, 2100000] },
] as const;

const NOMBRES = ["José", "Luis", "Carlos", "Juan", "Pedro", "Mario", "Edgar", "Byron", "Óscar", "Erick", "Marvin", "Henry", "Selvin", "Wilson", "Elmer", "Rony", "Héctor", "Julio"];
const APELLIDOS = ["López", "García", "Pérez", "Hernández", "Morales", "Cifuentes", "Ajú", "Xol", "Tzul", "Coy", "Barrios", "Chacón", "Monterroso", "Castillo", "Ramírez", "Choc", "Sic", "Batz"];

async function limpiar() {
  // Orden inverso de dependencias
  await prisma.$transaction([
    prisma.pushSuscripcion.deleteMany(),
    prisma.apiKey.deleteMany(),
    prisma.webhook.deleteMany(),
    prisma.mensaje.deleteMany(),
    prisma.reunion.deleteMany(),
    prisma.bitacora.deleteMany(),
    prisma.alerta.deleteMany(),
    prisma.lecturaGPS.deleteMany(),
    prisma.viaje.deleteMany(),
    prisma.pedidoItem.deleteMany(),
    prisma.pedido.deleteMany(),
    prisma.solicitudMateriaPrima.deleteMany(),
    prisma.contratoAlquiler.deleteMany(),
    prisma.ventaMaquina.deleteMany(),
    prisma.hitoProyecto.deleteMany(),
    prisma.maquina.deleteMany(),
    prisma.proyectoConstruccion.deleteMany(),
    prisma.camion.deleteMany(),
    prisma.dispositivoGPS.deleteMany(),
    prisma.piloto.deleteMany(),
    prisma.ordenProduccion.deleteMany(),
    prisma.insumoProducto.deleteMany(),
    prisma.producto.deleteMany(),
    prisma.registroExtraccion.deleteMany(),
    prisma.inventario.deleteMany(),
    prisma.gasto.deleteMany(),
    prisma.presupuesto.deleteMany(),
    // Clientes y vendedores se referencian mutuamente: primero se quita la cartera
    prisma.cliente.updateMany({ data: { vendedorId: null } }),
    prisma.usuario.deleteMany(),
    prisma.material.deleteMany(),
    prisma.cliente.deleteMany(),
    prisma.proveedor.deleteMany(),
    prisma.sede.deleteMany(),
  ]);
}

async function main() {
  console.log("🧹 Limpiando base de datos…");
  await limpiar();

  // ── Sedes ──
  console.log("🏢 Sedes");
  const sedes: Record<string, { id: number; giro: GiroNegocio; latitud: number; longitud: number; nombre: string; departamento: string }> = {};
  for (const s of SEDES) {
    const sede = await prisma.sede.create({
      data: { codigo: s.codigo, nombre: s.nombre, tipo: s.tipo, giro: s.giro, departamento: s.departamento, direccion: s.direccion, latitud: s.lat, longitud: s.lng, telefono: `+502 ${entero(2200, 7999)}-${entero(1000, 9999)}` },
    });
    sedes[s.codigo] = sede;
  }

  // ── Usuarios ──
  console.log("👤 Usuarios");
  const hash = (p: string) => bcrypt.hashSync(p, 10);
  const usuarios = [
    { nombre: "Administrador General", email: "admin@transport.gt", password: "Admin2026!", rol: "ADMIN", giro: null, sede: "CORP-Z10" },
    { nombre: "Lcda. Patricia Recinos", email: "contabilidad@transport.gt", password: "Conta2026!", rol: "CONTADOR", giro: null, sede: "CORP-Z10" },
    { nombre: "Ing. Rodrigo Caal", email: "extraccion@transport.gt", password: "Gerente2026!", rol: "GERENTE", giro: "EXTRACCION", sede: "MIN-COB" },
    { nombre: "Ing. Silvia Orellana", email: "proceso@transport.gt", password: "Gerente2026!", rol: "GERENTE", giro: "PROCESO", sede: "PLA-ZAC" },
    { nombre: "Lic. Fernando Arriaza", email: "maquinaria@transport.gt", password: "Gerente2026!", rol: "GERENTE", giro: "MAQUINARIA", sede: "MAQ-GUA" },
    { nombre: "Lic. Gustavo Mejía", email: "transportemp@transport.gt", password: "Gerente2026!", rol: "GERENTE", giro: "TRANSPORTE_MP", sede: "TMP-SAN" },
    { nombre: "Licda. Karla Estrada", email: "transporteprod@transport.gt", password: "Gerente2026!", rol: "GERENTE", giro: "TRANSPORTE_PROD", sede: "TPR-QTZ" },
    { nombre: "Ing. Alejandro Sandoval", email: "construccion@transport.gt", password: "Gerente2026!", rol: "GERENTE", giro: "CONSTRUCCION", sede: "CON-GUA" },
    { nombre: "Ana Lucía Pop", email: "operador.coban@transport.gt", password: "Operador2026!", rol: "OPERADOR", giro: "EXTRACCION", sede: "MIN-COB" },
  ] as const;
  const usuariosCreados = [];
  for (const u of usuarios) {
    usuariosCreados.push(
      await prisma.usuario.create({
        data: { nombre: u.nombre, email: u.email, password: hash(u.password), rol: u.rol, giro: u.giro, sedeId: sedes[u.sede].id, ultimoAcceso: diasAtras(entero(0, 5)) },
      }),
    );
  }

  // ── Materiales, productos y recetas ──
  console.log("🪨 Materiales y productos");
  const materiales: Record<string, { id: number; nombre: string }> = {};
  for (const m of MATERIALES) {
    materiales[m.codigo] = await prisma.material.create({
      data: { codigo: m.codigo, nombre: m.nombre, precioRef: dec(m.precio), stockMinimo: dec(m.min) },
    });
  }
  const productos: { id: number; codigo: string }[] = [];
  for (const p of PRODUCTOS) {
    const prod = await prisma.producto.create({
      data: {
        codigo: p.codigo, nombre: p.nombre, categoria: p.categoria, unidad: p.unidad, precio: dec(p.precio),
        insumos: { create: Object.entries(p.receta).map(([mat, cant]) => ({ materialId: materiales[mat].id, cantidadPorUnidad: new Prisma.Decimal(cant) })) },
      },
    });
    productos.push(prod);
  }

  // ── Clientes y proveedores ──
  const clientes = [];
  for (const c of CLIENTES) {
    clientes.push(await prisma.cliente.create({ data: { ...c, telefono: `+502 ${entero(2200, 5999)}-${entero(1000, 9999)}`, email: `contacto@${c.nombre.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}.com` } }));
  }
  const clientesNac = clientes.filter((c) => c.tipo === "NACIONAL");
  const clientesExt = clientes.filter((c) => c.tipo === "EXTRANJERO");
  const proveedores = [];
  for (const p of PROVEEDORES) proveedores.push(await prisma.proveedor.create({ data: { ...p, telefono: `+502 ${entero(2200, 7999)}-${entero(1000, 9999)}` } }));

  // ── Extracción: 180 días de registros + inventario de minas ──
  console.log("⛏️  Extracción (180 días)");
  const inventario = new Map<string, number>(); // `${sedeId}:${materialId}`
  const sumar = (sedeId: number, matId: number, cant: number) => {
    const k = `${sedeId}:${matId}`;
    inventario.set(k, (inventario.get(k) ?? 0) + cant);
  };
  const extracciones: Prisma.RegistroExtraccionCreateManyInput[] = [];
  for (const [minaCod, mats] of Object.entries(MINA_MATERIALES)) {
    const mina = sedes[minaCod];
    for (let d = 180; d >= 1; d--) {
      const fecha = diasAtras(d, 6);
      if (fecha.getDay() === 0) continue; // domingo sin operación
      for (const turno of ["Matutino", "Vespertino"]) {
        const mat = materiales[elegir(mats)];
        const ton = entre(35, 120);
        extracciones.push({ sedeId: mina.id, materialId: mat.id, toneladas: dec(ton), turno, fecha });
        sumar(mina.id, mat.id, ton);
      }
    }
  }
  await prisma.registroExtraccion.createMany({ data: extracciones });

  // Inventario inicial en plantas
  for (const planta of ["PLA-ZAC", "PLA-HUE", "PLA-PET"]) {
    for (const m of MATERIALES) sumar(sedes[planta].id, materiales[m.codigo].id, entre(m.min * 0.6, m.min * 2.2));
  }

  // ── Flota de transporte ──
  console.log("🚛 Flota, pilotos y GPS");
  const marcasCamion = [["Volvo", "FMX 460"], ["Freightliner", "M2 106"], ["International", "HX520"], ["Kenworth", "T880"], ["Mack", "Granite"], ["Hino", "700"]];
  const camiones: { id: number; placa: string; giro: GiroNegocio; capacidad: number; sedeId: number; dispositivoId: number }[] = [];
  let imei = 356938035643800;
  const centros = { TRANSPORTE_MP: ["TMP-SAN"], TRANSPORTE_PROD: ["TPR-QTZ", "TPR-STO"] } as const;
  for (let i = 0; i < 32; i++) {
    const giro: GiroNegocio = i < 18 ? "TRANSPORTE_MP" : "TRANSPORTE_PROD";
    const sede = sedes[elegir(centros[giro as keyof typeof centros])];
    const [marca, modelo] = elegir(marcasCamion);
    const tipo = giro === "TRANSPORTE_MP" ? elegir(["Volteo 14 m³", "Volteo 20 m³", "Góndola"]) : elegir(["Cabezal + plataforma", "Cabezal + furgón 40'", "Portacontenedor"]);
    const capacidad = tipo.includes("14") ? 18 : tipo.includes("20") ? 25 : 30;
    const dispositivo = await prisma.dispositivoGPS.create({ data: { imei: String(imei++), tipoActivo: "CAMION" } });
    const camion = await prisma.camion.create({
      data: {
        placa: `C-${entero(100, 999)}${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(66 + ((i * 7) % 24))}${String.fromCharCode(67 + ((i * 3) % 23))}`,
        marca, modelo, anio: entero(2015, 2025), capacidadTon: dec(capacidad), tipo, giro, sedeId: sede.id,
        kilometraje: entero(40000, 420000), dispositivoId: dispositivo.id,
        estado: i === 5 || i === 22 ? "MANTENIMIENTO" : "DISPONIBLE",
      },
    });
    camiones.push({ id: camion.id, placa: camion.placa, giro, capacidad, sedeId: sede.id, dispositivoId: dispositivo.id });
  }

  const pilotos: { id: number; activo: boolean }[] = [];
  for (let i = 0; i < 34; i++) {
    pilotos.push(
      await prisma.piloto.create({
        data: {
          nombre: `${elegir(NOMBRES)} ${elegir(APELLIDOS)} ${elegir(APELLIDOS)}`,
          dpi: `${entero(1000, 3999)} ${entero(10000, 99999)} ${String(entero(101, 2217)).padStart(4, "0")}`,
          licencia: `A-${String(100000 + i * 3917).slice(0, 6)}`,
          tipoLicencia: "A",
          telefono: `+502 ${entero(3000, 5999)}-${entero(1000, 9999)}`,
          activo: i !== 33,
        },
      }),
    );
  }

  // ── Maquinaria ──
  console.log("🚜 Maquinaria");
  const sucursales = ["MAQ-GUA", "MAQ-XEL", "MAQ-ZAC", "MAQ-PET"];
  const maquinas: { id: number; codigo: string; tarifa: number; precio: number; sedeId: number }[] = [];
  for (let i = 0; i < 44; i++) {
    const t = TIPOS_MAQUINA[i % TIPOS_MAQUINA.length];
    const [marca, modelo] = elegir<readonly string[]>(t.marcas);
    const dispositivo = await prisma.dispositivoGPS.create({ data: { imei: String(imei++), tipoActivo: "MAQUINA" } });
    const tarifa = Math.round(entre(t.tarifa[0], t.tarifa[1]) / 50) * 50;
    const precio = Math.round(entre(t.precio[0], t.precio[1]) / 1000) * 1000;
    const sedeId = sedes[sucursales[i % sucursales.length]].id;
    const m = await prisma.maquina.create({
      data: {
        codigo: `MQ-${String(i + 1).padStart(3, "0")}`, tipo: t.tipo, marca, modelo, anio: entero(2014, 2025),
        serie: `${marca.slice(0, 3).toUpperCase()}${entero(100000, 999999)}${i}`,
        sedeId, tarifaDiaria: dec(tarifa), precioVenta: dec(precio), horasUso: entero(800, 14000),
        dispositivoId: dispositivo.id, estado: i % 13 === 7 ? "MANTENIMIENTO" : "DISPONIBLE",
      },
    });
    maquinas.push({ id: m.id, codigo: m.codigo, tarifa, precio, sedeId });
  }

  // ── Construcción ──
  console.log("🏗️  Proyectos de construcción");
  const proyectosDef = [
    { nombre: "Puente vehicular Río Motagua", tipo: "PUENTE", cliente: 3, ubicacion: "Gualán", depto: "Zacapa", monto: 38500000, inicio: 210, dur: 420 },
    { nombre: "Ampliación CA-9 Norte, tramo Sanarate–El Rancho", tipo: "CARRETERA", cliente: 3, ubicacion: "Sanarate", depto: "El Progreso", monto: 96000000, inicio: 300, dur: 540 },
    { nombre: "Torre corporativa Zona 4", tipo: "EDIFICIO", cliente: 5, ubicacion: "Zona 4, Ciudad de Guatemala", depto: "Guatemala", monto: 54200000, inicio: 150, dur: 600 },
    { nombre: "Pavimentación Ruta Cobán–Chisec", tipo: "CARRETERA", cliente: 3, ubicacion: "Chisec", depto: "Alta Verapaz", monto: 71800000, inicio: 90, dur: 480 },
    { nombre: "Paso a desnivel Calzada Roosevelt", tipo: "PUENTE", cliente: 4, ubicacion: "Zona 7, Ciudad de Guatemala", depto: "Guatemala", monto: 42900000, inicio: 420, dur: 380 },
    { nombre: "Centro de distribución Villa Nueva", tipo: "EDIFICIO", cliente: 10, ubicacion: "Villa Nueva", depto: "Guatemala", monto: 31600000, inicio: 45, dur: 330 },
    { nombre: "Puente peatonal Periférico", tipo: "PUENTE", cliente: 4, ubicacion: "Zona 11, Ciudad de Guatemala", depto: "Guatemala", monto: 6800000, inicio: 520, dur: 240 },
    { nombre: "Bodega industrial Escuintla", tipo: "EDIFICIO", cliente: 6, ubicacion: "Escuintla", depto: "Escuintla", monto: 18700000, inicio: -20, dur: 300 },
  ] as const;
  const hitosBase = ["Estudios y diseño", "Movimiento de tierras", "Cimentación", "Estructura principal", "Obra gris / carpeta", "Instalaciones", "Acabados", "Entrega y liquidación"];
  let maqIdx = 0;
  for (const [i, p] of proyectosDef.entries()) {
    const inicio = diasAtras(p.inicio);
    const fin = new Date(inicio.getTime() + p.dur * 86_400_000);
    const transcurrido = Math.max(0, Math.min(1, p.inicio / p.dur));
    const hitos = hitosBase.map((nombre, k) => ({
      nombre, peso: [5, 15, 15, 25, 15, 10, 10, 5][k],
      completado: (k + 1) / hitosBase.length <= transcurrido + 0.05,
      fechaMeta: new Date(inicio.getTime() + ((k + 1) / hitosBase.length) * p.dur * 86_400_000),
    }));
    const avance = calcularAvance(hitos);
    const proyecto = await prisma.proyectoConstruccion.create({
      data: {
        codigo: codigo("PRY", i + 1), nombre: p.nombre, tipo: p.tipo, clienteId: clientes[p.cliente].id,
        ubicacion: p.ubicacion, departamento: p.depto, montoContrato: dec(p.monto),
        costoEjecutado: dec(p.monto * (avance / 100) * entre(0.78, 1.04)), avance,
        estado: p.inicio < 0 ? "PLANIFICACION" : avance === 100 ? "FINALIZADO" : i === 6 ? "PAUSADO" : "EN_EJECUCION",
        fechaInicio: inicio, fechaFinEstimada: fin,
        descripcion: `Proyecto de ${p.tipo.toLowerCase()} para ${CLIENTES[p.cliente].nombre}.`,
        hitos: { create: hitos },
      },
    });
    if (proyecto.estado === "EN_EJECUCION") {
      for (let k = 0; k < 3; k++) {
        const m = maquinas[maqIdx++];
        await prisma.maquina.update({ where: { id: m.id }, data: { proyectoId: proyecto.id, estado: "EN_PROYECTO" } });
      }
    }
  }

  // ── Contratos de alquiler y ventas ──
  console.log("📄 Alquileres y ventas");
  let nAlq = 1;
  for (let k = 0; k < 60; k++) {
    const m = maquinas[18 + (k % 22)];
    const inicio = diasAtras(entero(5, 300));
    const dias = entero(3, 45);
    const fin = new Date(inicio.getTime() + (dias - 1) * 86_400_000);
    const { total } = calcularAlquiler(m.tarifa, inicio, fin);
    const activo = fin > AHORA && inicio < AHORA;
    // Un contrato activo por máquina como máximo
    if (activo) {
      const ya = await prisma.contratoAlquiler.findFirst({ where: { maquinaId: m.id, estado: "ACTIVO" } });
      const maq = await prisma.maquina.findUniqueOrThrow({ where: { id: m.id } });
      if (ya || maq.estado !== "DISPONIBLE") continue;
      await prisma.maquina.update({ where: { id: m.id }, data: { estado: "ALQUILADA" } });
    }
    await prisma.contratoAlquiler.create({
      data: {
        codigo: codigo("ALQ", nAlq++), maquinaId: m.id, clienteId: elegir(clientes).id, fechaInicio: inicio, fechaFin: fin,
        tarifaDiaria: dec(m.tarifa), total: dec(total), deposito: dec(m.tarifa * 3),
        estado: activo ? "ACTIVO" : fin < AHORA ? "FINALIZADO" : "CANCELADO",
      },
    });
  }
  for (let k = 0; k < 4; k++) {
    const m = maquinas[40 + k];
    await prisma.maquina.update({ where: { id: m.id }, data: { estado: "VENDIDA" } });
    await prisma.ventaMaquina.create({
      data: { codigo: codigo("VTA", k + 1), maquinaId: m.id, clienteId: elegir(clientesNac).id, precio: dec(m.precio * entre(0.92, 1)), fecha: diasAtras(entero(10, 200)) },
    });
  }

  // ── Solicitudes de materia prima y viajes ──
  console.log("🔁 Flujo de materia prima y viajes");
  const minas = Object.keys(MINA_MATERIALES);
  const plantas = ["PLA-ZAC", "PLA-HUE", "PLA-PET"];
  const camionesMP = camiones.filter((c) => c.giro === "TRANSPORTE_MP");
  const camionesPR = camiones.filter((c) => c.giro === "TRANSPORTE_PROD");
  let nSol = 1;
  let nViaje = 1;
  const ocupados = new Set<number>(); // camiones y pilotos en viaje activo
  const pilotosOcupados = new Set<number>();

  const crearViaje = async (v: {
    tipo: "MATERIA_PRIMA" | "PRODUCTO"; modalidad: "NACIONAL" | "INTER_PUERTOS" | "INTER_FRONTERAS" | "PUERTO_A_BODEGA" | "BODEGA_A_PUERTO";
    camion: (typeof camiones)[number]; clienteId?: number; origen: string; destino: string; carga: string; toneladas: number; km: number;
    salida: Date; estado: "PROGRAMADO" | "EN_CURSO" | "ENTREGADO" | "CANCELADO"; solicitudId?: number;
  }) => {
    const disponibles = pilotos.filter((p) => p.activo && !pilotosOcupados.has(p.id));
    const piloto = elegir(disponibles);
    if (v.estado === "PROGRAMADO" || v.estado === "EN_CURSO") {
      pilotosOcupados.add(piloto.id);
      ocupados.add(v.camion.id);
      if (v.estado === "EN_CURSO") await prisma.camion.update({ where: { id: v.camion.id }, data: { estado: "EN_RUTA" } });
    }
    return prisma.viaje.create({
      data: {
        codigo: codigo("VJ", nViaje++), tipo: v.tipo, modalidad: v.modalidad, clienteId: v.clienteId, camionId: v.camion.id, pilotoId: piloto.id,
        origen: v.origen, destino: v.destino, carga: v.carga, toneladas: dec(v.toneladas), distanciaKm: v.km,
        tarifa: dec(calcularTarifaViaje(v.km, v.toneladas, v.modalidad)), estado: v.estado, fechaSalida: v.salida,
        fechaEntrega: v.estado === "ENTREGADO" ? new Date(v.salida.getTime() + entre(5, 30) * 3_600_000) : null,
        solicitudId: v.solicitudId,
      },
    });
  };

  const libre = (lista: typeof camiones) => elegir(lista.filter((c) => !ocupados.has(c.id) && c.id !== camiones[5].id && c.id !== camiones[22].id));

  for (let k = 0; k < 90; k++) {
    const d = 170 - k * 2 + entero(-1, 1);
    const plantaCod = elegir(plantas);
    const planta = sedes[plantaCod];
    const material = elegir(MATERIALES);
    const usarTercero = rnd() < 0.2;
    const minaCod = minas.find((m) => MINA_MATERIALES[m].includes(material.codigo) && rnd() < 0.7) ?? minas.find((m) => MINA_MATERIALES[m].includes(material.codigo))!;
    const mina = sedes[minaCod];
    const ton = Math.round(entre(15, 28));
    const proveedor = elegir(proveedores);

    // Estados según antigüedad
    const estado = d > 6 ? (rnd() < 0.06 ? "RECHAZADA" : "RECIBIDA") : elegir(["PENDIENTE", "APROBADA", "EN_TRANSITO", "RECIBIDA"] as const);
    const sol = await prisma.solicitudMateriaPrima.create({
      data: {
        codigo: codigo("SMP", nSol++), plantaId: planta.id, materialId: materiales[material.codigo].id, toneladas: dec(ton),
        fechaRequerida: diasAtras(d - 3), estado,
        minaId: estado === "PENDIENTE" || usarTercero ? null : mina.id,
        proveedorId: estado !== "PENDIENTE" && usarTercero ? proveedor.id : null,
        notas: estado === "RECHAZADA" ? "Rechazada: existencias comprometidas para otra planta" : null,
        createdAt: diasAtras(d),
      },
    });
    if (estado === "RECIBIDA" || estado === "EN_TRANSITO") {
      const camion = libre(camionesMP);
      if (!camion) continue;
      await crearViaje({
        tipo: "MATERIA_PRIMA", modalidad: "NACIONAL", camion, origen: usarTercero ? proveedor.nombre : mina.nombre, destino: planta.nombre,
        carga: material.nombre, toneladas: Math.min(ton, camion.capacidad), km: entero(90, 420), salida: diasAtras(d - 1, 5),
        estado: estado === "RECIBIDA" ? "ENTREGADO" : "EN_CURSO", solicitudId: sol.id,
      });
      if (estado === "RECIBIDA") {
        if (!usarTercero) sumar(mina.id, materiales[material.codigo].id, -ton);
        sumar(planta.id, materiales[material.codigo].id, ton);
      }
    }
  }

  // Transporte de materia prima para clientes externos (Cemex, Cementos Progreso, Hispacensa)
  for (let k = 0; k < 70; k++) {
    const d = entero(0, 178);
    const camion = libre(camionesMP);
    if (!camion) break;
    const cliente = clientes[k % 3];
    const estado = d === 0 ? "PROGRAMADO" : d < 2 ? "EN_CURSO" : rnd() < 0.04 ? "CANCELADO" : "ENTREGADO";
    if (estado === "ENTREGADO" || estado === "CANCELADO") ocupados.delete(camion.id);
    await crearViaje({
      tipo: "MATERIA_PRIMA", modalidad: "NACIONAL", camion, clienteId: cliente.id,
      origen: sedes[elegir(minas)].nombre, destino: `Planta ${cliente.nombre.split(",")[0]} — ${elegir(["San Miguel Sanarate", "San Gabriel", "Zona 6", "Escuintla"])}`,
      carga: elegir(MATERIALES).nombre, toneladas: Math.round(entre(14, camion.capacidad)), km: entero(60, 350), salida: diasAtras(d, 5), estado,
    });
  }

  // Transporte de productos: inter puertos, inter fronteras, puerto ↔ bodega
  const rutasProd = [
    { modalidad: "INTER_PUERTOS", origen: "Puerto Quetzal", destino: "Puerto Santo Tomás de Castilla", km: 390 },
    { modalidad: "INTER_PUERTOS", origen: "Puerto Santo Tomás de Castilla", destino: "Puerto Quetzal", km: 390 },
    { modalidad: "INTER_FRONTERAS", origen: "Bodega Villa Nueva", destino: "Frontera Pedro de Alvarado (El Salvador)", km: 165 },
    { modalidad: "INTER_FRONTERAS", origen: "Puerto Santo Tomás de Castilla", destino: "Frontera Corinto (Honduras)", km: 70 },
    { modalidad: "INTER_FRONTERAS", origen: "Bodega Zona 12", destino: "Frontera Tecún Umán (México)", km: 250 },
    { modalidad: "PUERTO_A_BODEGA", origen: "Puerto Quetzal", destino: "Bodega Zona 12, Ciudad de Guatemala", km: 105 },
    { modalidad: "PUERTO_A_BODEGA", origen: "Puerto Santo Tomás de Castilla", destino: "Bodega Amatitlán", km: 310 },
    { modalidad: "BODEGA_A_PUERTO", origen: "Planta de Proceso Zacapa", destino: "Puerto Santo Tomás de Castilla", km: 160 },
    { modalidad: "BODEGA_A_PUERTO", origen: "Bodega Villa Nueva", destino: "Puerto Quetzal", km: 95 },
    { modalidad: "NACIONAL", origen: "Planta de Proceso Huehuetenango", destino: "Distribuidora El Martillo, Mixco", km: 265 },
  ] as const;
  const cargasProd = ["Contenedor 40' — pisos cerámicos", "Contenedor 20' — porcelanato", "Block de concreto (paletizado)", "Electrodomésticos", "Contenedor refrigerado", "Maquinaria agrícola", "Abarrotes", "Láminas de acero"];
  for (let k = 0; k < 110; k++) {
    const d = entero(0, 178);
    const camion = libre(camionesPR);
    if (!camion) break;
    const ruta = elegir(rutasProd);
    const extranjero = ruta.modalidad === "INTER_FRONTERAS" || ruta.modalidad === "INTER_PUERTOS";
    const estado = d === 0 ? "PROGRAMADO" : d < 2 ? "EN_CURSO" : rnd() < 0.04 ? "CANCELADO" : "ENTREGADO";
    if (estado === "ENTREGADO" || estado === "CANCELADO") ocupados.delete(camion.id);
    await crearViaje({
      tipo: "PRODUCTO", modalidad: ruta.modalidad, camion, clienteId: (extranjero && rnd() < 0.7 ? elegir(clientesExt) : elegir(clientesNac)).id,
      origen: ruta.origen, destino: ruta.destino, carga: elegir(cargasProd), toneladas: Math.round(entre(10, camion.capacidad)), km: ruta.km, salida: diasAtras(d, 4), estado,
    });
  }

  // ── Órdenes de producción ──
  console.log("🏭 Órdenes de producción");
  let nOp = 1;
  for (let k = 0; k < 75; k++) {
    const d = 175 - k * 2;
    const prod = elegir(PRODUCTOS);
    const p = productos.find((x) => x.codigo === prod.codigo)!;
    const planta = sedes[elegir(plantas)];
    const cantidad = prod.unidad === "m²" ? entero(2000, 9000) : prod.unidad === "saco" ? entero(800, 4000) : entero(10000, 60000);
    const estado = d > 10 ? "COMPLETADA" : d > 3 ? "EN_PROCESO" : "PLANIFICADA";
    if (estado !== "PLANIFICADA") {
      for (const [mat, cant] of Object.entries(prod.receta)) sumar(planta.id, materiales[mat].id, -Math.min(cant * cantidad, inventario.get(`${planta.id}:${materiales[mat].id}`) ?? 0));
    }
    await prisma.ordenProduccion.create({
      data: {
        codigo: codigo("OP", nOp++), sedeId: planta.id, productoId: p.id, cantidad: dec(cantidad), estado,
        fechaInicio: diasAtras(d), fechaFin: estado === "COMPLETADA" ? diasAtras(d - entero(2, 6)) : null,
      },
    });
  }

  // Persistir inventario consolidado
  await prisma.inventario.createMany({
    data: [...inventario.entries()].map(([k, cant]) => {
      const [sedeId, materialId] = k.split(":").map(Number);
      return { sedeId, materialId, cantidad: dec(Math.max(0, cant)) };
    }),
  });

  // ── Presupuestos y gastos (12 meses) ──
  console.log("💰 Presupuestos y gastos");
  const baseMensual: Record<GiroNegocio, number> = {
    EXTRACCION: 1_850_000, PROCESO: 2_400_000, MAQUINARIA: 950_000, TRANSPORTE_MP: 1_300_000,
    TRANSPORTE_PROD: 1_550_000, CONSTRUCCION: 4_800_000, CORPORATIVO: 620_000,
  };
  const categoriasPorGiro: Record<GiroNegocio, CategoriaGasto[]> = {
    EXTRACCION: ["PLANILLA", "COMBUSTIBLE", "MANTENIMIENTO", "SERVICIOS", "OTROS"],
    PROCESO: ["PLANILLA", "MATERIALES", "SERVICIOS", "MANTENIMIENTO", "OTROS"],
    MAQUINARIA: ["PLANILLA", "MANTENIMIENTO", "ARRENDAMIENTO", "GPS", "OTROS"],
    TRANSPORTE_MP: ["PLANILLA", "COMBUSTIBLE", "MANTENIMIENTO", "GPS", "OTROS"],
    TRANSPORTE_PROD: ["PLANILLA", "COMBUSTIBLE", "MANTENIMIENTO", "GPS", "SERVICIOS"],
    CONSTRUCCION: ["PLANILLA", "MATERIALES", "COMBUSTIBLE", "ARRENDAMIENTO", "SERVICIOS"],
    CORPORATIVO: ["ARRENDAMIENTO", "PLANILLA", "SERVICIOS", "OTROS"],
  };
  const sedePorGiro = (g: GiroNegocio) => Object.values(sedes).filter((s) => s.giro === g);
  const gastos: Prisma.GastoCreateManyInput[] = [];
  const contador = usuariosCreados[1].id;
  for (let m = 11; m >= 0; m--) {
    const ref = new Date(AHORA.getFullYear(), AHORA.getMonth() - m, 1);
    const anio = ref.getFullYear();
    const mes = ref.getMonth() + 1;
    const ultimoDia = m === 0 ? AHORA.getDate() : new Date(anio, mes, 0).getDate();
    for (const giro of Object.keys(baseMensual) as GiroNegocio[]) {
      const presupuesto = baseMensual[giro] * entre(0.95, 1.08);
      await prisma.presupuesto.create({ data: { giro, anio, mes, monto: dec(presupuesto) } });
      // Ejecución: el mes actual va parcial; algunos giros exceden para mostrar alertas
      const factor = m === 0
        ? (ultimoDia / new Date(anio, mes, 0).getDate()) * (giro === "CONSTRUCCION" ? 2.3 : giro === "TRANSPORTE_MP" ? 2.05 : entre(0.95, 1.15))
        : entre(0.82, giro === "CONSTRUCCION" ? 1.12 : 1.02);
      let objetivo = presupuesto * factor;
      const cats = categoriasPorGiro[giro];
      if (giro === "CORPORATIVO") {
        gastos.push({ giro, sedeId: sedes["CORP-Z10"].id, categoria: "ARRENDAMIENTO", descripcion: "Arrendamiento oficinas Edificio Sixtino II — Nivel 8", monto: dec(185000), fecha: new Date(anio, mes - 1, 1, 9), documento: `FAC-SIX-${anio}${mes}`, usuarioId: contador });
        objetivo -= 185000;
      }
      if (["MAQUINARIA", "TRANSPORTE_MP", "TRANSPORTE_PROD"].includes(giro)) {
        const unidades = giro === "MAQUINARIA" ? 44 : giro === "TRANSPORTE_MP" ? 18 : 14;
        gastos.push({ giro, categoria: "GPS", descripcion: `Mensualidad GPS-Inversiones (${unidades} dispositivos)`, monto: dec(unidades * 175), fecha: new Date(anio, mes - 1, 5, 10), documento: `GPSI-${anio}-${mes}-${giro.slice(0, 3)}`, usuarioId: contador });
        objetivo -= unidades * 175;
      }
      while (objetivo > 0) {
        const cat = elegir(cats);
        const monto = Math.min(objetivo, cat === "PLANILLA" ? entre(90000, 260000) : entre(4000, 85000));
        const sedesGiro = sedePorGiro(giro);
        gastos.push({
          giro, sedeId: sedesGiro.length ? elegir(sedesGiro).id : null, categoria: cat,
          descripcion: descripcionGasto(cat), monto: dec(monto),
          fecha: new Date(anio, mes - 1, entero(1, ultimoDia), entero(8, 17)),
          documento: `FAC-${entero(10000, 99999)}`, usuarioId: contador,
        });
        objetivo -= monto;
      }
    }
  }
  await prisma.gasto.createMany({ data: gastos });

  // ── Lecturas GPS: últimas 24 h cada 15 min ──
  console.log("📡 Lecturas GPS (24 h)");
  const dispositivos = await prisma.dispositivoGPS.findMany({ include: { camion: { include: { sede: true } }, maquina: { include: { sede: true, proyecto: true } } } });
  const alertas: Prisma.AlertaCreateManyInput[] = [];
  const lecturas: Prisma.LecturaGPSCreateManyInput[] = [];
  const PASOS = 96;
  for (const d of dispositivos) {
    const esCamion = d.tipoActivo === "CAMION";
    const sede = d.camion?.sede ?? d.maquina!.sede;
    let lat = sede.latitud + entre(-0.05, 0.05);
    let lng = sede.longitud + entre(-0.05, 0.05);
    const enRuta = d.camion?.estado === "EN_RUTA";
    const trabaja = d.maquina && (d.maquina.estado === "ALQUILADA" || d.maquina.estado === "EN_PROYECTO");
    const historial: { velocidad: number; motorEncendido: boolean; timestamp: Date }[] = [];
    let alertaUso = false;
    for (let p = PASOS; p >= 0; p--) {
      const ts = new Date(AHORA.getTime() - p * 15 * 60_000);
      const hora = ts.getHours();
      const jornada = hora >= 5 && hora <= 19;
      // Un camión en ruta y una máquina específica trabajan de forma continua para producir alertas de uso
      const continuo = (enRuta && d.camion!.id % 3 === 0) || (trabaja && d.maquina!.id % 5 === 0);
      const motor = continuo || ((enRuta || trabaja || rnd() < 0.3) && jornada);
      let vel = 0;
      if (motor) vel = esCamion ? (rnd() < 0.05 ? entre(82, 104) : entre(20, 72)) : entre(0, 12);
      const paso = esCamion ? 0.02 : 0.0015;
      if (motor) { lat += entre(-paso, paso); lng += entre(-paso, paso); }
      const lectura = { velocidad: Math.round(vel * 10) / 10, motorEncendido: motor, timestamp: ts };
      lecturas.push({ dispositivoId: d.id, latitud: lat, longitud: lng, ...lectura });
      const r = evaluarLecturaGPS(lectura, historial, esCamion);
      historial.push(lectura);
      const nombre = d.camion ? `Camión ${d.camion.placa}` : `Máquina ${d.maquina!.codigo}`;
      const giro: GiroNegocio = d.camion?.giro ?? "MAQUINARIA";
      const referencia = d.camion ? `camion:${d.camion.id}` : `maquina:${d.maquina!.id}`;
      if (r.excesoVelocidad) {
        alertas.push({ tipo: "EXCESO_VELOCIDAD", severidad: lectura.velocidad > REGLAS.velocidadMaximaCamion + 20 ? "CRITICA" : "ADVERTENCIA", giro, titulo: `${nombre}: exceso de velocidad`, mensaje: `Registró ${lectura.velocidad.toFixed(0)} km/h (límite ${REGLAS.velocidadMaximaCamion} km/h) en ${lat.toFixed(4)}, ${lng.toFixed(4)}.`, referencia, createdAt: ts, leida: p > 40 });
      }
      if (r.usoExcesivo && !alertaUso) {
        alertaUso = true;
        alertas.push({ tipo: "USO_EXCESIVO", severidad: "ADVERTENCIA", giro, titulo: `${nombre}: uso continuo prolongado`, mensaje: `Motor encendido por ${r.horasUsoContinuo.toFixed(1)} h sin descanso (máximo ${REGLAS.horasUsoContinuoMax} h).`, referencia, createdAt: ts });
      }
      if (!lectura.motorEncendido) alertaUso = false;
    }
    await prisma.dispositivoGPS.update({ where: { id: d.id }, data: { ultimaLectura: AHORA } });
  }
  await prisma.lecturaGPS.createMany({ data: lecturas });

  // Alertas de presupuesto e inventario coherentes con los datos
  for (const giro of ["CONSTRUCCION", "TRANSPORTE_MP"] as GiroNegocio[]) {
    alertas.push({ tipo: "PRESUPUESTO_100", severidad: "CRITICA", giro, titulo: `${giro === "CONSTRUCCION" ? "Servicios de Construcción" : "Transporte de Materia Prima"}: presupuesto excedido`, mensaje: "La ejecución del mes en curso superó el 100 % del presupuesto asignado.", referencia: `presupuesto:${giro}:${AHORA.getFullYear()}-${AHORA.getMonth() + 1}`, createdAt: diasAtras(1, 11) });
  }
  const invBajo = await prisma.inventario.findMany({ include: { material: true, sede: true } });
  for (const i of invBajo.filter((x) => Number(x.cantidad) < Number(x.material.stockMinimo)).slice(0, 6)) {
    alertas.push({ tipo: "INVENTARIO_BAJO", severidad: "ADVERTENCIA", giro: i.sede.giro, titulo: `${i.sede.nombre}: inventario bajo de ${i.material.nombre}`, mensaje: `Quedan ${Number(i.cantidad).toFixed(2)} ${i.material.unidad} (mínimo ${Number(i.material.stockMinimo)}).`, referencia: `inventario:${i.sedeId}:${i.materialId}`, createdAt: diasAtras(entero(0, 3), 14) });
  }
  await prisma.alerta.createMany({ data: alertas.map((a) => ({ ...a, rolesDestino: AUDIENCIA_ALERTAS[a.tipo] })) });

  const { usuarios: usuariosComerciales, ...comercial } = await sembrarComercial({ sedes, clientes, hash, nViaje });

  await prisma.bitacora.createMany({
    data: [
      { usuarioId: usuariosCreados[0].id, accion: "CARGA_INICIAL", entidad: "Sistema", detalle: "Carga inicial de datos de TransPort ERP", createdAt: diasAtras(0, 7) },
    ],
  });

  const resumen = {
    sedes: Object.keys(sedes).length, usuarios: usuarios.length + usuariosComerciales, camiones: camiones.length, maquinas: maquinas.length,
    viajes: nViaje - 1, solicitudes: nSol - 1, ordenes: nOp - 1, extracciones: extracciones.length, gastos: gastos.length,
    lecturasGPS: lecturas.length, alertas: alertas.length, ...comercial,
  };
  console.table(resumen);
}

// ─── Comercial: vendedores, dirección, portal de clientes, pedidos, reuniones y mensajes ─

/** Llave de API de demostración para Cemex (documentada en el README). */
const LLAVE_DEMO_CEMEX = "tp_demo_cemex_000000000000000000000";

async function sembrarComercial({
  sedes,
  clientes,
  hash,
  nViaje,
}: {
  sedes: Record<string, { id: number; nombre: string }>;
  clientes: { id: number; nombre: string }[];
  hash: (p: string) => string;
  nViaje: number;
}) {
  console.log("🤝 Comercial y portal de clientes");
  const unDia = 86_400_000;
  /** Fecha a `dias` de hoy a la `hora` de Guatemala (UTC−6). */
  const enDias = (dias: number, hora = 10) => {
    const f = new Date(AHORA.getTime() + dias * unDia);
    f.setUTCHours(hora + 6, 0, 0, 0);
    return f;
  };

  // Personal comercial y dirección
  const personal = [
    { nombre: "Lic. Eduardo Paiz", email: "direccion@transport.gt", password: "Direccion2026!", rol: "DIRECCION", giro: null, sede: "CORP-Z10" },
    { nombre: "Daniela Monterroso", email: "ventas.proceso@transport.gt", password: "Vendedor2026!", rol: "VENDEDOR", giro: "PROCESO", sede: "PLA-ZAC" },
    { nombre: "Kevin Tobar", email: "ventas.maquinaria@transport.gt", password: "Vendedor2026!", rol: "VENDEDOR", giro: "MAQUINARIA", sede: "MAQ-GUA" },
    { nombre: "Mynor Ajú", email: "ventas.mp@transport.gt", password: "Vendedor2026!", rol: "VENDEDOR", giro: "TRANSPORTE_MP", sede: "TMP-SAN" },
    { nombre: "Andrea Solís", email: "ventas.transporte@transport.gt", password: "Vendedor2026!", rol: "VENDEDOR", giro: "TRANSPORTE_PROD", sede: "TPR-QTZ" },
    { nombre: "Javier Cifuentes", email: "ventas.construccion@transport.gt", password: "Vendedor2026!", rol: "VENDEDOR", giro: "CONSTRUCCION", sede: "CON-GUA" },
  ] as const;
  const vendedor: Partial<Record<GiroNegocio, number>> = {};
  for (const u of personal) {
    const creado = await prisma.usuario.create({
      data: { nombre: u.nombre, email: u.email, password: hash(u.password), rol: u.rol, giro: u.giro, sedeId: sedes[u.sede].id, ultimoAcceso: diasAtras(entero(0, 3)) },
    });
    if (u.giro) vendedor[u.giro] = creado.id;
  }

  // Cartera: cada cliente con el vendedor de su giro principal (el orden es el de CLIENTES)
  const CARTERA: GiroNegocio[] = ["TRANSPORTE_MP", "TRANSPORTE_MP", "TRANSPORTE_MP", "CONSTRUCCION", "CONSTRUCCION", "MAQUINARIA", "PROCESO", "TRANSPORTE_PROD", "TRANSPORTE_PROD", "TRANSPORTE_PROD", "TRANSPORTE_PROD", "TRANSPORTE_PROD"];
  const DIRECCIONES: Record<number, string> = {
    0: "Km 46.5 carretera al Atlántico, Sanarate, El Progreso",
    5: "Bodega de obra, 7.ª avenida 5-10, zona 4, Guatemala",
    6: "Calzada Roosevelt 22-43, zona 11, Guatemala",
    10: "Centro de distribución, km 16.5 carretera a El Salvador",
  };
  for (const [i, c] of clientes.entries()) {
    await prisma.cliente.update({ where: { id: c.id }, data: { vendedorId: vendedor[CARTERA[i]], direccion: DIRECCIONES[i] ?? null } });
  }

  // Usuarios del portal de clientes
  const PORTAL = [
    { cliente: 0, nombre: "Lic. Andrea Morales", email: "cemex@clientes.transport.gt" },
    { cliente: 5, nombre: "Ing. Pedro Ajú", email: "sigma@clientes.transport.gt" },
    { cliente: 6, nombre: "Sr. Julio Coy", email: "elmartillo@clientes.transport.gt" },
  ];
  const usuarioPortal: Record<number, number> = {};
  for (const u of PORTAL) {
    const creado = await prisma.usuario.create({
      data: { nombre: u.nombre, email: u.email, password: hash("Cliente2026!"), rol: "CLIENTE", clienteId: clientes[u.cliente].id, ultimoAcceso: diasAtras(entero(0, 6)) },
    });
    usuarioPortal[u.cliente] = creado.id;
  }

  // Pedidos de clientes y de Construcción a las plantas de proceso
  const catalogo = await prisma.producto.findMany();
  const precios = new Map(catalogo.map((p) => [p.id, Number(p.precio)]));
  const plantas = [sedes["PLA-ZAC"], sedes["PLA-HUE"], sedes["PLA-PET"]];
  const camionesProd = await prisma.camion.findMany({ where: { giro: "TRANSPORTE_PROD" } });
  const pilotos = await prisma.piloto.findMany({ where: { activo: true } });
  const obras = await prisma.proyectoConstruccion.findMany({ where: { estado: "EN_EJECUCION" }, take: 2 });
  const cantidadPara = (unidad: string) => (unidad === "m²" ? entero(15, 120) * 10 : unidad === "saco" ? entero(4, 40) * 10 : entero(8, 60) * 100);
  const PLAN: { cliente: number | null; estado: "SOLICITADO" | "CONFIRMADO" | "EN_PREPARACION" | "DESPACHADO" | "ENTREGADO" | "CANCELADO"; dias: number; canal?: "PORTAL" | "API" | "CSV" }[] = [
    { cliente: 6, estado: "ENTREGADO", dias: 58 }, { cliente: 5, estado: "ENTREGADO", dias: 51 }, { cliente: 10, estado: "ENTREGADO", dias: 44, canal: "API" },
    { cliente: 6, estado: "ENTREGADO", dias: 37, canal: "CSV" }, { cliente: 5, estado: "CANCELADO", dias: 33 }, { cliente: 6, estado: "ENTREGADO", dias: 26 },
    { cliente: 10, estado: "ENTREGADO", dias: 19, canal: "API" }, { cliente: 6, estado: "ENTREGADO", dias: 14 }, { cliente: 5, estado: "ENTREGADO", dias: 11 },
    { cliente: 0, estado: "CANCELADO", dias: 9 }, { cliente: 6, estado: "DESPACHADO", dias: 6 }, { cliente: 10, estado: "DESPACHADO", dias: 5, canal: "API" },
    { cliente: 5, estado: "EN_PREPARACION", dias: 4 }, { cliente: 6, estado: "EN_PREPARACION", dias: 4, canal: "CSV" }, { cliente: 6, estado: "CONFIRMADO", dias: 3 },
    { cliente: 5, estado: "CONFIRMADO", dias: 2 }, { cliente: 0, estado: "SOLICITADO", dias: 2 }, { cliente: 6, estado: "SOLICITADO", dias: 1 },
    { cliente: 10, estado: "SOLICITADO", dias: 0, canal: "API" }, { cliente: null, estado: "EN_PREPARACION", dias: 5 }, { cliente: null, estado: "SOLICITADO", dias: 1 },
  ];
  const alertas: Prisma.AlertaCreateManyInput[] = [];
  let nPed = 1;
  let viaje = nViaje;
  for (const plan of PLAN) {
    const elegidos = [...catalogo].sort(() => rnd() - 0.5).slice(0, entero(1, 3));
    const { lineas, total } = calcularPedido(elegidos.map((p) => ({ productoId: p.id, cantidad: cantidadPara(p.unidad) })), precios);
    const cliente = plan.cliente === null ? null : clientes[plan.cliente];
    const obra = plan.cliente === null ? obras[nPed % obras.length] : null;
    const creado = new Date(enDias(-plan.dias, entero(8, 16)).getTime() - entero(0, 50) * 60_000);
    const avanzado = plan.estado !== "SOLICITADO" && plan.estado !== "CANCELADO";
    const planta = avanzado ? elegir(plantas) : null;
    const codigoPedido = codigo("PED", nPed++);
    const vendedorPedido = cliente && CARTERA[plan.cliente!] === "PROCESO" ? vendedor.PROCESO : null;
    const direccion = obra ? `${obra.ubicacion}, ${obra.departamento}` : (DIRECCIONES[plan.cliente!] ?? "Bodega del cliente, Ciudad de Guatemala");
    const pedido = await prisma.pedido.create({
      data: {
        codigo: codigoPedido,
        clienteId: cliente?.id ?? null,
        giroSolicitante: obra ? "CONSTRUCCION" : null,
        proyectoId: obra?.id ?? null,
        vendedorId: vendedorPedido,
        plantaId: planta?.id ?? null,
        estado: plan.estado,
        canal: obra ? "INTERNO" : (plan.canal ?? "PORTAL"),
        total,
        direccionEntrega: direccion,
        fechaRequerida: enDias(-plan.dias + entero(5, 12), 12),
        createdAt: creado,
        updatedAt: new Date(Math.min(AHORA.getTime(), creado.getTime() + (plan.estado === "SOLICITADO" ? 0 : entero(2, 6) * unDia))),
        items: { create: lineas.map((l) => ({ ...l, cantidad: dec(l.cantidad), precioUnitario: dec(l.precioUnitario), subtotal: dec(l.subtotal) })) },
      },
    });

    // La mitad de los entregados viajó con Transporte de productos
    if (plan.estado === "ENTREGADO" && nPed % 2 === 0 && camionesProd.length && pilotos.length) {
      const km = entero(40, 260);
      const toneladas = Math.round(entre(4, 18) * 10) / 10;
      const salida = new Date(creado.getTime() + entero(2, 4) * unDia);
      await prisma.viaje.create({
        data: {
          codigo: codigo("VJ", viaje++), tipo: "PRODUCTO", modalidad: "NACIONAL", clienteId: cliente?.id ?? null,
          camionId: elegir(camionesProd).id, pilotoId: elegir(pilotos).id, origen: planta!.nombre, destino: direccion,
          carga: elegidos.map((p) => p.nombre).join(", ").slice(0, 120), toneladas: dec(toneladas), distanciaKm: km,
          tarifa: dec(calcularTarifaViaje(km, toneladas, "NACIONAL")), estado: "ENTREGADO", fechaSalida: salida,
          fechaEntrega: new Date(salida.getTime() + entero(4, 20) * 3_600_000), pedidoId: pedido.id,
        },
      });
    }

    // Avisos: el pedido nuevo al vendedor y el último cambio al cliente
    if (plan.estado === "SOLICITADO") {
      alertas.push({
        tipo: "PEDIDO", severidad: "INFO", giro: "PROCESO", titulo: `Nuevo pedido ${codigoPedido} de ${cliente?.nombre ?? "Servicios de Construcción"}`,
        mensaje: `${lineas.length} producto${lineas.length === 1 ? "" : "s"} por Q${total.toLocaleString("en-US")}; entrega en ${direccion}.`,
        referencia: `pedido:${pedido.id}`, createdAt: creado,
        ...(vendedorPedido ? { usuarioId: vendedorPedido, rolesDestino: [] } : { rolesDestino: ["VENDEDOR", "GERENTE"] }),
      });
    }
    if (cliente && plan.estado !== "SOLICITADO" && plan.dias <= 14) {
      alertas.push({
        tipo: "PEDIDO", severidad: plan.estado === "CANCELADO" ? "ADVERTENCIA" : "INFO", giro: "PROCESO", clienteId: cliente.id,
        titulo: `Pedido ${codigoPedido}: ${plan.estado.toLowerCase().replace("_", " ")}`,
        mensaje: plan.estado === "ENTREGADO" ? "Su pedido fue entregado. Gracias por su compra." : plan.estado === "CANCELADO" ? "Su pedido fue cancelado. Su vendedor se comunicará con usted." : "Su pedido avanza en la planta.",
        referencia: `pedido:${pedido.id}`, createdAt: new Date(creado.getTime() + unDia), leida: plan.dias > 5,
      });
    }
  }

  // Reuniones: clientes y prospectos del sitio web
  const REUNIONES: { cliente?: number; contacto?: string; empresa?: string; email?: string; giro: GiroNegocio; estado: "SOLICITADA" | "CONFIRMADA" | "REALIZADA" | "CANCELADA"; dias: number; hora: number; modalidad: "PRESENCIAL" | "VIDEOCONFERENCIA"; motivo: string }[] = [
    { cliente: 0, giro: "TRANSPORTE_MP", estado: "CONFIRMADA", dias: 1, hora: 10, modalidad: "VIDEOCONFERENCIA", motivo: "Renovación del contrato anual de fletes Sanarate – plantas" },
    { cliente: 5, giro: "MAQUINARIA", estado: "SOLICITADA", dias: 3, hora: 9, modalidad: "PRESENCIAL", motivo: "Alquiler de dos excavadoras para la obra de la zona 4" },
    { cliente: 6, giro: "PROCESO", estado: "CONFIRMADA", dias: 5, hora: 15, modalidad: "PRESENCIAL", motivo: "Precios por volumen de piso y block para el primer trimestre" },
    { cliente: 1, giro: "MAQUINARIA", estado: "CONFIRMADA", dias: 2, hora: 11, modalidad: "VIDEOCONFERENCIA", motivo: "Compra de un cargador frontal usado" },
    { contacto: "Jorge Méndez", empresa: "Ferretería El Sol", email: "jmendez@ferreteriaelsol.example", giro: "PROCESO", estado: "SOLICITADA", dias: 2, hora: 10, modalidad: "VIDEOCONFERENCIA", motivo: "Distribuir porcelanato y adhesivo en Quetzaltenango" },
    { contacto: "Lucía Hernández", empresa: "Agroindustrias del Pacífico", email: "lhernandez@agropacifico.example", giro: "TRANSPORTE_PROD", estado: "SOLICITADA", dias: 4, hora: 14, modalidad: "VIDEOCONFERENCIA", motivo: "Contenedores de Puerto Quetzal a bodega en Escuintla, 12 por mes" },
    { contacto: "Arq. Fernando Rivas", empresa: "Desarrollos Altamira", email: "frivas@altamira.example", giro: "CONSTRUCCION", estado: "CONFIRMADA", dias: 7, hora: 9, modalidad: "PRESENCIAL", motivo: "Cotización de un edificio de oficinas de seis niveles" },
    { contacto: "Ing. Marco Tulio Paz", empresa: "Minera Santa Fe", email: "mtpaz@minerasantafe.example", giro: "EXTRACCION", estado: "SOLICITADA", dias: 6, hora: 11, modalidad: "VIDEOCONFERENCIA", motivo: "Compra de 2,000 t mensuales de piedra caliza" },
    { cliente: 10, giro: "TRANSPORTE_PROD", estado: "REALIZADA", dias: -6, hora: 10, modalidad: "VIDEOCONFERENCIA", motivo: "Rutas inter fronteras hacia El Salvador y Honduras" },
    { cliente: 2, giro: "TRANSPORTE_MP", estado: "REALIZADA", dias: -12, hora: 9, modalidad: "PRESENCIAL", motivo: "Ampliación de la flota asignada a la planta" },
    { cliente: 3, giro: "CONSTRUCCION", estado: "REALIZADA", dias: -20, hora: 10, modalidad: "PRESENCIAL", motivo: "Avance del puente sobre el río Motagua" },
    { cliente: 8, giro: "TRANSPORTE_PROD", estado: "CANCELADA", dias: -3, hora: 16, modalidad: "VIDEOCONFERENCIA", motivo: "Tarifas de transporte de cemento a San Salvador" },
  ];
  for (const [i, r] of REUNIONES.entries()) {
    const cliente = r.cliente !== undefined ? clientes[r.cliente] : null;
    const contacto = r.cliente !== undefined ? CLIENTES[r.cliente].contacto : r.contacto!;
    const codigoReunion = codigo("REU", i + 1);
    const vendedorId = vendedor[r.giro] ?? null;
    const reunion = await prisma.reunion.create({
      data: {
        codigo: codigoReunion, clienteId: cliente?.id ?? null, contacto, empresa: cliente?.nombre ?? r.empresa, giro: r.giro, vendedorId,
        email: r.email ?? `${contacto.split(" ").at(-1)!.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}@clientes.transport.gt`,
        fecha: enDias(r.dias, r.hora), modalidad: r.modalidad, motivo: r.motivo, estado: r.estado,
        enlace: r.modalidad === "VIDEOCONFERENCIA" && r.estado !== "SOLICITADA" ? `https://videollamada.transport.gt/${codigoReunion}` : null,
        createdAt: enDias(Math.min(r.dias, 0) - entero(2, 6), 9),
      },
    });
    if (r.estado === "SOLICITADA") {
      alertas.push({
        tipo: "REUNION", severidad: "INFO", giro: r.giro, titulo: `Reunión solicitada por ${reunion.empresa ?? contacto}`,
        mensaje: `${r.motivo} · propuesta para el ${reunion.fecha.toLocaleDateString("es-GT")}.`, referencia: `reunion:${reunion.id}`, createdAt: reunion.createdAt,
        ...(vendedorId ? { usuarioId: vendedorId, rolesDestino: [] } : { rolesDestino: ["GERENTE", "VENDEDOR"] }),
      });
    }
    if (r.estado === "CONFIRMADA" && cliente) {
      alertas.push({
        tipo: "REUNION", severidad: "INFO", giro: r.giro, clienteId: cliente.id, titulo: `Reunión ${codigoReunion} confirmada`,
        mensaje: `${reunion.fecha.toLocaleString("es-GT", { timeZone: "America/Guatemala" })} · ${r.modalidad === "PRESENCIAL" ? "Edificio Sixtino, zona 10" : `Videoconferencia: ${reunion.enlace}`}`,
        referencia: `reunion:${reunion.id}`, createdAt: new Date(reunion.createdAt.getTime() + unDia),
      });
    }
  }

  // Conversaciones del portal
  const CONVERSACIONES: { cliente: number; giro: GiroNegocio; mensajes: [boolean, string, number][] }[] = [
    { cliente: 0, giro: "TRANSPORTE_MP", mensajes: [
      [false, "Buenos días, Lic. Morales. Le comparto por aquí la propuesta de renovación de fletes para 2027.", 72],
      [true, "Gracias, Mynor. La revisamos con compras y la comentamos en la reunión de mañana.", 50],
    ] },
    { cliente: 5, giro: "MAQUINARIA", mensajes: [
      [true, "Buenas tardes. ¿Tienen disponible una motoniveladora para la próxima semana en la zona 4?", 20],
    ] },
    { cliente: 6, giro: "PROCESO", mensajes: [
      [true, "Hola Daniela, ¿podemos agregar 500 m² de piso 33×33 al pedido que está en preparación?", 30],
      [false, "Claro, Sr. Coy. Lo dejamos como pedido aparte para no atrasar el despacho de hoy.", 28],
      [true, "Perfecto. ¿Me confirma la fecha de entrega del pedido nuevo?", 4],
    ] },
  ];
  let nMensajes = 0;
  for (const conv of CONVERSACIONES) {
    const cliente = clientes[conv.cliente];
    for (const [deCliente, texto, horas] of conv.mensajes) {
      await prisma.mensaje.create({
        data: {
          clienteId: cliente.id, autorId: deCliente ? usuarioPortal[conv.cliente] : vendedor[conv.giro]!, texto, deCliente,
          leido: horas > 24, createdAt: new Date(AHORA.getTime() - horas * 3_600_000),
        },
      });
      nMensajes++;
    }
    const ultimo = conv.mensajes.at(-1)!;
    if (ultimo[0] && ultimo[2] <= 24) {
      alertas.push({
        tipo: "MENSAJE", severidad: "INFO", giro: conv.giro, usuarioId: vendedor[conv.giro], rolesDestino: [],
        titulo: `Mensaje de ${cliente.nombre}`, mensaje: ultimo[1], referencia: `mensaje:${cliente.id}`, createdAt: new Date(AHORA.getTime() - ultimo[2] * 3_600_000),
      });
    }
  }
  await prisma.alerta.createMany({ data: alertas });

  // Integración de demostración: llave de API de Cemex
  await prisma.apiKey.create({ data: { nombre: "ERP de compras de Cemex (demostración)", prefijo: prefijoDe(LLAVE_DEMO_CEMEX), hash: hashLlave(LLAVE_DEMO_CEMEX), clienteId: clientes[0].id } });

  return { usuarios: personal.length + PORTAL.length, pedidos: nPed - 1, reuniones: REUNIONES.length, mensajes: nMensajes, llaveApiDemo: LLAVE_DEMO_CEMEX };
}

function descripcionGasto(cat: CategoriaGasto) {
  const op: Record<CategoriaGasto, string[]> = {
    PLANILLA: ["Planilla quincenal personal operativo", "Planilla quincenal personal administrativo", "Pago de horas extra", "Cuota patronal IGSS"],
    COMBUSTIBLE: ["Diésel flota — estación Puma", "Diésel flota — estación Shell", "Combustible maquinaria pesada", "Lubricantes y aceites"],
    MANTENIMIENTO: ["Servicio preventivo 10,000 km", "Cambio de llantas", "Reparación sistema hidráulico", "Repuestos de motor", "Mantenimiento de banda transportadora"],
    MATERIALES: ["Compra de cemento gris", "Hierro corrugado 3/8\"", "Esmaltes y pigmentos cerámicos", "Empaques y tarimas", "Explosivos controlados"],
    ARRENDAMIENTO: ["Arrendamiento de terreno", "Alquiler de equipo complementario", "Arrendamiento de bodega"],
    SERVICIOS: ["Energía eléctrica EEGSA", "Servicio de agua", "Internet y telefonía", "Seguridad privada", "Videoconferencias — licencias"],
    GPS: ["Servicio GPS-Inversiones"],
    OTROS: ["Papelería y útiles", "Viáticos", "Capacitación de personal", "Equipo de protección personal"],
  };
  return elegir(op[cat]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
