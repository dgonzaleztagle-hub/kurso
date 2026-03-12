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

Si se usan App Links o una futura TWA, publicar:

- `https://mikurso.cl/.well-known/assetlinks.json`

Contenido base:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "cl.mikurso.app",
      "sha256_cert_fingerprints": [
        "REEMPLAZAR_CON_SHA256_DEL_CERTIFICADO_DE_RELEASE"
      ]
    }
  }
]
```

## Criterios de mantenimiento

- Mantener `cl.mikurso.app` como package id estable.
- No cambiar la keystore de release una vez publicada la app.
- Versionar cambios Android nativos junto con el codigo web que los requiera.
- Preferir Capacitor para integraciones futuras antes que wrappers externos de una sola vez.
