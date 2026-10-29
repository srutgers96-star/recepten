// App-level cook-log helper (docs/phase-6-spec.md 6A.3). One place for "this recipe was cooked", so
// the recipe page's "✓ Gekookt" (src/components/CookedSheet.tsx) and cook mode's "Gekookt!" do
// exactly the same: log the entry, pick the confetti (this member's 10th/25th/50th cook = the big
// milestone burst, otherwise the normal one), tick the dish in the week plan — but only when the
// cook happened today: a dinner logged for last Tuesday is not tonight's — and start the badge check
// without waiting for it. CookScreen.onCooked still carries its own copy of this sequence (other
// owner); it can call `recordCooked` later.
//
// The date helpers speak <input type="date"> (`yyyy-mm-dd`, local). A past day is stored as 12:00
// local time, so the entry stays on that day in every time zone the log is ever viewed in (midnight
// would slip a day in a westward zone).
//
// 13K (docs/specs/kookbalk.md §1a): a cook of today also ends the "Nu aan het koken" session of that
// recipe (its row and its timers leave the bar); a cook logged for another day leaves it alone.
//
// 6D-1 (docs/specs/xp-levels.md §3): logCooked → markXpDirty → confetti/plan → checkNewBadges →
// settleXp, both started without waiting. The badge check settles again after a new badge; settleXp
// is serialized and merges pops within 2 s into one series, so cook and badge XP pop together.
//
// 6D-4a (docs/specs/xp-levels.md §1g): with `cooked.sound` on and `sound-cooked-tada` unlocked, a
// short ta-da plays once the cook is saved, together with the confetti. The audio context is woken
// before the first await — still inside the tap, which iOS needs — and played after the save.
import { badgesEnabled, checkNewBadges } from '@/badges';
import { celebrate } from '@/celebrate';
import { endCooking } from '@/cooking';
import { listCookLog, logCooked, markRecipeCookedInPlan } from '@/db/repo';
import { recordFeature } from '@/features';
import { cookedSound, playCookedSound, tapAudioContext } from '@/sounds';
import { isActive } from '@/unlocks';
import { markXpDirty, settleXp } from '@/xp';

/** The unlock that lets the ta-da on Cooked! play (data/unlocks.json). */
export const COOKED_SOUND_UNLOCK = 'sound-cooked-tada';

/**
 * Call inside the tap, before the first await: wakes the audio context when the ta-da will play
 * (setting on, unlock active) and returns it; null otherwise. Play it with `playCookedSound` once
 * the cook is saved.
 */
export function wakeCookedSound(): AudioContext | null {
  // Badges off = no ta-da either (decision Fable 29 Oct): the sound plays by default, not by a choice.
  return badgesEnabled.value && cookedSound.value && isActive(COOKED_SOUND_UNLOCK) ? tapAudioContext() : null;
}

/** This member's Nth cook that gets the big burst (phase 5 C.4; the same set as CookScreen). */
export const COOK_MILESTONES: ReadonlySet<number> = new Set([10, 25, 50]);

export interface RecordCookedInput {
  recipeId: string;
  profileId: string;
  /** ISO timestamp of the cook: `nowIso()` for today, `cookedAtForDay(day)` for a past day. */
  at: string;
  /** 1–5, or null for "no stars (yet)". */
  stars: number | null;
  note: string | null;
}

/** Logs a cook and does everything that goes with it (see the header comment). Throws when the log write fails. */
export async function recordCooked(input: RecordCookedInput): Promise<void> {
  const note = input.note?.trim() ? input.note.trim() : null;
  // 6D-4a: still inside the tap (nothing awaited yet), so iOS lets the context wake.
  const tada = wakeCookedSound();
  await logCooked({
    recipeId: input.recipeId,
    profileId: input.profileId,
    at: input.at,
    stars: input.stars !== null && input.stars > 0 ? input.stars : null,
    note,
  });
  markXpDirty(input.profileId);
  // Phase 5 C.4: this member's 10th/25th/50th cook gets the big burst instead of the normal one.
  let kind: 'cooked' | 'milestone' = 'cooked';
  try {
    const mine = (await listCookLog()).filter((e) => e.profileId === input.profileId).length;
    if (COOK_MILESTONES.has(mine)) kind = 'milestone';
  } catch (e) {
    console.error('listCookLog', e);
  }
  if (tada) playCookedSound(tada);
  celebrate(kind);
  // Phase 4: a dish in the week plan gets its "Gekookt" tick — only for a cook of today.
  if (isToday(input.at)) {
    try {
      if (await markRecipeCookedInPlan(input.recipeId)) void recordFeature('planCook');
    } catch (e) {
      console.error('markRecipeCookedInPlan', e);
    }
    // 13K: cooked today = done with this dish; the session and its timers go (never fatal).
    try {
      await endCooking(input.recipeId);
    } catch (e) {
      console.error('endCooking', e);
    }
  }
  // Phase 5 block C: start the badge check, never make the caller wait for it (the toast signal
  // survives navigation; the shell renders it).
  void checkNewBadges(input.profileId).catch((e: unknown) => console.error('checkNewBadges', e));
  // 6D-1: the reward moment (a no-op on screen while badges are off).
  void settleXp(input.profileId).catch((e: unknown) => console.error('settleXp', e));
}

/** `yyyy-mm-dd` of a Date in the phone's local time zone (the value format of <input type="date">). */
export function localDay(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** The local day `n` days before today (1 = yesterday). */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDay(d);
}

/**
 * ISO timestamp for a cook on a given local day (`yyyy-mm-dd`): 12:00 local time, see the header
 * comment. Null for anything that is not a real complete date (also "2026-02-31").
 */
export function cookedAtForDay(day: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  if (Number.isNaN(d.getTime()) || localDay(d) !== day) return null;
  return d.toISOString();
}

/** True when the timestamp falls on today's local date. */
export function isToday(iso: string): boolean {
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && localDay(d) === localDay();
}
