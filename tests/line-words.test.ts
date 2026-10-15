// src/domain/line-words.ts (docs/phase-6-spec.md 6A.16): the words of an unrecognised name as
// tappable buttons. Stijn's line "2 sneetjes knapperig stokbrood of brood [voor erbij]" must come
// out as knapperig · stokbrood · (of) brood with "stokbrood" preselected; the green words are the
// query, the grey ones the note, and the raw line is never rewritten.
import { describe, expect, it } from 'vitest';
import { applyWordLink, lineLang, linkedPrep, lookupWords, partialMatch, splitNameWords, suggestSelection, wordLinkFor, wordLinkOverride, wordsFromText, wordsToQuery, type Word } from '../src/domain/line-words';
import { parseLine } from '../src/domain/parser';
import { renderLine } from '../src/domain/render';
import { fullDictionary } from './fixtures/full-dictionary';

const dict = fullDictionary();
const nl = (raw: string) => parseLine(raw, dict, 'nl');
const en = (raw: string) => parseLine(raw, dict, 'en');
const texts = (ws: Word[]) => ws.map((w) => w.text);

describe('splitNameWords', () => {
  it("Stijn's line: name words, then the alternative with its connector", () => {
    const line = nl('2 sneetjes knapperig stokbrood of brood [voor erbij]');
    expect(line.ing).toBeNull();
    expect(line.name).toBe('knapperig stokbrood');
    const words = splitNameWords(line);
    expect(texts(words)).toEqual(['knapperig', 'stokbrood', 'brood']);
    expect(words.map((w) => w.role)).toEqual(['name', 'name', 'alt']);
    expect(words[2]).toMatchObject({ alt: 0, lead: 'of', structured: true });
    expect(words[0]?.lead).toBeUndefined();
  });

  it('an unresolved alternative is not structured and keeps every word', () => {
    const line = nl('2 sneetjes knapperig stokbrood of 3 dikke knapperbroodjes');
    const words = splitNameWords(line);
    expect(texts(words)).toEqual(['knapperig', 'stokbrood', '3', 'dikke', 'knapperbroodjes']);
    expect(words[2]).toMatchObject({ alt: 0, lead: 'of' });
    expect(words.slice(2).every((w) => !w.structured)).toBe(true);
  });

  it('English lines use "or" and "and/or" as written', () => {
    expect(splitNameWords(en('2 slices crusty baguette or bread'))[2]).toMatchObject({ text: 'bread', lead: 'or' });
    expect(splitNameWords(nl('Rookworst en/of knapperworst'))[1]).toMatchObject({ lead: 'en/of' });
    expect(lineLang(en('2 slices crusty baguette'))).toBe('en');
    expect(lineLang(nl('2 sneetjes knapperig stokbrood'))).toBe('nl');
  });

  it('falls back to the raw text when nothing parsed as a name, and gives headers nothing', () => {
    const line = { raw: { nl: 'iets vreemds hier' }, kind: 'line' as const, name: '' };
    expect(texts(splitNameWords(line))).toEqual(['iets', 'vreemds', 'hier']);
    expect(splitNameWords(nl('Dressing:'))).toEqual([]);
  });

  it('wordsFromText splits on whitespace only', () => {
    expect(texts(wordsFromText("  pinda's/cashewnoten  gezouten "))).toEqual(["pinda's/cashewnoten", 'gezouten']);
    expect(wordsFromText('')).toEqual([]);
  });
});

describe('suggestSelection', () => {
  it('picks the recognised word and leaves the adjective grey', () => {
    const words = splitNameWords(nl('2 sneetjes knapperig stokbrood of brood [voor erbij]'));
    expect([...suggestSelection(words, dict, 'nl')]).toEqual([1]);
  });

  it('prefers the largest recognised window (the fewest words to tap away)', () => {
    const words = wordsFromText('lekkere Parmezaanse kaas');
    expect(dict.ingredientByName('Parmezaanse kaas', 'nl')?.id).toBe('parmezaanse-kaas');
    expect(dict.ingredientByName('kaas', 'nl')?.id).toBe('kaas');
    expect([...suggestSelection(words, dict, 'nl')]).toEqual([1, 2]);
  });

  it('two products side by side: Dutch keeps the first, English the last', () => {
    // Both words are products on their own, the pair is not an entry.
    expect(dict.ingredientByName('kip kerrie', 'nl')).toBeUndefined();
    expect([...suggestSelection(wordsFromText('kip kerrie'), dict, 'nl')]).toEqual([0]);
    expect(dict.ingredientByName('lemon chicken', 'en')).toBeUndefined();
    expect(dict.ingredientByName('lemon', 'en')?.id).toBe('citroen');
    expect([...suggestSelection(wordsFromText('lemon chicken'), dict, 'en')]).toEqual([1]);
  });

  it('prefers the name part over the alternative, and selects everything when nothing matches', () => {
    const line = nl('2 sneetjes knapperig stokbrood of brood');
    const words = splitNameWords(line);
    expect([...suggestSelection(words, dict, 'nl')]).toEqual([1]);
    const none = wordsFromText('floepsel dingetje');
    expect([...suggestSelection(none, dict, 'nl')]).toEqual([0, 1]);
    expect([...suggestSelection([], dict, 'nl')]).toEqual([]);
  });

  it('falls back to the alternative when only that is known', () => {
    const words = splitNameWords(nl('2 floepsels of 1 stokbrood'));
    const sel = suggestSelection(words, dict, 'nl');
    expect([...sel].map((i) => words[i]?.text)).toEqual(['stokbrood']);
  });
});

describe('wordsToQuery / lookupWords / wordLinkFor', () => {
  const line = nl('2 sneetjes knapperig stokbrood of brood [voor erbij]');
  const words = splitNameWords(line);

  it('green words are the query, grey words the note; a resolved alternative stays out of the note', () => {
    expect(wordsToQuery(words, new Set([1]))).toEqual({ query: 'stokbrood', note: 'knapperig' });
    const r = lookupWords(words, new Set([1]), dict, 'nl');
    expect(r.found?.id).toBe('stokbrood');
    expect(r.note).toBe('knapperig');
    expect(wordLinkFor(words, new Set([1]), dict, 'nl')).toEqual({ ing: 'stokbrood', query: 'stokbrood', note: 'knapperig', lang: 'nl' });
  });

  it('keeps the line order and the connector of an unresolved alternative', () => {
    const ws = splitNameWords(nl('2 sneetjes knapperig stokbrood of 3 dikke knapperbroodjes'));
    expect(wordsToQuery(ws, new Set([1]))).toEqual({ query: 'stokbrood', note: 'knapperig, of 3 dikke knapperbroodjes' });
    // The alternative's first word selected: the connector still leads the rest of it.
    expect(wordsToQuery(ws, new Set([1, 2])).note).toBe('knapperig, of dikke knapperbroodjes');
  });

  it('the alternative can be the ingredient; everything green means no note', () => {
    expect(wordsToQuery(words, new Set([2]))).toEqual({ query: 'brood', note: 'knapperig stokbrood' });
    expect(lookupWords(words, new Set([2]), dict, 'nl').found?.id).toBe('brood');
    expect(wordsToQuery(words, new Set([0, 1, 2]))).toEqual({ query: 'knapperig stokbrood brood', note: '' });
  });

  it('nothing selected is an empty query and no hit', () => {
    const r = lookupWords(words, new Set(), dict, 'nl');
    expect(r.query).toBe('');
    expect(r.found).toBeUndefined();
    expect(r.note).toBe('knapperig stokbrood');
    expect(wordLinkFor(words, new Set(), dict, 'nl')).toBeUndefined();
    expect(wordLinkFor(words, new Set([0]), dict, 'nl')).toBeUndefined();
  });

  it('the dictionary is asked in the language of the line, plurals included', () => {
    const ws = splitNameWords(en('2 slices crusty baguettes or bread'));
    const sel = suggestSelection(ws, dict, 'en');
    expect(lookupWords(ws, sel, dict, 'en')).toMatchObject({ query: 'baguettes', note: 'crusty' });
    expect(lookupWords(ws, sel, dict, 'en').found?.id).toBe('stokbrood');
  });
});

describe('partialMatch (the "Koppel" question)', () => {
  it('finds the known part of a name the dictionary does not know as a whole', () => {
    const m = partialMatch('knapperig stokbrood', dict, 'nl');
    expect(m?.found.id).toBe('stokbrood');
    expect(m).toMatchObject({ query: 'stokbrood', note: 'knapperig' });
  });

  it('asks nothing when the whole name resolves, when nothing does, or for a single word', () => {
    expect(partialMatch('stokbrood', dict, 'nl')).toBeUndefined();
    expect(partialMatch('zoete aardappel', dict, 'nl')).toBeUndefined();
    expect(partialMatch('floepsel dingetje', dict, 'nl')).toBeUndefined();
    expect(partialMatch('knapperbroodje', dict, 'nl')).toBeUndefined();
    expect(partialMatch('', dict, 'nl')).toBeUndefined();
  });
});

describe('linkedPrep / applyWordLink / wordLinkOverride ("Koppel zo")', () => {
  const raw = '2 sneetjes knapperig stokbrood of brood [voor erbij]';
  const line = nl(raw);
  const link = { ing: 'stokbrood', query: 'stokbrood', note: 'knapperig', lang: 'nl' as const };

  it('links the ingredient, puts the grey words in front of the own prep and leaves raw alone', () => {
    const out = applyWordLink(line, link, dict);
    expect(out.ing).toBe('stokbrood');
    expect(out.confidence).toBe(1);
    expect(out.raw).toEqual({ nl: raw });
    expect(out.raw).toBe(line.raw);
    // "voor erbij" has a translation, "knapperig" has none: only the Dutch side is complete.
    expect(out.prep).toEqual({ nl: 'knapperig, voor erbij' });
    expect(out.alt?.[0]?.ing).toBe('brood');
    expect(renderLine(out, dict, 'nl')).toBe('2 sneden stokbrood (of brood), knapperig, voor erbij');
    // The parsed line itself is untouched.
    expect(line.ing).toBeNull();
    expect(line.prep).toEqual({ nl: 'voor erbij', en: 'for serving' });
  });

  it('an empty note keeps the prep exactly as stored; no prep means the note alone', () => {
    expect(applyWordLink(line, { ...link, note: '' }, dict).prep).toBe(line.prep);
    expect(applyWordLink(nl('2 sneetjes knapperig stokbrood'), link, dict).prep).toEqual({ nl: 'knapperig' });
    expect(linkedPrep({ prep: null }, '  ', 'nl', dict)).toBeNull();
  });

  it('a note the dictionary can translate gives both languages when the own prep has both', () => {
    expect(linkedPrep({ prep: null }, 'in plakjes', 'nl', dict)).toEqual({ nl: 'in plakjes', en: 'sliced' });
    expect(linkedPrep({ prep: { nl: 'voor erbij', en: 'for serving' } }, 'in plakjes', 'nl', dict)).toEqual({ nl: 'in plakjes, voor erbij', en: 'sliced, for serving' });
    // The own prep is Dutch only: an English side would be incomplete, so there is none.
    expect(linkedPrep({ prep: { nl: 'voor erbij' } }, 'in plakjes', 'nl', dict)).toEqual({ nl: 'in plakjes, voor erbij' });
    // The own prep exists only in the other language (typed in the chips): it is kept, never lost.
    expect(linkedPrep({ prep: { en: 'finely chopped' } }, 'knapperig', 'nl', dict)).toEqual({ nl: 'knapperig', en: 'finely chopped' });
    expect(linkedPrep({ prep: { en: 'finely chopped' } }, 'in plakjes', 'nl', dict)).toEqual({ nl: 'in plakjes', en: 'sliced, finely chopped' });
  });

  it('does not repeat a note that is already in the prep (relinking twice)', () => {
    const once = applyWordLink(line, link, dict);
    const twice = applyWordLink(once, link, dict);
    expect(twice.prep).toEqual({ nl: 'knapperig, voor erbij' });
  });

  it('English lines work the same way', () => {
    const l = en('2 slices crusty baguette or bread');
    const out = applyWordLink(l, { ing: 'stokbrood', query: 'baguette', note: 'crusty', lang: 'en' }, dict);
    expect(out.prep).toEqual({ en: 'crusty' });
    expect(renderLine(out, dict, 'en')).toBe('2 slices baguette (or bread), crusty');
  });

  it('wordLinkOverride gives the LineOverride fields: ing always, prep only with grey words', () => {
    expect(wordLinkOverride(line, link, dict)).toEqual({ ing: 'stokbrood', prep: { nl: 'knapperig, voor erbij' } });
    expect(wordLinkOverride(line, { ...link, note: '' }, dict)).toEqual({ ing: 'stokbrood' });
  });
});
