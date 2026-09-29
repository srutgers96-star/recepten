// tools/apply-review.ts — the human review layer over the structured ingredient lines
// (docs/phase-2-spec.md §4 "order of truth": raw line -> parser -> LLM batches -> human review).
//
// data/review/lines.json holds hand-checked corrections for single lines of the classics that
// neither the parser nor a batch can express: an `ing` the parser resolves wrongly (the merge rule
// never lets a batch override a parser hit), a qualifier to keep, a note with its English. It is
// replayed last by `npm run migrate` and by `apply-llm-batch.ts --apply all`, so data/recipes.json
// stays reproducible. Quantities and units are never touched here either (they come from `raw`).
//
//   { "reviewed": "2026-09-29", "lines": [
//     { "id": "b:pasta-met-zalm-en-rucola", "i": 0, "raw": "400 g rode zalm",
//       "ing": "zalm-uit-blik", "qual": ["rode"], "why": "the steps drain the salmon and remove skin and bones" } ] }
//
// `raw` must equal the recipe's raw line (guards against shifted indexes). Allowed patches: `ing`
// (an ingredients.json id), `qual` (qualifier ids; `[]` clears), `note` and `prep` ({ nl?, en? } or
// null to drop), `optional`. Anything else is refused. Node 22 type-stripping rules apply.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Dictionary } from '../src/domain/dictionary.ts';
import type { Line, Recipe, Text } from '../src/domain/model.ts';

export interface ReviewLine {
  id: string;
  i: number;
  raw: string;
  ing?: string;
  qual?: string[];
  note?: Text | null;
  prep?: Text | null;
  optional?: boolean;
  /** Free text for the reader of the file; not copied into the data. */
  why?: string;
}

export interface ReviewFile {
  reviewed: string;
  lines: ReviewLine[];
}

const PATCH_KEYS: ReadonlySet<string> = new Set(['id', 'i', 'raw', 'ing', 'qual', 'note', 'prep', 'optional', 'why']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isTextLike(v: unknown): v is Text {
  if (!isRecord(v)) return false;
  for (const k of ['nl', 'en']) if (v[k] !== undefined && typeof v[k] !== 'string') return false;
  return true;
}

/** data/review/lines.json when it exists, else null. Throws on malformed JSON. */
export function readReview(root: string): ReviewFile | null {
  const path = join(root, 'data', 'review', 'lines.json');
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as ReviewFile;
}

/** Validate the review file against the recipes and the dictionary. Pure; returns the errors. */
export function checkReview(raw: unknown, recipes: readonly Recipe[], dict: Dictionary): string[] {
  const errors: string[] = [];
  if (!isRecord(raw) || !Array.isArray(raw['lines'])) return ['must be { reviewed, lines[] }.'];
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const seen = new Set<string>();
  raw['lines'].forEach((entry: unknown, n: number) => {
    const where = `lines[${n}]`;
    if (!isRecord(entry)) {
      errors.push(`${where}: not an object.`);
      return;
    }
    for (const k of Object.keys(entry)) if (!PATCH_KEYS.has(k)) errors.push(`${where}: "${k}" cannot be reviewed (only ing, qual, note, prep, optional).`);
    const recipe = typeof entry['id'] === 'string' ? byId.get(entry['id']) : undefined;
    if (!recipe) {
      errors.push(`${where}: recipe id ${JSON.stringify(entry['id'])} does not exist.`);
      return;
    }
    const i = entry['i'];
    if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= recipe.lines.length) {
      errors.push(`${where}: line index ${JSON.stringify(i)} is out of range for ${recipe.id}.`);
      return;
    }
    const key = `${recipe.id}#${i}`;
    if (seen.has(key)) errors.push(`${where}: ${key} is listed twice.`);
    seen.add(key);
    const target = recipe.lines[i] as Line;
    if (target.kind === 'header') errors.push(`${where}: ${key} is a header line.`);
    if (entry['raw'] !== target.raw.nl) errors.push(`${where}: raw ${JSON.stringify(entry['raw'])} differs from the recipe line ${JSON.stringify(target.raw.nl)}.`);
    if (entry['ing'] !== undefined && (typeof entry['ing'] !== 'string' || !dict.get(entry['ing']))) errors.push(`${where}: ing ${JSON.stringify(entry['ing'])} is not an ingredient id.`);
    const qual = entry['qual'];
    if (qual !== undefined) {
      if (!Array.isArray(qual) || !qual.every((q) => typeof q === 'string')) errors.push(`${where}: qual must be an array of qualifier ids.`);
      else for (const q of qual as string[]) if (!dict.qualifier(q)) errors.push(`${where}: qualifier ${JSON.stringify(q)} does not exist.`);
    }
    for (const k of ['note', 'prep']) {
      const v = entry[k];
      if (v !== undefined && v !== null && !isTextLike(v)) errors.push(`${where}: ${k} must be null or { nl?, en? }.`);
    }
    if (entry['optional'] !== undefined && typeof entry['optional'] !== 'boolean') errors.push(`${where}: optional must be a boolean.`);
    if (entry['ing'] === undefined && qual === undefined && entry['note'] === undefined && entry['prep'] === undefined && entry['optional'] === undefined) {
      errors.push(`${where}: ${key} changes nothing.`);
    }
  });
  return errors;
}

/** Apply a checked review file. Pure: returns new recipe objects; lines not reviewed are untouched. */
export function applyReview(recipes: readonly Recipe[], review: ReviewFile): { recipes: Recipe[]; applied: number } {
  const byRecipe = new Map<string, ReviewLine[]>();
  for (const l of review.lines) {
    const list = byRecipe.get(l.id) ?? [];
    list.push(l);
    byRecipe.set(l.id, list);
  }
  let applied = 0;
  const out = recipes.map((recipe): Recipe => {
    const patches = byRecipe.get(recipe.id);
    if (!patches) return recipe;
    const lines = recipe.lines.map((line, i) => {
      const p = patches.find((x) => x.i === i);
      if (!p) return line;
      const next: Line = { ...line };
      if (p.ing !== undefined) {
        next.ing = p.ing;
        if (p.qual === undefined) delete next.qual;
      }
      if (p.qual !== undefined) {
        if (p.qual.length) next.qual = [...p.qual];
        else delete next.qual;
      }
      for (const k of ['note', 'prep'] as const) {
        if (p[k] === undefined) continue;
        if (p[k] === null) delete next[k];
        else next[k] = { ...(p[k] as Text) };
      }
      if (p.optional !== undefined) {
        if (p.optional) next.optional = true;
        else delete next.optional;
      }
      next.confidence = 1;
      applied++;
      return next;
    });
    return { ...recipe, lines };
  });
  return { recipes: out, applied };
}
