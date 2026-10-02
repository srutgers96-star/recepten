// User corrections on top of the bundled classics (docs/phase-2-spec.md §5). Framework-free.
//
// Two kinds of override, both keyed by the builtin's id (ids never change, invariant 1):
//   - a RecipeOverride (table `overrides`): a schema-2 patch from the curator / language-pair
//     editor (name, description, steps, lines, category, tags, servingTip) rendered on top of the
//     builtin by `applyOverride`. The builtin itself is never modified, so a data-version bump
//     keeps the user's edits.
//   - a LineOverride (table `lineOverrides`): "Koppel ingrediënt" on one line of a builtin
//     (ing, qual, prep) merged into the parsed line by `mergeLineOverride`.
// User recipes store such corrections directly in the line; these helpers are harmless on them.
import type { Line, Recipe, Step, Text } from './model.ts';

/** The recipe fields a RecipeOverride patch may carry. */
export type RecipePatchKey = 'name' | 'description' | 'steps' | 'lines' | 'category' | 'tags' | 'servingTip';

export const RECIPE_PATCH_KEYS: readonly RecipePatchKey[] = ['name', 'description', 'steps', 'lines', 'category', 'tags', 'servingTip'];

/** The schema-2 patch of a builtin. Unknown keys are preserved (round-trip in tokens later). */
export type RecipePatch = Partial<Pick<Recipe, RecipePatchKey>> & { [k: string]: unknown };

/** One row of the `overrides` table. `rev` counts saves of this override (1 on the first save). */
export interface RecipeOverride {
  baseId: string;
  rev: number;
  patch: RecipePatch;
  /** ISO timestamp of the last save. */
  updatedAt: string;
  /** Name of the profile that made the edit (curator credit), or null. */
  by?: string | null;
  /**
   * Receiver-side bookkeeping of an override that came in through a share (phase 3, like
   * `Recipe.sync`): `rev === sync.receivedRev` means "untouched since receipt", so a newer patch
   * from the sender may replace it without a conflict. `saveOverride` keeps it while bumping
   * `rev` (so a local edit makes the override "touched"); it never travels in a token.
   */
  sync?: { receivedRev?: number; receivedAt?: string };
}

/** One row of the `lineOverrides` table: a user correction of one line of a builtin. */
export interface LineOverride {
  recipeId: string;
  /** Index into `recipe.lines`. */
  index: number;
  /** ingredients.json (or userIngredients) id; null = explicitly unlinked; absent = untouched. */
  ing?: string | null;
  /** Qualifier ids; absent = untouched. */
  qual?: string[];
  /** Prep note; null clears it; absent = untouched. */
  prep?: Text | null;
  /** ISO timestamp of the last save. */
  updatedAt: string;
}

/** What `applyOverride` records on the result so the UI can say "aangepast" / offer a reset. */
export interface AppliedOverride {
  rev: number;
  updatedAt: string;
  by?: string | null;
}

function hasText(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

/**
 * Merges a Text patch per language (invariant 3: an incoming `en` only touches `en`). A language
 * given as an empty string clears that side; `null` as the whole patch clears the field.
 */
export function mergeText(base: Text | null | undefined, patch: Text | null | undefined): Text | null {
  if (patch === null) return null;
  if (patch === undefined) return base ?? null;
  const out: Text = { ...(base ?? {}) };
  if (patch.nl !== undefined) out.nl = patch.nl;
  if (patch.en !== undefined) out.en = patch.en;
  return out;
}

/**
 * Whether a patch row carries content of its own. The curator's filler rows for untouched
 * entries (`{ text: {} }` / `{ raw: {} }`) carry none: on a length mismatch — the classic
 * changed upstream — such a row falls back to the base entry per index instead of going blank,
 * while a row with own content keeps today's replace semantics.
 */
function stepHasOwnContent(s: Step): boolean {
  return Object.keys(s).some((k) => k !== 'text') || hasText(s.text?.nl) || hasText(s.text?.en);
}

function lineHasOwnContent(l: Line): boolean {
  return Object.keys(l).some((k) => k !== 'raw') || hasText(l.raw?.nl) || hasText(l.raw?.en);
}

function mergeSteps(base: readonly Step[], patch: readonly Step[]): Step[] {
  const sameLength = patch.length === base.length;
  return patch.map((s, i) => {
    const b = sameLength || !stepHasOwnContent(s) ? (base[i] as Step | undefined) : undefined;
    if (!b) return { ...s, text: { ...(s.text ?? {}) } };
    const out: Step = { ...b, ...s, text: mergeText(b.text, s.text) ?? {} };
    if (s.timers === undefined && b.timers) out.timers = b.timers;
    return out;
  });
}

function mergeLines(base: readonly Line[], patch: readonly Line[]): Line[] {
  const sameLength = patch.length === base.length;
  return patch.map((l, i) => {
    const b = sameLength || !lineHasOwnContent(l) ? (base[i] as Line | undefined) : undefined;
    const out: Line = b ? { ...b, ...l } : { ...l };
    // Invariant 2: a raw line is never deleted. A patched line without raw keeps the original's.
    const raw = mergeText(b?.raw, l.raw) ?? {};
    out.raw = hasText(raw.nl) || hasText(raw.en) ? raw : { ...(b?.raw ?? {}) };
    return out;
  });
}

/**
 * The builtin with its override patch applied. Patch fields replace the recipe's; Text fields
 * (name, description, servingTip) and per-index steps/lines merge per language so an English
 * edit never wipes the Dutch. Unknown keys of the recipe and of the patch are kept, `rev` is
 * bumped by the override's rev, `updatedAt` becomes the later of the two and `override` records
 * what was applied. No override (or one for another id) returns the same recipe object.
 */
export function applyOverride(recipe: Recipe, override: RecipeOverride | null | undefined): Recipe {
  if (!override || override.baseId !== recipe.id || !override.patch || typeof override.patch !== 'object') return recipe;
  const patch = override.patch;
  const out: Recipe = { ...recipe };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    switch (k) {
      case 'name': {
        const merged = mergeText(recipe.name, v as Text | null);
        out.name = merged ?? recipe.name;
        break;
      }
      case 'description':
      case 'servingTip':
        out[k] = mergeText(recipe[k], v as Text | null);
        break;
      case 'steps':
        if (Array.isArray(v)) out.steps = mergeSteps(recipe.steps, v as Step[]);
        break;
      case 'lines':
        if (Array.isArray(v)) out.lines = mergeLines(recipe.lines, v as Line[]);
        break;
      case 'tags':
        if (Array.isArray(v)) out.tags = (v as unknown[]).filter((x): x is string => typeof x === 'string');
        break;
      case 'category':
        out.category = typeof v === 'string' ? v : null;
        break;
      default:
        out[k] = v;
    }
  }
  const bump = Number.isFinite(override.rev) && override.rev > 0 ? Math.floor(override.rev) : 1;
  out.rev = (recipe.rev || 1) + bump;
  if (typeof override.updatedAt === 'string' && override.updatedAt > (recipe.updatedAt ?? '')) out.updatedAt = override.updatedAt;
  const applied: AppliedOverride = { rev: bump, updatedAt: override.updatedAt, by: override.by ?? null };
  out.override = applied;
  return out;
}

/**
 * The effective line: a LineOverride's `ing`, `qual` and `prep` on top of the parsed line. A
 * present key replaces (null unlinks / clears), an absent key leaves the line alone. A linked
 * ingredient is a human decision, so `confidence` becomes 1. Without an override the same
 * line object is returned.
 */
export function mergeLineOverride(line: Line, override: LineOverride | null | undefined): Line {
  if (!override) return line;
  const out: Line = { ...line };
  let touched = false;
  if (override.ing !== undefined) {
    out.ing = override.ing;
    touched = true;
    if (override.ing) out.confidence = 1;
  }
  if (override.qual !== undefined) {
    out.qual = [...override.qual];
    touched = true;
  }
  if (override.prep !== undefined) {
    out.prep = override.prep === null ? null : { ...override.prep };
    touched = true;
  }
  return touched ? out : line;
}

/** All lines of a recipe with their line overrides merged in (by index). */
export function applyLineOverrides(lines: readonly Line[], overrides: readonly LineOverride[] | null | undefined): Line[] {
  if (!overrides || overrides.length === 0) return [...lines];
  const byIndex = new Map<number, LineOverride>();
  for (const o of overrides) byIndex.set(o.index, o);
  return lines.map((l, i) => mergeLineOverride(l, byIndex.get(i)));
}
