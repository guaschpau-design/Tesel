// Groups this device belongs to (ARCHITECTURE.md §3.2). A group is its secret plus what the
// invitation said about it; every key is derived from the secret when needed.

import {
  deriveGroupKeys,
  generateGroupSecret,
  GROUP_NAME_MAX_BYTES,
  isServerUrl,
  SERVER_URL_MAX_BYTES,
  toBase64url,
  utf8ByteLength,
  type Invitation,
  type NodeId,
  type RandomSource,
  type Role,
} from '@tesel/protocol';

import { nameFault, nameKey, numberedNames, type NameFault } from '../names/names.ts';

export interface StoredGroup {
  /** Group ID (protocol §5) in base64url: public, safe to use as a key and in logs. */
  readonly id: string;
  readonly name: string;
  readonly secret: Uint8Array;
  /** This device's role in the group. Advisory in v0.1 (ADR-0005). */
  readonly role: Role;
  /** Server base URL, or null when the group works without a server. */
  readonly server: string | null;
  /** Who invited this device, or null if this device created the group. */
  readonly invitedBy: NodeId | null;
  /** Milliseconds since the epoch. */
  readonly joinedAt: number;
  /** How many chat lines and reports of others this device has shown: the rest are new. */
  readonly chatSeen?: number;
}

/** What joining through an invitation did. */
export type JoinOutcome = 'joined' | 'promoted' | 'already-member';

/** What is wrong with a group name as typed, once trimmed (names.ts), or null. */
export function groupNameFault(text: string): NameFault | null {
  return nameFault(text.trim(), 1, GROUP_NAME_MAX_BYTES);
}

/** Trims a group name and returns it, or null if it cannot be used (groupNameFault). */
export function normalizeGroupName(text: string): string | null {
  return groupNameFault(text) === null ? text.trim() : null;
}

/**
 * Whether the app may use a server: a server URL (protocol §6) of a size an invitation can carry
 * and, unless the app itself runs on this device as in development, not on this device, where an
 * invitation could point the app at another service of the user's (ADR-0110).
 */
export function isUsableServer(url: string, appHost: string): boolean {
  if (!isServerUrl(url) || utf8ByteLength(url) > SERVER_URL_MAX_BYTES) return false;
  return isLoopbackHost(appHost) || !isLoopbackHost(new URL(url).hostname);
}

/** Names of this very device: localhost, the 127.0.0.0/8 addresses, ::1 and 0.0.0.0. */
function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    /^127\.\d+\.\d+\.\d+$/.test(hostname) ||
    hostname === '[::1]' ||
    hostname === '0.0.0.0'
  );
}

/**
 * Validates a server address typed by a coordinator in an app served from `appHost`: empty means
 * "no server", anything else must be usable (isUsableServer). Returns undefined if invalid.
 */
export function normalizeServerUrl(text: string, appHost: string): string | null | undefined {
  const url = text.trim();
  if (url === '') return null;
  return isUsableServer(url, appHost) ? url : undefined;
}

export function groupId(secret: Uint8Array): string {
  return toBase64url(deriveGroupKeys(secret).groupId);
}

/** A new group, created by this device, which becomes its coordinator. */
export function createGroup(
  name: string,
  server: string | null,
  now: number,
  random?: RandomSource,
): StoredGroup {
  const secret = generateGroupSecret(random);
  return {
    id: groupId(secret),
    name,
    secret,
    role: 'coordinator',
    server,
    invitedBy: null,
    joinedAt: now,
  };
}

/**
 * Applies an invitation to the group it refers to, if this device already belongs to it.
 * An invitation can promote a member to coordinator but never demotes, and it fills in a server
 * the group did not have.
 */
export function applyInvitation(
  existing: StoredGroup | undefined,
  invitation: Invitation,
  now: number,
): { group: StoredGroup; outcome: JoinOutcome } {
  if (existing === undefined) {
    const group: StoredGroup = {
      id: groupId(invitation.secret),
      name: invitation.groupName,
      secret: invitation.secret,
      role: invitation.role,
      server: invitation.server,
      invitedBy: invitation.issuer,
      joinedAt: now,
    };
    return { group, outcome: 'joined' };
  }
  const promoted = existing.role === 'member' && invitation.role === 'coordinator';
  const group: StoredGroup = {
    ...existing,
    role: promoted ? 'coordinator' : existing.role,
    server: existing.server ?? invitation.server,
  };
  return { group, outcome: promoted ? 'promoted' : 'already-member' };
}

/** The invitation a coordinator hands out for a group. */
export function invitationFor(group: StoredGroup, role: Role, issuer: NodeId): Invitation {
  return { role, secret: group.secret, issuer, groupName: group.name, server: group.server };
}

/**
 * How each group of this device is named in lists, by ID: groups whose names look the same
 * (names.ts) are told apart by a circled number, the first joined keeping the name (ADR-0110).
 */
export function groupNames(groups: readonly StoredGroup[]): Map<string, string> {
  const ordered = [...groups].sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
  return numberedNames(ordered.map((group) => ({ key: group.id, name: group.name })));
}

/**
 * The group of this device whose name looks the same as an invitation's while being another
 * group, or undefined: an invitation to a group the device belongs to already has none.
 */
export function lookAlikeGroup(
  groups: readonly StoredGroup[],
  invitation: Invitation,
): StoredGroup | undefined {
  const id = groupId(invitation.secret);
  if (groups.some((group) => group.id === id)) return undefined;
  const name = nameKey(invitation.groupName);
  return groups.find((group) => nameKey(group.name) === name);
}

/** In v0.1 only coordinators invite; the role is advisory, so this is a UI rule (ADR-0005). */
export function canInvite(group: StoredGroup): boolean {
  return group.role === 'coordinator';
}
