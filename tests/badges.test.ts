// Badge evaluation semantics (docs/phase-5-spec.md Block C item 1, extended by
// docs/specs/badges-avatar.md §2a–§2c and §6a for block 6D-2a). These tests PIN the semantics:
// per rule kind one earned and one progress case, the ISO-week streak across a year boundary,
// letter folding, unknown recipeIds in the log, normalizeBadges with garbage input and the cap of
// `current` at `target`; ladders (tiers, tierFor, badgeXp), seasons, the new rule kinds and the
// restore merge helpers. Plus a smoke test of the shipped catalogue data/badges.json (§2d).
import { describe, expect, it } from 'vitest';
import badgesJson from '../data/badges.json';
import {
  BADGE_GROUPS,
  TIER_COLOURS,
  badgeXp,
  evaluateBadges,
  inSeason,
  isLadder,
  isoWeekKey,
  mergeDonateHearts,
  mergeEarned,
  normalizeBadges,
  normalizeEarned,
  parseSeasonWindow,
  tierFor,
  type Badge,
  type BadgeFacts,
  type BadgeRule,
  type BadgeStatus,
  type PhotoRow,
} from '../src/domain/badges';
import type { CookLogEntry, Recipe } from '../src/domain/model';
import type { XpEvent, XpState } from '../src/domain/xp';

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
    categoriesTotal: 11,
    ownRecipes: 0,
    received: 0,
    shared: 0,
    photos: 0,
    photoRows: [],
    features: {},
    householdMembers: 1,
    donorLevel: 0,
    ...over,
  };
}

function badge(rule: BadgeRule, id = 'test', extra: Partial<Badge> = {}): Badge {
  return {
    id,
    nl: { name: 'Testbadge', description: 'Omschrijving' },
    en: { name: 'Test badge', description: 'Description' },
    icon: '⭐',
    rule,
    group: 'koken',
    ...extra,
  };
}

/** Evaluate one rule (plus optional badge fields such as `season` or `tiers`) against the facts. */
function status(rule: BadgeRule, f: BadgeFacts, extra: Partial<Badge> = {}): BadgeStatus {
  const out = evaluateBadges([badge(rule, 'test', extra)], f);
  expect(out).toHaveLength(1);
  return out[0] as BadgeStatus;
}

/** The COOK thresholds of §2d. */
const COOK = [5, 10, 25, 50, 100, 250, 500, 1000];
/** The TAG thresholds of §2d (also CAT, ING, WEEKDAY). */
const TAG = [3, 10, 25, 50, 100, 200, 350, 500];

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
  // `photos` counts the (member-filtered) photoRows since 6D-2a; `photos: number` stays = rows.length.
  const f = facts({ ownRecipes: 5, received: 2, shared: 7, photos: 1, photoRows: [{ recipeId: 'u:a', memberId: 'p:aaaaaaaa', at: '2026-01-01T12:00:00Z' }] });

  it('ownRecipes / received / shared come straight from the facts; photos = photoRows', () => {
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
    // one-offs: tier 0/1, maxTier 1
    expect(out.map((s) => [s.tier, s.maxTier])).toEqual([[0, 1], [0, 1]]);
    const done = evaluateBadges(badges, facts({ log: [entry('u:a')] }));
    expect(done[0]).toMatchObject({ earned: true, tier: 1, maxTier: 1 });
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
        group: 'koken', // missing group → 'koken'
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

  it('accepts every new rule kind of §2b with its parameters', () => {
    const rules: unknown[] = [
      { kind: 'fiveStar', n: 1 },
      { kind: 'photoRecipes', n: 1 },
      { kind: 'photosOfOneRecipe', n: 5 },
      { kind: 'streakDays', n: 3 },
      { kind: 'fullWeeks', n: 1 },
      { kind: 'classics', n: 3 },
      { kind: 'cuisines', n: 2 },
      { kind: 'householdMembers', n: 2 },
      { kind: 'cooks', n: 2 },
      { kind: 'donor', n: 1 },
      { kind: 'cuisine', id: 'italiaans', n: 1 },
      { kind: 'allCategories' },
      { kind: 'seasonCooks', n: 1 },
      { kind: 'weekdayCooks', days: [6, 0], n: 1 },
      { kind: 'cookHour', from: 0, to: 4, n: 1 },
      { kind: 'sameRecipeDays', n: 3 },
      { kind: 'calendar', when: 'friday-13', n: 1 },
      { kind: 'calendar', when: 'leap-day', n: 1 },
      { kind: 'feature', id: 'timer', n: 1 },
      { kind: 'retryAfterOneStar', n: 1 },
      { kind: 'comeback', days: 365, n: 1 },
      { kind: 'overcooked', n: 1 },
    ];
    const out = normalizeBadges(rules.map((rule, i) => ({ ...valid, id: `b${i}`, rule })));
    expect(out.map((b) => b.rule)).toEqual(rules);
  });

  it('rejects new rule kinds with unusable parameters', () => {
    const out = normalizeBadges(
      [
        { kind: 'cuisine', n: 1 }, // no id
        { kind: 'weekdayCooks', days: [], n: 1 },
        { kind: 'weekdayCooks', days: [7], n: 1 },
        { kind: 'weekdayCooks', n: 1 },
        { kind: 'cookHour', from: 5, to: 3, n: 1 },
        { kind: 'cookHour', from: 0, to: 24, n: 1 },
        { kind: 'sameRecipeDays' }, // n is required here
        { kind: 'calendar', when: 'easter', n: 1 },
        { kind: 'feature', id: 'kijken', n: 1 },
        { kind: 'feature', id: 'overcooked', n: 1 }, // not a feature event (§2c)
        { kind: 'comeback', days: 0, n: 1 },
        { kind: 'overcooked', n: 0 },
      ].map((rule, i) => ({ ...valid, id: `x${i}`, rule })),
    );
    expect(out).toEqual([]);
  });

  it('defaults an unknown or missing group to koken and keeps a valid one', () => {
    const out = normalizeBadges([
      { ...valid, id: 'a' },
      { ...valid, id: 'b', group: 'onzin' },
      { ...valid, id: 'c', group: 'samen' },
    ]);
    expect(out.map((b) => b.group)).toEqual(['koken', 'koken', 'samen']);
  });

  it('keeps valid tiers (a ladder drops rule.n) and leaves out invalid ones', () => {
    const out = normalizeBadges([
      { ...valid, id: 'seven', tiers: COOK.slice(0, 7) },
      { ...valid, id: 'nine', tiers: [...COOK, 2000] },
      { ...valid, id: 'flat', tiers: [5, 10, 10, 50, 100, 250, 500, 1000] },
      { ...valid, id: 'down', tiers: [10, 5, 25, 50, 100, 250, 500, 1000] },
      { ...valid, id: 'zero', tiers: [0, 5, 25, 50, 100, 250, 500, 1000] },
      { ...valid, id: 'frac', tiers: [1.5, 5, 25, 50, 100, 250, 500, 1000] },
      { ...valid, id: 'ladder', rule: { kind: 'cookCount' }, tiers: COOK },
      { ...valid, id: 'both', rule: { kind: 'cookCount', n: 5 }, tiers: COOK },
      { ...valid, id: 'plain', rule: { kind: 'letters' }, tiers: COOK }, // a plain kind is never a ladder
    ]);
    expect(out.map((b) => [b.id, b.tiers])).toEqual([
      ['seven', undefined],
      ['nine', undefined],
      ['flat', undefined],
      ['down', undefined],
      ['zero', undefined],
      ['frac', undefined],
      ['ladder', COOK],
      ['both', COOK],
      ['plain', undefined],
    ]);
    expect(out.find((b) => b.id === 'ladder')?.rule).toEqual({ kind: 'cookCount' });
    expect(out.find((b) => b.id === 'both')?.rule).toEqual({ kind: 'cookCount' });
    // invalid tiers and no n: nothing to measure against → skipped
    expect(normalizeBadges([{ ...valid, rule: { kind: 'cookCount' }, tiers: COOK.slice(1) }])).toEqual([]);
  });

  it('keeps hidden/retired only when true; geheim is always hidden', () => {
    const out = normalizeBadges([
      { ...valid, id: 'ja', hidden: 'ja' },
      { ...valid, id: 'one', hidden: 1 },
      { ...valid, id: 'yes', hidden: true },
      { ...valid, id: 'secret', group: 'geheim' },
      { ...valid, id: 'old', retired: true }, // no replacedBy: a data error for the validator, the badge stays
      { ...valid, id: 'old2', retired: 'yes', replacedBy: 'huiskok' },
    ]);
    expect(out.map((b) => [b.id, b.hidden, b.retired, b.replacedBy])).toEqual([
      ['ja', undefined, undefined, undefined],
      ['one', undefined, undefined, undefined],
      ['yes', true, undefined, undefined],
      ['secret', true, undefined, undefined],
      ['old', undefined, true, undefined],
      ['old2', undefined, undefined, 'huiskok'],
    ]);
  });

  it('keeps season only with two valid MM-DD strings', () => {
    const rule = { kind: 'seasonCooks', n: 1 };
    const out = normalizeBadges([
      { ...valid, rule, id: 'ok', season: { from: '12-21', to: '03-19' } },
      { ...valid, rule, id: 'leap', season: { from: '02-29', to: '02-29' } },
      { ...valid, rule, id: 'noto', season: { from: '12-21' } },
      { ...valid, rule, id: 'month', season: { from: '13-01', to: '01-02' } },
      { ...valid, rule, id: 'day', season: { from: '02-30', to: '03-01' } },
      { ...valid, rule, id: 'format', season: { from: '1-5', to: '01-06' } },
      { ...valid, rule, id: 'str', season: '12-21..03-19' },
    ]);
    expect(out.map((b) => [b.id, b.season])).toEqual([
      ['ok', { from: '12-21', to: '03-19' }],
      ['leap', { from: '02-29', to: '02-29' }],
      ['noto', undefined],
      ['month', undefined],
      ['day', undefined],
      ['format', undefined],
      ['str', undefined],
    ]);
  });

  it('keeps unlock only with a non-empty part (tier only 1..8) and xp only as an integer ≥ 0', () => {
    const out = normalizeBadges([
      { ...valid, id: 'a', unlock: { tier: 2 } },
      { ...valid, id: 'b', unlock: { part: '' } },
      { ...valid, id: 'c', unlock: { part: 'hat-cheese', tier: 3 } },
      { ...valid, id: 'd', unlock: { part: 'pin-heart' } },
      { ...valid, id: 'e', unlock: { part: 'hat-pan', tier: 9 } },
      { ...valid, id: 'f', xp: -1 },
      { ...valid, id: 'g', xp: 0 },
      { ...valid, id: 'h', xp: 100 },
      { ...valid, id: 'i', xp: 2.5 },
      { ...valid, id: 'j', xp: '100' },
    ]);
    expect(out.map((b) => [b.id, b.unlock, b.xp])).toEqual([
      ['a', undefined, undefined],
      ['b', undefined, undefined],
      ['c', { part: 'hat-cheese', tier: 3 }, undefined],
      ['d', { part: 'pin-heart' }, undefined],
      ['e', { part: 'hat-pan' }, undefined],
      ['f', undefined, undefined],
      ['g', undefined, 0],
      ['h', undefined, 100],
      ['i', undefined, undefined],
      ['j', undefined, undefined],
    ]);
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


// ---------------------------------------------------------------------------- ladders and XP (§2a)

/** `n` cooks of one recipe, one per hour from 2024-01-01 (no global day counter involved). */
function cooks(n: number): CookLogEntry[] {
  return Array.from({ length: n }, (_, i) => entry('u:a', new Date(Date.UTC(2024, 0, 1) + i * 3_600_000).toISOString()));
}

describe('ladders: tierFor and progress towards the next tier', () => {
  const ladder = badge({ kind: 'cookCount' }, 'huiskok', { tiers: COOK });

  it('0 cooks → tier 0, current 0, target 5', () => {
    expect(evaluateBadges([ladder], facts())[0]).toMatchObject({ earned: false, tier: 0, maxTier: 8, current: 0, target: 5 });
  });

  it('7 cooks → tier 1, current 7, target 10', () => {
    expect(evaluateBadges([ladder], facts({ log: cooks(7) }))[0]).toMatchObject({ earned: true, tier: 1, maxTier: 8, current: 7, target: 10 });
  });

  it('1000 cooks → tier 8, current = target = 1000; 1200 → the same (capped)', () => {
    expect(evaluateBadges([ladder], facts({ log: cooks(1000) }))[0]).toMatchObject({ earned: true, tier: 8, current: 1000, target: 1000 });
    expect(evaluateBadges([ladder], facts({ log: cooks(1200) }))[0]).toMatchObject({ earned: true, tier: 8, current: 1000, target: 1000 });
  });

  it('tierFor counts the thresholds reached', () => {
    expect(isLadder(ladder)).toBe(true);
    expect([0, 4, 5, 9, 10, 999, 1000, 5000].map((c) => tierFor(ladder, c))).toEqual([0, 0, 1, 1, 2, 7, 8, 8]);
  });

  it('tierFor of a one-off: 0/1 against rule.n, or against the given target for a plain kind', () => {
    const once = badge({ kind: 'cookCount', n: 3 });
    expect(isLadder(once)).toBe(false);
    expect([tierFor(once, 2), tierFor(once, 3), tierFor(once, 9)]).toEqual([0, 1, 1]);
    const letters = badge({ kind: 'letters' });
    expect(tierFor(letters, 26)).toBe(0);
    expect(tierFor(letters, 25, 26)).toBe(0);
    expect(tierFor(letters, 26, 26)).toBe(1);
  });

  it('a ladder on an id kind counts like its one-off', () => {
    const tag = badge({ kind: 'tag', id: 'snel' }, 'snelle-jelle', { tiers: TAG });
    const r = recipe('u:snel', 'Snel', { tags: ['snel'] });
    const f = facts({ recipes: recipeMap(r), log: [entry(r.id), entry(r.id), entry(r.id), entry(r.id)] });
    expect(evaluateBadges([tag], f)[0]).toMatchObject({ earned: true, tier: 1, current: 4, target: 10 });
  });

  it('exports the eight groups in page order and the eight tier colours', () => {
    expect(BADGE_GROUPS).toEqual(['koken', 'ontdekken', 'keukens', 'seizoenen', 'samen', 'foto', 'reeksen', 'geheim']);
    expect(TIER_COLOURS).toEqual(['geel', 'groen', 'blauw', 'rood', 'brons', 'zilver', 'goud', 'platina']);
  });
});

describe('evaluateBadges: retired badges', () => {
  it('skips retired badges: two badges, one retired → one status', () => {
    const out = evaluateBadges(
      [
        badge({ kind: 'cookCount', n: 1 }, 'keukenbaas', { retired: true, replacedBy: 'huiskok' }),
        badge({ kind: 'cookCount', n: 1 }, 'eerste-hap'),
      ],
      facts({ log: [entry('u:a')] }),
    );
    expect(out.map((s) => s.badge.id)).toEqual(['eerste-hap']);
  });
});

describe('badgeXp', () => {
  const st = (b: Badge, tier: number): BadgeStatus => ({
    badge: b,
    earned: tier >= 1,
    current: 0,
    target: 1,
    tier,
    maxTier: isLadder(b) ? 8 : 1,
  });

  it('ladder: Σ 50·k for every reached tier k (tier 3 → 300)', () => {
    const ladder = badge({ kind: 'cookCount' }, 'huiskok', { tiers: COOK });
    expect(badgeXp(st(ladder, 3))).toBe(300);
    expect(badgeXp(st(ladder, 1))).toBe(50);
    expect(badgeXp(st(ladder, 8))).toBe(1800);
    expect(badgeXp(st(ladder, 0))).toBe(0);
  });

  it('one-off: xp ?? (hidden ? 250 : 50) when earned; 0 when not earned', () => {
    const plain = badge({ kind: 'cookCount', n: 1 });
    expect(badgeXp(st(plain, 1))).toBe(50);
    const secret = badge({ kind: 'cookHour', from: 0, to: 4, n: 1 }, 'nachtbraker', { group: 'geheim', hidden: true });
    expect(badgeXp(st(secret, 1))).toBe(250);
    const discoverer = badge({ kind: 'feature', id: 'voice', n: 1 }, 'stemkok', { group: 'geheim', hidden: true, xp: 100 });
    expect(badgeXp(st(discoverer, 1))).toBe(100);
    const heart = badge({ kind: 'donor', n: 1 }, 'hartje', { group: 'samen', hidden: true, xp: 0 });
    expect(badgeXp(st(heart, 1))).toBe(0);
    expect(badgeXp(st(plain, 0))).toBe(0);
    expect(badgeXp(st(secret, 0))).toBe(0);
  });
});

// ---------------------------------------------------------------------------- new rule kinds (§2b)

describe('evaluateBadges: fiveStar, classics, cuisine(s), allCategories', () => {
  it('fiveStar counts cooks with stars === 5', () => {
    const f = facts({ log: [entry('u:a', undefined, 5), entry('u:a', undefined, 5), entry('u:a', undefined, 4)] });
    expect(status({ kind: 'fiveStar', n: 5 }, f)).toMatchObject({ earned: false, current: 2, target: 5 });
  });

  it('classics counts DISTINCT cooked classics that exist', () => {
    const recipes = recipeMap(recipe('b:a', 'A'), recipe('b:b', 'B'), recipe('u:c', 'C'));
    const f = facts({ recipes, log: [entry('b:a'), entry('b:a'), entry('b:b'), entry('u:c'), entry('b:ghost')] });
    expect(status({ kind: 'classics', n: 3 }, f)).toMatchObject({ earned: false, current: 2, target: 3 });
  });

  it('cuisine counts cooks of recipes with that cuisine; cuisines counts distinct non-null cuisines', () => {
    const it1 = recipe('u:it1', 'Pizza', { cuisine: 'italiaans' });
    const it2 = recipe('u:it2', 'Risotto', { cuisine: 'italiaans' });
    const fr = recipe('u:fr', 'Ratatouille', { cuisine: 'frans' });
    const none = recipe('u:none', 'Stamppot', { cuisine: null });
    const bare = recipe('u:bare', 'Brood'); // no cuisine field at all
    const f = facts({
      recipes: recipeMap(it1, it2, fr, none, bare),
      log: [entry(it1.id), entry(it1.id), entry(it2.id), entry(bare.id), entry(fr.id), entry(none.id)],
    });
    expect(status({ kind: 'cuisine', id: 'italiaans', n: 5 }, f)).toMatchObject({ current: 3 });
    expect(status({ kind: 'cuisine', id: 'japans', n: 1 }, f)).toMatchObject({ current: 0 });
    expect(status({ kind: 'cuisines', n: 4 }, f)).toMatchObject({ earned: false, current: 2, target: 4 });
  });

  it('allCategories: distinct cooked categories against categoriesTotal', () => {
    const soep = recipe('u:soep', 'Soep', { category: 'soep' });
    const soep2 = recipe('u:soep2', 'Andere soep', { category: 'soep' });
    const pasta = recipe('u:pasta', 'Pasta', { category: 'pasta' });
    const f = facts({ recipes: recipeMap(soep, soep2, pasta), log: [entry(soep.id), entry(soep2.id), entry(pasta.id)] });
    expect(status({ kind: 'allCategories' }, f)).toMatchObject({ earned: false, current: 2, target: 11, tier: 0, maxTier: 1 });
    expect(status({ kind: 'allCategories' }, { ...f, categoriesTotal: 2 })).toMatchObject({ earned: true, current: 2, target: 2, tier: 1 });
  });
});

describe('seasons: parseSeasonWindow, inSeason and seasonCooks', () => {
  it('parses MM-DD windows and checks them inclusively, wrapping the turn of the year', () => {
    expect(parseSeasonWindow({ from: '12-21', to: '03-19' })).toEqual({ from: [12, 21], to: [3, 19] });
    expect(parseSeasonWindow({ from: '13-01', to: '03-19' })).toBeNull();
    expect(parseSeasonWindow({ from: '02-30', to: '03-19' })).toBeNull();
    const winter = { from: '12-21', to: '03-19' };
    expect(inSeason([1, 10], winter)).toBe(true);
    expect(inSeason([3, 19], winter)).toBe(true);
    expect(inSeason([3, 20], winter)).toBe(false);
    expect(inSeason([12, 21], winter)).toBe(true);
    expect(inSeason([12, 20], winter)).toBe(false);
    expect(inSeason([6, 1], { from: '03-20', to: '06-20' })).toBe(true);
    expect(inSeason([6, 21], { from: '03-20', to: '06-20' })).toBe(false);
    expect(inSeason([1, 1], { from: 'x', to: 'y' })).toBe(false);
  });

  const rule: BadgeRule = { kind: 'seasonCooks', n: 60 };

  it('winter 12-21..03-19: 10 Jan and 21 Dec count, 20 Mar and 20 Dec do not', () => {
    const f = facts({
      log: [
        entry('u:a', localIso(2026, 0, 10)),
        entry('u:a', localIso(2026, 2, 20)),
        entry('u:a', localIso(2025, 11, 21)),
        entry('u:a', localIso(2025, 11, 20)),
      ],
    });
    expect(status(rule, f, { season: { from: '12-21', to: '03-19' } })).toMatchObject({ current: 2 });
  });

  it('Christmas 12-24..12-26: 24, 25 and 26 Dec count, 23 and 27 Dec do not', () => {
    const f = facts({ log: [23, 24, 25, 26, 27].map((d) => entry('u:a', localIso(2025, 11, d))) });
    expect(status(rule, f, { season: { from: '12-24', to: '12-26' } })).toMatchObject({ current: 3 });
  });

  it('Valentine 02-14..02-14: only 14 Feb', () => {
    const f = facts({ log: [13, 14, 15].map((d) => entry('u:a', localIso(2026, 1, d))) });
    expect(status(rule, f, { season: { from: '02-14', to: '02-14' } })).toMatchObject({ current: 1 });
  });

  it('uses the LOCAL day (late on 20 Dec is not winter, just after midnight on 21 Dec is)', () => {
    const f = facts({ log: [entry('u:a', localIso(2025, 11, 20, 23, 30)), entry('u:a', localIso(2025, 11, 21, 0, 30))] });
    expect(status(rule, f, { season: { from: '12-21', to: '03-19' } })).toMatchObject({ current: 1 });
  });

  it('without a valid season nothing counts', () => {
    const f = facts({ log: [entry('u:a', localIso(2026, 0, 10))] });
    expect(status(rule, f)).toMatchObject({ current: 0 });
    expect(status(rule, f, { season: { from: '1-1', to: '12-31' } })).toMatchObject({ current: 0 });
  });
});

describe('evaluateBadges: weekdayCooks', () => {
  // 2026-03-07 is a Saturday, 2026-03-08 a Sunday, 2026-03-09 a Monday.
  const f = facts({ log: [entry('u:a', localIso(2026, 2, 7)), entry('u:a', localIso(2026, 2, 8)), entry('u:a', localIso(2026, 2, 9))] });

  it('[6, 0]: Saturday and Sunday count, Monday not', () => {
    expect(status({ kind: 'weekdayCooks', days: [6, 0], n: 3 }, f)).toMatchObject({ current: 2 });
  });

  it('[1]: only Monday', () => {
    expect(status({ kind: 'weekdayCooks', days: [1], n: 3 }, f)).toMatchObject({ current: 1 });
  });
});

describe('evaluateBadges: cookHour', () => {
  const at = (h: number, m: number, s = 0, ms = 0): string => new Date(2026, 2, 10, h, m, s, ms).toISOString();

  it('0..4: 00:30 and 04:59 count, 05:00 does not', () => {
    const f = facts({ log: [entry('u:a', at(0, 30)), entry('u:a', at(4, 59)), entry('u:a', at(5, 0))] });
    expect(status({ kind: 'cookHour', from: 0, to: 4, n: 5 }, f)).toMatchObject({ current: 2 });
  });

  it('exactly 12:00:00.000 local (the cookedAtForDay marker) never counts; 12:00:01 does', () => {
    const rule: BadgeRule = { kind: 'cookHour', from: 12, to: 12, n: 1 };
    expect(status(rule, facts({ log: [entry('u:a', at(12, 0, 0, 0))] }))).toMatchObject({ earned: false, current: 0 });
    expect(status(rule, facts({ log: [entry('u:a', at(12, 0, 1))] }))).toMatchObject({ earned: true, current: 1 });
  });
});

describe('evaluateBadges: sameRecipeDays', () => {
  const day = (d: number, h = 18): string => localIso(2026, 2, d, h);
  const rule: BadgeRule = { kind: 'sameRecipeDays', n: 3 };

  it('days 1-2-3 of the same recipe → earned', () => {
    const f = facts({ log: [entry('u:a', day(1)), entry('u:a', day(2)), entry('u:a', day(3))] });
    expect(status(rule, f)).toMatchObject({ earned: true, current: 3, target: 3 });
  });

  it('days 1-2-4 → current 2', () => {
    const f = facts({ log: [entry('u:a', day(1)), entry('u:a', day(2)), entry('u:a', day(4))] });
    expect(status(rule, f)).toMatchObject({ earned: false, current: 2 });
  });

  it('two cooks on day 2 count as one day', () => {
    const f = facts({ log: [entry('u:a', day(1)), entry('u:a', day(2)), entry('u:a', day(2, 20))] });
    expect(status(rule, f)).toMatchObject({ earned: false, current: 2 });
  });

  it('another recipe in between does not break the run (counted per recipe)', () => {
    const f = facts({ log: [entry('u:a', day(1)), entry('u:b', day(2, 12)), entry('u:a', day(2)), entry('u:a', day(3))] });
    expect(status(rule, f)).toMatchObject({ earned: true, current: 3 });
    // ... but two different recipes on consecutive days are not "the same recipe"
    const g = facts({ log: [entry('u:a', day(1)), entry('u:b', day(2)), entry('u:a', day(3))] });
    expect(status(rule, g)).toMatchObject({ earned: false, current: 1 });
  });
});

describe('evaluateBadges: calendar', () => {
  it('friday-13: 2026-02-13 and 2026-03-13 (Fridays) count, 2026-02-12 not', () => {
    const f = facts({ log: [entry('u:a', localIso(2026, 1, 13)), entry('u:a', localIso(2026, 2, 13)), entry('u:a', localIso(2026, 1, 12))] });
    expect(status({ kind: 'calendar', when: 'friday-13', n: 5 }, f)).toMatchObject({ current: 2 });
  });

  it('leap-day: 2028-02-29 counts, 2028-02-28 not', () => {
    const f = facts({ log: [entry('u:a', localIso(2028, 1, 29)), entry('u:a', localIso(2028, 1, 28))] });
    expect(status({ kind: 'calendar', when: 'leap-day', n: 1 }, f)).toMatchObject({ earned: true, current: 1 });
  });
});

describe('evaluateBadges: feature', () => {
  it('reads facts.features[id] ?? 0', () => {
    expect(status({ kind: 'feature', id: 'timer', n: 5 }, facts({ features: { timer: 4 } }))).toMatchObject({ earned: false, current: 4, target: 5 });
    expect(status({ kind: 'feature', id: 'timer', n: 1 }, facts({ features: { timer: 4 } }))).toMatchObject({ earned: true, current: 1 });
    expect(status({ kind: 'feature', id: 'voice', n: 1 }, facts({ features: { timer: 4 } }))).toMatchObject({ earned: false, current: 0 });
  });
});

describe('evaluateBadges: retryAfterOneStar', () => {
  const rule: BadgeRule = { kind: 'retryAfterOneStar', n: 1 };

  it('one star on day 1, cooked again on day 5 → 1', () => {
    const f = facts({ log: [entry('u:a', localIso(2026, 2, 1, 18), 1), entry('u:a', localIso(2026, 2, 5, 18))] });
    expect(status(rule, f)).toMatchObject({ earned: true, current: 1 });
  });

  it('only the one-star cook → 0', () => {
    expect(status(rule, facts({ log: [entry('u:a', localIso(2026, 2, 1, 18), 1)] }))).toMatchObject({ earned: false, current: 0 });
  });

  it('cooked again BEFORE the one-star cook → 0', () => {
    const f = facts({ log: [entry('u:a', localIso(2026, 2, 1, 18)), entry('u:a', localIso(2026, 2, 5, 18), 1)] });
    expect(status(rule, f)).toMatchObject({ earned: false, current: 0 });
  });

  it('counts recipes, not cooks', () => {
    const f = facts({
      log: [
        entry('u:a', localIso(2026, 2, 1, 18), 1),
        entry('u:a', localIso(2026, 2, 2, 18)),
        entry('u:a', localIso(2026, 2, 3, 18)),
        entry('u:b', localIso(2026, 2, 4, 18), 1),
        entry('u:b', localIso(2026, 2, 6, 18), 4),
      ],
    });
    expect(status({ kind: 'retryAfterOneStar', n: 5 }, f)).toMatchObject({ current: 2 });
  });
});

describe('evaluateBadges: comeback', () => {
  const rule: BadgeRule = { kind: 'comeback', days: 365, n: 1 };

  it('the same recipe on 2025-01-01 and 2026-01-02 → 1', () => {
    const f = facts({ log: [entry('u:a', localIso(2025, 0, 1)), entry('u:a', localIso(2026, 0, 2))] });
    expect(status(rule, f)).toMatchObject({ earned: true, current: 1 });
  });

  it('2025-01-01 and 2025-12-01 → 0; a different recipe does not count', () => {
    expect(status(rule, facts({ log: [entry('u:a', localIso(2025, 0, 1)), entry('u:a', localIso(2025, 11, 1))] }))).toMatchObject({ current: 0 });
    expect(status(rule, facts({ log: [entry('u:a', localIso(2025, 0, 1)), entry('u:b', localIso(2026, 0, 2))] }))).toMatchObject({ current: 0 });
  });
});

describe('evaluateBadges: streakDays and fullWeeks', () => {
  it('streakDays goes through longestDayStreak (3 days in a row → 3)', () => {
    const f = facts({ log: [1, 2, 3].map((d) => entry('u:a', localIso(2026, 2, d, 18))) });
    expect(status({ kind: 'streakDays', n: 7 }, f)).toMatchObject({ earned: false, current: 3, target: 7 });
    const days = badge({ kind: 'streakDays' }, 'dagelijkse-kost', { tiers: [3, 7, 14, 30, 60, 100, 200, 365] });
    expect(evaluateBadges([days], f)[0]).toMatchObject({ tier: 1, current: 3, target: 7 });
  });

  // 2026-03-09 is a Monday; 2026-03-16 the next one.
  const week = (mondayDate: number, count = 7): CookLogEntry[] =>
    Array.from({ length: count }, (_, i) => entry('u:a', localIso(2026, 2, mondayDate + i, 18)));
  const rule: BadgeRule = { kind: 'fullWeeks', n: 5 };

  it('Monday to Sunday of one ISO week → 1; six days → 0', () => {
    expect(status(rule, facts({ log: week(9) }))).toMatchObject({ current: 1 });
    expect(status(rule, facts({ log: week(9, 6) }))).toMatchObject({ current: 0 });
  });

  it('seven days that straddle two ISO weeks are not a full week', () => {
    expect(status(rule, facts({ log: week(10) }))).toMatchObject({ current: 0 });
  });

  it('two full weeks → 2', () => {
    expect(status(rule, facts({ log: [...week(9), ...week(16)] }))).toMatchObject({ current: 2 });
  });

  it('the week over the turn of the year (2025-12-29 … 2026-01-04) → 1', () => {
    const log = [29, 30, 31]
      .map((d) => entry('u:a', localIso(2025, 11, d, 18)))
      .concat([1, 2, 3, 4].map((d) => entry('u:a', localIso(2026, 0, d, 18))));
    expect(status(rule, facts({ log }))).toMatchObject({ current: 1 });
  });
});

describe('evaluateBadges: photos, photoRecipes, photosOfOneRecipe', () => {
  const row = (recipeId: string, i: number): PhotoRow => ({
    recipeId,
    memberId: 'p:aaaaaaaa',
    at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
  });

  it('photos counts the (member-filtered) rows', () => {
    const f = facts({ photoRows: [row('u:a', 0), row('u:a', 1), row('u:b', 2)] });
    expect(status({ kind: 'photos', n: 10 }, f)).toMatchObject({ current: 3 });
  });

  it('photoRecipes: 3 photos of 2 recipes → 2', () => {
    const f = facts({ photoRows: [row('u:a', 0), row('u:a', 1), row('u:b', 2)] });
    expect(status({ kind: 'photoRecipes', n: 3 }, f)).toMatchObject({ earned: false, current: 2 });
  });

  it('photosOfOneRecipe n 5: five of one recipe → earned; 4 + 1 → current 4', () => {
    const five = facts({ photoRows: [0, 1, 2, 3, 4].map((i) => row('u:a', i)) });
    expect(status({ kind: 'photosOfOneRecipe', n: 5 }, five)).toMatchObject({ earned: true, current: 5 });
    const split = facts({ photoRows: [row('u:a', 0), row('u:a', 1), row('u:a', 2), row('u:a', 3), row('u:b', 4)] });
    expect(status({ kind: 'photosOfOneRecipe', n: 5 }, split)).toMatchObject({ earned: false, current: 4 });
  });
});

describe('evaluateBadges: householdMembers, cooks, donor, overcooked', () => {
  it('householdMembers reads facts.householdMembers (1 → 1/2)', () => {
    expect(status({ kind: 'householdMembers', n: 2 }, facts({ householdMembers: 1 }))).toMatchObject({ earned: false, current: 1, target: 2 });
    expect(status({ kind: 'householdMembers', n: 2 }, facts({ householdMembers: 3 }))).toMatchObject({ earned: true, current: 2 });
  });

  it('cooks counts the distinct profileIds in the log', () => {
    const log = [entry('u:a'), { ...entry('u:a'), profileId: 'p:bbbbbbbb' }, entry('u:b')];
    expect(status({ kind: 'cooks', n: 2 }, facts({ log }))).toMatchObject({ earned: true, current: 2 });
    expect(status({ kind: 'cooks', n: 2 }, facts({ log: [entry('u:a')] }))).toMatchObject({ earned: false, current: 1 });
  });

  it('donor reads facts.donorLevel (1 → earned, 0 → 0/1)', () => {
    expect(status({ kind: 'donor', n: 1 }, facts({ donorLevel: 1 }))).toMatchObject({ earned: true, current: 1, target: 1 });
    expect(status({ kind: 'donor', n: 1 }, facts({ donorLevel: 0 }))).toMatchObject({ earned: false, current: 0, target: 1 });
  });

  /** A minimal XpState with the given events. */
  function xpState(events: XpEvent[]): XpState {
    return {
      rulesVersion: 1,
      total: 0,
      level: 1,
      levelStart: 0,
      nextAt: 0,
      streak: { current: 0, best: 0, lastDay: null, freeDayUsed: false },
      cookDays: [],
      events,
      byKey: new Map(events.map((e) => [e.key, e])),
    };
  }
  const event = (key: string, crit: XpEvent['crit']): XpEvent => ({ kind: 'cook', key, base: 100, factor: 1, xp: 100, crit, reason: null });

  it("overcooked counts XP events with crit 'overcooked'; without facts.xp it is 0/1", () => {
    const rule: BadgeRule = { kind: 'overcooked', n: 1 };
    expect(status(rule, facts({ xp: xpState([event('a', 'overcooked')]) }))).toMatchObject({ earned: true, current: 1 });
    expect(status(rule, facts({ xp: xpState([event('a', 'cooked'), event('b', null)]) }))).toMatchObject({ earned: false, current: 0 });
    expect(status(rule, facts())).toMatchObject({ earned: false, current: 0, target: 1 });
  });
});

// ---------------------------------------------------------------------------- restore merges (§2g)

describe('mergeEarned / normalizeEarned', () => {
  it('unites per key, keeps the order (local first), removes duplicates; id@k stays a string', () => {
    const merged = mergeEarned(
      { 'p:a': ['eerste-hap', 'huiskok@1'], all: ['gulle-gever@1'] },
      { 'p:a': ['huiskok@1', 'huiskok@2', 'eerste-hap'], 'p:b': ['zuivelvrije-ziel'] },
    );
    expect(merged).toEqual({ 'p:a': ['eerste-hap', 'huiskok@1', 'huiskok@2'], all: ['gulle-gever@1'], 'p:b': ['zuivelvrije-ziel'] });
    expect(Object.keys(merged)).toEqual(['p:a', 'all', 'p:b']);
    expect(mergeEarned({ x: ['a', 'a', 'b'] }, {})).toEqual({ x: ['a', 'b'] });
  });

  it('is tolerant: garbage on either side is dropped, never an exception', () => {
    expect(mergeEarned(null, 'x')).toEqual({});
    expect(mergeEarned({ x: [1, 'a', null] }, { y: 'nope', z: ['b'] })).toEqual({ x: ['a'], z: ['b'] });
    expect(normalizeEarned([['a']])).toEqual({});
    expect(normalizeEarned({ m: ['a', 2] })).toEqual({ m: ['a'] });
  });
});

describe('mergeDonateHearts', () => {
  it('takes the max per member and drops garbage', () => {
    expect(mergeDonateHearts({ 'p:a': 1, 'p:b': 0 }, { 'p:a': 0, 'p:b': 1, 'p:c': 1 })).toEqual({ 'p:a': 1, 'p:b': 1, 'p:c': 1 });
    expect(mergeDonateHearts({ 'p:a': -1, 'p:b': 'x', 'p:c': 1.5 }, null)).toEqual({});
    expect(mergeDonateHearts(undefined, { 'p:a': 2 })).toEqual({ 'p:a': 2 });
  });
});

// ---------------------------------------------------------------------------- data/badges.json

describe('data/badges.json (catalogue smoke, §2d)', () => {
  const raw = badgesJson as unknown[];
  const catalogue = normalizeBadges(badgesJson);
  /** The 44 ids from before 6D-2 (43 of phase 5 + zuivelvrije-ziel of 6B): `badges.earned` points at them. */
  const OLD_IDS = [
    'eerste-hap', 'huiskok', 'keukenbaas', 'chef-kok', 'proever', 'ontdekkingsreiziger', 'culinaire-avonturier',
    'van-a-tot-z', 'op-dreef', 'vaste-prik', 'halverwege-het-boek', 'het-hele-boek', 'eigen-inbreng',
    'receptenschrijver', 'kookboekauteur', 'sterrenregen', 'kritische-tong', 'gulle-gever', 'verzamelaar',
    'eerste-kiekje', 'foodfotograaf', 'fishlover', 'pastafarian', 'souperheld', 'bladgoud', 'korrelkenner',
    'noedelninja', 'stamppotstamper', 'carnivoor', 'wokmeester', 'oventovenaar', 'groenteheld',
    'plantaardige-pionier', 'glutenvrijbuiter', 'zuivelvrije-ziel', 'snelle-jelle', 'wereldreiziger', 'zomerkok',
    'winterwarmer', 'feestbeest', 'saffraankenner', 'ansjovisfan', 'kappertjeskenner', 'citroengrasfluisteraar',
  ];

  it('every entry normalizes; at least 140 badges with unique ids', () => {
    expect(OLD_IDS).toHaveLength(44);
    expect(catalogue).toHaveLength(raw.length);
    expect(catalogue.length).toBeGreaterThanOrEqual(140);
    expect(new Set(catalogue.map((b) => b.id)).size).toBe(catalogue.length);
  });

  it('keeps all 44 old ids', () => {
    const ids = new Set(catalogue.map((b) => b.id));
    expect(OLD_IDS.filter((id) => !ids.has(id))).toEqual([]);
  });

  it('retires exactly the six of §2d, each replaced by a live ladder', () => {
    const retired = catalogue.filter((b) => b.retired === true).map((b) => `${b.id}>${b.replacedBy ?? ''}`);
    expect(retired.sort()).toEqual(
      [
        'chef-kok>huiskok',
        'culinaire-avonturier>ontdekkingsreiziger',
        'keukenbaas>huiskok',
        'kookboekauteur>receptenschrijver',
        'proever>ontdekkingsreiziger',
        'vaste-prik>op-dreef',
      ].sort(),
    );
    for (const b of catalogue.filter((x) => x.retired === true)) {
      const to = catalogue.find((x) => x.id === b.replacedBy);
      expect(to?.retired).toBeUndefined();
      expect(to !== undefined && isLadder(to)).toBe(true);
    }
  });

  it('every ladder has {n} in both descriptions', () => {
    const missing = catalogue
      .filter((b) => isLadder(b) && !(b.nl.description.includes('{n}') && b.en.description.includes('{n}')))
      .map((b) => b.id);
    expect(missing).toEqual([]);
  });

  it('every geheim badge is hidden', () => {
    const raws = raw as Array<Record<string, unknown>>;
    const notHidden = raws.filter((b) => b['group'] === 'geheim' && b['hidden'] !== true).map((b) => b['id']);
    expect(notHidden).toEqual([]);
    expect(catalogue.filter((b) => b.group === 'geheim').every((b) => b.hidden === true)).toBe(true);
  });

  it('evaluates as a whole on empty facts: retired ones left out, nothing earned', () => {
    const out = evaluateBadges(catalogue, facts());
    expect(out).toHaveLength(catalogue.filter((b) => b.retired !== true).length);
    expect(out.filter((s) => s.earned).map((s) => s.badge.id)).toEqual([]);
  });

  it('"Zuivelvrije ziel" keeps its id and becomes the ladder "tag lactosevrij" [TAG]', () => {
    const def = catalogue.find((b) => b.id === 'zuivelvrije-ziel') as Badge;
    expect(def).toMatchObject({
      nl: { name: 'Zuivelvrije ziel', description: 'Kook {n} lactosevrije gerechten' },
      en: { name: 'Dairy-free soul', description: 'Cook {n} lactose-free dishes' },
      icon: '🥥',
      rule: { kind: 'tag', id: 'lactosevrij' },
      group: 'koken',
      tiers: TAG,
    });
    const free = recipe('b:ratatouille', 'Ratatouille', { tags: ['vegetarisch', 'vegan', 'lactosevrij'] });
    const optie = recipe('u:pasta', 'Pasta', { tags: ['lactosevrij-optie'] });
    const f = facts({ recipes: recipeMap(free, optie), log: [entry(free.id), entry(free.id), entry(optie.id)] });
    // two cooks of the tagged recipe; the "-optie" tag does not count
    expect(evaluateBadges([def], f)).toMatchObject([{ badge: { id: 'zuivelvrije-ziel' }, earned: false, tier: 0, current: 2, target: 3 }]);
  });
});
