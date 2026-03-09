# Instruments Import Audit

## Route

- Route: `instruments.import`
- URL: `/Import?edit`

## Sources

- `static/scripts/instruments/index.js`
- `static/scripts/shared.js`
- `static/scripts/instruments/InstrumentImportController.js`
- `static/states/instruments/import.html`
- `static/directives/instrument-import-form.html`
- `static/scripts/directives.js`

## State Resolves

- `existing` via `GET ./edit/instrument` when `edit` is present
- `tags` via `GET ./tags/instruments`
- `targetRelationships` is `null`
- `instrumentRelationships` via `GET ./relationship-types/instrument`
- `tools` via `GET ./status/tools`

## Model Shape

- `model.instrument`
- `model.spacecraft`
- `model.bundle`

## User-Visible Behaviors

- LID lookup autofills display name and description for create mode.
- Instrument bundle LID is optional.
- Tags use trailing-empty-row behavior.
- PDS3 search section exposes instrument ID and spacecraft ID local autocomplete.
- Relationship section has two different behaviors:
  - instrument to spacecraft uses relationship type select
  - instrument to bundle uses free-text label input because no relationship types are supplied

## Hidden Behaviors

- Relationship transformer remaps the `spacecraft` model key to backend field `instrument_host`.
- Bundle relationships preserve a free-text `label`.
- Because `relationshipSelector` merges on `lid`, bundle and spacecraft rows rely on distinct model arrays to avoid collisions.

## Rewrite Risks

- This view has the most mixed relationship semantics of the import forms.
- The free-text relationship label path should get explicit tests before rewrite.

## Tests Needed

- LID lookup populates blank fields only
- spacecraft relationship rows use typed relationship select
- bundle relationship rows use free-text label input
- submit maps spacecraft to `instrument_host`
- submit preserves bundle `label`
