// What is being written in the chat: the text, typed or dictated, and its sending. The chat panel
// keeps it rather than the row that writes, so a draft, a dictation going on or a failed send are
// still there after a look at another tab.

import { CHAT_MAX_BYTES, utf8ByteLength } from '@tesel/protocol';

import type { Locale } from '../i18n/index.ts';
import { Submission } from '../ui/submission.svelte.ts';
import { Dictation, type RecognizerClass } from './dictation.svelte.ts';

export class ChatDraft {
  text = $state('');
  /** How many bytes the text takes once sent. */
  readonly size: number = $derived(utf8ByteLength(this.text.trim()));
  readonly fits: boolean = $derived(this.size > 0 && this.size <= CHAT_MAX_BYTES);
  /** Dictation, where the browser can recognise speech. */
  readonly dictation: Dictation | null;
  readonly submission = new Submission();

  constructor(Recognizer: RecognizerClass | null) {
    this.dictation = Recognizer ? new Dictation(Recognizer) : null;
  }

  toggleDictation(locale: Locale): void {
    if (!this.dictation) return;
    if (this.dictation.listening) this.dictation.stop();
    else this.dictation.start(locale, this.text, (heard) => (this.text = heard));
  }

  /**
   * Sends the text typed or dictated. The box is emptied at once, and gets the text back if it
   * could not be sent.
   */
  async send(onsend: (text: string) => Promise<void>): Promise<void> {
    if (!this.fits) return;
    this.dictation?.cancel();
    const message = this.text.trim();
    this.text = '';
    const sent = await this.submission.run(() => onsend(message));
    if (!sent && this.text === '') this.text = message;
  }
}
