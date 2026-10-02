// recipeAsText / ingredientsAsText (docs/phase-5-spec.md block D.2 "Kopieer als tekst").
import { describe, expect, it } from 'vitest';
import { ingredientsAsText, recipeAsText, type RecipeTextInput } from '../src/domain/recipe-text';

const NL: RecipeTextInput = {
  name: 'Pasta pesto',
  servings: 4,
  timeLabel: '35 min',
  lines: [
    { text: 'Voor de saus', header: true },
    { text: '200 g pasta', header: false },
    { text: '2 el pesto', header: false },
    { text: 'Erbij', header: true },
    { text: '50 g parmezaan', header: false },
  ],
  steps: ['Kook de pasta.', 'Roer de pesto erdoor.'],
  lang: 'nl',
};

describe('recipeAsText', () => {
  it('renders name, servings + time, dashed ingredients with headers, numbered steps (NL)', () => {
    expect(recipeAsText(NL)).toBe(
      [
        'Pasta pesto',
        '4 personen · 35 min',
        '',
        'Voor de saus:',
        '- 200 g pasta',
        '- 2 el pesto',
        '',
        'Erbij:',
        '- 50 g parmezaan',
        '',
        'Bereiding:',
        '1. Kook de pasta.',
        '2. Roer de pesto erdoor.',
      ].join('\n'),
    );
  });

  it('renders English with "Method:" and "people"', () => {
    const en = recipeAsText({
      name: 'Pesto pasta',
      servings: 2,
      lines: [{ text: '200 g pasta', header: false }],
      steps: ['Cook the pasta.'],
      lang: 'en',
    });
    expect(en).toBe(['Pesto pasta', '2 people', '', '- 200 g pasta', '', 'Method:', '1. Cook the pasta.'].join('\n'));
  });

  it('uses the singular for 1 serving in both languages', () => {
    expect(recipeAsText({ name: 'Ei', servings: 1, lines: [], steps: [], lang: 'nl' })).toBe('Ei\n1 persoon');
    expect(recipeAsText({ name: 'Egg', servings: 1, lines: [], steps: [], lang: 'en' })).toBe('Egg\n1 person');
  });

  it('leaves the time out when timeLabel is missing or null', () => {
    const base = { name: 'Soep', servings: 4, lines: [], steps: [], lang: 'nl' as const };
    expect(recipeAsText(base)).toBe('Soep\n4 personen');
    expect(recipeAsText({ ...base, timeLabel: null })).toBe('Soep\n4 personen');
    expect(recipeAsText({ ...base, timeLabel: '  ' })).toBe('Soep\n4 personen');
  });

  it('omits the method block entirely when there are no steps', () => {
    const txt = recipeAsText({ ...NL, steps: [] });
    expect(txt).not.toContain('Bereiding:');
    expect(txt.endsWith('- 50 g parmezaan')).toBe(true);
  });

  it('drops blank steps and renumbers the rest', () => {
    const txt = recipeAsText({ ...NL, steps: ['Kook.', '   ', '', 'Serveer.'] });
    expect(txt).toContain('1. Kook.');
    expect(txt).toContain('2. Serveer.');
    expect(txt).not.toContain('3.');
  });

  it('does not double the colon on a header that already has one, and skips empty lines', () => {
    const txt = recipeAsText({
      name: 'X',
      servings: 2,
      lines: [
        { text: 'Saus:', header: true },
        { text: '   ', header: false },
        { text: 'room', header: false },
      ],
      steps: [],
      lang: 'nl',
    });
    expect(txt).toBe(['X', '2 personen', '', 'Saus:', '- room'].join('\n'));
  });

  it('starts headers without a leading blank line when the header opens the block', () => {
    const txt = recipeAsText({ ...NL, steps: [] });
    // the blank line before "Voor de saus:" is the block separator, not a header separator
    expect(txt).toContain('4 personen · 35 min\n\nVoor de saus:');
    // but the second header does get its own blank line
    expect(txt).toContain('- 2 el pesto\n\nErbij:');
  });
});

describe('ingredientsAsText', () => {
  it('renders only name + servings + ingredients', () => {
    const txt = ingredientsAsText({ name: NL.name, servings: NL.servings, lines: NL.lines, lang: 'nl' });
    expect(txt).toBe(['Pasta pesto', '4 personen', '', 'Voor de saus:', '- 200 g pasta', '- 2 el pesto', '', 'Erbij:', '- 50 g parmezaan'].join('\n'));
  });

  it('renders English servings', () => {
    const txt = ingredientsAsText({ name: 'Egg', servings: 1, lines: [{ text: '1 egg', header: false }], lang: 'en' });
    expect(txt).toBe(['Egg', '1 person', '', '- 1 egg'].join('\n'));
  });

  it('has no trailing blank block when there are no ingredient lines', () => {
    expect(ingredientsAsText({ name: 'Leeg', servings: 4, lines: [], lang: 'nl' })).toBe('Leeg\n4 personen');
  });
});
