# Cerebro Central de Kurso

## Objetivo del documento

Este documento es el manual interno de referencia para entender Kurso sin tener que recorrer el codigo cada vez.

Sirve para:

- entender la arquitectura funcional de la app
- identificar que hace cada modulo
- saber que rutas existen y para quien son
- saber que edge functions existen y para que sirven
- ubicar las tablas y contratos criticos
- operar cambios sin romper flujos centrales

Este manual esta basado en el estado real del repo y no en supuestos de negocio externos.

## 1. Resumen ejecutivo

Kurso es una app multi-tenant para administracion financiera y operativa de cursos/comunidades escolares.

La app resuelve cinco frentes principales:

- administracion financiera del curso
- gestion de estudiantes y cuentas familiares
- cobros por cuotas, actividades y donaciones
- rendiciones y pagos a proveedores
- comunicacion y portal guardian/mobile

Stack principal:

- Frontend: React + Vite + TypeScript + TanStack Query + Tailwind/shadcn
- Backend: Supabase (Auth, Postgres, Storage, Edge Functions)
- Deploy: Vercel para frontend, Supabase para backend

Proyecto Supabase activo en el repo:

- `supabase/config.toml`
- `project_id = "euhmpuhkwbxorfzrxemp"`

## 2. Modelo de acceso y permisos

### Roles canonicos

La app trabaja hoy con tres roles funcionales:

- `owner`
- `staff`
- `guardian`

Normalizacion central:

- `master -> owner`
- `admin -> staff`
- `alumnos -> guardian`
- `student -> guardian`
- `member -> guardian`

Archivo clave:

- `src/lib/roles.ts`

### Regla operativa real

- `owner`: acceso total al tenant/curso
- `staff`: acceso operativo a casi todos los modulos del curso, pero no debe poder crear mas staff ni escalar privilegios
- `guardian`: acceso al portal mobile/alumno-apoderado

### Como se resuelven los permisos

Hay dos capas:

1. Auth legacy/global:
- `src/contexts/AuthContext.tsx`
- Lee `user_roles`, `admin_permissions`, `user_students`

2. Tenant actual:
- `src/contexts/TenantContext.tsx`
- Lee `tenant_members` y `tenants`

Regla importante:

- `tenant_members` es la fuente operativa por tenant
- `user_roles` sigue existiendo para compatibilidad y `first_login`

## 3. Arquitectura funcional

### 3.1 Frontend

Punto de entrada:

- `src/App.tsx`

La app esta organizada por:

- rutas publicas
- rutas protegidas para `owner/staff`
- rutas protegidas para `guardian`
- rutas de superadmin
- layout principal desktop
- layout mobile para guardian

### 3.2 Contextos principales

- `AuthContext`: sesion, usuario, perfil, `firstLogin`, permisos legacy
- `TenantContext`: tenant activo, tenants disponibles, rol en tenant actual

### 3.3 Fuente de verdad operativa

Reglas que conviene no romper:

- actividades visibles y flujo de donaciones deben mirar `scheduled_activities`
- aprobacion de notificaciones de pago debe pasar por `process-payment-notification`
- mutaciones criticas de rendiciones/pagos a proveedor deben pasar por `manage-reimbursement`
- gestion de usuarios del tenant debe pasar por edge functions, no por inserts directos desde UI

## 4. Mapa de navegacion principal

Archivo:

- `src/config/navigation.ts`

### Dashboard

- `/`
- `/dashboard`

Uso:

- resumen general del curso
- KPIs de ingresos, egresos, deuda, alertas y pendientes

### Finanzas

- `/balance`
- `/historical-setup`
- `/income`
- `/expenses`
- `/credit-management`
- `/credit-movements`

Uso:

- balance actual
- carga historica
- ingresos y egresos
- creditos a favor y movimientos

### Reportes

- `/debt-reports`
- `/payment-reports`

Uso:

- reportes para compartir y exportar

### Estudiantes

- `/students`
- `/student-profile`
- `/activity-payments`

Uso:

- listado de estudiantes
- perfil y estado individual
- estado de pagos por estudiante

### Actividades

- `/activity-exclusions`
- `/scheduled-activities`

Nota:

- `Calendarizacion` es el flujo visible vigente
- `/activities` sigue existiendo como ruta legacy/compatibilidad, pero ya no es el punto operativo recomendado

### Pagos

- `/movements`
- `/monthly-fees`
- `/reimbursements`
- `/payment-notifications`

Uso:

- registrar pagos
- administrar cuotas mensuales
- manejar rendiciones y pagos a proveedor
- revisar y aprobar notificaciones de pago

### Secretaria

- `/meeting-minutes`
- `/posts`

Uso:

- actas
- anuncios y comunicados

### Administracion

- `/branding`
- `/user-management`
- `/mi-cuenta`
- `/admin/audit-logs`
- `/formularios`
- `/close-year`

Uso:

- marca blanca
- gestion de usuarios
- historial de cambios
- formularios
- cierre de anio

## 5. Rutas publicas y comerciales

Rutas publicas relevantes en `src/App.tsx`:

- `/auth`
- `/privacidad`
- `/privacy-choices`
- `/soporte`
- `/blog`
- `/blog/:slug`
- `/pago-exitoso`
- `/pago-pendiente`
- `/pago-fallido`
- `/servicios/tesoreria-de-curso`
- `/servicios/gestion-centros-de-padres`
- `/casos/transparencia-total-colegio-chile`
- `/formulario/:id`
- `/solicitud-pago-proveedor`

Uso:

- login
- paginas legales
- marketing/contenidos
- retorno de cobro SaaS
- formulario publico
- portal publico de solicitud a proveedor

## 6. Portal guardian y mobile

Rutas protegidas para `guardian`:

- `/student-dashboard` -> redirige a `/mobile/board`
- `/payment-portal` -> redirige a `/mobile/payment-portal`
- `/donaciones/:activityId`

Subrutas mobile:

- `/mobile/board`
- `/mobile/finances`
- `/mobile/agenda`
- `/mobile/actas`
- `/mobile/profile`
- `/mobile/payment-portal`

Uso:

- tablero del alumno/apoderado
- pagos, deuda, saldo a favor
- agenda y actividades
- actas
- perfil
- portal de pagos

Nota funcional:

- `guardian` cubre alumno/apoderado como mismo perfil operativo

## 7. Modulos y su funcion real

### Dashboard

Archivo:

- `src/pages/Dashboard.tsx`

Rol:

- vista ejecutiva del tenant

Consulta principalmente:

- `payments`
- `expenses`
- `payment_notifications`
- `reimbursements`
- `students`
- `credit_applications`

### Students

Archivo:

- `src/pages/Students.tsx`

Rol:

- alta, listado, importacion y mantencion de estudiantes

Puntos asociados:

- `StudentImport`
- `create-student-accounts`

### Income / Expenses / Movements

Archivos:

- `src/pages/Income.tsx`
- `src/pages/Expenses.tsx`
- `src/pages/Movements.tsx`

Rol:

- registrar y revisar flujos de caja

### Monthly Fees

Archivo:

- `src/pages/MonthlyFees.tsx`

Rol:

- administrar cuotas mensuales por estudiante/periodo

### Scheduled Activities

Archivo:

- `src/pages/ScheduledActivities.tsx`

Rol:

- calendarizacion de actividades
- base operativa para agenda y donaciones

Tabla critica:

- `scheduled_activities`

### Activity Exclusions

Archivo:

- `src/pages/ActivityExclusions.tsx`

Rol:

- excluir estudiantes de actividades especificas

Tabla critica:

- `activity_exclusions`

### Activity Payments

Archivo:

- `src/pages/ActivityPayments.tsx`

Rol:

- revisar estado de pago por actividad/estudiante

### Payment Notifications

Archivo:

- `src/pages/PaymentNotifications.tsx`

Rol:

- aprobar o rechazar pagos informados por guardian

Motor backend:

- `supabase/functions/process-payment-notification/index.ts`

Regla critica:

- usa el contrato actual de `payment_notifications`
- la aprobacion construye entradas reales en `payments`

### Reimbursements

Archivo:

- `src/pages/Reimbursements.tsx`

Rol:

- manejar rendiciones y pagos a proveedor

Motor backend:

- `supabase/functions/manage-reimbursement/index.ts`

Acciones soportadas:

- aprobar
- rechazar
- reabrir
- eliminar

Regla critica:

- no mutar el estado final desde frontend directo
- toda mutacion debe pasar por la edge function

### Balance

Archivo:

- `src/pages/Balance.tsx`

Rol:

- foto del balance del curso
- ingresos, egresos, saldo inicial, saldo banco

Detalle operativo:

- valores monetarios deben presentarse en CLP sin decimales

### Credit Management / Credit Movements

Archivos:

- `src/pages/CreditManagement.tsx`
- `src/pages/CreditMovements.tsx`

Rol:

- administrar creditos a favor y sus aplicaciones/reversiones

Tablas criticas:

- `student_credits`
- `credit_movements`
- `credit_applications`

### Debt Reports / Payment Reports

Archivos:

- `src/pages/DebtReports.tsx`
- `src/pages/PaymentReports.tsx`

Rol:

- generar informes para compartir/exportar

### Historical Setup / Import / Close Year / Rollover

Archivos:

- `src/pages/HistoricalSetup.tsx`
- `src/pages/ImportData.tsx`
- `src/pages/admin/CloseYear.tsx`
- `src/pages/admin/YearRolloverWizard.tsx`

Rol:

- carga historica
- importacion masiva
- cierre del ciclo
- rollover administrativo

Tablas asociadas:

- `tenant_opening_balances`
- `payments`
- `expenses`
- `students`
- `credit_movements`

### User Management

Archivo:

- `src/pages/UserManagement.tsx`

Rol:

- crear staff
- crear guardian
- resetear password
- listar usuarios y roles

Edge functions asociadas:

- `create-admin-user`
- `create-parent-user`
- `create-student-accounts`
- `get-users-with-roles`
- `delete-user`
- `reset-user-password`

### Audit Logs

Archivo:

- `src/pages/admin/AuditLogs.tsx`

Rol:

- historial de cambios criticos

Tabla:

- `audit_logs`

Columnas que la UI espera hoy:

- `table_name`
- `record_id`
- `payload`
- `action`
- `created_at`

### Forms

Archivos:

- `src/pages/FormList.tsx`
- `src/pages/FormBuilder.tsx`
- `src/pages/FormResponses.tsx`
- `src/pages/PublicForm.tsx`

Rol:

- formularios internos y publicos
- constructor de campos
- respuestas
- exclusiones por formulario

Tablas:

- `forms`
- `form_fields`
- `form_responses`
- `form_exclusions`

### Communication

Archivos:

- `src/pages/PostManagement.tsx`
- `src/pages/MeetingMinutes.tsx`
- mobile `MobileActas.tsx`

Rol:

- anuncios
- actas

### Branding

Archivo:

- `src/pages/TenantBranding.tsx`

Rol:

- configuracion visual y marca blanca por tenant

Soporte publico:

- `public-branding`

### SaaS / Platform Admin

Archivos:

- `src/pages/admin/AdminDashboard.tsx`
- `src/pages/admin/Organizations.tsx`
- `src/pages/admin/OrganizationDetail.tsx`
- `src/pages/admin/TenantsList.tsx`
- `src/pages/admin/UsersList.tsx`
- `src/pages/admin/SaasBilling.tsx`

Rol:

- operacion de plataforma
- organizaciones
- tenants
- usuarios globales
- billing SaaS

## 8. Edge functions: catalogo completo

### Privadas con JWT

#### `check-default-password`

Uso:

- valida si el usuario sigue con `first_login = true`

#### `check-subscriptions`

Uso:

- mantencion de estados de suscripcion SaaS
- trial -> grace period
- active vencido -> past_due
- grace period vencido -> wipeout del tenant

Riesgo:

- es operacion critica de plataforma

#### `create-admin-user`

Uso:

- crea cuentas `staff`

Regla:

- solo `owner`/superadmin

#### `create-parent-user`

Uso:

- crea cuentas `guardian` vinculadas a estudiante

Regla:

- `owner` y `staff` pueden gestionar guardianes

#### `create-student-accounts`

Uso:

- genera cuentas para estudiantes/guardianes desde el universo de estudiantes

#### `create-supplier-request-link`

Uso:

- genera link firmado para portal de proveedor

#### `delete-user`

Uso:

- elimina usuarios del tenant

#### `get-users-with-roles`

Uso:

- lista usuarios del tenant con su rol operativo

#### `manage-reimbursement`

Uso:

- mutacion central de rendiciones y pagos a proveedor

Acciones:

- approve
- reject
- reopen
- delete

#### `mercadopago-checkout`

Uso:

- inicia checkout SaaS

#### `mercadopago-webhook`

Uso:

- recibe confirmaciones de Mercado Pago para el flujo SaaS
- actualiza pagos/logs del plano de plataforma

#### `process-payment-notification`

Uso:

- aprueba/rechaza notificaciones de pago
- al aprobar escribe entradas efectivas en `payments`

#### `reset-password-by-email`

Estado:

- deshabilitada por seguridad
- responde 410

#### `reset-user-password`

Uso:

- reseteo autenticado de password por tenant

#### `send-payment-notification`

Estado:

- deshabilitada temporalmente
- conserva contrato pero no envia email real

#### `send-reimbursement-notification`

Estado:

- deshabilitada temporalmente
- conserva contrato pero no envia SMS real

#### `send-whatsapp-notification`

Estado:

- deshabilitada temporalmente
- conserva contrato pero no envia WhatsApp real

### Publicas por diseno

#### `submit-supplier-payment-request`

Uso:

- portal publico de solicitud/rendicion para proveedor

#### `mercadopago-webhook`

Uso:

- recepcion de webhook de Mercado Pago para SaaS

#### `public-branding`

Uso:

- entrega branding publico por `formId` o token firmado de proveedor

### Estado especial

#### `ai-chat`

Situacion actual:

- existe carpeta, pero no hay `index.ts`
- se debe tratar como placeholder/no implementada

## 9. Flujos criticos de negocio

### Flujo 1: login y contexto inicial

1. Supabase Auth abre sesion.
2. `AuthContext` carga `app_users`, `user_roles`, `user_students`.
3. `TenantContext` resuelve tenants disponibles.
4. Se determina rol efectivo en el tenant.
5. Si `first_login = true`, se fuerza cambio de password.

### Flujo 2: cambio de tenant

1. Usuario cambia tenant.
2. `TenantContext` actualiza `currentTenant`.
3. Se recalcula `roleInCurrentTenant`.
4. Los modulos vuelven a consultar segun `tenant_id`.

### Flujo 3: guardian informa pago

1. Entra a `PaymentPortal`.
2. Informa monto, fecha y detalle.
3. Se guarda en `payment_notifications`.
4. Staff revisa en `PaymentNotifications`.
5. `process-payment-notification` aprueba o rechaza.
6. Si aprueba, se generan entradas finales en `payments`.

### Flujo 4: cuotas y actividades

1. Se definen cuotas mensuales o actividades calendarizadas.
2. `scheduled_activities` es la referencia operativa para agenda y donaciones.
3. Guardian ve actividad/agenda desde mobile.
4. Si hay donaciones, entra por `/donaciones/:activityId`.

### Flujo 5: rendiciones y pagos a proveedor

1. Usuario crea rendicion o pago a proveedor.
2. Se lista en `Reimbursements`.
3. `manage-reimbursement` resuelve accion.
4. Aprobar crea/asegura egreso consistente.
5. Reabrir devuelve estado a pendiente y revierte efecto asociado.

### Flujo 6: cuentas familiares y staff

1. `owner` crea staff via `create-admin-user`.
2. `owner` o `staff` crean guardian via `create-parent-user`.
3. `create-student-accounts` sirve para generar cuentas desde estudiantes existentes.

### Flujo 7: formularios publicos

1. Owner/staff crean formulario.
2. Se publica `formulario/:id`.
3. Respuestas llegan a `form_responses`.
4. `public-branding` permite mostrar identidad publica del tenant.

### Flujo 8: portal de proveedor

1. Usuario interno genera link via `create-supplier-request-link`.
2. Proveedor entra con token firmado.
3. `public-branding` devuelve marca publica.
4. `submit-supplier-payment-request` registra la solicitud.

## 10. Tablas mas importantes

El codigo usa al menos estas tablas como columna vertebral:

- `tenants`
- `tenant_members`
- `app_users`
- `user_roles`
- `user_students`
- `students`
- `payments`
- `payment_notifications`
- `expenses`
- `reimbursements`
- `activities`
- `scheduled_activities`
- `activity_donations`
- `activity_exclusions`
- `student_credits`
- `credit_movements`
- `credit_applications`
- `forms`
- `form_fields`
- `form_responses`
- `form_exclusions`
- `posts`
- `meeting_minutes`
- `audit_logs`
- `support_requests`
- `account_deletion_requests`
- `tenant_opening_balances`
- `organizations`
- `saas_plans`
- `saas_payment_logs`

## 11. Reglas de coherencia interna

Estas reglas ayudan a no volver a romper la app:

- No introducir un cuarto rol operativo nuevo si no hay una necesidad real.
- No mutar rendiciones desde frontend directo.
- No aprobar pagos sin pasar por `process-payment-notification`.
- No usar `activities` como fuente principal de agenda/donaciones si la logica operativa esta en `scheduled_activities`.
- No crear cuentas de usuario por inserts manuales desde UI.
- No asumir que `user_roles` es la fuente final del tenant; revisar `tenant_members`.
- No reutilizar funciones deshabilitadas de notificacion como si enviaran mensajes reales.

## 12. Puntos sensibles y deuda conocida

### Compatibilidad legacy

Todavia existen rastros de nombres legacy:

- `master`
- `admin`
- `alumnos`

Hoy se absorben por normalizacion de roles. Si se eliminan desde BD/RLS, debe hacerse con una pasada controlada.

### Ruta legacy de actividades

- `/activities` sigue existiendo por compatibilidad
- no es el punto operativo recomendado

### Funciones deshabilitadas

Estas no deben venderse como activas sin secrets y reactivacion real:

- `send-payment-notification`
- `send-reimbursement-notification`
- `send-whatsapp-notification`
- `reset-password-by-email`

### Placeholder

- `ai-chat` no esta implementada

## 13. Como usar este manual al hacer cambios

Si se quiere tocar un flujo, seguir este orden:

1. Identificar ruta/pantalla.
2. Identificar tablas afectadas.
3. Revisar si hay edge function asociada.
4. Revisar si el flujo depende de tenant, rol o `first_login`.
5. Cambiar contrato en un solo lugar y luego validar UI, function y tipos.

Checklist minimo antes de deploy:

- `npm run audit:supabase`
- `npm run test:business`
- `npm run build`

## 14. Archivos de referencia rapida

- `src/App.tsx`
- `src/config/navigation.ts`
- `src/contexts/AuthContext.tsx`
- `src/contexts/TenantContext.tsx`
- `src/lib/roles.ts`
- `supabase/README.md`
- `supabase/functions/*`
- `src/integrations/supabase/types.ts`

## 15. Inventario completo de rutas

### Publicas

- `/auth`
- `/solicitud-pago-proveedor`
- `/privacidad`
- `/privacy-choices`
- `/soporte`
- `/blog`
- `/blog/:slug`
- `/pago-exitoso`
- `/pago-pendiente`
- `/pago-fallido`
- `/servicios/tesoreria-de-curso`
- `/servicios/gestion-centros-de-padres`
- `/casos/transparencia-total-colegio-chile`
- `/formulario/:id`

### Superadmin

- `/admin`
- `/admin/organizations`
- `/admin/organizations/:id`
- `/admin/tenants`
- `/admin/users`
- `/admin/billing`

### Owner / Staff

- `/close-year`
- `/formularios`
- `/formularios/nuevo`
- `/formularios/:id/editar`
- `/formularios/:id/respuestas`
- `/onboarding`
- `/user-management`
- `/mi-cuenta`
- `/branding`
- `/credit-management`
- `/credit-movements`
- `/student-profile`
- `/admin/rollover`
- `/dashboard`
- `/students`
- `/income`
- `/expenses`
- `/debt-reports`
- `/payment-reports`
- `/balance`
- `/import`
- `/historical-setup`
- `/movements`
- `/activities`
- `/activity-exclusions`
- `/activity-payments`
- `/monthly-fees`
- `/payment-notifications`
- `/reimbursements`
- `/scheduled-activities`
- `/admin/audit-logs`
- `/meeting-minutes`
- `/posts`

### Guardian

- `/donaciones/:activityId`
- `/student-dashboard`
- `/payment-portal`
- `/mobile`
- `/mobile/board`
- `/mobile/finances`
- `/mobile/agenda`
- `/mobile/actas`
- `/mobile/profile`
- `/mobile/payment-portal`

### Fallback

- `*`

## 16. Inventario completo de edge functions

### Implementadas

- `check-default-password`
- `check-subscriptions`
- `create-admin-user`
- `create-parent-user`
- `create-student-accounts`
- `create-supplier-request-link`
- `delete-user`
- `get-users-with-roles`
- `manage-reimbursement`
- `mercadopago-checkout`
- `mercadopago-webhook`
- `process-payment-notification`
- `public-branding`
- `reset-password-by-email`
- `reset-user-password`
- `send-payment-notification`
- `send-reimbursement-notification`
- `send-whatsapp-notification`
- `submit-supplier-payment-request`
- `submit-support-request`
- `delete-my-account`

### Compartidas

- `_shared/parentUserPermissions.ts`
- `_shared/paymentNotificationEntries.ts`
- `_shared/reimbursementActions.ts`

### No implementada

- `ai-chat`

## 17. Conclusion

Si hay que explicar Kurso en una frase:

Kurso es un sistema multi-tenant para administrar un curso desde un solo tablero, con control financiero, cuentas familiares, agenda, formularios, rendiciones, branding y portal guardian/mobile, apoyado por Supabase como backend transaccional y por edge functions para mutaciones criticas.

Si hay que explicar donde no conviene improvisar:

- roles
- tenant actual
- notificaciones de pago
- rendiciones/pagos a proveedor
- actividades calendarizadas
- cuentas de usuarios
