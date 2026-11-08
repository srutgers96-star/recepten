// Challenges (docs/specs/challenges.md, block 6E). These tests PIN the domain: every rule kind with
// the window (only facts inside [startedAt, min(deadline, now)] count), offerFor (deterministic, one
// of each weight, nothing finished in the last 8 weeks), termDeadline per term including the turn of
// the year, normalizeChallenges with garbage, the history helpers and validateChallenges.
// Times are built with LOCAL Date constructors: terms and days are local calendar days.
import { describe, expect, it } from 'vitest';
import challengesJson from '../data/challenges.json';
import {
  doneKey,
  mergeDoneChallenges,
  normalizeActiveChallenges,
  normalizeChallenges,
  normalizeDoneChallenges,
  offerFor,
  progressFor,
  termDeadline,
  weekKey,
  type ActiveChallenge,
  type Challenge,
  type ChallengeFacts,
  type ChallengeRule,
  type DoneChallenge,
  type SeasonWindows,
} from '../src/domain/challenges';
import type { CookLogEntry, Recipe } from '../src/domain/model';
import { readDictionaryData } from '../tools/build-dictionary-seed';
import { refsFromData, validateChallenges } from '../tools/validate-data';

// ---------------------------------------------------------------------------- helpers

/** Local moment: 2026-11-(day) hh:mm (9 Nov 2026 is a Monday). */
function nov(day: number, hour = 18, minute = 0): string {
  return new Date(2026, 10, day, hour, minute).toISOString();
}

function recipe(id: string, over: Partial<Recipe> = {}): Recipe {
  return {
    schema: 2,
    id,
    rev: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    origin: { kind: id.startsWith('b:') ? 'builtin' : 'user' },
    name: { nl: id },
    tags: [],
    servings: 4,
    lines: [],
    steps: [],
    goesWith: [],
    aliases: [],
    ...over,
  };
}

const RECIPES: ReadonlyMap<string, Recipe> = new Map(
  [
    recipe('b:soep', { category: 'soep', cuisine: 'nederlands', tags: ['vegetarisch', 'winter'] }),
    recipe('b:salade', { category: 'salade', cuisine: 'italiaans', tags: ['vegetarisch', 'vegan'] }),
    recipe('b:pasta', { category: 'pasta', cuisine: 'italiaans', tags: [] }),
    recipe('b:curry', { category: 'vlees', cuisine: 'indiaas', tags: [] }),
    recipe('b:taart', { category: 'nagerecht', cuisine: 'frans', tags: ['vegetarisch'] }),
  ].map((r) => [r.id, r]),
);

function cook(recipeId: string, at: string, over: Partial<CookLogEntry> = {}): CookLogEntry {
  return { recipeId, profileId: 'p:aaaaaaaa', at, ...over };
}

function challenge(rule: ChallengeRule, over: Partial<Challenge> = {}): Challenge {
  return {
    id: 'test',
    nl: { name: 'Test', description: 'Doe {n}' },
    en: { name: 'Test', description: 'Do {n}' },
    rule,
    term: 'week',
    xp: 250,
    weight: 1,
    icon: '🎯',
    ...over,
  };
}

/** Started Monday 9 Nov 08:00, deadline Sunday 15 Nov 23:59:59.999 (term 'week'). */
const ACTIVE: ActiveChallenge = { id: 'test', memberId: 'p:aaaaaaaa', startedAt: nov(9, 8), deadline: termDeadline('week', nov(9, 8), []) };

function facts(over: Partial<ChallengeFacts> = {}): ChallengeFacts {
  return { log: [], recipes: RECIPES, photoRows: [], features: [], now: nov(15, 22), ...over };
}

function progress(rule: ChallengeRule, f: Partial<ChallengeFacts>, active: ActiveChallenge = ACTIVE) {
  return progressFor(challenge(rule), active, facts(f));
}

const SEASONS: SeasonWindows = [
  { from: '03-20', to: '06-20' },
  { from: '06-21', to: '09-22' },
  { from: '09-23', to: '12-20' },
  { from: '12-21', to: '03-19' },
  { from: '12-24', to: '12-26' },
  { from: '12-31', to: '01-01' },
];

/** Local end of a calendar day as ISO. */
const endOf = (y: number, m: number, d: number): string => new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();

// ---------------------------------------------------------------------------- terms and weeks

describe('termDeadline', () => {
  it('week: the Sunday of the ISO week that holds the start, 23:59:59.999 local', () => {
    expect(termDeadline('week', nov(11, 10), SEASONS)).toBe(endOf(2026, 11, 15));
    expect(termDeadline('week', nov(9, 0, 5), SEASONS)).toBe(endOf(2026, 11, 15));
    expect(termDeadline('week', nov(15, 23, 30), SEASONS)).toBe(endOf(2026, 11, 15));
  });

  it('week across the turn of the year', () => {
    expect(termDeadline('week', new Date(2026, 11, 30, 12).toISOString(), SEASONS)).toBe(endOf(2027, 1, 3));
  });

  it('month: the last day of the month (leap February included)', () => {
    expect(termDeadline('month', nov(11), SEASONS)).toBe(endOf(2026, 11, 30));
    expect(termDeadline('month', new Date(2026, 11, 31, 20).toISOString(), SEASONS)).toBe(endOf(2026, 12, 31));
    expect(termDeadline('month', new Date(2028, 1, 3).toISOString(), SEASONS)).toBe(endOf(2028, 2, 29));
    expect(termDeadline('month', new Date(2027, 1, 3).toISOString(), SEASONS)).toBe(endOf(2027, 2, 28));
  });

  it('season: the end of the longest window that holds the start, across the turn of the year', () => {
    expect(termDeadline('season', nov(11), SEASONS)).toBe(endOf(2026, 12, 20)); // autumn
    expect(termDeadline('season', new Date(2026, 11, 21, 9).toISOString(), SEASONS)).toBe(endOf(2027, 3, 19)); // winter starts
    expect(termDeadline('season', new Date(2026, 11, 25, 9).toISOString(), SEASONS)).toBe(endOf(2027, 3, 19)); // Christmas: winter wins
    expect(termDeadline('season', new Date(2027, 0, 1, 9).toISOString(), SEASONS)).toBe(endOf(2027, 3, 19)); // New Year's day: winter wins
    expect(termDeadline('season', new Date(2027, 0, 10, 9).toISOString(), SEASONS)).toBe(endOf(2027, 3, 19));
    expect(termDeadline('season', new Date(2027, 2, 19, 9).toISOString(), SEASONS)).toBe(endOf(2027, 3, 19)); // last day
    expect(termDeadline('season', new Date(2027, 2, 20, 9).toISOString(), SEASONS)).toBe(endOf(2027, 6, 20)); // spring
  });

  it('season without a window that holds the start → the end of the month; an unreadable start stays as it is', () => {
    expect(termDeadline('season', nov(11), [])).toBe(endOf(2026, 11, 30));
    expect(termDeadline('week', 'garbage', SEASONS)).toBe('garbage');
  });
});

describe('weekKey', () => {
  it("ISO week 'YYYY-Www' with Monday as the start, also at the turn of the year", () => {
    expect(weekKey(new Date(2026, 10, 9, 0, 5))).toBe('2026-W46');
    expect(weekKey(new Date(2026, 10, 15, 23, 55))).toBe('2026-W46');
    expect(weekKey(new Date(2026, 10, 16, 0, 5))).toBe('2026-W47');
    expect(weekKey(new Date(2025, 11, 29))).toBe('2026-W01');
    expect(weekKey(new Date(2027, 0, 1))).toBe('2026-W53');
  });
});

// ---------------------------------------------------------------------------- offerFor

describe('offerFor', () => {
  const pool: Challenge[] = [];
  for (const weight of [1, 2, 3] as const) {
    for (let i = 0; i < 4; i++) pool.push(challenge({ kind: 'cooks', n: 3 }, { id: `w${weight}-${i}`, weight }));
  }
  const done = (id: string, finishedAt: string, memberId = 'p:aaaaaaaa'): DoneChallenge => ({ id, memberId, startedAt: finishedAt, finishedAt, xp: 250 });

  it('three challenges, one of each weight in the order 1, 2, 3; deterministic', () => {
    const a = offerFor(pool, '2026-W46', 'p:aaaaaaaa', []);
    expect(a.map((c) => c.weight)).toEqual([1, 2, 3]);
    expect(offerFor([...pool], '2026-W46', 'p:aaaaaaaa', [])).toEqual(a);
  });

  it('changes with the week key and the member (hash32(key + memberId))', () => {
    const offers = new Set<string>();
    for (let w = 1; w <= 20; w++) offers.add(offerFor(pool, `2026-W${String(w).padStart(2, '0')}`, 'p:aaaaaaaa', []).map((c) => c.id).join());
    expect(offers.size).toBeGreaterThan(1);
    const members = new Set<string>();
    for (let m = 0; m < 20; m++) members.add(offerFor(pool, '2026-W46', 'p:member' + m, []).map((c) => c.id).join());
    expect(members.size).toBeGreaterThan(1);
  });

  it('leaves out what this member finished in the last 8 weeks (this week included)', () => {
    const base = offerFor(pool, '2026-W46', 'p:aaaaaaaa', []);
    const first = base[0]!;
    // 2026-W46 starts Monday 9 Nov; 8 weeks earlier = Monday 14 Sep.
    const recent = offerFor(pool, '2026-W46', 'p:aaaaaaaa', [done(first.id, new Date(2026, 8, 14, 20).toISOString())]);
    expect(recent.map((c) => c.id)).not.toContain(first.id);
    expect(recent[1]).toEqual(base[1]); // the other weights stay
    expect(recent[2]).toEqual(base[2]);
    const thisWeek = offerFor(pool, '2026-W46', 'p:aaaaaaaa', [done(first.id, nov(10, 20))]);
    expect(thisWeek.map((c) => c.id)).not.toContain(first.id);
    const older = offerFor(pool, '2026-W46', 'p:aaaaaaaa', [done(first.id, new Date(2026, 8, 13, 20).toISOString())]);
    expect(older).toEqual(base);
    const otherMember = offerFor(pool, '2026-W46', 'p:aaaaaaaa', [done(first.id, nov(10, 20), 'p:bbbbbbbb')]);
    expect(otherMember).toEqual(base);
  });

  it('when every challenge of a weight was done recently, the ones done longest ago are offered', () => {
    const recent = [done('w1-0', nov(1)), done('w1-1', nov(2)), done('w1-2', new Date(2026, 9, 1).toISOString()), done('w1-3', nov(3))];
    expect(offerFor(pool, '2026-W46', 'p:aaaaaaaa', recent)[0]?.id).toBe('w1-2');
  });

  it('a weight without challenges in the pool is left out', () => {
    const noHeavy = pool.filter((c) => c.weight !== 3);
    expect(offerFor(noHeavy, '2026-W46', 'p:aaaaaaaa', []).map((c) => c.weight)).toEqual([1, 2]);
    expect(offerFor([], '2026-W46', 'p:aaaaaaaa', [])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------- progressFor

describe('progressFor: the window', () => {
  it('only cooks inside [startedAt, min(deadline, now)] count', () => {
    const log = [
      cook('b:soep', nov(8, 18)), // the Sunday before
      cook('b:soep', nov(9, 7, 59)), // start day, before the start
      cook('b:soep', nov(9, 8)), // exactly the start
      cook('b:pasta', nov(12)),
      cook('b:curry', nov(16, 0, 5)), // after the deadline
    ];
    expect(progress({ kind: 'cooks', n: 3 }, { log })).toEqual({ current: 2, target: 3, done: false });
    // a cook "in the future" (after now) does not count yet
    expect(progress({ kind: 'cooks', n: 3 }, { log, now: nov(11) })).toEqual({ current: 1, target: 3, done: false });
  });

  it('done = current ≥ target; current is capped at target', () => {
    const log = [cook('b:soep', nov(9, 18)), cook('b:pasta', nov(10)), cook('b:curry', nov(11)), cook('b:taart', nov(12))];
    expect(progress({ kind: 'cooks', n: 3 }, { log })).toEqual({ current: 3, target: 3, done: true });
  });

  it('an unreadable startedAt or deadline counts nothing', () => {
    const log = [cook('b:soep', nov(10))];
    expect(progress({ kind: 'cooks', n: 1 }, { log }, { ...ACTIVE, startedAt: 'x' })).toMatchObject({ current: 0, done: false });
    expect(progress({ kind: 'cooks', n: 1 }, { log }, { ...ACTIVE, deadline: 'x' })).toMatchObject({ current: 0, done: false });
  });
});

describe('progressFor: rule kinds', () => {
  it('cooksWithTag: recipe tags plus the tags of a cooked diet tab (vegan counts as vegetarisch)', () => {
    const log = [
      cook('b:soep', nov(9, 18)), // vegetarisch
      cook('b:pasta', nov(10), { variant: 'vegan' }), // diet tab: vegetarisch + vegan
      cook('b:curry', nov(11)), // nothing
      cook('b:onbekend', nov(12)), // unknown recipe: never
    ];
    expect(progress({ kind: 'cooksWithTag', tag: 'vegetarisch', n: 3 }, { log })).toEqual({ current: 2, target: 3, done: false });
    expect(progress({ kind: 'cooksWithTag', tag: 'vegan', n: 1 }, { log })).toEqual({ current: 1, target: 1, done: true });
    expect(progress({ kind: 'cooksWithTag', tag: 'glutenvrij', n: 1 }, { log })).toMatchObject({ current: 0 });
  });

  it('cooksInCategory counts cooks (not distinct recipes)', () => {
    const log = [cook('b:soep', nov(9, 18)), cook('b:soep', nov(10)), cook('b:pasta', nov(11))];
    expect(progress({ kind: 'cooksInCategory', category: 'soep', n: 2 }, { log })).toEqual({ current: 2, target: 2, done: true });
    expect(progress({ kind: 'cooksInCategory', category: 'pasta', n: 2 }, { log })).toMatchObject({ current: 1, done: false });
  });

  it('newCuisines: distinct cuisines never cooked before the start', () => {
    const log = [
      cook('b:pasta', nov(1)), // italiaans, before the start
      cook('b:salade', nov(9, 18)), // italiaans again: not new
      cook('b:curry', nov(10)), // indiaas: new
      cook('b:curry', nov(11)), // indiaas twice: still one
      cook('b:taart', nov(12)), // frans: new
    ];
    expect(progress({ kind: 'newCuisines', n: 3 }, { log })).toEqual({ current: 2, target: 3, done: false });
  });

  it('newRecipes: distinct recipes never cooked before the start (unknown recipe ids count too)', () => {
    const log = [cook('b:soep', nov(2)), cook('b:soep', nov(9, 18)), cook('b:pasta', nov(10)), cook('b:pasta', nov(11)), cook('u:weg', nov(12))];
    expect(progress({ kind: 'newRecipes', n: 2 }, { log })).toEqual({ current: 2, target: 2, done: true });
  });

  it('photos: rows in the window of recipes the member cooked', () => {
    const log = [cook('b:soep', nov(1)), cook('b:pasta', nov(10))];
    const photoRows = [
      { recipeId: 'b:soep', at: nov(9, 19) },
      { recipeId: 'b:pasta', at: nov(10, 19) },
      { recipeId: 'b:pasta', at: nov(11, 19) },
      { recipeId: 'b:curry', at: nov(11, 19) }, // never cooked
      { recipeId: 'b:soep', at: nov(8, 19) }, // before the start
    ];
    expect(progress({ kind: 'photos', n: 3 }, { log, photoRows })).toEqual({ current: 3, target: 3, done: true });
  });

  it('distinctDays: target n, the distinct local days with a cook in the window', () => {
    const rule: ChallengeRule = { kind: 'distinctDays', n: 5 };
    const four = [9, 10, 11, 12].map((d) => cook('b:soep', nov(d, 19)));
    expect(progress(rule, { log: four })).toEqual({ current: 4, target: 5, done: false });
    const five = [...four, cook('b:pasta', nov(14, 19))];
    expect(progress(rule, { log: five })).toEqual({ current: 5, target: 5, done: true });
  });

  it('distinctDays: two cooks on one day count once', () => {
    const rule: ChallengeRule = { kind: 'distinctDays', n: 5 };
    const log = [9, 10, 11, 12].map((d) => cook('b:soep', nov(d, 19)));
    log.push(cook('b:pasta', nov(12, 12)), cook('b:taart', nov(12, 21)));
    expect(progress(rule, { log })).toEqual({ current: 4, target: 5, done: false });
  });

  it('distinctDays: a cook before startedAt does not count; a start after Monday can still reach 5', () => {
    const rule: ChallengeRule = { kind: 'distinctDays', n: 5 };
    const active: ActiveChallenge = { ...ACTIVE, startedAt: nov(11, 8) };
    const four = [9, 10, 11, 12, 13].map((d) => cook('b:soep', nov(d, 19))); // the 9th and 10th are before the start
    expect(progress(rule, { log: four }, active)).toEqual({ current: 3, target: 5, done: false });
    const five = [11, 12, 13, 14, 15].map((d) => cook('b:soep', nov(d, 19)));
    expect(progress(rule, { log: five }, active)).toEqual({ current: 5, target: 5, done: true });
  });

  it('categories: one cook from each listed category', () => {
    const rule: ChallengeRule = { kind: 'categories', categories: ['nagerecht', 'soep', 'salade'] };
    expect(progress(rule, { log: [cook('b:soep', nov(9, 18)), cook('b:soep', nov(10)), cook('b:taart', nov(11))] })).toEqual({ current: 2, target: 3, done: false });
    expect(progress(rule, { log: [cook('b:soep', nov(9, 18)), cook('b:salade', nov(10)), cook('b:taart', nov(11))] })).toEqual({ current: 3, target: 3, done: true });
  });

  it('plannedCooks: cooks in the window that match a week dish ticked cooked, one cook per dish', () => {
    const rule: ChallengeRule = { kind: 'plannedCooks', n: 2 };
    const log = [cook('b:soep', nov(10, 19)), cook('b:pasta', nov(10, 20)), cook('b:curry', nov(11, 19)), cook('b:taart', nov(12, 19))];
    const plannedCooks = [
      { recipeId: 'b:soep', addedAt: nov(9, 9) }, // in the week before the cook: yes
      { recipeId: 'b:curry', addedAt: nov(11, 20) }, // added after the cook: no
      { recipeId: 'b:vis', addedAt: nov(9, 9) }, // never cooked in the window: no
    ];
    expect(progress(rule, { log, plannedCooks })).toEqual({ current: 1, target: 2, done: false });
    const more = [...plannedCooks, { recipeId: 'b:taart', addedAt: nov(2, 9) }]; // added before the start: still a week dish
    expect(progress(rule, { log, plannedCooks: more })).toEqual({ current: 2, target: 2, done: true });
    expect(progress(rule, { log })).toMatchObject({ current: 0 });
    // Two cooks of one recipe, one week dish: one counts; a cook before the start never counts.
    const twice = [cook('b:soep', nov(9, 7)), cook('b:soep', nov(10, 19)), cook('b:soep', nov(12, 19))];
    expect(progress(rule, { log: twice, plannedCooks: [{ recipeId: 'b:soep', addedAt: nov(1, 9) }] })).toMatchObject({ current: 1 });
    expect(
      progress(rule, { log: twice, plannedCooks: [{ recipeId: 'b:soep', addedAt: nov(1, 9) }, { recipeId: 'b:soep', addedAt: nov(11, 9) }] }),
    ).toMatchObject({ current: 2, done: true });
  });

  it('plannedCooks: feature moments (household-wide, first/last only) are never read', () => {
    const rule: ChallengeRule = { kind: 'plannedCooks', n: 2 };
    const log = [cook('b:soep', nov(10, 19)), cook('b:pasta', nov(11, 19))];
    // Another member's 'surprise' and 'planCook' on the day of this member's cook: no progress.
    const features = [
      { id: 'surprise', at: nov(10, 17) },
      { id: 'planCook', at: nov(10, 19) },
    ];
    expect(progress(rule, { log, features })).toMatchObject({ current: 0 });
    // Two week dishes cooked on two days: reachable (was capped at 1 by the first/last moments).
    const plannedCooks = [
      { recipeId: 'b:soep', addedAt: nov(9, 9) },
      { recipeId: 'b:pasta', addedAt: nov(9, 9) },
    ];
    expect(progress(rule, { log, features, plannedCooks })).toEqual({ current: 2, target: 2, done: true });
  });
});

// ---------------------------------------------------------------------------- normalize

describe('normalizeChallenges', () => {
  const good = {
    id: 'drie-keer-vega',
    nl: { name: 'Drie keer vega', description: 'Kook {n} keer vegetarisch' },
    en: { name: 'Veggie three times', description: 'Cook vegetarian {n} times' },
    rule: { kind: 'cooksWithTag', tag: 'vegetarisch', n: 3 },
    term: 'week',
    xp: 250,
    weight: 1,
    icon: '🥦',
  };

  it('keeps usable entries and skips garbage without throwing', () => {
    expect(normalizeChallenges(null)).toEqual([]);
    expect(normalizeChallenges({})).toEqual([]);
    const out = normalizeChallenges([
      good,
      null,
      'x',
      { ...good, id: '' },
      { ...good, id: 'a', nl: { name: 'x' } },
      { ...good, id: 'b', rule: { kind: 'onbekend', n: 1 } },
      { ...good, id: 'c', rule: { kind: 'cooks', n: 0 } },
      { ...good, id: 'd', term: 'jaar' },
      { ...good, id: 'e', weight: 4 },
      { ...good, id: 'f', xp: -5 },
      { ...good, id: 'g', rule: { kind: 'distinctDays', n: 0 } },
      { ...good, id: 'h', rule: { kind: 'categories', categories: [] } },
      { ...good, id: 'i', rule: { kind: 'cooksWithTag', n: 2 } },
      { ...good, xp: 999 }, // duplicate id: the first stays
    ]);
    expect(out).toEqual([good]);
  });

  it('normalizes every rule kind; categories are deduplicated; a missing icon becomes 🎯', () => {
    const rules = [
      { kind: 'cooks', n: 5 },
      { kind: 'cooksInCategory', category: 'pasta', n: 2 },
      { kind: 'newCuisines', n: 1 },
      { kind: 'newRecipes', n: 2 },
      { kind: 'photos', n: 3 },
      { kind: 'distinctDays', n: 5 },
      { kind: 'categories', categories: ['soep', 'salade', 'soep'] },
      { kind: 'plannedCooks', n: 2 },
    ];
    const out = normalizeChallenges(rules.map((rule, i) => ({ ...good, id: 'r' + i, rule, icon: i === 0 ? undefined : '⭐' })));
    expect(out.map((c) => c.rule)).toEqual([...rules.slice(0, 6), { kind: 'categories', categories: ['soep', 'salade'] }, rules[7]]);
    expect(out[0]?.icon).toBe('🎯');
  });
});

describe('history helpers', () => {
  const row = (id: string, startedAt: string, xp = 250): DoneChallenge => ({ id, memberId: 'p:aaaaaaaa', startedAt, finishedAt: startedAt, xp });

  it('normalizeDoneChallenges drops garbage and dedupes on id + startedAt', () => {
    const a = row('a', nov(1));
    expect(normalizeDoneChallenges([a, { ...a, xp: 999 }, row('a', nov(2)), { id: 'x' }, null, { ...a, id: 'b', xp: -1 }])).toEqual([a, row('a', nov(2))]);
    expect(normalizeDoneChallenges('x')).toEqual([]);
    expect(doneKey(a)).toBe('a|' + nov(1));
  });

  it('mergeDoneChallenges only grows: local first, then what only the file has', () => {
    const a = row('a', nov(1));
    const b = row('b', nov(2));
    expect(mergeDoneChallenges([a], [b, a])).toEqual([a, b]);
    expect(mergeDoneChallenges([a, b], [])).toEqual([a, b]);
  });

  it('normalizeActiveChallenges: memberId → a valid challenge or null', () => {
    expect(normalizeActiveChallenges({ 'p:a': ACTIVE, 'p:b': null, 'p:c': { id: 'x' }, '': ACTIVE })).toEqual({ 'p:a': ACTIVE, 'p:b': null, 'p:c': null });
    expect(normalizeActiveChallenges([])).toEqual({});
  });
});

// ---------------------------------------------------------------------------- validator + data

describe('validateChallenges', () => {
  const refs = refsFromData(readDictionaryData('.'));
  const base = normalizeChallenges(challengesJson);

  it('data/challenges.json: 30 challenges, valid, all normalize', () => {
    const r = validateChallenges(challengesJson, refs);
    expect(r.errors).toEqual([]);
    expect(base).toHaveLength(30);
    expect(new Set(base.map((c) => c.id)).size).toBe(30);
  });

  it('reports count, ids, languages, term, distinctDays n < 2, xp, weight and unknown refs', () => {
    const rows = JSON.parse(JSON.stringify(challengesJson)) as Array<Record<string, unknown>>;
    rows[1]!['id'] = rows[0]!['id'];
    rows[2]!['en'] = { name: 'x', description: '' };
    rows[3]!['term'] = 'jaar';
    rows[4]!['xp'] = 50;
    rows[5]!['weight'] = 0;
    rows[6]!['rule'] = { kind: 'cooksWithTag', tag: 'onbekend', n: 1 };
    rows[7]!['rule'] = { kind: 'categories', categories: ['soep', 'geen-categorie'] };
    rows[8]!['rule'] = { kind: 'distinctDays', n: 1 };
    rows[9]!['rule'] = { kind: 'cooks' };
    rows.pop();
    const errors = validateChallenges(rows, refs).errors.join('\n');
    expect(errors).toContain('exactly 30');
    expect(errors).toContain('duplicate id');
    expect(errors).toContain('"en.description"');
    expect(errors).toContain('"term"');
    expect(errors).toContain('"xp" must be an integer 100..2000');
    expect(errors).toContain('"weight"');
    expect(errors).toContain('rule.tag "onbekend"');
    expect(errors).toContain('category "geen-categorie"');
    expect(errors).toContain('rule.n must be an integer >= 2 for kind "distinctDays"');
    expect(errors).toContain('rule.n must be an integer >= 1');
    expect(validateChallenges({}, refs).errors).toEqual(['challenges.json: must be an array of challenges.']);
  });
});
