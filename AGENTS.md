# HippoPro · Guía para agentes

Sistema para agencias hípicas. La agencia piloto es Agencia Dolores (Federico y Mati). Julián lo desarrolla. Hablale a Julián en español.

## Antes de tocar código

1. Leé [README.md](README.md) y [docs/20-status.md](docs/20-status.md): qué está hecho, qué pidió Federico y qué preguntas siguen abiertas.
2. Si el cambio toca una cuenta, leé [docs/19-domain-model.md](docs/19-domain-model.md). Los totales de agosto tienen que seguir dando igual.
3. Si toca la pantalla, leé [docs/14-design-system.md](docs/14-design-system.md).
4. Comandos, deploy y errores conocidos: [docs/10-development.md](docs/10-development.md).

Los docs son la fuente de verdad. Si el código y un doc no coinciden, preguntá antes de elegir uno.

## Reglas del proyecto

- El dinero es un entero en centavos (`Cents`). Los porcentajes van en puntos básicos. Nunca floats.
- Cada venta, depósito y gasto lleva `agencyId`.
- Código, nombres y comentarios en inglés. Textos de la pantalla, docs y descripciones de prueba (`it("...")`) en español.
- `src/modules/ledger/domain` y `application` no importan React, React Native ni Expo.
- Toda operación de negocio pasa por un caso de uso. Las pantallas no recalculan comisión ni saldo.
- Pantallas y componentes importan el módulo solo desde `@/modules/ledger`.
- Las pantallas no llevan hex. Los colores salen de `global.css` o de `src/constants/palette.ts`.
- No se crean carpetas vacías ni capas "para después".
- No cambiar los porcentajes de los hipódromos ni la semilla de agosto sin que Federico lo confirme.

## Antes de dar algo por terminado

1. `npx tsc --noEmit`
2. `npm test` (si agregás un archivo de prueba, sumalo al script `test` de `package.json`)
3. Mirar la pantalla a 1280 px y a 390 px, como dueño y como operador, con `npx expo start --web --port 8081`.
4. Si cambió algo que Federico ve o una pregunta abierta, actualizar [docs/20-status.md](docs/20-status.md).

## Git, secretos y privacidad

- Julián hace los commits y el push. No commitear ni pushear sin que lo pida.
- Un push a `main` publica el sitio. La dirección es [hippopro.com.ar](https://hippopro.com.ar). [hippo-pro.vercel.app](https://hippo-pro.vercel.app) redirige ahí.
- El repositorio de GitHub es público. Nunca commitear `.env`, claves ni la `service_role` de Supabase. `.env` está en `.gitignore`.
- No escribir teléfonos, datos personales ni acuerdos comerciales en el código ni en los docs.

---

This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
