/**
 * Adaptador del proveedor GPS-Inversiones.
 *
 * El servicio contratado expone las posiciones de cada dispositivo pero sólo
 * mediante su visor web y sin alertas. Este adaptador define el contrato que
 * usa TransPort ERP para obtener lecturas; en desarrollo se usa un simulador
 * y en producción se reemplaza por el cliente HTTP real (o por el webhook
 * /api/gps/lecturas si el proveedor empuja los datos).
 */
export type LecturaProveedor = {
  imei: string;
  latitud: number;
  longitud: number;
  velocidad: number; // km/h
  motorEncendido: boolean;
  timestamp: Date;
};

export type EstadoPrevio = {
  imei: string;
  latitud: number;
  longitud: number;
  motorEncendido: boolean;
  esCamion: boolean;
};

export interface ProveedorGPS {
  obtenerPosiciones(dispositivos: EstadoPrevio[], ahora: Date): Promise<LecturaProveedor[]>;
}

/**
 * Simulador: desplaza cada activo de forma aleatoria cerca de su última posición.
 * Una pequeña fracción de dispositivos no reporta en cada consulta (zonas sin cobertura).
 */
export class SimuladorGPSInversiones implements ProveedorGPS {
  constructor(
    private random: () => number = Math.random,
    private probabilidadSinCobertura = 0.03,
  ) {}

  async obtenerPosiciones(dispositivos: EstadoPrevio[], ahora: Date) {
    return dispositivos.filter(() => this.random() >= this.probabilidadSinCobertura).map((d) => {
      const r = this.random();
      // 85 % de probabilidad de mantener el estado del motor
      const motorEncendido = r < 0.85 ? d.motorEncendido || this.random() < 0.6 : !d.motorEncendido;
      const paso = d.esCamion ? 0.03 : 0.002;
      let velocidad = 0;
      if (motorEncendido) {
        velocidad = d.esCamion
          ? // ~12 % de lecturas superan 80 km/h para ejercitar las alertas
            this.random() < 0.12 ? 82 + this.random() * 25 : 25 + this.random() * 50
          : this.random() * 15;
      }
      const factor = motorEncendido ? paso : 0;
      return {
        imei: d.imei,
        latitud: clamp(d.latitud + (this.random() - 0.5) * factor, 13.7, 17.8),
        longitud: clamp(d.longitud + (this.random() - 0.5) * factor, -92.2, -88.2),
        velocidad: Math.round(velocidad * 10) / 10,
        motorEncendido,
        timestamp: ahora,
      };
    });
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function obtenerProveedorGPS(): ProveedorGPS {
  return new SimuladorGPSInversiones();
}
