# Manage Screens Audit

This file covers the list-oriented CRUD screens that mostly reuse the shared `manageList` directive.

## Covered Routes

- `datasets.manage`
- `targets.manage`
- `missions.manage`
- `spacecraft.manage`
- `instruments.manage`

## Sources

- `static/scripts/directives.js`
- `static/directives/manage-list.html`
- `static/scripts/datasets/DatasetManageController.js`
- `static/scripts/targets/TargetsManageController.js`
- `static/scripts/missions/MissionsManageController.js`
- `static/scripts/spacecraft/SpacecraftManageController.js`
- `static/scripts/instruments/InstrumentsManageController.js`
- corresponding `static/states/*/manage.html`

## Shared Behaviors

- Each page loads its dataset via `GET ./status/<type>`.
- Edit buttons route back into the corresponding import form with `edit=<lid>`.
- Delete actions use browser `confirm(...)`.
- Most screens rely on `manageList` for rendering and optional grouping.

## Route-Specific Notes

### `datasets.manage`

- Shows a "Show Collections" toggle.
- Defaults to bundles only.
- Computes `is_bundle`, `bundle_lid`, and human-readable `context` client-side.
- When collections are shown, grouping switches to `bundle_lid`.
- When group names are URNs, `manageList` performs async title lookups for group display.

Parity tests:

- default hides collections
- toggle reveals collections
- bundle context formatting matches current logic
- delete refreshes list

### `targets.manage`

- Straight list with tags column.

Parity tests:

- list load
- edit link
- delete confirmation and reload

### `missions.manage`

- Straight list with ready-status column.

Parity tests:

- ready column rendering
- edit link
- delete flow

### `spacecraft.manage`

- Straight list with tags column.

Parity tests:

- list load
- edit link
- delete flow

### `instruments.manage`

- Groups by `spacecraft`.
- Group labels may trigger async lookup behavior in `manageList` if the group key is a URN.

Parity tests:

- grouping by spacecraft
- ungrouped items behavior
- edit link
- delete flow

## Rewrite Notes

- These should migrate early because they are relatively low-risk and help validate shared data-fetching patterns.
- The React implementation should consolidate them into one reusable list page pattern with per-route configuration.
