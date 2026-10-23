// tools/validate-data.ts (docs/specs/labels-categorieen.md §6a): the lactose rules of the dictionary
// (blok 1), the cuisines (data/cuisines.json, blok 3), `cuisine` on a schema-2 recipe, the lactose-free
// swaps and the lactosevrij badge rule. Pure validator calls on small inputs, plus the real files.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Cuisine, DictionaryData, Ingredient } from '../src/domain/dictionary';
import { readDictionaryData } from '../tools/build-dictionary-seed.ts';
import { refsFromData, validateBadges, validateDictionary, validateSchema2, validateSwaps } from '../tools/validate-data.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REAL: DictionaryData = readDictionaryData(ROOT);

function ing(id: string, flags: Partial<Ingredient> = {}): Ingredient {
  return { id, nl: { one: id }, en: { one: `${id} (en)` }, aisle: 'overig', defaultUnit: 'stuk', staple: false, veg: true, vegan: false, gluten: false, lactose: false, ...flags };
}

/** A tiny, valid dictionary: the real vocab files with a handful of ingredients. */
function data(ingredients: Ingredient[], cuisines?: unknown[]): DictionaryData {
  const d: DictionaryData = { ...REAL, ingredients };
  if (cuisines !== undefined) d.cuisines = cuisines as Cuisine[];
  return d;
}

const ITALIAANS: Cuisine = { id: 'italiaans', nl: 'Italiaans', en: 'Italian', flag: '🇮🇹', order: 2 };
const HOLLANDS: Cuisine = { id: 'hollands', nl: 'Hollands', en: 'Dutch', flag: '🇳🇱', order: 1 };

describe('validateDictionary: lactose (labels-categorieen.md §2a)', () => {
  it('a fully flagged set is fine', () => {
    const r = validateDictionary(data([ing('kaas', { lactose: true }), ing('ui', { vegan: true }), ing('margarine', { lactoseUnsure: true })]));
    expect(r.errors).toEqual([]);
  });

  it('a half-flagged set is an error that counts both sides', () => {
    const half = [ing('kaas', { lactose: true }), ing('ui'), ing('rijst')];
    delete half[1]!.lactose;
    delete half[2]!.lactose;
    const r = validateDictionary(data(half));
    expect(r.errors.some((e) => e.includes('"lactose" is set on 1 entries but missing on 2'))).toBe(true);
  });

  it('vegan with lactose, vegan unsure about lactose, lactoseUnsure without lactose and lactose true + unsure are errors', () => {
    const veganLactose = validateDictionary(data([ing('sojakaas', { vegan: true, lactose: true })]));
    expect(veganLactose.errors.some((e) => e.includes('a plant-based product cannot contain lactose'))).toBe(true);
    const veganUnsure = validateDictionary(data([ing('chips', { vegan: true, lactoseUnsure: true })]));
    expect(veganUnsure.errors.some((e) => e.includes('a plant-based product is never unsure about lactose'))).toBe(true);
    const noFlag = ing('worst', { lactoseUnsure: true });
    delete noFlag.lactose;
    const unsureAlone = validateDictionary(data([noFlag, ing('ui')]));
    expect(unsureAlone.errors.some((e) => e.includes('"lactoseUnsure" needs a "lactose" flag'))).toBe(true);
    const trueUnsure = validateDictionary(data([ing('room', { lactose: true, lactoseUnsure: true })]));
    expect(trueUnsure.errors.some((e) => e.includes('drop lactoseUnsure or use lactose: false, lactoseUnsure: true'))).toBe(true);
  });
});

describe('validateDictionary: cuisines (labels-categorieen.md §2c)', () => {
  it('accepts valid cuisines and data without any (older callers)', () => {
    expect(validateDictionary(data([ing('ui')], [HOLLANDS, ITALIAANS])).errors).toEqual([]);
    expect(validateDictionary(data([ing('ui')])).errors).toEqual([]);
  });

  it('a duplicate id, a missing flag, a missing en, a missing order or a bad id are errors', () => {
    const dup = validateDictionary(data([ing('ui')], [ITALIAANS, { ...ITALIAANS, nl: 'Nog eens' }]));
    expect(dup.errors).toContain('cuisines.json: duplicate id "italiaans".');
    const noFlag = validateDictionary(data([ing('ui')], [{ ...ITALIAANS, flag: '' }]));
    expect(noFlag.errors).toContain('cuisines.json "italiaans": "flag" must be a non-empty string.');
    const { flag: _flag, ...withoutFlag } = ITALIAANS;
    expect(validateDictionary(data([ing('ui')], [withoutFlag])).errors).toContain('cuisines.json "italiaans": "flag" must be a non-empty string.');
    const { en: _en, ...withoutEn } = ITALIAANS;
    expect(validateDictionary(data([ing('ui')], [withoutEn])).errors).toContain('cuisines.json "italiaans": "en" must be a non-empty string.');
    const { order: _order, ...withoutOrder } = ITALIAANS;
    expect(validateDictionary(data([ing('ui')], [withoutOrder])).errors).toContain('cuisines.json "italiaans": "order" must be a number.');
    expect(validateDictionary(data([ing('ui')], [{ ...ITALIAANS, id: 'Italiaans' }])).errors.some((e) => e.startsWith('cuisines.json[0]: "id" must be a slug'))).toBe(true);
  });

  it('the real data/cuisines.json: the 18 cuisines of §2c, valid, in order 1–18', () => {
    const cuisines = REAL.cuisines ?? [];
    expect(cuisines.map((c) => c.id)).toEqual([
      'hollands', 'italiaans', 'frans', 'spaans', 'portugees', 'grieks', 'hongaars', 'brits', 'midden-oosten',
      'marokkaans', 'indiaas', 'thais', 'chinees', 'japans', 'indonesisch', 'surinaams', 'mexicaans', 'amerikaans',
    ]);
    expect(cuisines.map((c) => c.order)).toEqual(Array.from({ length: 18 }, (_v, i) => i + 1));
    expect(validateDictionary(REAL).errors).toEqual([]);
    expect(refsFromData(REAL).cuisines.size).toBe(18);
    // Without cuisine data the ref set is empty (not undefined).
    expect(refsFromData({ ...REAL, cuisines: undefined }).cuisines.size).toBe(0);
  });
});

describe('validateSchema2: cuisine and category (labels-categorieen.md §2c/§2d)', () => {
  const refs = refsFromData(REAL);
  const file = (over: Record<string, unknown>) => ({
    schema: 2,
    dataVersion: 6,
    generatedAt: '2026-10-23T00:00:00.000Z',
    recipes: [
      {
        schema: 2,
        id: 'b:test',
        rev: 1,
        createdAt: '2025-12-01T00:00:00.000Z',
        updatedAt: '2025-12-01T00:00:00.000Z',
        origin: { kind: 'builtin' },
        name: { nl: 'Test' },
        tags: [],
        servings: 4,
        lines: [{ raw: { nl: '1 ui' }, ing: 'ui' }],
        steps: [{ text: { nl: 'Kook.' } }],
        goesWith: [],
        aliases: [],
        ...over,
      },
    ],
  });

  it('cuisine: a known id, null or absent is fine', () => {
    expect(validateSchema2(file({ cuisine: 'italiaans' }), refs).errors).toEqual([]);
    expect(validateSchema2(file({ cuisine: null }), refs).errors).toEqual([]);
    expect(validateSchema2(file({}), refs).errors).toEqual([]);
  });

  it('cuisine: an unknown id, an empty string or a non-string is an error', () => {
    expect(validateSchema2(file({ cuisine: 'mars' }), refs).errors).toEqual(['"b:test": cuisine "mars" does not exist.']);
    expect(validateSchema2(file({ cuisine: '' }), refs).errors).toEqual(['"b:test": "cuisine" must be null or a cuisine id.']);
    expect(validateSchema2(file({ cuisine: ['italiaans'] }), refs).errors).toEqual(['"b:test": "cuisine" must be null or a cuisine id.']);
    // Without refs only the shape is checked.
    expect(validateSchema2(file({ cuisine: 'mars' })).errors).toEqual([]);
  });

  it("category 'bijgerecht' (and the other three of blok 4, §2d) is fine; an unknown category is not", () => {
    expect(refs.categories.has('bijgerecht')).toBe(true);
    expect(validateSchema2(file({ category: 'bijgerecht' }), refs).errors).toEqual([]);
    for (const c of ['nagerecht', 'gebak', 'ontbijt-lunch']) expect(validateSchema2(file({ category: c }), refs).errors).toEqual([]);
    expect(validateSchema2(file({ category: 'pasta' }), refs).errors).toEqual([]);
    expect(validateSchema2(file({ category: 'toetje' }), refs).errors).toEqual(['"b:test": category "toetje" does not exist.']);
  });

  it('the committed data/recipes.json passes with the cuisines', () => {
    const committed: unknown = JSON.parse(readFileSync(new URL('../data/recipes.json', import.meta.url), 'utf8'));
    expect(validateSchema2(committed, refs).errors).toEqual([]);
  });
});

describe('validateSwaps: lactosevrij (labels-categorieen.md §2b)', () => {
  const ings = [ing('boter', { lactose: true, veg: true }), ing('vegan-boter', { vegan: true }), ing('margarine', { lactoseUnsure: true }), ing('room', { lactose: true })] as unknown as Record<string, unknown>[];

  it('a lactose-free swap whose "to" has lactose is an error', () => {
    const r = validateSwaps([{ from: 'boter', to: 'room', diets: ['lactosevrij'] }], ings);
    expect(r.errors).toEqual(['swaps.json "boter" -> "room": "to" must have "lactose": false for a lactosevrij swap (has true).']);
  });

  it('a "to" that is only probably lactose-free gives a warning, not an error', () => {
    const r = validateSwaps([{ from: 'boter', to: 'margarine', diets: ['lactosevrij'] }], ings);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('only probably lactose-free (lactoseUnsure)'))).toBe(true);
  });

  it('a valid lactose-free swap passes, and the real swaps.json passes', () => {
    expect(validateSwaps([{ from: 'boter', to: 'vegan-boter', diets: ['lactosevrij'] }], ings).errors).toEqual([]);
    const real: unknown = JSON.parse(readFileSync(new URL('../data/swaps.json', import.meta.url), 'utf8'));
    expect(validateSwaps(real, REAL.ingredients as unknown as Record<string, unknown>[]).errors).toEqual([]);
  });
});

describe('validateBadges: the lactosevrij tag rule', () => {
  const refs = refsFromData(REAL);
  const badge = (rule: Record<string, unknown>) => [
    { id: 'zuivelvrije-ziel', nl: { name: 'Zuivelvrije ziel', description: 'Kook 5 lactosevrije recepten' }, en: { name: 'Dairy-free soul', description: 'Cook 5 lactose-free recipes' }, icon: '🥥', rule, tier: 1 },
  ];

  it("rule { kind: 'tag', id: 'lactosevrij' } is fine; an unknown tag is not", () => {
    expect(validateBadges(badge({ kind: 'tag', id: 'lactosevrij', n: 5 }), refs).errors).toEqual([]);
    expect(validateBadges(badge({ kind: 'tag', id: 'zuivelloos', n: 5 }), refs).errors).toEqual(['badges.json "zuivelvrije-ziel": rule.id "zuivelloos" is not a known tag id.']);
  });

  it('the real badges.json passes', () => {
    const real: unknown = JSON.parse(readFileSync(new URL('../data/badges.json', import.meta.url), 'utf8'));
    expect(validateBadges(real, refs).errors).toEqual([]);
  });
});
