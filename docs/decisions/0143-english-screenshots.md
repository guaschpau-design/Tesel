# 0143. The English home page shows the app in English

- Status: Accepted
- Date: 2026-11-18

## Context

The home page shows two screenshots of the app at work (ADR-0088, ADR-0113): a tablet with the chat open and a phone with an SOS. Both pages, Spanish and English, showed the same pictures, with the app and the team in Spanish. Pau noticed it on the English page.

## Decision

- The simulator's screenshots (`tools/simulator/src/screenshots.ts`) take a language, `--lang es` (the default) or `--lang en`: the browser's locale, which the app's language follows, and the words the script finds its way by.
- The Turia scenario is written in both languages (`turia`, `turia-en`): markers, the team, the task, the chat, the SOS and the report, and what Ana, the coordinator, writes.
- The site has a pair of pictures per language: `app-tablet` and `app-phone` for the Spanish page, `app-tablet-en` and `app-phone-en` for the English one. Both pairs were taken again from the app as it is now.
- The script leaves full screen only when the app is in it: since ADR-0131 a tablet-sized browser without touch no longer goes full screen.

## Consequences

- A reader of the English page sees the app as they will use it, in English.
- Each change to the app's look asks for four pictures, not two: the script takes each pair in one run.
