-- CreateEnum
CREATE TYPE "GiroNegocio" AS ENUM ('EXTRACCION', 'PROCESO', 'MAQUINARIA', 'TRANSPORTE_MP', 'TRANSPORTE_PROD', 'CONSTRUCCION', 'CORPORATIVO');

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'GERENTE', 'CONTADOR', 'OPERADOR');

-- CreateEnum
CREATE TYPE "TipoSede" AS ENUM ('OFICINA_CENTRAL', 'MINA', 'PLANTA_PROCESO', 'SUCURSAL_MAQUINARIA', 'CENTRO_TRANSPORTE', 'OFICINA_CONSTRUCCION');

-- CreateEnum
CREATE TYPE "EstadoMaquina" AS ENUM ('DISPONIBLE', 'ALQUILADA', 'EN_PROYECTO', 'MANTENIMIENTO', 'VENDIDA');

-- CreateEnum
CREATE TYPE "EstadoContrato" AS ENUM ('ACTIVO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoCamion" AS ENUM ('DISPONIBLE', 'EN_RUTA', 'MANTENIMIENTO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "TipoViaje" AS ENUM ('MATERIA_PRIMA', 'PRODUCTO');

-- CreateEnum
CREATE TYPE "ModalidadViaje" AS ENUM ('NACIONAL', 'INTER_PUERTOS', 'INTER_FRONTERAS', 'PUERTO_A_BODEGA', 'BODEGA_A_PUERTO');

-- CreateEnum
CREATE TYPE "EstadoViaje" AS ENUM ('PROGRAMADO', 'EN_CURSO', 'ENTREGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('PENDIENTE', 'APROBADA', 'EN_TRANSITO', 'RECIBIDA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "EstadoOrdenProduccion" AS ENUM ('PLANIFICADA', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoObra" AS ENUM ('PUENTE', 'CARRETERA', 'EDIFICIO', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoProyecto" AS ENUM ('PLANIFICACION', 'EN_EJECUCION', 'PAUSADO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "CategoriaGasto" AS ENUM ('PLANILLA', 'COMBUSTIBLE', 'MANTENIMIENTO', 'MATERIALES', 'ARRENDAMIENTO', 'SERVICIOS', 'GPS', 'OTROS');

-- CreateEnum
CREATE TYPE "TipoActivoGPS" AS ENUM ('CAMION', 'MAQUINA');

-- CreateEnum
CREATE TYPE "TipoAlerta" AS ENUM ('EXCESO_VELOCIDAD', 'USO_EXCESIVO', 'SIN_SENAL', 'PRESUPUESTO_80', 'PRESUPUESTO_100', 'INVENTARIO_BAJO');

-- CreateEnum
CREATE TYPE "SeveridadAlerta" AS ENUM ('INFO', 'ADVERTENCIA', 'CRITICA');

-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('NACIONAL', 'EXTRANJERO');

-- CreateTable
CREATE TABLE "Sede" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoSede" NOT NULL,
    "giro" "GiroNegocio" NOT NULL,
    "departamento" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "telefono" TEXT,
    "latitud" DOUBLE PRECISION NOT NULL,
    "longitud" DOUBLE PRECISION NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sede_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "giro" "GiroNegocio",
    "sedeId" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoAcceso" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidad" TEXT NOT NULL DEFAULT 'TON',
    "esMateriaPrima" BOOLEAN NOT NULL DEFAULT true,
    "precioRef" DECIMAL(12,2) NOT NULL,
    "stockMinimo" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventario" (
    "id" SERIAL NOT NULL,
    "sedeId" INTEGER NOT NULL,
    "materialId" INTEGER NOT NULL,
    "cantidad" DECIMAL(14,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "nit" TEXT NOT NULL,
    "tipo" "TipoCliente" NOT NULL DEFAULT 'NACIONAL',
    "pais" TEXT NOT NULL DEFAULT 'Guatemala',
    "contacto" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "nit" TEXT NOT NULL,
    "contacto" TEXT,
    "telefono" TEXT,
    "materiales" TEXT NOT NULL,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroExtraccion" (
    "id" SERIAL NOT NULL,
    "sedeId" INTEGER NOT NULL,
    "materialId" INTEGER NOT NULL,
    "toneladas" DECIMAL(12,2) NOT NULL,
    "turno" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroExtraccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsumoProducto" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "materialId" INTEGER NOT NULL,
    "cantidadPorUnidad" DECIMAL(10,4) NOT NULL,

    CONSTRAINT "InsumoProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenProduccion" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "sedeId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoOrdenProduccion" NOT NULL DEFAULT 'PLANIFICADA',
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrdenProduccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudMateriaPrima" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "plantaId" INTEGER NOT NULL,
    "minaId" INTEGER,
    "proveedorId" INTEGER,
    "materialId" INTEGER NOT NULL,
    "toneladas" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'PENDIENTE',
    "fechaRequerida" TIMESTAMP(3) NOT NULL,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitudMateriaPrima_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Maquina" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "serie" TEXT NOT NULL,
    "estado" "EstadoMaquina" NOT NULL DEFAULT 'DISPONIBLE',
    "sedeId" INTEGER NOT NULL,
    "tarifaDiaria" DECIMAL(12,2) NOT NULL,
    "precioVenta" DECIMAL(14,2) NOT NULL,
    "horasUso" INTEGER NOT NULL DEFAULT 0,
    "dispositivoId" INTEGER,
    "proyectoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Maquina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContratoAlquiler" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "maquinaId" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "tarifaDiaria" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "deposito" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado" "EstadoContrato" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContratoAlquiler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VentaMaquina" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "maquinaId" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "precio" DECIMAL(14,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VentaMaquina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Camion" (
    "id" SERIAL NOT NULL,
    "placa" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "capacidadTon" DECIMAL(8,2) NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" "EstadoCamion" NOT NULL DEFAULT 'DISPONIBLE',
    "giro" "GiroNegocio" NOT NULL,
    "sedeId" INTEGER NOT NULL,
    "kilometraje" INTEGER NOT NULL DEFAULT 0,
    "dispositivoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Camion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Piloto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "dpi" TEXT NOT NULL,
    "licencia" TEXT NOT NULL,
    "tipoLicencia" TEXT NOT NULL,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Piloto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Viaje" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoViaje" NOT NULL,
    "modalidad" "ModalidadViaje" NOT NULL DEFAULT 'NACIONAL',
    "clienteId" INTEGER,
    "camionId" INTEGER NOT NULL,
    "pilotoId" INTEGER NOT NULL,
    "origen" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "carga" TEXT NOT NULL,
    "toneladas" DECIMAL(10,2) NOT NULL,
    "distanciaKm" INTEGER NOT NULL,
    "tarifa" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoViaje" NOT NULL DEFAULT 'PROGRAMADO',
    "fechaSalida" TIMESTAMP(3) NOT NULL,
    "fechaEntrega" TIMESTAMP(3),
    "solicitudId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Viaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProyectoConstruccion" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoObra" NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "montoContrato" DECIMAL(16,2) NOT NULL,
    "costoEjecutado" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "avance" INTEGER NOT NULL DEFAULT 0,
    "estado" "EstadoProyecto" NOT NULL DEFAULT 'PLANIFICACION',
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFinEstimada" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProyectoConstruccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HitoProyecto" (
    "id" SERIAL NOT NULL,
    "proyectoId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "peso" INTEGER NOT NULL,
    "completado" BOOLEAN NOT NULL DEFAULT false,
    "fechaMeta" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HitoProyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Presupuesto" (
    "id" SERIAL NOT NULL,
    "giro" "GiroNegocio" NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "monto" DECIMAL(16,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Presupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gasto" (
    "id" SERIAL NOT NULL,
    "giro" "GiroNegocio" NOT NULL,
    "sedeId" INTEGER,
    "categoria" "CategoriaGasto" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "documento" TEXT,
    "usuarioId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispositivoGPS" (
    "id" SERIAL NOT NULL,
    "imei" TEXT NOT NULL,
    "tipoActivo" "TipoActivoGPS" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimaLectura" TIMESTAMP(3),

    CONSTRAINT "DispositivoGPS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LecturaGPS" (
    "id" SERIAL NOT NULL,
    "dispositivoId" INTEGER NOT NULL,
    "latitud" DOUBLE PRECISION NOT NULL,
    "longitud" DOUBLE PRECISION NOT NULL,
    "velocidad" DOUBLE PRECISION NOT NULL,
    "motorEncendido" BOOLEAN NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LecturaGPS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alerta" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoAlerta" NOT NULL,
    "severidad" "SeveridadAlerta" NOT NULL,
    "giro" "GiroNegocio" NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "referencia" TEXT,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bitacora" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "detalle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bitacora_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sede_codigo_key" ON "Sede"("codigo");

-- CreateIndex
CREATE INDEX "Sede_giro_idx" ON "Sede"("giro");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Material_codigo_key" ON "Material"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Inventario_sedeId_materialId_key" ON "Inventario"("sedeId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_nit_key" ON "Cliente"("nit");

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_nit_key" ON "Proveedor"("nit");

-- CreateIndex
CREATE INDEX "RegistroExtraccion_sedeId_fecha_idx" ON "RegistroExtraccion"("sedeId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigo_key" ON "Producto"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "InsumoProducto_productoId_materialId_key" ON "InsumoProducto"("productoId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenProduccion_codigo_key" ON "OrdenProduccion"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "SolicitudMateriaPrima_codigo_key" ON "SolicitudMateriaPrima"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Maquina_codigo_key" ON "Maquina"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Maquina_serie_key" ON "Maquina"("serie");

-- CreateIndex
CREATE UNIQUE INDEX "Maquina_dispositivoId_key" ON "Maquina"("dispositivoId");

-- CreateIndex
CREATE UNIQUE INDEX "ContratoAlquiler_codigo_key" ON "ContratoAlquiler"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "VentaMaquina_codigo_key" ON "VentaMaquina"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "VentaMaquina_maquinaId_key" ON "VentaMaquina"("maquinaId");

-- CreateIndex
CREATE UNIQUE INDEX "Camion_placa_key" ON "Camion"("placa");

-- CreateIndex
CREATE UNIQUE INDEX "Camion_dispositivoId_key" ON "Camion"("dispositivoId");

-- CreateIndex
CREATE UNIQUE INDEX "Piloto_dpi_key" ON "Piloto"("dpi");

-- CreateIndex
CREATE UNIQUE INDEX "Piloto_licencia_key" ON "Piloto"("licencia");

-- CreateIndex
CREATE UNIQUE INDEX "Viaje_codigo_key" ON "Viaje"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Viaje_solicitudId_key" ON "Viaje"("solicitudId");

-- CreateIndex
CREATE INDEX "Viaje_estado_idx" ON "Viaje"("estado");

-- CreateIndex
CREATE INDEX "Viaje_fechaSalida_idx" ON "Viaje"("fechaSalida");

-- CreateIndex
CREATE UNIQUE INDEX "ProyectoConstruccion_codigo_key" ON "ProyectoConstruccion"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Presupuesto_giro_anio_mes_key" ON "Presupuesto"("giro", "anio", "mes");

-- CreateIndex
CREATE INDEX "Gasto_giro_fecha_idx" ON "Gasto"("giro", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "DispositivoGPS_imei_key" ON "DispositivoGPS"("imei");

-- CreateIndex
CREATE INDEX "LecturaGPS_dispositivoId_timestamp_idx" ON "LecturaGPS"("dispositivoId", "timestamp");

-- CreateIndex
CREATE INDEX "Alerta_leida_createdAt_idx" ON "Alerta"("leida", "createdAt");

-- CreateIndex
CREATE INDEX "Bitacora_createdAt_idx" ON "Bitacora"("createdAt");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventario" ADD CONSTRAINT "Inventario_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventario" ADD CONSTRAINT "Inventario_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroExtraccion" ADD CONSTRAINT "RegistroExtraccion_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroExtraccion" ADD CONSTRAINT "RegistroExtraccion_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsumoProducto" ADD CONSTRAINT "InsumoProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsumoProducto" ADD CONSTRAINT "InsumoProducto_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenProduccion" ADD CONSTRAINT "OrdenProduccion_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenProduccion" ADD CONSTRAINT "OrdenProduccion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudMateriaPrima" ADD CONSTRAINT "SolicitudMateriaPrima_plantaId_fkey" FOREIGN KEY ("plantaId") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudMateriaPrima" ADD CONSTRAINT "SolicitudMateriaPrima_minaId_fkey" FOREIGN KEY ("minaId") REFERENCES "Sede"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudMateriaPrima" ADD CONSTRAINT "SolicitudMateriaPrima_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudMateriaPrima" ADD CONSTRAINT "SolicitudMateriaPrima_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maquina" ADD CONSTRAINT "Maquina_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maquina" ADD CONSTRAINT "Maquina_dispositivoId_fkey" FOREIGN KEY ("dispositivoId") REFERENCES "DispositivoGPS"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maquina" ADD CONSTRAINT "Maquina_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "ProyectoConstruccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoAlquiler" ADD CONSTRAINT "ContratoAlquiler_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoAlquiler" ADD CONSTRAINT "ContratoAlquiler_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaMaquina" ADD CONSTRAINT "VentaMaquina_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaMaquina" ADD CONSTRAINT "VentaMaquina_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Camion" ADD CONSTRAINT "Camion_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Camion" ADD CONSTRAINT "Camion_dispositivoId_fkey" FOREIGN KEY ("dispositivoId") REFERENCES "DispositivoGPS"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viaje" ADD CONSTRAINT "Viaje_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viaje" ADD CONSTRAINT "Viaje_camionId_fkey" FOREIGN KEY ("camionId") REFERENCES "Camion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viaje" ADD CONSTRAINT "Viaje_pilotoId_fkey" FOREIGN KEY ("pilotoId") REFERENCES "Piloto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viaje" ADD CONSTRAINT "Viaje_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudMateriaPrima"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProyectoConstruccion" ADD CONSTRAINT "ProyectoConstruccion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HitoProyecto" ADD CONSTRAINT "HitoProyecto_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "ProyectoConstruccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LecturaGPS" ADD CONSTRAINT "LecturaGPS_dispositivoId_fkey" FOREIGN KEY ("dispositivoId") REFERENCES "DispositivoGPS"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bitacora" ADD CONSTRAINT "Bitacora_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
