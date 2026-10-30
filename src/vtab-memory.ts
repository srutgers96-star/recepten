// The variant tab chosen last per recipe on this phone (13D, docs/specs/varianten-tabs.md §1a): the
// recipe page opens on `?v=` first, then on this remembered choice, then on Origineel. App layer, the
// pattern of src/recent.ts: localStorage 'recepten.vtab' holds one JSON object recipe id -> the `?v=`
// value of the tab (a diet such as 'glutenvrij', or the id of a personal version), oldest choice
// first, at most VTAB_MAX entries. A per-phone convenience, not data: a backup never carries it and a
// reset wipes it with every other `recepten.*` key. Every storage access sits in try/catch (private
// mode, blocked site data); the value is checked again by the page (`tabChoiceFromParam` in
// src/components/VariantTabs.tsx), so a tab that no longer exists falls back to Origineel.
// The pure helpers run in Node (tests/vtab-memory.test.ts); the two storage functions take an
// optional storage so the tests can pass an in-memory stub.

export const VTAB_KEY = 'recepten.vtab';
export const VTAB_MAX = 200;

/** The part of the Web Storage API this module uses (localStorage, or a stub in the tests). */
export interface TabStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Pure: the stored JSON as an ordered map (oldest first). Junk, non-objects and non-string values are dropped. */
export function parseTabMap(raw: string | null): Map<string, string> {
  const out = new Map<string, string>();
  if (!raw) return out;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return out;
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [id, param] of Object.entries(v as Record<string, unknown>)) {
    if (id && typeof param === 'string' && param) out.set(id, param);
  }
  return out;
}

/**
 * Pure: `map` with `recipeId` set to `param` as the newest entry, or removed when `param` is null or
 * empty (Origineel needs no entry). When it grows past `max`, the oldest entries go first.
 */
export function withTab(map: ReadonlyMap<string, string>, recipeId: string, param: string | null, max = VTAB_MAX): Map<string, string> {
  const out = new Map(map);
  if (!recipeId) return out;
  out.delete(recipeId);
  if (param) out.set(recipeId, param);
  for (const id of out.keys()) {
    if (out.size <= max) break;
    out.delete(id);
  }
  return out;
}

/** Pure: the map as the JSON that is stored (insertion order kept). */
export function serializeTabMap(map: ReadonlyMap<string, string>): string {
  return JSON.stringify(Object.fromEntries(map));
}

function defaultStorage(): TabStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The remembered `?v=` value of this recipe, or null (none, junk, or storage unavailable). */
export function rememberedTab(recipeId: string, store: TabStorage | null = defaultStorage()): string | null {
  if (!recipeId || !store) return null;
  try {
    return parseTabMap(store.getItem(VTAB_KEY)).get(recipeId) ?? null;
  } catch {
    return null;
  }
}

/**
 * Remembers the tab of this recipe (`tabChoiceToParam` of the choice); null forgets it (Origineel).
 * Silent when storage is unavailable: the memory is a convenience only.
 */
export function rememberTab(recipeId: string, param: string | null, store: TabStorage | null = defaultStorage()): void {
  if (!recipeId || !store) return;
  try {
    const next = withTab(parseTabMap(store.getItem(VTAB_KEY)), recipeId, param);
    if (next.size === 0) store.removeItem(VTAB_KEY);
    else store.setItem(VTAB_KEY, serializeTabMap(next));
  } catch {
    /* storage may be unavailable or full (private mode): the page simply opens on Origineel */
  }
}
