// The name a group's channel takes in a radio: the group name, cut to what the radio stores
// (protocol §7). Every member's radio derives the same name.

/** The group name cut to `maxBytes` bytes of UTF-8 without splitting a character. */
export function channelName(groupName: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  let name = '';
  for (const char of groupName) {
    if (encoder.encode(name + char).length > maxBytes) break;
    name += char;
  }
  return name;
}
