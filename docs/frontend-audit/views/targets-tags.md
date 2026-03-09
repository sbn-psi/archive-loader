# Target Tags Audit

## Route

- Route: `targets.tags`
- URL: `/Tags`

## Sources

- `static/scripts/targets/TargetTagsManageController.js`
- `static/states/targets/tags.html`
- `static/directives/tag-group-dialog.html`
- `static/scripts/directives.js`

## User-Visible Behaviors

- Lists target tags grouped by `group`.
- `Edit` opens a modal that lets the user choose an existing group or type a new one.
- `Delete` asks for confirmation and removes the tag.

## Hidden Behaviors

- Available groups are derived client-side from the currently loaded tag list.
- Modal-local state is initialized with:
  - the selected tag
  - list of known groups
  - currently selected group
- On modal confirm, the original tag object is mutated and then saved.

## API Behavior

- load: `GET ./tags/targets`
- save: `POST ./save/tag`
- delete: `DELETE ./delete/tag/<type>/<name>`

## Rewrite Risks

- The modal allows either selecting an existing group or typing a new one; precedence rules matter.
- Because save mutates the original object, React rewrite should use explicit immutable updates.

## Tests Needed

- list render grouped by group
- edit modal confirm with existing group
- edit modal confirm with new group
- edit modal cancel leaves data unchanged
- delete confirmation and reload
