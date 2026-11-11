# Requisitos pendientes del caso — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar sitio público, portal de clientes, área comercial, alertas por rol y recordatorios, reportes,
integraciones, PWA y Docker según `docs/superpowers/specs/2026-11-10-requisitos-caso-design.md`.

**Architecture:** Una sola app Next.js 16 con tres áreas (`(sitio)`, `(portal)`, `(app)`). La lógica pura va en
`lib/` con pruebas Vitest; el acceso a datos en `lib/services/`; las escrituras pasan por `ejecutarAccion`.

**Tech Stack:** Next.js 16.2 (Turbopack, server actions, `after`, `connection`), Prisma 6.19 (cliente sin motor,
adaptador pg), Zod 4, Vitest 3, Tailwind 4, web-push, Docker.

**Ejecución:** inline en esta sesión (el usuario pidió proceder). Cada tarea termina con `npm test`,
`npm run typecheck` y un commit en `feature/requisitos-caso`.

---

### Task 1: Esquema y migración

**Files:** Modify `prisma/schema.prisma`; Create `prisma/migrations/<fecha>_requisitos_caso/migration.sql` (con `npx prisma migrate dev --name requisitos_caso`).

- [ ] `Rol` += VENDEDOR, CLIENTE, DIRECCION. `TipoAlerta` += PEDIDO, REUNION, MENSAJE, RECORDATORIO.
- [ ] Enums nuevos: `EstadoPedido`, `CanalPedido`, `EstadoReunion`, `ModalidadReunion`.
- [ ] `Usuario.clienteId?`; `Cliente.vendedorId?`, `Cliente.direccion?`; `Viaje.pedidoId? @unique`.
- [ ] `Alerta.rolesDestino Rol[] @default([])`, `usuarioId?`, `clienteId?` con índices.
- [ ] Modelos `Pedido`, `PedidoItem`, `Reunion`, `Mensaje`, `ApiKey`, `Webhook`, `PushSuscripcion`.
- [ ] Migrar la base local, `npm run typecheck`, commit.

### Task 2: Roles, sesión y menú

**Files:** Modify `lib/auth-rules.ts`, `lib/auth.ts`, `lib/session.ts`, `app/actions/auth.ts`, `lib/navegacion.ts`, `lib/constants.ts` (ROLES); Test `__tests__/permisos.test.ts`.

- [ ] Pruebas: DIRECCION ve todo y no opera ni registra gastos; VENDEDOR ve su giro y no opera; CLIENTE no ve
      ni opera nada interno; `puedeGestionarPedidos` (ADMIN; GERENTE/VENDEDOR/OPERADOR de PROCESO);
      `puedeGestionarReuniones(s, giro)` (ADMIN; GERENTE/VENDEDOR del giro); menú de vendedor incluye Comercial.
- [ ] `esCorporativo` incluye DIRECCION; `esInterno`; `puedeOperar` falso para roles sin operación.
- [ ] `SessionPayload.clienteId`; `getUsuarioActual` lo lee de la base; `requireSession` envía clientes a
      `/portal`; `requireCliente`; `filtroGiro` rechaza clientes; login redirige según rol.
- [ ] `ItemNav.regla?`; secciones Comercial (`/ventas`, `/reportes`) y `/admin/integraciones`.

### Task 3: Rutas públicas

**Files:** Create `lib/rutas.ts`; Modify `proxy.ts`; Test `__tests__/rutas.test.ts`.

- [ ] `esRutaPublica(pathname)`: `/` exacto; prefijos `/giros`, `/productos`, `/contacto`, `/login`, `/offline`,
      `/api/v1`, `/api/cron`; archivos `/manifest.webmanifest`, `/sw.js`, `/icons/`. Pruebas de casos borde
      (`/girosx` no, `/dashboard` no, `/portal` no).
- [ ] `proxy.ts`: con sesión, `/login` redirige a `/portal` (CLIENTE) o `/dashboard`; `/` ya no redirige.

### Task 4: Alertas por rol

**Files:** Create `lib/alertas.ts`, `lib/services/alertas.ts`; Modify `lib/constants.ts`, `lib/services/{gps,finanzas,inventario}.ts`, `app/(app)/{layout,dashboard/page,alertas/page,gps/page}.tsx`, `app/actions/alertas.ts`, `lib/services/dashboard.ts`; Test `__tests__/alertas.test.ts`.

- [ ] `AUDIENCIA_ALERTAS: Record<TipoAlerta, Rol[]>`.
- [ ] `alertaVisiblePara(alerta, sesion)` y `filtroAlertas(sesion): Prisma.AlertaWhereInput` (pura) con pruebas.
- [ ] `crearAlerta(tx, datos)` aplica audiencia y programa push con `after`.
- [ ] Reemplazar todos los `alerta.create` y los filtros de consulta.

### Task 5: Aprobación de solicitudes

**Files:** Modify `app/actions/produccion.ts`, `app/(app)/flujo/page.tsx`.

- [ ] Aprobar y rechazar con `puedeAprobar` (mina: EXTRACCION o PROCESO; proveedor: PROCESO). El botón solo se
      muestra a quien puede aprobar.

### Task 6: CSV

**Files:** Create `lib/csv.ts`; Test `__tests__/csv.test.ts`.

- [ ] `aCSV(filas, columnas)` con BOM, comillas y saltos; `parseCSV(texto)` con comillas, CRLF, BOM y `;`.

### Task 7: Reglas comerciales

**Files:** Modify `lib/reglas.ts`; Test `__tests__/comercial.test.ts`.

- [ ] `calcularPedido(items, precios)`, `transicionPedido(estado, accion, esCliente)`, `elegirVendedor(...)`.

### Task 8: Servicios y acciones comerciales

**Files:** Create `lib/services/comercial.ts`, `app/actions/comercial.ts`; Modify `lib/services/flujo.ts` (prefijos PED, REU).

- [ ] Pedidos (crear, confirmar, avanzar, cancelar; costo de obra al entregar pedido interno), reuniones
      (solicitar, confirmar, reasignar, realizada, cancelar), mensajes, clientes. Cada cambio crea alertas y
      emite webhooks.

### Task 9: Pantalla Comercial

**Files:** Create `app/(app)/ventas/page.tsx`, `app/(app)/ventas/formularios.tsx`, `app/(app)/ventas/mensajes/[clienteId]/page.tsx`.

### Task 10: Pedidos entre giros

**Files:** Modify `lib/services/flujo.ts` (viajes con `pedidoId`), `app/actions/transporte.ts`, `app/(app)/transporte/viaje-form.tsx`, `app/(app)/construccion/[id]/page.tsx`, `app/(app)/construccion/formularios.tsx`.

### Task 11: Integraciones

**Files:** Create `lib/integraciones/{llaves,firma,webhooks,api}.ts`, `app/api/v1/{productos,pedidos,pedidos/[codigo],viajes,solicitudes}/route.ts`, `app/actions/integraciones.ts`, `app/(app)/admin/integraciones/{page,formularios}.tsx`; Test `__tests__/integraciones.test.ts`.

- [ ] Pruebas: `hashLlave`, `prefijoDe`, formato de llave; `firmar(secreto, cuerpo)` con vector conocido.

### Task 12: Reportes

**Files:** Create `lib/services/reportes.ts`, `app/api/reportes/[tipo]/route.ts`, `app/(app)/reportes/page.tsx`, `components/ui/exportar.tsx`; Modify módulos para agregar botones; `app/globals.css` (impresión).

### Task 13: Recordatorios

**Files:** Modify `lib/reglas.ts`; Create `lib/services/recordatorios.ts`, `app/api/cron/recordatorios/route.ts`, `vercel.json`; Modify `app/(app)/alertas/page.tsx`, `app/actions/alertas.ts`; Test en `__tests__/comercial.test.ts`.

- [ ] `dentroDeVentana(fecha, ahora, dias)` y `claveDia(fecha)` con pruebas.

### Task 14: Sitio público

**Files:** Create `app/(sitio)/{layout,page}.tsx`, `app/(sitio)/giros/[slug]/page.tsx`, `app/(sitio)/productos/page.tsx`, `app/(sitio)/contacto/{page,formulario}.tsx`, `lib/sitio.ts`, `app/actions/sitio.ts`.

### Task 15: Portal de clientes

**Files:** Create `app/(portal)/portal/{layout,page}.tsx`, `pedidos/{page,nuevo/page}.tsx`, `reuniones/page.tsx`, `mensajes/page.tsx`, `estado-de-cuenta/page.tsx`, `formularios.tsx`; `app/actions/portal.ts`; `lib/services/portal.ts`.

### Task 16: Administración de usuarios y clientes

**Files:** Modify `app/actions/admin.ts`, `app/(app)/admin/usuarios/{page,formularios}.tsx`.

### Task 17: PWA

**Files:** Create `app/manifest.ts`, `public/icons/*.png`, `public/sw.js`, `app/offline/page.tsx`, `components/pwa/{registro-sw,notificaciones}.tsx`, `lib/services/push.ts`, `app/actions/push.ts`; Modify `app/layout.tsx`, `next.config.ts`, `package.json` (web-push).

### Task 18: Docker

**Files:** Create `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `scripts/docker-migrar.sh`; Modify `next.config.ts`, `.env.example`.

### Task 19: Datos de demostración

**Files:** Modify `prisma/seed.ts`.

### Task 20: Verificación integral

- [ ] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- [ ] Servidor local: login de cada rol, sitio público, portal, pedido de punta a punta, API con llave, CSV,
      recordatorios por cron, manifest y `sw.js`.
- [ ] `docker compose build` y `docker compose up` si Docker está disponible.

### Task 21: Documentación

**Files:** Modify `README.md`, `.env.example`; regenerar `docs/TransPort-ERP-Documento-Tecnico.docx`.

### Task 22: Producción (requiere confirmación del usuario)

- [ ] Migrar la base de Vercel, recargar la demostración, agregar `CRON_SECRET` (y VAPID opcionales), fusionar en
      `main` y publicar.
