// tools/apply-meta.ts — the hand-kept recipe-level labels of the classics
// (docs/specs/labels-categorieen.md §2e: category, goesWith and cuisine).
//
// data/recipes.json is generated (`npm run migrate`), so the category or cuisine of a classic may
// never be edited by hand in that file. data/review/meta.json holds them instead, keyed by recipe id:
//
//   { "category": { "b:naanbrood-voor-bij-dahl": "bijgerecht" },
//     "goesWith": { "b:polenta-voor-ratatouille": ["b:ratatouille"] },
//     "cuisine":  { "b:spaghetti-bolognese": "italiaans" } }
//
// Every section is optional. `migrate()` (tools/migrate-from-recepten2.ts) and
// `apply-llm-batch.ts --apply all` replay it after the human review layer (and, later, after the
// side dishes and extras) and before the derived diet tags. A value SETS the field: `category` and
// `cuisine` replace the recipe's value, `goesWith` replaces the list. Unknown recipe, category,
// cuisine or goesWith ids are refused (`checkMeta`), so a typo can never silently drop a label.
// Node 22 type-stripping rules apply: type-only syntax only, plain ESM, no enums/namespaces.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Recipe } from '../src/domain/model.ts';
import type { DictionaryRefs } from './validate-data.ts';

export interface MetaReview {
  category?: Record<string, string>;
  goesWith?: Record<string, string[]>;
  cuisine?: Record<string, string>;
}

const META_KEYS: ReadonlySet<string> = new Set(['category', 'goesWith', 'cuisine']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** data/review/meta.json when it exists, else null. Throws on malformed JSON. */
export function readMeta(root: string): MetaReview | null {
  const path = join(root, 'data', 'review', 'meta.json');
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as MetaReview;
}

/**
 * Validate the meta file against the recipes and the dictionary refs (tools/validate-data.ts
 * `refsFromData`). Pure; returns the errors (empty = `applyMeta` may run).
 */
export function checkMeta(meta: MetaReview, recipes: readonly Recipe[], refs: DictionaryRefs): string[] {
  const errors: string[] = [];
  if (!isRecord(meta)) return ['must be { category?, goesWith?, cuisine? }.'];
  for (const k of Object.keys(meta)) if (!META_KEYS.has(k)) errors.push(`"${k}" is not a meta section (only category, goesWith, cuisine).`);
  const ids = new Set(recipes.map((r) => r.id));
  const section = (key: keyof MetaReview): [string, unknown][] => {
    const v: unknown = meta[key];
    if (v === undefined) return [];
    if (!isRecord(v)) {
      errors.push(`${key}: must be an object keyed by recipe id.`);
      return [];
    }
    const entries = Object.entries(v);
    for (const [id] of entries) if (!ids.has(id)) errors.push(`${key}: recipe id ${JSON.stringify(id)} does not exist.`);
    return entries;
  };
  for (const [id, value] of section('category')) {
    if (typeof value !== 'string' || !refs.categories.has(value)) errors.push(`category: ${id} -> ${JSON.stringify(value)} is not a category id.`);
  }
  for (const [id, value] of section('cuisine')) {
    if (typeof value !== 'string' || !refs.cuisines.has(value)) errors.push(`cuisine: ${id} -> ${JSON.stringify(value)} is not a cuisine id.`);
  }
  for (const [id, value] of section('goesWith')) {
    if (!Array.isArray(value) || !value.every((x) => typeof x === 'string')) {
      errors.push(`goesWith: ${id} must be an array of recipe ids.`);
      continue;
    }
    for (const ref of value as string[]) if (!ids.has(ref)) errors.push(`goesWith: ${id} -> recipe id ${JSON.stringify(ref)} does not exist.`);
  }
  return errors;
}

/** `recipe` with `key` set to `value`; a new key goes right after `after` when that key exists (stable file layout). */
function withField(recipe: Recipe, key: string, value: unknown, after: string): Recipe {
  if (key in recipe || !(after in recipe)) return { ...recipe, [key]: value };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(recipe)) {
    out[k] = v;
    if (k === after) out[key] = value;
  }
  return out as Recipe;
}

/**
 * Apply a checked meta file. Pure: returns new recipe objects (recipes not named are the same
 * objects); `applied` counts the fields set. Idempotent: a second run gives the same recipes.
 */
export function applyMeta(recipes: Recipe[], meta: MetaReview): { recipes: Recipe[]; applied: number } {
  let applied = 0;
  const out = recipes.map((recipe): Recipe => {
    const category = meta.category?.[recipe.id];
    const goesWith = meta.goesWith?.[recipe.id];
    const cuisine = meta.cuisine?.[recipe.id];
    if (category === undefined && goesWith === undefined && cuisine === undefined) return recipe;
    let next: Recipe = recipe;
    if (category !== undefined) {
      next = { ...next, category };
      applied++;
    }
    if (goesWith !== undefined) {
      next = { ...next, goesWith: [...goesWith] };
      applied++;
    }
    if (cuisine !== undefined) {
      next = withField(next, 'cuisine', cuisine, 'category');
      applied++;
    }
    return next;
  });
  return { recipes: out, applied };
}
