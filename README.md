# PitStop Pro — Backend

Backend API for managing vehicles and related domain (auth, vehicles now; events/expenses/documents later). Built with Fastify + TypeScript + Prisma + MySQL.

## Quick Start

Prereqs: Node 18+, Docker Desktop running, port `3307` free.

1. Install deps
   - `npm install`
2. Start database (MySQL on 127.0.0.1:3307)
   - `npm run db:up`
3. Apply migrations
   - `npm run db:migrate`
4. Start API (dev)
   - `npm run dev`
5. Open Swagger UI
   - http://localhost:3333/docs (use Authorize with a login token)

Environment defaults are in `.env.example`. Copy to `.env` if needed.

## Scripts

- `npm run dev` — Start dev server with hot reload.
- `npm run build` — TypeScript build to `dist/`.
- `npm start` — Run built server.
- `npm run db:up` — Start MySQL via Docker Compose.
- `npm run db:down` — Stop containers.
- `npm run db:reset` — Reset DB volumes and start fresh.
- `npm run db:migrate` — Apply pending Prisma migrations.
- `npm run db:studio` — Open Prisma Studio.

## Tech

- Fastify (JWT, CORS, Helmet, Swagger UI at `/docs`)
- Prisma ORM (`@prisma/client`), MySQL (Docker, 127.0.0.1:3307)
- Zod validation, centralized error handler with `AppError`
- Pino logger (pretty in dev)

## Current Endpoints (v1)

- `GET /v1/health` → `{ ok: true }`
- Auth:
  - `POST /v1/auth/register { email, password(>=8), displayName }` → `{ token }`
  - `POST /v1/auth/login { email, password }` → `{ token }`
  - `GET /v1/auth/me` (Bearer) → `{ id, email, displayName }`
- Vehicles (Bearer):
  - `GET /v1/vehicles?page&limit&sort=field:dir`
  - `POST /v1/vehicles { plate, brand, model, photoUrl?, year?, vehicleName?, currentOdometerKm? }` → `{ id }`
  - `PATCH /v1/vehicles/:id` → `{ id }`
  - `DELETE /v1/vehicles/:id` → `204`

## Notes

- MySQL creds (docker-compose and envs) are aligned: `pituser/pitpass` on `pitstop` (port `3307`).
- Tokens expire in 24h. Use Swagger Authorize without typing "Bearer ".
- Clean code: self-explanatory code, centralized error handling (400/401/409/500), strict Zod parsing.

