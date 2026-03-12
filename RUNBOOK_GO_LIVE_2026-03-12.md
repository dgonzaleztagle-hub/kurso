# Runbook Go-Live 7 Dias

## Objetivo

Tratar el estado actual como `release candidate` y operar una salida a produccion con foco en estabilidad, validacion de flujos criticos y capacidad de respuesta rapida ante incidentes durante la primera semana.

## Estado base confirmado en repo

- Commit base de release: `7d3550f`
- Proyecto Supabase configurado localmente: `euhmpuhkwbxorfzrxemp`
- Script de enlace Supabase: `npm run supa:link`
- Script de sincronizacion de esquema: `npm run supa:push`
- `main` se considera la unica fuente de despliegue

## Exito esperado

- `main` sigue siendo la fuente unica de despliegue.
- Supabase y Vercel quedan alineados con el estado ya aplicado.
- Se monitorean y validan en produccion los flujos criticos: auth, pagos, reimbursements, creacion de usuarios y portal publico.
- No se introduce refactor adicional salvo correcciones puntuales por incidente.

## Congelamiento operativo por 7 dias

- No tocar esquema, permisos, edge functions publicas ni flujos de negocio salvo hotfix.
- No reabrir fallback legacy de `payment_notifications`.
- No cambiar la visibilidad publica de `submit-supplier-payment-request`, `mercadopago-webhook` ni `public-branding` sin redisenar el flujo externo completo.
- `manage-reimbursement` queda como unica interfaz de mutacion critica de reimbursements desde frontend.
- `tenant_members` queda como fuente operativa para permisos por tenant; `user_roles` se mantiene solo para compatibilidad y metadatos aun usados.

## Confirmaciones de produccion

- Vercel desplegando desde `main`.
- Variables de entorno de frontend y edge functions presentes y vigentes.
- Proyecto Supabase `euhmpuhkwbxorfzrxemp` como unico backend activo.
- Dominio canonico `https://mikurso.cl` respondiendo con headers, rutas, `sitemap`, `robots` y canonicals correctos.

## Matriz operativa de Edge Functions

### Privadas con JWT

- `manage-reimbursement`
- `create-parent-user`
- `process-payment-notification`
- `reset-password-by-email`
- `reset-user-password`
- `create-supplier-request-link`
- `create-admin-user`
- `create-student-accounts`
- `delete-user`
- `get-users-with-roles`
- `mercadopago-checkout`
- `check-default-password`
- `send-payment-notification`
- `send-reimbursement-notification`
- `send-whatsapp-notification`
- `check-subscriptions`

### Publicas por diseno

- `submit-supplier-payment-request`
- `mercadopago-webhook`
- `public-branding`

### Fuera de alcance de este go-live

- `ai-chat` existe en el repo, pero no forma parte de los flujos criticos definidos para esta salida.

## Pre-go-live

### Validaciones locales

Ejecutar nuevamente:

```sh
npm run lint
npm run test:business
npm run build
```

### Validaciones de plataforma

- Confirmar que no haya migraciones locales pendientes.
- Confirmar que `supabase db push` no reporte drift.
- Revisar en dashboard de Supabase que `manage-reimbursement` y las functions redeployadas esten activas.
- Confirmar que Vercel y Supabase reflejen el commit `7d3550f`.

## Smoke manual en produccion

Ejecutar el mismo dia del go-live:

- Login y logout.
- Cambio de tenant.
- Crear apoderado.
- Informar pago desde `PaymentPortal`.
- Aprobar y rechazar notificacion de pago.
- Crear rendicion.
- Aprobar, rechazar, reabrir y eliminar reimbursement.
- Generar link seguro de proveedor y abrir portal publico.
- Validar branding publico, `sitemap`, `robots` y canonicals bajo `mikurso.cl`.

## Post-go-live dia 0

- Revisar logs de Vercel y de Supabase Functions.
- Verificar que no existan `401` o `403` inesperados en functions privadas.
- Verificar que `mercadopago-webhook` y `submit-supplier-payment-request` no reciban errores de validacion anomalos.

## Seguimiento dias 1 a 7

- Monitorear errores repetidos por ruta y por function.
- Monitorear operaciones criticas nuevas en DB:
  - `payment_notifications`
  - `payments`
  - `reimbursements`
  - `expenses`
  - `tenant_members`
  - `user_students`
- Si aparece incidente, preferir hotfix pequeno sobre refactor.

## Plan de pruebas y aceptacion

### Automatizado minimo

- `npm run lint`
- `npm run test:business`
- `npm run build`

### Aceptacion funcional

- Aprobar reimbursement crea egreso una sola vez y deja trazabilidad consistente.
- Reabrir reimbursement elimina egreso asociado y vuelve a `pending`.
- Rechazar reimbursement exige motivo y persiste estado correcto.
- Crear apoderado funciona para `owner/master/admin` efectivos del tenant.
- Informar pago en portal usa solo el contrato actual de `payment_notifications`.

### Aceptacion operativa

- No hay cambios sin commit sobre `main`.
- Vercel y Supabase reflejan el commit `7d3550f`.
- No hay errores criticos sostenidos en logs durante 7 dias.

## Supuestos y defaults

- Alcance elegido: `Go-live 7 dias`.
- Sesgo elegido: `Conservador`.
- Se asume que Vercel despliega automaticamente desde GitHub `main`.
- Se asume que los secrets de Supabase necesarios ya existen.
- Si falta un secret, se trata como incidente de infraestructura, no como trabajo de codigo.
- Los warnings actuales de bundle grande no bloquean produccion y se dejan para una fase posterior de performance.
