# HIPPO Pro

Sistema para agencias hípicas. Carga el día por hipódromo, lleva la cuenta corriente con cada hipódromo, registra gastos y muestra el resultado del mes. La agencia piloto es Agencia Dolores, de Federico y Mati.

Esta versión reproduce agosto 2026 de la planilla de Federico. Sin claves de Supabase, el libro se guarda en este navegador: recargar conserva lo cargado y otro dispositivo no lo ve. Con las claves públicas, el celular y la computadora comparten el mismo libro. Cómo conectarlas está en [docs/10-development.md](docs/10-development.md).

- Producción: [https://hippo-pro.vercel.app](https://hippo-pro.vercel.app)
- Repositorio: [github.com/julian-desarrollador/HIPPO-Pro](https://github.com/julian-desarrollador/HIPPO-Pro)

## Por dónde empezar

Si llegás sin contexto, leé en este orden:

1. [docs/20-status.md](docs/20-status.md): qué está hecho, qué pidió Federico y qué sigue.
2. [docs/01-product.md](docs/01-product.md): qué es el producto y qué entra en esta entrega.
3. [docs/19-domain-model.md](docs/19-domain-model.md): fórmulas y números de agosto que tienen que coincidir.
4. [docs/03-architecture.md](docs/03-architecture.md) y [docs/05-folder-structure.md](docs/05-folder-structure.md): capas, reglas y dónde va cada archivo.
5. [docs/14-design-system.md](docs/14-design-system.md): colores, piezas de pantalla y reglas visuales.
6. [docs/10-development.md](docs/10-development.md): comandos, deploy y errores conocidos.
7. [docs/15-decisions.md](docs/15-decisions.md): decisiones que no se revierten sin pensarlo.

[AGENTS.md](AGENTS.md) resume las reglas para un agente que vaya a cambiar código.

## Correr el proyecto

```bash
npm install
npx expo start --web --port 8081
```

Abre en [http://localhost:8081](http://localhost:8081).

```bash
npm test            # pruebas del dominio y de agosto
npx tsc --noEmit    # tipos
npm run build       # sitio web estático en dist/
```

## Stack

Expo SDK 57, React Native 0.86, Expo Router, NativeWind 5 (RC) con Tailwind 4, TypeScript. Las pruebas corren con `tsx` y `node:test`. El sitio web se publica en Vercel como export estático.
