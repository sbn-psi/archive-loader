# AGENTS.md

Frontend-specific instructions for the React app in this directory.

## Scope

These rules apply to `frontend/`.

## Architecture

- `src/App.tsx`
  Owns route composition, auth gating, global error handling, and shell behavior

- `src/pages/`
  Route-level screens. Keep them focused on orchestration and rendering.

- `src/components/`
  Shared UI, form, and editor components

- `src/lib/api.ts`
  All frontend HTTP calls should go through here

- `src/lib/domain.ts`
  Shared transformation, normalization, and view-model logic belongs here

## Frontend Change Rules

- Do not call backend endpoints directly from random components; add or reuse wrappers in `src/lib/api.ts`.
- Do not duplicate payload shaping in multiple pages; move shared behavior into `src/lib/domain.ts`.
- Keep JSX focused on presentation and user interaction, not business-rule branching.
- Prefer explicit local state and clear route-level flows over hidden coupling.

## Routing

- The React app is served from `/`, not `/app`.
- Frontend routes include paths like `/datasets/manage`, `/targets/import`, and `/tools/reports`.
- Hard reloads must continue to work. If you add routes, keep Express SPA fallback behavior in mind.

## Auth And Request Behavior

- The frontend bootstraps auth from `GET /user`.
- Any API `403` should force logout and return the user to `/login`.
- Save flows generally return the user to the relevant manage screen after success.
- Route changes should feel like navigation, not in-place mutation; preserve scroll-reset behavior.

## Styling

- Shared styles live in `src/styles.css`.
- Reuse the existing button classes:
  - `button-primary`
  - `button-secondary`
  - `ghost`
  - `ghost-danger`
  - `editor-tool`
  - `editor-mode-toggle`
- Keep hover/focus/disabled states readable and consistent.
- Do not reintroduce browser-default buttons by omission; use explicit classes for actions.
- Preserve the current content width, bordered cards, and manage-screen density unless there is a deliberate redesign.

## Forms And Editors

- Some pages use React Hook Form, but not all form state should be forced into it.
- Rich text editors use TipTap.
- Rich text image insertion uploads through `/image/upload`.
- If you change editor extensions, avoid duplicate TipTap extension registration.
- Keep submit-time sanitization and mapping behavior centralized.

## Testing

For meaningful frontend changes, usually run:

- `npm run typecheck`
- `npm test`
- `npm run build:frontend`

If behavior spans pages, routes, or auth flow, consider whether Playwright coverage should also be updated.

## Legacy Warning

Do not patch `static/` to fix frontend issues. If you need historical context, read it and port the intent into React.
