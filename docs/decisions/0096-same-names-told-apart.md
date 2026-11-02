# 0096. Members who share a name are told apart

- Status: Accepted
- Date: 2026-11-02

## Context

Members are trusted, and protocol version 1 does not prove who wrote an event ([ADR-0052](0052-authorship-is-not-proven.md)). The easiest way to pass for someone, though, needs no technical skill at all: taking the same name. Two people called Marta in one group, by chance or not, look the same on the map, in the chat and in the lists. Signing events or checking keys in person was weighed and set aside as too heavy for a team that works together.

## Decision

- Every device names members the same way: whoever announced a name first (earliest `MEMBER_INFO`, then by node ID) keeps it as it is, and each other member of the same name, compared regardless of case and surrounding spaces, gets a circled number after it: "Marta ②", "Marta ③", up to ⑳, and "(21)" beyond.
- The numbered name is used wherever the app names a member: the map, the chat, lists, tasks, teams and the diary's authors (`members/alias.ts`).
- Nothing changes in the protocol or in what is stored: the alias each member chose stays as they chose it.

## Consequences

- Copying a name no longer makes two members look alike; telling the real one from the other still depends on the team knowing who joined first.
- A member who changes their role announces their name again, and may lose its first place to another member of the same name; that is rare, and the numbers stay consistent on every device.
- Detecting events written under someone else's node ID was proposed and not adopted.
