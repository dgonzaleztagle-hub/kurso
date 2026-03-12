# iOS Store Readiness

## Objetivo

Preparar Kurso para App Store sin romper la operacion web actual.

## Lo que ya existe

- PWA funcional en produccion
- Shell Android base
- Shell iOS base con Capacitor
- APK publico desde la landing
- `assetlinks.json` para Android/TWA

## Lo que falta antes de App Review

- Primer build iOS en Codemagic
- TestFlight funcional
- Metadata completa en App Store Connect
- Privacy Policy publica
- App Privacy respondida con datos reales
- Screenshots iPhone
- Smoke manual iPhone completo

## Riesgos principales

- Rechazo Apple por experiencia demasiado cercana a un sitio embebido
- Problemas de signing Apple
- Regresiones web si se mezcla trabajo movil con `main`

## Regla de trabajo

- Rama recomendada: `feat/ios-store-readiness`
- Antes de mergear cualquier cambio:
  - `npm run lint`
  - `npm run test:business`
  - `npm run build`

## Entregables minimos para decir "listo para intentar App Store"

- `ios/` presente y sincronizable
- workflow `ios-testflight` presente en `codemagic.yaml`
- build iOS generado al menos una vez
- runbook de envio definido
- checklist de smoke cerrado

