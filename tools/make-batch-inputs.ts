// tools/make-batch-inputs.ts — the inputs for the LLM translation/structuring sessions.
//
// Reads data/recipes.json (run `npm run migrate` first) and the dictionary, and writes:
//   data/work/batches/batch-NN.input.json  (NN = 01..20; ~10 recipes each, in recipe-id order):
//     { batch, recipes: [{ id, name: {nl}, servings, lines: [{ i, raw, parsed: { qty, unit, ing,
//       qual, prep: {nl}, name } }], steps: [{ nl }], servingTip: {nl}? }] }
//     `i` is the index into recipe.lines (headers count but are not listed), so the answer's
//     `lines[].i` maps straight back (docs/phase-2-spec.md §4 batch schema, data/README.md).
//   data/work/dictionary-ids.json  [{ id, nl, en, aisle }] sorted by id — the ids an answer may use.
//   data/work/vocab.json           { categories, tags, aisles, units } — the closed vocabularies.
// The answers go to data/llm/batch-NN.json and are merged with tools/apply-llm-batch.ts.
//
// Run:   node --experimental-strip-types tools/make-batch-inputs.ts
// Node 22 type-stripping rules apply: type-only syntax only, plain ESM, no enums/namespaces.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import type { DictionaryData } from '../src/domain/dictionary.ts';
import type { Line, Recipe } from '../src/domain/model.ts';
import { readDictionaryData } from './build-dictionary-seed.ts';
import { RECIPE_TAGS } from './validate-data.ts';

export const BATCH_COUNT = 20;

export interface BatchInputLine {
  i: number;
  raw: string;
  parsed: {
    qty: Line['qty'];
    unit: string | null;
    ing: string | null;
    qual: string[];
    prep: { nl?: string } | null;
    name: string;
  };
}

export interface BatchInputRecipe {
  id: string;
  name: { nl: string };
  servings: number;
  lines: BatchInputLine[];
  steps: { nl: string }[];
  servingTip?: { nl: string };
}

export interface BatchInputFile {
  batch: number;
  recipes: BatchInputRecipe[];
}

/** Split `n` items into `count` chunks whose sizes differ by at most one (first chunks get the extra). */
export function chunkSizes(n: number, count: number): number[] {
  const base = Math.floor(n / count);
  const extra = n % count;
  return Array.from({ length: count }, (_v, i) => base + (i < extra ? 1 : 0));
}

export function batchInputRecipe(r: Recipe): BatchInputRecipe {
  const lines: BatchInputLine[] = [];
  r.lines.forEach((l, i) => {
    if (l.kind === 'header') return;
    lines.push({
      i,
      raw: l.raw.nl ?? l.raw.en ?? '',
      parsed: {
        qty: l.qty ?? null,
        unit: l.unit ?? null,
        ing: l.ing ?? null,
        qual: l.qual ?? [],
        prep: l.prep?.nl ? { nl: l.prep.nl } : null,
        name: l.name ?? '',
      },
    });
  });
  const out: BatchInputRecipe = {
    id: r.id,
    name: { nl: r.name.nl ?? '' },
    servings: r.servings,
    lines,
    steps: r.steps.map((s) => ({ nl: s.text.nl ?? '' })),
  };
  if (r.servingTip?.nl) out.servingTip = { nl: r.servingTip.nl };
  return out;
}

/** Recipes in id order, split into BATCH_COUNT batches. */
export function buildBatchInputs(recipes: readonly Recipe[]): BatchInputFile[] {
  const sorted = [...recipes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const out: BatchInputFile[] = [];
  let offset = 0;
  chunkSizes(sorted.length, BATCH_COUNT).forEach((size, i) => {
    out.push({ batch: i + 1, recipes: sorted.slice(offset, offset + size).map(batchInputRecipe) });
    offset += size;
  });
  return out;
}

export function buildDictionaryIds(data: DictionaryData): { id: string; nl: string; en: string; aisle: string }[] {
  return [...data.ingredients]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((i) => ({ id: i.id, nl: i.nl.one, en: i.en.one, aisle: i.aisle }));
}

export function buildVocab(data: DictionaryData): { categories: string[]; tags: string[]; aisles: string[]; units: string[] } {
  const byOrder = <T extends { id: string; order: number }>(items: readonly T[]) => [...items].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)).map((x) => x.id);
  return {
    categories: byOrder(data.categories),
    tags: [...RECIPE_TAGS],
    aisles: byOrder(data.aisles),
    units: [...data.units].map((u) => u.id).sort(),
  };
}

function main(): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const file = JSON.parse(readFileSync(join(root, 'data', 'recipes.json'), 'utf8')) as { recipes: Recipe[] };
  const data = readDictionaryData(root);
  const workDir = join(root, 'data', 'work');
  const batchDir = join(workDir, 'batches');
  mkdirSync(batchDir, { recursive: true });

  const batches = buildBatchInputs(file.recipes);
  for (const b of batches) {
    const name = `batch-${String(b.batch).padStart(2, '0')}.input.json`;
    writeFileSync(join(batchDir, name), JSON.stringify(b, null, 2) + '\n', 'utf8');
  }
  writeFileSync(join(workDir, 'dictionary-ids.json'), JSON.stringify(buildDictionaryIds(data), null, 2) + '\n', 'utf8');
  writeFileSync(join(workDir, 'vocab.json'), JSON.stringify(buildVocab(data), null, 2) + '\n', 'utf8');

  const sizes = batches.map((b) => b.recipes.length);
  const lines = batches.reduce((n, b) => n + b.recipes.reduce((m, r) => m + r.lines.length, 0), 0);
  console.log(`data/work/batches/: ${batches.length} files, ${sizes.join('/')} recipes (${lines} ingredient lines)`);
  console.log(`data/work/dictionary-ids.json: ${data.ingredients.length} ids; data/work/vocab.json: ${data.categories.length} categories, ${RECIPE_TAGS.length} tags, ${data.aisles.length} aisles, ${data.units.length} units`);
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
