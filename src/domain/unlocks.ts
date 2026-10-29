// Unlocks (docs/specs/xp-levels.md §2e, block "6D-3" there = 6D-4a in docs/specs/README.md §1):
// confetti styles, timer sounds, the sound on Cooked!, cook-mode typefaces and features that a
// level or a badge (optionally at a tier) sets free. Framework-free: no preact, no dexie, no clock,
// and no JSON import (the list lives in data/unlocks.json and arrives here as `unknown` through
// `normalizeUnlocks`, which keeps only usable entries; src/unlocks.ts loads the file).
//
// Unlocking is per member (their level and their own badges), but a phone offers the UNION of
// what its local profiles unlocked (src/unlocks.ts `unlockedOnPhone`); the on/off switches are
// per phone (`unlocks.disabled`). This module only answers "which ids does this person have" and
// "which unlocks lie in this stretch of levels / come with this badge".
import type { XpBadgeFact } from './xp.ts';

export type UnlockKind = 'confetti' | 'timerSound' | 'cookedSound' | 'cookFont' | 'feature';

/** Every kind, in the order the Unlocked page shows its cards (§1f). */
export const UNLOCK_KINDS: readonly UnlockKind[] = ['confetti', 'timerSound', 'cookedSound', 'cookFont', 'feature'];

/** A level (2…100 in the data), or a badge; `level` on a badge = the tier it needs (ladder, 1…8). */
export type UnlockBy = { level: number } | { badge: string; level?: number };

export interface Unlock {
  /** Kebab-case, forever (invariant 1 in spirit: `unlocks.disabled` and `unlocks.announced` hold it). */
  id: string;
  kind: UnlockKind;
  by: UnlockBy;
  icon: string;
  /** The id the engine uses: confetti style, TimerSound, typeface ('chalk' | 'hand'), feature. */
  value: string;
  nl: { name: string; description: string };
  en: { name: string; description: string };
}

/** Mirrors MAX_LEVEL in src/domain/levels.ts (not imported: that module imports data/levels.json). */
const MAX_LEVEL = 100;
/** A ladder badge has 8 tiers (src/domain/badges.ts). */
const MAX_TIER = 8;
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KIND_SET: ReadonlySet<string> = new Set(UNLOCK_KINDS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A trimmed non-empty string, else null. */
function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function intIn(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function normalizeName(value: unknown): { name: string; description: string } | null {
  if (!isRecord(value)) return null;
  const name = nonEmptyString(value['name']);
  const description = nonEmptyString(value['description']);
  return name !== null && description !== null ? { name, description } : null;
}

/**
 * `{ badge: id, level? }` when `badge` is present (a `level` there is the badge tier 1…8; an invalid
 * one is dropped, so tier 1 counts), else `{ level: 1…100 }`; anything else null.
 */
function normalizeBy(value: unknown): UnlockBy | null {
  if (!isRecord(value)) return null;
  if ('badge' in value) {
    const badge = nonEmptyString(value['badge']);
    if (badge === null || !ID_RE.test(badge)) return null;
    const tier = intIn(value['level'], 1, MAX_TIER);
    return tier !== null ? { badge, level: tier } : { badge };
  }
  const level = intIn(value['level'], 1, MAX_LEVEL);
  return level !== null ? { level } : null;
}

/**
 * Normalize the raw contents of data/unlocks.json. Tolerant, like normalizeBadges: unusable entries
 * are skipped (never an exception, never console output). An unlock is usable with a kebab-case
 * id, a known kind, a valid `by`, a non-empty icon and value, and both languages (name +
 * description). Duplicate ids: the first wins. File order is kept (the Unlocked page and the
 * level-up sheet show unlocks in that order). Unknown keys are not carried over.
 */
export function normalizeUnlocks(data: unknown): Unlock[] {
  if (!Array.isArray(data)) return [];
  const out: Unlock[] = [];
  const seen = new Set<string>();
  for (const raw of data) {
    if (!isRecord(raw)) continue;
    const id = nonEmptyString(raw['id']);
    const kind = raw['kind'];
    const by = normalizeBy(raw['by']);
    const icon = nonEmptyString(raw['icon']);
    const value = nonEmptyString(raw['value']);
    const nl = normalizeName(raw['nl']);
    const en = normalizeName(raw['en']);
    if (id === null || !ID_RE.test(id) || seen.has(id)) continue;
    if (typeof kind !== 'string' || !KIND_SET.has(kind)) continue;
    if (by === null || icon === null || value === null || nl === null || en === null) continue;
    seen.add(id);
    out.push({ id, kind: kind as UnlockKind, by, icon, value, nl, en });
  }
  return out;
}

/** The badge tier a badge unlock needs (1 when it names none). */
function tierNeeded(by: { badge: string; level?: number }): number {
  return by.level ?? 1;
}

/**
 * The ids this person has unlocked: every level unlock with `by.level ≤ who.level`, and every
 * badge unlock whose badge is in `who.badges` at (at least) the tier it needs. `who.badges` are the
 * badges earned on the member's own tab (`XpBadgeFact.level` = the reached tier, one-off = 1).
 */
export function unlockedIds(unlocks: readonly Unlock[], who: { level: number; badges: readonly XpBadgeFact[] }): Set<string> {
  const tiers = new Map<string, number>();
  for (const b of who.badges) tiers.set(b.id, Math.max(tiers.get(b.id) ?? 0, b.level));
  const out = new Set<string>();
  for (const u of unlocks) {
    const by = u.by;
    if ('badge' in by) {
      if ((tiers.get(by.badge) ?? 0) >= tierNeeded(by)) out.add(u.id);
    } else if (by.level <= who.level) {
      out.add(u.id);
    }
  }
  return out;
}

/**
 * The level unlocks a step from level `fromExclusive` to `toInclusive` sets free (several levels at
 * once = all of the levels in between; §1d), in file order. Badge unlocks are never in here.
 */
export function unlocksForLevels(unlocks: readonly Unlock[], fromExclusive: number, toInclusive: number): Unlock[] {
  return unlocks.filter((u) => {
    const by = u.by;
    return !('badge' in by) && by.level > fromExclusive && by.level <= toInclusive;
  });
}

/** The unlocks this badge gives at its reached tier (`badge.level`), in file order. */
export function unlocksForBadge(unlocks: readonly Unlock[], badge: XpBadgeFact): Unlock[] {
  return unlocks.filter((u) => {
    const by = u.by;
    return 'badge' in by && by.badge === badge.id && badge.level >= tierNeeded(by);
  });
}
