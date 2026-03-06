# Auditoría Profunda: Mi Kurso App v0.2 (2026-03-06)

**Basado en:** DB_ACTUAL_VS_LEGACY.md (ref oficial 3ba5886)  
**Proyecto Supabase:** `wkwztjpvtsmwvgumywfi`  
**Estado:** En transición de legacy (anterior BD) → canon (modelo actual)

---

## PARTE 1: ESTADO REAL (No es lo que se parece)

### ✅ LO QUE FUNCIONA BIEN

#### 1. Configuración de Proyecto está Alineada
- ✅ `.env` apunta a proyecto correcto: `wkwztjpvtsmwvgumywfi`
- ✅ `supabase/config.toml` apunta a mismo proyecto
- ✅ Migraciones versionadas bajo control (`20250101_*`, `20250102_*`, `20260305_*`, `20260306_*`)

#### 2. Compatibilidad Legacy está Documentada e Implementada
Según `DB_ACTUAL_VS_LEGACY.md` sección 7, hay **fallbacks intencionales** y funcionales:

**Expenses (Egresos):**
- Lectura: normalización defensiva `supplier || provider` ✅ [Expenses.tsx#L69](src/pages/Expenses.tsx#L69)
- Lectura: normalización defensiva `concept || description` ✅ [Expenses.tsx#L70](src/pages/Expenses.tsx#L70)
- Inserciones con reintento sin columnas legacy si falla ✅

**Movements/Activities:**
- Reintento de inserción sin `tenant_id` si BD reporta columna inexistente ✅
- [Activities.tsx#L76](src/pages/Activities.tsx#L76), [ScheduledActivities.tsx#L243](src/pages/ScheduledActivities.tsx#L243)

**Balance:**
- Normalización defensiva en lectura de conceptos ✅

**Conclusión:** Los fallbacks legacy que detecté en reporte anterior **son intencionales y bien implementados**. No son bugs.

#### 3. Schema Actual Consolidado
Tablas principales documentadas en DB_ACTUAL_VS_LEGACY.md:
- Core SaaS: `app_users`, `organizations`, `tenants`, `tenant_members` ✅
- Académica: `students`, `user_roles`, `user_students` ✅
- Finanzas: `payments`, `expenses`, `reimbursements`, `student_credits` ✅
- Actividades: `activities`, `scheduled_activities`, exclusiones ✅
- Comunicación: `forms`, `form_fields`, `form_responses`, `dashboard_notifications` ✅

#### 4. RPC Correcto para Folios
- `get_next_payment_folio` ✅
- `get_next_expense_folio` ✅
- `get_next_reimbursement_folio` ✅

Implementado en [Payments.tsx](src/pages/Income.tsx), [Expenses.tsx](src/pages/Expenses.tsx), [Reimbursements.tsx](src/pages/Reimbursements.tsx).

---

### 🔴 PROBLEMAS REALES (Bloquean funcionalidad)

#### 1. SEGURIDAD: Edge Functions en "MODO PRUEBA"

**Archivo:** `supabase/config.toml` (líneas 4-26)

```toml
# MODO PRUEBA: Funciones sin verificación JWT
[functions.create-student-accounts]
verify_jwt = false

[functions.get-users-with-roles]
verify_jwt = false

[functions.create-admin-user]
verify_jwt = false

[functions.delete-user]
verify_jwt = false

[functions.reset-user-password]
verify_jwt = false
```

**Problema:**
- 8 funciones críticas ejecutándose sin validación JWT
- Cualquier cliente HTTP puede llamar a `delete-user` o `reset-user-password`
- `get-users-with-roles` expone lista completa de usuarios

**Impacto:** 🔴 ALTO - Potencial data loss, security breach

**Evidencia en código:**
- [get-users-with-roles/index.ts#L50](supabase/functions/get-users-with-roles/index.ts#L50): "MODO PRUEBA: Ejecutando sin verificación de autenticación"
- Verificación de JWT está **comentada**

**Estado:** Marcado como temporal ("MODO PRUEBA"), pero aún en main

---

#### 2. TIPOS DESALINEADOS CON SCHEMA REAL

**Problema:** DB_ACTUAL_VS_LEGACY.md sección 2 advierte:
> "hoy hay diferencias entre `types.ts` y el esquema que realmente se ha ido ajustando por SQL manual/migraciones recientes"

**Evidencia:**
- `src/integrations/supabase/types.ts` generado pero migraciones `20260305_*` y `20260306_*` son posteriores
- Última regeneración de tipos es desconocida
- Comando recomendado en DB_ACTUAL_VS_LEGACY.md 9.3 nunca se menciona en pipeline

**Impacto:** 🟡 MEDIO - Type mismatches al cambiar schema, falsos positive en IDE

**Recomendación en documento:**
```bash
npx supabase gen types typescript --project-id wkwztjpvtsmwvgumywfi --schema public > src/integrations/supabase/types.ts
```

---

#### 3. BUCKETS DE STORAGE INCOMPLETOS

**Documento especifica (sección 6):** `tenant_id` en tablas operativas

Pero buckets usados por código:
- `meeting-attachments` ✅ (creado en 20250101_meeting_minutes.sql)
- `reimbursements` ❌ (usado en [Reimbursements.tsx](src/pages/Reimbursements.tsx) pero **NO creado en migraciones versionadas**)
- `form-uploads` ❌ (usado en [FormBuilder.tsx](src/components/FormBuilder.tsx) pero **NO creado en migraciones versionadas**)

**Impacto:** 🟡 MEDIO - Uploads de reembolsos y formularios fallarán con error 404 en storage

**Búsqueda SQL:**
```sql
-- Solo se encuentra:
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-attachments', 'meeting-attachments', false)
-- En: 20250101_meeting_minutes.sql

-- NO SE ENCUENTRAN EQUIVALENTES PARA:
-- - reimbursements
-- - form-uploads
```

---

#### 4. RLS RECIENTE DESALINEADA CON CÓDIGO LEGACY

**Migraciones más recientes (March 5-6, 2026):**

[20260305_fix_has_role_owner_alias.sql](supabase/migrations/20260305_fix_has_role_owner_alias.sql):
- Fix para function `has_role()` añadiendo alias de `owner` → `master`/`admin`

[20260306_fix_core_rls_for_owner_admin.sql](supabase/migrations/20260306_fix_core_rls_for_owner_admin.sql):
- Reescribe RLS de `payments`, `expenses`, `dashboard_notifications`, `activities`, `forms`, `form_fields`
- **Unified operator access** sin validación de `tenant_id` para owner/master/admin

**Problema:** Dashboard.tsx aún intenta usar `.eq("tenant_id", currentTenant.id)` pero RLS reciente está ignorando tenant_id para ciertas operaciones.

**Riesgo:** 
- Si usuario es `owner` en tenant A, puede ver/editar datos de tenant B si RLS no filtra bien
- [ Dashboard.tsx#L67-L98 ](src/pages/Dashboard.tsx#L67): Múltiples `.eq("tenant_id", ...)` que pueden no estar sincronizadas con RLS nueva

**Impacto:** 🟡 MEDIO-ALTO - Potencial data leak entre tenants si RLS no fue testeada

---

#### 5. ROLES DUAL SYSTEM SIN DOCUMENTACIÓN EN CÓDIGO

**Problema:** Hay dos modelos de roles paralelos:

| Modelo | Tabla | Scope | Roles |
|--------|-------|-------|-------|
| Global | `user_roles` | Por usuario | `master`, `admin`, `owner`, `alumnos`, `student` |
| Multi-tenant | `tenant_members` | Per user-tenant | `owner`, `admin`, `member` |

**Confusión en código:**
- [AuthContext.tsx#L11](src/contexts/AuthContext.tsx#L11): Define `LegacyRole` pero mezcla ambos sistemas
- [TenantContext.tsx#L155](src/contexts/TenantContext.tsx#L155): Fallback a `'student'` si no hay membership (pero nunca chequea global role fallback)
- [ProtectedRoute.tsx#L37](src/components/ProtectedRoute.tsx#L37): `effectiveRole = roleInCurrentTenant || userRole` - pero pueden ser conjuntos de valores incompatibles

**Escenario problemático:**
1. Usuario A es `master` global
2. Usuario A NO tiene membership en tenant X
3. TenantContext carga y no encuentra membership → fallback a `'student'`
4. ProtectedRoute ve `effectiveRole = 'student'`
5. User es bloqueado en funciones que deberían tener acceso como master global

**Impacto:** 🟡 ALTO - Usuarios legitimos pueden quedar bloqueados

---

### 🟠 DEUDA TÉCNICA (Tolerable pero requiere atención)

#### 1. SQL DESTRUCTIVO EN REPO

Archivos peligrosos si se ejecutan out-of-order:
- `supabase/wipeout.sql` - Borra toda la BD
- `supabase/solution_fix_v6_reset.sql` - Reset parcial
- `supabase/20250101_emergency_rollback.sql` - Rollback de emergencia

**Riesgo:** Desarrollador junior ejecuta prueba de "wipeout.sql" en prod por error

**Recomendación:** Mover a carpeta `_dangerous/` con WARNING explícito en README

#### 2. CREDENCIALES EN .env EXPOSIBLE

Service key comentada aún en archivo:
```dotenv
# Service Role Key (DO NOT EXPOSE TO CLIENT)
SUPABASE_SERVICE_ROLE_KEY="[REDACTED_SERVICE_KEY]"
```

Si repo es público, credenciales podrían estar públicamente visibles.

⚠️ **ACCIÓN:** Revisar `.env` en CI/CD - estas keys NO deben estar en version control. Usar GitHub Secrets en su lugar.

---

## PARTE 2: CHECKLIST SEGÚN DB_ACTUAL_VS_LEGACY.md

**Sección 9: Checklist para nuevas migraciones**

Usando como guía referencia... status:

| Paso | Estado | Evidencia |
|------|--------|-----------|
| 1. Crear migracion SQL | ✅ Múltiples | 20260305, 20260306 presentes |
| 2. Aplicar en Supabase destino | ❓ Desconocido | Asumiendo aplicadas, no verificado |
| 3. Regenerar tipos TS | ❌ NO RECIENTE | Último comando no se ve en git history |
| 4. Revisar fallbacks legacy | ✅ Hecho bien | Documentado en DB_ACTUAL_VS_LEGACY.md |
| 5. Probar flujos críticos | ❓ Desconocido | No hay E2E tests visible en repo |

---

## PARTE 3: DIAGNÓSTICO POR MÓDULO

### Auth / Onboarding
- ✅ Signup/Login: funcional con user_roles fallback
- ✅ First login password change: implementado
- ❌ Edge function sin JWT: [create-student-accounts](supabase/functions/create-student-accounts)
- ⚠️ Dual role system não está documentada en UX (usuario confuso entre global/tenant roles)

### Students / Academic
- ✅ CRUD estudiantes: funcional con tenant scope
- ✅ Exclusiones: implementado
- ❓ User-student linking: tabla existe pero implementación parcial (script manual)

### Payments / Income
- ✅ Registrar pagos: funcional
- ✅ Folios: RPC implementado
- ⚠️ RLS reciente sin test visual
- ❌ Edge function sin JWT: [reset-user-password](supabase/functions/reset-user-password) en UserManagement.tsx

### Expenses / Egresos
- ✅ CRUD egresos: funcional con fallbacks legacy (supplier/concept)
- ✅ Folios: RPC implementado
- ⚠️ RLS reciente sin test visual

### Reimbursements
- ✅ CRUD rendiciones: estructura presente
- ❌ Storage bucket `reimbursements` no creado
- ❌ Edge function sin JWT: [send-reimbursement-notification](supabase/functions/send-reimbursement-notification)

### Activities
- ✅ CRUD actividades: funcional con fallback legacy `tenant_id`
- ✅ Scheduled activities: funcional
- ✅ Exclusiones: implementado

### Forms
- ✅ Form builder: presente
- ❌ Storage bucket `form-uploads` no creado
- ⚠️ Form RLS reciente (20260306) sin test visual

### Dashboard
- ✅ Statistics: calcula ingreso/egreso/balance
- ⚠️ Notifications: no usa `tenant_id` filter (pero RLS should handle)
- ⚠️ Deuda detail: múltiples `.eq("tenant_id", ...)` que pueden fallar si tablano tiene column

### Mobile
- ✅ Estructura de rutas presente
- ⚠️ No está claro si contextos de auth/tenant se heredan correctamente

---

## PARTE 4: RECOMENDACIONES POR SEVERIDAD

### 🔴 CRÍTICO (Antes de production)

1. **Habilitar verify_jwt en Edge Functions**
   - [ ] `config.toml`: Cambiar todos los `verify_jwt = false` a `true`
   - [ ] Refactor cada función para validar Authorization header properly
   - [ ] Testar que se rechazan requests sin token

2. **Crear buckets faltantes**
   - [ ] Crear `reimbursements` bucket en nueva migración
   - [ ] Crear `form-uploads` bucket en nueva migración
   - [ ] Asegurarse que RLS está correcta para cada bucket

3. **Testar RLS reciente multi-tenant**
   - [ ] Crear 2 tenants con usuarios en ambos
   - [ ] Verificar que usuario en tenant A NO ve datos de tenant B
   - [ ] Verificar que owner/admin/master puede ver TODO en su tenant

### 🟡 ALTO (Antes del próximo release)

4. **Sincronizar Tipos TS con Schema Real**
   - [ ] Ejecutar: `npx supabase gen types typescript --project-id wkwztjpvtsmwvgumywfi --schema public > src/integrations/supabase/types.ts`
   - [ ] Revisar cambios en git diff
   - [ ] Update código si hay breaking changes

5. **Documentar Dual Role System en Código**
   - [ ] Agregar comment en AuthContext.tsx explicando global vs tenant roles
   - [ ] Agregar comment en TenantContext.tsx explicando fallbacks
   - [ ] Validación de lógica de fallback en ProtectedRoute

6. **Crear E2E Tests Críticos**
   - [ ] Auth flow (signup → first login)
   - [ ] Tenant creation (onboarding)
   - [ ] Payment CRUD (register → approve/reject)
   - [ ] Expense CRUD (register → print)
   - [ ] Reimbursement upload (upload → notification)

### 🟠 MEDIO (Próximas 2 sprints)

7. **Limpiar SQL destructivo**
   - [ ] Mover `wipeout.sql`, `*_reset.sql`, `*_rollback.sql` a `supabase/_dangerous/`
   - [ ] Agregar WARNING prominente en README de esa carpeta

8. **Remover credenciales de .env**
   - [ ] Comentar/remover SUPABASE_SERVICE_ROLE_KEY de `.env`
   - [ ] Documentar que debe venir de GitHub Secrets en CI/CD

---

## PARTE 5: CONCLUSIÓN

**Resumen:**
- App es **funcionalmente viable** en transición
- Compatibilidad legacy está bien implementada per documentación
- **Bloqueadores reales:** seguridad (verify_jwt), buckets incompletos, RLS testing
- **No son bugs críticos:** falsos positives sobre schema que en realidad tienen fallbacks intencionales

**Próximo paso inmediato:**
1. Habilitar JWT en Edge Functions (1-2 horas)
2. Crear buckets faltantes + prueba (1 hora)
3. Regenerar tipos TS (30 mins)
4. Testar flujos críticos e2e (2-3 horas)

**Riesgo sin estos fixes:** Production podría tener data leaks, uploads romper, usuarios bloqueados inconsistentemente.

