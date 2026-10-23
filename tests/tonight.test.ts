// Home A+ block 2 (docs/specs/home-a-plus.md §6a): the pure helpers behind the Tonight card, the
// "Continue with" line and the compact week (src/domain/tonight.ts), plus the last-viewed record of
// src/recent.ts. Fixtures are inline: only the fields the helpers read are filled in.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Recipe } from '../src/domain/model';
import type { Plan, PlanItem } from '../src/domain/planner';
import {
  continueWithId,
  currentPlanItem,
  isSameLocalDay,
  nextPlanItem,
  outsideWeekIds,
  pickRandomId,
  tonightMeta,
  tonightMode,
  uncookedItems,
  weekLine,
  weekNames,
  weekProgress,
} from '../src/domain/tonight';
import { lastViewed, noteViewed, parseLastViewed, RECENT_KEY, RECENT_LAST_KEY } from '../src/recent';

function recipe(id: string, name: string, time?: Recipe['time'], category?: string | null): Recipe {
  return { id, name: { nl: name, en: name }, time, category } as unknown as Recipe;
}

let slotN = 0;
function item(recipeId: string, cooked?: true, id = 's' + ++slotN): PlanItem {
  const it: PlanItem = { id, recipeId, servings: 4, addedAt: '2026-10-20T10:00:00.000Z' };
  if (cooked) it.cooked = true;
  return it;
}

function plan(items: PlanItem[]): Plan {
  return { id: 'current', items, updatedAt: '2026-10-20T10:00:00.000Z' };
}

function mapOf(recipes: readonly Recipe[]): Map<string, Recipe> {
  return new Map(recipes.map((r) => [r.id, r]));
}

const GOULASH = recipe('b:hongaarse-goulash', 'Goulash', { total: 45 }, 'vlees');
const DAHL = recipe('b:dahl', 'Dahl', { active: 30 }, 'overig');
const PADTHAI = recipe('b:pad-thai', 'Pad thai', null, null);
const RECIPES = [GOULASH, DAHL, PADTHAI];
const BY_ID = mapOf(RECIPES);

describe('tonightMode', () => {
  it('is loading while the plan or the recipes are not there yet', () => {
    expect(tonightMode(undefined, [], false)).toBe('loading');
    expect(tonightMode(plan([]), undefined, false)).toBe('loading');
    expect(tonightMode(undefined, undefined, true)).toBe('loading');
  });

  it('is plan when at least one uncooked slot has an existing recipe', () => {
    expect(tonightMode(plan([item(GOULASH.id)]), RECIPES, false)).toBe('plan');
    expect(tonightMode(plan([item(GOULASH.id, true), item(DAHL.id)]), RECIPES, false)).toBe('plan');
  });

  it('is free when everything is cooked, the plan is empty, free mode is on or the recipe is gone', () => {
    expect(tonightMode(plan([item(GOULASH.id, true), item(DAHL.id, true)]), RECIPES, false)).toBe('free');
    expect(tonightMode(plan([]), RECIPES, false)).toBe('free');
    expect(tonightMode(plan([item(GOULASH.id)]), RECIPES, true)).toBe('free');
    expect(tonightMode(plan([item('b:bestaat-niet')]), RECIPES, false)).toBe('free');
  });
});

describe('uncookedItems', () => {
  it('keeps the plan order and skips cooked slots and unknown recipes', () => {
    const a = item(PADTHAI.id);
    const b = item(GOULASH.id, true);
    const c = item('b:weg');
    const d = item(DAHL.id);
    const e = item(GOULASH.id);
    expect(uncookedItems(plan([a, b, c, d, e]), BY_ID)).toEqual([a, d, e]);
  });

  it('gives [] for an empty plan', () => {
    expect(uncookedItems(plan([]), BY_ID)).toEqual([]);
  });
});

describe('currentPlanItem / nextPlanItem', () => {
  const s1 = item(GOULASH.id, undefined, 's1');
  const s2 = item(DAHL.id, undefined, 's2');
  const s3 = item(PADTHAI.id, undefined, 's3');
  const items = [s1, s2, s3];

  it('currentPlanItem returns the remembered slot while it is still there', () => {
    expect(currentPlanItem(items, 's2')).toBe(s2);
  });

  it('currentPlanItem falls back to the first slot (cooked/removed id, or none remembered)', () => {
    // 's9' stands for a slot that has been cooked or removed: uncookedItems no longer returns it.
    expect(currentPlanItem(items, 's9')).toBe(s1);
    expect(currentPlanItem([s2, s3], 's1')).toBe(s2);
    expect(currentPlanItem(items, null)).toBe(s1);
    expect(currentPlanItem([], 's1')).toBeUndefined();
    expect(currentPlanItem([], null)).toBeUndefined();
  });

  it('nextPlanItem steps through the slots and wraps round', () => {
    expect(nextPlanItem(items, 's1')).toBe(s2);
    expect(nextPlanItem(items, 's2')).toBe(s3);
    expect(nextPlanItem(items, 's3')).toBe(s1);
  });

  it('nextPlanItem after an unknown id gives the first slot; one slot gives itself; [] gives undefined', () => {
    expect(nextPlanItem(items, 'onbekend')).toBe(s1);
    expect(nextPlanItem([s1], 's1')).toBe(s1);
    expect(nextPlanItem([], 's1')).toBeUndefined();
    expect(nextPlanItem([], null)).toBeUndefined();
  });
});

describe('pickRandomId', () => {
  it('gives null for an empty list', () => {
    expect(pickRandomId([], null)).toBeNull();
    expect(pickRandomId([], 'a', () => 0)).toBeNull();
  });

  it('gives the only id even when it is the one to avoid', () => {
    expect(pickRandomId(['a'], 'a')).toBe('a');
    expect(pickRandomId(['a'], 'a', () => 0)).toBe('a');
  });

  it('never returns `not` when there is another id, and does not loop on a fixed rng', () => {
    expect(pickRandomId(['a', 'b'], 'a', () => 0)).toBe('b');
    expect(pickRandomId(['a', 'b'], 'b', () => 0)).toBe('a');
    expect(pickRandomId(['a', 'b'], 'a', () => 0.99)).toBe('b');
  });

  it('maps rng 0 to the first and rng 0.99 to the last candidate', () => {
    expect(pickRandomId(['a', 'b', 'c'], null, () => 0)).toBe('a');
    expect(pickRandomId(['a', 'b', 'c'], null, () => 0.99)).toBe('c');
    expect(pickRandomId(['a', 'b', 'c'], 'a', () => 0.99)).toBe('c');
    expect(pickRandomId(['a', 'b', 'c'], 'c', () => 0.99)).toBe('b');
  });

  it('stays inside the list for an out-of-range rng and uses Math.random by default', () => {
    expect(pickRandomId(['a', 'b'], null, () => 1)).toBe('b');
    expect(pickRandomId(['a', 'b'], null, () => -1)).toBe('a');
    expect(pickRandomId(['a', 'b'], null, () => Number.NaN)).toBe('a');
    for (let i = 0; i < 50; i++) expect(pickRandomId(['a', 'b', 'c'], 'b')).not.toBe('b');
  });
});

describe('outsideWeekIds', () => {
  const pool = [GOULASH.id, DAHL.id, PADTHAI.id];

  it('leaves out every dish of the week plan, cooked or not, and keeps the pool order', () => {
    expect(outsideWeekIds(pool, plan([item(DAHL.id)]))).toEqual([GOULASH.id, PADTHAI.id]);
    expect(outsideWeekIds(pool, plan([item(GOULASH.id, true), item(PADTHAI.id)]))).toEqual([DAHL.id]);
    expect(outsideWeekIds(pool, plan([item('b:weg')]))).toEqual(pool);
  });

  it('gives the pool unchanged (as a new array) without a plan or with an empty one', () => {
    const none = outsideWeekIds(pool, undefined);
    expect(none).toEqual(pool);
    expect(none).not.toBe(pool);
    const empty = outsideWeekIds(pool, plan([]));
    expect(empty).toEqual(pool);
    expect(empty).not.toBe(pool);
  });

  it('gives the whole pool (as a new array) when every dish of it is in the plan', () => {
    const all = outsideWeekIds(pool, plan([item(PADTHAI.id), item(GOULASH.id, true), item(DAHL.id)]));
    expect(all).toEqual(pool);
    expect(all).not.toBe(pool);
    expect(outsideWeekIds([DAHL.id], plan([item(DAHL.id)]))).toEqual([DAHL.id]);
  });

  it('gives [] for an empty pool', () => {
    expect(outsideWeekIds([], plan([item(DAHL.id)]))).toEqual([]);
    expect(outsideWeekIds([], undefined)).toEqual([]);
  });
});

describe('tonightMeta', () => {
  it('joins the non-empty parts with " · "', () => {
    expect(tonightMeta(['45 min', null, 'Vlees', '', 'nog 3 te gaan'])).toBe('45 min · Vlees · nog 3 te gaan');
    expect(tonightMeta(['45 min'])).toBe('45 min');
  });

  it('gives an empty string when every part is empty', () => {
    expect(tonightMeta([null, undefined])).toBe('');
    expect(tonightMeta([])).toBe('');
    expect(tonightMeta(['', null])).toBe('');
  });
});

describe('weekProgress', () => {
  it('counts all slots and the cooked ones', () => {
    const items = [
      item(GOULASH.id, true),
      item(DAHL.id),
      item(PADTHAI.id, true),
      item(GOULASH.id),
      item(DAHL.id, true),
      item(PADTHAI.id),
      item(GOULASH.id),
    ];
    expect(weekProgress(plan(items))).toEqual({ total: 7, cooked: 3 });
  });

  it('gives 0 of 0 for an empty plan', () => {
    expect(weekProgress(plan([]))).toEqual({ total: 0, cooked: 0 });
  });
});

describe('weekNames', () => {
  it('lists the uncooked names first in plan order, then the cooked ones, skipping unknown recipes', () => {
    const p = plan([item(GOULASH.id, true), item(DAHL.id), item('b:weg'), item(PADTHAI.id), item('b:ook-weg', true)]);
    expect(weekNames(p, BY_ID, (r) => r.name.nl ?? '')).toEqual([
      { name: 'Dahl', cooked: false },
      { name: 'Pad thai', cooked: false },
      { name: 'Goulash', cooked: true },
    ]);
  });

  it('keeps the plan order inside the cooked group and uses nameOf', () => {
    const p = plan([item(PADTHAI.id, true), item(GOULASH.id, true), item(DAHL.id)]);
    expect(weekNames(p, BY_ID, (r) => r.id)).toEqual([
      { name: DAHL.id, cooked: false },
      { name: PADTHAI.id, cooked: true },
      { name: GOULASH.id, cooked: true },
    ]);
    expect(weekNames(plan([]), BY_ID, (r) => r.id)).toEqual([]);
  });
});

describe('weekLine', () => {
  const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

  it('shows the first three and counts the rest', () => {
    expect(weekLine(seven)).toEqual({ shown: ['a', 'b', 'c'], more: 4 });
    expect(weekLine(seven, 3)).toEqual({ shown: ['a', 'b', 'c'], more: 4 });
  });

  it('has nothing more with three names or fewer, and handles an empty list', () => {
    expect(weekLine(['a', 'b', 'c'])).toEqual({ shown: ['a', 'b', 'c'], more: 0 });
    expect(weekLine(['a'])).toEqual({ shown: ['a'], more: 0 });
    expect(weekLine([])).toEqual({ shown: [], more: 0 });
  });

  it('honours a custom maximum', () => {
    expect(weekLine(seven, 1)).toEqual({ shown: ['a'], more: 6 });
    expect(weekLine(['a', 'b'], 1)).toEqual({ shown: ['a'], more: 1 });
  });

  it('works for any element type (the week card passes {name, cooked})', () => {
    const names = [
      { name: 'A', cooked: false },
      { name: 'B', cooked: true },
    ];
    expect(weekLine(names, 1)).toEqual({ shown: [names[0]], more: 1 });
  });
});

describe('isSameLocalDay', () => {
  // Built from local Dates so the test holds in every time zone.
  const now = new Date(2026, 9, 22, 8, 0);

  it('is true on the same local calendar day', () => {
    expect(isSameLocalDay(new Date(2026, 9, 22, 0, 0).toISOString(), now)).toBe(true);
    expect(isSameLocalDay(new Date(2026, 9, 22, 7, 59).toISOString(), now)).toBe(true);
    expect(isSameLocalDay(new Date(2026, 9, 22, 23, 59).toISOString(), now)).toBe(true);
  });

  it('is false across local midnight (23:59 vs 00:01 the next day)', () => {
    const lateEvening = new Date(2026, 9, 22, 23, 59).toISOString();
    expect(isSameLocalDay(lateEvening, new Date(2026, 9, 23, 0, 1))).toBe(false);
    expect(isSameLocalDay(new Date(2026, 9, 23, 0, 1).toISOString(), new Date(2026, 9, 22, 23, 59))).toBe(false);
  });

  it('is false on another day, month or year with the same day number', () => {
    expect(isSameLocalDay(new Date(2026, 9, 21, 8, 0).toISOString(), now)).toBe(false);
    expect(isSameLocalDay(new Date(2026, 8, 22, 8, 0).toISOString(), now)).toBe(false);
    expect(isSameLocalDay(new Date(2025, 9, 22, 8, 0).toISOString(), now)).toBe(false);
  });

  it('is false for an invalid iso', () => {
    expect(isSameLocalDay('', now)).toBe(false);
    expect(isSameLocalDay('geen datum', now)).toBe(false);
    expect(isSameLocalDay('2026-13-45T99:00:00.000Z', now)).toBe(false);
  });
});

describe('continueWithId', () => {
  const now = new Date(2026, 9, 22, 18, 0);
  const todayIso = new Date(2026, 9, 22, 17, 3).toISOString();
  const yesterdayIso = new Date(2026, 9, 21, 20, 0).toISOString();
  const known = new Set([GOULASH.id, DAHL.id]);
  const last = { id: GOULASH.id, at: todayIso };

  it('gives the id when viewed today, known, not on the card and not cooked today', () => {
    expect(continueWithId(last, now, known, DAHL.id, null)).toBe(GOULASH.id);
    expect(continueWithId(last, now, known, null, null)).toBe(GOULASH.id);
  });

  it('gives null when viewed yesterday', () => {
    expect(continueWithId({ id: GOULASH.id, at: yesterdayIso }, now, known, null, null)).toBeNull();
  });

  it('gives null for an unknown recipe', () => {
    expect(continueWithId({ id: 'b:weg', at: todayIso }, now, known, null, null)).toBeNull();
  });

  it('gives null when the card shows the same recipe', () => {
    expect(continueWithId(last, now, known, GOULASH.id, null)).toBeNull();
  });

  it('gives null when it was cooked today, but not when it was cooked yesterday', () => {
    expect(continueWithId(last, now, known, null, new Date(2026, 9, 22, 12, 0).toISOString())).toBeNull();
    expect(continueWithId(last, now, known, null, yesterdayIso)).toBe(GOULASH.id);
  });

  it('gives null without a last viewed recipe or with an invalid time', () => {
    expect(continueWithId(null, now, known, null, null)).toBeNull();
    expect(continueWithId({ id: GOULASH.id, at: 'x' }, now, known, null, null)).toBeNull();
  });
});

describe('recent.ts — the last viewed recipe', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parseLastViewed reads valid JSON', () => {
    expect(parseLastViewed('{"id":"b:hongaarse-goulash","at":"2026-10-22T17:03:12.000Z"}')).toEqual({
      id: 'b:hongaarse-goulash',
      at: '2026-10-22T17:03:12.000Z',
    });
  });

  it('parseLastViewed gives null for junk, an empty id or an invalid date', () => {
    expect(parseLastViewed(null)).toBeNull();
    expect(parseLastViewed('')).toBeNull();
    expect(parseLastViewed('x')).toBeNull();
    expect(parseLastViewed('{"id":""}')).toBeNull();
    expect(parseLastViewed('{"id":"","at":"2026-10-22T17:03:12.000Z"}')).toBeNull();
    expect(parseLastViewed('{"id":"b:dahl"}')).toBeNull();
    expect(parseLastViewed('{"id":"b:dahl","at":"gisteren"}')).toBeNull();
    expect(parseLastViewed('{"id":"b:dahl","at":12345}')).toBeNull();
    expect(parseLastViewed('{"id":7,"at":"2026-10-22T17:03:12.000Z"}')).toBeNull();
    expect(parseLastViewed('null')).toBeNull();
    expect(parseLastViewed('"b:dahl"')).toBeNull();
    expect(parseLastViewed('["b:dahl","2026-10-22T17:03:12.000Z"]')).toBeNull();
  });

  it('parseLastViewed ignores extra fields', () => {
    expect(parseLastViewed('{"id":"b:dahl","at":"2026-10-22T17:03:12.000Z","extra":1,"name":"Dahl"}')).toEqual({
      id: 'b:dahl',
      at: '2026-10-22T17:03:12.000Z',
    });
  });

  it('lastViewed gives null and noteViewed does not throw when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(lastViewed()).toBeNull();
    expect(() => noteViewed('b:dahl')).not.toThrow();
  });

  it('noteViewed records the last viewed recipe next to the recently-viewed list', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    const before = Date.now();
    noteViewed('b:dahl');
    noteViewed('b:hongaarse-goulash');
    expect(JSON.parse(store.get(RECENT_KEY) ?? 'null')).toEqual(['b:hongaarse-goulash', 'b:dahl']);
    const last = lastViewed();
    expect(last?.id).toBe('b:hongaarse-goulash');
    expect(Date.parse(last?.at ?? '')).toBeGreaterThanOrEqual(before - 1000);
    expect(isSameLocalDay(last?.at ?? '', new Date())).toBe(true);
    expect(RECENT_LAST_KEY).toBe('recepten.recent.last');
  });
});
