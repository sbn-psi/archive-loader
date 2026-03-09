# AGENTS.md

Backend-specific instructions for the Express app in this directory.

## Scope

These rules apply to `server/`.

## Architecture

- `server.js`
  Process bootstrap, auth/session setup, SPA serving, and route registration

- `routes/`
  HTTP endpoints grouped by feature

- `db.js`
  Mongo helpers and collection-name constants

- `config.js`
  Canonical env loading and normalization

## Backend Change Rules

- Read env only through `config.js`.
- Keep route handlers relatively thin; if logic grows, extract helpers instead of inflating `server.js`.
- Preserve existing request and response shapes unless there is an explicit contract change.
- Be careful with route namespaces because frontend SPA paths and backend APIs share the same Express app.

## Auth And Sessions

- Public routes are intentionally limited.
- Most application APIs sit behind the authenticated catch-all.
- Do not weaken auth checks as a shortcut for frontend work.
- If a route must stay public, make that choice explicit.

## Routing

- The React frontend is served from the site root.
- Express must continue to distinguish frontend page requests from real API routes.
- When adding a new API namespace, update the SPA fallback exclusions in `server.js`.

## Data And Contracts

- `db.js` collection constants are the canonical collection identifiers.
- Status, edit, save, tags, relationship, and dataset endpoints are all consumed directly by the frontend.
- Avoid silent payload shape drift. If the frontend must adapt, update both `frontend/src/lib/api.ts` and any affected domain helpers.

## AWS / Uploads / Sync

- Image upload behavior lives in `imageUpload.js` and uses AWS S3 configuration from `config.js`.
- Backup behavior also uses AWS configuration.
- Solr sync is operationally sensitive. Do not change sync behavior casually, and do not invoke it during testing unless explicitly asked.

## Verification

For backend changes, run the smallest relevant checks available. At minimum, prefer:

- `node -c server/server.js` for syntax-sensitive bootstrap changes
- `npm test` if frontend-facing behavior is affected
- `npm run build:frontend` if backend route serving changes affect the SPA

## Legacy Warning

Do not infer runtime behavior from old AngularJS server assumptions in `static/`. The active client is the React app.
