# 0110. Guard against look-alike names and invitations, and close loose ends

- Status: Accepted, amended by [0128](0128-entering-a-group-shares-the-position.md) (a first launch through an invitation, and creating a group, share the position)
- Date: 2026-11-03
- Amends: [ADR-0096](0096-same-names-told-apart.md) (how names are compared), [ADR-0012](0012-invitation-links-under-a-base-path.md) (links with a query), [`protocol.md`](../protocol.md) §6 (server URLs and invitation links)

## Context

An audit of how the web app can be deceived, and of a few small gaps in its robustness, found:

- **A look-alike invitation moved the user, and their live position, to another group.** Anyone can make a group with exactly the name of the user's own, on a server of their own, and send its invitation. The join dialog showed only the name; joining made the group the active one, and position sharing, chosen once for the device, started publishing there.
- **The numbering of same names (ADR-0096) was easy to defeat, and not the same on every device.** Names were compared after `trim()` and `toLocaleLowerCase()`: a zero-width space, a Cyrillic letter drawn like a Latin one, an accent typed apart, or a double space made "Marta" another name; `toLocaleLowerCase()` follows the browser's language (a Turkish browser lowercases I as dotless ı), so two devices could number differently. A right-to-left override in a name or a message turned the words around it backwards.
- **Invitations accepted odd servers.** `http://127.0.0.1:631/` decoded, and the app would connect to a service on the user's own device; a server with a user name, a bare `?` or a fragment was accepted too.
- **A join link with a query or a slash at the end did nothing**: `/app/join?fbclid=…#token`, as messengers pass links on, had its secret cleared from the address bar, and nothing opened and nothing was said.
- **A shape file could freeze or quietly fail the app.** `&#x110000;` threw, `&#xD800;` made half of a character, GeoJSON nested deep enough overflowed the stack, and for every opening tag the reader searched forward for its close: 0.9 MB of unclosed tags took nine seconds, 5 MB minutes. The error of a failed read was dropped.
- **An app left open never learnt of a new version**, as nothing asked for one after it opened; and a window kept on its version while an update waits, with an own SOS open or a radio linked, could no longer load the parts it loads on first use (the QR scanner, the satellite map, the radio's code) once the new version had taken over: the service worker drops the old files from its cache and the server serves only the new build.
- **One long word** in a member's text widened SOS banners and other cards past the screen.

## Decision

### Invitations say where they lead, and ask before sharing a position

- The join dialog always says which server the group uses (its host), or that it has none.
- When the device belongs to another group whose name looks the same, the dialog says, in a framed warning, that this is a **different group with the same name**, to join only knowing who sent it.
- Wherever the app names the device's groups (the top bar, the groups panel, notices, the SOS of another group), groups of names that look the same are told apart as members are: the first joined keeps the name, the others show "Rescate ②". A number, not the server: an outsider is as likely to use the same public server.
- **Position sharing is not carried into a new group without asking.** When the device shares its position and joins a group it was not in, the dialog asks with a box, unticked, whether to share it there; left unticked, sharing is paused before the group becomes the active one, so no position reaches it, and the notice says so. Asking every time a device that shares joins a new group is one tick for a real team, and it is the only moment the user can be sure where the position goes; pausing rather than hiding keeps the last position in the group the user came from, as pausing does anywhere. A first launch through an invitation does not ask: the device shares nothing until the user chooses to. (ADR-0128 changed this: entering the group on a first launch shares the position, as the welcome says.)

### Names are compared by what they look like, the same way everywhere

- Two names are the same when their **key** is (`lib/names/names.ts`): NFKC (a full-width letter is the letter, an accent typed apart joins its letter), without the characters no one sees (`Default_Ignorable_Code_Point` and format characters, category Cf), look-alike letters of other scripts in their Latin form, lowercased with `toLowerCase()`, which is the same in every language, and any run of spaces as one.
- **The look-alike table is small on purpose** (`lib/names/confusables.ts`): the Cyrillic and Greek letters every font draws exactly as a Latin one, and the two Latin letters of phonetics drawn as plain ones, each folded in its own case before lowercasing (a capital Greek nu is an N, a small one a v). Unicode's full confusables list, and look-alikes within one script (I and l, rn and m, 0 and O), are left out: fonts tell many of them apart, and folding them would number names that differ for real, "Ila" and "Lia". The table catches what copying a name with another keyboard does.
- **A name typed with a character no one sees is refused**, with its own message: an alias, a group's name and a team's name. The zero-width joiner and non-joiner are allowed: emoji such as the firefighter and several scripts need them, they reorder nothing, and the key leaves them out.
- **What others wrote is shown without those characters**: members' and teams' names, chat lines and the texts and senders heard from other radio apps, SOS details, tasks, report notes, map labels, the diary, group names from invitations. The protocol and the stored events keep the text as it came.
- The order of numbering is still that of ADR-0096: whoever announced the name first, by the time their own device wrote. That time is the member's own and can be forged; copying a name earlier than someone joined is still possible, and the number then lands on the real one.

### Invitations carry a server and nothing else

- In an invitation, a **server URL** is a secure URL with no `@`, `?` or `#`: no user name or password, no query, not even an empty one, and no fragment. Encoders and decoders refuse any other (protocol §6).
- The app takes a server on a loopback host (`localhost`, `*.localhost`, `127.0.0.0/8`, `::1`, `0.0.0.0`), whatever its scheme, only when the app itself is served from one, as in development and the end-to-end tests; otherwise the invitation is refused as damaged, and a typed server so is refused too. This is decided in the app, from where it runs: the decoder cannot know.
- **Invitation links ignore a query and a slash after `join`**, in the address the app opens with and in a pasted or scanned link alike: the token is in the fragment, and the rest is what messengers add. A join address whose token is missing or unreadable says the invitation is damaged.

### Shape files are read in time in proportion to their size, and never throw

- Character references name only real characters: none past U+10FFFF and no half of one; any other is left as written.
- GeoJSON is walked with a stack of its own, not by recursion.
- An XML element's tags are found in one pass: an element holds what comes up to its closing tag or, never closed, up to the next element of its name or the end, as in a file cut short. Attribute matches stop at `<`, and CDATA is opened by searching for its end once.
- Anything that still throws while reading becomes the "unreadable" message.

### Updates are asked for, and a kept window keeps its parts

- The app asks the service worker to check for a new version every hour and whenever it is shown again.
- **When a new version is waiting, every window loads ahead the parts it loads on first use** (`lib/pwa/updates.ts`), while its own version's files are still in the cache. A module loaded once stays loaded in the window, so a window kept on the old version after the new one takes over still has them all. A test checks that the list holds every `import()` of the app. Keeping the previous build's files on the server, or in a cache of the service worker's own, was weighed and set aside: it needs the deployment, GitHub Pages and the service worker to agree on what to keep and for how long, while this needs a few hundred kilobytes read from the cache, once, in a window that is about to update anyway.

### Long words break

- Map cards, panels, dialogs and notices break a word longer than they are wide (`overflow-wrap: anywhere`), and the stacks of cards on the map size their column with `minmax(0, 1fr)`, so nothing a member writes scrolls the screen sideways.

## Consequences

- A user who joins a new group while sharing their position must tick a box to go on sharing in it; their position pauses in the group they came from too, until they share again.
- Names spelt with letters of other scripts that look like Latin ones are numbered as copies of the Latin name. A real Greek or Cyrillic name that happens to look like a Latin one already in the group is numbered as such, which is what it looks like.
- An existing alias, group or team name with a hidden character is not changed: it is shown without it, and compared without it.
- A group whose server is on a loopback host, joined in development, still works; an invitation to one opened in the published app is refused.
- `protocol.md` §6 changed: decoders written against the old text refuse links that a query was added to, and accept servers with a query, until they follow it.
- A new lazily loaded part must be listed in `lib/pwa/updates.ts`; its test fails until it is.
