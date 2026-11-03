import { toBase64url, type Invitation, type NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import {
  applyInvitation,
  canInvite,
  createGroup,
  groupNameFault,
  groupNames,
  invitationFor,
  isUsableServer,
  lookAlikeGroup,
  normalizeGroupName,
  normalizeServerUrl,
} from './group.ts';

const ISSUER = 'a1b2c3d4' as NodeId;

const fixedRandom = (length: number) => new Uint8Array(length).fill(7);
const NOW = 1_761_350_400_000;

describe('groups', () => {
  it('makes the creator of a group its coordinator', () => {
    const group = createGroup('Protección Civil', null, NOW, fixedRandom);
    expect(group.role).toBe('coordinator');
    expect(group.invitedBy).toBeNull();
    expect(canInvite(group)).toBe(true);
  });

  it('identifies a group by an ID derived from its secret, never the secret itself', () => {
    const group = createGroup('A', null, NOW, fixedRandom);
    expect(createGroup('B', null, NOW, fixedRandom).id).toBe(group.id);
    expect(group.id).not.toBe(toBase64url(group.secret));
  });

  it('joins a new group with the role the invitation grants', () => {
    const invitation = invitationFor(createGroup('A', null, NOW, fixedRandom), 'member', ISSUER);
    const { group, outcome } = applyInvitation(undefined, invitation, NOW);
    expect(outcome).toBe('joined');
    expect(group.role).toBe('member');
    expect(group.invitedBy).toBe(ISSUER);
    expect(canInvite(group)).toBe(false);
  });

  it('promotes a member who receives a coordinator invitation', () => {
    const coordinatorGroup = createGroup('A', null, NOW, fixedRandom);
    const asMember = applyInvitation(
      undefined,
      invitationFor(coordinatorGroup, 'member', ISSUER),
      NOW,
    ).group;
    const again = applyInvitation(
      asMember,
      invitationFor(coordinatorGroup, 'coordinator', ISSUER),
      NOW + 1,
    );
    expect(again.outcome).toBe('promoted');
    expect(again.group.role).toBe('coordinator');
    expect(again.group.joinedAt).toBe(NOW);
  });

  it('never demotes a coordinator who opens a member invitation', () => {
    const group = createGroup('A', null, NOW, fixedRandom);
    const result = applyInvitation(group, invitationFor(group, 'member', ISSUER), NOW);
    expect(result.outcome).toBe('already-member');
    expect(result.group.role).toBe('coordinator');
  });

  it('learns a server from an invitation but does not replace a known one', () => {
    const group = createGroup('A', null, NOW, fixedRandom);
    const withServer: Invitation = {
      ...invitationFor(group, 'member', ISSUER),
      server: 'https://one.example',
    };
    const learned = applyInvitation(group, withServer, NOW).group;
    expect(learned.server).toBe('https://one.example');
    const other = { ...withServer, server: 'https://two.example' };
    expect(applyInvitation(learned, other, NOW).group.server).toBe('https://one.example');
  });

  it('accepts a secure server address, or none', () => {
    const app = 'tesel.eu';
    expect(normalizeServerUrl('  https://relay.example  ', app)).toBe('https://relay.example');
    expect(normalizeServerUrl('', app)).toBeNull();
    expect(normalizeServerUrl('http://relay.example', app)).toBeUndefined();
    expect(normalizeServerUrl('relay.example', app)).toBeUndefined();
    expect(normalizeServerUrl('https://relay.example/?', app)).toBeUndefined();
  });

  it('uses a server on this very device only in an app that runs on it too', () => {
    expect(isUsableServer('http://127.0.0.1:631/', 'tesel.eu')).toBe(false);
    expect(isUsableServer('http://localhost:8080', 'tesel.eu')).toBe(false);
    expect(isUsableServer('https://127.0.0.2:631/', 'tesel.eu')).toBe(false);
    expect(isUsableServer('https://[::1]/', 'tesel.eu')).toBe(false);
    expect(isUsableServer('http://localhost:8080', 'localhost')).toBe(true);
    expect(isUsableServer('https://relay.example', 'localhost')).toBe(true);
  });

  it('accepts group names of 1 to 32 bytes after trimming', () => {
    expect(normalizeGroupName('  Rescate  ')).toBe('Rescate');
    expect(normalizeGroupName('   ')).toBeNull();
    expect(normalizeGroupName('ñ'.repeat(16))).toBe('ñ'.repeat(16));
    expect(normalizeGroupName('ñ'.repeat(17))).toBeNull();
  });

  it('refuses a group name with half of an emoji, which no invitation could carry', () => {
    const fire = '🔥';
    expect(normalizeGroupName(`Incendio ${fire}`)).toBe(`Incendio ${fire}`);
    expect(normalizeGroupName(`Incendio ${fire.slice(0, 1)}`)).toBeNull();
  });

  it('refuses a group name with a character that is not seen, and says so', () => {
    expect(normalizeGroupName('Rescate\u2067')).toBeNull();
    expect(groupNameFault('Res\u200Bcate')).toBe('hidden');
  });

  it('tells apart groups whose names look the same, the first joined keeping its name', () => {
    const first = createGroup('Rescate', null, NOW, () => new Uint8Array(16).fill(1));
    const second = createGroup('RESCATE\u200B', null, NOW + 1, () => new Uint8Array(16).fill(2));
    const other = createGroup('Bomberos', null, NOW + 2, () => new Uint8Array(16).fill(3));
    const names = groupNames([second, other, first]);
    expect(names.get(first.id)).toBe('Rescate');
    expect(names.get(second.id)).toBe('RESCATE \u2461');
    expect(names.get(other.id)).toBe('Bomberos');
  });

  it('finds the group of the same name as an invitation to another group', () => {
    const mine = createGroup('Rescate', null, NOW, () => new Uint8Array(16).fill(1));
    const outsider = createGroup('R\u0435scate', 'https://evil.example', NOW, fixedRandom);
    const lure = invitationFor(outsider, 'coordinator', ISSUER);
    expect(lookAlikeGroup([mine], lure)).toBe(mine);
    expect(lookAlikeGroup([mine], invitationFor(mine, 'member', ISSUER))).toBeUndefined();
    expect(lookAlikeGroup([mine, outsider], lure)).toBeUndefined();
  });
});
