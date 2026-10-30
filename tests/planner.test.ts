// The week plan (docs/phase-4-spec.md §1, src/domain/planner.ts): "Verras me" variation rules,
// locks / existing dishes, small pools, the plan hash and the 6-week window; phase 6 (13E,
// docs/specs/labels-categorieen.md §1c/§2d): main dishes, the pickers' pool and side dishes;
// the 20 built-in side dishes (docs/specs/bijgerechten.md §6b) stay out of the pickers' pool;
// 13D (docs/specs/varianten-tabs.md §3/§6): the chosen diet version of a slot in planHash and newPlanItem.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultDictionary } from '../src/domain/data';
import type { Recipe } from '../src/domain/model';
import {
  excludeNonMain,
  isMainDish,
  isVegetarian,
  mainItems,
  newPlanItem,
  newSideItem,
  NON_MAIN_CATEGORIES,
  normalizeServings,
  pickRecipes,
  planHash,
  planHashAll,
  recentCookedIds,
  sidesOf,
  type Plan,
  type PlanItem,
} from '../src/domain/planner';
import { sidesToRecipes, type SidesFile } from '../tools/sides.ts';

function rec(id: string, category: string, tags: string[] = []): Recipe {
  return {
    schema: 2,
    id,
    rev: 1,
    createdAt: 'x',
    updatedAt: 'x',
    origin: { kind: 'builtin' },
    name: { nl: id },
    category,
    tags,
    servings: 4,
    lines: [],
    steps: [],
    goesWith: [],
    aliases: [],
  };
}

/** Deterministic rng (LCG) so the picks are reproducible. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const POOL: Recipe[] = [
  rec('b:pasta-1', 'pasta'),
  rec('b:pasta-2', 'pasta'),
  rec('b:pasta-3', 'pasta'),
  rec('b:pasta-4', 'pasta', ['vegetarisch']),
  rec('b:rijst-1', 'rijst'),
  rec('b:rijst-2', 'rijst'),
  rec('b:rijst-3', 'rijst'),
  rec('b:vlees-1', 'vlees'),
  rec('b:vlees-2', 'vlees'),
  rec('b:vis-1', 'vis'),
  rec('b:soep-1', 'soep', ['vegetarisch']),
  rec('b:salade-1', 'salade', ['vegetarisch']),
  rec('b:oven-1', 'oven'),
  rec('b:stamppot-1', 'stamppot'),
];

function slot(recipeId: string, extra: Partial<PlanItem> = {}): PlanItem {
  return { id: `pi:${recipeId}`, recipeId, servings: 4, addedAt: 'x', ...extra };
}

describe('pickRecipes: variation rules', () => {
  it('picks N distinct dishes with at most 2 pasta, at most 2 rijst and at least one vegetarian when N ≥ 4', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const picked = pickRecipes({ count: 7, pool: POOL, recentIds: new Set(), existing: [], rng: seeded(seed) });
      expect(picked).toHaveLength(7);
      expect(new Set(picked.map((r) => r.id)).size).toBe(7);
      expect(picked.filter((r) => r.category === 'pasta').length).toBeLessThanOrEqual(2);
      expect(picked.filter((r) => r.category === 'rijst').length).toBeLessThanOrEqual(2);
      expect(picked.some(isVegetarian)).toBe(true);
    }
  });

  it('does not require a vegetarian dish below 4 and never picks a recently cooked one', () => {
    const veg = new Set(POOL.filter(isVegetarian).map((r) => r.id));
    const recent = new Set(['b:vlees-1', 'b:vis-1']);
    for (let seed = 1; seed <= 25; seed++) {
      const picked = pickRecipes({ count: 3, pool: POOL.filter((r) => !veg.has(r.id)), recentIds: recent, existing: [], rng: seeded(seed) });
      expect(picked).toHaveLength(3);
      expect(picked.some((r) => recent.has(r.id))).toBe(false);
    }
  });

  it('never picks a dish that is already in the plan and counts the plan for the caps and the vegetarian minimum', () => {
    const existing = [slot('b:pasta-1'), slot('b:pasta-2', { locked: true }), slot('b:rijst-1', { cooked: true })];
    for (let seed = 1; seed <= 25; seed++) {
      const picked = pickRecipes({ count: 3, pool: POOL, recentIds: new Set(), existing, rng: seeded(seed) });
      expect(picked).toHaveLength(3);
      expect(picked.some((r) => r.id === 'b:pasta-1' || r.id === 'b:pasta-2' || r.id === 'b:rijst-1')).toBe(false);
      // Two pasta dishes already: no third one.
      expect(picked.some((r) => r.category === 'pasta')).toBe(false);
      expect(picked.filter((r) => r.category === 'rijst').length).toBeLessThanOrEqual(1);
      // 3 existing + 3 picked = 6 ≥ 4 and none vegetarian yet -> one of the picks is.
      expect(picked.some(isVegetarian)).toBe(true);
    }
  });

  it('a plan that already has a vegetarian dish needs no second one', () => {
    const pool = [rec('b:a', 'vlees'), rec('b:b', 'vis'), rec('b:c', 'oven'), rec('b:v', 'soep', ['vegetarisch'])];
    const picked = pickRecipes({ count: 3, pool, recentIds: new Set(), existing: [slot('b:v')], rng: seeded(3) });
    expect(picked.map((r) => r.id).sort()).toEqual(['b:a', 'b:b', 'b:c']);
  });
});

describe('pickRecipes: small pools fall back gracefully', () => {
  it('relaxes the 6-week rule before the caps when the pool is too small', () => {
    const pool = [rec('b:a', 'vlees'), rec('b:b', 'vis'), rec('b:c', 'oven')];
    const picked = pickRecipes({ count: 3, pool, recentIds: new Set(['b:a', 'b:b']), existing: [], rng: seeded(1) });
    expect(picked.map((r) => r.id).sort()).toEqual(['b:a', 'b:b', 'b:c']);
    // The not-recent dish comes first.
    expect(picked[0]?.id).toBe('b:c');
  });

  it('drops the pasta/rijst caps when nothing else is left, and never exceeds the pool', () => {
    const pool = [rec('b:p1', 'pasta'), rec('b:p2', 'pasta'), rec('b:p3', 'pasta'), rec('b:p4', 'pasta')];
    const picked = pickRecipes({ count: 6, pool, recentIds: new Set(), existing: [], rng: seeded(9) });
    expect(picked.map((r) => r.id).sort()).toEqual(['b:p1', 'b:p2', 'b:p3', 'b:p4']);
  });

  it('returns nothing for count 0, an empty pool, or a pool that is entirely in the plan; ignores duplicate pool entries', () => {
    expect(pickRecipes({ count: 0, pool: POOL, recentIds: new Set(), existing: [] })).toEqual([]);
    expect(pickRecipes({ count: 3, pool: [], recentIds: new Set(), existing: [] })).toEqual([]);
    expect(pickRecipes({ count: 2, pool: [rec('b:a', 'vis')], recentIds: new Set(), existing: [slot('b:a')] })).toEqual([]);
    const twice = pickRecipes({ count: 5, pool: [rec('b:a', 'vis'), rec('b:a', 'vis')], recentIds: new Set(), existing: [] });
    expect(twice.map((r) => r.id)).toEqual(['b:a']);
  });

  it('is deterministic for a seeded rng and varies between seeds', () => {
    const a = pickRecipes({ count: 5, pool: POOL, recentIds: new Set(), existing: [], rng: seeded(42) }).map((r) => r.id);
    const b = pickRecipes({ count: 5, pool: POOL, recentIds: new Set(), existing: [], rng: seeded(42) }).map((r) => r.id);
    expect(a).toEqual(b);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) seen.add(pickRecipes({ count: 5, pool: POOL, recentIds: new Set(), existing: [], rng: seeded(seed) }).map((r) => r.id).join());
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('planHash', () => {
  const plan = (items: PlanItem[]): Plan => ({ id: 'current', items, updatedAt: 'x' });

  it('is order-independent, ignores ids/locks/addedAt and cooked dishes, and changes with servings', () => {
    const a = planHash(plan([slot('b:a'), slot('b:b', { servings: 2 })]));
    const b = planHash(plan([{ id: 'pi:other', recipeId: 'b:b', servings: 2, locked: true, addedAt: 'y' }, slot('b:a')]));
    expect(a).toBe(b);
    expect(planHash(plan([slot('b:a'), slot('b:b', { servings: 2 }), slot('b:c', { cooked: true })]))).toBe(a);
    expect(planHash(plan([slot('b:a'), slot('b:b', { servings: 4 })]))).not.toBe(a);
    expect(planHash(plan([slot('b:a')]))).not.toBe(a);
    expect(a).toMatch(/^2:[0-9a-f]{8}$/);
  });

  it('hashes an empty plan (or one with only cooked dishes) to the empty string', () => {
    expect(planHash(plan([]))).toBe('');
    expect(planHash(plan([slot('b:a', { cooked: true })]))).toBe('');
  });

  it('planHashAll ignores the cooked flags: ticking "Gekookt" changes planHash but not planHashAll', () => {
    const before = plan([slot('b:a'), slot('b:b', { servings: 2 })]);
    const cookedOne = plan([slot('b:a', { cooked: true }), slot('b:b', { servings: 2 })]);
    expect(planHash(before)).not.toBe(planHash(cookedOne));
    expect(planHashAll(before)).toBe(planHashAll(cookedOne));
    expect(planHashAll(before)).toBe(planHash(before));
    expect(planHashAll(plan([slot('b:a'), slot('b:b', { servings: 2 }), slot('b:c')]))).not.toBe(planHashAll(before));
    expect(planHashAll(plan([]))).toBe('');
  });

  it('13D: without a variant the hash is byte-equal to the hash before 13D (fixed value)', () => {
    const items: PlanItem[] = [
      { id: 'pi:1', recipeId: 'b:dahl', servings: 4, addedAt: 'x' },
      { id: 'pi:2', recipeId: 'b:uiensoep', servings: 2, addedAt: 'x' },
    ];
    // Recorded once from the code before 13D (30 Oct 2026); never change this value.
    expect(planHash(plan(items))).toBe('2:d27734a2');
    expect(planHashAll(plan(items))).toBe('2:d27734a2');
    // a null variant is the original as well
    expect(planHash(plan(items.map((p) => ({ ...p, variant: null }))))).toBe('2:d27734a2');
  });

  it('13D: a chosen diet version changes the hash, still order-independent', () => {
    const dahl: PlanItem = { id: 'pi:1', recipeId: 'b:dahl', servings: 4, addedAt: 'x' };
    const soup: PlanItem = { id: 'pi:2', recipeId: 'b:uiensoep', servings: 2, addedAt: 'x', variant: 'glutenvrij' };
    const withVariant = planHash(plan([dahl, soup]));
    expect(withVariant).not.toBe('2:d27734a2');
    expect(withVariant).toMatch(/^2:[0-9a-f]{8}$/);
    expect(planHash(plan([soup, dahl]))).toBe(withVariant);
    expect(planHash(plan([dahl, { ...soup, variant: 'vegan' }]))).not.toBe(withVariant);
    expect(planHashAll(plan([dahl, soup]))).toBe(withVariant);
  });
});

describe('helpers', () => {
  it('recentCookedIds keeps the 6-week window', () => {
    const now = Date.parse('2026-09-29T12:00:00Z');
    const day = 24 * 60 * 60 * 1000;
    const log = [
      { recipeId: 'b:new', at: new Date(now - 3 * day).toISOString() },
      { recipeId: 'b:edge', at: new Date(now - 41 * day).toISOString() },
      { recipeId: 'b:old', at: new Date(now - 43 * day).toISOString() },
      { recipeId: 'b:bad', at: 'not a date' },
    ];
    expect([...recentCookedIds(log, now)].sort()).toEqual(['b:edge', 'b:new']);
  });

  it('newPlanItem and normalizeServings', () => {
    const it1 = newPlanItem('b:a');
    expect(it1.id).toMatch(/^pi:[a-z0-9]{8}$/);
    expect(it1.servings).toBe(4);
    expect(newPlanItem('b:a', 2.4).servings).toBe(2);
    expect(normalizeServings(0)).toBe(4);
    expect(normalizeServings('6')).toBe(4);
    expect(normalizeServings(6)).toBe(6);
    expect(normalizeServings(undefined, 2)).toBe(2);
  });

  it('newPlanItem takes the chosen diet version (13D); without one the key is absent', () => {
    expect(newPlanItem('b:a', 4, 'vegan').variant).toBe('vegan');
    expect('variant' in newPlanItem('b:a', 4)).toBe(false);
    expect('variant' in newPlanItem('b:a')).toBe(false);
    expect('variant' in newPlanItem('b:a', 4, null)).toBe(false);
  });
});

// docs/specs/labels-categorieen.md §1c/§1d/§2d (13E): main dishes, the pickers' pool, side dishes.
describe('main dishes and the pickers pool', () => {
  it('NON_MAIN_CATEGORIES are exactly nagerecht, gebak, bijgerecht and ontbijt-lunch', () => {
    expect([...NON_MAIN_CATEGORIES].sort()).toEqual(['bijgerecht', 'gebak', 'nagerecht', 'ontbijt-lunch']);
  });

  it('isMainDish: no category counts as a main dish; the four non-main categories do not', () => {
    expect(isMainDish({})).toBe(true);
    expect(isMainDish({ category: null })).toBe(true);
    expect(isMainDish({ category: 'pasta' })).toBe(true);
    expect(isMainDish({ category: 'overig' })).toBe(true);
    for (const c of ['bijgerecht', 'nagerecht', 'gebak', 'ontbijt-lunch']) expect(isMainDish({ category: c })).toBe(false);
  });

  const mixed: Recipe[] = [
    rec('b:pasta', 'pasta'),
    rec('b:puree', 'bijgerecht'),
    rec('b:taart', 'gebak'),
    rec('b:toetje', 'nagerecht'),
    rec('b:roerei', 'ontbijt-lunch'),
    { ...rec('b:zonder', 'x'), category: null },
  ];
  const ids = (list: readonly Recipe[]) => list.map((r) => r.id);

  it('excludeNonMain drops the non-main recipes by default and keeps the order', () => {
    expect(ids(excludeNonMain(mixed, {}))).toEqual(['b:pasta', 'b:zonder']);
    expect(ids(excludeNonMain(mixed))).toEqual(['b:pasta', 'b:zonder']);
  });

  it('"ook bijgerechten & zoet" (all) keeps everything; a chosen non-main category chip keeps that category', () => {
    expect(ids(excludeNonMain(mixed, { all: true }))).toEqual(ids(mixed));
    expect(ids(excludeNonMain(mixed, { cats: ['bijgerecht'] }))).toEqual(['b:pasta', 'b:puree', 'b:zonder']);
    expect(ids(excludeNonMain(mixed, { cats: ['nagerecht', 'gebak'] }))).toEqual(['b:pasta', 'b:taart', 'b:toetje', 'b:zonder']);
    // A main-dish chip changes nothing about the non-main recipes.
    expect(ids(excludeNonMain(mixed, { cats: ['pasta'] }))).toEqual(['b:pasta', 'b:zonder']);
    expect(ids(excludeNonMain(mixed, { all: false, cats: [] }))).toEqual(['b:pasta', 'b:zonder']);
  });

  it('does not mutate its input', () => {
    const copy = [...mixed];
    excludeNonMain(mixed, {});
    expect(mixed).toEqual(copy);
  });
});

// docs/specs/bijgerechten.md §3 builder C + §6b: the 20 built-in side dishes (data/source/bijgerechten.json,
// turned into recipes by tools/sides.ts) fall under the existing non-main filter of 6B block 4.
describe('the 20 built-in side dishes stay out of the pickers pool', () => {
  const file = JSON.parse(readFileSync(new URL('../data/source/bijgerechten.json', import.meta.url), 'utf8')) as SidesFile;
  const sides = sidesToRecipes(file, defaultDictionary());
  const sideIds = new Set(sides.map((r) => r.id));
  const ids = (list: readonly Recipe[]) => list.map((r) => r.id);

  it('bijgerecht is one of the NON_MAIN_CATEGORIES', () => {
    expect(NON_MAIN_CATEGORIES.has('bijgerecht')).toBe(true);
  });

  it('all 20 ids of the source file become recipes and none of them is a main dish', () => {
    expect(sides).toHaveLength(20);
    expect(ids(sides)).toEqual(file.recipes.map((s) => s.id));
    for (const r of sides) {
      expect(r.category, r.id).toBe('bijgerecht');
      expect(isMainDish(r), r.id).toBe(false);
    }
  });

  it('excludeNonMain drops them without a chip and keeps them with "all" or the Bijgerecht chip', () => {
    const pool = [...sides, rec('a', 'pasta')];
    expect(ids(excludeNonMain(pool, {}))).toEqual(['a']);
    expect(ids(excludeNonMain(pool))).toEqual(['a']);
    expect(ids(excludeNonMain(pool, { all: true }))).toEqual(ids(pool));
    expect(ids(excludeNonMain(pool, { cats: ['bijgerecht'] }))).toEqual(ids(pool));
  });

  it('pickRecipes over the filtered pool never picks a side dish (seeded, 50 runs)', () => {
    const pool = excludeNonMain([...sides, ...POOL], {});
    expect(pool.some((r) => sideIds.has(r.id))).toBe(false);
    for (let seed = 1; seed <= 50; seed++) {
      const picked = pickRecipes({ count: 7, pool, recentIds: new Set(), existing: [], rng: seeded(seed) });
      expect(picked).toHaveLength(7);
      expect(picked.some((r) => sideIds.has(r.id) || !isMainDish(r))).toBe(false);
    }
  });
});

describe('side dishes in the plan (sideOf)', () => {
  const main = slot('b:kabeljauw', { servings: 6 });
  const other = slot('b:dahl', { servings: 2 });

  it('newSideItem: a new pi: slot with the servings of the main dish and sideOf = the main id', () => {
    const side = newSideItem(main, 'b:puree');
    expect(side.id).toMatch(/^pi:[a-z0-9]{8}$/);
    expect(side.id).not.toBe(main.id);
    expect(side.recipeId).toBe('b:puree');
    expect(side.servings).toBe(6);
    expect(side.sideOf).toBe(main.id);
    expect(side).not.toHaveProperty('cooked');
    expect(side).not.toHaveProperty('locked');
    expect(typeof side.addedAt).toBe('string');
  });

  it('sidesOf and mainItems split the plan; the same side may hang under two mains', () => {
    const puree = newSideItem(main, 'b:puree');
    const salsa = newSideItem(main, 'b:salsa');
    const brood = newSideItem(other, 'b:stokbrood');
    const brood2 = newSideItem(main, 'b:stokbrood');
    const items = [main, puree, other, salsa, brood, brood2];
    expect(sidesOf(items, main.id)).toEqual([puree, salsa, brood2]);
    expect(sidesOf(items, other.id)).toEqual([brood]);
    expect(sidesOf(items, 'pi:none')).toEqual([]);
    expect(mainItems(items)).toEqual([main, other]);
    expect(mainItems([])).toEqual([]);
  });

  it('planHash changes when a side dish is added (the list then says "Weekplan gewijzigd")', () => {
    const plan = (items: PlanItem[]): Plan => ({ id: 'current', items, updatedAt: 'x' });
    const before = plan([main, other]);
    const after = plan([main, other, newSideItem(main, 'b:puree')]);
    expect(planHash(after)).not.toBe(planHash(before));
    expect(planHashAll(after)).not.toBe(planHashAll(before));
    expect(planHash(after)).toMatch(/^3:[0-9a-f]{8}$/);
  });
});
