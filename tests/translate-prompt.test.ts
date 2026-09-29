// buildTranslationPrompt / parseTranslationAnswer (docs/phase-2-spec.md §5 "Language pair").
import { describe, expect, it } from 'vitest';
import { buildTranslationPrompt, parseTranslationAnswer } from '../src/domain/translate-prompt';

const recipe = {
  name: { nl: 'Uiensoep', en: '' },
  lines: [{ raw: { nl: '4 uien' } }, { raw: { nl: 'Dressing:' }, kind: 'header' }, { raw: { nl: '1 l bouillon' } }],
  steps: [{ text: { nl: 'Snipper de uien.' } }, { text: { nl: 'Kook 20 minuten.' } }],
};

describe('buildTranslationPrompt', () => {
  it('numbers the name, the lines (I) and the steps (S) in the source language', () => {
    const p = buildTranslationPrompt(recipe, 'nl', 'en');
    expect(p).toContain('from Dutch to British English');
    expect(p).toContain('\n1. Uiensoep\n');
    expect(p).toContain('\nI1. 4 uien\nI2. Dressing:\nI3. 1 l bouillon\n');
    expect(p).toContain('\nS1. Snipper de uien.\nS2. Kook 20 minuten.\n');
    expect(p.endsWith('\n')).toBe(true);
  });

  it('works the other way round and with missing text', () => {
    const p = buildTranslationPrompt({ name: { en: 'Onion soup' }, lines: [{ raw: { en: '4 onions' } }, { raw: { nl: 'zout' } }], steps: [] }, 'en', 'nl');
    expect(p).toContain('from British English to Dutch');
    expect(p).toContain('\n1. Onion soup\nI1. 4 onions\nI2. \n');
  });
});

describe('parseTranslationAnswer', () => {
  it('reads the clean numbered answer', () => {
    const a = parseTranslationAnswer('1. Onion soup\nI1. 4 onions\nI2. Dressing:\nI3. 1 l stock\nS1. Finely slice the onions.\nS2. Simmer for 20 minutes.\n');
    expect(a).toEqual({
      name: 'Onion soup',
      lines: ['4 onions', 'Dressing:', '1 l stock'],
      steps: ['Finely slice the onions.', 'Simmer for 20 minutes.'],
    });
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

  it('orders by marker number and copes with a missing name or missing numbers', () => {
    const a = parseTranslationAnswer('S2. Second\nI2. b\nI1. a\nS1. First\nI4. d');
    expect(a.name).toBeUndefined();
    expect(a.lines).toEqual(['a', 'b', 'd']);
    expect(a.steps).toEqual(['First', 'Second']);
  });

  it('understands section headers with plain numbering as a fallback', () => {
    const a = parseTranslationAnswer('1. Onion soup\n\nIngredients:\n- 4 onions\n- 1 l stock\n\nMethod:\n1. Slice.\n2. Simmer.');
    expect(a.name).toBe('Onion soup');
    expect(a.lines).toEqual(['4 onions', '1 l stock']);
    expect(a.steps).toEqual(['Slice.', 'Simmer.']);
  });

  it('keeps empty markers as empty strings and returns empty lists for junk', () => {
    expect(parseTranslationAnswer('I1.\nI2. b')).toEqual({ lines: ['', 'b'], steps: [] });
    expect(parseTranslationAnswer('hello there')).toEqual({ lines: [], steps: [] });
    expect(parseTranslationAnswer('')).toEqual({ lines: [], steps: [] });
  });

  it('does not mistake a step starting with "I" for a marker', () => {
    const a = parseTranslationAnswer('S1. In a pan, heat the oil.\nS2. I5 minutes later, stir.');
    expect(a.steps).toEqual(['In a pan, heat the oil.', 'I5 minutes later, stir.']);
    expect(a.lines).toEqual([]);
  });
});
