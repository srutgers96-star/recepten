// The week plan (docs/phase-4-spec.md §1, src/domain/planner.ts): "Verras me" variation rules,
// locks / existing dishes, small pools, the plan hash and the 6-week window.
import { describe, expect, it } from 'vitest';
import type { Recipe } from '../src/domain/model';
import { isVegetarian, newPlanItem, normalizeServings, pickRecipes, planHash, planHashAll, recentCookedIds, type Plan, type PlanItem } from '../src/domain/planner';

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
});
