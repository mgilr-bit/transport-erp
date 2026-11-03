import "server-only";
import { prisma } from "@/lib/db";
import { REGLAS } from "@/lib/constants";
import { distanciaKm, evaluarLecturaGPS, horasCruzadas } from "@/lib/reglas";
import { obtenerProveedorGPS, type LecturaProveedor } from "@/lib/gps/proveedor";
import type { GiroNegocio } from "@/app/generated/prisma/client";

const VENTANA_HISTORIAL_MS = 24 * 3_600_000;

/** Descarga las posiciones del proveedor para todos los dispositivos activos. */
export async function sincronizarGPS(ahora = new Date()) {
  const dispositivos = await prisma.dispositivoGPS.findMany({
    where: { activo: true },
    include: {
      camion: true,
      maquina: { include: { sede: true } },
      lecturas: { orderBy: { timestamp: "desc" }, take: 1 },
    },
  });

  const previos = dispositivos.map((d) => {
    const ultima = d.lecturas[0];
    const sede = d.maquina?.sede;
    return {
      imei: d.imei,
      latitud: ultima?.latitud ?? sede?.latitud ?? 14.6,
      longitud: ultima?.longitud ?? sede?.longitud ?? -90.5,
      motorEncendido: ultima?.motorEncendido ?? false,
      esCamion: d.tipoActivo === "CAMION",
    };
  });

  const lecturas = await obtenerProveedorGPS().obtenerPosiciones(previos, ahora);
  let alertas = 0;
  for (const lectura of lecturas) alertas += await procesarLectura(lectura);
  alertas += await detectarSinSenal(ahora);
  return { lecturas: lecturas.length, dispositivos: dispositivos.length, alertas };
}

/**
 * Genera una alerta SIN_SENAL por cada dispositivo que no reporta desde hace más
 * del umbral configurado. Solo una alerta por periodo de silencio.
 */
export async function detectarSinSenal(ahora = new Date()) {
  const limite = new Date(ahora.getTime() - REGLAS.minutosSinSenal * 60_000);
  const silenciosos = await prisma.dispositivoGPS.findMany({
    where: { activo: true, ultimaLectura: { lt: limite } },
    include: { camion: true, maquina: true },
  });
  let creadas = 0;
  for (const d of silenciosos) {
    const activo = describirActivo(d);
    if (!activo || !d.ultimaLectura) continue;
    const existente = await prisma.alerta.findFirst({ where: { tipo: "SIN_SENAL", referencia: activo.ref, createdAt: { gte: d.ultimaLectura } } });
    if (existente) continue;
    const minutos = Math.round((ahora.getTime() - d.ultimaLectura.getTime()) / 60_000);
    await prisma.alerta.create({
      data: {
        tipo: "SIN_SENAL",
        severidad: minutos > 24 * 60 ? "CRITICA" : "ADVERTENCIA",
        giro: activo.giro,
        titulo: `${activo.nombre}: sin señal GPS`,
        mensaje: `El dispositivo ${d.imei} no reporta desde hace ${minutos >= 120 ? `${Math.floor(minutos / 60)} h` : `${minutos} min`} (umbral ${REGLAS.minutosSinSenal} min).`,
        referencia: activo.ref,
      },
    });
    creadas++;
  }
  return creadas;
}

function describirActivo(d: { camion: { id: number; placa: string; giro: GiroNegocio } | null; maquina: { id: number; codigo: string } | null }) {
  if (d.camion) return { nombre: `Camión ${d.camion.placa}`, giro: d.camion.giro, ref: `camion:${d.camion.id}` };
  if (d.maquina) return { nombre: `Máquina ${d.maquina.codigo}`, giro: "MAQUINARIA" as GiroNegocio, ref: `maquina:${d.maquina.id}` };
  return null;
}


/**
 * Guarda una lectura, actualiza horas de uso / kilometraje y genera alertas.
 * Devuelve el número de alertas creadas.
 */
export async function procesarLectura(lectura: LecturaProveedor) {
  const dispositivo = await prisma.dispositivoGPS.findUnique({
    where: { imei: lectura.imei },
    include: { camion: true, maquina: true },
  });
  if (!dispositivo) return 0;

  const historial = await prisma.lecturaGPS.findMany({
    where: {
      dispositivoId: dispositivo.id,
      timestamp: { gte: new Date(lectura.timestamp.getTime() - VENTANA_HISTORIAL_MS), lt: lectura.timestamp },
    },
    orderBy: { timestamp: "asc" },
  });
  const anterior = historial.at(-1);
  const esCamion = dispositivo.tipoActivo === "CAMION";
  const resultado = evaluarLecturaGPS(lectura, historial, esCamion);

  await prisma.$transaction(async (tx) => {
    await tx.lecturaGPS.create({
      data: {
        dispositivoId: dispositivo.id,
        latitud: lectura.latitud,
        longitud: lectura.longitud,
        velocidad: lectura.velocidad,
        motorEncendido: lectura.motorEncendido,
        timestamp: lectura.timestamp,
      },
    });
    await tx.dispositivoGPS.update({
      where: { id: dispositivo.id },
      data: { ultimaLectura: lectura.timestamp },
    });

    if (anterior?.motorEncendido && lectura.motorEncendido) {
      const horas = horasCruzadas(anterior.timestamp, lectura.timestamp);
      if (dispositivo.maquina && horas > 0) {
        await tx.maquina.update({
          where: { id: dispositivo.maquina.id },
          data: { horasUso: { increment: horas } },
        });
      }
      if (dispositivo.camion) {
        const km = Math.round(distanciaKm(anterior.latitud, anterior.longitud, lectura.latitud, lectura.longitud));
        if (km > 0) {
          await tx.camion.update({ where: { id: dispositivo.camion.id }, data: { kilometraje: { increment: km } } });
        }
      }
    }
  });

  const activo = describirActivo(dispositivo);
  if (!activo) return 0;

  let creadas = 0;
  if (resultado.excesoVelocidad) {
    await prisma.alerta.create({
      data: {
        tipo: "EXCESO_VELOCIDAD",
        severidad: lectura.velocidad > REGLAS.velocidadMaximaCamion + 20 ? "CRITICA" : "ADVERTENCIA",
        giro: activo.giro,
        titulo: `${activo.nombre}: exceso de velocidad`,
        mensaje: `Registró ${lectura.velocidad.toFixed(0)} km/h (límite ${REGLAS.velocidadMaximaCamion} km/h) en ${lectura.latitud.toFixed(4)}, ${lectura.longitud.toFixed(4)}.`,
        referencia: activo.ref,
      },
    });
    creadas++;
  }

  if (resultado.usoExcesivo) {
    // Evita duplicar la alerta mientras siga el mismo periodo de uso continuo
    const inicio = new Date(lectura.timestamp.getTime() - resultado.horasUsoContinuo * 3_600_000);
    const existente = await prisma.alerta.findFirst({
      where: { tipo: "USO_EXCESIVO", referencia: activo.ref, createdAt: { gte: inicio } },
    });
    if (!existente) {
      await prisma.alerta.create({
        data: {
          tipo: "USO_EXCESIVO",
          severidad: "ADVERTENCIA",
          giro: activo.giro,
          titulo: `${activo.nombre}: uso continuo prolongado`,
          mensaje: `Motor encendido por ${resultado.horasUsoContinuo.toFixed(1)} h sin descanso (máximo ${REGLAS.horasUsoContinuoMax} h).`,
          referencia: activo.ref,
        },
      });
      creadas++;
    }
  }
  return creadas;
}

/** Última posición conocida de cada activo, para el mapa. */
export async function posicionesActuales() {
  const dispositivos = await prisma.dispositivoGPS.findMany({
    where: { activo: true },
    include: {
      camion: { select: { id: true, placa: true, giro: true, estado: true, tipo: true } },
      maquina: { select: { id: true, codigo: true, tipo: true, estado: true } },
      lecturas: { orderBy: { timestamp: "desc" }, take: 1 },
    },
  });
  const limiteSenal = Date.now() - REGLAS.minutosSinSenal * 60_000;
  return dispositivos
    .filter((d) => d.lecturas.length > 0)
    .map((d) => {
      const l = d.lecturas[0];
      return {
        imei: d.imei,
        tipo: d.tipoActivo,
        nombre: d.camion ? d.camion.placa : `${d.maquina?.codigo} · ${d.maquina?.tipo}`,
        detalle: d.camion ? d.camion.tipo : (d.maquina?.estado ?? ""),
        giro: d.camion?.giro ?? "MAQUINARIA",
        latitud: l.latitud,
        longitud: l.longitud,
        velocidad: l.velocidad,
        motorEncendido: l.motorEncendido,
        timestamp: l.timestamp.toISOString(),
        sinSenal: l.timestamp.getTime() < limiteSenal,
        excesoVelocidad: d.tipoActivo === "CAMION" && l.velocidad > REGLAS.velocidadMaximaCamion,
      };
    });
}

export type PosicionActivo = Awaited<ReturnType<typeof posicionesActuales>>[number];

/** Recorrido de un activo en las últimas horas, con indicadores de uso. */
export async function recorrido(imei: string, horas = 24, ahora = new Date()) {
  const dispositivo = await prisma.dispositivoGPS.findUnique({
    where: { imei },
    include: {
      camion: { include: { sede: { select: { nombre: true } } } },
      maquina: { include: { sede: { select: { nombre: true } }, proyecto: { select: { nombre: true } } } },
      lecturas: { where: { timestamp: { gte: new Date(ahora.getTime() - horas * 3_600_000) } }, orderBy: { timestamp: "asc" } },
    },
  });
  if (!dispositivo) return null;

  const l = dispositivo.lecturas;
  let km = 0;
  let horasMotor = 0;
  for (let i = 1; i < l.length; i++) {
    if (l[i - 1].motorEncendido && l[i].motorEncendido) {
      km += distanciaKm(l[i - 1].latitud, l[i - 1].longitud, l[i].latitud, l[i].longitud);
      horasMotor += (l[i].timestamp.getTime() - l[i - 1].timestamp.getTime()) / 3_600_000;
    }
  }
  const esCamion = dispositivo.tipoActivo === "CAMION";
  return {
    dispositivo,
    puntos: l.map((p) => ({ latitud: p.latitud, longitud: p.longitud, velocidad: p.velocidad, motorEncendido: p.motorEncendido, timestamp: p.timestamp.toISOString() })),
    km,
    horasMotor,
    velocidadMax: l.reduce((m, p) => Math.max(m, p.velocidad), 0),
    excesos: esCamion ? l.filter((p) => p.velocidad > REGLAS.velocidadMaximaCamion).length : 0,
  };
}
