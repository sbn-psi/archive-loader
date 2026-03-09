# Shared AngularJS Behaviors

This file captures the cross-cutting behaviors that affect multiple views and are easy to miss during a rewrite.

## Application Shell

Sources:

- `static/index.html`
- `static/scripts/app.js`

Key behaviors:

- The app is a single AngularJS module named `app`.
- Global shell state lives on `RootController.$scope.state`.
- The shell tracks `loading`, `transitioning`, `error`, `alerts`, auth status, and current user.
- Route transitions toggle loading state globally.
- The main `<ui-view>` is hidden during transitions with `ng-if="!state.transitioning"`.
- Auth failure from any HTTP request triggers the interceptor, logs the user out, clears the cookie client-side, and redirects to `login`.

Rewrite implications:

- React shell should preserve route-guard behavior, global loading/error affordances, and forced logout on `403`.
- This should become explicit app state and routing logic, not route-template side effects.

## Route Guard Pattern

Sources:

- `static/scripts/app.js`

Key behaviors:

- `verifyLogin()` calls `GET ./user`.
- On success it stores the user in `loginState`.
- On failure it redirects to `login`.
- `root` immediately redirects to `datasets.manage` after successful auth.

Rewrite implications:

- Preserve initial boot behavior and redirect target unless product decisions change it.
- Add route-level auth tests before migration.

## Shared Import Flow Infrastructure

Sources:

- `static/scripts/shared.js`
- `static/scripts/helpers.js`

Key behaviors:

- `ContextObjectImportController` is the core engine for target, mission, spacecraft, and instrument import/edit.
- Per-entity controllers only inject configuration such as required fields, LID fragment rules, lookup replacements, and relationship transform logic.
- The controller watches `config.modelName` to lazily initialize the form model.
- In create mode it also watches `model.<name>.logical_identifier` and performs two hidden async behaviors:
  - duplicate check through `GET ./edit/<modelName>`
  - metadata lookup/autofill through `GET ./lookup`
- Submit behavior may perform multiple API calls:
  - primary object save
  - relationship save if related rows exist
- Form shaping is hidden inside `sanitizer` and `prepForForm`.

Rewrite implications:

- Extract this into plain domain modules before or during rewrite:
  - input normalization
  - edit-mode hydration
  - duplicate-check behavior
  - registry autofill behavior
  - relationship packing/unpacking
- Avoid recreating AngularJS watch-driven behavior directly. Replace with explicit effects/hooks tied to the LID field.

## Repeating Empty Row Pattern

Sources:

- `static/scripts/shared.js`
- all import form directives

Key behaviors:

- `groupRepeater(array)` ensures there is always one trailing empty object in repeatable sections like tags.
- Empty rows are filtered visually but kept available for immediate typing.
- Sanitization later removes empty objects before POST.

Rewrite implications:

- The React forms need either:
  - an explicit "Add tag" action, or
  - a preserved trailing-empty-row interaction
- If preserving exact UX, this behavior must be tested intentionally.

## Relationship Prefill Pattern

Sources:

- `static/scripts/directives.js`
- `static/directives/relationship-selector.html`

Key behaviors:

- `relationshipSelector` watches the primary object LID.
- When the LID becomes a URN, it calls `relatedLookup` and merges backend results into the model.
- Existing rows are merged by `lid`, not replaced.
- If relationship types are provided, the second column is a `<select>`.
- Without `relationshipTypes`, the second column becomes a free-text input bound to `label`.

Rewrite implications:

- This is not just display; it is asynchronous model hydration.
- React tests need to cover prefilled relationships and merge semantics.

## Related Tools Selection Pattern

Sources:

- `static/scripts/directives.js`
- `static/directives/related-tool-selector.html`

Key behaviors:

- The control mutates the passed `tools` list by attaching `selected` and `directUrl`.
- If the incoming model is an array of scalar IDs, it converts it to `{ toolId }` objects.
- Typing a direct URL auto-selects the tool.
- The outbound model is rebuilt by watching the entire `tools` array deeply.

Rewrite implications:

- This should become a controlled component with explicit value mapping.
- Tests should cover:
  - existing selection hydration
  - URL typing implies selected
  - deselection behavior

## Manage List Pattern

Sources:

- `static/scripts/directives.js`
- `static/directives/manage-list.html`

Key behaviors:

- `manageList` is the shared renderer for most manage screens.
- It accepts either edit links via `sref` or an imperative `edit` callback.
- It can optionally:
  - group rows by a field
  - show tags
  - show context
  - show ready flags
- When grouping by a URN-like value, it performs async title lookups and mutates group objects with `display_name`.
- Group ordering is alphabetical by raw group name.
- Ungrouped items render before grouped sections.

Rewrite implications:

- Manage screens should share one table/list component in React.
- Grouping behavior and derived display labels should be extracted into testable helpers.
- Async group title lookup is easy to miss and should get parity tests where used.

## Dataset Load To Import Handoff

Sources:

- `static/scripts/datasets/DatasetLoaderController.js`
- `static/scripts/app.js`

Key behaviors:

- Fetching a remote archive only previews the harvested data.
- Confirming the preview performs a second POST to ingest the harvested XML.
- On success, the controller stores harvested bundle/collection data on global shell state as `state.datasets`.
- It then advances by calling `state.progress()`, which routes from `datasets.load` to `datasets.import`.

Rewrite implications:

- This is a multi-step workflow with transient in-memory state, not a single page.
- React rewrite should make this a deliberate wizard or route-state handoff, not hidden shell mutation.

## Modal Editing Pattern

Sources:

- `static/scripts/app.js`
- `static/scripts/targets/TargetTagsManageController.js`

Key behaviors:

- UI Bootstrap modals are used both for editor customization and tag group editing.
- Modal results mutate the original model object before save.

Rewrite implications:

- Modal flows should be explicitly modeled in component state.
- Tests need to cover confirm and cancel behavior, especially where edits are staged in modal-local state first.

## Rich Text and Image Upload

Sources:

- `static/scripts/app.js`
- `static/scripts/directives.js`

Key behaviors:

- Rich text uses `textAngular`.
- A custom toolbar action opens a modal and inserts `<img>` HTML.
- `imageUpload` posts to `./image/upload` and updates progress, error, and final URL.

Rewrite implications:

- Rich text replacement is a migration risk. The new editor must preserve allowed content and image insertion workflows.
- Add characterization tests around stored HTML payloads before replacing the editor.

## Prototype Patches

Sources:

- `static/scripts/helpers.js`

Key behaviors:

- Extends `Array.prototype`, `String.prototype`, and `Promise`.
- These helpers are used implicitly by controller code.

Rewrite implications:

- Replace with explicit utility functions during rewrite.
- Do not carry prototype mutation into the new frontend.
