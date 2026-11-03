import type { NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { createGroup, invitationFor } from './group.ts';
import { appBaseUrl, invitationInAddress, invitationLink, usableInvitation } from './join-link.ts';

const ISSUER = 'a1b2c3d4' as NodeId;

const invitation = invitationFor(createGroup('Grupo', null, 0), 'member', ISSUER);

describe('join links', () => {
  it('builds the link under the base path the app is served from', () => {
    expect(appBaseUrl('https://example.github.io', '/Tesel/')).toBe(
      'https://example.github.io/Tesel/',
    );
    const link = invitationLink('https://example.github.io', '/Tesel/', invitation);
    expect(link.ok && new URL(link.value).pathname).toBe('/Tesel/join');
  });

  it('reads the invitation of a join link the app was opened with', () => {
    const link = invitationLink('http://localhost:5173', '/', invitation);
    if (!link.ok) throw new Error('link not built');
    const url = new URL(link.value);
    expect(invitationInAddress(url, '/')).toEqual({ ok: true, value: invitation });
  });

  it('ignores addresses that are not join links of this app', () => {
    const at = (pathname: string, hash: string, search = '') => ({ pathname, search, hash });
    expect(invitationInAddress(at('/', '#map=12/39.47/-0.37'), '/')).toBeNull();
    // Outside the base the app is served from: not an invitation of this app (§6).
    expect(invitationInAddress(at('/other/join', '#AAAA'), '/app/')).toBeNull();
    expect(invitationInAddress(at('/app/', '#AAAA'), '/app/')).toBeNull();
  });

  it('reads a join link that a query or a slash at the end was added to', () => {
    const link = invitationLink('http://localhost:5173', '/app/', invitation);
    if (!link.ok) throw new Error('link not built');
    const { hash } = new URL(link.value);
    const read = { ok: true, value: invitation };
    expect(invitationInAddress({ pathname: '/app/join/', search: '', hash }, '/app/')).toEqual(
      read,
    );
    const search = '?fbclid=IwAR0';
    expect(invitationInAddress({ pathname: '/app/join', search, hash }, '/app/')).toEqual(read);
  });

  it('reports a damaged or missing token instead of ignoring it', () => {
    const at = (hash: string) => ({ pathname: '/join', search: '', hash });
    expect(invitationInAddress(at('#AAAA'), '/')?.ok).toBe(false);
    expect(invitationInAddress(at(''), '/')?.ok).toBe(false);
    expect(invitationInAddress(at('#'), '/')?.ok).toBe(false);
  });

  it('refuses an invitation to a server on this device, unless the app runs on it too', () => {
    const local = { ok: true, value: { ...invitation, server: 'http://127.0.0.1:631/' } } as const;
    expect(usableInvitation(local, 'tesel.eu').ok).toBe(false);
    expect(usableInvitation(local, 'localhost')).toEqual(local);
    const none = { ok: true, value: invitation } as const;
    expect(usableInvitation(none, 'tesel.eu')).toEqual(none);
  });
});
