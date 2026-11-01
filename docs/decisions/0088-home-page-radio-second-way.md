# 0088. The home page: situational awareness, and the radio as a second way

- Status: Accepted
- Date: 2026-11-01

## Context

The home page (`apps/site/index.html`, `en/`) had fallen behind the app and the project. It explained the radio in one row of a diagram among three, so the point of Tesel, that a team keeps in touch when the network fails, was easy to miss; it numbered parts of a screenshot that the reader then had to find in a list; it promised native apps without a date; and its screenshots showed the app before [ADR-0087](0087-explained-where-used.md). The project owner asked for the page to explain the product's philosophy in plain, friendly words, to make the radio channel understood above all, to say that the app is free and needs no sign-up, and not to speak of its licence. A first version of this page led with "the team's shared map, even when the network fails", opened with the emergency where "the network is the first thing to fail", drew the radio as scenery (masts, hills) and announced a version for town councils, "Tesel Profesional"; the owner found the opening dramatic, the drawings crude, and asked for the council version to stay unannounced until its business plan is settled.

## Decision

- The page leads with "Situational awareness for teams", the term the owner chose, explained at once in plain words: where everyone is, what is happening and who is taking care of what, over the internet and, if coverage fails, by radio.
- "Why Tesel" is four simple ideas (for anyone, understood at once, more than one way, only the team sees it), in a calm voice: no catastrophe.
- The radio has a section of its own, "If coverage fails, it carries on by radio": a short explanation (the phone can carry a pocket radio; when there is no coverage, messages hop from radio to radio; nobody has to touch anything), then three schemes, drawn as nodes and links rather than scenery (with coverage, without it, both at once through a phone that bridges), and four facts. "Both at once" is real: a device with a server connection and a radio bridges in both directions ([ADR-0043](0043-radio-delivery.md)).
- "What it does" shows the app as it is, from new screenshots staged by the simulator on the real base map, and lists what it does in a plain grid; the numbered pins are gone.
- The page says Tesel is free and needs no sign-up, and nothing of its licence, of running one's own server, of native apps, or of a version for public bodies.
- The questions are tightened and gain three the page left open: whether anything is installed, whether the map works offline, and who can get into a group.
- The screenshot tool (`tools/simulator/src/screenshots.ts`) follows the app's first steps after ADR-0087 and leaves full screen before taking the phone picture.

## Consequences

- The radio is what a visitor remembers, told without drama; the screenshots show the app as it is.
- A version for public bodies, when it is announced, gets a decision of its own.
