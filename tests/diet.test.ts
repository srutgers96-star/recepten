// dietTags / applyDietTags / suggestMeta (docs/phase-5-spec.md A.2): facts from the dictionary
// flags over a fixture, and the category/tag heuristics over the real 196.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultDictionary, defaultDictionaryData } from '../src/domain/data';
import { loadDictionary, type Ingredient } from '../src/domain/dictionary';
import { applyDietTags, dietTags, isQuick, suggestCategory, suggestMeta } from '../src/domain/diet';
import type { Line, Recipe } from '../src/domain/model';
import { parseLine } from '../src/domain/parser';
import type { RecipesFile } from '../tools/migrate-from-recepten2.ts';

function ing(id: string, nl: string, en: string, extra: Partial<Ingredient> = {}): Ingredient {
  return { id, nl: { one: nl }, en: { one: en }, aisle: 'overig', defaultUnit: 'stuk', staple: false, veg: true, ...extra };
}

/** A dictionary with the phase-5 flags on every entry except `mysterieuze-saus` (a not-yet-flagged entry). */
const FLAGGED: Ingredient[] = [
  ing('ui', 'ui', 'onion', { vegan: true, gluten: false }),
  ing('kip', 'kip', 'chicken', { aisle: 'vlees-vis', veg: false, vegan: false, gluten: false }),
  ing('zalm', 'zalm', 'salmon', { aisle: 'vlees-vis', veg: false, vegan: false, gluten: false, defaultUnit: 'g' }),
  ing('spaghetti', 'spaghetti', 'spaghetti', { aisle: 'droog', defaultUnit: 'g', vegan: true, gluten: true }),
  ing('kaas', 'kaas', 'cheese', { aisle: 'kaas', defaultUnit: 'g', vegan: false, gluten: false }),
  ing('rijst', 'rijst', 'rice', { aisle: 'droog', defaultUnit: 'g', vegan: true, gluten: false }),
  ing('bouillonblokje', 'bouillonblokje', 'stock cube', { vegan: true, gluten: false, glutenUnsure: true }),
  ing('olijfolie', 'olijfolie', 'olive oil', { defaultUnit: 'el', staple: true, vegan: true, gluten: false }),
  ing('mysterieuze-saus', 'mysterieuze saus', 'mystery sauce', { defaultUnit: 'el' }),
];
const dict = loadDictionary({ ...defaultDictionaryData(), ingredients: FLAGGED });
const lines = (...raw: string[]): Line[] => raw.map((r) => parseLine(r, dict, 'nl'));

describe('dietTags', () => {
  it('reads the three facts from the flags', () => {
    const d = dietTags(lines('1 ui', '200 g spaghetti', '50 g kaas'), dict);
    expect(d).toEqual({ vegetarisch: true, vegan: false, glutenvrij: false, unsure: [], unresolved: [] });
  });

  it('is sure when every ingredient is flagged, unsure for a glutenUnsure entry', () => {
    const d = dietTags(lines('1 ui', '200 g rijst', '1 bouillonblokje', '2 el olijfolie'), dict);
    expect(d.vegetarisch).toBe(true);
    expect(d.vegan).toBe(true);
    expect(d.glutenvrij).toBe(true);
    expect(d.unsure).toEqual(['glutenvrij']);
    expect(d.unresolved).toEqual([]);
  });

  it('a contradiction is a fact; an unresolved line makes the rest unsure and is listed', () => {
    const d = dietTags(lines('300 g kip', '1 ui', '1 exotische vrucht'), dict);
    expect(d.vegetarisch).toBe(false);
    expect(d.vegan).toBe(false);
    expect(d.glutenvrij).toBe(true);
    expect(d.unsure).toEqual(['glutenvrij']);
    expect(d.unresolved).toEqual(['exotische vrucht']);
  });

  it('treats a missing vegan/gluten flag as unsure, not as a fact', () => {
    const d = dietTags(lines('1 ui', '2 el mysterieuze saus'), dict);
    expect(d.vegetarisch).toBe(true);
    expect(d.vegan).toBe(true);
    expect(d.glutenvrij).toBe(true);
    expect(d.unsure).toEqual(['vegan', 'glutenvrij']);
    expect(d.unresolved).toEqual([]);
  });

  it('ignores headers, judges nothing on an empty list, and counts an unknown id as unresolved', () => {
    expect(dietTags(lines('Dressing:'), dict)).toEqual({ unsure: [], unresolved: [] });
    expect(dietTags([], dict)).toEqual({ unsure: [], unresolved: [] });
    const foreign: Line = { raw: { nl: '2 gerookte makreelfilets' }, ing: 'gerookte-makreel-2', name: 'gerookte makreelfilets' };
    const d = dietTags([foreign], dict);
    expect(d.vegetarisch).toBeUndefined();
    expect(d.unsure).toEqual(['vegetarisch', 'vegan', 'glutenvrij']);
    expect(d.unresolved).toEqual(['gerookte makreelfilets']);
  });
});

describe('applyDietTags', () => {
  it('removes a contradicted tag, keeps -optie and other tags, appends sure ones once', () => {
    // kip and ui are both gluten-free facts, so 'glutenvrij' is appended while 'vegetarisch' goes.
    expect(applyDietTags({ lines: lines('300 g kip', '1 ui'), tags: ['vegetarisch', 'vega-optie', 'snel'] }, dict)).toEqual(['vega-optie', 'snel', 'glutenvrij']);
    expect(applyDietTags({ lines: lines('300 g kip', '200 g spaghetti'), tags: ['vegetarisch', 'glutenvrij', 'kids'] }, dict)).toEqual(['kids']);
    expect(applyDietTags({ lines: lines('1 ui', '200 g rijst'), tags: ['snel', 'vegetarisch'] }, dict)).toEqual(['snel', 'vegetarisch', 'vegan', 'glutenvrij']);
  });

  it('leaves an unsure dimension as it was', () => {
    const l = lines('1 ui', '2 el mysterieuze saus');
    expect(applyDietTags({ lines: l, tags: ['glutenvrij'] }, dict)).toEqual(['glutenvrij', 'vegetarisch']);
    expect(applyDietTags({ lines: l, tags: [] }, dict)).toEqual(['vegetarisch']);
  });
});

describe('isQuick', () => {
  it('uses time.total when known, else at most three short steps', () => {
    const step = (text: string) => ({ text: { nl: text } });
    expect(isQuick({ time: { total: 20 }, steps: [] })).toBe(true);
    expect(isQuick({ time: { total: 45 }, steps: [step('Roer.')] })).toBe(false);
    expect(isQuick({ steps: [step('Snipper de ui.'), step('Bak 5 minuten.')] })).toBe(true);
    expect(isQuick({ steps: [step('a'), step('b'), step('c'), step('d')] })).toBe(false);
    expect(isQuick({ steps: [step('x'.repeat(500))] })).toBe(false);
  });
});

// --- the real 196 ----------------------------------------------------------------------------

const real = defaultDictionary();
const file = JSON.parse(readFileSync(new URL('../data/recipes.json', import.meta.url), 'utf8')) as RecipesFile;
const byName = (name: string): Recipe => {
  const r = file.recipes.find((x) => x.name.nl === name);
  if (!r) throw new Error(`no recipe "${name}"`);
  return r;
};

describe('suggestMeta over the real recipes', () => {
  it('finds the category from the name or the ingredients', () => {
    const cases: [string, string][] = [
      ['Erwtensoep', 'soep'],
      ['Griekse salade', 'salade'],
      ['Quiche Lorraine', 'hartige-taart'],
      ['Hutspot', 'stamppot'],
      ['Noodles', 'wok-noedels'],
      ['Spaghetti Bolognese', 'pasta'],
      ['Kabeljauw met notencrumble', 'vis'],
      ['Hongaarse goulash', 'vlees'],
      ['Kipkerrie met rijst', 'rijst'],
      ['Aardappel-broccoli gratin', 'oven'],
      ['Roergebakken rijst met prei en cashewnoten', 'rijst'],
      // "puree" in the name is not a stamppot: the side dish follows the fish in its name.
      ['Aardappelpuree (bij kabeljauw met notencrumble)', 'vis'],
    ];
    for (const [name, category] of cases) expect(suggestCategory(byName(name), real), name).toBe(category);
    expect(suggestCategory(byName('Ratatouille'), real)).toBeUndefined();
  });

  it('agrees with the LLM category on at least three quarters of the classics', () => {
    let agree = 0;
    for (const r of file.recipes) if (suggestMeta(r, real).category === r.category) agree++;
    expect(agree / file.recipes.length).toBeGreaterThan(0.75);
  });

  it('suggests diet, snel, oven and wok tags', () => {
    const gratin = suggestMeta(byName('Aardappel-broccoli gratin'), real);
    expect(gratin.category).toBe('oven');
    expect(gratin.tags).toContain('vegetarisch');
    expect(gratin.tags).toContain('oven');
    expect(gratin.tags).not.toContain('snel');
    const salad = suggestMeta(byName('Griekse salade'), real);
    expect(salad.tags).toContain('snel');
    expect(salad.tags).toContain('vegetarisch');
    const wok = suggestMeta(byName('Roergebakken tofu met paksoi'), real);
    expect(wok.tags).toContain('wok');
    const goulash = suggestMeta(byName('Hongaarse goulash'), real);
    expect(goulash.tags).not.toContain('vegetarisch');
    expect(goulash.tags).not.toContain('vegan');
  });

  it('never suggests a tag the LLM has and the recipe disproves: every LLM vegetarisch is a fact', () => {
    for (const r of file.recipes) {
      if (!r.tags.includes('vegetarisch')) continue;
      expect(dietTags(r.lines, real).vegetarisch, r.name.nl).toBe(true);
    }
  });
});
