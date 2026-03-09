# Targets Import Audit

## Route

- Route: `targets.import`
- URL: `/Import?edit`

## Sources

- `static/scripts/targets/index.js`
- `static/scripts/shared.js`
- `static/scripts/targets/TargetImportController.js`
- `static/states/targets/import.html`
- `static/directives/target-import-form.html`
- `static/scripts/directives.js`

## State Resolves

- `existing` via `GET ./edit/target` when `edit` is present
- `tags` via `GET ./tags/targets`
- `targetRelationships` via `GET ./relationship-types/target`
- `instrumentRelationships` is `null`
- `tools` via `GET ./status/tools`

## Model Shape

- `model.target`
- `model.mission`

`model.mission` is the relationship collection even though the UI label becomes "Spacecraft" because the route passes `to="spacecraft"` to `relationship-selector`.

## User-Visible Behaviors

- Entering a new target LID triggers lookup/autofill for display name and description.
- If the LID already exists, the page errors and instructs the user to edit instead of add.
- The form includes image upload, tags, two supplemental rich text areas, and a derived-data rich text area.
- A relationship section appears below the form and is populated from related lookup data.
- Related tools can be attached with optional direct links.

## Hidden Behaviors

- The page uses two controllers at once:
  - `ContextObjectImportController` for lifecycle and submit behavior
  - `TargetImportController` for entity-specific config
- Relationship save is folded into the main submit only if relationship rows exist.
- Lookup autofill only fills blank fields; it does not overwrite typed values.

## AngularJS-Specific Behaviors To Preserve Or Deliberately Replace

- Config is injected by mutating `$scope.config` from a nested controller.
- Initialization is driven by a `$watch('config.modelName')`.
- Relationship data is prefetched by a directive watching the target LID.

## API Behavior

Submit issues:

- `POST ./save/targets`
- optional `POST ./save/relationships`

Lookup behavior:

- `GET ./lookup`
- `GET ./edit/target`
- `GET ./related/spacecraft?...`

## Rewrite Notes

- Target import should be built from a framework-agnostic context-object form engine plus a target-specific schema/config object.
- The ambiguous model naming around `model.mission` vs displayed "Spacecraft" needs explicit normalization in the new code.
- Rich text fields should be documented with stored field names: `html1`, `html2`, `derived_html`.

## Tests Needed

- create mode LID autofill populates only blank fields
- duplicate LID check blocks create mode
- edit mode does not run duplicate-check rejection flow
- relationship prefill merges instead of replacing local rows
- image upload updates URL field
- submit combines primary object payload and relationship payload correctly
