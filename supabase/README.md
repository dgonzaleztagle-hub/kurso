# Supabase Source of Truth

Este directorio fue limpiado para evitar flujos duplicados.

- Esquema base unico: `supabase/migrations/20260309000000_init_clean.sql`
- Flujo de cuentas de alumnos: `supabase/functions/create-student-accounts/index.ts`

## Inicializacion de BD (proyecto nuevo)

1. Abrir Supabase SQL Editor.
2. Ejecutar completo `supabase/migrations/20260309000000_init_clean.sql`.
3. Deploy de Edge Function `create-student-accounts`.

No ejecutar scripts legacy ni parches antiguos (fueron removidos del repo).
