# 0117. How much Tesel is used, counted per day and anonymously

- Status: Accepted
- Date: 2026-11-06

## Context

Whoever runs tesel.eu could not tell how many people visit the site or use the app. The server keeps no access logs (ADR-0013's Caddyfile), Fastify's log is off because it would record addresses, and the site promises no ads, no analytics and no logs of who connects. Google Search Console shows only searches. A tracking service would contradict that promise, need a cookie banner and send visitors' data to a third party, which the organisations Tesel is offered to would not accept.

## Decision

- **The server counts usage per day, and keeps only the counts** (`apps/server/src/usage.ts`), in a `usage` table of its database (schema version 4): page views of each page of the site, the app's pages counted as one; visitors; the sites that visits come from, by host name only, at most 50 a day; page views of robots and scripts, apart; connections to the relay, and the most open at once; groups that joined it; envelopes stored and their bytes.
- **Nothing that says who is kept.** Visitors are told apart in memory by a digest of their address and browser under a key drawn each day and never written; groups by their ID, also in memory. Only how many there were each day is stored. No cookie is set, the page sends nothing back and runs no script. The counts are written every minute and kept two years.
- **Days are those of Spain** (`TESEL_TIME_ZONE`, `Europe/Madrid` by default).
- **A private page shows them**: `/stats`, the last 30 days in tiles, daily bars and tables, plain HTML and SVG under the site's Content-Security-Policy, behind HTTP basic authentication with the user `tesel` and `TESEL_STATS_KEY`. The installer draws that key on its first run and prints it at the end of each run. Without a key there is no page; the counts are made either way.

## Consequences

- The site keeps its promise of no ads, no tracking and no logs of who connects. Counting visits by day is a figure the server makes, not a record of anyone.
- The app runs from the phone once installed, so the app's page loads count only those that reach the network; the relay's connections and active groups are the better measure of use.
- A visitor who comes back on another day counts again, and one whose address or browser changes in a day counts twice. A restart in the middle of a day forgets who was already counted that day, so visitors and groups are counted low rather than high.
- Groups that use only the mesh never reach the server and are not counted.
