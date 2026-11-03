// Invitation links (docs/protocol.md §6).

import { fromBase64url, toBase64url } from './base64url.ts';
import { ByteReader, ByteWriter, ProtocolFailure } from './bytes.ts';
import {
  GROUP_NAME_MAX_BYTES,
  GROUP_SECRET_SIZE,
  INVITATION_VERSION,
  NODE_ID_SIZE,
  RoleCode,
  SERVER_URL_MAX_BYTES,
} from './constants.ts';
import type { NodeId, Role } from './events.ts';
import { enumCode, enumValue } from './fields.ts';
import { nodeIdFromBytes, nodeIdToBytes } from './node-id.ts';
import { err, ok, type ProtocolError, type Result } from './result.ts';

export interface Invitation {
  readonly role: Role;
  readonly secret: Uint8Array;
  readonly issuer: NodeId;
  readonly groupName: string;
  /** Server base URL, or null when the group has no server. */
  readonly server: string | null;
}

const JOIN_SEGMENT = 'join';

export function encodeInvitationToken(invitation: Invitation): Result<string, ProtocolError> {
  try {
    if (invitation.secret.length !== GROUP_SECRET_SIZE) {
      throw new ProtocolFailure('invalid-value', 'group secret must be 16 bytes');
    }
    if (invitation.server !== null && !isServerUrl(invitation.server)) {
      throw new ProtocolFailure('invalid-value', 'server must be a plain secure URL');
    }
    const token = new ByteWriter()
      .u8(INVITATION_VERSION)
      .u8(enumCode(RoleCode, invitation.role, 'role'))
      .raw(invitation.secret)
      .raw(nodeIdToBytes(invitation.issuer))
      .textU8(invitation.groupName, 1, GROUP_NAME_MAX_BYTES, 'group name')
      .textU8(invitation.server ?? '', 0, SERVER_URL_MAX_BYTES, 'server URL')
      .toBytes();
    return ok(toBase64url(token));
  } catch (failure) {
    if (failure instanceof ProtocolFailure) return err(failure.error);
    throw failure;
  }
}

export function decodeInvitationToken(token: string): Result<Invitation, ProtocolError> {
  const bytes = fromBase64url(token);
  if (bytes === null) return err({ code: 'invalid-value', detail: 'token is not base64url' });
  try {
    const reader = new ByteReader(bytes);
    const version = reader.u8();
    if (version !== INVITATION_VERSION) {
      return err({ code: 'unsupported-version', detail: `invitation version ${version}` });
    }
    const role = enumValue(RoleCode, reader.u8(), 'member'); // §3.1 reserved values: safest default
    const secret = reader.raw(GROUP_SECRET_SIZE);
    const issuer = nodeIdFromBytes(reader.raw(NODE_ID_SIZE));
    const groupName = reader.textU8(1, GROUP_NAME_MAX_BYTES, 'group name');
    const serverText = reader.textU8(0, SERVER_URL_MAX_BYTES, 'server URL');
    reader.end();
    if (serverText !== '' && !isServerUrl(serverText)) {
      throw new ProtocolFailure('invalid-value', 'server must be a plain secure URL');
    }
    return ok({ role, secret, issuer, groupName, server: serverText === '' ? null : serverText });
  } catch (failure) {
    if (failure instanceof ProtocolFailure) return err(failure.error);
    throw failure;
  }
}

/**
 * Builds `{appBaseUrl}join#{token}`. The base URL is where the app is served, ending in a slash:
 * `https://app.example/` or `https://example.github.io/tesel/`.
 */
export function buildInvitationUrl(
  appBaseUrl: string,
  invitation: Invitation,
): Result<string, ProtocolError> {
  if (!isSecureUrl(appBaseUrl) || !appBaseUrl.endsWith('/')) {
    return err({ code: 'invalid-value', detail: 'app base URL must be a secure URL ending in /' });
  }
  const token = encodeInvitationToken(invitation);
  if (!token.ok) return token;
  return ok(`${appBaseUrl}${JOIN_SEGMENT}#${token.value}`);
}

/**
 * Extracts the invitation from a secure link (§6) whose last path segment is `join`. A query and a
 * slash after `join`, which whatever passed the link on may have added, are ignored.
 */
export function parseInvitationUrl(url: string): Result<Invitation, ProtocolError> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return err({ code: 'invalid-value', detail: 'not a URL' });
  }
  if (!isSecureUrl(url) || !isJoinPath(parsed.pathname) || parsed.hash.length < 2) {
    return err({ code: 'invalid-value', detail: 'not an invitation link' });
  }
  return decodeInvitationToken(parsed.hash.slice(1));
}

/** True for `/join` and `/{base path}/join`, with or without a slash after it (§6). */
function isJoinPath(pathname: string): boolean {
  return pathname.replace(/\/$/, '').endsWith(`/${JOIN_SEGMENT}`);
}

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * §6 `https:`, or `http:` on a loopback host for development: the same origins browsers treat as
 * a secure context.
 */
export function isSecureUrl(text: string): boolean {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return false;
  }
  if (url.hostname === '') return false;
  return (
    url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname))
  );
}

/**
 * §6 a server URL: a secure URL with no user name or password, no query (not even a bare `?`) and
 * no fragment, so the address an invitation carries is the server and nothing else.
 */
export function isServerUrl(text: string): boolean {
  return isSecureUrl(text) && !/[@?#]/.test(text);
}
