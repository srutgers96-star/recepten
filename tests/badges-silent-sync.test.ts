// Block 6D-2b (decision Fable, 29 Oct 2026, docs/STATUS.md "6D-2a"): the silent first registration
// in src/badges.ts. The first badge check after the 6D-2 update registers every badge and tier
// reached so far without a toast (setting `badges.catalogSynced` below 2), afterwards toasts as
// usual. Only the pure cores are tested; no database is opened (like badges-registration.test.ts).
import { describe, expect, it } from 'vitest';
import { CATALOG_SYNC_VERSION, needsCatalogSync, registerNewTiers, registerSilently } from '../src/badges';
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

describe('needsCatalogSync', () => {
  it('is true while badges.catalogSynced is absent, garbage or below the 6D-2 version', () => {
    expect(CATALOG_SYNC_VERSION).toBe(2);
    expect(needsCatalogSync(undefined)).toBe(true);
    expect(needsCatalogSync(0)).toBe(true);
    expect(needsCatalogSync(1)).toBe(true);
    expect(needsCatalogSync('2')).toBe(true);
    expect(needsCatalogSync(null)).toBe(true);
  });

  it('is false once the silent round has run', () => {
    expect(needsCatalogSync(2)).toBe(false);
    expect(needsCatalogSync(3)).toBe(false);
  });
});

describe('registerSilently', () => {
  it('registers every reached badge and every tier for each key, toasting nothing', () => {
    const statuses = new Map<string, BadgeStatus[]>([
      ['p1', [ladderAt(3, 27), oneOffStatus(true)]],
      ['all', [ladderAt(4, 60), oneOffStatus(true)]],
    ]);
    const { earned, changed } = registerSilently({}, statuses);
    expect(changed).toBe(true);
    expect(earned['p1']).toEqual(['huiskok@1', 'huiskok@2', 'huiskok@3', 'eerste-hap']);
    expect(earned['all']).toEqual(['huiskok@1', 'huiskok@2', 'huiskok@3', 'huiskok@4', 'eerste-hap']);
    // After the round, the same statuses reach nothing new: no toast for anything already there.
    expect(registerNewTiers(statuses.get('p1')!, earned['p1']!).reached).toEqual([]);
    expect(registerNewTiers(statuses.get('all')!, earned['all']!).reached).toEqual([]);
  });

  it('keeps what was registered (plain pre-6D-2 ids too) and other keys untouched', () => {
    const before = { p1: ['huiskok', 'oude-badge'], p2: ['eerste-hap'] };
    const { earned } = registerSilently(before, new Map([['p1', [ladderAt(2, 12)]]]));
    // A plain 'huiskok' counted as tier 1 known: only tier 2 is added.
    expect(earned['p1']).toEqual(['huiskok', 'oude-badge', 'huiskok@2']);
    expect(earned['p2']).toEqual(['eerste-hap']);
    // The input record is not mutated.
    expect(before.p1).toEqual(['huiskok', 'oude-badge']);
  });

  it('reports no change when everything reached is registered already', () => {
    const { earned, changed } = registerSilently({ p1: ['eerste-hap'] }, new Map([['p1', [oneOffStatus(true), ladderAt(0, 3)]]]));
    expect(changed).toBe(false);
    expect(earned['p1']).toEqual(['eerste-hap']);
  });

  it('never lowers a registered tier when the live count dropped', () => {
    const { earned, changed } = registerSilently({ p1: ['huiskok@1', 'huiskok@2', 'huiskok@3'] }, new Map([['p1', [ladderAt(1, 7)]]]));
    expect(changed).toBe(false);
    expect(earned['p1']).toEqual(['huiskok@1', 'huiskok@2', 'huiskok@3']);
  });
});
