// Block 6D-2a (docs/specs/badges-avatar.md §2b "Toasten", §2g): the pure cores of the badge
// registration in src/badges.ts (`badges.earned` strings `id` / `id@k`, sticky tiers, one toast for
// the highest new tier) and of the restore merge in src/db/repo.ts. No database is opened here:
// both modules are imported for their pure exports only, like tests/shopping-clear.test.ts does.
import { describe, expect, it } from 'vitest';
import { knownTiers, registerNewTiers, withKnownTier } from '../src/badges';
import { mergeRestoredSetting } from '../src/db/repo';
import type { Badge, BadgeStatus } from '../src/domain/badges';

const COOK = [5, 10, 25, 50, 100, 250, 500, 1000];

const ladder: Badge = {
  id: 'huiskok',
  nl: { name: 'Huiskok', description: 'Kook {n} keer' },
  en: { name: 'Home cook', description: 'Cook {n} times' },
  icon: '🍲',
  rule: { kind: 'cookCount' },
  group: 'koken',
  tiers: COOK,
};

const oneOff: Badge = {
  id: 'eerste-hap',
  nl: { name: 'Eerste hap', description: 'Kook je eerste gerecht' },
  en: { name: 'First bite', description: 'Cook your first dish' },
  icon: '🍳',
  rule: { kind: 'cookCount', n: 1 },
  group: 'koken',
};

function ladderAt(tier: number, current: number): BadgeStatus {
  const target = COOK[Math.min(tier, 7)] as number;
  return { badge: ladder, earned: tier >= 1, current: Math.min(current, target), target, tier, maxTier: 8 };
}

function oneOffStatus(earned: boolean): BadgeStatus {
  return { badge: oneOff, earned, current: earned ? 1 : 0, target: 1, tier: earned ? 1 : 0, maxTier: 1 };
}

describe('knownTiers', () => {
  it('reads `id@k` as tier k and a plain `id` as tier 1 (an old ladder registration = level 1 known)', () => {
    const k = knownTiers(['eerste-hap', 'huiskok', 'huiskok@3', 'huiskok@2', 'fishlover@1']);
    expect(k.get('eerste-hap')).toBe(1);
    expect(k.get('huiskok')).toBe(3);
    expect(k.get('fishlover')).toBe(1);
    expect(k.has('kaaskop')).toBe(false);
  });
});

describe('registerNewTiers', () => {
  it('registers every passed tier but reports the badge once, for its highest new tier', () => {
    const { list, reached } = registerNewTiers([ladderAt(3, 30)], ['huiskok']);
    expect(list).toEqual(['huiskok', 'huiskok@2', 'huiskok@3']);
    expect(reached).toHaveLength(1);
    expect(reached[0]?.status.tier).toBe(3);
    expect(reached[0]?.before).toBe(1);
  });

  it('a second run with the same statuses adds nothing (never a double toast)', () => {
    const first = registerNewTiers([ladderAt(3, 30), oneOffStatus(true)], []);
    expect(first.list).toEqual(['huiskok@1', 'huiskok@2', 'huiskok@3', 'eerste-hap']);
    const second = registerNewTiers([ladderAt(3, 30), oneOffStatus(true)], first.list);
    expect(second.reached).toEqual([]);
    expect(second.list).toEqual(first.list);
  });

  it('a one-off badge adds its plain id once; a badge not earned adds nothing', () => {
    expect(registerNewTiers([oneOffStatus(true)], []).list).toEqual(['eerste-hap']);
    expect(registerNewTiers([oneOffStatus(true)], ['eerste-hap']).reached).toEqual([]);
    expect(registerNewTiers([oneOffStatus(false), ladderAt(0, 3)], []).reached).toEqual([]);
  });

  it('never removes a registration, also when the count dropped', () => {
    const { list, reached } = registerNewTiers([ladderAt(1, 6)], ['huiskok@1', 'huiskok@2', 'huiskok@3']);
    expect(list).toEqual(['huiskok@1', 'huiskok@2', 'huiskok@3']);
    expect(reached).toEqual([]);
  });
});

describe('withKnownTier (sticky tiers)', () => {
  it('a registered tier above the live one lifts the status; progress goes to the tier after it', () => {
    const s = withKnownTier(ladderAt(1, 7), 3);
    expect(s.tier).toBe(3);
    expect(s.earned).toBe(true);
    expect(s.target).toBe(50);
    expect(s.current).toBe(7);
  });

  it('platinum known: current = target = the last threshold', () => {
    const s = withKnownTier(ladderAt(2, 12), 8);
    expect(s.tier).toBe(8);
    expect(s.current).toBe(1000);
    expect(s.target).toBe(1000);
  });

  it('a registered one-off badge stays earned', () => {
    const s = withKnownTier(oneOffStatus(false), 1);
    expect(s.earned).toBe(true);
    expect(s.tier).toBe(1);
    expect(s.current).toBe(s.target);
  });

  it('a known tier at or below the live one changes nothing', () => {
    const live = ladderAt(4, 60);
    expect(withKnownTier(live, 2)).toBe(live);
    expect(withKnownTier(live, 0)).toBe(live);
  });
});

describe('mergeRestoredSetting (restore, §2g)', () => {
  it('badges.earned: union per member, local order first, duplicates removed', () => {
    const local = { 'p:a': ['eerste-hap', 'huiskok@1'], all: ['gulle-gever@1'] };
    const file = { 'p:a': ['huiskok@1', 'huiskok@2'], 'p:b': ['eerste-hap'] };
    expect(mergeRestoredSetting('badges.earned', local, file)).toEqual({
      'p:a': ['eerste-hap', 'huiskok@1', 'huiskok@2'],
      all: ['gulle-gever@1'],
      'p:b': ['eerste-hap'],
    });
  });

  it('badges.earned: nothing here yet → the file as it is', () => {
    expect(mergeRestoredSetting('badges.earned', undefined, { 'p:a': ['eerste-hap'] })).toEqual({ 'p:a': ['eerste-hap'] });
  });

  it('features.log: n = max, first = min, last = max, per member the max', () => {
    const local = { timer: { n: 3, first: '2026-10-02T10:00:00.000Z', last: '2026-10-20T10:00:00.000Z', by: { 'p:a': 3 } } };
    const file = { timer: { n: 5, first: '2026-10-01T10:00:00.000Z', last: '2026-10-10T10:00:00.000Z', by: { 'p:a': 2, 'p:b': 3 } }, kijken: { n: 1 } };
    expect(mergeRestoredSetting('features.log', local, file)).toEqual({
      timer: { n: 5, first: '2026-10-01T10:00:00.000Z', last: '2026-10-20T10:00:00.000Z', by: { 'p:a': 3, 'p:b': 3 } },
    });
  });

  it('donate.hearts: the max per member', () => {
    expect(mergeRestoredSetting('donate.hearts', { 'p:a': 1 }, { 'p:a': 0, 'p:b': 1 })).toEqual({ 'p:a': 1, 'p:b': 1 });
  });

  it('any other key: the file wins, as before', () => {
    expect(mergeRestoredSetting('badges.enabled', true, false)).toBe(false);
  });
});
