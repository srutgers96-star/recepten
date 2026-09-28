// WhatsApp share message (PLAN.md §7 "Het bericht (exact)") and the readable "Deel als tekst".
import { describe, it, expect } from 'vitest';
import type { Recipe } from '../src/domain/model';
import { APP_NAME, buildReadableRecipe, buildShareMessage, buildShareMessageFor, countIngredientLines, recipeHasLang, shareMessageInput } from '../src/domain/message';
import { extractTokens } from '../src/domain/token';

const TOKEN = 'eJx9kU1v2zAMhu_5FYQvAbCdEfGhIjKlMnOpQrStUvWxYz0123456789';
const URL = `https://stijn.github.io/recepten/#r=${TOKEN}`;

const RECIPE: Recipe = {
  schema: 2,
  id: 'u:abc12345',
  rev: 1,
  createdAt: '2026-01-02T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
  origin: { kind: 'user', author: 'Stijn' },
  name: { nl: 'Pasta pesto', en: 'Pesto pasta' },
  tags: [],
  servings: 2,
  lines: [
    { raw: { nl: '400 g pasta', en: '400 g pasta' } },
    { raw: { nl: 'Saus:', en: 'Sauce:' }, kind: 'header' },
    { raw: { nl: '1 pot pesto', en: '1 jar of pesto' } },
    { raw: { nl: 'peper en zout' } },
  ],
  steps: [
    { text: { nl: 'Kook de pasta in 10 minuten\nbeetgaar.', en: 'Boil the pasta for 10 minutes.' }, timers: [{ min: 10, unit: 'min' }] },
    { text: { nl: 'Meng met de pesto en serveer.', en: 'Mix with the pesto and serve.' } },
  ],
  servingTip: { nl: 'Lekker met Parmezaan.' },
  goesWith: [],
  aliases: [],
};

describe('buildShareMessage', () => {
  it('produces the exact Dutch message from the plan', () => {
    const msg = buildShareMessage({
      nameNl: 'Afwasmachinezalm',
      nameEn: 'Dishwasher salmon',
      servings: 4,
      ingredientCount: 10,
      by: 'Stijn',
      url: URL,
      lang: 'nl',
    });
    expect(msg).toBe(
      '\u{1F372} Afwasmachinezalm · Dishwasher salmon\n' +
        '4 pers · 10 ingrediënten · van Stijn\n' +
        "Open in Rutgers' Recepten (of tik voor een voorproefje / or tap to preview):\n" +
        URL,
    );
  });

  it('produces the English variant', () => {
    const msg = buildShareMessage({
      nameNl: 'Afwasmachinezalm',
      nameEn: 'Dishwasher salmon',
      servings: 4,
      ingredientCount: 10,
      by: 'Emma',
      url: URL,
      lang: 'en',
    });
    expect(msg).toBe(
      '\u{1F372} Afwasmachinezalm · Dishwasher salmon\n' +
        '4 servings · 10 ingredients · from Emma\n' +
        "Open in Rutgers' Recipes (or tap to preview / of tik voor een voorproefje):\n" +
        URL,
    );
    expect(APP_NAME.en).toBe("Rutgers' Recipes");
  });

  it('omits the English name when missing or identical', () => {
    const base = { servings: 4, ingredientCount: 3, by: 'Stijn', url: URL, lang: 'nl' as const };
    expect(buildShareMessage({ ...base, nameNl: 'Dahl' }).split('\n')[0]).toBe('\u{1F372} Dahl');
    expect(buildShareMessage({ ...base, nameNl: 'Dahl', nameEn: '' }).split('\n')[0]).toBe('\u{1F372} Dahl');
    expect(buildShareMessage({ ...base, nameNl: 'Pizza', nameEn: 'pizza' }).split('\n')[0]).toBe('\u{1F372} Pizza');
    expect(buildShareMessage({ ...base, nameNl: '', nameEn: 'Toad in the hole' }).split('\n')[0]).toBe(
      '\u{1F372} Toad in the hole',
    );
  });

  it('omits servings and sender when absent, and uses singular forms', () => {
    const nl = buildShareMessage({ nameNl: 'Ei', ingredientCount: 1, by: '', url: URL, lang: 'nl' });
    expect(nl.split('\n')[1]).toBe('1 ingrediënt');
    const en = buildShareMessage({ nameNl: 'Ei', nameEn: 'Egg', servings: 1, ingredientCount: 1, by: ' Emma ', url: URL, lang: 'en' });
    expect(en.split('\n')[1]).toBe('1 serving · 1 ingredient · from Emma');
    expect(buildShareMessage({ nameNl: 'Ei', servings: 0, ingredientCount: 0, by: 'X', url: URL, lang: 'nl' }).split('\n')[1]).toBe(
      '0 ingrediënten · van X',
    );
  });

  it('puts the URL alone on the last of four lines, so WhatsApp renders one tappable link', () => {
    const msg = buildShareMessage({ nameNl: 'Dahl', ingredientCount: 8, by: 'Stijn', url: ` ${URL}\n`, lang: 'nl' });
    const lines = msg.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe(URL);
    expect(msg.slice(URL.length * -1)).toBe(URL);
    expect(extractTokens(msg)).toEqual([{ key: 'r', token: TOKEN }]);
  });
});

describe('buildShareMessageFor (schema-2 recipe)', () => {
  it('maps name, servings and the line count (headers excluded) onto the message', () => {
    expect(countIngredientLines(RECIPE)).toBe(3);
    expect(shareMessageInput(RECIPE, { by: 'Stijn', url: URL, lang: 'nl' })).toEqual({
      nameNl: 'Pasta pesto',
      nameEn: 'Pesto pasta',
      servings: 2,
      ingredientCount: 3,
      by: 'Stijn',
      url: URL,
      lang: 'nl',
    });
    expect(buildShareMessageFor(RECIPE, { by: 'Stijn', url: URL, lang: 'nl' })).toBe(
      '\u{1F372} Pasta pesto · Pesto pasta\n' +
        '2 pers · 3 ingrediënten · van Stijn\n' +
        "Open in Rutgers' Recepten (of tik voor een voorproefje / or tap to preview):\n" +
        URL,
    );
  });

  it('works without a sender and for an English-only recipe', () => {
    const en: Recipe = { ...RECIPE, name: { en: 'Toad in the hole' } };
    const msg = buildShareMessageFor(en, { url: URL, lang: 'en' });
    expect(msg.split('\n')[0]).toBe('\u{1F372} Toad in the hole');
    expect(msg.split('\n')[1]).toBe('2 servings · 3 ingredients');
  });
});

describe('buildReadableRecipe', () => {
  it('renders the Dutch block: title, servings, lines with headers, numbered steps, tip, link last', () => {
    expect(buildReadableRecipe(RECIPE, ['nl'], URL)).toBe(
      [
        '\u{1F372} Pasta pesto',
        '2 pers.',
        '',
        'Ingrediënten:',
        '- 400 g pasta',
        'Saus:',
        '- 1 pot pesto',
        '- peper en zout',
        '',
        'Bereiding:',
        '1. Kook de pasta in 10 minuten beetgaar.',
        '2. Meng met de pesto en serveer.',
        '',
        'Serveertip: Lekker met Parmezaan.',
        '',
        "Open in Rutgers' Recepten (of tik voor een voorproefje):",
        URL,
      ].join('\n'),
    );
  });

  it('renders the English block with fallbacks for lines that have no English text', () => {
    const text = buildReadableRecipe(RECIPE, ['en']);
    expect(text).toBe(
      [
        '\u{1F372} Pesto pasta',
        '2 servings',
        '',
        'Ingredients:',
        '- 400 g pasta',
        'Sauce:',
        '- 1 jar of pesto',
        '- peper en zout',
        '',
        'Method:',
        '1. Boil the pasta for 10 minutes.',
        '2. Mix with the pesto and serve.',
        '',
        'Serving tip: Lekker met Parmezaan.',
      ].join('\n'),
    );
    expect(text.includes('http')).toBe(false);
  });

  it('puts both languages in order NL then EN, separated by a blank line, with the link once at the end', () => {
    const both = buildReadableRecipe(RECIPE, ['en', 'nl', 'en'], URL);
    const nl = buildReadableRecipe(RECIPE, ['nl']);
    const en = buildReadableRecipe(RECIPE, ['en']);
    expect(both.startsWith(nl + '\n\n' + en + '\n\n')).toBe(true);
    expect(both.endsWith('\n' + URL)).toBe(true);
    expect(both.split(URL)).toHaveLength(2);
    expect(extractTokens(both)).toEqual([{ key: 'r', token: TOKEN }]);
  });

  it('skips a requested language the recipe has no text in, unless nothing would be left', () => {
    const nlOnly: Recipe = { ...RECIPE, name: { nl: 'Dahl' }, lines: [{ raw: { nl: '1 ui' } }], steps: [{ text: { nl: 'Fruit de ui.' } }], servingTip: null };
    expect(recipeHasLang(nlOnly, 'en')).toBe(false);
    expect(buildReadableRecipe(nlOnly, ['nl', 'en'])).toBe(buildReadableRecipe(nlOnly, ['nl']));
    // English requested only: fall back to the Dutch texts under English labels.
    expect(buildReadableRecipe(nlOnly, ['en'])).toBe('\u{1F372} Dahl\n2 servings\n\nIngredients:\n- 1 ui\n\nMethod:\n1. Fruit de ui.');
    // No languages at all: Dutch.
    expect(buildReadableRecipe(nlOnly, [])).toBe(buildReadableRecipe(nlOnly, ['nl']));
  });
});
