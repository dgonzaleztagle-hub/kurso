# Auditoría de Reactivación (2026-03-05)

## 1) Estado general del repositorio

- Proyecto principal: `remix-of-pagos-pre-kinder-b` (React + Vite + Supabase + Capacitor).
- Build frontend: **ok** (`npm run build` compila y genera `dist/`).
- Lint: **falla** por archivo temporal inexistente de Vite (`vite.config.ts.timestamp-...mjs`).
- Working tree sucio detectado (no tocado en esta auditoría):
  - `android/build.gradle`
  - `android/gradle/wrapper/gradle-wrapper.properties`
  - `supabase/fix_signup_roles_trigger.sql`

## 2) Supabase detectado (proyecto antiguo)

Fuentes encontradas:

- `.env`:
  - `VITE_SUPABASE_PROJECT_ID=ktdrnpdtmzfvfyvywrzs`
  - `VITE_SUPABASE_URL=https://ktdrnpdtmzfvfyvywrzs.supabase.co`
- `supabase/.temp/project-ref`:
  - `ktdrnpdtmzfvfyvywrzs`
- `supabase/config.toml`:
  - `project_id="gsebgpnbzzeglzgvkieh"`  **(inconsistente con `.env`/`.temp`)**

Conclusión: hay **mezcla de refs** de al menos dos proyectos Supabase.

## 3) Inventario funcional usado por frontend

### Tablas usadas desde `src/`

- `activities`
- `activity_donations`
- `activity_exclusions`
- `admin_permissions`
- `app_users`
- `audit_logs`
- `credit_movements`
- `dashboard_notifications`
- `expenses`
- `form_exclusions`
- `form_fields`
- `form_responses`
- `forms`
- `meeting_minutes`
- `organizations`
- `payment_notifications`
- `payments`
- `posts`
- `reimbursements`
- `scheduled_activities`
- `student_credits`
- `student_guardians`
- `students`
- `tenant_members`
- `tenants`
- `user_roles`
- `user_students`

### RPC usadas por frontend

- `archive_tenant`
- `create_own_tenant`
- `generate_missing_accounts`
- `get_next_expense_folio`
- `get_next_payment_folio`
- `get_next_reimbursement_folio`
- `get_platform_clients`
- `get_users_by_tenant`
- `migrate_course_year`

### Edge Functions consumidas por frontend

- `create-admin-user`
- `delete-user`
- `reset-user-password`
- `send-reimbursement-notification`

### Buckets usados por frontend

- `meeting-attachments`
- `reimbursements`
- `form-uploads`

## 4) Inventario SQL local (lo que existe en carpeta `supabase/`)

- Archivos SQL detectados: **71**.
- Tablas (unión de migraciones + dump + scripts): **29**.
- Las 27 tablas usadas por frontend están cubiertas por SQL local.
- Tablas en SQL no usadas actualmente por frontend: `scheduled_activity_exclusions`, `twilio_accounts`.

## 5) Problemas críticos encontrados

1. **Inconsistencia de proyecto Supabase (ref/URL).**
   - `.env` y `.temp` apuntan a `ktdrnpdtmzfvfyvywrzs`.
   - `supabase/config.toml` apunta a `gsebgpnbzzeglzgvkieh`.

2. **Credenciales sensibles en repositorio local.**
   - `.env` contiene claves (`publishable`, `GROQ` y service key comentada).
   - `debug_fetch.js` tiene URL/key hardcodeadas.

3. **Edge Functions con seguridad debilitada.**
   - `supabase/config.toml` tiene múltiples `verify_jwt=false`.
   - `get-users-with-roles` y `create-student-accounts` corren en “MODO PRUEBA” sin auth real.
   - En `UserManagement.tsx` se llaman `delete-user`/`reset-user-password` sin `Authorization` header.

4. **Drift de esquema (multitenant vs legado) y deuda técnica de tipos.**
   - `src/types/db.ts` y `src/integrations/supabase/types.ts` no están 100% alineados entre sí.
   - Código consulta `tenant_id` en tablas donde el propio código comenta que no siempre existe (ej. partes de Dashboard/DebtReports).
   - Hay mezcla de modelos de roles (`owner/member/student` y `master/admin/alumnos`).

5. **SQL de respaldo con URL vieja hardcodeada.**
   - `supabase/migrations/bkp/20251218032054_remix_migration_from_pg_dump.sql` contiene `jneovqrcvrycakufbehc.supabase.co` dentro de funciones de notificación.

6. **Scripts potencialmente destructivos en repo.**
   - Existen SQL tipo wipe/reset/rollback (`wipeout.sql`, `solution_fix_v6_reset.sql`, `20250101_emergency_rollback.sql`, etc.).

7. **Error sintáctico probable en SQL manual.**
   - `supabase/fix_signup_roles_trigger.sql` termina con `ok` suelto tras `NOTIFY`, lo que rompe ejecución directa.

8. **Buckets incompletos en migraciones versionadas.**
   - Solo aparece creación/policies de `meeting-attachments`.
   - No se detectó SQL de creación/policies para `reimbursements` ni `form-uploads`.

## 6) Qué usar como “fuente de verdad” para reconstruir en nuevo Supabase

Recomendación práctica:

1. **Base estructural (multitenant):** migraciones `supabase/migrations/20250101_*` + `20250102_create_posts_table.sql`.
2. **Complemento funcional legado (formularios/créditos/donaciones):** tomar del dump `bkp/20251218032054_remix_migration_from_pg_dump.sql` **solo objetos faltantes**, no ejecutar ciego completo.
3. **RPC finales:** conservar versiones más nuevas usadas por frontend (`get_users_by_tenant`, `create_own_tenant`, folios, rollover, archive).
4. **Storage:** agregar explícitamente buckets/policies faltantes (`reimbursements`, `form-uploads`).

## 7) Plan de reconstrucción recomendado (nuevo proyecto)

1. Crear nuevo proyecto Supabase (vacío) y enlazar CLI a ese ref.
2. Definir una rama/migración limpia de arranque (`0001_rebuild.sql`) con:
   - enums finales
   - tablas usadas por frontend
   - claves/índices/FK
   - RLS/policies
   - funciones/RPC requeridas
   - triggers necesarios
   - buckets y policies de storage
3. Eliminar hardcodes de URL vieja en funciones SQL y usar host dinámico o variables seguras.
4. Rehabilitar auth en Edge Functions:
   - `verify_jwt=true`
   - remover “MODO PRUEBA”
   - exigir bearer token en endpoints críticos.
5. Regenerar tipos TS desde el nuevo esquema y alinear `src/types/db.ts`.
6. Revalidar frontend con smoke tests por módulo (auth, onboarding, tenant switch, pagos, rendiciones, formularios, móvil).

## 8) Riesgos operativos al migrar

- Si se ejecutan scripts de `fix/solution/wipeout` fuera de orden, el esquema puede quedar inconsistente.
- Riesgo alto de sobrepermisos por RLS duplicadas o demasiado abiertas.
- Riesgo alto de seguridad si se mantiene `verify_jwt=false` o llamadas sin token en gestión de usuarios.

## 9) Próximo paso sugerido inmediato

- Congelar una **“Matriz de Esquema Objetivo”** (tablas + columnas + RLS + RPC) y generar desde eso una sola migración reproducible para el nuevo proyecto.

