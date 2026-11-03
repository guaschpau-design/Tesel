# 0111. Keep the radio's airtime across restarts, drive it from one window, and number events per group

- Status: Accepted
- Date: 2026-11-03

## Context

An audit of the radio, the group's state and its sync, made before [ADR-0103](0103-rivals-full-storage-and-urgent-sync.md) and [ADR-0104](0104-sos-across-drops-and-groups.md), left smaller gaps of robustness and privacy. Most were defects with an obvious repair (listed under Consequences). These needed a decision:

- **The airtime budget lived in memory.** The scheduler's rolling hour ([ADR-0015](0015-lora-airtime-policy.md)) started empty at every start of the app: a reload let a device spend the urgent 10 % again within the same hour, up to 20 %. Two windows of the app linked to one radio each kept a budget of their own, and each read the other's answers from the radio as its own.
- **A newer version closed the databases at once.** When a newer version of the app opened in another window, this window let its databases go and stopped, even with an own SOS open or a radio linked; [ADR-0093](0093-gaps-an-audit-found.md) already keeps reloads from happening then.
- **One sequence counter for every group.** A device numbered its events in all its groups with one counter, so the members of one group saw its numbers jump by the events it wrote in others: how active it is elsewhere, and when. Protocol §3.1 needs `(origin, seq)` to be unique only within a group.
- **Heard by radio, from replays.** A member's details say when something of theirs last arrived by radio (`links/heard.ts`). A frame recorded and played back counts there too.

## Decision

- **The airtime spent is kept on the device.** Each send's airtime, `{at, ms}`, is written to the settings store (`radio/airtime-store.ts`), trimmed to the hour by the scheduler's window (`AirtimeWindow.uses`), and counted again each time a radio is connected (`LoraScheduler.restoreAirtime`). A use stamped more than an hour ahead of the clock is dropped when restored, as it would hold the budget until that time came.
- **One window drives the radio.** A window holds a lock of the browser (`navigator.locks`, `radio/radio-lock.ts`) from connecting a radio until it is disconnected. Another window that asks for a radio meanwhile does not show the picker and says the radio is in use in another window. A browser without locks connects as before.
- **The databases wait for an own SOS and a linked radio.** A newer window that wants the databases gets them once neither holds this one (`Startup.hold`); meanwhile it says, as before, that an older window is open. Both databases follow the rule.
- **Each group numbers a device's events on its own.** The sequence store keeps one counter per group (`next/<group>`), and skipping a number taken under one's name (ADR-0103) is per group. The counter that served every group, under `next`, is no longer moved: every group's counter starts at it, so no number a device used before is used again in any group, and none meets an event of its own that ADR-0103 would take as a rival. The database goes to version 8, with no change of store, so that a window of an older version lets it go before numbering with the old counter. Since one number can now name an own event in two groups, the scheduler ends the repeats of an own SOS only with an answer heard in its own group (the group named by `changeGroup` and `observe`), and an SOS notification's tag names its group.
- **Heard by radio counts copies, replays included.** A copy of an event already in the log still says the radio brings that member's news: on a device with both links the internet is usually first, and a bridge puts on the air what the server brought. The time recorded is the event's own, so a frame played back later never makes news look newer than it was; and only a member of the group can seal a frame (ADR-0099). Counting only events new to the log would leave a device with both links almost never showing the radio.

## Consequences

- Amends [ADR-0015](0015-lora-airtime-policy.md) (the budget outlives a restart and belongs to one window), [ADR-0093](0093-gaps-an-audit-found.md) (the databases wait too), [ADR-0099](0099-sealed-radio-frames.md) (a played-back frame counts as heard by radio), [ADR-0103](0103-rivals-full-storage-and-urgent-sync.md) (numbers are skipped per group) and [ADR-0104](0104-sos-across-drops-and-groups.md) (an own SOS is answered only in its own group). Protocol §3.1 says a device keeps a counter per group.
- A window with an own SOS open keeps a newer version from starting elsewhere until the SOS is cancelled; that window shows why.
- The airtime of a send whose record could not be stored, the storage full, counts only while the app runs.
- The node ID stays one per device: members of two groups that share a member can still tell it is the same device, and a group's first number after this change says how many events the device had written in all before it. A node ID per group would change the identity a device has in each group, and is left for a change of identity of its own.
- A device of an earlier version goes on numbering all its groups with one counter until it is updated.
- Repaired without a decision of their own: the scheduler is split into its queue (`lora-scheduler.ts`), what is still news (`air-news.ts`) and SOS repeats (`sos-repeats.ts`); a Meshtastic link keeps at most 500 nodes, dropping the one heard least recently, and takes no position off the Earth; an exception in a listener of the app no longer drops a Meshtastic link; an old link that lets its Bluetooth connection go late no longer drops a newer link to the same radio, as only the newest hold on a device disconnects it (`BleHold`); who walks a strip and the order of SOS calls break ties of one second with `compareEvents`; a few live events go into the journal in one copy rather than a sort of it, and a batch of positions copies the map of trails once.
