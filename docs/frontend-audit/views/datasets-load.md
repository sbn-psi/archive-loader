# Datasets Load Audit

## Route

- Route: `datasets.load`
- URL: `/Load`

## Sources

- `static/scripts/datasets/DatasetLoaderController.js`
- `static/states/datasets/load.html`

## User-Visible Behaviors

- User enters an archive URL and clicks `Fetch`.
- The page previews:
  - detected bundle
  - detected collections
  - harvested XML payload
- User can then click `Load and Continue`.

## Hidden Behaviors

- `Fetch` calls `GET ./datasets/harvest` with the entered URL.
- `Load and Continue` calls `POST ./solr/harvest` with the harvested XML.
- On successful ingest, harvested bundle/collection objects are stored in global shell state as `state.datasets`.
- The controller then advances using global `state.progress()`, which navigates to `datasets.import`.

## Rewrite Risks

- This page depends on mutable cross-route memory in the root scope.
- If the user refreshes after the handoff, current behavior may differ from a more explicit route-state model.

## Tests Needed

- fetch success preview renders bundle, collections, and XML
- fetch failure surfaces backend error
- confirm posts harvested XML
- confirm success transitions to dataset import with preloaded data
