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

La aplicación tiene tres áreas en un mismo despliegue:

- **Sitio web** (`/`, `/giros/…`, `/productos`, `/contacto`): sala de ventas de los seis giros, abierta al público.
- **Portal de clientes** (`/portal`): cada cliente ve sus negocios con todas las empresas del grupo.
- **Sistema interno** (`/dashboard` y módulos): el personal de cada giro y de la sede central.

## Cómo responde al caso

| Requisito del caso | Solución en el sistema |
|---|---|
| Procesos manuales en cada giro | Un módulo por giro con sus operaciones: extracción, órdenes de producción, alquileres y ventas, viajes, obras. |
| Cada giro lleva su propio presupuesto y control de gastos | **Presupuesto y gastos** (`/finanzas`): presupuesto mensual por giro, gastos por sede y categoría y alertas al llegar al 80 % y al 100 %. |
| Pedidos directos entre giros para abastecerse a tiempo | **Flujo de materia prima** (`/flujo`): la planta pide material, Extracción lo despacha desde una mina propia (o se compra a un tercero) y Transporte de MP lo traslada. **Construcción pide materiales** a las plantas desde cada obra, y **Transporte de productos despacha** los pedidos de las plantas. |
| El GPS de GPS-Inversiones solo se ve en su navegador y no genera alertas | **Monitoreo GPS** (`/gps`): mapa con recorrido de 24 h y alertas de exceso de velocidad, uso continuo prolongado y pérdida de señal. |
| Control y reportes desde la sede central | Panel general, **reporte consolidado** imprimible (`/reportes`) y exportación a CSV en cada módulo. |
| Los clientes dan seguimiento a sus operaciones y se comunican | **Portal de clientes**: viajes, alquileres, compras, obras, pedidos, estado de cuenta, mensajes y notificaciones. |
| Pedidos en línea y reuniones con un vendedor asignado | **Pedidos en línea** (catálogo o CSV) y **reuniones** presenciales o por videoconferencia, asignadas automáticamente a un vendedor del giro (`/ventas`). |
| Alertas y recordatorios según el rol | Cada alerta va a los roles interesados (o a un usuario o cliente concreto) y hay **recordatorios diarios**; también por **notificación push**. |
| Sitio web tipo sala de ventas | Página por giro con servicios, sedes y productos o flota reales, catálogo y solicitud de reunión. |
| PWA / móvil multiplataforma | Instalable en iOS, Android y escritorio, con modo sin conexión y notificaciones push. |
| Integración con sistemas de terceros | **API REST** con llaves, **webhooks** firmados e **intercambio de archivos CSV** (`/admin/integraciones`). |
| Despliegue reproducible | **Docker**: `Dockerfile` multietapa y `docker-compose.yml` con PostgreSQL. |

## Requisitos

- Node.js 20 o superior
- PostgreSQL 14 o superior (o Docker)

## Instalación local

```bash
npm install
cp .env.example .env          # y complete las variables (ver abajo)
npx prisma migrate deploy     # crea las tablas
npm run seed                  # carga datos de demostración (180 días de operación)
npm run dev                   # http://localhost:3000
```

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL |
| `SESSION_SECRET` | Firma de las sesiones (`openssl rand -hex 32`) |
| `GPS_WEBHOOK_TOKEN` | Token del webhook del proveedor GPS |
| `CRON_SECRET` | Protege el cron de recordatorios (`/api/cron/recordatorios`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Notificaciones push (opcional; `npx web-push generate-vapid-keys`) |

`npm run db:reset` borra la base de datos, vuelve a aplicar las migraciones y la vuelve a llenar con los datos de demostración.

## Docker

```bash
# Primera vez: compila, crea la base, aplica migraciones y carga la demostración
SESSION_SECRET=$(openssl rand -hex 32) SEED=1 docker compose up --build

# Siguientes veces (sin SEED, para no borrar los datos)
SESSION_SECRET=… docker compose up -d
```

`docker-compose.yml` levanta PostgreSQL 16, un servicio que aplica las migraciones (`SEED=1` carga la demostración y **borra los datos existentes**), la aplicación en el puerto 3000 y un cron diario de recordatorios. La clave pública VAPID se pasa al compilar, porque las variables `NEXT_PUBLIC_*` quedan en el JavaScript del navegador.

## Vercel

Cada push a `main` despliega. Configure las variables anteriores en el proyecto; `vercel.json` programa el cron de recordatorios todos los días a las 6:00 de Guatemala (Vercel envía `CRON_SECRET` en la cabecera). Las migraciones se aplican con `npx prisma migrate deploy` contra la base de producción.

## Cuentas de demostración

| Correo | Contraseña | Rol | Ve |
|--------|-----------|-----|----|
| admin@transport.gt | Admin2026! | Administrador general | Todo, incluida la administración |
| direccion@transport.gt | Direccion2026! | Dirección (dueños) | Todos los giros y reportes, en consulta |
| contabilidad@transport.gt | Conta2026! | Contabilidad | Todos los giros (consulta), registra gastos y asigna presupuestos |
| extraccion@transport.gt | Gerente2026! | Gerente | Extracción minera |
| proceso@transport.gt | Gerente2026! | Gerente | Plantas de proceso |
| maquinaria@transport.gt | Gerente2026! | Gerente | Maquinaria y su GPS |
| transportemp@transport.gt | Gerente2026! | Gerente | Transporte de materia prima |
| transporteprod@transport.gt | Gerente2026! | Gerente | Transporte de productos |
| construccion@transport.gt | Gerente2026! | Gerente | Construcción |
| operador.coban@transport.gt | Operador2026! | Operador | Extracción (opera, no aprueba) |
| ventas.proceso@transport.gt | Vendedor2026! | Vendedor | Pedidos, reuniones y cartera de Plantas de proceso |
| ventas.maquinaria@transport.gt, ventas.mp@…, ventas.transporte@…, ventas.construccion@… | Vendedor2026! | Vendedor | Reuniones y cartera de su giro |
| cemex@clientes.transport.gt | Cliente2026! | Cliente | Portal de Cemex Guatemala |
| sigma@clientes.transport.gt | Cliente2026! | Cliente | Portal de Constructora Sigma |
| elmartillo@clientes.transport.gt | Cliente2026! | Cliente | Portal de Distribuidora El Martillo |

Llave de API de demostración (cliente Cemex): `tp_demo_cemex_000000000000000000000`. Cambie las contraseñas y revoque esta llave en cualquier instalación pública.

## Roles y permisos

- **Administrador**: opera todos los módulos y administra usuarios, sedes, integraciones y bitácora.
- **Dirección**: consulta todos los giros, el área comercial y los reportes; no opera ni registra gastos.
- **Contabilidad**: ve todos los giros pero no opera los módulos. Registra gastos de cualquier giro y asigna presupuestos.
- **Gerente**: ve, opera y aprueba en su giro.
- **Operador**: ve y opera su giro, sin aprobar.
- **Vendedor**: atiende los pedidos (si es de Proceso), las reuniones de su giro, su cartera de clientes y sus mensajes.
- **Cliente**: solo el portal de su empresa.

Cada petición valida la sesión contra la base de datos: un usuario desactivado pierde el acceso de inmediato. Las reglas están en `lib/auth-rules.ts`.

## Área comercial y portal

- **Pedidos** de productos de las plantas: SOLICITADO → CONFIRMADO (con planta de despacho) → EN_PREPARACION → DESPACHADO → ENTREGADO, o CANCELADO. Llegan por el portal, la API o un CSV, o los hace otro giro (Construcción para una obra). Si Transporte de productos los despacha en un viaje, el viaje los marca como despachados y entregados. Un pedido interno entregado se registra como costo de materiales de su obra.
- **Reuniones**: el cliente o un prospecto del sitio web elige el giro, la modalidad (presencial en el Edificio Sixtino o videoconferencia) y la fecha; se asigna al vendedor del cliente o al vendedor del giro con menos reuniones pendientes.
- **Mensajes** entre el cliente y su vendedor, con un aviso sin leer por conversación.

## Alertas y recordatorios

| Alerta | Regla | Para |
|---|---|---|
| Exceso de velocidad | Camión a más de 80 km/h (crítica si supera 100 km/h) | Gerencia, operación y dirección del giro |
| Uso continuo prolongado | Motor encendido más de 10 h sin descanso | Gerencia y operación |
| Sin señal | El dispositivo no reporta en 60 min (crítica después de 24 h) | Gerencia y operación |
| Presupuesto al 80 % / excedido | Al registrar un gasto o al reducir el presupuesto | Gerencia, contabilidad y dirección |
| Inventario bajo | Existencia por debajo del mínimo del material | Gerencia y operación |
| Pedido, reunión, mensaje | Pedido nuevo o con cambios, reunión solicitada o confirmada, mensaje del cliente | Vendedor asignado, planta o cliente |
| Recordatorio | Contratos por vencer, materia prima con fecha cercana, hitos vencidos, reuniones y viajes de mañana, pedidos sin confirmar | El giro y rol que deben actuar, y el cliente |

El administrador ve todas las alertas internas. Los recordatorios los genera el cron diario o el administrador desde `/alertas`, y no se repiten en el mismo día. Con las claves VAPID configuradas, cada alerta llega también por notificación push a quienes la verían en pantalla.

## Reportes

- `/reportes`: reporte consolidado del mes (general o por giro): resultado por giro, operación, alertas y principales clientes. Se imprime o guarda como PDF desde el navegador.
- Botones **Exportar CSV** en cada módulo (`/api/reportes/{tipo}`), con el alcance del usuario.

## Integración con terceros

API REST v1 con `Authorization: Bearer <llave>` (o `X-Api-Key`). Las llaves se crean en `/admin/integraciones`, se muestran una vez y se guardan como hash SHA-256.

| Método | Ruta | Llave | Descripción |
|---|---|---|---|
| GET | `/api/v1/productos` | Cliente o proveedor | Catálogo con precio de lista |
| GET / POST | `/api/v1/pedidos` | Cliente | Pedidos del cliente / crear pedido (productos por código) |
| GET / DELETE | `/api/v1/pedidos/{codigo}` | Cliente | Detalle / cancelar si aún no se confirma |
| GET | `/api/v1/viajes` | Cliente | Seguimiento de sus viajes |
| GET | `/api/v1/solicitudes` | Proveedor | Compras de materia prima asignadas |

Los GET aceptan `?formato=csv`. Los **webhooks** salientes (`pedido.creado`, `pedido.actualizado`, `viaje.actualizado`, `solicitud.aprobada`) envían un POST JSON con la cabecera `X-TransPort-Firma: sha256=<HMAC del cuerpo con el secreto>`. Los clientes también pueden **importar pedidos desde CSV** (`codigo,cantidad`) en el portal.

```bash
curl -X POST http://localhost:3000/api/v1/pedidos \
  -H "Authorization: Bearer tp_demo_cemex_000000000000000000000" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"producto":"PT-CAL","cantidad":120}],"direccionEntrega":"Sanarate, El Progreso"}'
```

## Monitoreo GPS

El contrato con el proveedor está en `lib/gps/proveedor.ts`. Se usa un simulador que mueve cada unidad cerca de su última posición y ocasionalmente genera excesos de velocidad y equipos sin cobertura, para que se vean las alertas.

Las lecturas pueden llegar de dos formas:

1. **Consulta**: el botón *Sincronizar con GPS-Inversiones* en `/gps`, que también puede repetirse automáticamente cada 60 s.
2. **Webhook**: el proveedor envía las lecturas a `POST /api/gps/lecturas`.

```bash
curl -X POST http://localhost:3000/api/gps/lecturas \
  -H "Authorization: Bearer $GPS_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"imei":"356938035643817","latitud":14.63,"longitud":-90.51,"velocidad":92,"motorEncendido":true,"timestamp":"2026-10-12T15:30:00-06:00"}]'
```

## PWA

`app/manifest.ts`, íconos en `public/icons` y `public/sw.js` (página sin conexión, caché de recursos estáticos y notificaciones push). Se instala desde el navegador en iOS (Compartir → Agregar a inicio), Android y escritorio. El botón de campana de la barra superior activa las notificaciones en cada dispositivo.

## Arquitectura

```
app/
  (sitio)/…              Sitio web público
  (portal)/portal/…      Portal de clientes
  (auth)/login           Inicio de sesión
  (app)/…                Un módulo por giro, comercial, reportes, gps, alertas, finanzas y admin
  actions/               Server actions: validan con Zod y llaman a los servicios
  api/v1/…               API REST para terceros
  api/reportes/[tipo]    Descarga de reportes CSV
  api/cron/…             Recordatorios diarios
  api/gps/lecturas       Webhook del proveedor GPS
lib/
  reglas.ts              Reglas de negocio puras (sin base de datos), con pruebas unitarias
  alertas.ts             Quién ve cada alerta (rol, giro, usuario o cliente)
  services/              Operaciones con base de datos y transacciones
  integraciones/         Llaves de API, firma y envío de webhooks
  csv.ts                 Exportación e importación CSV
  auth.ts, auth-rules.ts Sesión y permisos
components/              UI reutilizable, gráficas (Recharts), mapa (Leaflet) y PWA
prisma/                  Esquema, migraciones y datos de demostración
Dockerfile, docker-compose.yml, vercel.json
```

Tecnologías: Next.js 16 (App Router, server actions), React 19, Prisma 6 (cliente sin motor nativo, adaptador `pg`) + PostgreSQL, Tailwind CSS 4, Zod 4, Recharts, Leaflet, web-push.

## Pruebas

```bash
npm test            # reglas de negocio, permisos, alertas, rutas, CSV, integraciones (Vitest)
npm run typecheck
npm run lint
```
