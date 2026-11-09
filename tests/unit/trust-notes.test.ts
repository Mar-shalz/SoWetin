import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import messages from '@/messages/en-NG.json';
import { T3_SYSTEM } from '@/lib/ai/t3';
import { flatten } from '@/lib/i18n/check';

// F27 and doc 11, section 6: trust notes are fixed copy. No AI prompt may carry one, and no AI module may read the
// message files, so a model can never be asked to repeat, shorten or translate a note.
const TRUST = /^(prices|recipes|videos|ai|allergy|partner|legal\.sources)\./;
const notes = Object.entries(flatten(messages)).filter(([k]) => TRUST.test(k) && !k.startsWith('prices.sheet.') && !k.startsWith('prices.firstNote.ok'));
const aiFiles = ['lib/ai', 'lib/scout'].flatMap((dir) => readdirSync(new URL(`../../${dir}`, import.meta.url)).map((f) => `${dir}/${f}`));

describe('trust notes never go through AI (F27)', () => {
  it('finds the notes to guard', () => expect(notes.length).toBeGreaterThan(10));

  it('keeps every note out of every AI prompt', () => {
    for (const [, text] of notes) expect(T3_SYSTEM).not.toContain(text);
    for (const f of aiFiles) {
      const src = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
      for (const [, text] of notes) expect(src, f).not.toContain(text.slice(0, 60));
    }
  });

  it('keeps AI modules away from the message files', () => {
    for (const f of aiFiles) expect(readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8'), f).not.toMatch(/messages\/|next-intl|getTranslations/);
  });
});
