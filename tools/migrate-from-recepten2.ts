// tools/migrate-from-recepten2.ts — the 196 classics from Recepten2 -> data/recipes.json (schema 2).
//
// Reads:  data/source/recipes-recepten2.json (read-only, never edited by hand)
//         data/{units,qualifiers,prep-phrases,ingredients,aisles,categories}.json (the dictionary)
//         data/llm/batch-*.json (the committed LLM translation/structuring batches, when present)
// Writes: data/recipes.json = { schema: 2, dataVersion, generatedAt, recipes: Recipe[] } sorted by name.
//
// Per recipe: id = builtinId(name) ('b:' + slug), origin builtin, servings 4, lines = every raw
// string parsed with `parseLine` + the dictionary (docs/phase-2-spec.md §2/§3: qty, unit, ing,
// qual, part, prep, note, packSize, alt, optional, confidence next to `raw`; "Dressing:" -> kind
// 'header', empty strings dropped), steps = splitSteps(instructions) with timers = findTimers(step).
// The stray "" key of "Rendang met zelfgemaakt boemboe" is appended to the instructions by
// normalizeSource. "Naanbrood (voor bij dahl)" gets goesWith = [id of the dahl] when the main dish
// can be found by name. A first "step" that only states the servings becomes `servingTip`
// (splitServingNote). Then the committed batches are replayed with `applyBatch`
// (tools/apply-llm-batch.ts) and the human review layer (data/review/lines.json,
// tools/apply-review.ts) and, last, the fact-based diet tags (tools/derive-tags.ts
// `applyDerivedTags`: vegetarisch/vegan/glutenvrij from the dictionary flags, docs/phase-5-spec.md
// A.3): recipes.json = parse(raw) ⊕ llm enrichment ⊕ review ⊕ diet facts, so the file is
// reproducible from scratch. Output is deterministic except `generatedAt`.
//
// Run:   node --experimental-strip-types tools/migrate-from-recepten2.ts   (or: npm run migrate)
// Node 22 type-stripping rules apply: type-only syntax only, plain ESM, no enums/namespaces.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { loadDictionary, type Dictionary } from '../src/domain/dictionary.ts';
import { builtinId, type Recipe, type Step } from '../src/domain/model.ts';
import { parseLine } from '../src/domain/parser.ts';
import { foldDiacritics, normalizeSource } from '../src/domain/recipe-source.ts';
import { splitSteps } from '../src/domain/steps.ts';
import { findTimers } from '../src/domain/timers.ts';
import { applyBatch, batchPaths, checkBatch, readJson, type BatchFile } from './apply-llm-batch.ts';
import { applyReview, checkReview, readReview, type ReviewFile } from './apply-review.ts';
import { readDictionaryData } from './build-dictionary-seed.ts';
import { applyDerivedTags } from './derive-tags.ts';

/** Bump when the bundled classics change in a way the app must re-import (repo.ensureBuiltins). */
export const DATA_VERSION = 4;

/** First edition of the book: the "creation" date of every classic (deterministic output). */
export const BUILTIN_TIMESTAMP = '2025-12-01T00:00:00.000Z';

export interface RecipesFile {
  schema: 2;
  dataVersion: number;
  generatedAt: string;
  recipes: Recipe[];
}

/** Everything the migration needs besides the source: the dictionary and the committed batches. */
export interface MigrationInputs {
  dict: Dictionary;
  /** Batch files in replay order (file-name order); each is `{ path, batch }` for error messages. */
  batches: { path: string; batch: unknown }[];
  /** data/review/lines.json (human corrections, applied last), null when absent. */
  review?: ReviewFile | null;
  /** Set the fact-based diet tags as the last step (default true); tools/derive-tags.ts measures with false. */
  deriveTags?: boolean;
}

const SIDE_DISH_RE = /^(.*?)\s*\((?:voor\s+)?bij\s+(?:de\s+|het\s+|een\s+)?([^)]+)\)\s*$/i;

/**
 * A first "step" that only states the servings ("Voorgerecht voor 4 personen, hoofdgerecht voor 2
 * personen.") is a source-data quirk: it becomes the recipe's servingTip, not a cooking step.
 */
const SERVING_NOTE_RE = /^(?:voor|hoofd|bij)gerecht voor \d+ personen(?:,\s*(?:voor|hoofd|bij)gerecht voor \d+ personen)*\.?$/i;

export function splitServingNote(steps: string[]): { steps: string[]; servingTip: string | null } {
  const first = steps[0];
  if (steps.length > 1 && first !== undefined && SERVING_NOTE_RE.test(first.trim())) {
    return { steps: steps.slice(1), servingTip: first.trim() };
  }
  return { steps, servingTip: null };
}

function stepFromText(text: string): Step {
  const timers = findTimers(text);
  return timers.length ? { text: { nl: text }, timers } : { text: { nl: text } };
}

function fold(s: string): string {
  return foldDiacritics(s).toLowerCase().trim();
}

/** Id of the main dish named in "X (voor bij <dish>)", or null when no recipe matches. */
export function findMainDish(sideName: string, all: readonly { id: string; nameNl: string }[]): string | null {
  const m = SIDE_DISH_RE.exec(sideName);
  if (!m) return null;
  const target = fold(m[2] as string);
  if (!target) return null;
  const candidates = all.filter((r) => {
    const n = fold(r.nameNl);
    return n !== fold(sideName) && (n === target || n.startsWith(target + ' ') || n.split(/[^a-z0-9]+/).includes(target));
  });
  if (candidates.length === 0) return null;
  // Prefer the shortest name (the plain main dish over a variation of it), then alphabetical.
  candidates.sort((a, b) => a.nameNl.length - b.nameNl.length || a.id.localeCompare(b.id));
  return (candidates[0] as { id: string }).id;
}

/**
 * Pure migration: parsed source JSON + dictionary + batches -> the recipes file. Throws when a
 * committed batch does not validate (the message lists the problems), so a broken batch can never
 * silently produce a half-enriched file.
 */
export function migrate(raw: unknown, generatedAt: string, inputs: MigrationInputs): RecipesFile {
  const source = normalizeSource(raw);
  const index = source.map((s) => ({ id: builtinId(s.name), nameNl: s.name }));
  const { dict } = inputs;

  let recipes: Recipe[] = source.map((s) => {
    const mainDish = findMainDish(s.name, index);
    const { steps, servingTip } = splitServingNote(splitSteps(s.instructions));
    const recipe: Recipe = {
      schema: 2,
      id: builtinId(s.name),
      rev: 1,
      createdAt: BUILTIN_TIMESTAMP,
      updatedAt: BUILTIN_TIMESTAMP,
      origin: { kind: 'builtin' },
      name: { nl: s.name },
      tags: [],
      servings: 4,
      lines: s.ingredients.map((line) => parseLine(line, dict, 'nl')),
      steps: steps.map(stepFromText),
      goesWith: mainDish ? [mainDish] : [],
      aliases: [],
    };
    if (servingTip) recipe.servingTip = { nl: servingTip };
    return recipe;
  });

  for (const { path, batch } of inputs.batches) {
    const check = checkBatch(batch, recipes, dict, 'replay');
    if (check.errors.length > 0 || !check.batch) {
      throw new Error(`${path}: ${check.errors.length} error(s):\n  ${check.errors.join('\n  ')}`);
    }
    recipes = applyBatch(recipes, check.batch as BatchFile, dict, []).recipes;
  }

  if (inputs.review) {
    const errors = checkReview(inputs.review, recipes, dict);
    if (errors.length > 0) throw new Error(`data/review/lines.json: ${errors.length} error(s):\n  ${errors.join('\n  ')}`);
    recipes = applyReview(recipes, inputs.review).recipes;
  }

  // Diet facts last: the dictionary, not the LLM, decides vegetarisch / vegan / glutenvrij.
  if (inputs.deriveTags !== false) recipes = recipes.map((r) => applyDerivedTags(r, dict));

  const collator = new Intl.Collator('nl', { sensitivity: 'base' });
  recipes.sort((a, b) => collator.compare(a.name.nl ?? '', b.name.nl ?? '') || a.id.localeCompare(b.id));

  return { schema: 2, dataVersion: DATA_VERSION, generatedAt, recipes };
}

/** The dictionary and batches as they are on disk under `root` (the project folder). */
export function loadMigrationInputs(root: string): MigrationInputs {
  return {
    dict: loadDictionary(readDictionaryData(root)),
    batches: batchPaths(root).map((path) => ({ path: path.slice(root.length + 1).replace(/\\/g, '/'), batch: readJson(path) })),
    review: readReview(root),
  };
}

/** Counts for the summary line and the tests. */
export function migrationStats(file: RecipesFile): { lines: number; resolved: number; headers: number; translated: number; steps: number; timers: number } {
  let lines = 0;
  let resolved = 0;
  let headers = 0;
  for (const r of file.recipes) {
    for (const l of r.lines) {
      if (l.kind === 'header') headers++;
      else {
        lines++;
        if (l.ing) resolved++;
      }
    }
  }
  return {
    lines,
    resolved,
    headers,
    translated: file.recipes.filter((r) => r.text?.en === 'llm' || r.text?.en === 'human').length,
    steps: file.recipes.reduce((n, r) => n + r.steps.length, 0),
    timers: file.recipes.reduce((n, r) => n + r.steps.reduce((m, s) => m + (s.timers?.length ?? 0), 0), 0),
  };
}

function main(): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const sourcePath = join(root, 'data', 'source', 'recipes-recepten2.json');
  const outPath = join(root, 'data', 'recipes.json');

  const raw: unknown = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const inputs = loadMigrationInputs(root);
  let file: RecipesFile;
  try {
    file = migrate(raw, new Date().toISOString(), inputs);
  } catch (e) {
    console.error(`ERROR: ${(e as Error).message}`);
    process.exit(1);
  }
  writeFileSync(outPath, JSON.stringify(file, null, 2) + '\n', 'utf8');

  const ids = new Set(file.recipes.map((r) => r.id));
  const s = migrationStats(file);
  const pct = ((100 * s.resolved) / Math.max(1, s.lines)).toFixed(1);
  const linked = file.recipes.filter((r) => r.goesWith.length > 0).map((r) => `${r.name.nl} -> ${r.goesWith.join(', ')}`);
  console.log(
    `data/recipes.json: ${file.recipes.length} recipes (${ids.size} unique ids), ${s.lines} ingredient lines + ${s.headers} headers, ` +
      `${s.resolved} resolved (${pct}%), ${s.steps} steps, ${s.timers} timers, ${s.translated} with English (${inputs.batches.length} batch file(s)), ` +
      `dictionary ${inputs.dict.ingredients.length} ingredients, dataVersion ${file.dataVersion}`,
  );
  for (const l of linked) console.log(`  goesWith: ${l}`);
  if (ids.size !== file.recipes.length) {
    console.error('ERROR: duplicate ids');
    process.exit(1);
  }
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
