// The kinds of SOS (protocol §3.8), each with its name and the pictogram of its tile.

import type { SosKind } from '@tesel/protocol';

import type { MessageKey } from '../i18n/index.ts';
import type { GlyphName } from '../ui/glyphs.ts';

export interface SosKindInfo {
  readonly label: MessageKey;
  readonly icon: GlyphName;
}

export const SOS_KINDS: Readonly<Record<SosKind, SosKindInfo>> = {
  general: { label: 'sosGeneral', icon: 'warning' },
  medical: { label: 'sosMedical', icon: 'cross' },
  trapped: { label: 'sosTrapped', icon: 'house' },
  fire: { label: 'sosFire', icon: 'flame' },
  security: { label: 'sosSecurity', icon: 'shield' },
};
