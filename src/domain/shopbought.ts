// The shopping trail (docs/specs/badges-avatar.md block 6D-2c, "Boodschappenspoor"). Framework-free:
// no preact, no dexie; runs in Node (tests) and in the app.
//
// Until 6D-2c the shopping list only left counts behind (feature events `listMade`, `listShared`),
// not WHICH recipe or ingredient was bought. The setting `shop.bought` (src/db/repo.ts) keeps that:
// - `recipes`: recipe id → ISO moment a line from that recipe was first ticked off (first wins);
// - `ings`:    ingredient id → how often an item of it was ticked off, household-wide (`n`) and per
//              member id (`by`), the same shape as a counter of `features.log`.
// repo.setListItem calls `recordBought` on the transition not-ticked → ticked only. The badge
// "Hele cirkel" reads `recipes`; the groceries badges (docs/specs/verbeterronde-7.md, V7) read
// `ings` through `boughtFacts` below. V7 added `first` (the moment of a member's first tick of an
// ingredient, for the season badges); older data without it stays valid.

/** Ticks of one ingredient: all members together (`n`) and per member id (`by`). */
export interface BoughtIngredient {
  n: number;
  by: Record<string, number>;
  /** V7: member id → ISO moment of that member's FIRST tick of this ingredient (set once, never moved). */
  first?: Record<string, string>;
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

function normalizeFirst(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const out: Record<string, string> = {};
  let any = false;
  for (const [member, at] of Object.entries(value)) {
    // An unparseable moment is dropped: kept, it would block every later first tick for that member.
    if (usableKey(member) && typeof at === 'string' && Number.isFinite(Date.parse(at))) {
      out[member] = at;
      any = true;
    }
  }
  return any ? out : null;
}

/** An empty trail. */
export function emptyShopBought(): ShopBought {
  return { recipes: {}, ings: {} };
}

/**
 * The stored `shop.bought` value (any shape) → a valid trail. Tolerant like normalizeFeatureLog:
 * whatever does not fit is left out, never an exception. A recipe needs a non-empty id and a
 * non-empty moment; an ingredient a non-empty id and a count n ≥ 1 (its `by` keeps only counts ≥ 1;
 * its `first` only members with a non-empty moment, and is left out when none is left).
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
      if (n === null) continue;
      const first = normalizeFirst(value['first']);
      out.ings[ing] = first === null ? { n, by: normalizeBy(value['by']) } : { n, by: normalizeBy(value['by']), first };
    }
  }
  return out;
}

/**
 * One list item ticked off by `memberId` at `iso`. Returns a NEW trail; the input is not changed.
 * Every source recipe goes into `recipes` (an id already there keeps its first moment); the
 * ingredient counts only when the item is resolved (`ing` set): n + 1, and by[memberId] + 1 when
 * there is a member (without one only n). V7: with a member, `first[memberId]` = `iso` only when
 * that member has no first moment yet.
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
  const first: Record<string, string> = { ...(prev?.first ?? {}) };
  if (typeof memberId === 'string' && usableKey(memberId)) {
    by[memberId] = (by[memberId] ?? 0) + 1;
    if (!Object.prototype.hasOwnProperty.call(first, memberId)) first[memberId] = iso;
  }
  const next: BoughtIngredient = Object.keys(first).length ? { n: (prev?.n ?? 0) + 1, by, first } : { n: (prev?.n ?? 0) + 1, by };
  return { recipes, ings: { ...state.ings, [ing]: next } };
}

// ---------------------------------------------------------------------------- badge facts (V7)

/** One bought ingredient as the groceries badges see it (src/domain/badges.ts `BadgeFacts.bought`). */
export interface BoughtFact {
  /** Ticks: the member's own (`by[memberId]`), or the household total on 'all'. Always ≥ 1. */
  n: number;
  /** ISO of the member's first tick; on 'all' the earliest of anyone's. null = unknown (data from before V7). */
  first: string | null;
  /** A pantry product (`staple: true` in the dictionary): never counts, except for `boughtInMonth`. */
  staple: boolean;
  /** Dictionary aisle id, null when the id is not in the dictionary. */
  aisle: string | null;
  /** Dutch name (`nl.one`) for `boughtLetters`, null when the id is not in the dictionary. */
  nameNl: string | null;
  /** Number of recipes (facts.recipes) with at least one line of this ingredient (`boughtRare`). */
  recipes: number;
}

/** What `boughtFacts` reads of a dictionary entry (src/domain/dictionary.ts `Ingredient` fits). */
export interface BoughtDictEntry {
  staple?: boolean;
  aisle?: string;
  nl?: { one?: string };
}

/** What `boughtFacts` reads of a recipe (src/domain/model.ts `Recipe` fits). */
export interface BoughtRecipe {
  lines?: ReadonlyArray<{ ing?: string | null }>;
}

/** Ingredient id → number of recipes with at least one line of it (each recipe counts once). */
export function recipesPerIngredient(recipes: Iterable<BoughtRecipe>): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of recipes) {
    const seen = new Set<string>();
    for (const line of r.lines ?? []) {
      const ing = line?.ing;
      if (typeof ing === 'string' && ing !== '' && !seen.has(ing)) {
        seen.add(ing);
        out.set(ing, (out.get(ing) ?? 0) + 1);
      }
    }
  }
  return out;
}

function earliest(moments: Iterable<string>): string | null {
  let best: string | null = null;
  let bestT = Infinity;
  for (const at of moments) {
    const t = Date.parse(at);
    if (!Number.isFinite(t)) continue;
    if (t < bestT) {
      bestT = t;
      best = at;
    }
  }
  return best;
}

/**
 * The trail as the groceries badges see it (V7, docs/specs/verbeterronde-7.md §1a). Per member:
 * only ingredients with `by[memberId] > 0`, `n` = that count, `first` = `first[memberId]`; on 'all':
 * every ingredient, `n` = the total, `first` = the earliest moment of any member. Every ingredient
 * stays in (staples too, flagged): the rule kinds decide what to skip. `lookup` gives the dictionary
 * entry (unknown id → not a staple, no aisle, no name); `recipeCounts` comes from
 * `recipesPerIngredient`.
 */
export function boughtFacts(
  state: ShopBought,
  memberId: string | 'all',
  lookup: (id: string) => BoughtDictEntry | undefined,
  recipeCounts: ReadonlyMap<string, number>,
): Map<string, BoughtFact> {
  const out = new Map<string, BoughtFact>();
  for (const [id, ing] of Object.entries(state.ings)) {
    let n: number;
    let first: string | null;
    if (memberId === 'all') {
      n = ing.n;
      first = earliest(Object.values(ing.first ?? {}));
    } else {
      n = Object.prototype.hasOwnProperty.call(ing.by, memberId) ? (ing.by[memberId] ?? 0) : 0;
      const own = ing.first && Object.prototype.hasOwnProperty.call(ing.first, memberId) ? ing.first[memberId] : undefined;
      first = typeof own === 'string' && Number.isFinite(Date.parse(own)) ? own : null;
    }
    if (!(n > 0)) continue;
    const entry = lookup(id);
    const name = entry?.nl?.one;
    out.set(id, {
      n,
      first,
      staple: entry?.staple === true,
      aisle: typeof entry?.aisle === 'string' && entry.aisle !== '' ? entry.aisle : null,
      nameNl: typeof name === 'string' && name.trim() !== '' ? name : null,
      recipes: recipeCounts.get(id) ?? 0,
    });
  }
  return out;
}
