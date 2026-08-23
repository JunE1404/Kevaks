# AGENTS.md

## Hard rules

- **Never read or otherwise access any `.env` file** in this repository.

## Repository structure

Multi-component repo where work is organized **by git branch**, not as a monorepo with shared commits:

- `website` branch → `website/frontend/` (React 19 + TypeScript + Vite)
- `backend-shared` branch → `backend-shared/` (Go backend)
- `main`, `deploy` → shared/deployment base

Note: `backend-shared/` is currently **untracked** (never committed), even on the `backend-shared` branch.

## backend-shared (Go)

- Module `github.com/kevaks/backend-shared`, Go 1.26.6.
- deps: Fiber, pgx/v5, `golang.org/x/crypto/bcrypt`.
- Packages: `api/`, `auth/`, `database/`, entrypoint `main.go`.
- `go build ./...` currently **fails**: `api/middleware.go:25` calls `f.VerifyIDToken` (undefined symbol). `api` is also not wired into `main.go` (which only connects the DB). Do not assume it compiles.
- Auth: bcrypt via `auth/password.go` (`HashPassword` / `CompareHashAndPassword`).
- DB config: `database/database.go` reads `DATABASE_URL`, returns `*DBHandler`.

## Database (docker compose)

- `backend-shared/docker-compose.yml`: postgres + flyway (applies `./migrations/`).
- **Requires `.env`** — copy `.env.example`, then `docker compose up`. Flyway only runs after DB healthcheck passes.

## Frontend

- `website/frontend/`, scripts in `package.json`:
  - dev: `npm run dev`
  - build: `npm run build` (runs `tsc -b && vite build`)
  - lint: `npm run lint` — **oxlint**, not eslint (`src/App.tsx` may look Vite-template-like; keep it).
- `dist/` is gitignored.
