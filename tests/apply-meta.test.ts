// tools/apply-meta.ts (docs/specs/labels-categorieen.md §2e, §6a): the hand-kept labels of the
// classics in data/review/meta.json (blok 3: the 71 cuisines of §2c; blok 4: the five side dishes
// in 'bijgerecht' and the goesWith of the polenta; docs/specs/bijgerechten.md: four of the 20 new side
// dishes get a cuisine too, 75 in all). `checkMeta` refuses unknown ids, `applyMeta`
// sets the fields and is idempotent, and `migrate()` replays the real file.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Recipe } from '../src/domain/model';
import { applyMeta, checkMeta, readMeta, type MetaReview } from '../tools/apply-meta.ts';
import { BUILTIN_TIMESTAMP, loadMigrationInputs, migrate, type RecipesFile } from '../tools/migrate-from-recepten2.ts';
import { refsFromData } from '../tools/validate-data.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCE: unknown = JSON.parse(readFileSync(new URL('../data/source/recipes-recepten2.json', import.meta.url), 'utf8'));
const inputs = loadMigrationInputs(ROOT);
const refs = refsFromData(inputs.dict.toData());

function recipe(id: string, over: Partial<Recipe> = {}): Recipe {
  return {
    schema: 2,
    id,
    rev: 1,
    createdAt: BUILTIN_TIMESTAMP,
    updatedAt: BUILTIN_TIMESTAMP,
    origin: { kind: 'builtin' },
    name: { nl: id },
    tags: [],
    servings: 4,
    lines: [],
    steps: [{ text: { nl: 'Kook.' } }],
    goesWith: [],
    aliases: [],
    category: 'pasta',
    text: { en: 'llm' },
    ...over,
  };
}

const RECIPES = [recipe('b:a'), recipe('b:b'), recipe('b:c', { category: 'overig' })];

describe('checkMeta', () => {
  it('accepts known recipe, category, cuisine and goesWith ids', () => {
    const meta: MetaReview = { category: { 'b:a': 'soep' }, goesWith: { 'b:b': ['b:a'] }, cuisine: { 'b:a': 'italiaans', 'b:c': 'hollands' } };
    expect(checkMeta(meta, RECIPES, refs)).toEqual([]);
    expect(checkMeta({}, RECIPES, refs)).toEqual([]);
  });

  it('knows the four categories of blok 4 (data/categories.json §2d)', () => {
    for (const c of ['nagerecht', 'gebak', 'bijgerecht', 'ontbijt-lunch']) expect(checkMeta({ category: { 'b:a': c } }, RECIPES, refs)).toEqual([]);
  });

  it('applies a side-dish category with its goesWith (the polenta case)', () => {
    const meta: MetaReview = { category: { 'b:c': 'bijgerecht' }, goesWith: { 'b:c': ['b:a'] } };
    expect(checkMeta(meta, RECIPES, refs)).toEqual([]);
    const { recipes, applied } = applyMeta(RECIPES, meta);
    expect(applied).toBe(2);
    expect(recipes[2]?.category).toBe('bijgerecht');
    expect(recipes[2]?.goesWith).toEqual(['b:a']);
    expect(recipes[0]).toBe(RECIPES[0]);
  });

  it('refuses an unknown recipe id, cuisine, category or goesWith id', () => {
    expect(checkMeta({ cuisine: { 'b:zz': 'italiaans' } }, RECIPES, refs)).toEqual(['cuisine: recipe id "b:zz" does not exist.']);
    expect(checkMeta({ cuisine: { 'b:a': 'zuid-afrikaans' } }, RECIPES, refs)).toEqual(['cuisine: b:a -> "zuid-afrikaans" is not a cuisine id.']);
    expect(checkMeta({ category: { 'b:a': 'toetje' } }, RECIPES, refs)).toEqual(['category: b:a -> "toetje" is not a category id.']);
    expect(checkMeta({ category: { 'b:zz': 'soep' } }, RECIPES, refs)).toEqual(['category: recipe id "b:zz" does not exist.']);
    expect(checkMeta({ goesWith: { 'b:a': ['b:zz'] } }, RECIPES, refs)).toEqual(['goesWith: b:a -> recipe id "b:zz" does not exist.']);
    expect(checkMeta({ goesWith: { 'b:zz': ['b:a'] } }, RECIPES, refs)).toEqual(['goesWith: recipe id "b:zz" does not exist.']);
  });

  it('refuses malformed sections and unknown section names', () => {
    expect(checkMeta({ cuisine: { 'b:a': null } } as unknown as MetaReview, RECIPES, refs)).toEqual(['cuisine: b:a -> null is not a cuisine id.']);
    expect(checkMeta({ goesWith: { 'b:a': 'b:b' } } as unknown as MetaReview, RECIPES, refs)).toEqual(['goesWith: b:a must be an array of recipe ids.']);
    expect(checkMeta({ cuisine: ['italiaans'] } as unknown as MetaReview, RECIPES, refs)).toEqual(['cuisine: must be an object keyed by recipe id.']);
    expect(checkMeta({ tags: {} } as unknown as MetaReview, RECIPES, refs)).toEqual(['"tags" is not a meta section (only category, goesWith, cuisine).']);
    expect(checkMeta(null as unknown as MetaReview, RECIPES, refs)).toEqual(['must be { category?, goesWith?, cuisine? }.']);
  });
});

describe('applyMeta', () => {
  const meta: MetaReview = { category: { 'b:c': 'soep' }, goesWith: { 'b:b': ['b:a'] }, cuisine: { 'b:a': 'italiaans', 'b:c': 'hollands' } };

  it('sets the fields, leaves other recipes alone and does not mutate the input', () => {
    const before = JSON.stringify(RECIPES);
    const { recipes, applied } = applyMeta(RECIPES, meta);
    expect(applied).toBe(4);
    expect(recipes[0]?.cuisine).toBe('italiaans');
    expect(recipes[1]?.goesWith).toEqual(['b:a']);
    expect(recipes[1]).not.toHaveProperty('cuisine');
    expect(recipes[2]?.category).toBe('soep');
    expect(recipes[2]?.cuisine).toBe('hollands');
    expect(JSON.stringify(RECIPES)).toBe(before);
    // The cuisine lands right after the category in the file.
    const keys = Object.keys(recipes[0] as object);
    expect(keys[keys.indexOf('category') + 1]).toBe('cuisine');
  });

  it('is idempotent', () => {
    const once = applyMeta(RECIPES, meta).recipes;
    const twice = applyMeta(once, meta).recipes;
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });

  it('an empty meta changes nothing', () => {
    const { recipes, applied } = applyMeta(RECIPES, {});
    expect(applied).toBe(0);
    expect(recipes).toEqual(RECIPES);
  });
});

describe('readMeta', () => {
  it('reads data/review/meta.json and gives null when the file is absent', () => {
    expect(readMeta(ROOT)?.cuisine).toBeDefined();
    const empty = mkdtempSync(join(tmpdir(), 'apply-meta-'));
    try {
      expect(readMeta(empty)).toBeNull();
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe('migrate() with the real data/review/meta.json', () => {
  const file: RecipesFile = migrate(SOURCE, '2026-10-23T00:00:00.000Z', inputs);
  const classics = file.recipes.filter((r) => r.createdAt === BUILTIN_TIMESTAMP);
  const byId = new Map(classics.map((r) => [r.id, r]));

  it('gives exactly 75 recipes a cuisine: 71 classics per cuisine as in §2c and four side dishes', () => {
    const all = file.recipes.filter((r) => typeof r.cuisine === 'string');
    expect(all).toHaveLength(75);
    expect(Object.fromEntries(all.filter((r) => r.createdAt !== BUILTIN_TIMESTAMP).map((r) => [r.id, r.cuisine]))).toEqual({
      'b:couscous': 'marokkaans',
      'b:focaccia-met-rozemarijn': 'italiaans',
      'b:guacamole': 'mexicaans',
      'b:tzatziki': 'grieks',
    });
    const withCuisine = classics.filter((r) => typeof r.cuisine === 'string');
    expect(withCuisine).toHaveLength(71);
    const counts: Record<string, number> = {};
    for (const r of withCuisine) counts[r.cuisine as string] = (counts[r.cuisine as string] ?? 0) + 1;
    expect(counts).toEqual({
      italiaans: 22, hollands: 16, frans: 3, spaans: 6, portugees: 1, grieks: 2, hongaars: 2, brits: 1,
      marokkaans: 2, indiaas: 3, thais: 1, chinees: 2, japans: 2, indonesisch: 4, mexicaans: 3, amerikaans: 1,
    });
    for (const r of withCuisine) expect(refs.cuisines.has(r.cuisine as string)).toBe(true);
  });

  it('Spaghetti Bolognese is Italian, Hutspot Dutch, Boeuf Stroganoff and the other deliberate nulls have none', () => {
    expect(byId.get('b:spaghetti-bolognese')?.cuisine).toBe('italiaans');
    expect(byId.get('b:hutspot')?.cuisine).toBe('hollands');
    expect(byId.get('b:naanbrood-voor-bij-dahl')?.cuisine).toBe('indiaas');
    for (const id of ['b:boeuf-stroganoff', 'b:zuid-afrikaanse-gehaktschotel', 'b:noorse-visschotel', 'b:groentecurry', 'b:kipkerrie-met-rijst', 'b:sticky-chicken', 'b:chorizo-met-tomatengnocchi', 'b:quiche-met-kip']) {
      expect(byId.has(id)).toBe(true);
      expect(byId.get(id)).not.toHaveProperty('cuisine');
    }
  });

  // Blok 4 (§2e, §5 punt 5): exactly five recategorisations and the goesWith of the polenta.
  const SIDES = [
    'b:aardappelpuree-bij-kabeljauw-met-notencrumble',
    'b:rucola-spinazie-pesto-bij-kabeljauw-met-notencrumble',
    'b:tomatensalsa-bij-kabeljauw-met-notencrumble',
    'b:naanbrood-voor-bij-dahl',
    'b:polenta-voor-ratatouille',
  ];

  it("puts exactly the five side dishes in 'bijgerecht'; no classic is in nagerecht, gebak or ontbijt-lunch", () => {
    expect(inputs.meta?.category).toEqual(Object.fromEntries(SIDES.map((id) => [id, 'bijgerecht'])));
    for (const id of SIDES) expect(byId.get(id)?.category).toBe('bijgerecht');
    expect(classics.filter((r) => r.category === 'bijgerecht').map((r) => r.id).sort()).toEqual([...SIDES].sort());
    for (const c of ['nagerecht', 'gebak', 'ontbijt-lunch']) expect(classics.filter((r) => r.category === c)).toEqual([]);
  });

  it('the other twelve in Overig stay there (Boerenomelet, Roerei met courgette …)', () => {
    const overig = classics.filter((r) => r.category === 'overig').map((r) => r.id);
    expect(overig).toHaveLength(12);
    expect(overig).toContain('b:boerenomelet');
    expect(overig).toContain('b:roerei-met-courgette');
    expect(overig).toContain('b:ratatouille');
    for (const id of SIDES) expect(overig).not.toContain(id);
  });

  it("the polenta goes with the ratatouille; the other side dishes keep their main dish from the name", () => {
    expect(inputs.meta?.goesWith).toEqual({ 'b:polenta-voor-ratatouille': ['b:ratatouille'] });
    expect(byId.get('b:polenta-voor-ratatouille')?.goesWith).toEqual(['b:ratatouille']);
    expect(byId.get('b:ratatouille')?.goesWith).toEqual([]);
    for (const id of SIDES.slice(0, 3)) expect(byId.get(id)?.goesWith).toEqual(['b:kabeljauw-met-notencrumble']);
    expect(byId.get('b:naanbrood-voor-bij-dahl')?.goesWith).toEqual(['b:dahl-van-rode-linzen-boerenkool']);
  });

  it('without the meta step the five side dishes are back in Overig and the polenta has no goesWith', () => {
    const without = migrate(SOURCE, '2026-10-23T00:00:00.000Z', { ...inputs, meta: null });
    const plain = new Map(without.recipes.map((r) => [r.id, r]));
    for (const id of SIDES) expect(plain.get(id)?.category).toBe('overig');
    expect(plain.get('b:polenta-voor-ratatouille')?.goesWith).toEqual([]);
  });

  it('the meta step is optional, and a broken meta file stops the migration', () => {
    const without = migrate(SOURCE, '2026-10-23T00:00:00.000Z', { ...inputs, meta: null });
    expect(without.recipes.some((r) => 'cuisine' in r)).toBe(false);
    expect(() => migrate(SOURCE, '2026-10-23T00:00:00.000Z', { ...inputs, meta: { cuisine: { 'b:hutspot': 'mars' } } })).toThrow(/data\/review\/meta\.json: 1 error/);
  });
});
