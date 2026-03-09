# Frontend Rewrite Audit

This directory is the durable source of truth for the AngularJS frontend rewrite.

The goal is to document behavior, not implementation loyalty. Each view audit should make it possible to:

- understand what the current UI does
- find where that behavior lives in AngularJS
- design React tests for parity
- rewrite the feature without carrying AngularJS patterns forward

## Structure

- `view-inventory.md`: route and template inventory for the current SPA
- `shared-behaviors.md`: cross-cutting AngularJS behavior that affects multiple views
- `views/*.md`: one file per route/view, with controller, model, template, directives, API calls, and rewrite notes

## Audit Rules

For each audited view, capture:

1. Route name and URL
2. State resolves and route guards
3. Controllers involved
4. Templates/directives involved
5. Model shape on `$scope`
6. User-visible behaviors
7. Hidden AngularJS behaviors
8. API calls and payload shaping
9. Rewrite risks
10. Test cases needed for parity

## Status

Initial audit coverage in this directory focuses on:

- shared AngularJS form infrastructure
- dataset import
- target import
- mission import
- spacecraft import
- instrument import

Remaining views should be audited next in this order:

1. manage lists
2. dataset load
3. target relationships
4. target tags
5. relationship type management
6. sync
7. reports
8. login shell/auth flows
