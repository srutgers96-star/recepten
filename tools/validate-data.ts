// tools/validate-data.ts — data guard for CI and for the local dev loop.
//
// Today it validates the schema-1 source corpus (data/source/recipes-recepten2.json). The schema-2
// validation of data/recipes.json (PLAN.md §5 "Guards in CI") is prepared as a stub below and will
// be switched on once the migration writes that file.
//
// Run:   node --experimental-strip-types tools/validate-data.ts   (or: npm run validate:data)
// Exit:  1 when any error was found, 0 otherwise. Warnings never fail the run.
//
// Node 22 type-stripping rules apply: type-only syntax only, plain ESM, no enums/namespaces.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';

export interface ValidationResult {
  /** Human-readable problems that must fail CI. */
  errors: string[];
  /** Human-readable oddities worth a look but not a failure. */
  warnings: string[];
  /** Counts for the summary line. */
  stats: { recipes: number; lines: number };
}

const SOURCE_KEYS: ReadonlySet<string> = new Set(['name', 'ingredients', 'instructions']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Schema 1: data/source/recipes-recepten2.json  ({ name, ingredients: string[], instructions })
// ---------------------------------------------------------------------------

/** Validate the schema-1 source export. Pure: takes the parsed JSON, returns errors/warnings. */
export function validateSource(data: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let lines = 0;

  if (!Array.isArray(data)) {
    errors.push('Top level must be an array of recipes.');
    return { errors, warnings, stats: { recipes: 0, lines } };
  }

  const names = new Map<string, number>(); // name -> first index
  data.forEach((recipe: unknown, index: number) => {
    const where = `recipe #${index}`;
    if (!isRecord(recipe)) {
      errors.push(`${where}: not an object.`);
      return;
    }

    // name: non-empty string, unique across the corpus
    const name = recipe['name'];
    const label = typeof name === 'string' && name.trim() !== '' ? `"${name}"` : where;
    if (typeof name !== 'string' || name.trim() === '') {
      errors.push(`${where}: "name" must be a non-empty string.`);
    } else {
      if (name !== name.trim()) warnings.push(`${label}: "name" has leading/trailing whitespace.`);
      const key = name.trim().toLowerCase();
      const first = names.get(key);
      if (first !== undefined) errors.push(`${label}: duplicate name (also recipe #${first}).`);
      else names.set(key, index);
    }

    // ingredients: string[], warn on empty strings
    const ingredients = recipe['ingredients'];
    if (!Array.isArray(ingredients)) {
      errors.push(`${label}: "ingredients" must be an array of strings.`);
    } else {
      if (ingredients.length === 0) warnings.push(`${label}: "ingredients" is empty.`);
      ingredients.forEach((entry: unknown, i: number) => {
        if (typeof entry !== 'string') {
          errors.push(`${label}: ingredients[${i}] is not a string.`);
        } else {
          lines++;
          if (entry.trim() === '') warnings.push(`${label}: ingredients[${i}] is an empty string.`);
        }
      });
    }

    // instructions: string
    const instructions = recipe['instructions'];
    if (typeof instructions !== 'string') {
      errors.push(`${label}: "instructions" must be a string.`);
    } else if (instructions.trim() === '') {
      warnings.push(`${label}: "instructions" is empty.`);
    }

    // unknown keys (the export has one stray "" key; keep it visible, do not fail on it)
    for (const key of Object.keys(recipe)) {
      if (!SOURCE_KEYS.has(key)) warnings.push(`${label}: unexpected key ${JSON.stringify(key)}.`);
    }
  });

  return { errors, warnings, stats: { recipes: data.length, lines } };
}

// ---------------------------------------------------------------------------
// Schema 2: data/recipes.json  (PLAN.md §5) — TODO, enable once the migration writes this file.
// ---------------------------------------------------------------------------
//
// TODO(schema-2) rules from PLAN.md §5 "Guards in CI":
//   - `id` unique across recipes (built-in ids "b:<slug>", user ids "u:<8 random chars>").
//   - `name.nl` AND `name.en` present and non-empty.
//   - `category` is one of data/categories.json.
//   - every `lines[].ing` is a known id in data/ingredients.json (or null = free text);
//     every `lines[].unit` is a known id in data/units.json (or null).
//   - `steps[]`: equal step count per language — every step has both `nl` and `en`
//     (step 3 NL = step 3 EN), no empty step text.
//   - no empty `raw` on any line (`raw.nl` or `raw.en` must be a non-empty string).
//   - `schema` === 2; `rev` is a positive integer; `origin.kind` in builtin | user | received.
// Also planned: check that parser.golden.json still covers every unique raw line.

/** Placeholder until data/recipes.json exists; returns a single warning so the gap stays visible. */
export function validateSchema2(data: unknown): ValidationResult {
  void data;
  return {
    errors: [],
    warnings: ['schema-2 validation (data/recipes.json) is not implemented yet — see TODO in tools/validate-data.ts.'],
    stats: { recipes: 0, lines: 0 },
  };
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function print(title: string, result: ValidationResult): void {
  for (const w of result.warnings) console.log(`  warn:  ${w}`);
  for (const e of result.errors) console.log(`  ERROR: ${e}`);
  const status = result.errors.length === 0 ? 'OK' : 'FAIL';
  console.log(
    `${title}: ${status} — ${result.stats.recipes} recipes, ${result.stats.lines} ingredient lines, ` +
      `${result.errors.length} error(s), ${result.warnings.length} warning(s)`,
  );
}

function main(): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  let failed = false;

  const sourceRel = 'data/source/recipes-recepten2.json';
  const source = validateSource(readJson(join(root, sourceRel)));
  print(sourceRel, source);
  if (source.errors.length > 0) failed = true;

  const schema2Rel = 'data/recipes.json';
  const schema2Path = join(root, schema2Rel);
  if (existsSync(schema2Path)) {
    const schema2 = validateSchema2(readJson(schema2Path));
    print(schema2Rel, schema2);
    if (schema2.errors.length > 0) failed = true;
  } else {
    console.log(`${schema2Rel}: not present yet (schema-2 checks skipped).`);
  }

  process.exit(failed ? 1 : 0);
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
