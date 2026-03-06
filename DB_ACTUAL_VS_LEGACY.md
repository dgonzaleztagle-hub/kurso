# Mapa BD Actual vs Legacy (Kurso)

Ultima actualizacion: 2026-03-06

## 1) Objetivo
Este documento define el **modelo actual esperado** de la base de datos y los puntos de compatibilidad legacy que existen en el codigo.
Sirve para evitar mezclar columnas/tablas antiguas al migrar o recrear proyectos Supabase.

## 2) Fuente de verdad
- Modelo tipado de cliente: `src/integrations/supabase/types.ts`
- Migraciones SQL: `supabase/migrations/*`
- Compatibilidad en frontend: `src/pages/*` y `src/components/*` (fallbacks legacy)

Nota: hoy hay diferencias entre `types.ts` y el esquema que realmente se ha ido ajustando por SQL manual/migraciones recientes. Antes de congelar un release, regenerar tipos.

## 3) Proyecto Supabase actual (testing)
- URL: `https://wkwztjpvtsmwvgumywfi.supabase.co`
- Project ref: `wkwztjpvtsmwvgumywfi`

## 4) Tablas principales (modelo actual de negocio)

### 4.1 Core SaaS / Multi-tenant
- `app_users`: perfil publico de usuario (nombre, email, whatsapp, flag superadmin).
- `organizations`: entidad organizacional de nivel plataforma.
- `tenants`: curso/colegio operativo (owner, estado de suscripcion, settings).
- `tenant_members`: membresias por tenant (rol por curso: owner/admin/alumnos, etc).
- `admin_permissions`: modulos denegados/gestion de permisos finos para admins.

### 4.2 Usuarios y vinculaciones academicas
- `user_roles`: metadatos de usuario en la app (rol legacy, nombre visible, cargo, telefono, first_login).
- `students`: alumnos del tenant.
- `user_students`: vinculo apoderado/alumno.

### 4.3 Finanzas
- `payments`: ingresos/cobros (cuotas, actividades, otros).
- `expenses`: egresos/gastos.
- `payment_notifications`: comprobantes de pago enviados por apoderados para aprobacion/rechazo.
- `reimbursements`: rendiciones y pagos a proveedor.
- `student_credits`: saldo a favor por alumno.
- `credit_movements`: historial de movimientos de credito.

### 4.4 Actividades
- `activities`: actividades cobrables (monto, fecha, configuraciones).
- `scheduled_activities`: agenda/calendario de actividades.
- `activity_exclusions`: alumnos excluidos de una actividad.
- `scheduled_activity_exclusions`: exclusiones en agenda programada.
- `activity_donations`: donaciones/insumos asociados a actividades.

### 4.5 Formularios y comunicacion
- `forms`: formulario base.
- `form_fields`: campos del formulario.
- `form_responses`: respuestas enviadas.
- `form_exclusions`: exclusiones de formulario por alumno.
- `dashboard_notifications`: avisos masivos en dashboard.
- `posts`: anuncios/comunicados (si esta aplicada la migracion `20250102_create_posts_table.sql`).

### 4.6 Integraciones
- `twilio_accounts`: configuracion de cuentas Twilio.

## 5) Funciones RPC relevantes
- `create_own_tenant`: alta de tenant inicial para usuario autenticado.
- `admin_has_permission`: chequeo de permisos por modulo.
- `has_role`: validacion de rol (incluye alias owner/admin/master segun migraciones recientes).
- `get_next_payment_folio`, `get_next_expense_folio`, `get_next_reimbursement_folio`: folios correlativos.

## 6) Convenciones actuales recomendadas (canon)

Usar siempre estas columnas en nuevas implementaciones:
- `expenses.concept` (no `description`)
- `expenses.supplier` (no `provider`)
- `tenant_id` en tablas operativas por tenant (pagos, egresos, actividades, rendiciones, notificaciones de dashboard, etc.)

## 7) Compatibilidad legacy activa en codigo

### 7.1 Egresos
Compatibilidad implementada:
- Lectura: `supplier || provider`
- Lectura: `concept || description`
- Inserciones con fallback cuando falla `concept` o `supplier`.

Archivo clave:
- `src/pages/Expenses.tsx`
- `src/pages/Movements.tsx`

### 7.2 Movimientos/Pagos/Actividades
Compatibilidad implementada para esquemas viejos sin `tenant_id` en algunas tablas:
- Reintento de insercion sin `tenant_id` si el backend reporta columna inexistente.

Archivos clave:
- `src/pages/Movements.tsx`
- `src/pages/Activities.tsx`
- `src/pages/ScheduledActivities.tsx`

### 7.3 Balance
Normalizacion defensiva de conceptos en lectura:
- `concept || description`
- Evita crashes por valores nulos.

Archivo clave:
- `src/pages/Balance.tsx`

## 8) Problemas historicos que este documento evita
- Mezclar `description`/`provider` con `concept`/`supplier`.
- Insertar sin `tenant_id` en tablas que ya lo exigen (`NOT NULL` + RLS).
- Asumir que `types.ts` refleja 100% el estado real cuando hubo SQL manual reciente.

## 9) Checklist para nuevas migraciones
1. Crear migracion SQL con columna/indice/policy.
2. Aplicar en Supabase destino.
3. Regenerar tipos:
   - `npx supabase gen types typescript --project-id wkwztjpvtsmwvgumywfi --schema public > src/integrations/supabase/types.ts`
4. Revisar fallbacks legacy y eliminarlos solo cuando el esquema nuevo este consolidado.
5. Probar flujos criticos:
   - registro/login/onboarding
   - crear alumno
   - ingreso/egreso
   - rendicion/pago proveedor
   - notificaciones dashboard
   - actividades y calendarizacion

## 10) Estado recomendado a futuro
- Mantener este documento como referencia operativa.
- Cuando se cierre la etapa de transicion, eliminar compatibilidad legacy y dejar solo esquema canon.
