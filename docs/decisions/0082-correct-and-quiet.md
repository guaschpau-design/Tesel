# 0082. Mistakes easy to correct, and less noise

- Status: Accepted
- Date: 2026-10-31

## Context

The last part of the walk through the app ([ADR-0080](0080-told-without-looking.md), [ADR-0081](0081-found-in-a-tap-or-two.md)) found that a mistake was hard to put right and that a newcomer met words and notices meant for someone else. Nothing put on the map could be changed: a wrong label or symbol meant deleting it and drawing it again. "Delete" was a tile as large as "Follow route", so a member could delete the coordinator's route in two taps. The first launch greeted the user with "The app now works offline"; creating a group showed the server's address; the offline maps panel put a name, a detail in zoom levels, three checkboxes and a count of tiles before its button; someone who opened an invitation was asked for their name and then, in another dialog, whether to join, with the inviting device's ID. On an iPhone, the radio card said to use Chrome or Edge, which there cannot use radios. Smaller things: the check-in counted seconds, a radio not linked showed a red dot, a drawing counted "3 of 25 points", the example of typed coordinates was UTM only, a search area could be drawn as already cleared, and whether the check-in was on was hidden in a fold.

## Decision

- A marker, a zone or a route can be changed after it is saved: "Edit" opens the form it was described with, holding its label and its symbol or style. A strip of a sweep is changed by planning the sweep again.
- An action can be marked folded (`Action.folded`): it always waits in the "⋯" menu. "Delete" and "Remove sweep" are.
- No notice says the app works offline. A new group's server folds under "Server · Tesel's" unless it is changed.
- The offline maps panel shows the size and "Download" first; the name, the detail ("Streets", "Town", "Region") and the other maps fold under "Options".
- Opened through an invitation, the first launch joins its group in the same step: it says which group and as what, and its button is "Join «group»". The join dialog no longer names the inviting device.
- The radio card says where radios work: Chrome or Edge on Android or a computer, Bluefy on an iPhone. A radio not linked shows a grey ring, not a red dot.
- The check-in says the time left in minutes, then seconds. A drawing counts its points, and says the most it may have only near it. Typed coordinates show a decimal example beside the UTM one. A search area is not drawn as cleared, unless it is one already. The "Organise" fold says when the check-in is on. Sharing an invitation, where the phone can, is the first button.

The practice is left as it is: it is to give way to a tutorial.

This amends [ADR-0065](0065-room-for-what-is-read.md) and [ADR-0070](0070-a-simpler-app.md).

## Consequences

- A wrong label is fixed in three taps, and deleting takes one more tap than before, on purpose.
- A newcomer reaches the map without a word about servers, zoom levels or tiles.
- Changing an object sends it whole again, as drawing it did: the group keeps the newest.
