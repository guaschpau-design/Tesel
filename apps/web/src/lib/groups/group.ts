// Groups this device belongs to (ARCHITECTURE.md §3.2). A group is its secret plus what the
// invitation said about it; every key is derived from the secret when needed.

import {
  deriveGroupKeys,
  generateGroupSecret,
  GROUP_NAME_MAX_BYTES,
  isSecureUrl,
  SERVER_URL_MAX_BYTES,
  toBase64url,
  utf8ByteLength,
  type Invitation,
  type NodeId,
  type RandomSource,
  type Role,
} from '@tesel/protocol';

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

/** Trims a group name and returns it, or null if it does not fit the protocol's limits. */
export function normalizeGroupName(text: string): string | null {
  const name = text.trim();
  const size = utf8ByteLength(name);
  return size >= 1 && size <= GROUP_NAME_MAX_BYTES ? name : null;
}

/**
 * Validates a server address typed by a coordinator: empty means "no server", anything else
 * must be a secure URL (protocol §6). Returns undefined if invalid.
 */
export function normalizeServerUrl(text: string): string | null | undefined {
  const url = text.trim();
  if (url === '') return null;
  return isSecureUrl(url) && utf8ByteLength(url) <= SERVER_URL_MAX_BYTES ? url : undefined;
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

/** In v0.1 only coordinators invite; the role is advisory, so this is a UI rule (ADR-0005). */
export function canInvite(group: StoredGroup): boolean {
  return group.role === 'coordinator';
}
