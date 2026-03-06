# LOCK REPORT v1 (2026-03-06)

Base: snapshot JSON de Supabase entregado por el equipo (project ref `wkwztjpvtsmwvgumywfi`).

## 1. Estado Congelado (AS-IS)

### 1.1 Infra y datos
- Proyecto correcto: `wkwztjpvtsmwvgumywfi`.
- Filas actuales: `0` en todas las tablas de negocio (`row_estimates`).
- Buckets existentes y vacios:
  - `form-uploads`
  - `meeting-attachments`
  - `reimbursements`

### 1.2 Modelo actual confirmado
- Core: `app_users`, `organizations`, `tenants`, `tenant_members`.
- Operacion: `students`, `payments`, `expenses`, `reimbursements`, `activities`, `scheduled_activities`, `dashboard_notifications`, `payment_notifications`, `posts`, `forms`.
- Soporte: `user_roles`, `user_students`, `admin_permissions`, `audit_logs`, `credit_*`, `activity_*`.
- Enums de rol actuales: `owner`, `master`, `admin`, `member`, `student`, `alumnos`.

### 1.3 Hallazgos tecnicos del lock
- `tenant_id` existe en tablas criticas (bien para multi-tenant).
- `audit_logs` existe (base de trazabilidad disponible).
- `expenses` en estado real mantiene columna `description` (no `concept`) y no hay `supplier` en snapshot.
- Existen policies tipo `Unified operator access ...` en tablas core que autorizan por rol/membership sin amarre explicito por `tenant_id` en la expresion de policy.

## 2. Modelo Objetivo (TO-BE) aprobado para negocio

### 2.1 Roles funcionales del tenant
- `owner`: unico por tenant. Control total.
- `staff`: misma potestad operativa que owner.
- Diferencia unica: solo `owner` puede crear/eliminar/promover staff.
- `alumno`/`apoderado`: vistas y acciones restringidas (portal sesgado).

### 2.2 Superadmin
- Queda fuera del alcance inmediato funcional del tenant.
- Se deja para etapa final de plataforma.

## 3. Brechas a cerrar (AS-IS vs TO-BE)

### 3.1 Brecha de permisos
- Hoy hay sistema dual (`tenant_members` + `user_roles`) y roles redundantes (`master`, `owner`, `admin`).
- Necesario unificar la logica de autorizacion efectiva por tenant para evitar bloqueos o ambiguedad.

### 3.2 Brecha de aislamiento por tenant
- Policies unificadas recientes no expresan filtro por `tenant_id` en cada tabla de operacion.
- Debe cerrarse para impedir cualquier riesgo de cruce entre tenants.

### 3.3 Brecha de seguridad operativa
- Existen edge functions en modo prueba con `verify_jwt = false` y/o validacion comentada.
- Debe reactivarse autenticacion fuerte antes de considerar entorno productivo.

### 3.4 Brecha de auditoria integral
- `audit_logs` existe, pero se requiere cobertura sistematica de eventos clave.
- Hoy no hay evidencia de cobertura completa y uniforme en todos los modulos.

## 4. Definicion de auditoria minima obligatoria

Registrar en `audit_logs` (o mecanismo equivalente) al menos:
- Gestion de usuarios del tenant:
  - alta/baja/edicion de staff
  - alta/baja/edicion de alumnos/apoderados
- Finanzas:
  - creacion/edicion/eliminacion de pagos y egresos
  - aprobacion/rechazo de notificaciones de pago
  - creacion/edicion/aprobacion/rechazo de rendiciones
- Operacion:
  - creacion/edicion/eliminacion de actividades
  - exclusiones
  - formularios y respuestas administrativas
  - publicaciones/notificaciones dashboard
- Configuracion:
  - cambios de permisos
  - cambios de estado del tenant

Campos minimos por evento:
- `tenant_id`, `user_id`, `action`, `table_name`, `record_id`, `payload`, `created_at`.

## 5. Plan de cierre sin romper (orden recomendado)

1. Congelar contrato de roles del tenant:
   - Owner unico
   - Staff operativo
   - Restriccion owner-only para gestion de staff

2. Alinear RLS por tenant:
   - Policies con condicion por `tenant_id` en tablas operativas.

3. Endurecer edge functions:
   - `verify_jwt = true`
   - validar token y rol por tenant en funciones sensibles.

4. Unificar auth en frontend:
   - resolver precedencia `roleInCurrentTenant` vs `userRole` bajo contrato final.

5. Activar auditoria integral:
   - registrar eventos clave definidos arriba.

6. Regenerar tipos desde schema real:
   - mantener `types.ts` alineado con estado actual tras migraciones.

## 6. Criterio de salida (Definition of Done)

Se considera cerrado cuando:
- No hay acciones de staff permitidas a alumno/apoderado.
- Solo owner puede gestionar staff.
- Staff y owner comparten mismas capacidades operativas del tenant.
- No existe lectura/escritura cruzada entre tenants en pruebas controladas.
- Todas las acciones criticas generan registro de auditoria con actor y contexto.
- Flujos criticos pasan en web y mobile:
  - onboarding
  - alumnos/apoderados
  - pagos/egresos
  - rendiciones
  - actividades
  - formularios
  - notificaciones

## 7. Nota de control

Este lock report no reemplaza migraciones SQL ni pruebas E2E.
Es el contrato operativo base para ejecutar fixes sin desviarse por legacy.
