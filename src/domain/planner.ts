// The week plan (docs/phase-4-spec.md §1, PLAN.md §0 "Weekplanner"): a free list of 1..N dishes,
// no days. Framework-free: no preact, no dexie; runs in Node (tests) and in the app.
//
//   pickRecipes  "Verras me": fills N slots from a pool with the variation rules
//                (max 2 pasta, max 2 rijst, ≥ 1 vegetarisch when the plan has ≥ 4 dishes,
//                nothing cooked in the last 6 weeks, never a dish that is already in the plan),
//                relaxing the rules one by one when the pool is too small.
//   planHash     the stable fingerprint of the plan the shopping list was generated from.
import { nowIso, randomId, type CookLogEntry, type Recipe } from './model.ts';

export interface PlanItem {
  id: string;
  recipeId: string;
  servings: number;
  /** "Verras me" / reroll leave a locked slot alone. */
  locked?: boolean;
  /** Set by the "Gekookt" tick (also by cook mode's "Gekookt!"): stays in the plan, leaves the list. */
  cooked?: boolean;
  addedAt: string;
}

export interface Plan {
  id: 'current';
  items: PlanItem[];
  updatedAt: string;
  note?: string;
}

export interface PickOptions {
  /** Number of dishes to pick. */
  count: number;
  /** The recipes to pick from (all recipes, or the filtered set of the Kies-N sheet). */
  pool: Recipe[];
  /** Ids cooked in the last 6 weeks (`recentCookedIds`). */
  recentIds: Set<string>;
  /** The dishes already in the plan: never picked again, and they count for the variation rules. */
  existing: PlanItem[];
  /** Random source in [0, 1); Math.random by default (tests pass a seeded one). */
  rng?: () => number;
}

/** Default household size (setting `household.servings`). */
export const DEFAULT_SERVINGS = 4;
/** "Lang niet gegeten" / "nothing from the last 6 weeks". */
export const RECENT_WEEKS = 6;
export const RECENT_MS = RECENT_WEEKS * 7 * 24 * 60 * 60 * 1000;
/** Variation rules of "Verras me". */
export const MAX_PASTA = 2;
export const MAX_RIJST = 2;
export const MIN_VEG_FROM = 4;

export function emptyPlan(): Plan {
  return { id: 'current', items: [], updatedAt: nowIso() };
}

/** A new slot for a recipe: id 'pi:' + 8 chars. */
export function newPlanItem(recipeId: string, servings = DEFAULT_SERVINGS): PlanItem {
  return { id: randomId('pi:'), recipeId, servings: normalizeServings(servings), addedAt: nowIso() };
}

/** Servings are whole numbers from 1 up; anything else becomes the default. */
export function normalizeServings(n: unknown, fallback = DEFAULT_SERVINGS): number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 ? Math.round(n) : fallback;
}

/** Ids cooked within the last 6 weeks, from the cook log. */
export function recentCookedIds(log: readonly Pick<CookLogEntry, 'recipeId' | 'at'>[], now: number = Date.now(), windowMs = RECENT_MS): Set<string> {
  const out = new Set<string>();
  for (const e of log) {
    const t = new Date(e.at).getTime();
    if (!Number.isNaN(t) && now - t <= windowMs) out.add(e.recipeId);
  }
  return out;
}

/** `recipe.tags` includes 'vegetarisch' (the tag the data uses; "vega-optie" does not count). */
export function isVegetarian(r: Pick<Recipe, 'tags'>): boolean {
  return Array.isArray(r.tags) && r.tags.includes('vegetarisch');
}

interface Counts {
  pasta: number;
  rijst: number;
  veg: number;
  total: number;
}

function countOf(recipes: readonly Recipe[]): Counts {
  const c: Counts = { pasta: 0, rijst: 0, veg: 0, total: recipes.length };
  for (const r of recipes) {
    if (r.category === 'pasta') c.pasta++;
    if (r.category === 'rijst') c.rijst++;
    if (isVegetarian(r)) c.veg++;
  }
  return c;
}

function shuffle<T>(list: T[], rng: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}

/**
 * "Verras me": `count` recipes from the pool that are not in the plan yet, respecting the
 * variation rules against the plan as a whole (existing + picked): max 2 pasta, max 2 rijst,
 * at least one vegetarian dish when the plan ends up with 4 or more, nothing cooked in the
 * last 6 weeks, no duplicates. Rules relax in order when the pool is too small: first the
 * 6-week rule, then the vegetarian minimum, then the pasta/rijst caps; the pool is never
 * exceeded. Deterministic with a seeded `rng`.
 */
export function pickRecipes(o: PickOptions): Recipe[] {
  const rng = o.rng ?? Math.random;
  const count = Math.max(0, Math.floor(o.count));
  if (count === 0) return [];
  const existingIds = new Set(o.existing.map((p) => p.recipeId));
  const byId = new Map<string, Recipe>();
  for (const r of o.pool) if (r && typeof r.id === 'string' && !existingIds.has(r.id) && !byId.has(r.id)) byId.set(r.id, r);
  const candidates = shuffle([...byId.values()], rng);
  const existingRecipes = o.existing.map((p) => o.pool.find((r) => r.id === p.recipeId)).filter((r): r is Recipe => !!r);
  const start = countOf(existingRecipes);
  const targetTotal = o.existing.length + count;

  const picked: Recipe[] = [];
  const pickedIds = new Set<string>();
  const counts: Counts = { ...start };
  const take = (r: Recipe) => {
    picked.push(r);
    pickedIds.add(r.id);
    if (r.category === 'pasta') counts.pasta++;
    if (r.category === 'rijst') counts.rijst++;
    if (isVegetarian(r)) counts.veg++;
  };
  const fitsCaps = (r: Recipe) => !(r.category === 'pasta' && counts.pasta >= MAX_PASTA) && !(r.category === 'rijst' && counts.rijst >= MAX_RIJST);

  // Pass 1: the vegetarian minimum first (only when the plan will have ≥ 4 dishes and none yet).
  const wantVeg = targetTotal >= MIN_VEG_FROM && counts.veg === 0;
  if (wantVeg) {
    const veg = candidates.find((r) => isVegetarian(r) && !o.recentIds.has(r.id) && fitsCaps(r)) ?? candidates.find((r) => isVegetarian(r) && fitsCaps(r));
    if (veg) take(veg);
  }
  // Pass 2: strict (not recent, within the caps); pass 3: recent allowed; pass 4: caps dropped.
  const passes: Array<(r: Recipe) => boolean> = [(r) => !o.recentIds.has(r.id) && fitsCaps(r), (r) => fitsCaps(r), () => true];
  for (const ok of passes) {
    for (const r of candidates) {
      if (picked.length >= count) break;
      if (pickedIds.has(r.id) || !ok(r)) continue;
      take(r);
    }
    if (picked.length >= count) break;
  }
  return picked;
}

/** FNV-1a 32-bit as 8 hex chars. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Stable hash of the plan as the shopping list sees it: the (recipeId, servings) pairs of the
 * dishes that are not cooked yet, order-independent. The list stores it as `generatedFrom`; a
 * different value means "Weekplan gewijzigd — Bijwerken". An empty plan hashes to ''.
 */
export function planHash(plan: Pick<Plan, 'items'>): string {
  return hashPairs(plan.items.filter((p) => !p.cooked));
}

/**
 * The same fingerprint over ALL dishes, cooked ones included. The list stores it next to
 * `generatedFrom` so that ticking "Gekookt" mid-week (which changes `planHash` but needs nothing
 * bought) does not raise the "Weekplan gewijzigd" banner: the list is only stale when both differ.
 */
export function planHashAll(plan: Pick<Plan, 'items'>): string {
  return hashPairs(plan.items);
}

function hashPairs(items: readonly PlanItem[]): string {
  const pairs = items.map((p) => `${p.recipeId}@${normalizeServings(p.servings)}`).sort();
  if (pairs.length === 0) return '';
  return `${pairs.length}:${fnv1a(pairs.join('|'))}`;
}
