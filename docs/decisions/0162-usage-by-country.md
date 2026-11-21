# 0162. Usage counted by country

- Status: Accepted
- Date: 2026-11-20

## Context

The usage page (ADR-0117) tells how many visit the site and use the app, but not from where. Pau asked whether it can show where users connect from. The server keeps no addresses and the site promises no logs of who connects: anything finer than a country, a town for instance, would also be wrong for phones, which show their carrier's town, and close to telling who in small places.

## Decision

- **The server counts visitors and connections by country**, and only how many (`apps/server/src/usage.ts`): a visitor's country once a day, when the visitor is first counted (`country:ES`), and each connection to the relay (`app-country:ES`); an address in no country, or not known, counts as `unknown`. The address is looked up when it arrives and forgotten, as before.
- **The countries come from DB-IP's free table** of address ranges, «IP to Country Lite» (CC BY 4.0), its CSV read into memory (`countries.ts`); IPv6 addresses by their network's first 64 bits. `deploy/vps/countries.sh` downloads the month's table on the 3rd (`tesel-countries.timer`) and the installer once, checks it and swaps it in; the server reads it again within the hour when it changes (`TESEL_COUNTRIES`). Without a table no country is counted.
- **The usage page shows «Desde qué países»**: each country in Spanish with its flag, visitors and connections over the 30 days, the ten largest by name, the rest added up as «Otros países», and «No se sabe»; with DB-IP's attribution, as its licence asks.
- **The legal notice says so**, in both languages: the server counts visits and connections by country, worked out from the address at the time, and keeps only the totals.

## Consequences

- Counted from the day a server has the table; nothing before, as nothing was kept.
- Someone behind a VPN counts in its country; groups that only use the mesh never reach the server.
- The table is read line by line as it is unzipped, twice (to count the ranges, then to keep them in arrays of that size): about two seconds, never holding the server more than a few milliseconds, some 10 MB kept and about 45 MB more while reading. Read whole at first, it took some 260 MB more at its peak in a server of 512 MB, and held it for a quarter of a second; the robustness review of 2026-11-21 found it.
