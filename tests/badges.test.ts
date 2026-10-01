// Badge evaluation semantics (docs/phase-5-spec.md Block C item 1). These tests PIN the semantics:
// per rule kind one earned and one progress case, the ISO-week streak across a year boundary,
// letter folding, unknown recipeIds in the log, normalizeBadges with garbage input and the cap of
// `current` at `target`.
import { describe, expect, it } from 'vitest';
import {
  evaluateBadges,
  isoWeekKey,
  normalizeBadges,
  type Badge,
  type BadgeFacts,
  type BadgeRule,
  type BadgeStatus,
} from '../src/domain/badges';
import type { CookLogEntry, Recipe } from '../src/domain/model';

// ---------------------------------------------------------------------------- helpers

function recipe(id: string, nameNl: string, over: Partial<Recipe> = {}): Recipe {
  return {
    schema: 2,
    id,
    rev: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    origin: { kind: id.startsWith('b:') ? 'builtin' : 'user' },
    name: { nl: nameNl },
    tags: [],
    servings: 4,
    lines: [],
    steps: [],
    goesWith: [],
    aliases: [],
    ...over,
  };
}

function recipeMap(...recipes: Recipe[]): ReadonlyMap<string, Recipe> {
  return new Map(recipes.map((r) => [r.id, r]));
}

let nextEntryDay = 0;

/** A log entry; without `at` every entry lands on its own day (own ISO week irrelevant here). */
function entry(recipeId: string, at?: string, stars?: number | null): CookLogEntry {
  const when = at ?? new Date(Date.UTC(2026, 0, 1) + nextEntryDay++ * 86_400_000).toISOString();
  return { recipeId, profileId: 'p:aaaaaaaa', at: when, ...(stars === undefined ? {} : { stars }) };
}

function facts(over: Partial<BadgeFacts> = {}): BadgeFacts {
  return {
    log: [],
    recipes: new Map(),
    classicsTotal: 196,
    ownRecipes: 0,
    received: 0,
    shared: 0,
    photos: 0,
    ...over,
  };
}

function badge(rule: BadgeRule, id = 'test'): Badge {
  return {
    id,
    nl: { name: 'Testbadge', description: 'Omschrijving' },
    en: { name: 'Test badge', description: 'Description' },
    icon: '⭐',
    rule,
  };
}

/** Evaluate one rule against the facts. */
function status(rule: BadgeRule, f: BadgeFacts): BadgeStatus {
  const out = evaluateBadges([badge(rule)], f);
  expect(out).toHaveLength(1);
  return out[0] as BadgeStatus;
}

// ---------------------------------------------------------------------------- isoWeekKey

// The week boundary is the LOCAL calendar day (a cook at 00:30 local Monday counts in the new
// week), so these dates are built from local components: the expectations hold in any timezone.

/** ISO string of a LOCAL date/time (what nowIso stores for a cook at that local moment). */
function localIso(y: number, m: number, d: number, h = 12, min = 0): string {
  return new Date(y, m, d, h, min).toISOString();
}

describe('isoWeekKey', () => {
  it('gives ISO 8601 year-week keys with Monday start (local calendar day)', () => {
    expect(isoWeekKey(new Date(2026, 5, 15, 12))).toBe('2026-W25');
    expect(isoWeekKey(new Date(2026, 5, 21, 23, 59, 59))).toBe('2026-W25'); // Sunday, same week
    expect(isoWeekKey(new Date(2026, 5, 22, 0, 0))).toBe('2026-W26'); // next Monday
    expect(isoWeekKey(new Date(2026, 5, 22, 0, 30))).toBe('2026-W26'); // 00:30 local Monday = the NEW week
  });

  it('handles the year boundary (late December belongs to W01 of the next year)', () => {
    // 2026-01-01 is a Thursday, so 2026-W01 starts on Monday 2025-12-29.
    expect(isoWeekKey(new Date(2025, 11, 29))).toBe('2026-W01');
    expect(isoWeekKey(new Date(2025, 11, 28))).toBe('2025-W52');
    expect(isoWeekKey(new Date(2026, 0, 1))).toBe('2026-W01');
  });

  it('handles the year boundary (early January belonging to W53 of the previous year)', () => {
    // 2026-12-31 is a Thursday, so 2026 has 53 ISO weeks and 2027-01-01 (Friday) is 2026-W53.
    expect(isoWeekKey(new Date(2027, 0, 1))).toBe('2026-W53');
    expect(isoWeekKey(new Date(2027, 0, 4))).toBe('2027-W01');
  });
});

// ---------------------------------------------------------------------------- per rule kind

describe('evaluateBadges: counting rules', () => {
  const r = recipe('u:aaaaaaaa', 'Appeltaart');
  const f = facts({
    recipes: recipeMap(r),
    log: [entry(r.id), entry(r.id), entry(r.id)],
  });

  it('cookCount counts every log entry', () => {
    expect(status({ kind: 'cookCount', n: 3 }, f)).toMatchObject({ earned: true, current: 3, target: 3 });
    expect(status({ kind: 'cookCount', n: 10 }, f)).toMatchObject({ earned: false, current: 3, target: 10 });
  });

  it('distinctRecipes counts distinct recipeIds', () => {
    const g = facts({ log: [entry('u:a'), entry('u:a'), entry('u:b')] });
    expect(status({ kind: 'distinctRecipes', n: 2 }, g)).toMatchObject({ earned: true, current: 2, target: 2 });
    expect(status({ kind: 'distinctRecipes', n: 3 }, g)).toMatchObject({ earned: false, current: 2, target: 3 });
  });

  it('reviews counts entries with stars 1–5; everything else is not a review', () => {
    const g = facts({
      log: [
        entry('u:a', undefined, 5),
        entry('u:a', undefined, 1),
        entry('u:a', undefined, null),
        entry('u:a'),
        entry('u:a', undefined, 0),
        entry('u:a', undefined, 6),
      ],
    });
    expect(status({ kind: 'reviews', n: 2 }, g)).toMatchObject({ earned: true, current: 2, target: 2 });
    expect(status({ kind: 'reviews', n: 3 }, g)).toMatchObject({ earned: false, current: 2, target: 3 });
  });

  it('oneStar counts entries with stars === 1', () => {
    const g = facts({ log: [entry('u:a', undefined, 1), entry('u:a', undefined, 1), entry('u:a', undefined, 5)] });
    expect(status({ kind: 'oneStar', n: 2 }, g)).toMatchObject({ earned: true, current: 2, target: 2 });
    expect(status({ kind: 'oneStar', n: 5 }, g)).toMatchObject({ earned: false, current: 2, target: 5 });
  });
});

describe('evaluateBadges: streakWeeks', () => {
  it('finds the LONGEST run of consecutive ISO weeks, not the latest', () => {
    const g = facts({
      log: [
        // weeks 2026-W10, W11, W12 (consecutive), then a gap, then W15
        entry('u:a', localIso(2026, 2, 2, 18)),
        entry('u:a', localIso(2026, 2, 9, 18)),
        entry('u:a', localIso(2026, 2, 15, 18)), // Sunday of W11: same week twice
        entry('u:a', localIso(2026, 2, 16, 18)),
        entry('u:a', localIso(2026, 3, 6, 18)),
      ],
    });
    expect(status({ kind: 'streakWeeks', n: 3 }, g)).toMatchObject({ earned: true, current: 3, target: 3 });
    expect(status({ kind: 'streakWeeks', n: 4 }, g)).toMatchObject({ earned: false, current: 3, target: 4 });
  });

  it('keeps a streak running across the year boundary', () => {
    const g = facts({
      log: [
        entry('u:a', localIso(2025, 11, 22)), // 2025-W52
        entry('u:a', localIso(2025, 11, 30)), // 2026-W01 (starts Monday 2025-12-29)
        entry('u:a', localIso(2026, 0, 7)), // 2026-W02
      ],
    });
    expect(status({ kind: 'streakWeeks', n: 3 }, g)).toMatchObject({ earned: true, current: 3, target: 3 });
  });

  it('counts a cook just after local Monday midnight in the NEW week (not UTC Sunday)', () => {
    const g = facts({
      log: [
        entry('u:a', localIso(2026, 2, 9)), // 2026-W11
        entry('u:a', localIso(2026, 2, 16, 0, 30)), // Monday 00:30 local: W12, the week is not empty
      ],
    });
    expect(status({ kind: 'streakWeeks', n: 2 }, g)).toMatchObject({ earned: true, current: 2, target: 2 });
  });

  it('is 0 for an empty log and ignores unparsable timestamps', () => {
    expect(status({ kind: 'streakWeeks', n: 1 }, facts())).toMatchObject({ earned: false, current: 0, target: 1 });
    const g = facts({ log: [{ recipeId: 'u:a', profileId: 'p:x', at: 'not a date' }] });
    expect(status({ kind: 'streakWeeks', n: 1 }, g)).toMatchObject({ earned: false, current: 0 });
  });
});

describe('evaluateBadges: letters', () => {
  it('folds diacritics and skips non-letter starts, NL name first, else EN', () => {
    const recipes = recipeMap(
      recipe('u:a', 'Érwtensoep'), // É → E
      recipe('u:b', "'t Stoofpotje"), // apostrophe skipped → T
      recipe('u:c', 'IJsbergsla-salade'), // → I
      recipe('u:d', '', { name: { nl: '', en: 'Quiche' } }), // falls back to EN → Q
      recipe('u:e', 'Appeltaart'),
      recipe('u:f', 'eclair'), // lowercase → E (already counted)
      recipe('u:g', '¡!'), // no A–Z letter at all: contributes nothing
    );
    const g = facts({
      recipes,
      log: [entry('u:a'), entry('u:b'), entry('u:c'), entry('u:d'), entry('u:e'), entry('u:f'), entry('u:g')],
    });
    // E, T, I, Q, A = 5 distinct letters; target is always 26
    expect(status({ kind: 'letters' }, g)).toMatchObject({ earned: false, current: 5, target: 26 });
  });

  it('is earned with all 26 initials', () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const recipes = recipeMap(...letters.map((l) => recipe(`u:${l.toLowerCase()}`, `${l}-gerecht`)));
    const g = facts({ recipes, log: letters.map((l) => entry(`u:${l.toLowerCase()}`)) });
    expect(status({ kind: 'letters' }, g)).toMatchObject({ earned: true, current: 26, target: 26 });
  });
});

describe('evaluateBadges: category / tag / ingredient', () => {
  const vis1 = recipe('b:zalm', 'Zalm uit de oven', { category: 'vis', tags: ['oven', 'snel'] });
  const vis2 = recipe('u:kabeljauw', 'Kabeljauw', {
    category: 'vis',
    tags: ['snel'],
    lines: [
      { raw: { nl: '1 g saffraan' }, ing: 'saffraan' },
      { raw: { nl: 'nog een snuf saffraan' }, ing: 'saffraan' }, // same ing twice: one entry = one count
      { raw: { nl: 'zout' }, ing: null },
    ],
  });
  const pasta = recipe('u:pasta', 'Pasta pesto', { category: 'pasta', tags: ['snel'] });
  const f = facts({
    recipes: recipeMap(vis1, vis2, pasta),
    // vis1 cooked twice, vis2 once, pasta once: cooking counts per LOG ENTRY, not distinct
    log: [entry(vis1.id), entry(vis1.id), entry(vis2.id), entry(pasta.id)],
  });

  it('category counts log entries whose recipe has that category', () => {
    expect(status({ kind: 'category', id: 'vis', n: 3 }, f)).toMatchObject({ earned: true, current: 3, target: 3 });
    expect(status({ kind: 'category', id: 'vis', n: 10 }, f)).toMatchObject({ earned: false, current: 3, target: 10 });
    expect(status({ kind: 'category', id: 'soep', n: 1 }, f)).toMatchObject({ earned: false, current: 0 });
  });

  it('tag counts log entries whose recipe has that tag', () => {
    expect(status({ kind: 'tag', id: 'snel', n: 4 }, f)).toMatchObject({ earned: true, current: 4, target: 4 });
    expect(status({ kind: 'tag', id: 'oven', n: 3 }, f)).toMatchObject({ earned: false, current: 2, target: 3 });
  });

  it('ingredient counts log entries whose recipe has a line with ing === id', () => {
    expect(status({ kind: 'ingredient', id: 'saffraan', n: 1 }, f)).toMatchObject({ earned: true, current: 1, target: 1 });
    expect(status({ kind: 'ingredient', id: 'saffraan', n: 2 }, f)).toMatchObject({ earned: false, current: 1, target: 2 });
  });
});

describe('evaluateBadges: classics', () => {
  const classics = [recipe('b:a', 'Aardappelsoep'), recipe('b:b', 'Bami'), recipe('b:c', 'Couscous')];
  const own = recipe('u:x', 'Eigen gerecht');
  const recipes = recipeMap(...classics, own);

  it('allClassics: distinct cooked classics against classicsTotal', () => {
    const g = facts({
      recipes,
      classicsTotal: 3,
      log: [entry('b:a'), entry('b:a'), entry('b:b'), entry('u:x')], // 2 distinct classics
    });
    expect(status({ kind: 'allClassics' }, g)).toMatchObject({ earned: false, current: 2, target: 3 });
    const all = facts({ recipes, classicsTotal: 3, log: [entry('b:a'), entry('b:b'), entry('b:c')] });
    expect(status({ kind: 'allClassics' }, all)).toMatchObject({ earned: true, current: 3, target: 3 });
  });

  it('halfClassics: same current, target = ceil(classicsTotal / 2)', () => {
    const g = facts({ recipes, classicsTotal: 5, log: [entry('b:a'), entry('b:b')] });
    expect(status({ kind: 'halfClassics' }, g)).toMatchObject({ earned: false, current: 2, target: 3 });
    const done = facts({ recipes, classicsTotal: 5, log: [entry('b:a'), entry('b:b'), entry('b:c')] });
    expect(status({ kind: 'halfClassics' }, done)).toMatchObject({ earned: true, current: 3, target: 3 });
  });
});

describe('evaluateBadges: facts counters (household-wide)', () => {
  const f = facts({ ownRecipes: 5, received: 2, shared: 7, photos: 1 });

  it('ownRecipes / received / shared / photos come straight from the facts', () => {
    expect(status({ kind: 'ownRecipes', n: 5 }, f)).toMatchObject({ earned: true, current: 5, target: 5 });
    expect(status({ kind: 'ownRecipes', n: 6 }, f)).toMatchObject({ earned: false, current: 5, target: 6 });
    expect(status({ kind: 'received', n: 2 }, f)).toMatchObject({ earned: true, current: 2, target: 2 });
    expect(status({ kind: 'received', n: 3 }, f)).toMatchObject({ earned: false, current: 2, target: 3 });
    expect(status({ kind: 'shared', n: 7 }, f)).toMatchObject({ earned: true, current: 7, target: 7 });
    expect(status({ kind: 'shared', n: 10 }, f)).toMatchObject({ earned: false, current: 7, target: 10 });
    expect(status({ kind: 'photos', n: 1 }, f)).toMatchObject({ earned: true, current: 1, target: 1 });
    expect(status({ kind: 'photos', n: 4 }, f)).toMatchObject({ earned: false, current: 1, target: 4 });
  });
});

// ---------------------------------------------------------------------------- cross-cutting

describe('evaluateBadges: cross-cutting rules', () => {
  it('unknown recipeIds only count for cookCount/distinctRecipes/reviews/oneStar/streakWeeks', () => {
    const g = facts({
      recipes: new Map(), // nothing resolves — even the 'b:' id is unknown
      classicsTotal: 196,
      log: [
        entry('b:ghost', '2026-03-02T12:00:00Z', 1),
        entry('u:ghost', '2026-03-09T12:00:00Z', 4),
      ],
    });
    expect(status({ kind: 'cookCount', n: 2 }, g)).toMatchObject({ earned: true, current: 2 });
    expect(status({ kind: 'distinctRecipes', n: 2 }, g)).toMatchObject({ earned: true, current: 2 });
    expect(status({ kind: 'reviews', n: 2 }, g)).toMatchObject({ earned: true, current: 2 });
    expect(status({ kind: 'oneStar', n: 1 }, g)).toMatchObject({ earned: true, current: 1 });
    expect(status({ kind: 'streakWeeks', n: 2 }, g)).toMatchObject({ earned: true, current: 2 });
    // ... but nowhere else:
    expect(status({ kind: 'letters' }, g)).toMatchObject({ current: 0 });
    expect(status({ kind: 'allClassics' }, g)).toMatchObject({ current: 0 });
    expect(status({ kind: 'halfClassics' }, g)).toMatchObject({ current: 0 });
    expect(status({ kind: 'category', id: 'vis', n: 1 }, g)).toMatchObject({ current: 0 });
    expect(status({ kind: 'tag', id: 'snel', n: 1 }, g)).toMatchObject({ current: 0 });
    expect(status({ kind: 'ingredient', id: 'saffraan', n: 1 }, g)).toMatchObject({ current: 0 });
  });

  it('caps current at target', () => {
    const g = facts({ log: [entry('u:a'), entry('u:a'), entry('u:b'), entry('u:c'), entry('u:d')], ownRecipes: 99 });
    expect(status({ kind: 'cookCount', n: 2 }, g)).toMatchObject({ earned: true, current: 2, target: 2 });
    expect(status({ kind: 'ownRecipes', n: 10 }, g)).toMatchObject({ earned: true, current: 10, target: 10 });
  });

  it('returns one status per badge, in badge order', () => {
    const badges = [badge({ kind: 'cookCount', n: 1 }, 'one'), badge({ kind: 'letters' }, 'two')];
    const out = evaluateBadges(badges, facts());
    expect(out.map((s) => s.badge.id)).toEqual(['one', 'two']);
    expect(out.map((s) => s.earned)).toEqual([false, false]);
  });
});

// ---------------------------------------------------------------------------- normalizeBadges

describe('normalizeBadges', () => {
  const valid = {
    id: 'fishlover',
    nl: { name: 'Fishlover', description: 'Kook 10 visgerechten' },
    en: { name: 'Fishlover', description: 'Cook 10 fish dishes' },
    icon: '🐟',
    rule: { kind: 'category', id: 'vis', n: 10 },
    tier: 2,
  };

  it('accepts a valid badge and keeps only the known fields', () => {
    const out = normalizeBadges([{ ...valid, extra: 'ignored' }]);
    expect(out).toEqual([
      {
        id: 'fishlover',
        nl: { name: 'Fishlover', description: 'Kook 10 visgerechten' },
        en: { name: 'Fishlover', description: 'Cook 10 fish dishes' },
        icon: '🐟',
        rule: { kind: 'category', id: 'vis', n: 10 },
        tier: 2,
      },
    ]);
  });

  it('returns [] for non-array input, without throwing', () => {
    expect(normalizeBadges(undefined)).toEqual([]);
    expect(normalizeBadges(null)).toEqual([]);
    expect(normalizeBadges('badges')).toEqual([]);
    expect(normalizeBadges({ 0: valid })).toEqual([]);
  });

  it('skips garbage entries but keeps the valid ones', () => {
    const out = normalizeBadges([
      null,
      42,
      'badge',
      [],
      {},
      { ...valid, id: '' }, // empty id
      { ...valid, id: '   ' }, // whitespace-only id
      { ...valid, nl: undefined }, // missing language
      { ...valid, en: { name: 'X' } }, // missing description
      { ...valid, nl: { name: '', description: 'x' } }, // empty name
      { ...valid, icon: '' }, // empty icon
      { ...valid, rule: undefined }, // no rule
      { ...valid, rule: { kind: 'unknownKind', n: 1 } }, // unknown rule kind
      { ...valid, rule: { kind: 'cookCount' } }, // counting rule without n
      { ...valid, rule: { kind: 'cookCount', n: 0 } }, // n must be >= 1
      { ...valid, rule: { kind: 'cookCount', n: 2.5 } }, // n must be an integer
      { ...valid, rule: { kind: 'cookCount', n: '10' } }, // n must be a number
      { ...valid, rule: { kind: 'category', n: 10 } }, // id/n rule without id
      { ...valid, rule: { kind: 'tag', id: '', n: 1 } }, // empty id
      valid,
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('fishlover');
  });

  it('accepts all rule kinds and the field-less kinds without extras', () => {
    const rules: unknown[] = [
      { kind: 'cookCount', n: 1 },
      { kind: 'distinctRecipes', n: 2 },
      { kind: 'ownRecipes', n: 3 },
      { kind: 'reviews', n: 4 },
      { kind: 'oneStar', n: 5 },
      { kind: 'photos', n: 6 },
      { kind: 'shared', n: 7 },
      { kind: 'received', n: 8 },
      { kind: 'streakWeeks', n: 9 },
      { kind: 'category', id: 'vis', n: 10 },
      { kind: 'tag', id: 'snel', n: 11 },
      { kind: 'ingredient', id: 'saffraan', n: 12 },
      { kind: 'letters' },
      { kind: 'allClassics' },
      { kind: 'halfClassics' },
    ];
    const out = normalizeBadges(rules.map((rule, i) => ({ ...valid, id: `b${i}`, rule })));
    expect(out).toHaveLength(rules.length);
    // field-less kinds come back without n/id
    expect(out[12]?.rule).toEqual({ kind: 'letters' });
    expect(out[13]?.rule).toEqual({ kind: 'allClassics' });
    expect(out[14]?.rule).toEqual({ kind: 'halfClassics' });
  });

  it('drops an invalid tier but keeps the badge; keeps a valid tier', () => {
    const out = normalizeBadges([
      { ...valid, id: 'a', tier: 4 },
      { ...valid, id: 'b', tier: 'goud' },
      { ...valid, id: 'c', tier: 3 },
      { ...valid, id: 'd', tier: undefined },
    ]);
    expect(out.map((b) => [b.id, b.tier])).toEqual([
      ['a', undefined],
      ['b', undefined],
      ['c', 3],
      ['d', undefined],
    ]);
  });

  it('normalized badges evaluate without further checks', () => {
    const [b] = normalizeBadges([valid]);
    expect(b).toBeDefined();
    const vis = recipe('b:zalm', 'Zalm', { category: 'vis' });
    const f = facts({ recipes: recipeMap(vis), log: [entry(vis.id), entry(vis.id)] });
    expect(evaluateBadges([b as Badge], f)).toMatchObject([{ earned: false, current: 2, target: 10 }]);
  });
});
