# Relationship Type Management Audit

## Route

- Route: `relationships`
- URL: `/Relationships`

## Sources

- `static/scripts/tools/relationships/index.js`
- `static/states/tools/relationships.html`
- `static/directives/relationships-form.html`

## User-Visible Behaviors

- Two columns manage two independent sets of relationship types:
  - Mission-to-Target
  - Spacecraft-to-Instrument
- Relationship types are visually grouped into:
  - Show Always
  - Show Sometimes
  - Show Never
- Rows can be dragged between groups and reordered within a group.
- Relationship names can be edited inline.
- New relationship types can be added.
- Existing relationship types can be removed.

## Hidden Behaviors

- Group membership is inferred from numeric `order` ranges:
  - `< 100` => always
  - `100-999` => sometimes
  - `>= 1000` => never
- Saving rewrites every row's `order` based on current list position and group offsets.
- Drag-and-drop save happens on sortable stop.
- Name editing uses jQuery focus by `relationshipId`.
- Save and remove operations are artificially delayed with `setTimeout(..., 800)`.
- Reload after save/remove happens by re-fetching the relationship types from the backend.

## API Behavior

- load: `GET ./relationship-types/target`
- load: `GET ./relationship-types/instrument`
- save target: `POST ./relationship-types/target`
- remove target: `POST ./relationship-types/target/remove`
- save instrument: `POST ./relationship-types/instrument`
- remove instrument: `POST ./relationship-types/instrument/remove`

## Rewrite Risks

- This screen is tightly tied to jQuery UI sortable and AngularJS deep watches.
- `order` is a behavioral contract, not just presentation metadata.
- Hidden relationship types on the reports screen depend on the `order >= 1000` convention.

## Tests Needed

- existing order values map into correct groups
- drag/reorder recomputes order values correctly
- add inserts into selected group and persists
- rename persists and refreshes
- remove persists and refreshes
- target and instrument sides operate independently
