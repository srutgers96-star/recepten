// tools/apply-nutrition.ts — validate and merge the nutrition batches (data/llm/nutrition/batch-NN.json,
// docs/specs/verbeterronde-9.md §1a/§1d) into data/nutrition.json and data/ingredients.json.
//
//   node --experimental-strip-types tools/apply-nutrition.ts --check data/llm/nutrition/batch-01.json …
//   node --experimental-strip-types tools/apply-nutrition.ts --check all
//   node --experimental-strip-types tools/apply-nutrition.ts --apply data/llm/nutrition/batch-01.json …
//   node --experimental-strip-types tools/apply-nutrition.ts --apply all      (all = data/llm/nutrition/batch-*.json)
//   node --experimental-strip-types tools/apply-nutrition.ts --from-tables usda   (V9b; later: --from-tables nevo)
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
// --from-tables <source> (docs/specs/verbeterronde-9b.md §1a, V9b): reads the normalised table
// data/work/tables/<source>.csv and the matching round's answers data/llm/nutrition/match-<source>-NN.json
// ({ "batch", "source", "items": [{ "id", "choice": "<code>" | null, "confidence": "sure" | "close" | "none", "why" }] }).
// Every sure/close answer with a choice becomes the table row's values (`tableNutritionItem`: USDA carbs minus
// fibre, salt = sodium × 2.5 / 1000, kcal from the macros when the table has none, one decimal, source + ref);
// it replaces the existing item when the new source ranks at least as high (estimate 0 < usda 1 < nevo 2), else
// the item is kept. Refused (with reason): code not in the table, id unknown or not food, protein + fat +
// carbs + fibre > 101 after the conversion, a negative value. `none` answers leave the item as it is. Writes
// data/nutrition.json (with the V9b `note`); never touches data/ingredients.json.
//
// Node 22 type-stripping rules apply: type-only syntax only, plain ESM, no enums/namespaces.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import type { Ingredient, Unit } from '../src/domain/dictionary.ts';
import { NON_FOOD_AISLES, type NutritionItem } from '../src/domain/nutrition.ts';
import { formatIngredientsFile } from './apply-llm-batch.ts';
import { checkNutritionItem, GRAMS_PER_ML_RANGE, GRAMS_PER_RANGE, isNutritionWarning } from './validate-data.ts';
import { parseTable, type TableRow } from './nutrition-match.ts';

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
const ITEM_KEY_ORDER = ['kcal', 'protein', 'fat', 'carbs', 'fibre', 'salt', 'alcohol', 'source', 'ref'];

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
// --from-tables <source> (V9b)
// ---------------------------------------------------------------------------

export type TableSource = 'usda' | 'nevo';

/** Rank of a source: a new item replaces an existing one when its rank is at least as high. */
export const SOURCE_RANK: Readonly<Record<string, number>> = { estimate: 0, usda: 1, nevo: 2 };

/** The rank of an item's source (missing = estimate). */
export function sourceRank(source: string | undefined): number {
  return SOURCE_RANK[source ?? 'estimate'] ?? 0;
}

/** The `note` of data/nutrition.json since V9b (docs/specs/verbeterronde-9b.md §1a). */
export const NUTRITION_NOTE: { readonly nl: string; readonly en: string } = {
  nl: 'Gebaseerd op gegevens van NEVO-online versie 2025/9.0, RIVM, Bilthoven en andere gegevens. Waarden per 100 g product zoals het in het recept staat (pasta en rijst droog). Bron per item: NEVO-online versie 2025/9.0 (RIVM, Bilthoven), USDA FoodData Central SR Legacy (U.S. Department of Agriculture, 04/2018) of een schatting op dat niveau; nooit merkwaarden. Koolhydraten exclusief vezels.',
  en: 'Based on data from NEVO-online version 2025/9.0, RIVM, Bilthoven and other data. Values per 100 g of the product as it appears in the recipe (pasta and rice dry). Source per item: NEVO-online version 2025/9.0 (RIVM, Bilthoven), USDA FoodData Central SR Legacy (U.S. Department of Agriculture, 04/2018) or an estimate at that level; never brand values. Carbohydrates exclude fibre.',
};

export type MatchConfidence = 'sure' | 'close' | 'none';

/**
 * The nutrition item of one table row, or the reasons to refuse it. `notes` gets one line per value that was
 * missing in the table (fibre or sodium -> 0, kcal -> from the macros). USDA carbohydrates include fibre
 * ("by difference"): they are reduced by the fibre so the file keeps one convention (exclusive); NEVO is
 * taken as it is. Missing kcal -> 4·protein + 4·carbs + 9·fat + 7·alcohol (carbs after the conversion).
 * Every number to one decimal. A row without protein, fat or carbs is refused (nothing to convert).
 */
export function tableNutritionItem(row: TableRow, source: TableSource): { item: NutritionItem | null; reasons: string[]; notes: string[] } {
  const reasons: string[] = [];
  const notes: string[] = [];
  for (const k of ['kcal', 'protein', 'fat', 'carbs', 'fibre', 'sodium_mg', 'alcohol'] as const) {
    const v = row[k];
    if (v !== null && v < 0) reasons.push(`table value ${k} ${v} is negative.`);
  }
  for (const k of ['protein', 'fat', 'carbs'] as const) if (row[k] === null) reasons.push(`table row ${row.code} has no ${k}.`);
  if (reasons.length) return { item: null, reasons, notes };
  const protein = row.protein as number;
  const fat = row.fat as number;
  let fibre = row.fibre;
  if (fibre === null) {
    fibre = 0;
    notes.push(`fibre missing in ${source} ${row.code}: 0.`);
  }
  let carbs = row.carbs as number;
  if (source === 'usda') carbs = Math.max(0, carbs - fibre);
  let salt = 0;
  if (row.sodium_mg === null) notes.push(`sodium missing in ${source} ${row.code}: salt 0.`);
  else salt = (row.sodium_mg * 2.5) / 1000;
  const alcohol = row.alcohol ?? 0;
  let kcal = row.kcal;
  if (kcal === null) {
    kcal = 4 * protein + 4 * carbs + 9 * fat + 7 * alcohol;
    notes.push(`kcal missing in ${source} ${row.code}: ${round1(kcal)} from the macros.`);
  }
  const item: NutritionItem = {
    kcal: round1(kcal),
    protein: round1(protein),
    fat: round1(fat),
    carbs: round1(carbs),
    fibre: round1(fibre),
    salt: round1(salt),
  };
  if (alcohol > 0) item.alcohol = round1(alcohol);
  item.source = source;
  item.ref = row.code;
  // The validator's rules (≤ 101 g, salt ≤ 100, ref); the kcal deviation is only a warning for a table source.
  for (const p of checkNutritionItem(item)) if (!isNutritionWarning(p)) reasons.push(p.replace('per 100 g.', 'per 100 g after the conversion.'));
  return reasons.length ? { item: null, reasons, notes } : { item, reasons, notes };
}

export interface TableMatchCheck {
  /** Accepted answers (sure/close with a choice) with their new item. */
  items: { id: string; confidence: 'sure' | 'close'; item: NutritionItem; notes: string[] }[];
  /** Answers `none`: the item stays as it is. */
  none: number;
  refused: Refusal[];
  /** File-level problems (not JSON of the right shape, wrong source): nothing of the file is used. */
  errors: string[];
}

const CONFIDENCES: ReadonlySet<string> = new Set(['sure', 'close', 'none']);

/**
 * Check one parsed match file against the table and the dictionary. `seen` (id -> file) carries the ids
 * answered earlier in the same run: a repeated id is refused.
 */
export function checkMatchFile(
  raw: unknown,
  file: string,
  source: TableSource,
  table: ReadonlyMap<string, TableRow>,
  ingredients: ReadonlyMap<string, Ingredient>,
  seen: Map<string, string> = new Map(),
): TableMatchCheck {
  const out: TableMatchCheck = { items: [], none: 0, refused: [], errors: [] };
  if (!isRecord(raw) || !Array.isArray(raw['items'])) {
    out.errors.push(`${file}: must be { "batch": "NN", "source": "${source}", "items": [ … ] }.`);
    return out;
  }
  if (raw['source'] !== undefined && raw['source'] !== source) {
    out.errors.push(`${file}: "source" is ${JSON.stringify(raw['source'])}, expected "${source}".`);
    return out;
  }
  raw['items'].forEach((v: unknown, i: number) => {
    if (!isRecord(v)) {
      out.refused.push({ file, id: `#${i}`, reason: 'item must be an object.' });
      return;
    }
    const id = typeof v['id'] === 'string' && v['id'] !== '' ? v['id'] : null;
    const fail = (reason: string): void => {
      out.refused.push({ file, id: id ?? `#${i}`, reason });
    };
    if (id === null) return fail('"id" must be a non-empty string.');
    const before = seen.get(id);
    if (before !== undefined) return fail(`duplicate id (already in ${before}).`);
    seen.set(id, file);
    const confidence = v['confidence'];
    if (typeof confidence !== 'string' || !CONFIDENCES.has(confidence)) return fail(`"confidence" must be sure | close | none, got ${JSON.stringify(confidence)}.`);
    const choice = v['choice'];
    if (choice !== null && choice !== undefined && typeof choice !== 'string') return fail(`"choice" must be a table code or null, got ${JSON.stringify(choice)}.`);
    const ing = ingredients.get(id);
    if (!ing) return fail('unknown ingredient id.');
    if (NON_FOOD_AISLES.has(ing.aisle)) return fail(`non-food entry (aisle ${ing.aisle}) gets no nutrition values.`);
    if (confidence === 'none') {
      out.none++;
      return;
    }
    if (typeof choice !== 'string' || choice === '') return fail(`confidence ${confidence} without a choice.`);
    const row = table.get(choice);
    if (!row) return fail(`code ${JSON.stringify(choice)} is not in the ${source} table.`);
    const r = tableNutritionItem(row, source);
    if (!r.item) return fail(r.reasons.join(' '));
    out.items.push({ id, confidence: confidence as 'sure' | 'close', item: r.item, notes: r.notes.map((n) => `${id}: ${n}`) });
  });
  return out;
}

export interface TableApplyStats {
  /** Items written over an existing one (new rank ≥ old rank). */
  replaced: number;
  /** Items that did not exist yet. */
  added: number;
  /** Existing items of a higher source that were kept. */
  kept: number;
  /** Items per source after the merge (missing source counts as estimate). */
  perSource: Record<string, number>;
  notes: string[];
}

/** Merge table items into the nutrition file by source rank (pure: returns a new object); sets the V9b note. */
export function applyTableItems(nutrition: NutritionFile, items: readonly { id: string; item: NutritionItem }[]): { nutrition: NutritionFile; stats: TableApplyStats } {
  const stats: TableApplyStats = { replaced: 0, added: 0, kept: 0, perSource: {}, notes: [] };
  const table: Record<string, NutritionItem> = { ...nutrition.items };
  for (const { id, item } of items) {
    const existing = table[id];
    if (!existing) {
      table[id] = item;
      stats.added++;
    } else if (sourceRank(item.source) >= sourceRank(existing.source)) {
      table[id] = item;
      stats.replaced++;
    } else {
      stats.kept++;
      stats.notes.push(`${id}: kept (source ${existing.source ?? 'estimate'} ranks above ${item.source ?? 'estimate'}).`);
    }
  }
  const sorted: Record<string, NutritionItem> = {};
  for (const id of Object.keys(table).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const it = table[id] as NutritionItem;
    sorted[id] = it;
    const s = it.source ?? 'estimate';
    stats.perSource[s] = (stats.perSource[s] ?? 0) + 1;
  }
  return { nutrition: { ...nutrition, note: { nl: NUTRITION_NOTE.nl, en: NUTRITION_NOTE.en }, items: sorted }, stats };
}

/** data/llm/nutrition/match-<source>-NN.json in file-name order (not the match-input files). */
export function matchFilePaths(root: string, source: string): string[] {
  const dir = join(root, 'data', 'llm', 'nutrition');
  if (!existsSync(dir)) return [];
  const re = new RegExp(`^match-${source}-\\d+\\.json$`, 'i');
  return readdirSync(dir)
    .filter((f) => re.test(f))
    .sort()
    .map((f) => join(dir, f));
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

function mainFromTables(root: string, source: string): void {
  if (source !== 'usda' && source !== 'nevo') {
    console.error('--from-tables knows usda and nevo');
    process.exit(2);
  }
  const tableRel = `data/work/tables/${source}.csv`;
  const tablePath = join(root, tableRel);
  if (!existsSync(tablePath)) {
    console.error(`missing ${tableRel}${source === 'usda' ? ' (npm run nutrition-match -- --normalize usda)' : ''}`);
    process.exit(1);
  }
  const table = new Map(parseTable(readFileSync(tablePath, 'utf8')).map((r) => [r.code, r]));
  const files = matchFilePaths(root, source);
  if (files.length === 0) {
    console.log(`no match-${source}-NN.json files in data/llm/nutrition/`);
    process.exit(0);
  }
  const ingredients = readJson(join(root, 'data', 'ingredients.json')) as Ingredient[];
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const nutritionPath = join(root, 'data', 'nutrition.json');
  const nutrition = existsSync(nutritionPath) ? (readJson(nutritionPath) as NutritionFile) : { ...EMPTY_NUTRITION };

  const seen = new Map<string, string>();
  const accepted: { id: string; item: NutritionItem }[] = [];
  const refused: Refusal[] = [];
  const notes: string[] = [];
  const answers = { sure: 0, close: 0, none: 0 };
  let fileErrors = 0;
  for (const file of files) {
    const rel = file.startsWith(root) ? file.slice(root.length + 1).replace(/\\/g, '/') : file;
    let raw: unknown;
    try {
      raw = readJson(file);
    } catch (e) {
      console.log(`${rel}: ERROR: not valid JSON (${String(e)})`);
      fileErrors++;
      continue;
    }
    const check = checkMatchFile(raw, rel, source, table, ingById, seen);
    for (const e of check.errors) console.log(`  ERROR: ${e}`);
    for (const r of check.refused) console.log(`  REFUSED: ${r.file} ${r.id}: ${r.reason}`);
    if (check.errors.length) fileErrors++;
    for (const it of check.items) {
      answers[it.confidence]++;
      accepted.push({ id: it.id, item: it.item });
      notes.push(...it.notes);
    }
    answers.none += check.none;
    refused.push(...check.refused);
    console.log(`${rel}: ${check.errors.length ? 'FAIL' : 'OK'} — ${check.items.length} matched, ${check.none} none, ${check.refused.length} refused`);
  }
  for (const n of notes) console.log(`  note: ${n}`);
  const result = applyTableItems(nutrition, accepted);
  const s = result.stats;
  for (const n of s.notes) console.log(`  note: ${n}`);
  writeFileSync(nutritionPath, formatNutritionFile(result.nutrition), 'utf8');
  console.log(`answers: ${answers.sure} sure, ${answers.close} close, ${answers.none} none; ${fileErrors} file error(s)`);
  console.log(`${source}: ${s.replaced} replaced, ${s.added} added, ${s.kept} kept, ${refused.length} refused`);
  const per = [...Object.keys(SOURCE_RANK), ...Object.keys(s.perSource).filter((k) => !(k in SOURCE_RANK))].map((k) => `${k} ${s.perSource[k] ?? 0}`).join(', ');
  console.log(`items now: ${per} (${Object.keys(result.nutrition.items).length} in all)`);
  console.log('written: data/nutrition.json');
  console.log('next: npm run validate:data, npm run measure-grams, npm test');
  process.exit(fileErrors ? 1 : 0);
}

function main(argv: string[]): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const mode = argv[0];
  const targets = argv.slice(1);
  if (mode === '--from-tables' && targets.length === 1) return mainFromTables(root, targets[0] as string);
  if ((mode !== '--check' && mode !== '--apply') || targets.length === 0) {
    console.error('usage: apply-nutrition.ts --check <files…|all> | --apply <files…|all> | --from-tables <usda|nevo>');
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
