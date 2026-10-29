// The shopping trail (docs/specs/badges-avatar.md block 6D-2c, "Boodschappenspoor"). Framework-free:
// no preact, no dexie; runs in Node (tests) and in the app.
//
// Until 6D-2c the shopping list only left counts behind (feature events `listMade`, `listShared`),
// not WHICH recipe or ingredient was bought. The setting `shop.bought` (src/db/repo.ts) keeps that:
// - `recipes`: recipe id → ISO moment a line from that recipe was first ticked off (first wins);
// - `ings`:    ingredient id → how often an item of it was ticked off, household-wide (`n`) and per
//              member id (`by`), the same shape as a counter of `features.log`.
// repo.setListItem calls `recordBought` on the transition not-ticked → ticked only. The badge
// "Hele cirkel" reads `recipes`; `ings` has no badge yet (docs/IDEAS.md idea 4 builds on it later).

/** Ticks of one ingredient: all members together (`n`) and per member id (`by`). */
export interface BoughtIngredient {
  n: number;
  by: Record<string, number>;
}

export interface ShopBought {
  /** Recipe id → ISO moment of the first tick of a line from that recipe. */
  recipes: Record<string, string>;
  /** Ingredient id (dictionary) → ticks. */
  ings: Record<string, BoughtIngredient>;
}

/** What `recordBought` reads of a list item (src/domain/aggregate.ts `ListItem` fits). */
export interface BoughtItem {
  ing?: string | null;
  sources?: ReadonlyArray<{ recipeId: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A key that is safe to write as an own property of a plain object (never `__proto__`). */
function usableKey(key: string): boolean {
  return key.trim() !== '' && key !== '__proto__';
}

/** A positive integer, else null. */
function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null;
}

function normalizeBy(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(value)) return out;
  for (const [member, raw] of Object.entries(value)) {
    const c = count(raw);
    if (usableKey(member) && c !== null) out[member] = c;
  }
  return out;
}

/** An empty trail. */
export function emptyShopBought(): ShopBought {
  return { recipes: {}, ings: {} };
}

/**
 * The stored `shop.bought` value (any shape) → a valid trail. Tolerant like normalizeFeatureLog:
 * whatever does not fit is left out, never an exception. A recipe needs a non-empty id and a
 * non-empty moment; an ingredient a non-empty id and a count n ≥ 1 (its `by` keeps only counts ≥ 1).
 */
export function normalizeShopBought(raw: unknown): ShopBought {
  const out = emptyShopBought();
  if (!isRecord(raw)) return out;
  const recipes = raw['recipes'];
  if (isRecord(recipes)) {
    for (const [id, at] of Object.entries(recipes)) {
      if (usableKey(id) && typeof at === 'string' && at.trim() !== '') out.recipes[id] = at;
    }
  }
  const ings = raw['ings'];
  if (isRecord(ings)) {
    for (const [ing, value] of Object.entries(ings)) {
      if (!usableKey(ing) || !isRecord(value)) continue;
      const n = count(value['n']);
      if (n !== null) out.ings[ing] = { n, by: normalizeBy(value['by']) };
    }
  }
  return out;
}

/**
 * One list item ticked off by `memberId` at `iso`. Returns a NEW trail; the input is not changed.
 * Every source recipe goes into `recipes` (an id already there keeps its first moment); the
 * ingredient counts only when the item is resolved (`ing` set): n + 1, and by[memberId] + 1 when
 * there is a member (without one only n).
 */
export function recordBought(state: ShopBought, item: BoughtItem, memberId: string | null | undefined, iso: string): ShopBought {
  const recipes: Record<string, string> = { ...state.recipes };
  for (const source of item.sources ?? []) {
    const id = source?.recipeId;
    if (typeof id === 'string' && usableKey(id) && !Object.prototype.hasOwnProperty.call(recipes, id)) recipes[id] = iso;
  }
  const ing = typeof item.ing === 'string' && usableKey(item.ing) ? item.ing : null;
  if (ing === null) return { recipes, ings: { ...state.ings } };
  const prev = Object.prototype.hasOwnProperty.call(state.ings, ing) ? state.ings[ing] : undefined;
  const by: Record<string, number> = { ...(prev?.by ?? {}) };
  if (typeof memberId === 'string' && usableKey(memberId)) by[memberId] = (by[memberId] ?? 0) + 1;
  return { recipes, ings: { ...state.ings, [ing]: { n: (prev?.n ?? 0) + 1, by } } };
}
