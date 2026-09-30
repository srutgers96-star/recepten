// buildImportPrompt / parsePlainRecipe (docs/phase-2-spec.md §5 "Foto-import").
import { describe, expect, it } from 'vitest';
import { buildImportPrompt, categoryIdFromWord, parseBilingualPlain, parsePlainRecipe, tagIdsFromText } from '../src/domain/photo-import';

describe('buildImportPrompt', () => {
  it('describes the plain format in both languages', () => {
    const nl = buildImportPrompt('nl');
    expect(nl).toContain('# Naam');
    expect(nl).toContain('## Ingrediënten');
    expect(nl).toContain('## Bereiding');
    expect(nl).toContain('Porties:');
    const en = buildImportPrompt('en');
    expect(en).toContain('# Name');
    expect(en).toContain('## Ingredients');
    expect(en).toContain('## Method');
    expect(en).toContain('Servings:');
  });

  it('asks for the optional category and labels lines and lists the vocabularies', () => {
    const nl = buildImportPrompt('nl', { bilingual: false });
    expect(nl).toContain('Categorie: pasta');
    expect(nl).toContain('Labels: vegetarisch, snel');
    expect(nl).toContain('hartige-taart');
    expect(nl).toContain('glutenvrij-optie');
    const en = buildImportPrompt('en', { bilingual: false });
    expect(en).toContain('Category: pasta');
    expect(en).toContain('Tags: vegetarian, quick');
    for (const l of ['nl', 'en'] as const) {
      const p = buildImportPrompt(l);
      expect(p).toContain('Categorie: pasta');
      expect(p).toContain('Category: pasta');
      expect(p).toContain('Labels:');
      expect(p).toContain('Tags:');
    }
  });
});

describe('parsePlainRecipe', () => {
  it('reads the Dutch format', () => {
    const r = parsePlainRecipe('# Uiensoep\nPorties: 6\n## Ingrediënten\n4 uien\n1 l bouillon\n## Bereiding\nSnipper de uien.\n\nKook 20 minuten.\n');
    expect(r).toEqual({ name: 'Uiensoep', servings: 6, lines: ['4 uien', '1 l bouillon'], steps: ['Snipper de uien.', 'Kook 20 minuten.'] });
  });

  it('reads the English format with bullets, numbers and a numbered method', () => {
    const r = parsePlainRecipe('# Onion soup\nServings: 4\n\n## Ingredients\n- 4 onions\n2. 1 l stock\n\n## Method\n1. Slice the onions.\n2. Simmer for 20 minutes.\n');
    expect(r).toEqual({ name: 'Onion soup', servings: 4, lines: ['4 onions', '1 l stock'], steps: ['Slice the onions.', 'Simmer for 20 minutes.'] });
  });

  it('is lenient about headers without # and a plain first line as the name', () => {
    const r = parsePlainRecipe('Onion soup\nIngredients:\n4 onions\nMethod:\nSlice.\nSimmer.');
    expect(r).toEqual({ name: 'Onion soup', servings: null, lines: ['4 onions'], steps: ['Slice.', 'Simmer.'] });
  });

  it('joins wrapped paragraph lines into one step when paragraphs are blank-line separated', () => {
    const r = parsePlainRecipe('# X\n## Bereiding\nKook de aardappelen\nin 20 minuten gaar.\n\nStamp ze fijn.');
    expect(r?.steps).toEqual(['Kook de aardappelen in 20 minuten gaar.', 'Stamp ze fijn.']);
  });

  it('keeps a header line ("Dressing:") among the ingredients and a Naam: key', () => {
    const r = parsePlainRecipe('Naam: Salade\n## Ingrediënten\nDressing:\n2 el olie\n## Bereiding\nMeng.');
    expect(r?.name).toBe('Salade');
    expect(r?.lines).toEqual(['Dressing:', '2 el olie']);
  });

  it('reads Categorie:/Labels: and Category:/Tags: lines into ids, dropping unknown words', () => {
    const nl = parsePlainRecipe('# Uiensoep\nPorties: 6\nCategorie: Soep\nLabels: vegetarisch, snel, onbekend\n## Ingrediënten\n4 uien\n## Bereiding\nKook.');
    expect(nl).toEqual({ name: 'Uiensoep', servings: 6, category: 'soep', tags: ['vegetarisch', 'snel'], lines: ['4 uien'], steps: ['Kook.'] });
    const en = parsePlainRecipe('# Pie\n**Category:** Savoury pie\nTags: vegetarian; quick and oven\n## Ingredients\n1 egg\n## Method\nBake.');
    expect(en?.category).toBe('hartige-taart');
    expect(en?.tags).toEqual(['vegetarisch', 'snel', 'oven']);
    // Unknown category: no key at all; no lines: no keys at all (the editor keeps its own values).
    const odd = parsePlainRecipe('# X\nCategorie: Toetje\nLabels: -\n## Ingrediënten\n1 ei\n## Bereiding\nRoer.');
    expect(odd).not.toHaveProperty('category');
    expect(odd?.tags).toEqual([]);
    const none = parsePlainRecipe('# X\n## Ingrediënten\n1 ei\n## Bereiding\nLabels: dit is een stap.');
    expect(none).not.toHaveProperty('category');
    expect(none).not.toHaveProperty('tags');
    expect(none?.steps).toEqual(['Labels: dit is een stap.']);
  });

  it('maps category and tag words in both languages, tolerant of case, diacritics and decoration', () => {
    expect(categoryIdFromWord('Wok & noedels')).toBe('wok-noedels');
    expect(categoryIdFromWord('Wok & noodles')).toBe('wok-noedels');
    expect(categoryIdFromWord('Pasta (vegetarisch)')).toBe('pasta');
    expect(categoryIdFromWord('hartige-taart')).toBe('hartige-taart');
    expect(categoryIdFromWord('Stamppot (Dutch mash)')).toBe('stamppot');
    expect(categoryIdFromWord('Dessert')).toBeUndefined();
    expect(tagIdsFromText('gluten-free, plant-based, kids')).toEqual(['glutenvrij', 'vegan', 'kids']);
    expect(tagIdsFromText('Vegetarisch · Zomer · vegetarisch')).toEqual(['vegetarisch', 'zomer']);
    expect(tagIdsFromText('veggie option / world')).toEqual(['vega-optie', 'wereld']);
    expect(tagIdsFromText('')).toEqual([]);
  });

  it('returns null for text without a recipe', () => {
    expect(parsePlainRecipe('')).toBeNull();
    expect(parsePlainRecipe('   \n\n')).toBeNull();
    expect(parsePlainRecipe('## Ingrediënten\n\n## Bereiding\n')).toBeNull();
  });
});

describe('buildImportPrompt (bilingual, the default)', () => {
  it('asks for an NL block and an EN block with equal counts', () => {
    for (const l of ['nl', 'en'] as const) {
      const p = buildImportPrompt(l);
      expect(p).toContain('=== NL ===');
      expect(p).toContain('=== EN ===');
      expect(p).toContain('## Ingrediënten');
      expect(p).toContain('## Ingredients');
      expect(p).toContain('Porties: 4');
      expect(p).toContain('Servings: 4');
    }
    expect(buildImportPrompt('nl', { bilingual: false })).not.toContain('=== EN ===');
    expect(buildImportPrompt('en', { bilingual: false })).toContain('# Name');
  });
});

const NL_BLOCK = '# Uiensoep\nPorties: 6\n## Ingrediënten\n4 uien\n1 l bouillon\n## Bereiding\nSnipper de uien.\n\nKook 20 minuten.\n';
const EN_BLOCK = '# Onion soup\nServings: 6\n## Ingredients\n4 onions\n1 l stock\n## Method\nSlice the onions.\n\nSimmer for 20 minutes.\n';

describe('parseBilingualPlain', () => {
  it('carries category and tags per block', () => {
    const r = parseBilingualPlain(`=== NL ===\n# Soep\nCategorie: soep\nLabels: snel\n## Ingrediënten\n1 ui\n## Bereiding\nKook.\n=== EN ===\n# Soup\nCategory: Soup\nTags: quick\n## Ingredients\n1 onion\n## Method\nBoil.`);
    expect(r.mismatch).toBeUndefined();
    expect(r.nl?.category).toBe('soep');
    expect(r.en?.category).toBe('soep');
    expect(r.nl?.tags).toEqual(['snel']);
    expect(r.en?.tags).toEqual(['snel']);
  });

  it('reads two blocks', () => {
    const r = parseBilingualPlain(`=== NL ===\n${NL_BLOCK}\n=== EN ===\n${EN_BLOCK}`);
    expect(r.mismatch).toBeUndefined();
    expect(r.first).toBe('nl');
    expect(r.nl).toEqual({ name: 'Uiensoep', servings: 6, lines: ['4 uien', '1 l bouillon'], steps: ['Snipper de uien.', 'Kook 20 minuten.'] });
    expect(r.en).toEqual({ name: 'Onion soup', servings: 6, lines: ['4 onions', '1 l stock'], steps: ['Slice the onions.', 'Simmer for 20 minutes.'] });
  });

  it('reads a single Dutch block without markers', () => {
    const r = parseBilingualPlain(NL_BLOCK);
    expect(r.en).toBeUndefined();
    expect(r.first).toBe('nl');
    expect(r.nl?.name).toBe('Uiensoep');
    expect(r.nl?.lines).toEqual(['4 uien', '1 l bouillon']);
  });

  it('reads a single English block without markers (language from the headers)', () => {
    const r = parseBilingualPlain(EN_BLOCK);
    expect(r.nl).toBeUndefined();
    expect(r.first).toBe('en');
    expect(r.en?.name).toBe('Onion soup');
    expect(r.en?.steps).toEqual(['Slice the onions.', 'Simmer for 20 minutes.']);
  });

  it('returns both blocks plus the mismatch when the counts differ', () => {
    const en = '# Onion soup\n## Ingredients\n4 onions\n1 l stock\n2 tbsp butter\n## Method\nSlice the onions. Simmer for 20 minutes.\n';
    const r = parseBilingualPlain(`=== NL ===\n${NL_BLOCK}\n=== EN ===\n${en}`);
    expect(r.nl?.lines).toHaveLength(2);
    expect(r.en?.lines).toHaveLength(3);
    expect(r.mismatch).toEqual({ lines: [2, 3], steps: [2, 1] });
    expect(r.first).toBe('nl');
  });

  it('ignores prose around the blocks and tolerates decorated markers', () => {
    const text = `Here is the recipe in both languages:\n\n**=== NL ===**\n${NL_BLOCK}\n### === EN ===\n${EN_BLOCK}\n---\nLet me know if you want any changes!\n`;
    const r = parseBilingualPlain(text);
    expect(r.mismatch).toBeUndefined();
    expect(r.nl?.name).toBe('Uiensoep');
    expect(r.en?.name).toBe('Onion soup');
    expect(r.en?.steps).toEqual(['Slice the onions.', 'Simmer for 20 minutes.']);
    // Chatter before a single block never becomes the name when a "# Name" line follows.
    const single = parseBilingualPlain('Sure! Here it is:\n\n```\n' + EN_BLOCK + '```\n');
    expect(single.en?.name).toBe('Onion soup');
    expect(single.en?.lines).toEqual(['4 onions', '1 l stock']);
  });

  it('accepts the marker forms assistants make of "=== NL ===", but not a bare Dutch "en"', () => {
    const r = parseBilingualPlain(`## Nederlands\n${NL_BLOCK}\n**English:**\n${EN_BLOCK}`);
    expect(r.mismatch).toBeUndefined();
    expect(r.nl?.name).toBe('Uiensoep');
    expect(r.en?.name).toBe('Onion soup');
    const paren = parseBilingualPlain(`(NL)\n${NL_BLOCK}\n(EN)\n${EN_BLOCK}`);
    expect(paren.nl?.lines).toEqual(['4 uien', '1 l bouillon']);
    expect(paren.en?.lines).toEqual(['4 onions', '1 l stock']);
    // A step that is only the word "en" (Dutch "and") does not start an English block.
    const odd = parseBilingualPlain(`=== NL ===\n# Soep\n## Bereiding\nRoer\n\nen\n\nproef.\n`);
    expect(odd.en).toBeUndefined();
    expect(odd.nl?.steps).toEqual(['Roer', 'en', 'proef.']);
  });

  it('returns nothing for text without a recipe', () => {
    expect(parseBilingualPlain('')).toEqual({});
    expect(parseBilingualPlain('=== NL ===\n\n=== EN ===\n')).toEqual({});
  });
});
