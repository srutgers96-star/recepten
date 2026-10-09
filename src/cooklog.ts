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
import { checkNewBadges } from '@/badges';
import { celebrate } from '@/celebrate';
import { listCookLog, logCooked, markRecipeCookedInPlan } from '@/db/repo';

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
  await logCooked({
    recipeId: input.recipeId,
    profileId: input.profileId,
    at: input.at,
    stars: input.stars !== null && input.stars > 0 ? input.stars : null,
    note,
  });
  // Phase 5 C.4: this member's 10th/25th/50th cook gets the big burst instead of the normal one.
  let kind: 'cooked' | 'milestone' = 'cooked';
  try {
    const mine = (await listCookLog()).filter((e) => e.profileId === input.profileId).length;
    if (COOK_MILESTONES.has(mine)) kind = 'milestone';
  } catch (e) {
    console.error('listCookLog', e);
  }
  celebrate(kind);
  // Phase 4: a dish in the week plan gets its "Gekookt" tick — only for a cook of today.
  if (isToday(input.at)) {
    try {
      await markRecipeCookedInPlan(input.recipeId);
    } catch (e) {
      console.error('markRecipeCookedInPlan', e);
    }
  }
  // Phase 5 block C: start the badge check, never make the caller wait for it (the toast signal
  // survives navigation; the shell renders it).
  void checkNewBadges(input.profileId).catch((e: unknown) => console.error('checkNewBadges', e));
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
