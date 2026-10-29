// The whole shipped catalogue (data/badges.json) on the small two-member log of
// tests/fixtures/badge-log.ts (docs/specs/badges-avatar.md §6b): the special moments in the log
// earn exactly the badges they should, per member and on "Samen", and every status stays sane.
import { describe, expect, it } from 'vitest';
import badgesJson from '../data/badges.json';
import { evaluateBadges, normalizeBadges, type BadgeFacts, type BadgeStatus } from '../src/domain/badges';
import { ANNA, BADGE_LOG, BADGE_LOG_RECIPES, BRAM } from './fixtures/badge-log';

const catalogue = normalizeBadges(badgesJson);

function factsFor(memberId: string | 'all'): BadgeFacts {
  return {
    log: memberId === 'all' ? [...BADGE_LOG] : BADGE_LOG.filter((e) => e.profileId === memberId),
    recipes: new Map(BADGE_LOG_RECIPES.map((r) => [r.id, r])),
    classicsTotal: 216,
    categoriesTotal: 15,
    ownRecipes: 0,
    received: 0,
    shared: 0,
    photos: 0,
    photoRows: [],
    features: {},
    householdMembers: 2,
    donorLevel: 0,
    sharedRecipeIds: new Set(),
    boughtRecipeIds: new Set(),
  };
}

function byId(memberId: string | 'all'): Map<string, BadgeStatus> {
  return new Map(evaluateBadges(catalogue, factsFor(memberId)).map((s) => [s.badge.id, s]));
}

const anna = byId(ANNA);
const bram = byId(BRAM);
const all = byId('all');

describe('fixture badge-log on the whole catalogue (§6b)', () => {
  it('has 40 entries, 20 per member', () => {
    expect(BADGE_LOG).toHaveLength(40);
    expect(BADGE_LOG.filter((e) => e.profileId === ANNA)).toHaveLength(20);
  });

  it('every status is sane: 0 ≤ current ≤ target, tier ≤ maxTier, earned ⇔ tier ≥ 1', () => {
    for (const map of [anna, bram, all]) {
      for (const s of map.values()) {
        expect(s.current).toBeGreaterThanOrEqual(0);
        expect(s.current).toBeLessThanOrEqual(s.target);
        expect(s.tier).toBeLessThanOrEqual(s.maxTier);
        expect(s.earned).toBe(s.tier >= 1);
      }
    }
  });

  it('Anna: second chance, Christmas, a full week; not the night owl or three in a row', () => {
    expect(anna.get('tweede-kans')?.earned).toBe(true);
    expect(anna.get('kerstkok')?.tier).toBe(1);
    expect(anna.get('volle-week')?.tier).toBe(1);
    expect(anna.get('sinterklaas')?.tier).toBe(1);
    expect(anna.get('valentijn')?.tier).toBe(1);
    expect(anna.get('oud-en-nieuw')?.tier).toBe(1);
    expect(anna.get('nachtbraker')?.earned).toBe(false);
    expect(anna.get('drie-op-een-rij')?.current).toBe(1);
  });

  it('Bram: three in a row, night owl, Friday the 13th, Christmas; no second chance, no full week', () => {
    expect(bram.get('drie-op-een-rij')?.earned).toBe(true);
    expect(bram.get('nachtbraker')?.earned).toBe(true);
    expect(bram.get('vrijdag-de-13e')?.earned).toBe(true);
    expect(bram.get('kerstkok')?.tier).toBe(1);
    expect(bram.get('tweede-kans')?.earned).toBe(false);
    expect(bram.get('volle-week')?.tier).toBe(0);
  });

  it('the backdated noon cook counts as a cook (20 for Bram: tier 2, on the way to 25)', () => {
    expect(bram.get('huiskok')?.tier).toBe(2); // 5 · 10 reached
    expect(bram.get('huiskok')?.current).toBe(20);
    expect(bram.get('huiskok')?.target).toBe(25);
  });

  it('Samen: two members cooked; 40 cooks; the counts of both together', () => {
    expect(all.get('samen-in-de-keuken')?.earned).toBe(true);
    expect(all.get('huiskok')?.tier).toBe(3);
    expect(all.get('huiskok')?.current).toBe(40); // 5 · 10 · 25 reached, next 50
    expect(all.get('huiskok')?.target).toBe(50);
    expect(all.get('kerstkok')?.tier).toBe(2); // 24 and 25 December: HOLIDAY 1 · 2
    expect(all.get('wereldburger')?.tier).toBe(1); // hollands, italiaans, indiaas: CUISINES 2
  });
});
