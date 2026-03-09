# Target Relationships Audit

## Route

- Route: `targets.relate`
- URL: `/Relate`

## Sources

- `static/scripts/targets/TargetRelationshipsController.js`
- `static/states/targets/relate.html`

## User-Visible Behaviors

- Initial screen lists all targets and their existing parent/child/associated relationships.
- Clicking `Add Relationship` moves to a second step for the selected target.
- User chooses one of three relationship directions:
  - parent of
  - child of
  - associated to
- Once a relationship type is selected, a list of all targets appears for the second target selection.
- Clicking a target saves immediately.

## Hidden Behaviors

- Screen mode is managed through `state.mode` with four states:
  - `INITIAL`
  - `SPECIFYING`
  - `RELATING`
  - `SAVING`
- A `$watch` on `state.relationship` advances the flow from `SPECIFYING` to `RELATING`.
- Relationship payload shape depends on the chosen relationship type.
- The list of candidate second targets includes the currently selected target; there is no visible guard against self-association in the UI code.

## API Behavior

- load: `GET ./status/target-relationships`
- save: `POST ./save/target-relationships`

## Rewrite Risks

- This is a state machine hidden in controller conditionals and template `ng-if`s.
- The current code contains a typo in the default switch case (`cosole.log`) but it only affects the invalid path.
- Existing relationships are displayed as raw LIDs rather than resolved names.

## Tests Needed

- initial list render
- selecting a target advances mode
- selecting relationship type reveals target choices
- each relationship type emits the correct payload
- save returns to initial mode and refreshes list
- confirm whether self-linking is currently allowed and preserve or intentionally change
