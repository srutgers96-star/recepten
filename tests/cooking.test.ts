// The cooking bar's rules (docs/specs/kookbalk.md §6a): normalizeSessions, upsertSession,
// isExpired / pruneSessions, cookPath and groupBar.
import { describe, expect, it } from 'vitest';
import {
  COOKING_EXPIRE_MS,
  cookPath,
  groupBar,
  isExpired,
  normalizeSessions,
  pruneSessions,
  upsertSession,
  type BarLooseGroup,
  type BarRecipeGroup,
  type CookingSession,
} from '../src/domain/cooking';
import type { RunningTimer } from '../src/domain/model';

const H = 3_600_000;
const T0 = 1_792_694_400_000;
const SALMON = 'b:afwasmachinezalm';
const SPAGHETTI = 'b:spaghetti-bolognese';

function mk(over: Partial<CookingSession> = {}): CookingSession {
  return {
    recipeId: SALMON,
    page: 3,
    name: { nl: 'Afwasmachinezalm', en: 'Dishwasher salmon' },
    stepCount: 7,
    servings: 2,
    startedAt: T0,
    lastActiveAt: T0,
    ...over,
  };
}

let timerSeq = 0;
function mkTimer(over: Partial<RunningTimer> = {}): RunningTimer {
  timerSeq += 1;
  return {
    id: 't:' + timerSeq,
    recipeId: SALMON,
    stepIndex: 2,
    label: 'Afwasmachinezalm · stap 3',
    endAt: T0 + 5 * 60_000,
    durationMs: 5 * 60_000,
    createdAt: T0,
    ...over,
  };
}

describe('COOKING_EXPIRE_MS', () => {
  it('is 8 hours', () => {
    expect(COOKING_EXPIRE_MS).toBe(8 * H);
  });
});

describe('normalizeSessions', () => {
  it('reads anything that is not a list as no sessions', () => {
    expect(normalizeSessions(undefined)).toEqual([]);
    expect(normalizeSessions(null)).toEqual([]);
    expect(normalizeSessions('x')).toEqual([]);
    expect(normalizeSessions({})).toEqual([]);
  });

  it('returns a valid row unchanged', () => {
    const row = mk();
    expect(normalizeSessions([row])).toEqual([row]);
  });

  it('the stored example from the spec reads back as is', () => {
    const stored = JSON.parse(
      '[{ "recipeId": "b:afwasmachinezalm", "page": 3, "name": { "nl": "Afwasmachinezalm", "en": "Dishwasher salmon" }, "stepCount": 7, "servings": 2, "startedAt": 1792694400000, "lastActiveAt": 1792695300000 }]',
    );
    expect(normalizeSessions(stored)).toEqual(stored);
  });

  it('a missing lastActiveAt becomes startedAt', () => {
    const { lastActiveAt: _drop, ...row } = mk({ startedAt: T0 + H });
    expect(normalizeSessions([row])).toEqual([mk({ startedAt: T0 + H, lastActiveAt: T0 + H })]);
  });

  it('drops rows with a bad page or recipeId', () => {
    expect(normalizeSessions([mk({ page: -1 })])).toEqual([]);
    expect(normalizeSessions([mk({ page: 1.5 })])).toEqual([]);
    expect(normalizeSessions([{ ...mk(), recipeId: 7 }])).toEqual([]);
  });

  it('drops rows with a bad stepCount, name or time', () => {
    expect(normalizeSessions([mk({ stepCount: -1 })])).toEqual([]);
    expect(normalizeSessions([{ ...mk(), name: 'Afwasmachinezalm' }])).toEqual([]);
    expect(normalizeSessions([{ ...mk(), startedAt: 'gisteren' }])).toEqual([]);
    expect(normalizeSessions([{ ...mk(), startedAt: Number.NaN }])).toEqual([]);
    expect(normalizeSessions([{ ...mk(), lastActiveAt: Number.POSITIVE_INFINITY }])).toEqual([]);
  });

  it('page 0 (Klaarzetten) is a valid page', () => {
    expect(normalizeSessions([mk({ page: 0 })])).toEqual([mk({ page: 0 })]);
  });

  it('servings outside 1–24 or not a number become null', () => {
    expect(normalizeSessions([mk({ servings: 0 })])[0]!.servings).toBeNull();
    expect(normalizeSessions([mk({ servings: 30 })])[0]!.servings).toBeNull();
    expect(normalizeSessions([{ ...mk(), servings: '4' }])[0]!.servings).toBeNull();
    expect(normalizeSessions([{ ...mk(), servings: undefined }])[0]!.servings).toBeNull();
    expect(normalizeSessions([mk({ servings: 24 })])[0]!.servings).toBe(24);
  });

  it('fills a missing name side with an empty string', () => {
    expect(normalizeSessions([mk({ name: { nl: 'A' } })])[0]!.name).toEqual({ nl: 'A', en: '' });
  });

  it('keeps one row per recipe: the last one wins', () => {
    const first = mk({ page: 1 });
    const other = mk({ recipeId: SPAGHETTI, page: 2, stepCount: 3 });
    const last = mk({ page: 5 });
    const out = normalizeSessions([first, other, last]);
    expect(out).toHaveLength(2);
    expect(out.find((s) => s.recipeId === SALMON)).toEqual(last);
  });

  it('keeps fields this version does not know (a later version may add them)', () => {
    const row = { ...mk(), variant: 'vegan' };
    expect(normalizeSessions([row])[0]).toEqual(row);
  });

  it('13D: a variant that is not a diet reads as the original (null)', () => {
    expect(normalizeSessions([{ ...mk(), variant: 'notenvrij' }])[0]!.variant).toBeNull();
    expect(normalizeSessions([mk()])[0]).not.toHaveProperty('variant');
  });
});

describe('upsertSession', () => {
  it('adds a new recipe at the end', () => {
    const a = mk();
    const b = mk({ recipeId: SPAGHETTI, page: 1, stepCount: 3, startedAt: T0 + H, lastActiveAt: T0 + H });
    expect(upsertSession([a], b)).toEqual([a, b]);
  });

  it('replaces page, lastActiveAt, name, stepCount and servings but keeps startedAt and the order', () => {
    const a = mk();
    const b = mk({ recipeId: SPAGHETTI, page: 1, stepCount: 3 });
    const c = mk({ recipeId: 'b:pannenkoeken', page: 0, stepCount: 4 });
    const moved = mk({
      page: 5,
      lastActiveAt: T0 + 2 * H,
      startedAt: T0 + 2 * H,
      name: { nl: 'Zalm', en: 'Salmon' },
      stepCount: 8,
      servings: 6,
    });
    const out = upsertSession([a, b, c], moved);
    expect(out.map((s) => s.recipeId)).toEqual([SALMON, SPAGHETTI, 'b:pannenkoeken']);
    expect(out[0]).toEqual({ ...moved, startedAt: T0 });
    expect(out[1]).toBe(b);
    expect(out[2]).toBe(c);
  });

  it('does not change the list it was given', () => {
    const list = [mk()];
    upsertSession(list, mk({ page: 6 }));
    expect(list).toEqual([mk()]);
  });
});

describe('isExpired / pruneSessions', () => {
  const s = mk({ lastActiveAt: T0 });

  it('lives until 8 hours after the last activity', () => {
    expect(isExpired(s, [], T0 + 8 * H - 1)).toBe(false);
    expect(isExpired(s, [], T0 + 8 * H)).toBe(false);
    expect(isExpired(s, [], T0 + 8 * H + 1)).toBe(true);
  });

  it('a running timer of that recipe keeps it alive', () => {
    expect(isExpired(s, [mkTimer({ endAt: T0 + 10 * H })], T0 + 9 * H)).toBe(false);
  });

  it('a finished timer of that recipe does not', () => {
    expect(isExpired(s, [mkTimer({ endAt: T0 + 8 * H + 30 * 60_000 })], T0 + 9 * H)).toBe(true);
  });

  it("a running timer of another recipe does not save it", () => {
    expect(isExpired(s, [mkTimer({ recipeId: SPAGHETTI, endAt: T0 + 10 * H })], T0 + 9 * H)).toBe(true);
  });

  it('pruneSessions drops the expired ones and keeps the order', () => {
    const a = mk({ recipeId: 'b:a', lastActiveAt: T0 + 2 * H });
    const b = mk({ recipeId: 'b:b', lastActiveAt: T0 });
    const c = mk({ recipeId: 'b:c', lastActiveAt: T0 + 3 * H });
    const d = mk({ recipeId: 'b:d', lastActiveAt: T0 });
    const timers = [mkTimer({ recipeId: 'b:d', endAt: T0 + 12 * H })];
    expect(pruneSessions([a, b, c, d], timers, T0 + 9 * H).map((x) => x.recipeId)).toEqual(['b:a', 'b:c', 'b:d']);
  });

  it('pruneSessions returns the same list when nothing expired', () => {
    const list = [mk(), mk({ recipeId: SPAGHETTI })];
    expect(pruneSessions(list, [], T0 + H)).toBe(list);
  });
});

describe('cookPath', () => {
  it('builds the cook-mode path with step and servings', () => {
    expect(cookPath({ recipeId: 'b:x', page: 3, servings: null })).toBe('/cook/b:x?step=3');
    expect(cookPath({ recipeId: 'b:x', page: 0, servings: 2 })).toBe('/cook/b:x?srv=2');
    expect(cookPath({ recipeId: 'b:x', page: 3, servings: 6 })).toBe('/cook/b:x?step=3&srv=6');
    expect(cookPath({ recipeId: 'b:x', page: 0, servings: null })).toBe('/cook/b:x');
  });

  it('13D: adds &v=<diet> for a diet version; without one the path is unchanged', () => {
    expect(cookPath({ recipeId: 'b:x', page: 3, servings: 6, variant: 'glutenvrij' })).toBe('/cook/b:x?step=3&srv=6&v=glutenvrij');
    expect(cookPath({ recipeId: 'b:x', page: 3, servings: 6, variant: null })).toBe('/cook/b:x?step=3&srv=6');
  });
});

describe('groupBar', () => {
  const now = T0 + H;

  it('orders recipes by startedAt, timers by endAt, loose timers last', () => {
    const first = mk({ recipeId: SPAGHETTI, page: 1, stepCount: 3, startedAt: T0 + H, lastActiveAt: T0 + H });
    const second = mk({ recipeId: SALMON, startedAt: T0 });
    const late = mkTimer({ recipeId: SPAGHETTI, endAt: now + 20 * 60_000 });
    const early = mkTimer({ recipeId: SPAGHETTI, endAt: now + 5 * 60_000 });
    const loose = mkTimer({ recipeId: null, stepIndex: null, label: 'Eieren', endAt: now + 7 * 60_000 });
    const model = groupBar([first, second], [late, loose, early], now);
    expect(model.hasSessions).toBe(true);
    expect(model.current).toEqual([]);
    expect(model.groups).toHaveLength(3);
    const g0 = model.groups[0] as BarRecipeGroup;
    const g1 = model.groups[1] as BarRecipeGroup;
    const g2 = model.groups[2] as BarLooseGroup;
    expect(g0.kind).toBe('recipe');
    expect(g0.session).toBe(second);
    expect(g0.timers).toEqual([]);
    expect(g1.kind).toBe('recipe');
    expect(g1.session).toBe(first);
    expect(g1.timers).toEqual([early, late]);
    expect(g2).toEqual({ kind: 'loose', timers: [loose] });
  });

  it('stoppable: no timers, or only finished ones', () => {
    const s = mk();
    const none = groupBar([s], [], now).groups[0] as BarRecipeGroup;
    expect(none.timers).toEqual([]);
    expect(none.stoppable).toBe(true);
    const running = groupBar([s], [mkTimer({ endAt: now + 60_000 })], now).groups[0] as BarRecipeGroup;
    expect(running.stoppable).toBe(false);
    const finished = groupBar([s], [mkTimer({ endAt: now - 60_000 })], now).groups[0] as BarRecipeGroup;
    expect(finished.timers).toHaveLength(1);
    expect(finished.stoppable).toBe(true);
    const mixed = groupBar([s], [mkTimer({ endAt: now - 60_000 }), mkTimer({ endAt: now + 60_000 })], now)
      .groups[0] as BarRecipeGroup;
    expect(mixed.stoppable).toBe(false);
  });

  it('a timer of a recipe without a session is loose', () => {
    const t = mkTimer({ recipeId: 'b:onbekend', endAt: now + 60_000 });
    const model = groupBar([mk()], [t], now);
    expect(model.groups).toHaveLength(2);
    expect((model.groups[0] as BarRecipeGroup).timers).toEqual([]);
    expect(model.groups[1]).toEqual({ kind: 'loose', timers: [t] });
  });

  it('cook mode: the current recipe has no row, its timers are in current', () => {
    const salmon = mk({ startedAt: T0 });
    const spaghetti = mk({ recipeId: SPAGHETTI, page: 1, stepCount: 3, startedAt: T0 + H });
    const later = mkTimer({ endAt: now + 10 * 60_000 });
    const sooner = mkTimer({ endAt: now + 2 * 60_000 });
    const other = mkTimer({ recipeId: SPAGHETTI, endAt: now + 60_000 });
    const model = groupBar([salmon, spaghetti], [later, other, sooner], now, SALMON);
    expect(model.current).toEqual([sooner, later]);
    expect(model.groups).toHaveLength(1);
    expect((model.groups[0] as BarRecipeGroup).session).toBe(spaghetti);
    expect((model.groups[0] as BarRecipeGroup).timers).toEqual([other]);
    expect(model.hasSessions).toBe(true);
  });

  it('cook mode on a recipe without a session: current is empty', () => {
    const model = groupBar([mk()], [], now, SPAGHETTI);
    expect(model.current).toEqual([]);
    expect(model.groups).toHaveLength(1);
  });

  it('no sessions and no timers: nothing to show', () => {
    expect(groupBar([], [], now)).toEqual({ current: [], groups: [], hasSessions: false });
  });

  it('no sessions and one loose timer: only the loose group (the bar shows "Timers")', () => {
    const t = mkTimer({ recipeId: null, stepIndex: null, label: 'Eieren' });
    expect(groupBar([], [t], now)).toEqual({ current: [], groups: [{ kind: 'loose', timers: [t] }], hasSessions: false });
  });
});
