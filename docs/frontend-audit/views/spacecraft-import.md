# Spacecraft Import Audit

## Route

- Route: `spacecraft.import`
- URL: `/Import?edit`

## Sources

- `static/scripts/spacecraft/index.js`
- `static/scripts/shared.js`
- `static/scripts/spacecraft/SpacecraftImportController.js`
- `static/states/spacecraft/import.html`
- `static/directives/spacecraft-import-form.html`
- `static/scripts/directives.js`

## State Resolves

- `existing` via `GET ./edit/spacecraft` when `edit` is present
- `tags` via `GET ./tags/spacecraft`
- `targetRelationships` is `null`
- `instrumentRelationships` via `GET ./relationship-types/instrument`
- `tools` via `GET ./status/tools`

## Model Shape

- `model.spacecraft`
- `model.instrument`

## User-Visible Behaviors

- LID lookup autofills display name only.
- Display description is present in the form even though not listed as required in the config.
- Mission override is a rare manual override field.
- Spacecraft image upload is supported.
- Tags use typeahead with the trailing-empty-row pattern.
- PDS3 search section exposes spacecraft ID autocomplete from constants.
- Relationship selector manages instrument links.

## Hidden Behaviors

- The shared config only requires `logical_identifier` and `display_name`.
- Lookup replacements only populate `display_name`.
- Existing relationships are unpacked from `instrument_host`.

## Rewrite Risks

- Required-vs-optional behavior is easy to get wrong because the form visually exposes more fields than the controller validates.
- The mission override field likely encodes important edge-case behavior not visible from this screen alone.

## Tests Needed

- create mode lookup only fills display name
- submit allows blank description if current backend accepts it
- instrument relationship hydration and submit packing work
- PDS3 autocomplete uses local constant lists
