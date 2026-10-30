// "Nu aan het koken" — the cooking bar (docs/specs/kookbalk.md, 13K). Framework-free: no preact, no
// dexie, no i18n; runs in Node (tests/cooking.test.ts) and in the app. Only relative imports inside
// src/domain, like every other domain module.
//
// A cooking session is one recipe you are cooking right now: the cook-mode page you were on, a
// snapshot of the name, and when you last did something with it. The sessions live in one settings
// row (`cook.sessions`, device-local) and are mirrored by src/cooking.ts.
//
//   normalizeSessions  tolerant read of the stored value (unknown fields stay)
//   upsertSession      one row per recipe; keeps startedAt of an existing row
//   isExpired          8 hours without activity and no running timer of that recipe
//   pruneSessions      drops the expired sessions, keeps the order
//   cookPath           '/cook/<id>?step=N&srv=S&v=<diet>' — where a bar row leads
//   groupBar           what the bar shows: rows per recipe with their timers, loose timers last
//
// 13D blok 3 (docs/specs/varianten-tabs.md §1d): a session remembers the approved diet version cook
// mode shows (`variant`, from `?v=`), so the bar row reopens cook mode on that version (`&v=<diet>`).
import type { RunningTimer, Text } from './model.ts';
import { VARIANT_DIETS, type VariantDiet } from './diets.ts';

/** One recipe you are cooking right now. Lives in the settings row `cook.sessions`. */
export interface CookingSession {
  recipeId: string;
  /** Page as CookScreen counts it: 0 = Klaarzetten, 1..stepCount = that step. Never the Gekookt page. */
  page: number;
  /** Snapshot of the recipe name ({nl,en}; invariant 3) so the bar renders without a db read. */
  name: Text;
  stepCount: number;
  /** Servings chosen in cook mode (passed back as ?srv=); null = the recipe's own. */
  servings: number | null;
  /** Epoch ms. `lastActiveAt` moves on every step change and every timer start of this recipe. */
  startedAt: number;
  lastActiveAt: number;
  /** 13D: the approved diet version cook mode shows (passed back as &v=); absent/null = the original. */
  variant?: VariantDiet | null;
}

export const COOKING_SETTING = 'cook.sessions';
/** A session without activity for this long, and without a running timer, is over. */
export const COOKING_EXPIRE_MS = 8 * 60 * 60_000;

/** Same range as the servings picker (src/components/ServingsPicker.tsx). */
const MIN_SERVINGS = 1;
const MAX_SERVINGS = 24;

type TimerLike = Pick<RunningTimer, 'recipeId' | 'endAt'>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isCount(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function isVariantDiet(v: unknown): v is VariantDiet {
  return typeof v === 'string' && (VARIANT_DIETS as readonly string[]).includes(v);
}

/**
 * One stored row, or null when it cannot be read. Fields this version does not know are kept. A
 * `variant` that is not a diet becomes null (the original); an absent one stays absent.
 */
function normalizeSession(v: unknown): CookingSession | null {
  if (!isRecord(v)) return null;
  const { recipeId, page, stepCount, name, startedAt, lastActiveAt, servings, variant } = v;
  if (typeof recipeId !== 'string') return null;
  if (!isCount(page) || !isCount(stepCount)) return null;
  if (!isRecord(name)) return null;
  if (!isFiniteNumber(startedAt)) return null;
  let active: number;
  if (lastActiveAt === undefined || lastActiveAt === null) active = startedAt;
  else if (isFiniteNumber(lastActiveAt)) active = lastActiveAt;
  else return null;
  const out: CookingSession = {
    ...v,
    recipeId,
    page,
    name: {
      nl: typeof name.nl === 'string' ? name.nl : '',
      en: typeof name.en === 'string' ? name.en : '',
    },
    stepCount,
    servings: isFiniteNumber(servings) && servings >= MIN_SERVINGS && servings <= MAX_SERVINGS ? servings : null,
    startedAt,
    lastActiveAt: active,
  };
  if ('variant' in v) out.variant = isVariantDiet(variant) ? variant : null;
  return out;
}

/**
 * Tolerant read of the `cook.sessions` value: anything that is not a readable row is dropped,
 * a missing name side becomes '', a missing `lastActiveAt` becomes `startedAt`, servings outside
 * 1–24 become null. Two rows for one recipe: the last one wins (one row per recipe).
 */
export function normalizeSessions(v: unknown): CookingSession[] {
  if (!Array.isArray(v)) return [];
  const rows: CookingSession[] = [];
  for (const item of v) {
    const s = normalizeSession(item);
    if (!s) continue;
    const at = rows.findIndex((r) => r.recipeId === s.recipeId);
    if (at >= 0) rows.splice(at, 1);
    rows.push(s);
  }
  return rows;
}

/** Upsert by recipeId (one row per recipe); keeps startedAt of an existing row. */
export function upsertSession(list: CookingSession[], s: CookingSession): CookingSession[] {
  const at = list.findIndex((r) => r.recipeId === s.recipeId);
  if (at < 0) return [...list, s];
  const old = list[at]!;
  const next = list.slice();
  next[at] = { ...old, ...s, startedAt: old.startedAt };
  return next;
}

/** True when `now > lastActiveAt + COOKING_EXPIRE_MS` and no timer of this recipe has endAt > now. */
export function isExpired(s: CookingSession, timers: readonly TimerLike[], now: number): boolean {
  if (now <= s.lastActiveAt + COOKING_EXPIRE_MS) return false;
  return !timers.some((t) => t.recipeId === s.recipeId && t.endAt > now);
}

/**
 * The sessions that are not expired, in their own order. Returns `list` itself when nothing went,
 * so a derived signal over it keeps its identity while the clock ticks.
 */
export function pruneSessions(list: CookingSession[], timers: readonly TimerLike[], now: number): CookingSession[] {
  const kept = list.filter((s) => !isExpired(s, timers, now));
  return kept.length === list.length ? list : kept;
}

/**
 * '/cook/<id>' + '?step=<page>' when page ≥ 1 + ('&' or '?') 'srv=<n>' when servings is set +
 * ('&' or '?') 'v=<diet>' when the session cooks a diet version (13D). Without a variant the path is
 * the same as before 13D.
 */
export function cookPath(s: Pick<CookingSession, 'recipeId' | 'page' | 'servings' | 'variant'>): string {
  let path = '/cook/' + s.recipeId;
  let sep = '?';
  if (s.page >= 1) {
    path += sep + 'step=' + s.page;
    sep = '&';
  }
  if (s.servings !== null && s.servings !== undefined) {
    path += sep + 'srv=' + s.servings;
    sep = '&';
  }
  if (isVariantDiet(s.variant)) path += sep + 'v=' + s.variant;
  return path;
}

export interface BarRecipeGroup {
  kind: 'recipe';
  session: CookingSession;
  timers: RunningTimer[];
  /** No timer of this recipe is still running (none, or all finished): the row may show ×. */
  stoppable: boolean;
}
export interface BarLooseGroup {
  kind: 'loose';
  timers: RunningTimer[];
}
export interface BarModel {
  /** Timers of `currentId` (cook mode hides that recipe's own row); [] when no currentId. */
  current: RunningTimer[];
  groups: Array<BarRecipeGroup | BarLooseGroup>; // recipes by startedAt asc, loose group last (if any)
  hasSessions: boolean;
}

function byEndAt(a: RunningTimer, b: RunningTimer): number {
  return a.endAt - b.endAt;
}

/**
 * What the bar shows. A timer belongs to the group of its `recipeId` when that recipe has a
 * session; otherwise (no recipeId, or no session) to the loose group. A session without timers
 * still gets a group (stoppable). The group of `currentId` is left out of `groups`; its timers go to
 * `current`. Recipe groups by startedAt ascending (ties keep the list order), timers by endAt
 * ascending, the loose group last and only when it has timers.
 */
export function groupBar(
  sessions: readonly CookingSession[],
  timers: readonly RunningTimer[],
  now: number,
  currentId?: string | null,
): BarModel {
  const byRecipe = new Map<string, RunningTimer[]>();
  for (const s of sessions) byRecipe.set(s.recipeId, []);
  const loose: RunningTimer[] = [];
  for (const t of timers) {
    const own = t.recipeId ? byRecipe.get(t.recipeId) : undefined;
    if (own) own.push(t);
    else loose.push(t);
  }

  let current: RunningTimer[] = [];
  const groups: Array<BarRecipeGroup | BarLooseGroup> = [];
  const ordered = sessions
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.startedAt - b.s.startedAt || a.i - b.i)
    .map((x) => x.s);
  for (const session of ordered) {
    const own = (byRecipe.get(session.recipeId) ?? []).slice().sort(byEndAt);
    if (currentId && session.recipeId === currentId) {
      current = own;
      continue;
    }
    groups.push({ kind: 'recipe', session, timers: own, stoppable: !own.some((t) => t.endAt > now) });
  }
  if (loose.length) groups.push({ kind: 'loose', timers: loose.slice().sort(byEndAt) });
  return { current, groups, hasSessions: sessions.length > 0 };
}
