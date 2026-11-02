// Reading and writing invitation links in the address bar (protocol §6, ADR-0012).

import {
  buildInvitationUrl,
  decodeInvitationToken,
  type Invitation,
  type ProtocolError,
  type Result,
} from '@tesel/protocol';

/** Where the app is served from, ending in `/`; `base` is Vite's BASE_URL. */
export function appBaseUrl(origin: string, base: string): string {
  return new URL(base, origin).href;
}

/** The parts of the address an invitation is read from. */
export type Address = Pick<Location, 'pathname' | 'search' | 'hash'>;

/**
 * The invitation in the current address, if it is a join link: `join` right under the base the
 * app is served from, with no query (protocol §6). The app reads its own address, so the scheme
 * is not checked here: development runs on http://localhost.
 */
export function invitationInAddress(
  address: Address,
  base: string,
): Result<Invitation, ProtocolError> | null {
  const { pathname, search, hash } = address;
  if (pathname !== `${base}join` || search !== '' || hash.length < 2) return null;
  return decodeInvitationToken(hash.slice(1));
}

/**
 * Whether the address is a join link's, read or not: its secret, if it holds one, is taken out of
 * the address bar and the history even when the link is not one the app reads (a query added by
 * whatever passed it on, a slash at the end).
 */
export function isJoinAddress(address: Address, base: string): boolean {
  return address.pathname.replace(/\/$/, '') === `${base}join`;
}

export function invitationLink(
  origin: string,
  base: string,
  invitation: Invitation,
): Result<string, ProtocolError> {
  return buildInvitationUrl(appBaseUrl(origin, base), invitation);
}
