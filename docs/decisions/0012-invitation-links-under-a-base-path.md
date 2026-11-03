# 0012. Invitation links work under a base path

- Status: Accepted, amended by [0017](0017-server-serves-site-and-app.md) (GitHub Pages only redirects) and [0110](0110-deception-and-loose-ends.md) (a query and a final slash are ignored)
- Date: 2026-10-25
- Amends: [`protocol.md`](../protocol.md) §6, which required the path to be exactly `/join`

## Context

Until our own server runs, the web app is published on GitHub Pages at `https://{user}.github.io/tesel/`. Under a sub-path an invitation link is `/tesel/join`, which the original rule rejected. Static hosts also have no way to rewrite `/tesel/join` to the app's `index.html`.

## Decision

- An invitation link is `{app-base-url}join#{token}`, where the base URL is the `https:` URL the app is served from, ending in `/`. Decoders accept any `https:` URL without a query whose last path segment is `join`.
- Besides `https:`, links and server URLs may use `http:` on a loopback host (`localhost`, `127.0.0.1`, `[::1]`), so invitations can be tried in development. Browsers treat exactly these origins as secure contexts.
- The token stays in the fragment, so it is still never sent to any server.
- Wherever the app is hosted, the join path must serve the app. Our server does it with a route. On static hosts the deployment adds `404.html` as a copy of `index.html`, which GitHub Pages serves for unknown paths (see `.github/workflows/ci.yml`). Once the app is installed, the service worker answers every navigation with the app, so the host is not even asked.
- The app removes the token from the address bar and history as soon as it has read it.

## Consequences

- The same build works at the root of a domain and under a sub-path.
- On GitHub Pages the first visit through an invitation link is served with HTTP status 404. Browsers render it normally; it only shows up in logs.
- The host part of an invitation is not checked: a link to any host with a valid token is accepted, as before. The token, not the host, carries the group.
