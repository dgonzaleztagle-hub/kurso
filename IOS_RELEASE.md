# iOS Release

Kurso ya tiene shell iOS base con Capacitor y lane inicial de Codemagic en `codemagic.yaml`.

## Estado actual

- Bundle ID: `cl.mikurso.app`
- App name: `Kurso`
- Plataforma iOS creada en `ios/`
- Lane cloud inicial: `ios-testflight`
- Objetivo de primer envio: `TestFlight`

## Flujo recomendado

1. Verificar acceso a Apple Developer y App Store Connect.
2. Crear la app `Kurso` en App Store Connect con bundle `cl.mikurso.app`.
3. Configurar en Codemagic la integracion con Apple.
4. Ejecutar el workflow `ios-testflight`.
5. Instalar el build desde TestFlight.
6. Hacer smoke antes de cualquier envio a review.

## Configuracion requerida en Codemagic

- Conectar el repo a Codemagic.
- Activar integracion `App Store Connect`.
- Cargar o generar certificados/perfiles para `cl.mikurso.app`.
- Confirmar que el workflow use firma `app_store`.

## Checklist App Store Connect

- Nombre: `Kurso`
- Subtitulo: `Gestion escolar transparente`
- Categoria primaria: `Finance` o `Education`
- Support URL: `https://mikurso.cl`
- Marketing URL: `https://mikurso.cl`
- Privacy Policy URL: definir URL publica antes del envio
- Keywords iniciales: `colegio,pagos,tesoreria,curso,apoderados`

## App Privacy

Declarar segun implementacion real:

- Datos de cuenta/autenticacion
- Datos de contacto del usuario
- Datos financieros y de pagos si se muestran o procesan en la app
- Identificadores operativos si la app los usa para sesion/tenant

No responder esto por intuicion en App Store Connect. Revisarlo contra la implementacion real antes del envio.

## Smoke obligatorio en iPhone

- Login y logout
- Cambio de tenant
- Dashboard
- Portal de pagos
- Portal publico
- Links externos
- Reapertura de app con sesion existente
- Comportamiento sin red

## Notas operativas

- `main` sigue siendo la rama de produccion web.
- Todo trabajo iOS se hace en rama dedicada y solo se mergea si `lint`, `test:business` y `build` siguen pasando.
- El primer objetivo no es publicacion final, sino un build estable en `TestFlight`.

