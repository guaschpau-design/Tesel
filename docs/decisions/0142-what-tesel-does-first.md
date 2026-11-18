# 0142. The home page says what Tesel does before how it stays connected, in professional words

- Status: Accepted
- Date: 2026-11-18

## Context

The home page (ADR-0088) went from why Tesel exists straight to its resilient communications, and only then showed what the app does, under "Todo el equipo ve lo mismo" ("The whole team sees the same thing"). Pau asked for what Tesel does to come before the communications, and found that heading naive: he wanted one that reads as professional to emergency teams and the institutions behind them. He found the four principles under «Por qué Tesel» («Para cualquiera», «Se entiende sola», «Más de un canal», «Solo lo ve el equipo») unconvincing too, and asked for each to be named by one concept, as «Segura» for the last.

## Decision

- The section on what Tesel does («Qué hace», `#capacidades`; `#capabilities` in English) comes right after «Por qué Tesel», before «Comunicaciones resilientes». A reader learns what the app gives a team before how it keeps working without coverage.
- Its heading is «Una imagen operativa común, en cada móvil» ("A common operating picture, on every phone"): the term emergency services and armed forces use for one shared view of an operation. Its lead says "the same map for the whole team" rather than repeat "on every phone".

- The four principles are named by one word each: **Accesible**, **Intuitiva**, **Resiliente**, **Segura** ("Accessible", "Intuitive", "Resilient", "Secure"); the text under each is as it was.

## Consequences

- The page reads from the product to its distinctive strength: what it does, then why it keeps doing it when the network fails.
- The principles read as the qualities a team weighs a tool by, and the text under each says what each means in practice.
- The heading speaks the language of the teams Tesel is for; the lead under it keeps the plain words of ADR-0088.
