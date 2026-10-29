// Avatar app layer (docs/specs/badges-avatar.md §3c, block 6D-3, builder B). The pure model,
// the library rules and the SVG renderer live in src/domain/avatar.ts; this module only adds what
// needs the app: the normalized data/avatar-parts.json cache, what this member has unlocked (level
// from the XP state, badge tiers from src/badges.ts), the device-local `avatar.seen` list behind
// the "new" dots in the maker, and unique ids for every rendered SVG.
import avatarPartsData from '@data/avatar-parts.json';
import { badgeData, badgeTiersFor } from '@/badges';
import { getSetting, setSetting } from '@/db/repo';
import { normalizeAvatarParts, type AvatarPart } from '@/domain/avatar';
import type { Badge } from '@/domain/badges';
import { levelForXp } from '@/domain/xp';
import { xpStateFor } from '@/xp';

/**
 * Setting `avatar.seen` (device-local, DEVICE_LOCAL_SETTINGS in src/db/repo.ts): the part ids the
 * maker on this phone already showed as unlocked. A free part not in it gets a small dot (§1b.5).
 */
export const AVATAR_SEEN_SETTING = 'avatar.seen';

/** What a member has unlocked: their level and badge id → reached tier (one-off = 1). */
export interface UnlockContext {
  level: number;
  badgeTiers: ReadonlyMap<string, number>;
}

let cachedParts: ReadonlyMap<string, AvatarPart> | null = null;

/**
 * The normalized data/avatar-parts.json by id, in file order (module cache). The badge catalogue
 * goes along, so a ladder badge's part carries the tier it needs (`unlock.tier`, e.g. hat-cheese ←
 * Kaaskop at blue); without it every badge part would count as unlocked from tier 1.
 */
export function avatarParts(): ReadonlyMap<string, AvatarPart> {
  if (!cachedParts) {
    const map = new Map<string, AvatarPart>();
    for (const p of normalizeAvatarParts(avatarPartsData as unknown, badgeData())) map.set(p.id, p);
    cachedParts = map;
  }
  return cachedParts;
}

/** Level (levelForXp over the derived XP total) and reached badge tiers of one member. */
export async function unlockContext(memberId: string): Promise<UnlockContext> {
  const [xp, badgeTiers] = await Promise.all([xpStateFor(memberId), badgeTiersFor(memberId)]);
  return { level: levelForXp(xp.total), badgeTiers };
}

/** The badge that gives this part (`unlock.badge`), or null for a level part or an unknown id. */
export function partBadge(part: AvatarPart): Badge | null {
  const u = part.unlock;
  if (!('badge' in u)) return null;
  return badgeData().find((b) => b.id === u.badge) ?? null;
}

/** `avatar.seen` as a clean list of strings (anything else in the setting is ignored). */
function normalizeSeen(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((x): x is string => typeof x === 'string' && x !== ''))];
}

/** The ids of `ids` that are not in `avatar.seen` yet. */
export async function unseenParts(ids: readonly string[]): Promise<Set<string>> {
  const seen = new Set(normalizeSeen(await getSetting<unknown>(AVATAR_SEEN_SETTING, [])));
  return new Set(ids.filter((id) => !seen.has(id)));
}

let seenWrite: Promise<void> = Promise.resolve();

/**
 * Adds `ids` to `avatar.seen` (a union; nothing is removed). Serialized, so two quick closes never
 * both read the same old list; a failure is logged, never thrown.
 */
export function markPartsSeen(ids: readonly string[]): Promise<void> {
  const run = seenWrite.then(async () => {
    const list = normalizeSeen(await getSetting<unknown>(AVATAR_SEEN_SETTING, []));
    const known = new Set(list);
    const added = ids.filter((id) => typeof id === 'string' && id !== '' && !known.has(id));
    if (added.length === 0) return;
    await setSetting(AVATAR_SEEN_SETTING, [...list, ...new Set(added)]);
  });
  seenWrite = run.catch(() => undefined);
  return run.catch((e: unknown) => {
    console.warn('markPartsSeen', e);
  });
}

let uidCounter = 0;

/** A fresh suffix for the ids inside one rendered avatar SVG (`renderAvatarSvg` opts.uid). */
export function avatarUid(): string {
  uidCounter += 1;
  return 'av' + uidCounter;
}
