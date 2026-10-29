// Block 6D-2b (docs/specs/badges-avatar.md §1a.2, §1a.3, §1a.8): the pure page model of the badges
// screen against the shipped catalogue. The page counts only visible badges, renders all eight
// groups in BADGE_GROUPS order, and never lets an unearned hidden badge reach the page (the secret
// group shows found badges only; the heart only once it is earned). No DOM, no database.
import { describe, expect, it } from 'vitest';
import badgesJson from '../data/badges.json';
import { BADGE_GROUPS, normalizeBadges, type Badge, type BadgeStatus } from '../src/domain/badges';
import { badgePageModel, isShown } from '../src/screens/BadgesScreen';

const catalogue: Badge[] = normalizeBadges(badgesJson as unknown).filter((b) => b.retired !== true);

function status(badge: Badge, earned: boolean): BadgeStatus {
  const ladder = Array.isArray(badge.tiers);
  return {
    badge,
    earned,
    current: earned ? 1 : 0,
    target: ladder ? (badge.tiers as number[])[earned ? 1 : 0]! : 1,
    tier: earned ? 1 : 0,
    maxTier: ladder ? 8 : 1,
  };
}

const none = catalogue.map((b) => status(b, false));
const byId = (id: string) => catalogue.find((b) => b.id === id)!;

describe('badgePageModel (§1a)', () => {
  it('nothing earned: eight groups in order, visible badges only, the secret group empty', () => {
    const m = badgePageModel(none);
    expect(m.groups.map((g) => g.group)).toEqual([...BADGE_GROUPS]);
    expect(m.total).toBe(catalogue.filter((b) => b.hidden !== true).length);
    expect(m.total).toBe(116);
    expect(m.earned).toBe(0);
    expect(m.secretFound).toBe(0);
    const secret = m.groups.find((g) => g.group === 'geheim')!;
    expect(secret.shown).toEqual([]);
    // No unearned hidden badge anywhere on the page (§1a.8: not even in the DOM).
    for (const g of m.groups) expect(g.shown.every((s) => s.badge.hidden !== true)).toBe(true);
  });

  it('a found secret badge shows in Geheim and counts as found, never in the visible total', () => {
    const secretBadge = catalogue.find((b) => b.group === 'geheim')!;
    const m = badgePageModel(none.map((s) => (s.badge.id === secretBadge.id ? status(s.badge, true) : s)));
    expect(m.secretFound).toBe(1);
    expect(m.groups.find((g) => g.group === 'geheim')!.shown.map((s) => s.badge.id)).toEqual([secretBadge.id]);
    expect(m.total).toBe(116);
    expect(m.earned).toBe(0);
  });

  it('the heart (hidden, group samen) appears in its own group only once earned', () => {
    const heart = byId('hartje');
    expect(heart.hidden).toBe(true);
    expect(heart.group).toBe('samen');
    expect(isShown(status(heart, false))).toBe(false);
    expect(isShown(status(heart, true))).toBe(true);
    const before = badgePageModel(none).groups.find((g) => g.group === 'samen')!;
    const after = badgePageModel(none.map((s) => (s.badge.id === 'hartje' ? status(heart, true) : s))).groups.find((g) => g.group === 'samen')!;
    expect(before.shown.some((s) => s.badge.id === 'hartje')).toBe(false);
    expect(after.shown.some((s) => s.badge.id === 'hartje')).toBe(true);
    expect(after.total).toBe(before.total + 1);
  });

  it('group counts: earned / shown per group, catalogue order kept', () => {
    const m = badgePageModel(none.map((s) => (s.badge.id === 'eerste-hap' || s.badge.id === 'huiskok' ? status(s.badge, true) : s)));
    const koken = m.groups.find((g) => g.group === 'koken')!;
    expect(koken.earned).toBe(2);
    expect(koken.total).toBe(catalogue.filter((b) => b.group === 'koken' && b.hidden !== true).length);
    expect(koken.shown.map((s) => s.badge.id)).toEqual(catalogue.filter((b) => b.group === 'koken' && b.hidden !== true).map((b) => b.id));
    expect(m.earned).toBe(2);
  });
});

// Block 6D-2c ("?" cards, decision 29 Oct 2026): every hidden badge not earned yet becomes a "?"
// card in its own group, after the full cards, in catalogue order; the counts do not change.
describe('badgePageModel mystery cards (6D-2c)', () => {
  const secretIds = catalogue.filter((b) => b.group === 'geheim').map((b) => b.id);

  it('nothing earned: Geheim holds every secret badge as a "?" card, Samen only the heart', () => {
    const m = badgePageModel(none);
    const secret = m.groups.find((g) => g.group === 'geheim')!;
    expect(secret.mystery.map((s) => s.badge.id)).toEqual(secretIds);
    expect(secret.mystery.length).toBe(27);
    expect(m.groups.find((g) => g.group === 'samen')!.mystery.map((s) => s.badge.id)).toEqual(['hartje']);
    for (const g of m.groups) if (g.group !== 'geheim' && g.group !== 'samen') expect(g.mystery).toEqual([]);
    // Counts unchanged: a "?" card is never shown in full and never counted.
    expect(m.secretFound).toBe(0);
    expect(m.total).toBe(116);
    expect(m.groups.find((g) => g.group === 'samen')!.total).toBe(catalogue.filter((b) => b.group === 'samen' && b.hidden !== true).length);
  });

  it('one found: the found card in shown, the rest stays "?" in catalogue order', () => {
    const found = secretIds[3]!;
    const m = badgePageModel(none.map((s) => (s.badge.id === found ? status(s.badge, true) : s)));
    const secret = m.groups.find((g) => g.group === 'geheim')!;
    expect(secret.shown.map((s) => s.badge.id)).toEqual([found]);
    expect(secret.mystery.map((s) => s.badge.id)).toEqual(secretIds.filter((id) => id !== found));
    expect(m.secretFound).toBe(1);
  });

  it('the heart earned: a full card in Samen, no "?" card left there', () => {
    const m = badgePageModel(none.map((s) => (s.badge.id === 'hartje' ? status(s.badge, true) : s)));
    const samen = m.groups.find((g) => g.group === 'samen')!;
    expect(samen.mystery).toEqual([]);
    expect(samen.shown.some((s) => s.badge.id === 'hartje')).toBe(true);
  });
});
