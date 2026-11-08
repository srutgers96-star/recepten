// The Tonight card, the "Continue with" line and the compact week on Home (docs/specs/home-a-plus.md
// §1g–§1i, block 2). Framework-free: no preact, no dexie, no i18n; runs in Node (tests/tonight.test.ts)
// and in the app. Only relative imports inside src/domain, like every other domain module.
//
//   tonightMode     which of the three states the card is in: 'loading' | 'plan' | 'free'
//   uncookedItems   the plan's slots that still have to be cooked (and whose recipe exists)
//   currentPlanItem the slot the card shows (falls back to the first uncooked one)
//   nextPlanItem    "Something else": the next uncooked slot, wrapping round
//   pickRandomId    the dice: a random id that differs from the one shown (when possible)
//   outsideWeekIds  the dice pool without the week plan's dishes ("Iets buiten je week")
//   tonightMeta     the grey meta line: the non-empty parts joined with " · "
//   weekProgress / weekNames / weekLine   the compact week card
//   isSameLocalDay / continueWithId       the "Continue with" line (total time + 3 hours, V1b)
import type { Recipe } from './model.ts';
import type { Plan, PlanItem } from './planner.ts';

/**
 * The last viewed recipe and when (ISO), per phone. Stored by src/recent.ts under
 * `recepten.recent.last`; defined here so this module needs nothing from the app layer.
 */
export interface LastViewed {
  id: string;
  at: string;
}

export type TonightMode = 'loading' | 'plan' | 'free';

/** 'loading' while plan or recipes is undefined; 'plan' when uncookedItems(...) is non-empty and !free; else 'free'. */
export function tonightMode(plan: Plan | undefined, recipes: readonly Recipe[] | undefined, free: boolean): TonightMode {
  if (plan === undefined || recipes === undefined) return 'loading';
  if (free) return 'free';
  const byId = new Map<string, Recipe>();
  for (const r of recipes) byId.set(r.id, r);
  return uncookedItems(plan, byId).length > 0 ? 'plan' : 'free';
}

/** The uncooked slots in plan order; slots whose recipe does not exist are skipped. */
export function uncookedItems(plan: Plan, byId: ReadonlyMap<string, Recipe>): PlanItem[] {
  return plan.items.filter((it) => !it.cooked && byId.has(it.recipeId));
}

/** The slot with id `currentId` while it is still there, otherwise items[0]; undefined when empty. */
export function currentPlanItem(items: readonly PlanItem[], currentId: string | null): PlanItem | undefined {
  if (currentId !== null) {
    const hit = items.find((it) => it.id === currentId);
    if (hit) return hit;
  }
  return items[0];
}

/**
 * The slot after `currentId`, wrapping round; with one slot that slot itself; undefined when empty.
 * An unknown (or null) `currentId` gives the first slot, like `currentPlanItem` would.
 */
export function nextPlanItem(items: readonly PlanItem[], currentId: string | null): PlanItem | undefined {
  if (!items.length) return undefined;
  const i = currentId === null ? -1 : items.findIndex((it) => it.id === currentId);
  if (i < 0) return items[0];
  return items[(i + 1) % items.length];
}

/**
 * A random id ≠ `not` (unless there is only one); null when empty. rng in [0,1), Math.random by default.
 * Draws from `ids` without `not` when that leaves anything, otherwise from `ids` itself — one call
 * to `rng`, never a retry loop (a fixed rng such as `() => 0` must not hang).
 */
export function pickRandomId(ids: readonly string[], not: string | null, rng: () => number = Math.random): string | null {
  if (!ids.length) return null;
  const others = ids.filter((id) => id !== not);
  const from = others.length ? others : ids;
  const r = rng();
  const i = Number.isFinite(r) ? Math.min(from.length - 1, Math.max(0, Math.floor(r * from.length))) : 0;
  return from[i] ?? null;
}

/**
 * The dice pool without the week plan's dishes; the whole pool when that leaves nothing.
 * Every slot counts (cooked or not). No plan, or nothing left → `ids` unchanged, as a new array.
 */
export function outsideWeekIds(ids: readonly string[], plan: Plan | undefined): string[] {
  if (!plan || !plan.items.length) return [...ids];
  const inWeek = new Set(plan.items.map((it) => it.recipeId));
  const outside = ids.filter((id) => !inWeek.has(id));
  return outside.length ? outside : [...ids];
}

/** The non-empty parts joined with " · "; '' when every part is empty. */
export function tonightMeta(parts: ReadonlyArray<string | null | undefined>): string {
  return parts.filter((p): p is string => typeof p === 'string' && p !== '').join(' · ');
}

/** All slots of the plan and how many of them are ticked cooked. */
export function weekProgress(plan: Plan): { total: number; cooked: number } {
  let cooked = 0;
  for (const it of plan.items) if (it.cooked) cooked++;
  return { total: plan.items.length, cooked };
}

/** Names for the compact week line: uncooked first (plan order), then cooked; an unknown recipe is skipped. */
export function weekNames(
  plan: Plan,
  byId: ReadonlyMap<string, Recipe>,
  nameOf: (r: Recipe) => string,
): Array<{ name: string; cooked: boolean }> {
  const open: Array<{ name: string; cooked: boolean }> = [];
  const done: Array<{ name: string; cooked: boolean }> = [];
  for (const it of plan.items) {
    const r = byId.get(it.recipeId);
    if (!r) continue;
    const cooked = it.cooked === true;
    (cooked ? done : open).push({ name: nameOf(r), cooked });
  }
  return [...open, ...done];
}

/** The first `max` (default 3) and how many are left over: {shown, more}. */
export function weekLine<T>(names: readonly T[], max = 3): { shown: T[]; more: number } {
  const n = Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 0;
  const shown = names.slice(0, n);
  return { shown, more: names.length - shown.length };
}

/** Same calendar day in local time (not a UTC comparison!). false for an invalid iso. */
export function isSameLocalDay(iso: string, now: Date): boolean {
  if (typeof iso !== 'string' || !iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || Number.isNaN(now.getTime())) return false;
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

/**
 * How long after the recipe's own preparation time Home still offers "Continue with" (V1b, Stijn
 * 8 Nov: "today" was too long, but "sometimes a dish has to rest a day"): the window is the total
 * time of the recipe plus these three hours, so a 24-hour recipe stays for 27 hours.
 */
export const CONTINUE_GRACE_MS = 3 * 3_600_000;

/**
 * The id for "Continue with", or null: viewed `totalMinutes` (the recipe's `time.total ??
 * time.active ?? 0`) plus CONTINUE_GRACE_MS or longer ago (or in the future / invalid time),
 * unknown recipe, equal to hideId, cooked today or cooked at/after the view (the window may cross
 * midnight since V1b, so a dish cooked last night must not come back this morning), or dismissed
 * with the × on Home (`dismissedId`; a later viewed other recipe shows the line again).
 */
export function continueWithId(
  last: LastViewed | null,
  now: Date,
  known: ReadonlySet<string>,
  hideId: string | null,
  cookedTodayAt: string | null,
  dismissedId: string | null = null,
  totalMinutes: number | null = null,
): string | null {
  if (!last || !last.id) return null;
  const at = typeof last.at === 'string' && last.at ? new Date(last.at).getTime() : NaN;
  const nowMs = now.getTime();
  if (Number.isNaN(at) || Number.isNaN(nowMs)) return null;
  const age = nowMs - at;
  const minutes = typeof totalMinutes === 'number' && Number.isFinite(totalMinutes) && totalMinutes > 0 ? totalMinutes : 0;
  if (age < 0 || age >= minutes * 60_000 + CONTINUE_GRACE_MS) return null;
  if (dismissedId !== null && last.id === dismissedId) return null;
  if (!known.has(last.id)) return null;
  if (hideId !== null && last.id === hideId) return null;
  if (cookedTodayAt && isSameLocalDay(cookedTodayAt, now)) return null;
  if (cookedTodayAt) {
    const cookedAt = new Date(cookedTodayAt).getTime();
    if (!Number.isNaN(cookedAt) && cookedAt >= at) return null;
  }
  return last.id;
}
