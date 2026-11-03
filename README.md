# TransPort ERP

Sistema integrado para sistematizar los procesos de **TransPort**, empresa guatemalteca con seis giros de negocio coordinados desde su sede central en el Edificio Sixtino (Zona 10).

| Giro | Sedes | Módulo |
|------|-------|--------|
| Extracción minera | Cobán, El Progreso, Quetzaltenango, Petén | `/extraccion` |
| Plantas de proceso (pisos cerámicos y materiales) | Zacapa, Huehuetenango, Petén | `/proceso` |
| Venta y alquiler de maquinaria | Guatemala, Xela, Zacapa, Petén | `/maquinaria` |
| Transporte de materia prima (Cemex, Cementos Progreso, Hispacensa…) | Sanarate | `/transporte` |
| Transporte de productos (inter puertos, inter fronteras, puerto ↔ bodega) | Puerto Quetzal, Santo Tomás | `/transporte` |
| Construcción (puentes, carreteras, edificios) | Guatemala | `/construccion` |

## Cómo responde al caso

| Problema del caso | Solución en el sistema |
|---|---|
| Procesos manuales en cada giro | Un módulo por giro con sus operaciones: extracción, órdenes de producción, alquileres y ventas, viajes, obras. |
| Cada giro lleva su propio presupuesto y control de gastos | **Presupuesto y gastos** (`/finanzas`): presupuesto mensual por giro, gastos por sede y categoría y alertas automáticas al llegar al 80 % y al 100 %. |
| Un giro depende del producto de otro | **Flujo de materia prima** (`/flujo`). La planta de proceso solicita material, Extracción lo despacha desde una mina propia (o se compra a un tercero) y Transporte de MP lo traslada. Al entregarse, el inventario pasa de la mina a la planta. |
| El GPS de GPS-Inversiones solo se ve en su navegador y no genera alertas | **Monitoreo GPS** (`/gps`). Integra las lecturas en un mapa con el recorrido de 24 h y evalúa cada lectura para generar alertas de exceso de velocidad, uso continuo prolongado y pérdida de señal. |
| Sede central coordina y lleva el registro contable | Roles corporativos (administración y contabilidad) con vista consolidada, panel general y **bitácora** de auditoría. |

## Requisitos

- Node.js 20 o superior
- PostgreSQL 14 o superior

## Instalación

```bash
npm install
cp .env.example .env          # y complete DATABASE_URL, SESSION_SECRET y GPS_WEBHOOK_TOKEN
npx prisma migrate deploy     # crea las tablas
npm run seed                  # carga datos de demostración (180 días de operación)
npm run dev                   # http://localhost:3000
```

Para generar los secretos: `openssl rand -hex 32`.

`npm run db:reset` borra la base de datos, vuelve a aplicar las migraciones y la vuelve a llenar con los datos de demostración.

## Cuentas de demostración

| Correo | Contraseña | Rol | Ve |
|--------|-----------|-----|----|
| admin@transport.gt | Admin2026! | Administrador general | Todo, incluida la administración |
| contabilidad@transport.gt | Conta2026! | Contabilidad | Todos los giros (consulta), registra gastos y asigna presupuestos |
| extraccion@transport.gt | Gerente2026! | Gerente | Extracción minera |
| proceso@transport.gt | Gerente2026! | Gerente | Plantas de proceso |
| maquinaria@transport.gt | Gerente2026! | Gerente | Maquinaria y su GPS |
| transportemp@transport.gt | Gerente2026! | Gerente | Transporte de materia prima |
| transporteprod@transport.gt | Gerente2026! | Gerente | Transporte de productos |
| construccion@transport.gt | Gerente2026! | Gerente | Construcción |
| operador.coban@transport.gt | Operador2026! | Operador | Extracción (opera, no aprueba) |

## Roles y permisos

- **Administrador**: opera todos los módulos y administra usuarios, sedes y bitácora.
- **Contabilidad**: ve todos los giros pero no opera los módulos. Registra gastos de cualquier giro y asigna presupuestos.
- **Gerente / operador**: ven y operan únicamente su giro. El flujo de materia prima lo comparten Proceso, Extracción y Transporte de MP.

Cada petición valida la sesión contra la base de datos. Un usuario desactivado pierde el acceso de inmediato, sin esperar a que expire su token. Las reglas están en `lib/auth-rules.ts`.

## Monitoreo GPS

El contrato con el proveedor está en `lib/gps/proveedor.ts`. En desarrollo se usa un simulador que mueve cada unidad cerca de su última posición. Ocasionalmente genera excesos de velocidad y equipos sin cobertura, para que se vean las alertas.

Las lecturas pueden llegar de dos formas:

1. **Consulta**: el botón *Sincronizar con GPS-Inversiones* en `/gps`, que también puede repetirse automáticamente cada 60 s.
2. **Webhook**: el proveedor envía las lecturas a `POST /api/gps/lecturas`.

```bash
curl -X POST http://localhost:3000/api/gps/lecturas \
  -H "Authorization: Bearer $GPS_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"imei":"356938035643817","latitud":14.63,"longitud":-90.51,"velocidad":92,"motorEncendido":true,"timestamp":"2026-10-12T15:30:00-06:00"}]'
```

Alertas que genera el sistema (umbrales en `lib/constants.ts → REGLAS`):

| Alerta | Regla |
|---|---|
| Exceso de velocidad | Camión a más de 80 km/h (crítica si supera 100 km/h) |
| Uso continuo prolongado | Motor encendido más de 10 h sin descanso |
| Sin señal | El dispositivo no reporta en 60 min (crítica después de 24 h) |
| Presupuesto al 80 % / excedido | Al registrar un gasto o al reducir el presupuesto |
| Inventario bajo | Existencia por debajo del mínimo del material |

## Arquitectura

```
app/
  (auth)/login           Inicio de sesión
  (app)/…                Un módulo por giro, más gps, alertas, finanzas y admin
  actions/               Server actions: validan con Zod y llaman a los servicios
  api/gps/lecturas       Webhook del proveedor GPS
lib/
  reglas.ts              Reglas de negocio puras (sin base de datos), con pruebas unitarias
  services/              Operaciones con base de datos y transacciones
  auth.ts, auth-rules.ts Sesión y permisos
  action.ts              Envoltorio estándar: autoriza, ejecuta, registra en bitácora y revalida
components/              UI reutilizable, gráficas (Recharts) y mapa (Leaflet)
prisma/                  Esquema, migraciones y datos de demostración
```

Tecnologías: Next.js 16 (App Router, server actions), React 19, Prisma 6 + PostgreSQL, Tailwind CSS 4, Zod 4, Recharts, Leaflet.

## Pruebas

```bash
npm test            # reglas de negocio, permisos y simulador GPS (Vitest)
npm run typecheck
npm run lint
```
