---
description: Guía paso a paso para generar una APK de Android desde este proyecto React/Vite usando Capacitor.
---

# Generar APK de Android con Capacitor

Esta guía te permitirá convertir tu aplicación web "Kurso" en una aplicación móvil instalable (.apk) para Android.

## Prerrequisitos
- Tener **Android Studio** instalado en tu computadora (necesario para compilar la APK final).

## Pasos

1. **Instalar Capacitor (El puente Web-Móvil)**
   Ejecuta en la terminal:
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/android
   ```

2. **Inicializar Capacitor**
   Configura el nombre y el ID de la App (ej: `cl.kurso.app`):
   ```bash
   npx cap init Kurso cl.kurso.app --web-dir=dist
   ```

3. **Construir la Versión Web**
   Genera los archivos estáticos de producción:
   ```bash
   npm run build
   ```

4. **Agregar la Plataforma Android**
   Crea la carpeta del proyecto nativo Android:
   ```bash
   npx cap add android
   ```

5. **Sincronizar Códigos**
   Copia tu build web al proyecto Android:
   ```bash
   npx cap sync
   ```

6. **Abrir Android Studio**
   Esto abrirá el proyecto para que puedas generar la APK:
   ```bash
   npx cap open android
   ```

## Dentro de Android Studio
1. Espera a que termine la sincronización de Gradle (barra inferior).
2. Ve al menú: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
3. Una vez termine, aparecerá una notificación "APK(s) generated successfully". Haz clic en **locate** para encontrar tu archivo `.apk`.

¡Listo! Ese archivo lo puedes enviar a tu celular e instalarlo.
