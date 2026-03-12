# Android Release

Base Android oficial de Kurso usando Capacitor.

## Identidad nativa

- Nombre visible: `Kurso`
- Package id: `cl.mikurso.app`
- Dominio canonico web: `https://mikurso.cl`

## Comandos utiles

```sh
npm run build
npm run android:sync
npm run android:open
npm run android:build:debug
```

## Flujo recomendado de release

1. Ejecutar `npm run build`.
2. Ejecutar `npm run android:sync`.
3. Abrir Android Studio con `npm run android:open`.
4. Generar keystore definitiva de release.
5. Configurar firma de release en Gradle.
6. Generar `AAB` para Google Play.

## Digital Asset Links

Para TWA y App Links, publicar:

- `https://mikurso.cl/.well-known/assetlinks.json`

El repo ya incluye esa ruta en `public/.well-known/assetlinks.json`.

Si cambia la clave de firma de release, actualizar el fingerprint `SHA-256`.

## Criterios de mantenimiento

- Mantener `cl.mikurso.app` como package id estable.
- No cambiar la keystore de release una vez publicada la app.
- Versionar cambios Android nativos junto con el codigo web que los requiera.
- Preferir Capacitor para integraciones futuras antes que wrappers externos de una sola vez.
- No exponer `keystore`, passwords, `apk`, `aab` ni source zips dentro de `public/`.
