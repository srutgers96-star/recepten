// Challenges, app layer (docs/specs/challenges.md block 6E, §1 and §3 "Bouwer B"). The pure rules live
// in src/domain/challenges.ts; this module reads and writes the two settings through the repository
// (`challenges.active`, `challenges.done`), builds the facts, and keeps the signals the card on Mijn
// profiel shows (src/components/ChallengeCard.tsx) for the ACTIVE profile.
//
// - The offer: `offerFor(pool, weekKey(now), memberId, done)`, three challenges, one of each weight,
//   the same all week (it changes on Monday, local time); giving up keeps it.
// - Progress is DERIVED (§1f, §4.3): `progressFor` over the facts every time, never added up.
// - `settleChallenges(memberId)` runs after every `settleXp` (src/xp.ts): a challenge whose goal is
//   reached goes to the history (`finishChallenge`, it only grows), the XP is settled again so the
//   bonus pops ("+250", event kind 'challenge'), then a toast and `celebrate('challenge')`. A term
//   that ran out without the goal is cleared quietly: no XP, no toast, only the line
//   `challenge.expired` on the card.
// - Quiet settles (boot, restore) finish a reached challenge without toast or confetti.
// - Badges off: nothing happens here at all (no trace, README §4.11); the card is hidden anyway.
//
// Week dishes (plannedCooks): `features.log` keeps per feature only a count, the FIRST and the LAST
// moment (household-wide) and a count per member, no moment per event, so 'surprise' + 'planCook' on
// the same day cannot be counted honestly. The facts carry instead the week dishes ticked cooked
// (current plan, `addedAt`); a cook of the member counts when it matches such a dish. A plan that was
// cleared loses that evidence (an under-count, never more). See src/domain/challenges.ts.
import { signal, type Signal } from '@preact/signals';
import challengesJson from '@data/challenges.json';
import { badgeData, badgesEnabled, checkNewBadges, loadBadgeSettings } from '@/badges';
import { celebrate } from '@/celebrate';
import {
  allRecipes,
  finishChallenge,
  getActiveChallenges,
  getDoneChallenges,
  getPlan,
  listAllPhotosMeta,
  listCookLog,
  setActiveChallenge,
} from '@/db/repo';
import {
  normalizeChallenges,
  offerFor,
  progressFor,
  termDeadline,
  weekKey,
  type ActiveChallenge,
  type Challenge,
  type ChallengeFacts,
  type ChallengeTerm,
  type DoneChallenge,
  type SeasonWindows,
} from '@/domain/challenges';
import type { Recipe } from '@/domain/model';
import { activeProfile } from '@/profile';
import { markXpDirty, settleXp } from '@/xp';

export type { ActiveChallenge, Challenge, DoneChallenge };

export interface ChallengeProgress {
  current: number;
  target: number;
  done: boolean;
}

/** A challenge just reached: what the toast `challenge.doneToast` says ({name} from the challenge, {xp}). */
export interface ChallengeDoneToast {
  challenge: Challenge;
  xp: number;
  /** Epoch ms; a new value is a new toast. */
  at: number;
}

/** The running challenge of the active profile, or null. */
export const activeChallenge: Signal<ActiveChallenge | null> = signal<ActiveChallenge | null>(null);
/** This week's three for the active profile (empty with badges off or without a profile). */
export const challengeOffer: Signal<Challenge[]> = signal<Challenge[]>([]);
/** The whole history (every member; the card filters on its member). Only grows. */
export const doneChallenges: Signal<DoneChallenge[]> = signal<DoneChallenge[]>([]);
/** The derived progress of `activeChallenge`, or null when nothing runs. */
export const challengeProgress: Signal<ChallengeProgress | null> = signal<ChallengeProgress | null>(null);
/** The active profile's last challenge ran out without the goal (the quiet line on the card); reset by a start. */
export const challengeExpired: Signal<boolean> = signal(false);
/** The toast of a challenge just reached, or null; the shell shows it and calls `dismissChallengeToast`. */
export const challengeToast: Signal<ChallengeDoneToast | null> = signal<ChallengeDoneToast | null>(null);

// ---------------------------------------------------------------------------- data

let pool: Challenge[] | null = null;

/** data/challenges.json, normalised once. */
export function challengeData(): readonly Challenge[] {
  if (!pool) pool = normalizeChallenges(challengesJson as unknown);
  return pool;
}

/** One challenge by id (undefined for an id no longer in the data). */
export function challengeById(id: string): Challenge | undefined {
  return challengeData().find((c) => c.id === id);
}

/** The season windows of data/badges.json (badges-avatar seizoensvensters) for a 'season' term. */
function seasonWindows(): SeasonWindows {
  const out: Array<SeasonWindows[number]> = [];
  for (const b of badgeData()) if (b.season) out.push(b.season);
  return out;
}

/** The deadline a challenge of this term would get if it were started now (the offer's "tot …"). */
export function offerDeadline(term: ChallengeTerm, now: Date = new Date()): string {
  return termDeadline(term, now.toISOString(), seasonWindows());
}

// ---------------------------------------------------------------------------- facts

/**
 * The facts of one member: their whole cook log, every recipe, their photo rows and the week dishes
 * ticked cooked (for plannedCooks, see the header). `now` = this moment.
 */
async function buildChallengeFacts(memberId: string, now: Date): Promise<ChallengeFacts> {
  const [recipes, log, photos, plan] = await Promise.all([allRecipes(), listCookLog(), listAllPhotosMeta(), getPlan()]);
  const byId = new Map<string, Recipe>();
  for (const r of recipes) byId.set(r.id, r);
  return {
    log: log.filter((e) => e.profileId === memberId),
    recipes: byId,
    photoRows: photos.filter((p) => p.memberId === memberId).map((p) => ({ recipeId: p.recipeId, at: p.at })),
    features: [],
    plannedCooks: plan.items.filter((p) => p.cooked === true).map((p) => ({ recipeId: p.recipeId, addedAt: p.addedAt })),
    now: now.toISOString(),
  };
}

function isOver(active: ActiveChallenge, now: Date): boolean {
  const end = Date.parse(active.deadline);
  return !Number.isFinite(end) || now.getTime() > end;
}

// ---------------------------------------------------------------------------- refresh (signals)

/** Latest refresh; an older one finishing later never overwrites a newer result. */
let refreshGen = 0;

/**
 * Re-reads the settings and fills the signals for the active profile: history, running challenge
 * and its derived progress, this week's offer. Writes nothing. Never throws.
 */
export async function refreshChallenges(): Promise<void> {
  const gen = ++refreshGen;
  try {
    await loadBadgeSettings();
    const memberId = activeProfile.value?.id ?? null;
    const [all, done] = await Promise.all([getActiveChallenges(), getDoneChallenges()]);
    const now = new Date();
    let active: ActiveChallenge | null = memberId ? (all[memberId] ?? null) : null;
    const challenge = active ? challengeById(active.id) : undefined;
    if (active && !challenge) active = null;
    let progress: ChallengeProgress | null = null;
    if (active && challenge && memberId) progress = progressFor(challenge, active, await buildChallengeFacts(memberId, now));
    const offer =
      memberId && badgesEnabled.value ? offerFor(challengeData(), weekKey(now), memberId, done.filter((d) => d.memberId === memberId)) : [];
    if (gen !== refreshGen) return;
    doneChallenges.value = done;
    activeChallenge.value = active;
    challengeProgress.value = progress;
    challengeOffer.value = offer;
  } catch (e) {
    console.warn('refreshChallenges', e);
  }
}

// ---------------------------------------------------------------------------- actions

// Starting, giving up and settling are serialized: two quick taps or settles never read the same
// old settings (a challenge is never finished twice, never toasted twice).
let queue: Promise<unknown> = Promise.resolve();

function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn);
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Starts challenge `id` for the active profile (§1b): startedAt = now, deadline = the end of its
 * term. Replaces a running one only through Opgeven first (the card offers Kies only when nothing
 * runs); a call while one runs does nothing. Only ids in this week's offer.
 */
export function startChallenge(id: string): Promise<void> {
  return serialized(async () => {
    await loadBadgeSettings();
    const memberId = activeProfile.value?.id;
    if (!memberId || !badgesEnabled.value) return;
    const challenge = challengeById(id);
    if (!challenge) return;
    const all = await getActiveChallenges();
    if (all[memberId]) return;
    const now = new Date();
    const done = (await getDoneChallenges()).filter((d) => d.memberId === memberId);
    if (!offerFor(challengeData(), weekKey(now), memberId, done).some((c) => c.id === id)) return;
    const startedAt = now.toISOString();
    await setActiveChallenge(memberId, { id, memberId, startedAt, deadline: termDeadline(challenge.term, startedAt, seasonWindows()) });
    challengeExpired.value = false;
    await refreshChallenges();
  }).catch((e: unknown) => {
    console.warn('startChallenge', e);
  });
}

/** Opgeven (§1d, after the card's confirmation): the running challenge goes, no history row, no penalty; the offer stays. */
export function giveUp(): Promise<void> {
  return serialized(async () => {
    const memberId = activeProfile.value?.id;
    if (!memberId) return;
    await setActiveChallenge(memberId, null);
    challengeExpired.value = false;
    await refreshChallenges();
  }).catch((e: unknown) => {
    console.warn('giveUp', e);
  });
}

/**
 * After every settleXp (src/xp.ts): looks at the member's running challenge. Goal reached (progress
 * derived from the facts in the window) → a history row (finishedAt = now, or the deadline when the
 * term has already ended), the XP settled again (the bonus pops unless quiet), a toast and confetti
 * (not when quiet), and a badge check (Uitdager). Term over without the goal → cleared quietly
 * (§1c). Badges off → nothing. Never throws.
 */
export function settleChallenges(memberId: string, opts?: { quiet?: boolean }): Promise<void> {
  return serialized(() => doSettleChallenges(memberId, opts?.quiet === true)).catch((e: unknown) => {
    console.warn('settleChallenges', e);
  });
}

async function doSettleChallenges(memberId: string, quietAsked: boolean): Promise<void> {
  await loadBadgeSettings();
  if (!badgesEnabled.value) return;
  const quiet = quietAsked;
  const all = await getActiveChallenges();
  const active = all[memberId] ?? null;
  if (!active) {
    if (memberId === activeProfile.value?.id) await refreshChallenges();
    return;
  }
  const challenge = challengeById(active.id);
  const now = new Date();
  if (!challenge) {
    // A challenge no longer in the data: nothing to reach, so it goes quietly.
    await setActiveChallenge(memberId, null);
    if (memberId === activeProfile.value?.id) await refreshChallenges();
    return;
  }
  const progress = progressFor(challenge, active, await buildChallengeFacts(memberId, now));
  if (progress.done) {
    const end = Date.parse(active.deadline);
    const finishedAt = Number.isFinite(end) && now.getTime() > end ? active.deadline : now.toISOString();
    const added = await finishChallenge({ id: active.id, memberId, startedAt: active.startedAt, finishedAt, xp: challenge.xp });
    if (memberId === activeProfile.value?.id) challengeExpired.value = false;
    await refreshChallenges();
    if (!added) return;
    // The bonus is a derived XP event (src/domain/xp.ts kind 'challenge'): settle again so it pops.
    markXpDirty(memberId);
    void settleXp(memberId, quiet ? { quiet: true } : undefined);
    if (!quiet) {
      challengeToast.value = { challenge, xp: challenge.xp, at: Date.now() };
      celebrate('challenge');
      void checkNewBadges(memberId).catch((e: unknown) => console.warn('checkNewBadges', e));
    }
    return;
  }
  if (isOver(active, now)) {
    await setActiveChallenge(memberId, null);
    if (memberId === activeProfile.value?.id) challengeExpired.value = true;
  }
  if (memberId === activeProfile.value?.id) await refreshChallenges();
}

/** The shell is done with the toast. */
export function dismissChallengeToast(): void {
  challengeToast.value = null;
}

// ---------------------------------------------------------------------------- boot

let booted = false;

/**
 * Once at boot (src/xp.ts checkRulesVersion, after the quiet settles of every profile, which also
 * cleared expired terms): fills the signals, and keeps them in step with the active profile and with
 * the week (a quiet settle when the app comes back to the foreground, so the Monday offer and an
 * expired term show without a reload).
 */
export function loadChallenges(): Promise<void> {
  if (!booted) {
    booted = true;
    let lastProfile: string | null | undefined;
    activeProfile.subscribe((p) => {
      const id = p?.id ?? null;
      if (id === lastProfile) return;
      lastProfile = id;
      challengeExpired.value = false;
      void refreshChallenges();
    });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        const id = activeProfile.value?.id;
        // A quiet settle also clears a term that ran out while the app was in the background.
        if (id) void settleChallenges(id, { quiet: true });
        else void refreshChallenges();
      });
    }
  }
  return refreshChallenges();
}
