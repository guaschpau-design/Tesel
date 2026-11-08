// Reading and writing invitation links in the address bar (protocol §6, ADR-0012).

import {
  buildInvitationUrl,
  decodeInvitationToken,
  type Invitation,
  type ProtocolError,
  type Result,
} from '@tesel/protocol';

import { isUsableServer } from './group.ts';

/** Where the app is served from, ending in `/`; `base` is Vite's BASE_URL. */
export function appBaseUrl(origin: string, base: string): string {
  return new URL(base, origin).href;
}

/** The parts of the address an invitation is read from. */
export type Address = Pick<Location, 'pathname' | 'search' | 'hash'>;

/**
 * The invitation in the current address, if it is a join link: `join` right under the base the
 * app is served from, with or without a slash after it and whatever its query (protocol §6). A
 * join link whose token is missing or cannot be read is damaged, and said to be. The app reads its
 * own address, so the scheme is not checked here: development runs on http://localhost.
 */
export function invitationInAddress(
  address: Address,
  base: string,
): Result<Invitation, ProtocolError> | null {
  if (address.pathname.replace(/\/$/, '') !== `${base}join`) return null;
  const token = address.hash.slice(1);
  if (token === '') return { ok: false, error: { code: 'truncated', detail: 'no token' } };
  return decodeInvitationToken(token);
}

/**
 * An invitation as an app served from `appHost` takes it: one with a server the app may not use
 * (isUsableServer), on this very device, is refused as damaged (ADR-0110).
 */
export function usableInvitation(
  read: Result<Invitation, ProtocolError>,
  appHost: string,
): Result<Invitation, ProtocolError> {
  if (!read.ok || read.value.server === null || isUsableServer(read.value.server, appHost)) {
    return read;
  }
  return { ok: false, error: { code: 'invalid-value', detail: 'server on this device' } };
}

/** The link of an invitation to the app at `appUrl`, which ends in `/` (config.ts). */
export function invitationLink(
  appUrl: string,
  invitation: Invitation,
): Result<string, ProtocolError> {
  return buildInvitationUrl(appUrl, invitation);
}
