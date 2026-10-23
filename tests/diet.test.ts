// dietTags / applyDietTags / suggestMeta (docs/phase-5-spec.md A.2): facts from the dictionary
// flags over a fixture, and the category/tag heuristics over the real 196. Lactosevrij (the fourth
// diet, docs/specs/labels-categorieen.md §2b / §6a): the same rules over `lactose` / `lactoseUnsure`.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultDictionary, defaultDictionaryData } from '../src/domain/data';
import { loadDictionary, type Ingredient } from '../src/domain/dictionary';
import { DIET_TAGS, applyDietTags, dietTags, isQuick, suggestCategory, suggestMeta } from '../src/domain/diet';
import type { Line, Recipe } from '../src/domain/model';
import { parseLine } from '../src/domain/parser';
import { BUILTIN_TIMESTAMP, type RecipesFile } from '../tools/migrate-from-recepten2.ts';

function ing(id: string, nl: string, en: string, extra: Partial<Ingredient> = {}): Ingredient {
  return { id, nl: { one: nl }, en: { one: en }, aisle: 'overig', defaultUnit: 'stuk', staple: false, veg: true, ...extra };
}

/**
 * A dictionary with the phase-5 flags and the lactose flag (the rule sheet of
 * docs/specs/labels-categorieen.md §2a) on every entry except `mysterieuze-saus` (a not-yet-flagged
 * entry). `bouillonblokje` is vegan, so rule H1 makes it `lactose: false` WITHOUT unsure; the
 * "probably" case is `worst` (vegan false, lactoseUnsure).
 */
const FLAGGED: Ingredient[] = [
  ing('ui', 'ui', 'onion', { vegan: true, gluten: false, lactose: false }),
  ing('kip', 'kip', 'chicken', { aisle: 'vlees-vis', veg: false, vegan: false, gluten: false, lactose: false }),
  ing('zalm', 'zalm', 'salmon', { aisle: 'vlees-vis', veg: false, vegan: false, gluten: false, lactose: false, defaultUnit: 'g' }),
  ing('spaghetti', 'spaghetti', 'spaghetti', { aisle: 'droog', defaultUnit: 'g', vegan: true, gluten: true, lactose: false }),
  ing('kaas', 'kaas', 'cheese', { aisle: 'kaas', defaultUnit: 'g', vegan: false, gluten: false, lactose: true }),
  ing('rijst', 'rijst', 'rice', { aisle: 'droog', defaultUnit: 'g', vegan: true, gluten: false, lactose: false }),
  ing('bouillonblokje', 'bouillonblokje', 'stock cube', { vegan: true, gluten: false, glutenUnsure: true, lactose: false }),
  ing('olijfolie', 'olijfolie', 'olive oil', { defaultUnit: 'el', staple: true, vegan: true, gluten: false, lactose: false }),
  ing('mysterieuze-saus', 'mysterieuze saus', 'mystery sauce', { defaultUnit: 'el' }),
  ing('room', 'room', 'cream', { aisle: 'zuivel', defaultUnit: 'ml', vegan: false, gluten: false, lactose: true }),
  ing('worst', 'worst', 'sausage', { aisle: 'vlees-vis', veg: false, vegan: false, gluten: false, lactose: false, lactoseUnsure: true }),
];
const dict = loadDictionary({ ...defaultDictionaryData(), ingredients: FLAGGED });
const lines = (...raw: string[]): Line[] => raw.map((r) => parseLine(r, dict, 'nl'));

describe('DIET_TAGS', () => {
  it('has the four diets in the chip order of the UI', () => {
    expect(DIET_TAGS).toEqual(['vegetarisch', 'vegan', 'glutenvrij', 'lactosevrij']);
  });
});

describe('dietTags', () => {
  it('reads the four facts from the flags', () => {
    const d = dietTags(lines('1 ui', '200 g spaghetti', '50 g kaas'), dict);
    expect(d).toEqual({ vegetarisch: true, vegan: false, glutenvrij: false, lactosevrij: false, unsure: [], unresolved: [] });
  });

  it('is sure when every ingredient is flagged, unsure for a glutenUnsure entry', () => {
    const d = dietTags(lines('1 ui', '200 g rijst', '1 bouillonblokje', '2 el olijfolie'), dict);
    expect(d.vegetarisch).toBe(true);
    expect(d.vegan).toBe(true);
    expect(d.glutenvrij).toBe(true);
    // the stock cube is vegan, so it is lactose-free for sure (rule H1); only gluten is a guess
    expect(d.lactosevrij).toBe(true);
    expect(d.unsure).toEqual(['glutenvrij']);
    expect(d.unresolved).toEqual([]);
  });

  it('a contradiction is a fact; an unresolved line makes the rest unsure and is listed', () => {
    const d = dietTags(lines('300 g kip', '1 ui', '1 exotische vrucht'), dict);
    expect(d.vegetarisch).toBe(false);
    expect(d.vegan).toBe(false);
    expect(d.glutenvrij).toBe(true);
    expect(d.lactosevrij).toBe(true);
    expect(d.unsure).toEqual(['glutenvrij', 'lactosevrij']);
    expect(d.unresolved).toEqual(['exotische vrucht']);
  });

  it('treats a missing vegan/gluten/lactose flag as unsure, not as a fact', () => {
    const d = dietTags(lines('1 ui', '2 el mysterieuze saus'), dict);
    expect(d.vegetarisch).toBe(true);
    expect(d.vegan).toBe(true);
    expect(d.glutenvrij).toBe(true);
    expect(d.lactosevrij).toBe(true);
    expect(d.unsure).toEqual(['vegan', 'glutenvrij', 'lactosevrij']);
    expect(d.unresolved).toEqual([]);
  });

  it('lactosevrij: sure without dairy, false with it, probable for lactoseUnsure or a missing flag', () => {
    expect(dietTags(lines('1 ui', '200 g rijst'), dict)).toMatchObject({ lactosevrij: true, unsure: [] });
    const cheese = dietTags(lines('50 g kaas'), dict);
    expect(cheese.lactosevrij).toBe(false);
    expect(cheese.unsure).not.toContain('lactosevrij');
    const sausage = dietTags(lines('100 g worst'), dict);
    expect(sausage.lactosevrij).toBe(true);
    expect(sausage.unsure).toEqual(['lactosevrij']);
    const mystery = dietTags(lines('2 el mysterieuze saus'), dict);
    expect(mystery.lactosevrij).toBe(true);
    expect(mystery.unsure).toContain('lactosevrij');
    // a contradiction wins over a probable line
    expect(dietTags(lines('100 g worst', '200 ml room'), dict)).toMatchObject({ lactosevrij: false, unsure: [] });
  });

  it('a "plantaardige" qualifier makes the line plant-based; "vegetarische" makes it vegetarian with vegan unknown', () => {
    expect(dietTags(lines('200 ml room'), dict)).toMatchObject({ vegetarisch: true, vegan: false, lactosevrij: false, unsure: [] });
    const plant = lines('200 ml plantaardige room');
    expect(plant[0]).toMatchObject({ ing: 'room', qual: ['plantaardige'] });
    // plant-based cream is lactose-free too (DIET_QUALIFIERS.plantaardige: lactose false)
    expect(dietTags(plant, dict)).toEqual({ vegetarisch: true, vegan: true, glutenvrij: true, lactosevrij: true, unsure: [], unresolved: [] });
    expect(dietTags(lines('1 ui', '200 ml plantaardige room', '50 g kaas'), dict)).toMatchObject({ vegetarisch: true, vegan: false, lactosevrij: false });

    expect(dietTags(lines('2 worsten'), dict)).toMatchObject({ vegetarisch: false, vegan: false });
    const veggie = lines('2 vegetarische worsten');
    expect(veggie[0]).toMatchObject({ ing: 'worst', qual: ['vegetarische'] });
    // "vegetarische" says nothing about lactose: the sausage's lactoseUnsure stays
    expect(dietTags(veggie, dict)).toEqual({ vegetarisch: true, vegan: true, glutenvrij: true, lactosevrij: true, unsure: ['vegan', 'lactosevrij'], unresolved: [] });
    // "plantaardige worst" is plant-based, so lactose-free for sure (rule H1)
    const plantSausage = lines('2 plantaardige worsten');
    expect(plantSausage[0]).toMatchObject({ ing: 'worst', qual: ['plantaardige'] });
    expect(dietTags(plantSausage, dict)).toMatchObject({ vegan: true, lactosevrij: true, unsure: [] });
    // The category heuristics see the adjusted flags too: a plant-based "kip" is not a meat dish.
    expect(suggestCategory({ name: { nl: 'Avondeten' }, lines: lines('300 g kip') }, dict)).toBe('vlees');
    expect(suggestCategory({ name: { nl: 'Avondeten' }, lines: lines('300 g plantaardige kip') }, dict)).toBeUndefined();
  });

  it('ignores headers, judges nothing on an empty list, and counts an unknown id as unresolved', () => {
    expect(dietTags(lines('Dressing:'), dict)).toEqual({ unsure: [], unresolved: [] });
    expect(dietTags([], dict)).toEqual({ unsure: [], unresolved: [] });
    const foreign: Line = { raw: { nl: '2 gerookte makreelfilets' }, ing: 'gerookte-makreel-2', name: 'gerookte makreelfilets' };
    const d = dietTags([foreign], dict);
    expect(d.vegetarisch).toBeUndefined();
    expect(d.unsure).toEqual(['vegetarisch', 'vegan', 'glutenvrij', 'lactosevrij']);
    expect(d.unresolved).toEqual(['gerookte makreelfilets']);
  });
});

describe('applyDietTags', () => {
  it('removes a contradicted tag, keeps -optie and other tags, appends sure ones once', () => {
    // kip and ui are both gluten-free and lactose-free facts, so 'glutenvrij' and 'lactosevrij' are
    // appended while 'vegetarisch' goes.
    expect(applyDietTags({ lines: lines('300 g kip', '1 ui'), tags: ['vegetarisch', 'vega-optie', 'snel'] }, dict)).toEqual(['vega-optie', 'snel', 'glutenvrij', 'lactosevrij']);
    expect(applyDietTags({ lines: lines('300 g kip', '200 g spaghetti'), tags: ['vegetarisch', 'glutenvrij', 'kids'] }, dict)).toEqual(['kids', 'lactosevrij']);
    expect(applyDietTags({ lines: lines('1 ui', '200 g rijst'), tags: ['snel', 'vegetarisch'] }, dict)).toEqual(['snel', 'vegetarisch', 'vegan', 'glutenvrij', 'lactosevrij']);
  });

  it('adds lactosevrij on sure facts, removes it on a contradiction, keeps lactosevrij-optie', () => {
    expect(applyDietTags({ lines: lines('1 ui', '200 g rijst'), tags: [] }, dict)).toContain('lactosevrij');
    expect(applyDietTags({ lines: lines('1 ui', '50 g kaas'), tags: ['lactosevrij', 'lactosevrij-optie'] }, dict)).toEqual(['lactosevrij-optie', 'vegetarisch', 'glutenvrij']);
    // probable (a sausage that may hold milk): never added, but a hand-set tag stays
    expect(applyDietTags({ lines: lines('100 g worst'), tags: [] }, dict)).not.toContain('lactosevrij');
    expect(applyDietTags({ lines: lines('100 g worst'), tags: ['lactosevrij'] }, dict)).toContain('lactosevrij');
  });

  it('leaves an unsure dimension as it was', () => {
    const l = lines('1 ui', '2 el mysterieuze saus');
    expect(applyDietTags({ lines: l, tags: ['glutenvrij'] }, dict)).toEqual(['glutenvrij', 'vegetarisch']);
    expect(applyDietTags({ lines: l, tags: [] }, dict)).toEqual(['vegetarisch']);
    expect(applyDietTags({ lines: l, tags: ['lactosevrij'] }, dict)).toEqual(['lactosevrij', 'vegetarisch']);
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

  it('suggests lactosevrij only for recipes without a dairy line', () => {
    expect(suggestMeta(byName('Ratatouille'), real).tags).toContain('lactosevrij');
    expect(suggestMeta(byName('Kaastaart'), real).tags).not.toContain('lactosevrij');
  });

  it('never suggests a tag the LLM has and the recipe disproves: every LLM vegetarisch is a fact', () => {
    for (const r of file.recipes) {
      if (!r.tags.includes('vegetarisch')) continue;
      expect(dietTags(r.lines, real).vegetarisch, r.name.nl).toBe(true);
    }
  });
});

describe('lactosevrij over the real 196 (data/recipes.json after npm run migrate)', () => {
  const classics = file.recipes.filter((r) => r.createdAt === BUILTIN_TIMESTAMP);

  it('Ratatouille is lactose-free; Kaastaart and Tagliatelle Carbonara are not', () => {
    const ratatouille = dietTags(byName('Ratatouille').lines, real);
    expect(ratatouille.lactosevrij).toBe(true);
    expect(ratatouille.unsure).not.toContain('lactosevrij');
    expect(byName('Ratatouille').tags).toContain('lactosevrij');
    expect(dietTags(byName('Kaastaart').lines, real).lactosevrij).toBe(false);
    expect(byName('Kaastaart').tags).not.toContain('lactosevrij');
    expect(dietTags(byName('Tagliatelle Carbonara').lines, real).lactosevrij).toBe(false);
    expect(byName('Tagliatelle Carbonara').tags).not.toContain('lactosevrij');
  });

  it('at least 30 classics carry the tag, each one a sure fact; none has lactosevrij-optie', () => {
    const tagged = classics.filter((r) => r.tags.includes('lactosevrij'));
    expect(tagged.length).toBeGreaterThanOrEqual(30);
    for (const r of tagged) {
      const d = dietTags(r.lines, real);
      expect(d.lactosevrij, r.name.nl).toBe(true);
      expect(d.unsure, r.name.nl).not.toContain('lactosevrij');
    }
    // "lactosevrij-optie" is people's work (the chip exists for own recipes), never derived.
    expect(classics.filter((r) => r.tags.includes('lactosevrij-optie'))).toEqual([]);
  });
});
