import type { NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { createGroup, invitationFor } from './group.ts';
import { appBaseUrl, invitationInAddress, invitationLink, isJoinAddress } from './join-link.ts';

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
    expect(invitationInAddress(at('/join', ''), '/')).toBeNull();
    // Outside the base the app is served from, or with a query: not an invitation (§6).
    expect(invitationInAddress(at('/other/join', '#AAAA'), '/app/')).toBeNull();
    expect(invitationInAddress(at('/app/join', '#AAAA', '?x=1'), '/app/')).toBeNull();
  });

  it('reports a damaged token instead of ignoring it', () => {
    expect(invitationInAddress({ pathname: '/join', search: '', hash: '#AAAA' }, '/')?.ok).toBe(
      false,
    );
  });

  it('takes any join address for one whose secret must leave the address bar', () => {
    const at = (pathname: string, search = '') => ({ pathname, search, hash: '#secret' });
    expect(isJoinAddress(at('/app/join'), '/app/')).toBe(true);
    expect(isJoinAddress(at('/app/join/', '?from=mail'), '/app/')).toBe(true);
    expect(isJoinAddress(at('/app/'), '/app/')).toBe(false);
  });
});
