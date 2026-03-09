# Sync Audit

## Route

- Route: `sync`
- URL: `/Sync`

## Sources

- `static/scripts/tools/sync/index.js`
- `static/states/tools/sync.html`

## State Resolves

- `lastIndex` via `GET ./solr/last-index`
- `syncAvailable` via `GET ./solr/status`, coerced to boolean

## User-Visible Behaviors

- If sync is unavailable, the page shows an error panel and contact message.
- Otherwise it fetches a suggested suffix and prepopulates the form.
- User can submit the sync operation with the chosen suffix.
- The page shows a loading spinner during sync.
- After a successful sync, the page updates the "last successful sync" summary.

## Hidden Behaviors

- Suffix suggestion is fetched separately after the route resolves load.
- Submit is guarded against duplicate clicks by checking `state.loading`.
- Successful submit refreshes the suggested suffix for next time.

## API Behavior

- `GET ./solr/status`
- `GET ./solr/last-index`
- `GET ./solr/suffix-suggestion`
- `POST ./solr/sync`

## Rewrite Risks

- This screen is operationally sensitive because it triggers large backend side effects.
- It should be covered by end-to-end tests but likely use mocked backend responses for most CI runs.

## Tests Needed

- unavailable state rendering
- available state loads suggested suffix
- submit sends suffix
- loading state blocks duplicate submit
- success updates last sync summary
- failure surfaces backend error
