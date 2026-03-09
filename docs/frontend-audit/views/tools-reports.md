# Reports Audit

## Route

- Route: `reports`
- URL: `/Tools/Reports`

## Sources

- `static/scripts/tools/reports/index.js`
- `static/states/tools/reports.html`

## User-Visible Behaviors

- Displays relationship records grouped by hidden relationship type name.
- Only relationships tied to "hidden" types are shown.

## Hidden Behaviors

- "Hidden" is inferred from relationship types with `order >= 1000`.
- The page joins together target and instrument relationship type sets before filtering relationship records.
- Group ordering follows object key iteration of the built model, not an explicit sort.

## API Behavior

- `GET ./relationship-types/target`
- `GET ./relationship-types/instrument`
- `GET ./status/relationships`

## Rewrite Risks

- This screen depends on the same `order >= 1000` contract as relationship management.
- It displays raw IDs/LIDs without additional lookups.

## Tests Needed

- only hidden relationship types are shown
- relationships are grouped under the correct type name
- mixed target/instrument relationship datasets render correctly
