# AGENTS.md

Repository-wide instructions for humans and coding agents.

## Scope

This repo’s runtime code lives in:

- `frontend/` for the React + TypeScript UI
- `server/` for the Express + Mongo backend

The old AngularJS code under `static/` is reference material only. Do not add new behavior there and do not treat it as the active application.

## Primary Rules

- Make changes in the current codebase, not the legacy AngularJS files.
- Treat `server/config.js` as the only place that loads and normalizes environment variables.
- Prefer extending shared frontend helpers over embedding request/transform logic directly in components.
- Preserve existing API contracts unless there is an explicit decision to change them.
- Keep routing compatible with hard reloads; frontend routes and backend API paths intentionally coexist.

## Layout

- `frontend/src/App.tsx`
  App shell, route tree, auth handling, route-level composition

- `frontend/src/components/`
  Shared UI and form components

- `frontend/src/pages/`
  Route-level screens

- `frontend/src/lib/api.ts`
  Frontend API client wrappers

- `frontend/src/lib/domain.ts`
  Shared frontend domain and transformation logic

- `server/server.js`
  Express bootstrap, auth/session wiring, SPA serving, route registration

- `server/routes/`
  Backend HTTP endpoints grouped by feature

- `server/db.js`
  Mongo access helpers and collection names

## Commands

- Install: `npm install`
- Backend: `npm start`
- Frontend dev: `npm run dev:frontend`
- Typecheck: `npm run typecheck`
- Tests: `npm test`
- E2E: `npm run test:e2e`
- Build frontend: `npm run build:frontend`
- Docker build: `docker compose build app`
- Docker run: `docker compose up -d --build`

Notes:

- There is no lint command right now.
- `frontend/dist` is build output and should not be edited as source.

## Environment

- Local env file: `.env`
- Example env file: `.env.example`
- Docker Compose reads `./.env`

If you add a new env variable:

1. Add it in `server/config.js`
2. Add it in `.env.example`
3. Document it in `README.md`
4. Read the normalized config value instead of `process.env` elsewhere

## Verification

For most non-trivial changes, run the smallest relevant set of:

- `npm run typecheck`
- `npm test`
- `npm run build:frontend`

Known caveat:

- The test suite emits a jsdom `scrollTo()` warning. That is expected if the tests still pass.

## Legacy Material

- `static/`
  Legacy AngularJS implementation, reference only

- `docs/frontend-audit/`
  Historical behavior documentation. Useful when a current behavior seems odd, but not the place to define new architecture.

## Update Rule

If you discover a durable repo-wide convention that future contributors need, update this file or the more specific `frontend/AGENTS.md` / `server/AGENTS.md`.
