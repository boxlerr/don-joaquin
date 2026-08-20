# Sistema Don Joaquín

Plataforma de gestión logística y administrativa para **Don Joaquín Hnos SRL** (flota inicial de 11 camiones, escalable a 62). Desarrollado por **Vaxler Software**.

## Stack

- **Next.js 15** (App Router, Server Actions, Route Handlers) — full-stack en Vercel
- **Supabase** — Postgres + Auth + Storage + RLS
- **TypeScript + Tailwind CSS**
- **Zod** para validación end-to-end
- **Vercel Cron** / **Supabase Edge Functions** para alertas de vencimientos

## Arquitectura

Monolito Next.js full-stack: el "backend" vive como Server Actions y Route Handlers en el mismo repo. Postgres administrado por Supabase, con RLS para roles administrativos. Jobs de alertas y notificaciones (email / WhatsApp) se disparan vía cron contra endpoints internos protegidos por `CRON_SECRET`.

## Estructura

```
src/
  app/
    (auth)/login        # login admin
    (dashboard)/        # vistas internas
    api/                # route handlers + cron endpoints
  components/ui/        # primitives compartidas
  lib/
    supabase/           # clients (browser, server, middleware)
    utils/
  modules/              # un folder por módulo SRS
    camiones/
    choferes/
    viajes/
    hojas-ruta/
    tarifas/
    viaticos-gastos/
    cheques/
    clientes/
    documentacion-alertas/
    reportes/
  types/
supabase/
  migrations/           # migraciones SQL versionadas (Supabase CLI)
docs/                   # SRS, contrato, diagramas
```

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Con las tres variables de Supabase alcanza para levantar el sistema en local.
El resto son para los mails y el cron, que en local se pueden dejar vacías.

## Variables de entorno

Todas viven en **Vercel → don-joaquin → Settings → Environment Variables**
(Production and Preview). Para bajarlas ya completas:

```bash
npm i -g vercel && vercel link && vercel env pull .env.local
```

Esta es la lista completa de lo que el código lee. **Si agregás una variable
nueva, anotala acá y en `.env.example`**, si no se pierde.

| Variable | Para qué | ¿Obligatoria? |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Proyecto de Supabase | Sí |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente del navegador (respeta RLS) | Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | Cliente admin, **solo server-side** — saltea RLS | Sí |
| `CRON_SECRET` | Protege `/api/cron/notificaciones`, que queda fuera del middleware de sesión porque lo llama Vercel Cron | Sí en prod |
| `SMTP_HOST` · `SMTP_PORT` · `SMTP_USER` · `SMTP_PASS` | Envío de mails de alertas. Si falta una, no sale ningún mail (la UI lo avisa) | Sí para mails |
| `EMAIL_FROM` | Remitente. Si falta, usa `SMTP_USER` | No |
| `SMTP_SECURE` | Fuerza TLS. Sin definir: `true` en el puerto 465, `false` en el resto | No |
| `NEXT_PUBLIC_APP_URL` | Override manual de la URL pública (links de los mails) | No |

Las que **inyecta Vercel sola** y no hay que cargar: `VERCEL_URL` (el deploy
puntual) y `VERCEL_PROJECT_PRODUCTION_URL` (el dominio de producción).

`appUrl()` (`src/lib/email.ts`) resuelve la URL de los links en este orden:
`NEXT_PUBLIC_APP_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_URL` →
`http://localhost:3000`. Por eso en producción no hace falta configurar nada.

> **Ojo:** en Vercel hay una `NEXT_PUBLIC_SITE_URL` cargada desde el 08/05 que
> **no la lee nadie** en el repo — la que el código mira se llama
> `NEXT_PUBLIC_APP_URL`. No rompe nada, pero editarla no tiene ningún efecto.
> Si alguna vez hace falta fijar la URL a mano, renombrala en Vercel; si no, se
> puede borrar.

## Scripts

- `npm run dev` — dev server (Turbopack)
- `npm run build` — build prod
- `npm run lint`

## Módulos (SRS)

1. Gestión de Camiones
2. Gestión de Choferes
3. Hojas de Ruta y Liquidación por Kilómetros *(prioritario)*
4. Gestión de Viajes
5. Tarifas y Fletes
6. Viáticos, Gastos y Caja
7. Planillas y Reportes
8. Documentación y Alertas
9. Gestión de Cheques
10. Clientes y Cuentas Corrientes
