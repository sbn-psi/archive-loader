# Login And Shell Audit

## Routes

- `root`
- `login`

## Sources

- `static/index.html`
- `static/scripts/app.js`
- `static/states/login.html`
- `static/scripts/directives.js`

## User-Visible Behaviors

- App shell includes navbar, authenticated navigation sections, username label, logout button, page title, main content area, global loading indicator, alert area, and global error banner.
- Navbar sections only render when logged in.
- Visiting the app root verifies auth and redirects to `datasets.manage`.
- Login screen posts username/password and redirects to root on success.
- Logout always clears client auth state even if the backend logout call fails.

## Hidden Behaviors

- Shell title is updated by a directive listening to route transitions.
- Route transitions toggle both `loading` and `transitioning`.
- The main content is temporarily removed during route transitions.
- Any HTTP `403` invokes the auth interceptor and redirects to login.
- Client-side logout removes the `archive-loader` cookie explicitly.

## API Behavior

- `POST ./login`
- `GET ./logout`
- `GET ./user`

## Rewrite Risks

- The auth and routing behavior is distributed across root controller, `loginState`, interceptor, and inline route controllers.
- Current shell state is mutable and global; the React rewrite should replace this with explicit app state and route protection.

## Tests Needed

- unauthenticated root visit redirects to login
- successful login redirects to datasets manage
- authenticated shell renders nav and username
- logout clears auth state and redirects
- any `403` forces logout and redirects

## Orphaned/Unrouted View Note

- `static/states/tools/registry.html` exists in the repo, but no active state registration for a registry route was found in the current frontend scripts.
- Treat it as dead or incomplete functionality until proven otherwise during backend or user validation.
