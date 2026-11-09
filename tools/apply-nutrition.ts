// tools/apply-nutrition.ts — validate and merge the nutrition batches (data/llm/nutrition/batch-NN.json,
// docs/specs/verbeterronde-9.md §1a/§1d) into data/nutrition.json and data/ingredients.json.
//
//   node --experimental-strip-types tools/apply-nutrition.ts --check data/llm/nutrition/batch-01.json …
//   node --experimental-strip-types tools/apply-nutrition.ts --check all
//   node --experimental-strip-types tools/apply-nutrition.ts --apply data/llm/nutrition/batch-01.json …
//   node --experimental-strip-types tools/apply-nutrition.ts --apply all      (all = data/llm/nutrition/batch-*.json)
//
// Batch file: { "batch": "01", "items": [{ "id", "kcal", "protein", "fat", "carbs", "fibre", "salt",
// "alcohol"?, "gramsPerMl"?, "pieceGrams"?, "unitGrams"?: { "<unit-id>": g } }] }.
//
// Checked per item (a refused item is named with file, id and reason and skipped; the rest goes on):
// the id exists in the dictionary and is food (not in aisle huishoudelijk / drogisterij); the numbers pass
// `checkNutritionItem` (tools/validate-data.ts, as `source: 'estimate'`); gramsPerMl in [0.2, 2.0];
// pieceGrams in [0.05, 5000]; every unitGrams key exists in units.json and is not 'ml' (values in [0.05, 5000]
// too, the gramsPer range of the validator). An id that already came earlier in the same run is refused as well.
//
// Applied:
// - the numbers -> data/nutrition.json items (an existing item is replaced only when its source is 'estimate');
// - gramsPerMl -> ingredients[id].gramsPerMl, only when it is missing (never gramsPer.ml: that would change
//   the shopping list, see aggregate.ts);
// - pieceGrams -> gramsPer.stuk when defaultUnit is 'stuk' or null, else gramsPer[defaultUnit] when that is
//   a count unit — only when that key is missing;
// - unitGrams -> gramsPer[unit], only when the key is missing (never gramsPer.ml).
// Both files keep their style (ingredients.json one object per line; nutrition.json one item per line) so
// the git diff stays readable. --check writes nothing and exits 1 when anything was refused.
//
// Node 22 type-stripping rules apply: type-only syntax only, plain ESM, no enums/namespaces.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import type { Ingredient, Unit } from '../src/domain/dictionary.ts';
import { NON_FOOD_AISLES, type NutritionItem } from '../src/domain/nutrition.ts';
import { formatIngredientsFile } from './apply-llm-batch.ts';
import { checkNutritionItem, GRAMS_PER_ML_RANGE, GRAMS_PER_RANGE } from './validate-data.ts';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export interface NutritionBatchItem {
  id: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fibre: number;
  salt: number;
  alcohol?: number;
  gramsPerMl?: number;
  pieceGrams?: number;
  unitGrams?: Record<string, number>;
}

export interface NutritionFile {
  schema: 1;
  per: string;
  note?: { nl: string; en: string };
  items: Record<string, NutritionItem>;
  [k: string]: unknown;
}

export interface Refusal {
  file: string;
  id: string;
  reason: string;
}

export interface BatchCheck {
  /** Items that passed every check, in batch order. */
  items: NutritionBatchItem[];
  refused: Refusal[];
  /** File-level problems (not JSON of the right shape): nothing of the file is used. */
  errors: string[];
}

const NUTRIENT_KEYS = ['kcal', 'protein', 'fat', 'carbs', 'fibre', 'salt'] as const;
/** gramsPer.ml is never written: aggregate.ts would fold ml lines to grams on the shopping list. */
const ML_UNIT = 'ml';

const BATCH_ITEM_KEYS: ReadonlySet<string> = new Set(['id', ...NUTRIENT_KEYS, 'alcohol', 'gramsPerMl', 'pieceGrams', 'unitGrams']);
/** Order of the keys of one nutrition.json item. */
const ITEM_KEY_ORDER = ['kcal', 'protein', 'fat', 'carbs', 'fibre', 'salt', 'alcohol', 'source'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function inRange(v: unknown, range: readonly [number, number]): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= range[0] && v <= range[1];
}

// ---------------------------------------------------------------------------
// Check
// ---------------------------------------------------------------------------

/** The reasons to refuse one batch item ([] = fine). */
export function checkBatchItem(item: Record<string, unknown>, ingredients: ReadonlyMap<string, Ingredient>, unitIds: ReadonlySet<string>): string[] {
  const reasons: string[] = [];
  const id = item['id'];
  if (typeof id !== 'string' || id === '') return ['"id" must be a non-empty string.'];
  const ing = ingredients.get(id);
  if (!ing) return [`unknown ingredient id.`];
  if (NON_FOOD_AISLES.has(ing.aisle)) return [`non-food entry (aisle ${ing.aisle}) gets no nutrition values.`];
  const nutrition: Record<string, unknown> = { source: 'estimate' };
  for (const k of [...NUTRIENT_KEYS, 'alcohol']) if (item[k] !== undefined) nutrition[k] = item[k];
  reasons.push(...checkNutritionItem(nutrition));
  if (item['gramsPerMl'] !== undefined && !inRange(item['gramsPerMl'], GRAMS_PER_ML_RANGE)) {
    reasons.push(`gramsPerMl must be in [${GRAMS_PER_ML_RANGE[0]}, ${GRAMS_PER_ML_RANGE[1]}], got ${JSON.stringify(item['gramsPerMl'])}.`);
  }
  if (item['pieceGrams'] !== undefined && !inRange(item['pieceGrams'], GRAMS_PER_RANGE)) {
    reasons.push(`pieceGrams must be in [${GRAMS_PER_RANGE[0]}, ${GRAMS_PER_RANGE[1]}], got ${JSON.stringify(item['pieceGrams'])}.`);
  }
  const unitGrams = item['unitGrams'];
  if (unitGrams !== undefined) {
    if (!isRecord(unitGrams)) reasons.push('unitGrams must be an object { "<unit-id>": grams }.');
    else {
      for (const [u, g] of Object.entries(unitGrams)) {
        if (!unitIds.has(u)) reasons.push(`unitGrams: unit ${JSON.stringify(u)} does not exist in units.json.`);
        else if (u === ML_UNIT) reasons.push('unitGrams.ml is not allowed: a density goes in gramsPerMl (gramsPer.ml would change the shopping list).');
        else if (!inRange(g, GRAMS_PER_RANGE)) reasons.push(`unitGrams.${u} must be in [${GRAMS_PER_RANGE[0]}, ${GRAMS_PER_RANGE[1]}], got ${JSON.stringify(g)}.`);
      }
    }
  }
  return reasons;
}

/**
 * Check one parsed batch file. `seen` (id -> file) carries the ids accepted earlier in the same run: a
 * repeated id is refused. Accepted ids are added to it.
 */
export function checkNutritionBatch(
  raw: unknown,
  file: string,
  ingredients: ReadonlyMap<string, Ingredient>,
  unitIds: ReadonlySet<string>,
  seen: Map<string, string> = new Map(),
): BatchCheck {
  const out: BatchCheck = { items: [], refused: [], errors: [] };
  if (!isRecord(raw) || !Array.isArray(raw['items'])) {
    out.errors.push(`${file}: must be { "batch": "NN", "items": [ … ] }.`);
    return out;
  }
  raw['items'].forEach((v: unknown, i: number) => {
    if (!isRecord(v)) {
      out.refused.push({ file, id: `#${i}`, reason: 'item must be an object.' });
      return;
    }
    const id = typeof v['id'] === 'string' ? v['id'] : `#${i}`;
    const reasons = checkBatchItem(v, ingredients, unitIds);
    const before = seen.get(id);
    if (reasons.length === 0 && before !== undefined) reasons.push(`duplicate id (already in ${before}).`);
    if (reasons.length) {
      out.refused.push({ file, id, reason: reasons.join(' ') });
      return;
    }
    seen.set(id, file);
    const item: Record<string, unknown> = {};
    for (const k of Object.keys(v)) if (BATCH_ITEM_KEYS.has(k)) item[k] = v[k];
    out.items.push(item as unknown as NutritionBatchItem);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export interface ApplyNutritionStats {
  nutritionAdded: number;
  nutritionReplaced: number;
  /** Existing items with a source other than 'estimate' that were kept. */
  nutritionKept: number;
  gramsPerMl: number;
  pieceGrams: number;
  unitGrams: number;
  /** Gram fields not written because the key already existed or the default unit is not countable. */
  gramsSkipped: number;
  /** Human-readable notes about what was not written (one per field). */
  notes: string[];
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** A nutrition.json item from a batch item: numbers to one decimal, source 'estimate'. */
export function nutritionItemOf(b: NutritionBatchItem): NutritionItem {
  const item: NutritionItem = {
    kcal: round1(b.kcal),
    protein: round1(b.protein),
    fat: round1(b.fat),
    carbs: round1(b.carbs),
    fibre: round1(b.fibre),
    salt: round1(b.salt),
  };
  if (typeof b.alcohol === 'number' && b.alcohol > 0) item.alcohol = round1(b.alcohol);
  item.source = 'estimate';
  return item;
}

/** A copy of `obj` with `key` set, inserted right after the first of `after` that exists (else at the end). */
function withKeyAfter<T extends Record<string, unknown>>(obj: T, key: string, value: unknown, after: readonly string[]): T {
  if (key in obj) return { ...obj, [key]: value };
  const anchor = after.find((k) => obj[k] !== undefined);
  const out: Record<string, unknown> = {};
  let placed = false;
  for (const k of Object.keys(obj)) {
    out[k] = obj[k];
    if (k === anchor) {
      out[key] = value;
      placed = true;
    }
  }
  if (!placed) out[key] = value;
  return out as T;
}

/**
 * Merge checked batch items into the nutrition file and the dictionary entries (pure: returns new objects).
 * `units` is units.json (to tell a count unit from the rest for pieceGrams).
 */
export function applyNutritionItems(
  nutrition: NutritionFile,
  ingredients: readonly Ingredient[],
  units: readonly Unit[],
  items: readonly NutritionBatchItem[],
): { nutrition: NutritionFile; ingredients: Ingredient[]; stats: ApplyNutritionStats } {
  const stats: ApplyNutritionStats = { nutritionAdded: 0, nutritionReplaced: 0, nutritionKept: 0, gramsPerMl: 0, pieceGrams: 0, unitGrams: 0, gramsSkipped: 0, notes: [] };
  const unitGroup = new Map(units.map((u) => [u.id, u.group]));
  const table: Record<string, NutritionItem> = { ...nutrition.items };
  const byId = new Map(ingredients.map((i, n) => [i.id, n]));
  const next = [...ingredients];

  for (const b of items) {
    const existing = table[b.id];
    if (!existing) {
      table[b.id] = nutritionItemOf(b);
      stats.nutritionAdded++;
    } else if (existing.source === 'estimate') {
      table[b.id] = nutritionItemOf(b);
      stats.nutritionReplaced++;
    } else {
      stats.nutritionKept++;
      stats.notes.push(`${b.id}: nutrition kept (source ${existing.source ?? 'none'} is not 'estimate').`);
    }

    const n = byId.get(b.id);
    if (n === undefined) continue;
    let ing = next[n] as Ingredient;
    const gramsPer: Record<string, number> = { ...(ing.gramsPer ?? {}) };
    let gramsPerChanged = false;
    const setGrams = (key: string, g: number, what: string): boolean => {
      if (gramsPer[key] !== undefined) {
        stats.gramsSkipped++;
        stats.notes.push(`${b.id}: ${what} not written (gramsPer.${key} = ${gramsPer[key]} already exists).`);
        return false;
      }
      gramsPer[key] = g;
      gramsPerChanged = true;
      return true;
    };

    if (typeof b.gramsPerMl === 'number') {
      if (ing.gramsPerMl === undefined) {
        ing = withKeyAfter(ing, 'gramsPerMl', b.gramsPerMl, ['gramsPer', 'buyUnit', 'defaultUnit']);
        stats.gramsPerMl++;
      } else {
        stats.gramsSkipped++;
        stats.notes.push(`${b.id}: gramsPerMl not written (already ${String(ing.gramsPerMl)}).`);
      }
    }
    if (typeof b.pieceGrams === 'number') {
      const def = ing.defaultUnit;
      if (def === null || def === 'stuk') {
        if (setGrams('stuk', b.pieceGrams, 'pieceGrams')) stats.pieceGrams++;
      } else if (unitGroup.get(def) === 'count') {
        if (setGrams(def, b.pieceGrams, 'pieceGrams')) stats.pieceGrams++;
      } else {
        stats.gramsSkipped++;
        stats.notes.push(`${b.id}: pieceGrams not written (defaultUnit ${def} is not a count unit).`);
      }
    }
    if (b.unitGrams) {
      for (const [u, g] of Object.entries(b.unitGrams)) {
        if (u === ML_UNIT) {
          // Never gramsPer.ml (spec §2); checkBatchItem refuses it, this guards direct callers too.
          stats.gramsSkipped++;
          stats.notes.push(`${b.id}: unitGrams.ml not written (a density goes in gramsPerMl).`);
          continue;
        }
        if (setGrams(u, g, `unitGrams.${u}`)) stats.unitGrams++;
      }
    }
    if (gramsPerChanged) ing = withKeyAfter(ing, 'gramsPer', gramsPer, ['buyUnit', 'defaultUnit']);
    next[n] = ing;
  }

  const sorted: Record<string, NutritionItem> = {};
  for (const id of Object.keys(table).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) sorted[id] = table[id] as NutritionItem;
  return { nutrition: { ...nutrition, items: sorted }, ingredients: next, stats };
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/** data/llm/nutrition/batch-*.json in file-name order; [] when the folder is missing. */
export function nutritionBatchPaths(root: string): string[] {
  const dir = join(root, 'data', 'llm', 'nutrition');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^batch-\d+\.json$/i.test(f))
    .sort()
    .map((f) => join(dir, f));
}

function formatItem(item: NutritionItem): string {
  const rec = item as unknown as Record<string, unknown>;
  const keys = [...ITEM_KEY_ORDER.filter((k) => rec[k] !== undefined), ...Object.keys(rec).filter((k) => !ITEM_KEY_ORDER.includes(k) && rec[k] !== undefined)];
  return `{ ${keys.map((k) => `${JSON.stringify(k)}: ${JSON.stringify(rec[k])}`).join(', ')} }`;
}

/** data/nutrition.json text: the header keys, then one item per line sorted by id, 2-space indent. */
export function formatNutritionFile(file: NutritionFile): string {
  const head: string[] = [];
  for (const k of Object.keys(file)) {
    if (k === 'items') continue;
    const v = file[k];
    if (v === undefined) continue;
    const text = isRecord(v) ? `{ ${Object.entries(v).map(([kk, vv]) => `${JSON.stringify(kk)}: ${JSON.stringify(vv)}`).join(', ')} }` : JSON.stringify(v);
    head.push(`  ${JSON.stringify(k)}: ${text}`);
  }
  const ids = Object.keys(file.items).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const items = ids.map((id) => `    ${JSON.stringify(id)}: ${formatItem(file.items[id] as NutritionItem)}`);
  const itemsText = items.length ? `{\n${items.join(',\n')}\n  }` : '{}';
  return `{\n${[...head, `  "items": ${itemsText}`].join(',\n')}\n}\n`;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

const EMPTY_NUTRITION: NutritionFile = { schema: 1, per: '100 g', items: {} };

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(argv: string[]): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const mode = argv[0];
  const targets = argv.slice(1);
  if ((mode !== '--check' && mode !== '--apply') || targets.length === 0) {
    console.error('usage: apply-nutrition.ts --check <files…|all> | --apply <files…|all>');
    process.exit(2);
  }
  const files = targets.length === 1 && targets[0] === 'all' ? nutritionBatchPaths(root) : targets.map((t) => resolve(root, t));
  if (files.length === 0) {
    console.log('no batch files in data/llm/nutrition/');
    process.exit(0);
  }

  const ingredientsPath = join(root, 'data', 'ingredients.json');
  const nutritionPath = join(root, 'data', 'nutrition.json');
  const ingredients = readJson(ingredientsPath) as Ingredient[];
  const units = readJson(join(root, 'data', 'units.json')) as Unit[];
  const nutrition = existsSync(nutritionPath) ? (readJson(nutritionPath) as NutritionFile) : { ...EMPTY_NUTRITION };
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const unitIds = new Set(units.map((u) => u.id));

  const seen = new Map<string, string>();
  const accepted: NutritionBatchItem[] = [];
  const refused: Refusal[] = [];
  let fileErrors = 0;
  for (const file of files) {
    const rel = file.startsWith(root) ? file.slice(root.length + 1).replace(/\\/g, '/') : file;
    if (!existsSync(file)) {
      console.log(`${rel}: ERROR: file not found`);
      fileErrors++;
      continue;
    }
    let raw: unknown;
    try {
      raw = readJson(file);
    } catch (e) {
      console.log(`${rel}: ERROR: not valid JSON (${String(e)})`);
      fileErrors++;
      continue;
    }
    const check = checkNutritionBatch(raw, rel, ingById, unitIds, seen);
    for (const e of check.errors) console.log(`  ERROR: ${e}`);
    for (const r of check.refused) console.log(`  REFUSED: ${r.file} ${r.id}: ${r.reason}`);
    if (check.errors.length) fileErrors++;
    accepted.push(...check.items);
    refused.push(...check.refused);
    console.log(`${rel}: ${check.errors.length ? 'FAIL' : 'OK'} — ${check.items.length} item(s) accepted, ${check.refused.length} refused`);
  }
  console.log(`total: ${accepted.length} item(s) accepted, ${refused.length} refused, ${fileErrors} file error(s)`);

  if (mode === '--check') process.exit(refused.length || fileErrors ? 1 : 0);

  const result = applyNutritionItems(nutrition, ingredients, units, accepted);
  const s = result.stats;
  for (const n of s.notes) console.log(`  note: ${n}`);
  writeFileSync(nutritionPath, formatNutritionFile(result.nutrition), 'utf8');
  const ingChanged = s.gramsPerMl + s.pieceGrams + s.unitGrams > 0;
  if (ingChanged) writeFileSync(ingredientsPath, formatIngredientsFile(result.ingredients), 'utf8');
  console.log(
    `applied: nutrition +${s.nutritionAdded} new, ${s.nutritionReplaced} replaced, ${s.nutritionKept} kept; ` +
      `gramsPerMl ${s.gramsPerMl}, pieceGrams ${s.pieceGrams}, unitGrams ${s.unitGrams}, ${s.gramsSkipped} gram field(s) not written`,
  );
  console.log(`written: data/nutrition.json${ingChanged ? ', data/ingredients.json' : ''}`);
  console.log('next: npm run validate:data, npm run measure-grams, npm test');
  process.exit(fileErrors ? 1 : 0);
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href && basename(process.argv[1]) === 'apply-nutrition.ts';
if (invokedDirectly) main(process.argv.slice(2));
