// The paste box's collection and summary for a shopping list (docs/specs/qr-link.md §2/§5, block
// 13Q): a pasted `#l=` lands in `Collected.lists` (with its sender and time) and `summarizePaste`
// says "Boodschappenlijst van …". A list carries no recipes and never names the import's sender.
import { describe, expect, it } from 'vitest';
import { lang } from '../src/i18n';
import { collectPaste, summarizePaste } from '../src/paste';
import { encodeToken } from '../src/domain/token';
import { FROZEN_ENVELOPE_L, FROZEN_ENVELOPE_W, FROZEN_TOKEN_L, FROZEN_TOKEN_L_FFLATE } from './fixtures/frozen-share-tokens';

const APP_URL = 'https://srutgers96-star.github.io/recepten/';

describe('paste: shopping list (#l=)', () => {
  it('a pasted #l= link comes into Collected.lists with by and at; no recipes, no sender', async () => {
    const got = await collectPaste(`🛒 Boodschappenlijst van Stijn — 3 regels. Open de link in de app of plak hem bij In & uit.\n${APP_URL}#l=${FROZEN_TOKEN_L}`, null);
    expect(got.problems).toEqual([]);
    expect(got.lists).toHaveLength(1);
    const list = got.lists[0]!;
    expect(list.by).toBe('Stijn');
    expect(list.at).toBe('2026-11-08T10:00:00.000Z');
    expect(list.title).toEqual({ nl: '🛒 Boodschappen wk 46', en: '🛒 Shopping wk 46' });
    expect(list.lines).toEqual((FROZEN_ENVELOPE_L.l as { lines: unknown[] }).lines);
    expect(got.share.recipes).toEqual([]);
    expect(got.share.by).toBeUndefined();
    expect(got.members).toEqual([]);
    expect(got.progress).toEqual([]);
  });

  it('the same list twice (a quoted reply, the other engine) is one list; a bare token works too', async () => {
    const got = await collectPaste(`${APP_URL}#l=${FROZEN_TOKEN_L}\n> ${APP_URL}#l=${FROZEN_TOKEN_L_FFLATE}`, null);
    expect(got.lists).toHaveLength(1);
    const bare = await collectPaste(`l=${FROZEN_TOKEN_L}`, null);
    expect(bare.lists).toHaveLength(1);
    const other = await encodeToken({ ...FROZEN_ENVELOPE_L, by: 'Gabi' });
    const two = await collectPaste(`${APP_URL}#l=${FROZEN_TOKEN_L}\n${APP_URL}#l=${other}`, null);
    expect(two.lists.map((l) => l.by)).toEqual(['Stijn', 'Gabi']);
  });

  it('an #l= without a list object is a problem, not a list', async () => {
    const bad = await encodeToken({ v: 2, t: 'l', by: 'Stijn' });
    const got = await collectPaste(`${APP_URL}#l=${bad}`, null);
    expect(got.lists).toEqual([]);
    expect(got.problems).toHaveLength(1);
  });

  it('summarizePaste names "Boodschappenlijst van …" and counts no share link', async () => {
    lang.value = 'nl';
    const nl = await summarizePaste(`${APP_URL}#l=${FROZEN_TOKEN_L}`);
    expect(nl.kind).toBe('tokens');
    expect(nl.shareTokens).toBe(0);
    expect(nl.listNames).toEqual(['Stijn']);
    expect(nl.label).toBe('Boodschappenlijst van Stijn');
    lang.value = 'en';
    const en = await summarizePaste(`${APP_URL}#l=${FROZEN_TOKEN_L}`);
    expect(en.label).toBe("Stijn's shopping list");
    lang.value = 'nl';
  });
});

describe('paste: the sender id (V2)', () => {
  it('a #w= plan with byId keeps it on the received plan; without it, none', async () => {
    const withId = await encodeToken({ ...FROZEN_ENVELOPE_W, byId: 'p:stijn123' });
    const got = await collectPaste(`${APP_URL}#w=${withId}`, null);
    expect(got.plan?.by).toBe('Stijn');
    expect(got.plan?.byId).toBe('p:stijn123');
    const without = await collectPaste(`${APP_URL}#w=${await encodeToken(FROZEN_ENVELOPE_W)}`, null);
    expect(without.plan?.byId).toBeUndefined();
  });
});

// V1c (10 Nov 2026): Gabi's iPhone pasted a long link of which only the first 1236 of 2607 characters were read.
describe('paste: a link broken inside the token is glued back together', () => {
  it('a line break, a soft hyphen and a zero-width space inside the token still give the list', async () => {
    const tok = FROZEN_TOKEN_L;
    const broken = tok.slice(0, 30) + '\n' + tok.slice(30, 60) + '\u00AD' + tok.slice(60, 80) + '\u200B\n ' + tok.slice(80);
    const got = await collectPaste(`🛒 Lijst\n${APP_URL}#l=${broken}`, null);
    expect(got.lists.length).toBe(1);
    expect(got.problems).toEqual([]);
  });
  it('a token that is really cut short stays a problem with its length, and the next line is not glued in by mistake', async () => {
    const tok = FROZEN_TOKEN_L;
    const got = await collectPaste(`${APP_URL}#l=${tok.slice(0, 40)}\nOpen in de app (of tik)`, null);
    expect(got.lists.length).toBe(0);
    expect(got.problems.length).toBe(1);
    expect(got.problems[0]).toContain('40');
  });
});
