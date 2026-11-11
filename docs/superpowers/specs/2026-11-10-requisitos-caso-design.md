# Requisitos pendientes del caso TransPort — Diseño

Fecha: 2026-11-10 · Rama: `feature/requisitos-caso` · Aprobado por el usuario el 2026-11-10.

## Objetivo

Completar los requisitos del proyecto final que el sistema actual no cubre: sitio público, portal de clientes,
pedidos en línea, reuniones con vendedor, alertas por rol y recordatorios, reportes exportables, integración con
terceros (API REST, webhooks, CSV), PWA y despliegue con Docker.

## Enfoque

Todo en la misma aplicación Next.js 16, con tres áreas: sitio público `(sitio)`, portal de clientes `(portal)` y
sistema interno `(app)`. Un solo despliegue, una base de datos y una autenticación. Se descartaron una segunda app
para sitio/portal (duplica despliegue y autenticación) y una app nativa (la PWA cumple el requisito multiplataforma).

## 1. Roles y seguridad

Nuevos valores de `Rol`:

| Rol | Alcance | Puede |
|---|---|---|
| VENDEDOR | Su giro | Atiende pedidos (si es de Proceso), reuniones de su giro, su cartera y mensajes. No opera módulos. |
| CLIENTE | Su cliente (`Usuario.clienteId`) | Solo el portal. |
| DIRECCION | Todos los giros | Consulta todo (dueños). No opera, no registra gastos. Recibe alertas ejecutivas. |

- `esCorporativo` = ADMIN, CONTADOR, DIRECCION. `puedeOperar` es falso para CONTADOR, DIRECCION, VENDEDOR y CLIENTE.
- `requireSession` (área interna) redirige a `/portal` a los clientes; `requireCliente` protege el portal.
  `filtroGiro` lanza error si recibe un cliente (hoy devolvería todo).
- La sesión incluye `clienteId`. El login redirige a `/portal` o `/dashboard` según el rol.
- Aprobar o rechazar solicitudes de materia prima usa `puedeAprobar` (ADMIN o GERENTE del giro). Corrige que un
  operador pudiera aprobar.
- `proxy.ts` usa `esRutaPublica(pathname)` (`lib/rutas.ts`, probada): `/` exacto y los prefijos `/giros`,
  `/productos`, `/contacto`, `/login`, `/offline`, `/api/v1`, `/api/cron`, más manifest, `sw.js` e íconos.

## 2. Alertas por rol y recordatorios

`Alerta` agrega `rolesDestino Rol[]` (vacío = todos los roles del giro), `usuarioId?` (destinatario específico) y
`clienteId?` (notificación para el portal). Nuevos tipos: `PEDIDO`, `REUNION`, `MENSAJE`, `RECORDATORIO`.

Visibilidad (función pura `alertaVisiblePara` y su equivalente Prisma `filtroAlertas`):
- Cliente: solo `clienteId` igual al suyo.
- Interno: `clienteId` nulo; si hay `usuarioId`, solo ese usuario (y ADMIN); ADMIN ve todo lo interno; los demás
  necesitan ver el giro y que su rol esté en `rolesDestino` (o que esté vacío).

Audiencia por tipo (`AUDIENCIA_ALERTAS` en `lib/constants.ts`): velocidad → GERENTE, OPERADOR, DIRECCION; uso
continuo, sin señal e inventario bajo → GERENTE, OPERADOR; presupuesto → GERENTE, CONTADOR, DIRECCION; pedido →
VENDEDOR, GERENTE, OPERADOR; reunión y mensaje → VENDEDOR, GERENTE. Todas las alertas se crean con
`crearAlerta(tx, datos)`, que aplica la audiencia y programa el envío push.

Recordatorios diarios (`generarRecordatorios(ahora)`, idempotente por referencia
`recordatorio:<clase>:<id>:<fecha>`): contratos de alquiler que vencen en ≤ 3 días (giro y cliente), solicitudes de
materia prima con fecha requerida en ≤ 2 días sin recibir (al giro responsable según su estado), hitos vencidos,
reuniones confirmadas de mañana (vendedor y cliente), viajes programados para mañana y pedidos sin confirmar por
más de 24 h. Se ejecutan con `GET /api/cron/recordatorios` protegido por `CRON_SECRET` (cron diario de Vercel en
`vercel.json`) y con un botón para el administrador en `/alertas`.

## 3. Área comercial (`/ventas`)

Modelos nuevos:
- `Pedido`: código `PED-AAAA-00000`; `clienteId?` o `giroSolicitante?` (pedido interno de otro giro, con
  `proyectoId?`); `vendedorId?`; `plantaId?` (planta que despacha); estado; total; dirección; fecha requerida;
  notas; canal (PORTAL, API, CSV, INTERNO). `PedidoItem`: producto, cantidad, precio unitario, subtotal.
- `Reunion`: código `REU-AAAA-00000`; `clienteId?` o datos del prospecto (nombre, empresa, correo, teléfono);
  giro; `vendedorId?`; fecha; modalidad (PRESENCIAL en el Edificio Sixtino o VIDEOCONFERENCIA con enlace);
  motivo; estado (SOLICITADA, CONFIRMADA, REALIZADA, CANCELADA).
- `Mensaje`: cliente, autor, texto, `deCliente`, `leido`.
- `Cliente` agrega `vendedorId?` y `direccion?`; `Viaje` agrega `pedidoId?`.

Reglas puras: `calcularPedido` (agrupa productos repetidos, subtotales y total), `transicionPedido` (SOLICITADO →
CONFIRMADO → EN_PREPARACION → DESPACHADO → ENTREGADO; cancelar desde los tres primeros; el cliente solo cancela
SOLICITADO), `elegirVendedor` (el vendedor del cliente si es del giro; si no, el vendedor activo del giro con menos
reuniones pendientes).

Flujo entre giros: Transporte de productos puede programar un viaje para un pedido EN_PREPARACION; al iniciar el
viaje el pedido pasa a DESPACHADO y al entregarlo a ENTREGADO (cancelar el viaje lo devuelve a EN_PREPARACION).
Construcción pide materiales a Proceso desde el detalle de una obra; al entregarse, el total se registra como costo
de la obra (categoría materiales).

Pantalla `/ventas` con pestañas Pedidos, Reuniones, Clientes y Mensajes. Acceso: corporativos (consulta), VENDEDOR,
GERENTE y OPERADOR de Proceso. Los pedidos los gestionan ADMIN y GERENTE, VENDEDOR u OPERADOR de Proceso; las
reuniones, ADMIN y el GERENTE o VENDEDOR del giro. Los clientes los dan de alta ADMIN y los vendedores; los usuarios
de portal se crean en `/admin/usuarios` con rol CLIENTE.

## 4. Sitio público y portal

Sitio `(sitio)`: `/` (presentación, los seis giros, cifras desde la base, llamadas a la acción), `/giros/[slug]`
(servicios, sedes, productos o maquinaria según el giro), `/productos` (catálogo con precios), `/contacto`
(solicitud de reunión para prospectos o clientes; asigna vendedor; campo trampa contra spam y máximo 5 solicitudes
por correo al día). Las páginas que leen la base se renderizan por petición para que la compilación no necesite base.

Portal `/portal`: resumen de sus negocios con cada subempresa (viajes, alquileres, compras, obras, pedidos),
vendedor asignado y notificaciones; pedidos (nuevo desde el catálogo o desde CSV `codigo,cantidad`, cancelar los
solicitados); reuniones; mensajes; estado de cuenta con CSV e impresión.

## 5. Reportes

`lib/csv.ts`: `aCSV` (BOM UTF-8, escape de comillas) y `parseCSV` (comillas, CRLF, BOM, separador `,` o `;`).
`GET /api/reportes/[tipo]` con sesión y permiso por giro: gastos, presupuesto, viajes, extracción, producción,
alquileres, pedidos, alertas, inventario y estado de cuenta (cliente). Botones "Exportar CSV" en los módulos.
`/reportes`: reporte consolidado del mes, general o por giro (ingresos, presupuesto, gasto, ejecución, margen,
operación, alertas y principales clientes), imprimible como PDF desde el navegador. Acceso: corporativos (todos los
giros) y gerentes (el suyo).

## 6. Integración con terceros

- Llaves de API (`ApiKey`: nombre, prefijo, hash SHA-256, cliente o proveedor, activa, último uso). Se muestran una
  sola vez al crearlas.
- `GET /api/v1/productos`; `GET/POST /api/v1/pedidos`, `GET /api/v1/pedidos/[codigo]` y `GET /api/v1/viajes`
  (llave de cliente); `GET /api/v1/solicitudes` (llave de proveedor). Los GET aceptan `?formato=csv`.
- Webhooks salientes (`Webhook`: url, secreto, eventos, cliente o proveedor, último estado): `pedido.creado`,
  `pedido.actualizado`, `viaje.actualizado`, `solicitud.aprobada`. Firma `X-TransPort-Firma: sha256=<HMAC>`,
  tiempo límite de 5 s, envío después de responder (`after`).
- `/admin/integraciones`: llaves, webhooks (con envío de prueba) y documentación de la API.

## 7. PWA y Docker

- PWA: `app/manifest.ts`, íconos PNG en `public/icons`, `public/sw.js` (página `/offline`, caché de estáticos,
  push y clic en notificación) y registro en el layout raíz. Push con `web-push` y claves VAPID opcionales
  (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`); sin claves no se ofrece.
  `PushSuscripcion` por usuario; se eliminan las suscripciones vencidas (404/410).
- Docker: `output: "standalone"` cuando `NEXT_OUTPUT=standalone`; `Dockerfile` multietapa (deps, builder, runner con
  usuario sin privilegios, migrator con Prisma CLI); `docker-compose.yml` con PostgreSQL 16, migración
  (`SEED=1` carga la demostración) y app; `.dockerignore`.

## 8. Datos, pruebas y documentación

- Seed: vendedores por giro, un usuario de dirección, tres clientes con acceso al portal y vendedor asignado,
  pedidos en todos los estados (incluido uno interno de Construcción), reuniones (clientes y prospectos), mensajes,
  una llave de API de demostración y alertas con audiencia.
- Pruebas unitarias para: permisos de los roles nuevos, visibilidad de alertas, rutas públicas, `calcularPedido`,
  `transicionPedido`, `elegirVendedor`, CSV, firma de webhooks, llaves de API y ventanas de recordatorio.
- Actualizar README y el documento técnico.

## Fuera de alcance

Correo electrónico, pagos en línea, chat en tiempo real e inventario de producto terminado.

## Producción

La migración de la base de Vercel y la recarga de datos de demostración se hacen al final y solo con confirmación
del usuario, porque el seed borra los datos. Variables nuevas en Vercel: `CRON_SECRET` y, opcionalmente, las VAPID.
