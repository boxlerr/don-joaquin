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
# completar SUPABASE_*, CRON_SECRET
npm install
npm run dev
```

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
