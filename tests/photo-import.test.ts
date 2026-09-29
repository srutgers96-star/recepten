// buildImportPrompt / parsePlainRecipe (docs/phase-2-spec.md §5 "Foto-import").
import { describe, expect, it } from 'vitest';
import { buildImportPrompt, parsePlainRecipe } from '../src/domain/photo-import';

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

  it('returns null for text without a recipe', () => {
    expect(parsePlainRecipe('')).toBeNull();
    expect(parsePlainRecipe('   \n\n')).toBeNull();
    expect(parsePlainRecipe('## Ingrediënten\n\n## Bereiding\n')).toBeNull();
  });
});
