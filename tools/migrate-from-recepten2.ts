// tools/migrate-from-recepten2.ts — the 196 classics from Recepten2 -> data/recipes.json (schema 2).
//
// Reads:  data/source/recipes-recepten2.json (read-only, never edited by hand)
// Writes: data/recipes.json = { schema: 2, dataVersion, generatedAt, recipes: Recipe[] } sorted by name.
//
// Per recipe: id = builtinId(name) ('b:' + slug), origin builtin, servings 4, lines = the raw
// strings ("Dressing:" -> kind 'header', empty strings dropped), steps = splitSteps(instructions)
// with timers = findTimers(step). The stray "" key of "Rendang met zelfgemaakt boemboe" is appended
// to the instructions by normalizeSource. "Naanbrood (voor bij dahl)" gets goesWith = [id of the
// dahl] when the main dish can be found by name. Output is deterministic except `generatedAt`.
//
// Run:   node --experimental-strip-types tools/migrate-from-recepten2.ts   (or: npm run migrate)
// Node 22 type-stripping rules apply: type-only syntax only, plain ESM, no enums/namespaces.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { builtinId, type Line, type Recipe, type Step } from '../src/domain/model.ts';
import { foldDiacritics, normalizeSource } from '../src/domain/recipe-source.ts';
import { splitSteps } from '../src/domain/steps.ts';
import { findTimers } from '../src/domain/timers.ts';

/** Bump when the bundled classics change in a way the app must re-import (repo.ensureBuiltins). */
export const DATA_VERSION = 1;

/** First edition of the book: the "creation" date of every classic (deterministic output). */
export const BUILTIN_TIMESTAMP = '2025-12-01T00:00:00.000Z';

export interface RecipesFile {
  schema: 2;
  dataVersion: number;
  generatedAt: string;
  recipes: Recipe[];
}

const SIDE_DISH_RE = /^(.*?)\s*\((?:voor\s+)?bij\s+(?:de\s+|het\s+|een\s+)?([^)]+)\)\s*$/i;

function lineFromRaw(raw: string): Line {
  return /:\s*$/.test(raw) ? { raw: { nl: raw }, kind: 'header' } : { raw: { nl: raw } };
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

/** Pure migration: parsed source JSON -> the recipes file. */
export function migrate(raw: unknown, generatedAt: string = new Date().toISOString()): RecipesFile {
  const source = normalizeSource(raw);
  const index = source.map((s) => ({ id: builtinId(s.name), nameNl: s.name }));

  const recipes: Recipe[] = source.map((s) => {
    const mainDish = findMainDish(s.name, index);
    return {
      schema: 2,
      id: builtinId(s.name),
      rev: 1,
      createdAt: BUILTIN_TIMESTAMP,
      updatedAt: BUILTIN_TIMESTAMP,
      origin: { kind: 'builtin' },
      name: { nl: s.name },
      tags: [],
      servings: 4,
      lines: s.ingredients.map(lineFromRaw),
      steps: splitSteps(s.instructions).map(stepFromText),
      goesWith: mainDish ? [mainDish] : [],
      aliases: [],
    };
  });

  const collator = new Intl.Collator('nl', { sensitivity: 'base' });
  recipes.sort((a, b) => collator.compare(a.name.nl ?? '', b.name.nl ?? '') || a.id.localeCompare(b.id));

  return { schema: 2, dataVersion: DATA_VERSION, generatedAt, recipes };
}

function main(): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const sourcePath = join(root, 'data', 'source', 'recipes-recepten2.json');
  const outPath = join(root, 'data', 'recipes.json');

  const raw: unknown = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const file = migrate(raw);
  writeFileSync(outPath, JSON.stringify(file, null, 2) + '\n', 'utf8');

  const ids = new Set(file.recipes.map((r) => r.id));
  const steps = file.recipes.reduce((n, r) => n + r.steps.length, 0);
  const timers = file.recipes.reduce((n, r) => n + r.steps.reduce((m, s) => m + (s.timers?.length ?? 0), 0), 0);
  const linked = file.recipes.filter((r) => r.goesWith.length > 0).map((r) => `${r.name.nl} -> ${r.goesWith.join(', ')}`);
  console.log(`data/recipes.json: ${file.recipes.length} recipes (${ids.size} unique ids), ${steps} steps, ${timers} timers, dataVersion ${file.dataVersion}`);
  for (const l of linked) console.log(`  goesWith: ${l}`);
  if (ids.size !== file.recipes.length) {
    console.error('ERROR: duplicate ids');
    process.exit(1);
  }
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
