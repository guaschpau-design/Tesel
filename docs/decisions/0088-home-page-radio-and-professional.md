# 0088. The home page: the radio as a second way, and Tesel Profesional

- Status: Accepted
- Date: 2026-11-01

## Context

The home page (`apps/site/index.html`, `en/`) had fallen behind the app and the project. It led with "situational awareness", a term of the trade; it explained the radio in one row of a diagram among three, so the point of Tesel, that a team keeps in touch when the network fails, was easy to miss; it promised native apps without a date; and it did not say that a version for town councils is planned (two Tesels: the free one, and one for public bodies with their own radio network, a dedicated server, their identity, training and sustainment). The project owner asked for the page to explain the product's philosophy, to make the radio channel understood above all, to say that the app is free and needs no sign-up, and not to speak of its licence.

## Decision

- The page leads with what Tesel is for: the team's shared map, even when the network fails. A section on why (made for the worst day: for anyone, understood at once, not tied to one network, the team's data for the team) comes before what the app does.
- The radio has a section of its own, "A second way, by radio": three drawings (with coverage, without it, both at once through a bridge), each with two sentences, then four facts (everything travels by radio, the urgent first, the more radios the further, no licences or operators). It says the radio backs the internet up rather than replaces it.
- "Tesel Profesional", for town councils and public bodies, has a section and a link in the top bar: its own radio network, a dedicated server, the council's identity, training and drills, sustainment. It is marked "coming soon", with no contact yet.
- The page says Tesel is free and needs no sign-up, and says nothing of its licence or of running one's own server. The promise of native apps is gone. "How to start" and "Works in the browser" become one section of three steps.
- The drawings are hand-drawn SVGs with no words, as the app's own drawings were. The screenshots of the app are kept until new ones can be taken with the real base map.

## Consequences

- The radio is what a visitor remembers; the screenshots, once retaken, show the app as it is.
- When Tesel Profesional can be contracted, the section gains a way to get in touch.
