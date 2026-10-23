// tools/apply-flag-slices.ts — validate and merge the lactose slices of the dictionary data pass
// (docs/specs/labels-categorieen.md §2a "De datapass") into data/ingredients.json.
//
//   node --experimental-strip-types tools/apply-flag-slices.ts --check
//   node --experimental-strip-types tools/apply-flag-slices.ts --apply
//
// The slices are data/work/lactose/slice-NN-<aisles>.json, one per aisle group, each a map
// `{ "<ingredient id>": { "lactose": boolean, "lactoseUnsure"?: true } }` (the shape of
// data/work/diet-flags-slice-1.json). Together they must cover every entry of
// data/ingredients.json exactly once.
//
// --check reports per slice how many ids it covers, how many ids of its aisles are in no slice and
// how many of its ids are in another slice too, then lists the errors (exit 1 on errors). Nothing
// is written. --apply runs the same check and, only when it is clean, writes data/ingredients.json
// in the file's own style (formatIngredientsFile: sorted by id, one entry per line) with `lactose`
// (and `lactoseUnsure`) placed right after `gluten`/`glutenUnsure`; every other field is left as it
// is. Re-running --apply gives the same file.
//
// Refused (checkSlices): an id that is not in data/ingredients.json, an id in two slices, an entry
// in no slice, a value that is not { lactose: boolean, lactoseUnsure?: true }, `lactoseUnsure` next
// to `lactose: true`, and on a plant-based entry (vegan: true) `lactose: true` or `lactoseUnsure`
// (rule H1). After --apply: npm run validate:data, node --experimental-strip-types
// tools/gen-golden.ts, npm run migrate, npm test.
//
// Node 22 type-stripping rules apply: type-only syntax only, plain ESM, no enums/namespaces.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import type { Ingredient } from '../src/domain/dictionary.ts';
import { formatIngredientsFile } from './apply-llm-batch.ts';

/** The flags one slice sets on one entry. */
export interface SliceFlags {
  lactose: boolean;
  lactoseUnsure?: true;
}

/** A slice file name: slice-NN-<aisle words>.json (an agent's input list next to it does not match). */
export const SLICE_FILE_RE = /^slice-\d{2}-[a-z0-9-]+\.json$/;

const FLAG_KEYS: ReadonlySet<string> = new Set(['lactose', 'lactoseUnsure']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The slice file names of `dir` in name order; [] when the directory does not exist. */
export function sliceFileNames(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => SLICE_FILE_RE.test(f))
    .sort();
}

/**
 * Every slice file of `dir` as parsed JSON, keyed by file name (unvalidated: this is the input of
 * `checkSlices`). Throws on a file that is not valid JSON, with the file name in the message.
 */
export function readSliceFiles(dir: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of sliceFileNames(dir)) {
    try {
      out[f] = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    } catch (e) {
      throw new Error(`${f}: not valid JSON (${e instanceof Error ? e.message : String(e)}).`);
    }
  }
  return out;
}

/**
 * Errors: unknown id, id in two slices, id missing in every slice, lactoseUnsure on lactose true,
 * lactose true (or lactoseUnsure) on a vegan entry, a value that is not { lactose, lactoseUnsure? }.
 * `slices` is keyed by slice file name (`readSliceFiles`). Empty = the merge may run.
 */
export function checkSlices(slices: Record<string, unknown>, ingredients: readonly Ingredient[]): string[] {
  const errors: string[] = [];
  const byId = new Map(ingredients.map((ing) => [ing.id, ing]));
  const firstFile = new Map<string, string>();
  for (const [file, content] of Object.entries(slices)) {
    if (!isRecord(content)) {
      errors.push(`${file}: must be an object { "<id>": { "lactose": true | false } }.`);
      continue;
    }
    for (const [id, value] of Object.entries(content)) {
      const where = `${file} ${JSON.stringify(id)}`;
      const ing = byId.get(id);
      if (!ing) errors.push(`${where}: unknown id (not in data/ingredients.json).`);
      const first = firstFile.get(id);
      if (first !== undefined) errors.push(`${where}: also in ${first} (every id belongs in exactly one slice).`);
      else firstFile.set(id, file);
      if (!isRecord(value) || typeof value['lactose'] !== 'boolean') {
        errors.push(`${where}: must be { "lactose": true | false } with an optional "lactoseUnsure": true.`);
        continue;
      }
      for (const k of Object.keys(value)) if (!FLAG_KEYS.has(k)) errors.push(`${where}: unexpected key ${JSON.stringify(k)} (a slice sets only lactose and lactoseUnsure).`);
      const unsure = value['lactoseUnsure'];
      if (unsure !== undefined && unsure !== true) errors.push(`${where}: "lactoseUnsure" is true or left out, got ${JSON.stringify(unsure)}.`);
      if (value['lactose'] === true && unsure === true) errors.push(`${where}: "lactose: true" is a fact; drop lactoseUnsure or use lactose: false, lactoseUnsure: true.`);
      if (ing?.vegan === true && value['lactose'] === true) errors.push(`${where}: a plant-based product cannot contain lactose (vegan: true, rule H1).`);
      if (ing?.vegan === true && unsure === true) errors.push(`${where}: a plant-based product is never unsure about lactose (vegan: true, rule H1).`);
    }
  }
  for (const ing of ingredients) {
    if (!firstFile.has(ing.id)) errors.push(`${JSON.stringify(ing.id)} (aisle ${ing.aisle}): in no slice.`);
  }
  return errors;
}

/**
 * The slices of `dir` merged into one map id -> flags (the input of `applySlices`). Run
 * `checkSlices` first: this throws on a value that is not { lactose, lactoseUnsure?: true } and
 * on an id that is in two slices, and never guesses which one wins.
 */
export function readSlices(dir: string): Record<string, SliceFlags> {
  const out: Record<string, SliceFlags> = {};
  const from = new Map<string, string>();
  for (const [file, content] of Object.entries(readSliceFiles(dir))) {
    if (!isRecord(content)) throw new Error(`${file}: not an object; run --check.`);
    for (const [id, value] of Object.entries(content)) {
      if (!isRecord(value) || typeof value['lactose'] !== 'boolean' || (value['lactoseUnsure'] !== undefined && value['lactoseUnsure'] !== true)) {
        throw new Error(`${file} ${JSON.stringify(id)}: not { lactose, lactoseUnsure?: true }; run --check.`);
      }
      const first = from.get(id);
      if (first !== undefined) throw new Error(`${file} ${JSON.stringify(id)}: also in ${first}; run --check.`);
      from.set(id, file);
      out[id] = value['lactoseUnsure'] === true ? { lactose: value['lactose'], lactoseUnsure: true } : { lactose: value['lactose'] };
    }
  }
  return out;
}

/** `entry` with its lactose flags replaced by `flags`, placed right after gluten/glutenUnsure. */
function withFlags(entry: Ingredient, flags: SliceFlags): Ingredient {
  const keys = Object.keys(entry).filter((k) => !FLAG_KEYS.has(k));
  let anchor = -1;
  keys.forEach((k, i) => {
    if (k === 'gluten' || k === 'glutenUnsure') anchor = i;
  });
  // No gluten flag on the entry (never the case in the committed data): the lactose flags go last.
  const at = anchor === -1 ? keys.length : anchor + 1;
  const out: Record<string, unknown> = {};
  for (const k of keys.slice(0, at)) out[k] = entry[k];
  out['lactose'] = flags.lactose;
  if (flags.lactoseUnsure === true) out['lactoseUnsure'] = true;
  for (const k of keys.slice(at)) out[k] = entry[k];
  return out as Ingredient;
}

/**
 * Sets `lactose` (and `lactoseUnsure: true` when the slice says so; an older `lactoseUnsure` is
 * dropped otherwise) on every entry that has flags in `slices`, right after `gluten`/`glutenUnsure`
 * in the key order. Other fields and entries are left untouched; the input is not mutated.
 * Idempotent: applying the same slices again gives the same entries.
 */
export function applySlices(ingredients: readonly Ingredient[], slices: Record<string, SliceFlags>): Ingredient[] {
  return ingredients.map((ing) => {
    const flags = Object.prototype.hasOwnProperty.call(slices, ing.id) ? slices[ing.id] : undefined;
    return flags ? withFlags(ing, flags) : ing;
  });
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/**
 * The aisles a slice file covers, read from its name: an aisle belongs to the slice when the first
 * word of the aisle id is one of the name's words (slice-06-kruiden-droog -> kruiden-specerijen,
 * droog). Only used to place missing ids in the --check report.
 */
function aislesOfSlice(file: string, aisleIds: readonly string[]): string[] {
  const words = new Set(file.replace(/^slice-\d{2}-|\.json$/g, '').split('-'));
  return aisleIds.filter((a) => words.has(a.split('-')[0] ?? a));
}

/**
 * Ids written twice inside one file (JSON.parse silently keeps only the last one). In a slice only
 * the ids have an object as their value, so every `"key": {` is an id.
 */
function repeatedKeysInFile(text: string): number {
  const seen = new Set<string>();
  let repeats = 0;
  for (const m of text.matchAll(/"([a-z0-9-]+)"\s*:\s*\{/g)) {
    const id = m[1] ?? '';
    if (seen.has(id)) repeats++;
    else seen.add(id);
  }
  return repeats;
}

/** The --check report: covered / missing / double per slice, then the totals. */
function report(dir: string, slices: Record<string, unknown>, ingredients: readonly Ingredient[]): void {
  const ids = new Set(ingredients.map((ing) => ing.id));
  const fileCount = new Map<string, number>();
  for (const content of Object.values(slices)) {
    if (isRecord(content)) for (const id of Object.keys(content)) fileCount.set(id, (fileCount.get(id) ?? 0) + 1);
  }
  const aisleIds = [...new Set(ingredients.map((ing) => ing.aisle))].sort();
  const placed = new Set<string>();
  for (const [file, content] of Object.entries(slices)) {
    const own = isRecord(content) ? Object.keys(content) : [];
    const covered = own.filter((id) => ids.has(id)).length;
    const double = own.filter((id) => (fileCount.get(id) ?? 0) > 1).length;
    const aisles = aislesOfSlice(file, aisleIds);
    for (const a of aisles) placed.add(a);
    const missing = ingredients.filter((ing) => aisles.includes(ing.aisle) && !fileCount.has(ing.id)).length;
    const repeats = repeatedKeysInFile(readFileSync(join(dir, file), 'utf8'));
    const warn = repeats > 0 ? `; warn: ${repeats} id(s) written twice inside the file (JSON keeps the last)` : '';
    console.log(`${file}: ${covered} covered, ${missing} missing, ${double} double [${aisles.join(', ') || 'no aisle recognised in the name'}]${warn}`);
  }
  const unplaced = new Map<string, number>();
  for (const ing of ingredients) if (!placed.has(ing.aisle) && !fileCount.has(ing.id)) unplaced.set(ing.aisle, (unplaced.get(ing.aisle) ?? 0) + 1);
  if (unplaced.size > 0) console.log(`no slice file yet for: ${[...unplaced].map(([a, n]) => `${a} (${n} missing)`).join(', ')}`);
  const covered = ingredients.filter((ing) => fileCount.has(ing.id)).length;
  const double = [...fileCount.values()].filter((n) => n > 1).length;
  console.log(`total: ${covered} of ${ingredients.length} entries covered, ${ingredients.length - covered} missing, ${double} id(s) in two or more slices`);
}

const MAX_LISTED = 100;

function main(argv: string[]): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const mode = argv[0];
  if (mode !== '--check' && mode !== '--apply') {
    console.error('usage: apply-flag-slices.ts --check | --apply');
    process.exit(2);
  }
  const dir = join(root, 'data', 'work', 'lactose');
  const ingredientsPath = join(root, 'data', 'ingredients.json');
  if (sliceFileNames(dir).length === 0) {
    console.log('no slice files in data/work/lactose/ (slice-NN-<aisles>.json).');
    process.exit(1);
  }
  const ingredients = JSON.parse(readFileSync(ingredientsPath, 'utf8')) as Ingredient[];
  let slices: Record<string, unknown>;
  try {
    slices = readSliceFiles(dir);
  } catch (e) {
    console.log(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
  report(dir, slices, ingredients);
  const errors = checkSlices(slices, ingredients);
  for (const e of errors.slice(0, MAX_LISTED)) console.log(`  ERROR: ${e}`);
  if (errors.length > MAX_LISTED) console.log(`  … and ${errors.length - MAX_LISTED} more error(s)`);
  console.log(`${errors.length === 0 ? 'OK' : 'FAIL'} — ${errors.length} error(s)`);
  if (errors.length > 0) {
    if (mode === '--apply') console.log('nothing written (fix the errors above).');
    process.exit(1);
  }
  if (mode === '--check') process.exit(0);

  const before = formatIngredientsFile(ingredients);
  const after = formatIngredientsFile(applySlices(ingredients, readSlices(dir)));
  if (after === before) {
    console.log('data/ingredients.json already carries these flags; nothing written.');
  } else {
    writeFileSync(ingredientsPath, after, 'utf8');
    console.log(`written: data/ingredients.json (lactose on all ${ingredients.length} entries)`);
  }
  console.log('next: npm run validate:data, node --experimental-strip-types tools/gen-golden.ts, npm run migrate, npm test');
  process.exit(0);
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href && basename(process.argv[1]) === 'apply-flag-slices.ts';
if (invokedDirectly) main(process.argv.slice(2));
