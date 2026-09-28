// tools/validate-data.ts — data guard for CI and for the local dev loop.
//
// Validates the schema-1 source corpus (data/source/recipes-recepten2.json) and the generated
// schema-2 file data/recipes.json (tools/migrate-from-recepten2.ts, docs/phase-1-spec.md §2).
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
// Schema 2: data/recipes.json  (docs/phase-1-spec.md §2, written by tools/migrate-from-recepten2.ts)
// ---------------------------------------------------------------------------
//
// Phase-1 rules (errors): file is { schema: 2, dataVersion, generatedAt, recipes[] }; every recipe
// has schema 2, a unique id, a positive integer rev, origin.kind in builtin | user | received,
// non-empty name.nl, servings > 0, lines with a non-empty raw.nl or raw.en, at least one step with
// non-empty text, and goesWith ids that exist. Warnings: a builtin without the 'b:' id prefix,
// timers with a max below min, duplicate names.
//
// Later phases add: name.en present, category in data/categories.json, lines[].ing/unit known in
// the dictionaries, equal step counts per language, and the parser golden fixture coverage.

const ORIGIN_KINDS: ReadonlySet<string> = new Set(['builtin', 'user', 'received']);
const TIMER_UNITS: ReadonlySet<string> = new Set(['sec', 'min', 'hour']);

function hasText(value: unknown, field: 'nl' | 'en'): boolean {
  return isRecord(value) && typeof value[field] === 'string' && (value[field] as string).trim() !== '';
}

/** Validate the schema-2 recipes file. Pure: takes the parsed JSON, returns errors/warnings. */
export function validateSchema2(data: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let lines = 0;

  if (!isRecord(data)) {
    errors.push('Top level must be an object { schema, dataVersion, generatedAt, recipes }.');
    return { errors, warnings, stats: { recipes: 0, lines } };
  }
  if (data['schema'] !== 2) errors.push('"schema" must be 2.');
  const dataVersion = data['dataVersion'];
  if (typeof dataVersion !== 'number' || !Number.isInteger(dataVersion) || dataVersion < 1) {
    errors.push('"dataVersion" must be a positive integer.');
  }
  if (typeof data['generatedAt'] !== 'string' || Number.isNaN(new Date(data['generatedAt'] as string).getTime())) {
    errors.push('"generatedAt" must be an ISO timestamp.');
  }
  const recipes = data['recipes'];
  if (!Array.isArray(recipes)) {
    errors.push('"recipes" must be an array.');
    return { errors, warnings, stats: { recipes: 0, lines } };
  }

  const ids = new Map<string, number>();
  const names = new Map<string, number>();
  recipes.forEach((recipe: unknown, index: number) => {
    const where = `recipe #${index}`;
    if (!isRecord(recipe)) {
      errors.push(`${where}: not an object.`);
      return;
    }
    const id = recipe['id'];
    const label = typeof id === 'string' && id !== '' ? `"${id}"` : where;

    if (recipe['schema'] !== 2) errors.push(`${label}: "schema" must be 2.`);

    if (typeof id !== 'string' || id.trim() === '') {
      errors.push(`${where}: "id" must be a non-empty string.`);
    } else {
      const first = ids.get(id);
      if (first !== undefined) errors.push(`${label}: duplicate id (also recipe #${first}).`);
      else ids.set(id, index);
    }

    const rev = recipe['rev'];
    if (typeof rev !== 'number' || !Number.isInteger(rev) || rev < 1) errors.push(`${label}: "rev" must be a positive integer.`);

    for (const field of ['createdAt', 'updatedAt']) {
      const v = recipe[field];
      if (typeof v !== 'string' || Number.isNaN(new Date(v).getTime())) errors.push(`${label}: "${field}" must be an ISO timestamp.`);
    }

    const origin = recipe['origin'];
    if (!isRecord(origin) || typeof origin['kind'] !== 'string' || !ORIGIN_KINDS.has(origin['kind'])) {
      errors.push(`${label}: "origin.kind" must be builtin | user | received.`);
    } else if (origin['kind'] === 'builtin' && typeof id === 'string' && !id.startsWith('b:')) {
      warnings.push(`${label}: builtin recipe without the "b:" id prefix.`);
    }

    const name = recipe['name'];
    if (!hasText(name, 'nl')) {
      errors.push(`${label}: "name.nl" must be a non-empty string.`);
    } else {
      const key = ((name as Record<string, unknown>)['nl'] as string).trim().toLowerCase();
      const first = names.get(key);
      if (first !== undefined) warnings.push(`${label}: duplicate name.nl (also recipe #${first}).`);
      else names.set(key, index);
    }

    const servings = recipe['servings'];
    if (typeof servings !== 'number' || !(servings > 0)) errors.push(`${label}: "servings" must be > 0.`);

    for (const field of ['tags', 'goesWith', 'aliases']) {
      const v = recipe[field];
      if (!Array.isArray(v) || v.some((s) => typeof s !== 'string')) errors.push(`${label}: "${field}" must be an array of strings.`);
    }

    const recipeLines = recipe['lines'];
    if (!Array.isArray(recipeLines)) {
      errors.push(`${label}: "lines" must be an array.`);
    } else {
      if (recipeLines.length === 0) warnings.push(`${label}: "lines" is empty.`);
      recipeLines.forEach((line: unknown, i: number) => {
        lines++;
        if (!isRecord(line) || !(hasText(line['raw'], 'nl') || hasText(line['raw'], 'en'))) {
          errors.push(`${label}: lines[${i}] has no non-empty raw.nl or raw.en.`);
          return;
        }
        const kind = line['kind'];
        if (kind !== undefined && kind !== 'line' && kind !== 'header') errors.push(`${label}: lines[${i}].kind must be line | header.`);
      });
    }

    const steps = recipe['steps'];
    if (!Array.isArray(steps) || steps.length === 0) {
      errors.push(`${label}: "steps" must contain at least one step.`);
    } else {
      steps.forEach((step: unknown, i: number) => {
        if (!isRecord(step) || !(hasText(step['text'], 'nl') || hasText(step['text'], 'en'))) {
          errors.push(`${label}: steps[${i}] has no non-empty text.nl or text.en.`);
          return;
        }
        const timers = step['timers'];
        if (timers === undefined) return;
        if (!Array.isArray(timers)) {
          errors.push(`${label}: steps[${i}].timers must be an array.`);
          return;
        }
        timers.forEach((t: unknown, j: number) => {
          if (!isRecord(t) || typeof t['min'] !== 'number' || !(t['min'] > 0) || typeof t['unit'] !== 'string' || !TIMER_UNITS.has(t['unit'])) {
            errors.push(`${label}: steps[${i}].timers[${j}] must have min > 0 and unit sec | min | hour.`);
          } else if (typeof t['max'] === 'number' && t['max'] < (t['min'] as number)) {
            warnings.push(`${label}: steps[${i}].timers[${j}] has max < min.`);
          }
        });
      });
    }
  });

  // goesWith ids must exist (second pass, all ids known).
  recipes.forEach((recipe: unknown) => {
    if (!isRecord(recipe) || !Array.isArray(recipe['goesWith'])) return;
    const label = typeof recipe['id'] === 'string' ? `"${recipe['id']}"` : 'recipe';
    for (const ref of recipe['goesWith']) {
      if (typeof ref === 'string' && !ids.has(ref)) errors.push(`${label}: goesWith id ${JSON.stringify(ref)} does not exist.`);
    }
  });

  return { errors, warnings, stats: { recipes: recipes.length, lines } };
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
