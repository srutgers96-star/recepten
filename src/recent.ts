// Recently viewed recipes + the sort modes of the recipe list (phase 6, docs/phase-6-spec.md
// 13A-2). App layer: the recently-viewed ids live in localStorage ('recepten.recent', newest first,
// at most 50) because they are a per-phone convenience, not data — a backup never carries them and
// a reset wipes them with every other `recepten.*` key. Every storage access sits in try/catch
// (private mode, blocked site data) and the pure helpers (`pushRecent`, `orderRecipes`) run in
// Node, so tests/share-events.test.ts pins them without a browser.
import { type Recipe } from '@/domain/model';

export const RECENT_KEY = 'recepten.recent';
export const RECENT_MAX = 50;

/** The list with `id` moved (or added) to the front, trimmed to `max`. Pure. */
export function pushRecent(ids: readonly string[], id: string, max = RECENT_MAX): string[] {
  const out = [id];
  for (const x of ids) {
    if (out.length >= max) break;
    if (x === id || typeof x !== 'string' || !x) continue;
    out.push(x);
  }
  return out;
}

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

/** The recently viewed recipe ids, newest first ([] when storage is unavailable). */
export function recentIds(): string[] {
  return readIds();
}

/** The recipe page calls this when it opens a recipe: the id moves to the front of the list. */
export function noteViewed(recipeId: string): void {
  if (!recipeId) return;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(pushRecent(readIds(), recipeId)));
  } catch {
    /* storage may be unavailable (private mode): the list is a convenience only */
  }
}

// --- Sort modes of the recipe list ----------------------------------------------------------------

/** 'az' = letter groups + rail (the default); the other three are flat lists in their own order. */
export type ListSort = 'az' | 'recent' | 'own' | 'ownReceived';

export const LIST_SORTS: readonly ListSort[] = ['az', 'recent', 'own', 'ownReceived'];

/** localStorage key of the chosen sort mode (remembered per phone, like the chip selection). */
export const LIST_SORT_KEY = 'recepten.recipes.sort';

export function isListSort(v: unknown): v is ListSort {
  return typeof v === 'string' && (LIST_SORTS as readonly string[]).includes(v);
}

export function loadListSort(): ListSort {
  try {
    const v = localStorage.getItem(LIST_SORT_KEY);
    return isListSort(v) ? v : 'az';
  } catch {
    return 'az';
  }
}

export function saveListSort(mode: ListSort): void {
  try {
    localStorage.setItem(LIST_SORT_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** Newest change first; equal stamps fall back to the id so the order is stable. */
function byUpdatedDesc(a: Recipe, b: Recipe): number {
  return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || a.id.localeCompare(b.id);
}

/**
 * The recipes of a non-A–Z mode, in that mode's order. Pure.
 * - 'recent': the recipes in `recent` (newest viewed first); ids that are not in `list` (deleted,
 *   filtered out by the chips) are skipped.
 * - 'own': origin.kind 'user', newest change first.
 * - 'ownReceived': 'user' + 'received', newest change first.
 * - 'az': `list` unchanged (the screen groups and sorts it by name itself).
 */
export function orderRecipes(list: readonly Recipe[], mode: ListSort, recent: readonly string[] = []): Recipe[] {
  switch (mode) {
    case 'recent': {
      const byId = new Map<string, Recipe>();
      for (const r of list) byId.set(r.id, r);
      const out: Recipe[] = [];
      const seen = new Set<string>();
      for (const id of recent) {
        if (seen.has(id)) continue;
        seen.add(id);
        const r = byId.get(id);
        if (r) out.push(r);
      }
      return out;
    }
    case 'own':
      return list.filter((r) => r.origin.kind === 'user').sort(byUpdatedDesc);
    case 'ownReceived':
      return list.filter((r) => r.origin.kind === 'user' || r.origin.kind === 'received').sort(byUpdatedDesc);
    default:
      return [...list];
  }
}

/** `subset` in the order of `ordered` (search results of a non-A–Z mode keep the mode's order). Pure. */
export function keepOrder(ordered: readonly Recipe[], subset: readonly Recipe[]): Recipe[] {
  const wanted = new Set(subset.map((r) => r.id));
  return ordered.filter((r) => wanted.has(r.id));
}
