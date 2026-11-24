// The kinds of SOS (protocol §3.8), as the 112 sorts emergencies (ADR-0167), each with its name and
// the pictogram of its tile, in the order the dialog shows them.

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
  fire: { label: 'sosFire', icon: 'flame' },
  rescue: { label: 'sosRescue', icon: 'lifebuoy' },
  traffic: { label: 'sosTraffic', icon: 'car' },
  security: { label: 'sosSecurity', icon: 'shield' },
};
