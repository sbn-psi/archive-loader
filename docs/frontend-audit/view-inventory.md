# View Inventory

This is the route-to-view map for the AngularJS SPA.

## Root and Auth

| Route | URL | Template | Controller |
| --- | --- | --- | --- |
| `root` | `` | none | inline controller in `static/scripts/app.js` |
| `login` | `/login` | `static/states/login.html` | inline controller in `static/scripts/app.js` |

## Datasets

| Route | URL | Template | Controller |
| --- | --- | --- | --- |
| `datasets` | `/Datasets` | none | redirect only |
| `datasets.import` | `/Import?edit&type` | `static/states/datasets/import.html` | `DatasetImportController` |
| `datasets.load` | `/Load` | `static/states/datasets/load.html` | none |
| `datasets.manage` | `/Manage` | `static/states/datasets/manage.html` | none in state template; behavior comes from nested directives/controller usage |

## Targets

| Route | URL | Template | Controller |
| --- | --- | --- | --- |
| `targets` | `/Targets` | none | redirect only |
| `targets.import` | `/Import?edit` | `static/states/targets/import.html` | `ContextObjectImportController` plus nested `TargetImportController` |
| `targets.manage` | `/Manage` | `static/states/targets/manage.html` | none in state template; behavior comes from nested directives/controller usage |
| `targets.relate` | `/Relate` | `static/states/targets/relate.html` | `TargetRelationshipsController` |
| `targets.tags` | `/Tags` | `static/states/targets/tags.html` | `TargetTagsManageController` |

## Missions

| Route | URL | Template | Controller |
| --- | --- | --- | --- |
| `missions` | `/Missions` | none | redirect only |
| `missions.import` | `/Import?edit` | `static/states/missions/import.html` | `ContextObjectImportController` plus nested `MissionImportController` |
| `missions.manage` | `/Manage` | `static/states/missions/manage.html` | none in state template; behavior comes from nested directives/controller usage |

## Spacecraft

| Route | URL | Template | Controller |
| --- | --- | --- | --- |
| `spacecraft` | `/Spacecraft` | none | redirect only |
| `spacecraft.import` | `/Import?edit` | `static/states/spacecraft/import.html` | `ContextObjectImportController` plus nested `SpacecraftImportController` |
| `spacecraft.manage` | `/Manage` | `static/states/spacecraft/manage.html` | none in state template; behavior comes from nested directives/controller usage |

## Instruments

| Route | URL | Template | Controller |
| --- | --- | --- | --- |
| `instruments` | `/Instruments` | none | redirect only |
| `instruments.import` | `/Import?edit` | `static/states/instruments/import.html` | `ContextObjectImportController` plus nested `InstrumentImportController` |
| `instruments.manage` | `/Manage` | `static/states/instruments/manage.html` | none in state template; behavior comes from nested directives/controller usage |

## Tools

| Route | URL | Template | Controller |
| --- | --- | --- | --- |
| `relationships` | `/Relationships` | `static/states/tools/relationships.html` | inline `ManageRelationshipsController` in `static/scripts/tools/relationships/index.js` |
| `sync` | `/Sync` | `static/states/tools/sync.html` | inline state controller in `static/scripts/tools/sync/index.js` |
| `reports` | `/Reports` | `static/states/tools/reports.html` | inline state controller in `static/scripts/tools/reports/index.js` |

## Shared Directives Used As Feature Building Blocks

- `datasetImportForm`
- `targetImportForm`
- `missionImportForm`
- `spacecraftImportForm`
- `instrumentImportForm`
- `manageList`
- `imageUpload`
- `relationshipSelector`
- `relatedToolSelector`
- `relationshipsForm`

## Notes

- Several views have no obvious state controller because behavior lives in nested controllers attached inside the template.
- Import flows for targets, missions, spacecraft, and instruments all depend on the shared `ContextObjectImportController`.
- The rewrite should track feature parity by view file, but also by shared directive, because many user-visible behaviors are defined there instead of in the route template.
