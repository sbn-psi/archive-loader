# Missions Import Audit

## Route

- Route: `missions.import`
- URL: `/Import?edit`

## Sources

- `static/scripts/missions/index.js`
- `static/scripts/shared.js`
- `static/scripts/missions/MissionImportController.js`
- `static/states/missions/import.html`
- `static/directives/mission-import-form.html`
- `static/scripts/directives.js`

## State Resolves

- `existing` via `GET ./edit/mission` when `edit` is present
- `tags` via `GET ./tags/missions`
- `targetRelationships` via `GET ./relationship-types/target`
- `instrumentRelationships` is `null`
- `tools` via `GET ./status/tools`

## Model Shape

- `model.mission`
- `model.target`

## User-Visible Behaviors

- LID lookup autofills display name and description for create mode.
- Start date is required.
- End date is optional.
- Date inputs use Angular `type="date"` plus `ng-model-options="{timezone: 'UTC'}"`.
- Mission bundle LID is optional and explained as enabling a mission bundle tab elsewhere.
- Mission can be marked ready with a checkbox.
- Additional HTML fields exist for top, bottom, and full "More Data" content.
- Relationship selector manages target relationships.
- Related tools can be attached.

## Hidden Behaviors

- `prepForForm` converts stored `start_date` and `end_date` into `Date` objects for edit mode.
- Relationship packing uses the dynamic domain key supplied to the shared controller.

## Rewrite Risks

- Date semantics must be preserved exactly, especially UTC normalization and submitted payload shape.
- `other_html` likely powers another application surface and should be treated as a contract field.

## Tests Needed

- create mode requires start date
- edit mode hydrates dates correctly
- UTC date handling does not drift by timezone
- ready checkbox persistence works
- target relationship payload is packed correctly
