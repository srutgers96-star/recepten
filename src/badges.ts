// Badges app layer (docs/phase-5-spec.md Block C, PLAN.md §0 "Gamification"; catalogue, tiers and
// registration of docs/specs/badges-avatar.md block 6D-2a): the `badges.enabled` setting mirror
// (pattern of src/celebrate.ts / src/sounds.ts), the normalized data/badges.json cache,
// `badgeStatuses(memberId)` that builds BadgeFacts from the repository, and the new-badge
// bookkeeping (`badges.earned`, strings `id` and `id@k`) with the toast signal the shell renders.
// Never in the way: with badges off everything here is a no-op and no UI shows a trace of it.
import { signal } from '@preact/signals';
import badgesData from '@data/badges.json';
import avatarPartsData from '@data/avatar-parts.json';
import { celebrate, celebration } from './celebrate';
import { allRecipes, getHousehold, getSetting, getSharedRecipes, listAllPhotosMeta, listCookLog, setSetting } from '@/db/repo';
import { evaluateBadges, isLadder, normalizeBadges, normalizeEarned, type Badge, type BadgeFacts, type BadgeStatus } from '@/domain/badges';
import { categoriesData } from '@/domain/data';
import { featureCounts, normalizeFeatureLog } from '@/domain/features';
import { membersFrom } from '@/domain/household';
import type { Recipe } from '@/domain/model';
import { profiles } from '@/profile';
import { markXpDirty, settleXp, xpStateFor } from '@/xp';

/** Setting `badges.enabled` (boolean, default true). */
export const BADGES_SETTING = 'badges.enabled';
/**
 * Setting `badges.earned`: Record<memberId | 'all', registered strings>. `id` = a one-off badge
 * (or, from before 6D-2, a badge that is a ladder now: counts as tier 1 known), `id@k` = ladder
 * tier k. Registered = toasted once; never taken back.
 */
export const BADGES_EARNED_SETTING = 'badges.earned';
/** Setting `features.log` (src/domain/features.ts; written by src/features.ts `recordFeature`). */
export const FEATURES_LOG_SETTING = 'features.log';
/** Setting `donate.hearts`: Record<memberId, number> (0/1 for now; the heart, §5c, is built later). */
export const DONATE_HEARTS_SETTING = 'donate.hearts';

/** Mirror of the `badges.enabled` setting (default true). */
export const badgesEnabled = signal(true);

let loaded: Promise<void> | null = null;

/** Reads the `badges.enabled` setting once (idempotent). */
export function loadBadgeSettings(): Promise<void> {
  if (!loaded) {
    loaded = getSetting<unknown>(BADGES_SETTING, true)
      .then((on) => {
        badgesEnabled.value = on !== false;
      })
      .catch(() => undefined);
  }
  return loaded;
}

/** Re-reads the setting from the database (after a restore replaced it). */
export function reloadBadgeSettings(): Promise<void> {
  loaded = null;
  return loadBadgeSettings();
}

/** Sounds.ts pattern (block-B fix): await a load in flight first, so it can never overwrite this write. */
export async function setBadgesEnabled(on: boolean): Promise<void> {
  await loadBadgeSettings();
  badgesEnabled.value = on;
  await setSetting(BADGES_SETTING, on);
}

let cachedBadges: Badge[] | null = null;

/** The normalized data/badges.json (module cache; invalid entries were dropped by normalizeBadges). */
export function badgeData(): Badge[] {
  if (!cachedBadges) {
    cachedBadges = normalizeBadges(badgesData as unknown);
  }
  return cachedBadges;
}

// ---------------------------------------------------------------------------- avatar parts

/**
 * Placeholder for the avatar-part type of block 6D-3 (`AvatarPart` in src/domain/avatar.ts,
 * docs/specs/badges-avatar.md §2f; same fields, `layer` typed loosely). 6D-2a only needs the
 * nl/en name for the toast's second line; 6D-3 replaces this with an import from '@/domain/avatar'.
 */
export interface AvatarPart {
  id: string;
  layer: string;
  nl: string;
  en: string;
  unlock: { level: number } | { badge: string };
  svg: string;
}

let partsById: Map<string, AvatarPart> | null = null;

/** One part of data/avatar-parts.json by id (tolerant read; the validator checks the file). */
function avatarPartById(id: string): AvatarPart | undefined {
  if (!partsById) {
    partsById = new Map();
    const raw: unknown = avatarPartsData;
    if (Array.isArray(raw)) {
      for (const item of raw as unknown[]) {
        if (!item || typeof item !== 'object') continue;
        const p = item as Record<string, unknown>;
        const unlock = p['unlock'];
        if (
          typeof p['id'] === 'string' &&
          typeof p['layer'] === 'string' &&
          typeof p['nl'] === 'string' &&
          typeof p['en'] === 'string' &&
          typeof p['svg'] === 'string' &&
          unlock !== null &&
          typeof unlock === 'object'
        ) {
          partsById.set(p['id'], { id: p['id'], layer: p['layer'], nl: p['nl'], en: p['en'], svg: p['svg'], unlock: unlock as AvatarPart['unlock'] });
        }
      }
    }
  }
  return partsById.get(id);
}

/**
 * The avatar part a step from tier `before` to tier `after` unlocked, if any: a one-off badge's
 * part when it is newly earned, a ladder's part when its `unlock.tier` lies in (before, after].
 */
function unlockedPartFor(badge: Badge, before: number, after: number): AvatarPart | undefined {
  const u = badge.unlock;
  if (!u) return undefined;
  const at = isLadder(badge) ? (u.tier ?? 1) : 1;
  return before < at && after >= at ? avatarPartById(u.part) : undefined;
}

// ---------------------------------------------------------------------------- facts

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** One member's heart level from `donate.hearts`; 'all' = the highest of anyone (§2c). */
function donorLevelFor(raw: unknown, memberId: string | 'all'): number {
  if (!isRecord(raw)) return 0;
  const valid = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : 0);
  if (memberId !== 'all') return valid(raw[memberId]);
  let best = 0;
  for (const v of Object.values(raw)) best = Math.max(best, valid(v));
  return best;
}

/**
 * BadgeFacts for one member (log and photos filtered on the member) or the whole household
 * ('all'). `withXp`: fill `xp` (rule kind 'overcooked') with the member's derived XP state. The
 * XP derivation itself reads the badges (src/xp.ts buildXpFacts) and asks WITHOUT xp, otherwise
 * the two would wait on each other forever; there a registered `overcooked` still counts (sticky).
 */
async function buildFacts(memberId: string | 'all', withXp: boolean): Promise<BadgeFacts> {
  const [recipes, log, shared, photoMeta, featuresRaw, household, heartsRaw, xp] = await Promise.all([
    allRecipes(),
    listCookLog(),
    getSharedRecipes(),
    listAllPhotosMeta(),
    getSetting<unknown>(FEATURES_LOG_SETTING, {}),
    getHousehold(),
    getSetting<unknown>(DONATE_HEARTS_SETTING, {}),
    withXp && memberId !== 'all'
      ? xpStateFor(memberId).catch((e: unknown) => {
          console.warn('badges: xpStateFor', e);
          return undefined;
        })
      : Promise.resolve(undefined),
  ]);
  const byId = new Map<string, Recipe>();
  let classicsTotal = 0;
  let ownRecipes = 0;
  let received = 0;
  for (const r of recipes) {
    byId.set(r.id, r);
    if (r.origin.kind === 'builtin') classicsTotal++;
    else if (r.origin.kind === 'user') ownRecipes++;
    else if (r.origin.kind === 'received') received++;
  }
  // 6D-2a: photos count per member (Photo.memberId); 'Samen' = every photo.
  const photoRows = memberId === 'all' ? photoMeta : photoMeta.filter((p) => p.memberId === memberId);
  return {
    log: memberId === 'all' ? log : log.filter((e) => e.profileId === memberId),
    recipes: byId,
    classicsTotal,
    categoriesTotal: categoriesData.length,
    ownRecipes,
    received,
    shared,
    photos: photoRows.length,
    photoRows,
    features: featureCounts(normalizeFeatureLog(featuresRaw), memberId),
    householdMembers: membersFrom(profiles.value, household).length,
    donorLevel: donorLevelFor(heartsRaw, memberId),
    xp,
  };
}

/** Rule kinds that count household-wide (buildFacts): shown and earned on the "Samen" tab only. */
export const HOUSEHOLD_KINDS: ReadonlySet<string> = new Set(['ownRecipes', 'received', 'shared', 'householdMembers', 'cooks']);

// ---------------------------------------------------------------------------- registration

const TIER_TAG = /^(.+)@([1-8])$/;

/**
 * The highest registered tier per badge id in one member's `badges.earned` strings: `id@k` → k,
 * a plain `id` → 1 (a one-off badge, or a ladder registered before 6D-2: "niveau 1 bekend").
 */
export function knownTiers(registered: readonly string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of registered) {
    const m = TIER_TAG.exec(s);
    const id = m ? m[1]! : s;
    const k = m ? Number(m[2]) : 1;
    if (k > (out.get(id) ?? 0)) out.set(id, k);
  }
  return out;
}

/**
 * The sticky rule on tiers: a registered `id@k` keeps the status at tier ≥ k (a registered `id` at
 * ≥ 1) even when the live count dropped, e.g. after deleting recipes or on another phone after a
 * restore. A raised ladder shows its progress towards the tier after the known one (platinum:
 * current = target); a raised one-off badge is simply earned.
 */
export function withKnownTier(s: BadgeStatus, known: number): BadgeStatus {
  if (known <= s.tier) return s;
  const b = s.badge;
  if (isLadder(b)) {
    const tier = Math.min(known, s.maxTier, b.tiers.length);
    if (tier <= s.tier) return s;
    const target = b.tiers[Math.min(tier, b.tiers.length - 1)]!;
    const current = tier >= s.maxTier ? target : Math.min(s.current, target);
    return { ...s, earned: true, tier, current, target };
  }
  return { ...s, earned: true, tier: 1, current: s.target };
}

/**
 * Every badge with its status for one member, or for the whole household ('all'). Household-wide
 * rule kinds (HOUSEHOLD_KINDS) only appear on 'all': a member tab never claims the household's
 * doing as that member's. Hidden (secret) badges are NOT filtered here; the badges page decides
 * what to show. Registered tiers are sticky (`withKnownTier`).
 * `opts.xp === false`: evaluate without the member's XP state (only src/xp.ts, see buildFacts).
 */
export async function badgeStatuses(memberId: string | 'all', opts?: { xp?: boolean }): Promise<BadgeStatus[]> {
  const [facts, earnedRaw] = await Promise.all([buildFacts(memberId, opts?.xp !== false), getSetting<unknown>(BADGES_EARNED_SETTING, {})]);
  const known = knownTiers(normalizeEarned(earnedRaw)[memberId] ?? []);
  return evaluateBadges(badgeData(), facts)
    .filter((s) => memberId === 'all' || !HOUSEHOLD_KINDS.has(s.badge.rule.kind))
    .map((s) => withKnownTier(s, known.get(s.badge.id) ?? 0));
}

/**
 * Badge id → reached tier (one-off = 1) of every badge this member has, for the avatar maker
 * (6D-3, src/avatar.ts `unlockContext`). Secret badges included; badges not reached are absent.
 */
export async function badgeTiersFor(memberId: string): Promise<ReadonlyMap<string, number>> {
  const out = new Map<string, number>();
  for (const s of await badgeStatuses(memberId)) {
    if (s.earned && s.tier >= 1) out.set(s.badge.id, s.tier);
  }
  return out;
}

/**
 * Pure core of checkNewBadges for one key of `badges.earned`: which statuses reached something new
 * against the registered strings, and the registration list afterwards. A one-off badge newly
 * earned adds `id`; a ladder adds `id@k` for EVERY tier passed since the highest one known (the
 * in-between ones silently; the caller toasts only `tier`, the highest). Nothing is ever removed.
 */
export function registerNewTiers(
  statuses: readonly BadgeStatus[],
  registered: readonly string[],
): { list: string[]; reached: Array<{ status: BadgeStatus; before: number }> } {
  const list = [...new Set(registered)];
  const known = knownTiers(list);
  const reached: Array<{ status: BadgeStatus; before: number }> = [];
  for (const s of statuses) {
    if (!s.earned || s.tier < 1) continue;
    const id = s.badge.id;
    const before = known.get(id) ?? 0;
    if (isLadder(s.badge)) {
      if (s.tier <= before) continue;
      for (let k = before + 1; k <= s.tier; k++) list.push(id + '@' + k);
    } else {
      if (before >= 1) continue;
      list.push(id);
    }
    known.set(id, s.tier);
    reached.push({ status: s, before });
  }
  return { list, reached };
}

export interface NewBadge {
  badge: Badge;
  memberId: string;
  /** The newly reached tier: the highest new one of a ladder (the ones in between were registered silently); 1 for a one-off. */
  tier: number;
  /** The avatar part this step unlocked (a member's own badge only; never on 'all'). */
  unlockedPart?: AvatarPart;
}

/** The "new badge" toast to show right now (null = none); the shell renders it. */
export const badgeToast = signal<NewBadge | null>(null);
/** Badges earned in the same check wait here: each gets its own toast, one after another. */
const toastQueue: NewBadge[] = [];

/** Dismiss the current toast; the next queued badge (if any) takes its place. */
export function dismissBadgeToast(): void {
  badgeToast.value = toastQueue.shift() ?? null;
}

// Calls are serialized so two quick "Gekookt!" taps can never both see the old earned record
// (the union is persisted BEFORE the toast fires: a badge is never toasted twice).
let checking: Promise<void> = Promise.resolve();

/**
 * Evaluates `memberId` AND 'all', compares with the registered `badges.earned`, persists the
 * new registrations (`id` for a one-off, `id@k` for every newly reached ladder tier) and queues
 * one toast per badge for its highest new tier, plus milestone confetti. No-op when badges are off.
 */
export function checkNewBadges(memberId: string): Promise<void> {
  const run = checking.then(() => doCheckNewBadges(memberId));
  checking = run.catch(() => undefined);
  return run;
}

async function doCheckNewBadges(memberId: string): Promise<void> {
  await loadBadgeSettings();
  if (!badgesEnabled.value) return;
  try {
    const [mine, together] = await Promise.all([badgeStatuses(memberId), badgeStatuses('all')]);
    const earned = normalizeEarned(await getSetting<unknown>(BADGES_EARNED_SETTING, {}));
    const fresh: NewBadge[] = [];
    let changed = false;
    const fold = (statuses: BadgeStatus[], key: string) => {
      const { list, reached } = registerNewTiers(statuses, earned[key] ?? []);
      if (!reached.length) return;
      earned[key] = list;
      changed = true;
      for (const { status: s, before } of reached) {
        // "Samen" reaching the same badge in the same check as the member is one achievement,
        // not two toasts: registered here, toasted only when it is reached on its own.
        if (fresh.some((f) => f.badge.id === s.badge.id)) continue;
        // An avatar part belongs to a person: a 'Samen' toast never announces one.
        const part = key === 'all' ? undefined : unlockedPartFor(s.badge, before, s.tier);
        fresh.push(part ? { badge: s.badge, memberId: key, tier: s.tier, unlockedPart: part } : { badge: s.badge, memberId: key, tier: s.tier });
      }
    };
    fold(mine, memberId);
    fold(together, 'all');
    if (!changed) return;
    // Persist before toasting: a crash between the two means a missed toast, never a double one.
    await setSetting(BADGES_EARNED_SETTING, earned);
    // 6D-1 (docs/specs/xp-levels.md §3): the badge XP pops in the same series as the action's own
    // pops (settleXp is serialized and merges pops within 2 s). Never awaited: the toast comes first.
    markXpDirty(memberId);
    void settleXp(memberId).catch((e: unknown) => console.error('settleXp', e));
    if (!fresh.length) return;
    // Queue every fresh badge; (auto-)dismiss shows the next, so none is swallowed silently.
    toastQueue.push(...fresh);
    if (badgeToast.value === null) dismissBadgeToast();
    // The action that triggered this check may still have its own burst running ("Gekookt!",
    // the editor's first-recipe burst); replacing it mid-flight makes the pieces visibly jump
    // (Confetti re-seeds on a new `at`), so the milestone burst only fires when nothing runs.
    if (celebration.value === null) celebrate('milestone');
  } catch (e) {
    console.warn('checkNewBadges', e);
  }
}
