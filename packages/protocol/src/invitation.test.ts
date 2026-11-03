import { describe, expect, it } from 'vitest';

import { fromBase64url, toBase64url } from './base64url.ts';
import { encodeUtf8 } from './bytes.ts';
import {
  buildInvitationUrl,
  decodeInvitationToken,
  encodeInvitationToken,
  parseInvitationUrl,
  type Invitation,
} from './invitation.ts';
import { ALICE } from './test-helpers.ts';

const invitation: Invitation = {
  role: 'member',
  secret: Uint8Array.from({ length: 16 }, (_, i) => 255 - i),
  issuer: ALICE,
  groupName: 'Agrupación Voluntarios',
  server: 'https://tesel.example.eu',
};

describe('base64url', () => {
  it.each([
    ['', ''],
    ['f', 'Zg'],
    ['fo', 'Zm8'],
    ['foo', 'Zm9v'],
    ['foob', 'Zm9vYg'],
    ['fooba', 'Zm9vYmE'],
    ['foobar', 'Zm9vYmFy'],
  ])('encodes the RFC 4648 vector %j as %j', (plain, encoded) => {
    expect(toBase64url(encodeUtf8(plain))).toBe(encoded);
    expect(fromBase64url(encoded)).toEqual(encodeUtf8(plain));
  });

  it('uses the URL-safe alphabet', () => {
    expect(toBase64url(Uint8Array.of(0xfb, 0xff))).toBe('-_8');
  });

  it('rejects non-canonical and invalid input', () => {
    expect(fromBase64url('Zh')).toBeNull(); // leftover bits set
    expect(fromBase64url('Z')).toBeNull();
    expect(fromBase64url('Zm9v+')).toBeNull();
  });
});

describe('invitations', () => {
  it('round-trips through a token', () => {
    const token = encodeInvitationToken(invitation);
    expect(token.ok && decodeInvitationToken(token.value)).toEqual({ ok: true, value: invitation });
  });

  it('round-trips a group without a server', () => {
    const local = { ...invitation, role: 'coordinator', server: null } as const;
    const token = encodeInvitationToken(local);
    expect(token.ok && decodeInvitationToken(token.value)).toEqual({ ok: true, value: local });
  });

  it('puts the secret in the URL fragment, which browsers never send to servers', () => {
    const url = buildInvitationUrl('https://app.tesel.eu/', invitation);
    expect(url.ok).toBe(true);
    if (!url.ok) return;
    const parsed = new URL(url.value);
    expect(parsed.pathname).toBe('/join');
    expect(parsed.search).toBe('');
    expect(parseInvitationUrl(url.value)).toEqual({ ok: true, value: invitation });
  });

  it('builds the link under the base path of an app served from a sub-path', () => {
    const url = buildInvitationUrl('https://example.github.io/tesel/', invitation);
    expect(url.ok && new URL(url.value).pathname).toBe('/tesel/join');
    expect(url.ok && parseInvitationUrl(url.value)).toEqual({ ok: true, value: invitation });
  });

  it('refuses an app base URL that is not https or does not end in a slash', () => {
    expect(buildInvitationUrl('http://app.tesel.eu/', invitation).ok).toBe(false);
    expect(buildInvitationUrl('https://example.github.io/tesel', invitation).ok).toBe(false);
  });

  it('refuses a server that is not https', () => {
    expect(encodeInvitationToken({ ...invitation, server: 'http://insecure.example' }).ok).toBe(
      false,
    );
  });

  it('refuses an empty group name', () => {
    expect(encodeInvitationToken({ ...invitation, groupName: '' }).ok).toBe(false);
  });

  it('rejects links that are not invitations', () => {
    expect(parseInvitationUrl('https://app.tesel.eu/').ok).toBe(false);
    expect(parseInvitationUrl('not a url').ok).toBe(false);
    expect(decodeInvitationToken('AAAA').ok).toBe(false);
  });
});

describe('invitation links', () => {
  const plain = {
    role: 'member',
    secret: new Uint8Array(16).fill(3),
    issuer: ALICE,
    groupName: 'Grupo',
    server: null,
  } as const;
  const token = encodeInvitationToken(plain);
  const tokenText = token.ok ? token.value : '';

  it('accepts only https links whose last path segment is join', () => {
    expect(parseInvitationUrl(`https://app.example/join#${tokenText}`).ok).toBe(true);
    expect(parseInvitationUrl(`https://app.example/tesel/join#${tokenText}`).ok).toBe(true);
    expect(parseInvitationUrl(`http://app.example/join#${tokenText}`).ok).toBe(false);
    expect(parseInvitationUrl(`https://app.example/xjoin#${tokenText}`).ok).toBe(false);
    expect(parseInvitationUrl(`https://app.example/join/x#${tokenText}`).ok).toBe(false);
  });

  it('ignores a query and a slash after join, which whatever passed the link on may add', () => {
    expect(parseInvitationUrl(`https://app.example/join/#${tokenText}`).ok).toBe(true);
    expect(parseInvitationUrl(`https://app.example/join?fbclid=x#${tokenText}`).ok).toBe(true);
    expect(parseInvitationUrl(`https://app.example/tesel/join/?x=1#${tokenText}`).ok).toBe(true);
  });

  it('accepts plain http only on a loopback host, for development', () => {
    expect(parseInvitationUrl(`http://localhost:5173/join#${tokenText}`).ok).toBe(true);
    expect(parseInvitationUrl(`http://127.0.0.1/join#${tokenText}`).ok).toBe(true);
    expect(parseInvitationUrl(`http://localhost.example/join#${tokenText}`).ok).toBe(false);
    expect(encodeInvitationToken({ ...plain, server: 'http://localhost:8080' }).ok).toBe(true);
    expect(encodeInvitationToken({ ...plain, server: 'http://192.168.1.10' }).ok).toBe(false);
  });

  it('refuses a server value that only looks like an https URL', () => {
    expect(encodeInvitationToken({ ...plain, server: 'https://' }).ok).toBe(false);
  });

  /** The token with another server in it, as a forged invitation could carry. */
  const withServer = (server: string) => {
    const bytes = encodeUtf8(server);
    const head = (fromBase64url(tokenText) ?? new Uint8Array()).slice(0, -1);
    return toBase64url(Uint8Array.of(...head, bytes.length, ...bytes));
  };

  it('reads the server an invitation carries', () => {
    const decoded = decodeInvitationToken(withServer('https://relay.example/tesel/'));
    expect(decoded.ok && decoded.value.server).toBe('https://relay.example/tesel/');
  });

  it.each([
    'https://user:secret@relay.example',
    'https://@relay.example',
    'https://relay.example/?',
    'https://relay.example/?to=elsewhere',
    'https://relay.example/#here',
  ])('refuses a server %j with a user, a query or a fragment', (server) => {
    expect(encodeInvitationToken({ ...plain, server }).ok).toBe(false);
    expect(decodeInvitationToken(withServer(server)).ok).toBe(false);
  });

  it('grants member when the role byte is reserved', () => {
    const bytes = fromBase64url(tokenText) ?? new Uint8Array();
    bytes[1] = 9; // role byte
    const decoded = decodeInvitationToken(toBase64url(bytes));
    expect(decoded.ok && decoded.value.role).toBe('member');
  });
});
