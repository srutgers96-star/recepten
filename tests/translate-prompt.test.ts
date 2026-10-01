// buildTranslationPrompt / parseTranslationAnswer / applyTranslationAnswer (docs/phase-2-spec.md §5
// "Language pair", docs/phase-5-spec.md A-bis.2 and A-bis.7).
import { describe, expect, it } from 'vitest';
import type { Line } from '../src/domain/model';
import { answeredSteps, applyTranslationAnswer, buildTranslationPrompt, parseTranslationAnswer, planTranslation } from '../src/domain/translate-prompt';

const recipe = {
  name: { nl: 'Uiensoep', en: '' },
  lines: [{ raw: { nl: '4 uien' } }, { raw: { nl: 'Dressing:' }, kind: 'header' }, { raw: { nl: '1 l bouillon' } }],
  steps: [{ text: { nl: 'Snipper de uien.' } }, { text: { nl: 'Kook 20 minuten.' } }],
};

/** 3 resolved lines (one with a Dutch-only note, one with a Dutch-only prep) + 1 unresolved line. */
const parsed: Line[] = [
  { raw: { nl: '1 middelgrote aubergine (gesneden in blokjes van ongeveer 2 cm breed)' }, ing: 'aubergine', note: { nl: 'gesneden in blokjes van ongeveer 2 cm breed' } },
  { raw: { nl: '2 el olijfolie' }, ing: 'olijfolie' },
  { raw: { nl: '1 ui [op de ouderwetse manier]' }, ing: 'ui', prep: { nl: 'op de ouderwetse manier' } },
  { raw: { nl: '4 blikjes tonijn op water' }, ing: null, name: 'tonijn op water' },
];
const parsedRecipe = { name: { nl: 'Stoofpot' }, description: { nl: 'Lekker in de herfst.' }, servingTip: { nl: 'Met brood.' }, lines: parsed, steps: [{ text: { nl: 'Kook.' } }] };

describe('buildTranslationPrompt', () => {
  it('numbers the name, the (unresolved) lines (I) and the steps (S) in the source language', () => {
    const p = buildTranslationPrompt(recipe, 'nl', 'en');
    expect(p).toContain('from Dutch to British English');
    expect(p).toContain('\n1. Uiensoep\n');
    expect(p).toContain('\nI1. 4 uien\nI2. Dressing:\nI3. 1 l bouillon\n');
    expect(p).toContain('\nS1. Snipper de uien.\nS2. Kook 20 minuten.\n');
    expect(p.endsWith('\n')).toBe(true);
  });

  it('works the other way round and skips a line that already has the target text', () => {
    const p = buildTranslationPrompt({ name: { en: 'Onion soup' }, lines: [{ raw: { en: '4 onions' } }, { raw: { nl: 'zout' } }], steps: [] }, 'en', 'nl');
    expect(p).toContain('from British English to Dutch');
    expect(p).toContain('\n1. Onion soup\nI1. 4 onions\n');
    expect(p).not.toContain('I2.');
  });

  it('asks only for free text of resolved lines (N/P by row) and unresolved lines in full (A-bis.2/A-bis.5)', () => {
    const plan = planTranslation(parsedRecipe, 'nl', 'en');
    expect(plan).toEqual({ name: true, lines: [4], notes: [1], preps: [3], description: true, servingTip: true, steps: [1] });
    const p = buildTranslationPrompt(parsedRecipe, 'nl', 'en');
    const body = p.slice(p.indexOf('\n1. '));
    expect(body).toBe('\n1. Stoofpot\nD. Lekker in de herfst.\nT. Met brood.\nN1. gesneden in blokjes van ongeveer 2 cm breed\nP3. op de ouderwetse manier\nI4. 4 blikjes tonijn op water\nS1. Kook.\n');
    expect(p).not.toContain('olijfolie');
    expect(p).not.toContain('I1.');
    expect(p).toContain('D. = description, T. = serving tip');
  });

  it('does not ask for notes or preps that already exist in the target language, nor for a translated description', () => {
    const r = {
      ...parsedRecipe,
      description: { nl: 'x', en: 'y' },
      lines: [{ raw: { nl: '4 eieren (verdeeld)' }, ing: 'ei', note: { nl: 'verdeeld', en: 'divided' } }],
    };
    expect(planTranslation(r, 'nl', 'en')).toMatchObject({ lines: [], notes: [], preps: [], description: false });
  });

  it('skips the name and the steps that already have target text, sending a sparse S-list by row (A-bis.2)', () => {
    const r = { name: { nl: 'Soep', en: 'Soup' }, lines: [], steps: [{ text: { nl: 'Snij.', en: 'Chop.' } }, { text: { nl: 'Kook.' } }, { text: { nl: 'Serveer.' } }] };
    const plan = planTranslation(r, 'nl', 'en');
    expect(plan.name).toBe(false);
    expect(plan.steps).toEqual([2, 3]);
    const p = buildTranslationPrompt(r, 'nl', 'en');
    expect(p).not.toContain('1. Soep');
    expect(p).not.toContain('\nS1.');
    expect(p.slice(p.indexOf('S2.'))).toBe('S2. Kook.\nS3. Serveer.\n');
    expect(answeredSteps(parseTranslationAnswer('S2. Cook.\nS3. Serve.'), plan.steps)).toEqual({ 2: 'Cook.', 3: 'Serve.' });
    // Renumbered 1..n by the assistant: mapped onto the asked rows in order.
    expect(answeredSteps(parseTranslationAnswer('S1. Cook.\nS2. Serve.'), plan.steps)).toEqual({ 2: 'Cook.', 3: 'Serve.' });
  });

  it('takes an isResolved predicate for ids the dictionary in use does not know', () => {
    const r = { name: { nl: 'X' }, lines: [{ raw: { nl: '2 makreelfilets' }, ing: 'gerookte-makreel-2' }], steps: [] };
    expect(planTranslation(r, 'nl', 'en').lines).toEqual([]);
    expect(planTranslation(r, 'nl', 'en', { isResolved: () => false }).lines).toEqual([1]);
  });
});

describe('parseTranslationAnswer', () => {
  it('reads the clean numbered answer', () => {
    const a = parseTranslationAnswer('1. Onion soup\nI1. 4 onions\nI2. Dressing:\nI3. 1 l stock\nS1. Finely slice the onions.\nS2. Simmer for 20 minutes.\n');
    expect(a).toEqual({
      name: 'Onion soup',
      lines: ['4 onions', 'Dressing:', '1 l stock'],
      lineByNumber: { 1: '4 onions', 2: 'Dressing:', 3: '1 l stock' },
      notes: {},
      preps: {},
      steps: ['Finely slice the onions.', 'Simmer for 20 minutes.'],
      stepByNumber: { 1: 'Finely slice the onions.', 2: 'Simmer for 20 minutes.' },
    });
  });

  it('reads D/T/N/P items and sparse I numbers', () => {
    const a = parseTranslationAnswer('1. Stew\nD. Nice in autumn.\nT. With bread.\nN1. cut into roughly 2 cm cubes\nP3. the old-fashioned way\nI4. 4 tins tuna in water\nS1. Cook.');
    expect(a.name).toBe('Stew');
    expect(a.description).toBe('Nice in autumn.');
    expect(a.servingTip).toBe('With bread.');
    expect(a.notes).toEqual({ 1: 'cut into roughly 2 cm cubes' });
    expect(a.preps).toEqual({ 3: 'the old-fashioned way' });
    expect(a.lineByNumber).toEqual({ 4: '4 tins tuna in water' });
    expect(a.lines).toEqual(['4 tins tuna in water']);
    expect(a.steps).toEqual(['Cook.']);
  });

  it('tolerates chatter, markdown, other separators and continuation lines', () => {
    const a = parseTranslationAnswer(
      [
        'Sure! Here is the translation:',
        '',
        '**1.** Onion soup',
        '- **I1:** 4 onions',
        '* I2) 1 l stock',
        'S1: Finely slice the onions',
        'and fry them gently.',
        '',
        'S2. Simmer for 20 minutes.',
        '',
        'Let me know if you need anything else!',
      ].join('\n'),
    );
    expect(a.name).toBe('Onion soup');
    expect(a.lines).toEqual(['4 onions', '1 l stock']);
    expect(a.steps).toEqual(['Finely slice the onions\nand fry them gently.', 'Simmer for 20 minutes.']);
  });

  it('takes the name from "Title:"/"Naam:" or from a lone first line, never from chatter (A-bis.7)', () => {
    expect(parseTranslationAnswer('Title: Onion soup\nI1. 4 onions').name).toBe('Onion soup');
    expect(parseTranslationAnswer('**Naam:** Uiensoep\nI1. 4 uien\nS1. Kook.')).toMatchObject({ name: 'Uiensoep', lines: ['4 uien'], steps: ['Kook.'] });
    expect(parseTranslationAnswer('Onion soup\n\nI1. 4 onions\nS1. Slice.')).toMatchObject({ name: 'Onion soup', lines: ['4 onions'] });
    expect(parseTranslationAnswer('**Onion soup**\nI1. 4 onions').name).toBe('Onion soup');
    expect(parseTranslationAnswer('Here is the translation:\nI1. 4 onions').name).toBeUndefined();
    expect(parseTranslationAnswer('Sure, here you go\nI1. 4 onions').name).toBeUndefined();
    expect(parseTranslationAnswer('Some intro\nAnother line\nI1. 4 onions').name).toBeUndefined();
  });

  it('orders by marker number and copes with a missing name or missing numbers', () => {
    const a = parseTranslationAnswer('S2. Second\nI2. b\nI1. a\nS1. First\nI4. d');
    expect(a.name).toBeUndefined();
    expect(a.lines).toEqual(['a', 'b', 'd']);
    expect(a.lineByNumber).toEqual({ 1: 'a', 2: 'b', 4: 'd' });
    expect(a.steps).toEqual(['First', 'Second']);
  });

  it('understands section headers with plain numbering as a fallback', () => {
    const a = parseTranslationAnswer('1. Onion soup\n\nIngredients:\n- 4 onions\n- 1 l stock\n\nMethod:\n1. Slice.\n2. Simmer.');
    expect(a.name).toBe('Onion soup');
    expect(a.lines).toEqual(['4 onions', '1 l stock']);
    expect(a.steps).toEqual(['Slice.', 'Simmer.']);
  });

  it('keeps empty markers as empty strings and returns empty lists for junk', () => {
    expect(parseTranslationAnswer('I1.\nI2. b')).toMatchObject({ lines: ['', 'b'], steps: [] });
    expect(parseTranslationAnswer('hello there')).toMatchObject({ lines: [], steps: [], name: 'hello there' });
    expect(parseTranslationAnswer('')).toEqual({ lines: [], lineByNumber: {}, notes: {}, preps: {}, steps: [], stepByNumber: {} });
  });

  it('does not mistake a step starting with "I" for a marker', () => {
    const a = parseTranslationAnswer('S1. In a pan, heat the oil.\nS2. I5 minutes later, stir.');
    expect(a.steps).toEqual(['In a pan, heat the oil.', 'I5 minutes later, stir.']);
    expect(a.lines).toEqual([]);
  });
});

describe('applyTranslationAnswer', () => {
  it('writes note/prep/raw into the target language only, never overwriting, never raw on a resolved line', () => {
    const answer = parseTranslationAnswer('1. Stew\nN1. cut into roughly 2 cm cubes\nP3. the old-fashioned way\nI4. 4 tins tuna in water\nI2. 2 tbsp olive oil');
    const r = applyTranslationAnswer(parsed, answer, 'en');
    expect(r.changed).toBe(3);
    expect(r.lines[0]?.note).toEqual({ nl: 'gesneden in blokjes van ongeveer 2 cm breed', en: 'cut into roughly 2 cm cubes' });
    expect(r.lines[0]?.raw).toEqual({ nl: '1 middelgrote aubergine (gesneden in blokjes van ongeveer 2 cm breed)' });
    expect(r.lines[1]).toBe(parsed[1]); // resolved, no free text: untouched even though I2 was answered
    expect(r.lines[2]?.prep).toEqual({ nl: 'op de ouderwetse manier', en: 'the old-fashioned way' });
    expect(r.lines[3]?.raw).toEqual({ nl: '4 blikjes tonijn op water', en: '4 tins tuna in water' });
    // Existing target text stays.
    const again = applyTranslationAnswer(r.lines, parseTranslationAnswer('N1. something else\nI4. other'), 'en');
    expect(again.changed).toBe(0);
    expect(again.lines[0]?.note?.en).toBe('cut into roughly 2 cm cubes');
  });

  it('maps renumbered I-items positionally when the count matches the plan', () => {
    const lines: Line[] = [{ raw: { nl: '2 el olijfolie' }, ing: 'olijfolie' }, { raw: { nl: 'iets raars' }, ing: null }, { raw: { nl: 'nog iets' }, ing: null }];
    const plan = planTranslation({ name: { nl: 'X' }, lines, steps: [] }, 'nl', 'en');
    expect(plan.lines).toEqual([2, 3]);
    const r = applyTranslationAnswer(lines, parseTranslationAnswer('I1. something odd\nI2. something else'), 'en', { lineNumbers: plan.lines });
    expect(r.lines.map((l) => l.raw.en)).toEqual([undefined, 'something odd', 'something else']);
  });
});
