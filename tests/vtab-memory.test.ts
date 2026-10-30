// 13D blok 2 (docs/specs/varianten-tabs.md §1a, §6): the remembered variant tab per recipe
// (src/vtab-memory.ts, localStorage 'recepten.vtab') on an in-memory storage stub — round trip, at most
// 200 recipes, junk JSON -> null — plus the pure tab helpers it feeds: `?v=` <-> TabChoice and the
// swipe order of src/components/VariantTabs.tsx, and the swipe thresholds of src/swipe.ts.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTabChoice, tabChoiceFromParam, tabChoiceToParam, type TabChoice } from '../src/components/VariantTabs';
import type { Recipe } from '../src/domain/model';
import type { VariantDiet, VariantStatus } from '../src/domain/variants';
import { DRAG_PX, isSidewaysDrag, SWIPE_PX, swipeDirection } from '../src/swipe';
import {
  parseTabMap,
  rememberedTab,
  rememberTab,
  serializeTabMap,
  VTAB_KEY,
  VTAB_MAX,
  withTab,
  type TabStorage,
} from '../src/vtab-memory';

/** A Map-backed stand-in for localStorage. */
function memoryStorage(initial: Record<string, string> = {}): TabStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('vtab-memory: rememberTab / rememberedTab', () => {
  it('round-trips a diet and a version id per recipe', () => {
    const store = memoryStorage();
    expect(rememberedTab('b:spaghettischotel-uit-de-oven', store)).toBeNull();
    rememberTab('b:spaghettischotel-uit-de-oven', 'glutenvrij', store);
    rememberTab('b:uiensoep', 'u:7f3k2q9a', store);
    expect(rememberedTab('b:spaghettischotel-uit-de-oven', store)).toBe('glutenvrij');
    expect(rememberedTab('b:uiensoep', store)).toBe('u:7f3k2q9a');
    expect(rememberedTab('b:dahl', store)).toBeNull();
    expect(JSON.parse(store.data.get(VTAB_KEY) ?? '{}')).toEqual({
      'b:spaghettischotel-uit-de-oven': 'glutenvrij',
      'b:uiensoep': 'u:7f3k2q9a',
    });
  });

  it('a new choice replaces the old one; null (Origineel) forgets it and an empty map removes the key', () => {
    const store = memoryStorage();
    rememberTab('b:x', 'glutenvrij', store);
    rememberTab('b:x', 'vegan', store);
    expect(rememberedTab('b:x', store)).toBe('vegan');
    rememberTab('b:x', null, store);
    expect(rememberedTab('b:x', store)).toBeNull();
    expect(store.data.has(VTAB_KEY)).toBe(false);
  });

  it('keeps at most 200 recipes: the oldest choice goes first, a re-chosen recipe counts as new', () => {
    expect(VTAB_MAX).toBe(200);
    const store = memoryStorage();
    for (let i = 0; i < VTAB_MAX; i++) rememberTab(`u:r${i}`, 'vegan', store);
    rememberTab('u:r0', 'glutenvrij', store); // r0 is now the newest
    rememberTab('u:new', 'vegetarisch', store); // 201 -> the oldest (r1) goes
    const map = parseTabMap(store.data.get(VTAB_KEY) ?? null);
    expect(map.size).toBe(VTAB_MAX);
    expect(rememberedTab('u:r1', store)).toBeNull();
    expect(rememberedTab('u:r0', store)).toBe('glutenvrij');
    expect(rememberedTab('u:r2', store)).toBe('vegan');
    expect(rememberedTab('u:new', store)).toBe('vegetarisch');
  });

  it('invalid JSON or a non-object gives null, and the next choice starts a fresh map', () => {
    const broken = memoryStorage({ [VTAB_KEY]: '{not json' });
    expect(rememberedTab('b:x', broken)).toBeNull();
    rememberTab('b:x', 'vegan', broken);
    expect(rememberedTab('b:x', broken)).toBe('vegan');
    expect(rememberedTab('b:x', memoryStorage({ [VTAB_KEY]: '["b:x","vegan"]' }))).toBeNull();
    expect(rememberedTab('b:x', memoryStorage({ [VTAB_KEY]: '"vegan"' }))).toBeNull();
    expect(rememberedTab('b:x', memoryStorage({ [VTAB_KEY]: '{"b:x": 3}' }))).toBeNull();
  });

  it('never throws: no storage, a throwing storage, or an empty recipe id', () => {
    expect(rememberedTab('b:x', null)).toBeNull();
    expect(() => rememberTab('b:x', 'vegan', null)).not.toThrow();
    const throwing: TabStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(rememberedTab('b:x', throwing)).toBeNull();
    expect(() => rememberTab('b:x', 'vegan', throwing)).not.toThrow();
    const store = memoryStorage();
    rememberTab('', 'vegan', store);
    expect(store.data.size).toBe(0);
    expect(rememberedTab('', store)).toBeNull();
  });

  it('uses localStorage by default (and nothing when there is none)', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(rememberedTab('b:x')).toBeNull();
    expect(() => rememberTab('b:x', 'vegan')).not.toThrow();
    const store = memoryStorage();
    vi.stubGlobal('localStorage', store);
    rememberTab('b:x', 'lactosevrij');
    expect(rememberedTab('b:x')).toBe('lactosevrij');
    expect(store.data.get(VTAB_KEY)).toBe('{"b:x":"lactosevrij"}');
  });

  it('pure helpers: parse drops junk entries, withTab orders and trims, serialize keeps the order', () => {
    const map = parseTabMap('{"b:a":"vegan","":"x","b:b":"","b:c":"u:1","b:d":null}');
    expect([...map]).toEqual([
      ['b:a', 'vegan'],
      ['b:c', 'u:1'],
    ]);
    const next = withTab(map, 'b:a', 'glutenvrij', 2);
    expect([...next.keys()]).toEqual(['b:c', 'b:a']);
    expect([...withTab(next, 'b:e', 'vegan', 2).keys()]).toEqual(['b:a', 'b:e']);
    expect([...map.keys()]).toEqual(['b:a', 'b:c']); // input untouched
    expect(serializeTabMap(next)).toBe('{"b:c":"u:1","b:a":"glutenvrij"}');
  });
});

const TABS: Array<{ diet: VariantDiet; status: VariantStatus }> = [
  { diet: 'glutenvrij', status: 'approved' },
  { diet: 'vegetarisch', status: 'natural' },
  { diet: 'vegan', status: 'proposed' },
  { diet: 'lactosevrij', status: 'stale' },
];
const VERSIONS = [{ id: 'u:dino1' }, { id: 'u:dino2' }] as Recipe[];
const ORIGINAL: TabChoice = { kind: 'original' };

describe('VariantTabs: ?v= <-> choice', () => {
  it('a diet or a version id round-trips; Origineel has no param', () => {
    const choices: TabChoice[] = [
      { kind: 'diet', diet: 'glutenvrij' },
      { kind: 'diet', diet: 'vegan' },
      { kind: 'diet', diet: 'lactosevrij' },
      { kind: 'version', recipeId: 'u:dino2' },
    ];
    for (const c of choices) expect(tabChoiceFromParam(tabChoiceToParam(c), TABS, VERSIONS)).toEqual(c);
    expect(tabChoiceToParam(ORIGINAL)).toBeNull();
    expect(tabChoiceFromParam(null, TABS, VERSIONS)).toEqual(ORIGINAL);
  });

  it('a tab that does not exist (any more) falls back to Origineel; a natural diet cannot be chosen', () => {
    expect(tabChoiceFromParam('vegetarisch', TABS, VERSIONS)).toEqual(ORIGINAL);
    expect(tabChoiceFromParam('u:gone', TABS, VERSIONS)).toEqual(ORIGINAL);
    expect(tabChoiceFromParam('notenvrij', TABS, VERSIONS)).toEqual(ORIGINAL);
    expect(tabChoiceFromParam('', TABS, VERSIONS)).toEqual(ORIGINAL);
    expect(tabChoiceFromParam('glutenvrij', [], [])).toEqual(ORIGINAL);
  });
});

describe('VariantTabs: swipe order (nextTabChoice)', () => {
  it('walks Origineel -> diets (natural skipped) -> versions and stops at both ends', () => {
    const order: Array<string | null> = [];
    let c: TabChoice = ORIGINAL;
    for (let i = 0; i < 8; i++) {
      order.push(tabChoiceToParam(c));
      c = nextTabChoice(c, 1, TABS, VERSIONS);
    }
    expect(order).toEqual([null, 'glutenvrij', 'vegan', 'lactosevrij', 'u:dino1', 'u:dino2', 'u:dino2', 'u:dino2']);
    expect(nextTabChoice({ kind: 'diet', diet: 'vegan' }, -1, TABS, VERSIONS)).toEqual({ kind: 'diet', diet: 'glutenvrij' });
    expect(nextTabChoice(ORIGINAL, -1, TABS, VERSIONS)).toEqual(ORIGINAL);
  });

  it('a choice that is not in the row counts as Origineel; a row with nothing to choose stays put', () => {
    expect(nextTabChoice({ kind: 'diet', diet: 'vegetarisch' }, 1, TABS, VERSIONS)).toEqual({ kind: 'diet', diet: 'glutenvrij' });
    expect(nextTabChoice({ kind: 'version', recipeId: 'u:gone' }, -1, TABS, VERSIONS)).toEqual(ORIGINAL);
    expect(nextTabChoice(ORIGINAL, 1, [{ diet: 'vegan', status: 'natural' }], [])).toEqual(ORIGINAL);
  });
});

describe('swipe thresholds (same as cook mode)', () => {
  it('60 px sideways and more than the vertical is a swipe; finger to the left = next', () => {
    expect(SWIPE_PX).toBe(60);
    expect(swipeDirection(-60, 10)).toBe('left');
    expect(swipeDirection(75, -20)).toBe('right');
    expect(swipeDirection(-59, 0)).toBeNull();
    expect(swipeDirection(-80, 80)).toBeNull();
    expect(swipeDirection(-80, -90)).toBeNull();
  });

  it('a drag starts after 12 px sideways that dominate the vertical', () => {
    expect(DRAG_PX).toBe(12);
    expect(isSidewaysDrag(12, 0)).toBe(false);
    expect(isSidewaysDrag(-13, 5)).toBe(true);
    expect(isSidewaysDrag(20, 20)).toBe(false);
  });
});
