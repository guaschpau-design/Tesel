# 0142. The home page says what Tesel does before how it stays connected

- Status: Accepted
- Date: 2026-11-18

## Context

The home page (ADR-0088) went from why Tesel exists straight to its resilient communications, and only then showed what the app does, under "Todo el equipo ve lo mismo" ("The whole team sees the same thing"). Pau asked for what Tesel does to come before the communications, and found that heading naive: he wanted one that reads as professional to emergency teams and the institutions behind them.

## Decision

- The section on what Tesel does («Qué hace», `#capacidades`; `#capabilities` in English) comes right after «Por qué Tesel», before «Comunicaciones resilientes». A reader learns what the app gives a team before how it keeps working without coverage.
- Its heading is «Una imagen operativa común, en cada móvil» ("A common operating picture, on every phone"): the term emergency services and armed forces use for one shared view of an operation. Its lead says "the same map for the whole team" rather than repeat "on every phone".

## Consequences

- The page reads from the product to its distinctive strength: what it does, then why it keeps doing it when the network fails.
- The heading speaks the language of the teams Tesel is for; the lead under it keeps the plain words of ADR-0088.
