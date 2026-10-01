// "Fuseer met bestaand" (docs/phase-5-spec.md A-bis.6): every reference to a user-created ingredient
// id is rewritten to the id of the existing entry it duplicates. Framework-free and pure: the
// repository wraps the result in one transaction and keeps a snapshot for undo; this module only
// says what to write.
//
// References live in: recipe lines (`ing`, recursively in `alt[]`), line overrides of builtins,
// shopping-list items (`ing` and the `ing|variant|baseUnit` key) and pantry rows. RecipeOverride
// patches (`patch.lines`) are rewritten by the caller with `rewriteLinesIngredientId`.
import type { Line } from './model.ts';

/** The shape of anything with ingredient lines (Recipe, or a RecipePatch with `lines`). */
export interface HasLines {
  lines: Line[];
  [k: string]: unknown;
}

/** A line override row (src/domain/overrides.ts LineOverride). */
export interface IngRef {
  ing?: string | null;
  [k: string]: unknown;
}

/** A shopping-list item (src/domain/aggregate.ts ListItem): the key starts with the ingredient id. */
export interface ListRef {
  key: string;
  ing?: string | null;
  [k: string]: unknown;
}

/** A pantry row (src/db/model.ts PantryItem). */
export interface PantryRef {
  ing: string;
  until?: string;
  [k: string]: unknown;
}

export interface RewriteResult<R extends HasLines, O extends IngRef, L extends ListRef, P extends PantryRef> {
  /** Copies of the recipes that referenced `oldId`, rewritten (the caller bumps rev/updatedAt and saves). */
  recipes: R[];
  /** Copies of the line overrides that pointed at `oldId`. */
  lineOverrides: O[];
  /** Copies of the list items that pointed at `oldId` (key rewritten too). */
  listItems: L[];
  /** The pantry row to write for `newId` (merged with an existing `newId` row), if `oldId` was in the pantry. */
  pantry: P[];
  /** Pantry ids to delete (`oldId` when it was in the pantry). */
  pantryDelete: string[];
  /** Number of individual line references rewritten across all recipes. */
  lineRefs: number;
}

/** One line (and its alternatives) with `oldId` replaced; the same object when nothing referenced it. */
export function rewriteLineIngredientId(line: Line, oldId: string, newId: string): { line: Line; changed: number } {
  let changed = 0;
  let next: Line | null = null;
  if (line.ing === oldId) {
    next = { ...line, ing: newId };
    changed++;
  }
  if (Array.isArray(line.alt) && line.alt.length) {
    const alts = line.alt.map((a) => rewriteLineIngredientId(a, oldId, newId));
    const n = alts.reduce((sum, a) => sum + a.changed, 0);
    if (n > 0) {
      next = { ...(next ?? line), alt: alts.map((a) => a.line) };
      changed += n;
    }
  }
  return { line: next ?? line, changed };
}

/** A list of lines with `oldId` replaced; the same array when nothing referenced it. */
export function rewriteLinesIngredientId(lines: readonly Line[], oldId: string, newId: string): { lines: Line[]; changed: number } {
  let changed = 0;
  const out = lines.map((l) => {
    const r = rewriteLineIngredientId(l, oldId, newId);
    changed += r.changed;
    return r.line;
  });
  return { lines: changed ? out : (lines as Line[]), changed };
}

/**
 * Everything that must be written to replace ingredient `oldId` by `newId`. Records that do not
 * reference `oldId` are left out of the result. `oldId === newId` yields an empty result.
 */
export function rewriteIngredientId<R extends HasLines, O extends IngRef, L extends ListRef, P extends PantryRef>(
  recipes: readonly R[],
  lineOverrides: readonly O[],
  listItems: readonly L[],
  pantry: readonly P[],
  oldId: string,
  newId: string,
): RewriteResult<R, O, L, P> {
  const out: RewriteResult<R, O, L, P> = { recipes: [], lineOverrides: [], listItems: [], pantry: [], pantryDelete: [], lineRefs: 0 };
  if (!oldId || !newId || oldId === newId) return out;

  for (const r of recipes) {
    const lines = rewriteLinesIngredientId(r.lines ?? [], oldId, newId);
    if (lines.changed) {
      out.recipes.push({ ...r, lines: lines.lines });
      out.lineRefs += lines.changed;
    }
  }
  for (const o of lineOverrides) {
    if (o.ing === oldId) out.lineOverrides.push({ ...o, ing: newId });
  }
  for (const item of listItems) {
    if (item.ing !== oldId) continue;
    const key = item.key.startsWith(`${oldId}|`) ? `${newId}|${item.key.slice(oldId.length + 1)}` : item.key;
    out.listItems.push({ ...item, ing: newId, key });
  }
  const oldRow = pantry.find((p) => p.ing === oldId);
  if (oldRow) {
    const existing = pantry.find((p) => p.ing === newId);
    // A row without `until` is "in huis" indefinitely; otherwise the later date wins.
    let merged: P = { ...oldRow, ing: newId };
    if (existing) {
      if (existing.until === undefined || oldRow.until === undefined) {
        merged = { ...existing, ...oldRow, ing: newId };
        delete merged.until;
      } else {
        merged = { ...existing, ...oldRow, ing: newId, until: existing.until > oldRow.until ? existing.until : oldRow.until };
      }
    }
    out.pantry.push(merged);
    out.pantryDelete.push(oldId);
  }
  return out;
}
