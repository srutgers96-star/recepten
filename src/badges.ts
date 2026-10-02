// Badges app layer (docs/phase-5-spec.md Block C, PLAN.md §0 "Gamification"): the `badges.enabled`
// setting mirror (pattern of src/celebrate.ts / src/sounds.ts), the normalized data/badges.json
// cache, `badgeStatuses(memberId)` that builds BadgeFacts from the repository, and the new-badge
// bookkeeping (`badges.earned`) with the toast signal the shell renders. Never in the way: with
// badges off everything here is a no-op and no UI shows a trace of it.
import { signal } from '@preact/signals';
import badgesData from '@data/badges.json';
import { celebrate, celebration } from './celebrate';
import { allRecipes, countPhotos, getSetting, getSharedRecipes, listCookLog, setSetting } from '@/db/repo';
import { evaluateBadges, normalizeBadges, type Badge, type BadgeFacts, type BadgeStatus } from '@/domain/badges';
import type { Recipe } from '@/domain/model';

/** Setting `badges.enabled` (boolean, default true). */
export const BADGES_SETTING = 'badges.enabled';
/** Setting `badges.earned`: Record<memberId | 'all', badge ids already registered (and toasted)>. */
export const BADGES_EARNED_SETTING = 'badges.earned';

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
    // Block D landed the photos table, so the photo badges are obtainable and visible again.
    cachedBadges = normalizeBadges(badgesData as unknown);
  }
  return cachedBadges;
}

/** BadgeFacts for one member (log filtered on profileId) or the whole household ('all'). */
async function buildFacts(memberId: string | 'all'): Promise<BadgeFacts> {
  const [recipes, log, shared, photos] = await Promise.all([allRecipes(), listCookLog(), getSharedRecipes(), countPhotos()]);
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
  return {
    log: memberId === 'all' ? log : log.filter((e) => e.profileId === memberId),
    recipes: byId,
    classicsTotal,
    ownRecipes,
    received,
    shared,
    // Household-wide, like shared/own/received: photos live in the `photos` table since block D.
    photos,
  };
}

/** Rule kinds that count household-wide (buildFacts): shown and earned on the "Samen" tab only. */
const HOUSEHOLD_KINDS: ReadonlySet<string> = new Set(['ownRecipes', 'received', 'shared', 'photos']);

/**
 * Every badge with earned/progress for one member, or for the whole household ('all').
 * Household-wide rule kinds (own/received/shared recipes, photos) only appear on 'all': a member
 * tab never claims the household's doing as that member's. A badge registered in `badges.earned`
 * stays earned even when its live count later drops (deleting two received recipes must never
 * take back a celebrated "Verzamelaar").
 */
export async function badgeStatuses(memberId: string | 'all'): Promise<BadgeStatus[]> {
  const [facts, earnedRaw] = await Promise.all([buildFacts(memberId), getSetting<unknown>(BADGES_EARNED_SETTING, {})]);
  const known = new Set(normalizeEarned(earnedRaw)[memberId] ?? []);
  return evaluateBadges(badgeData(), facts)
    .filter((s) => memberId === 'all' || !HOUSEHOLD_KINDS.has(s.badge.rule.kind))
    .map((s) => (s.earned || !known.has(s.badge.id) ? s : { ...s, earned: true, current: s.target }));
}

export interface NewBadge {
  badge: Badge;
  memberId: string;
}

/** The "new badge" toast to show right now (null = none); the shell renders it. */
export const badgeToast = signal<NewBadge | null>(null);
/** Badges earned in the same check wait here: each gets its own toast, one after another. */
const toastQueue: NewBadge[] = [];

/** Dismiss the current toast; the next queued badge (if any) takes its place. */
export function dismissBadgeToast(): void {
  badgeToast.value = toastQueue.shift() ?? null;
}

/** The stored `badges.earned` value (any shape) → a valid record. */
function normalizeEarned(v: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [key, ids] of Object.entries(v as Record<string, unknown>)) {
      if (Array.isArray(ids)) out[key] = ids.filter((x): x is string => typeof x === 'string');
    }
  }
  return out;
}

// Calls are serialized so two quick "Gekookt!" taps can never both see the old earned record
// (the union is persisted BEFORE the toast fires: a badge is never toasted twice).
let checking: Promise<void> = Promise.resolve();

/**
 * Evaluates `memberId` AND 'all', compares with the registered `badges.earned`, persists the
 * union and toasts every newly earned badge (queued, one at a time) plus milestone confetti.
 * No-op when badges are off.
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
    const fold = (statuses: BadgeStatus[], key: string) => {
      const known = new Set(earned[key] ?? []);
      for (const s of statuses) {
        if (!s.earned || known.has(s.badge.id)) continue;
        known.add(s.badge.id);
        // "Samen" reaching the same badge in the same check as the member is one achievement,
        // not two toasts: registered here, toasted only when it is earned on its own.
        if (!fresh.some((f) => f.badge.id === s.badge.id)) fresh.push({ badge: s.badge, memberId: key });
      }
      earned[key] = [...known];
    };
    fold(mine, memberId);
    fold(together, 'all');
    if (!fresh.length) return;
    // Persist before toasting: a crash between the two means a missed toast, never a double one.
    await setSetting(BADGES_EARNED_SETTING, earned);
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
