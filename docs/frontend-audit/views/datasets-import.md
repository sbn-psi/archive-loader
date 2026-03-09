# Datasets Import Audit

## Route

- Route: `datasets.import`
- URL: `/Import?edit&type`

## Sources

- `static/scripts/datasets/index.js`
- `static/scripts/datasets/DatasetImportController.js`
- `static/states/datasets/import.html`
- `static/directives/dataset-import-form.html`
- `static/scripts/directives.js`

## State Resolves

- `existingDataset` via `GET ./edit/datasets` when `edit` is present
- `tags` via `GET ./tags/datasets`
- `tools` via `GET ./status/tools`

## Model Shape

Top-level model:

- `model.bundle`
- `model.collections`
- `view.active`
- `view.type`

Nested dataset defaults:

- `tags: []`
- `tools: []`
- `publication: {}`
- `example: {}`
- `related_data: []`
- `superseded_data: []`
- `download_packages: []`

## User-Visible Behaviors

- When multiple datasets are in memory, a left-side sticky nav appears for bundle/collection switching.
- Submit is global for the active edit session, not per sub-form.
- Bundle forms expose `primary_context`; collection forms expose `example.*`.
- Tag input uses typeahead and always shows a trailing empty row.
- Rich text fields exist for top and bottom supplemental HTML.
- Related tools can be selected with optional direct links.

## Hidden Behaviors

- Edit-mode hydration uses `prepForForm`.
- Harvested dataset data can seed the form through `$scope.state.datasets`.
- Dataset classification between bundle and collection is inferred from LID structure.
- Autocomplete suggestions are drawn from values already present in the in-memory dataset set, not remote data.
- Several sections are disabled in comments, not dead code removed. They may still represent intended future or legacy behavior.

## AngularJS-Specific Behaviors To Preserve Or Deliberately Replace

- The active dataset record is swapped by mutating `view.active`.
- The dataset nav label is bound to `logical_identifier`, so blank or partially typed identifiers affect navigation display.
- `uib-typeahead` is used on many fields, including textareas.
- The form directive delegates repeatable-tag behavior to `FormController.groupRepeater`.

## API Behavior

Submit issues:

- `POST ./save/datasets`

Payload shaping:

- `bundle` is sanitized independently
- each collection is sanitized independently
- empty nested objects become `null`
- empty repeated rows are removed
- tags are converted from `{ name }` objects to strings

## Rewrite Notes

- This page should become a route-level form orchestrator plus a reusable `DatasetForm` component.
- Autocomplete rules should live in a pure helper that can be unit tested.
- Bundle/collection switching should be explicit route or local component state, not direct object mutation.
- Rich text handling should be isolated from the data model.

## Tests Needed

- load edit mode with existing dataset and verify fields hydrate correctly
- open create mode for bundle and collection and verify field differences
- verify left nav only appears when more than one dataset is in memory
- verify autocomplete suggestions come from current in-memory datasets
- verify tags preserve trailing entry behavior or approved replacement UX
- verify tools selection and direct URL behavior
- verify submit payload matches current sanitizer semantics
