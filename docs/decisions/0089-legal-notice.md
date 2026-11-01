# 0089. A legal notice and terms of use on the site

- Status: Accepted
- Date: 2026-11-01

## Context

Tesel is used by teams in situations where a wrong position, a late message or a radio out of range can matter. The site said nothing about what the project does and does not answer for, and the project owner asked for a notice of use that leaves the responsibility for using Tesel with whoever uses it, linked from the site's footer.

## Decision

- The site has a legal notice and terms of use at `/legal/` (Spanish) and `/en/legal/` (English), linked from the footer of every page, written in the same plain words as the rest of the site.
- It says, in this order: what Tesel is and is not (a supporting tool, not an emergency service, a project under development); that it comes with no warranties (continuity, delivery of messages over the internet or by radio, accuracy of positions, maps, imagery and warnings, which come from third parties); what the user is responsible for (their decisions, their device and radios, the rules that apply to them, whom they invite, lawful use); the limitation of liability, to the extent the law allows; the radios (third-party devices, bought and used on the user's own account, lawful where they are used); privacy (no sign-up, end-to-end encryption, the server keeps encrypted messages for a limited time and cannot read them, no ads or analytics or trackers, position only when turned on, data on the device stays there); the brand; changes and Spanish law.
- The notice names no legal person and gives no contact: the project has not decided who stands behind it publicly. The page is `noindex`.
- The footer now holds only the brand and the link to the notice: the line "free, with no sign-up" is said at the top of the page, and the other language is reached from the top bar.

## Consequences

- Whoever stands behind Tesel is named in the notice when that is decided, and a contact added with it; the notice's date changes with its text.
- The notice is the project's own writing, not legal advice: it is reviewed by a lawyer before Tesel is offered to public bodies.
