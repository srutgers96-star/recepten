// tools/apply-llm-batch.ts — validate and merge the LLM translation/structuring batches
// (data/llm/batch-NN.json, schema in docs/phase-2-spec.md §4) into data/recipes.json and
// data/ingredients.json.
//
//   node --experimental-strip-types tools/apply-llm-batch.ts --check data/llm/batch-01.json
//   node --experimental-strip-types tools/apply-llm-batch.ts --apply data/llm/batch-01.json
//   node --experimental-strip-types tools/apply-llm-batch.ts --apply all
//
// --check validates only (exit 1 on errors). --apply validates, then for every recipe of the batch
// sets name.en, description, category, tags, time, steps[].text.en, servingTip.en and
// text.en = 'llm', re-parses the ingredient lines from `raw` with the dictionary (plus the batch's
// NEW entries) and merges per line: ing (an existing id, or NEW -> appended to ingredients.json),
// qual, prep.en, note.en and confidence. Order of truth (spec §4): the raw line and the parser
// first; the LLM `ing`/`prep.en` only where the parser returned null or the LLM confidence is
// higher; `note.en` only for a Dutch note the dictionary could not translate. Quantities are never
// touched. Refused (nothing written) when the recipe id is unknown, step counts differ, a line
// index is out of range or points at a header, a `raw` echo differs from the recipe's raw line, an
// `ing` id does not exist, a NEW entry collides with a different existing entry, or the category /
// a tag / a qualifier id is unknown. With `--apply all` the human review layer
// (data/review/lines.json, tools/apply-review.ts) is applied last.
//
// `npm run migrate` replays the same merge (`applyBatch` + `applyReview`) over the committed
// batches, so data/recipes.json = parse(raw) ⊕ data/llm/*.json ⊕ data/review is reproducible.
//
// Node 22 type-stripping rules apply: type-only syntax only, plain ESM, no enums/namespaces.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { loadDictionary, withUserEntries, type Dictionary, type Ingredient } from '../src/domain/dictionary.ts';
import type { Line, Recipe, Text } from '../src/domain/model.ts';
import { parseLine } from '../src/domain/parser.ts';
import { applyReview, checkReview, readReview } from './apply-review.ts';
import { readDictionaryData } from './build-dictionary-seed.ts';
import { RECIPE_TAGS } from './validate-data.ts';

// ---------------------------------------------------------------------------
// Batch schema (spec §4)
// ---------------------------------------------------------------------------

export interface BatchLine {
  /** Index into recipe.lines (headers included in the numbering, never listed). */
  i: number;
  /** An ingredients.json id, 'NEW' (then `new` holds the entry) or null (leave unresolved). */
  ing?: string | null;
  new?: Ingredient;
  qual?: string[];
  prep?: { en?: string };
  /** English for the parser's Dutch (parenthetical) note: "(macaroni of penne)" -> "macaroni or penne". */
  note?: { en?: string };
  confidence?: number;
  /** Optional echo of the raw Dutch line; when present it must match (guards against shifted indexes). */
  raw?: string;
}

export interface BatchRecipe {
  id: string;
  name: { en: string };
  description?: Text;
  category: string;
  tags?: string[];
  time?: { active?: number; total?: number };
  steps: { en: string }[];
  servingTip?: { en: string };
  lines: BatchLine[];
}

export interface BatchFile {
  batch: number;
  model?: string;
  at?: string;
  recipes: BatchRecipe[];
}

/** 'apply': NEW entries may be appended; 'replay' (migration): NEW entries must already be in the dictionary. */
export type BatchMode = 'apply' | 'replay';

export interface CheckResult {
  errors: string[];
  warnings: string[];
  /** The typed batch when it has the right shape (may still have errors). */
  batch: BatchFile | null;
  /** NEW entries that are not in the dictionary yet (to append), in batch order, unique by id. */
  newIngredients: Ingredient[];
}

/** Confidence assumed for a batch line that does not state one. */
export const DEFAULT_LLM_CONFIDENCE = 0.7;

const INGREDIENT_KEY_ORDER = ['id', 'nl', 'en', 'aliases', 'aisle', 'defaultUnit', 'buyUnit', 'gramsPer', 'unitNames', 'cut', 'staple', 'veg', 'perishable', 'gloss'];
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === 'string');
}

function nonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

/** JSON with the keys of every object sorted, for structural comparison. */
function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, val: unknown) => {
    if (!isRecord(val)) return val;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(val).sort()) out[k] = val[k];
    return out;
  });
}

/** A NEW ingredient entry with its keys in the spec order (unknown keys last). */
export function normaliseIngredientEntry(entry: Ingredient): Ingredient {
  const out: Record<string, unknown> = {};
  for (const k of INGREDIENT_KEY_ORDER) if (entry[k] !== undefined) out[k] = entry[k];
  for (const k of Object.keys(entry)) if (out[k] === undefined && entry[k] !== undefined) out[k] = entry[k];
  return out as Ingredient;
}

function checkNewEntry(v: unknown, where: string, dict: Dictionary, errors: string[]): Ingredient | null {
  if (!isRecord(v)) {
    errors.push(`${where}: ing is NEW but "new" is not an object.`);
    return null;
  }
  let ok = true;
  const fail = (msg: string) => {
    errors.push(`${where}: new ${msg}`);
    ok = false;
  };
  if (typeof v['id'] !== 'string' || !ID_RE.test(v['id'])) fail(`id must be a slug (a-z, 0-9, dashes), got ${JSON.stringify(v['id'])}.`);
  for (const lang of ['nl', 'en']) {
    const n = v[lang];
    if (!isRecord(n) || !nonEmpty(n['one'])) fail(`${lang}.one is required.`);
    else if (n['many'] !== undefined && !nonEmpty(n['many'])) fail(`${lang}.many must be a non-empty string.`);
  }
  if (typeof v['aisle'] !== 'string' || !dict.aisle(v['aisle'])) fail(`aisle ${JSON.stringify(v['aisle'])} does not exist.`);
  const unitOrPiece = (u: unknown) => typeof u === 'string' && (u === 'stuk' || dict.unit(u) !== undefined);
  if (v['defaultUnit'] !== null && !unitOrPiece(v['defaultUnit'])) fail(`defaultUnit must be null, "stuk" or a unit id, got ${JSON.stringify(v['defaultUnit'])}.`);
  if (v['buyUnit'] !== undefined && !unitOrPiece(v['buyUnit'])) fail(`buyUnit must be "stuk" or a unit id.`);
  const gramsPer = v['gramsPer'];
  if (gramsPer !== undefined) {
    if (!isRecord(gramsPer)) fail('gramsPer must be an object.');
    else for (const [k, g] of Object.entries(gramsPer)) if (!unitOrPiece(k) || typeof g !== 'number' || !(g > 0)) fail(`gramsPer.${k} must map a unit id to a positive number.`);
  }
  for (const k of ['staple', 'veg']) if (typeof v[k] !== 'boolean') fail(`${k} must be a boolean.`);
  if (v['perishable'] !== undefined && typeof v['perishable'] !== 'boolean') fail('perishable must be a boolean.');
  if (v['gloss'] !== undefined && (!isRecord(v['gloss']) || typeof v['gloss']['en'] !== 'string')) fail('gloss must be { en }.');
  const aliases = v['aliases'];
  if (aliases !== undefined && (!isRecord(aliases) || (aliases['nl'] !== undefined && !isStringArray(aliases['nl'])) || (aliases['en'] !== undefined && !isStringArray(aliases['en'])))) {
    fail('aliases must be { nl?: string[], en?: string[] }.');
  }
  return ok ? normaliseIngredientEntry(v as unknown as Ingredient) : null;
}

/**
 * Validate one batch file against the recipes and the dictionary. Pure. `errors` block the merge;
 * `warnings` are printed. In 'apply' mode NEW entries that are not in the dictionary are collected in
 * `newIngredients`; in 'replay' mode they are errors (run --apply first so ingredients.json has them).
 */
export function checkBatch(raw: unknown, recipes: readonly Recipe[], dict: Dictionary, mode: BatchMode = 'apply'): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const newIngredients: Ingredient[] = [];
  const result: CheckResult = { errors, warnings, batch: null, newIngredients };

  if (!isRecord(raw)) {
    errors.push('Batch must be an object { batch, model?, at?, recipes[] }.');
    return result;
  }
  if (typeof raw['batch'] !== 'number' || !Number.isInteger(raw['batch']) || raw['batch'] < 1) errors.push('"batch" must be a positive integer.');
  if (!Array.isArray(raw['recipes'])) {
    errors.push('"recipes" must be an array.');
    return result;
  }
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const seenRecipes = new Set<string>();
  const pendingNew = new Map<string, Ingredient>();

  raw['recipes'].forEach((entry: unknown, n: number) => {
    const where = `recipes[${n}]`;
    if (!isRecord(entry)) {
      errors.push(`${where}: not an object.`);
      return;
    }
    const id = entry['id'];
    if (typeof id !== 'string' || !byId.has(id)) {
      errors.push(`${where}: recipe id ${JSON.stringify(id)} does not exist in recipes.json.`);
      return;
    }
    const label = `"${id}"`;
    if (seenRecipes.has(id)) errors.push(`${label}: listed twice in the batch.`);
    seenRecipes.add(id);
    const recipe = byId.get(id) as Recipe;

    if (!isRecord(entry['name']) || !nonEmpty(entry['name']['en'])) errors.push(`${label}: name.en is required.`);
    const description = entry['description'];
    if (description !== undefined && description !== null) {
      if (!isRecord(description) || (description['nl'] !== undefined && typeof description['nl'] !== 'string') || (description['en'] !== undefined && typeof description['en'] !== 'string')) {
        errors.push(`${label}: description must be { nl?, en? }.`);
      }
    }
    const category = entry['category'];
    if (typeof category !== 'string' || !dict.category(category)) errors.push(`${label}: category ${JSON.stringify(category)} is unknown (${dict.categories.map((c) => c.id).join(', ')}).`);
    const tags = entry['tags'];
    if (tags !== undefined) {
      if (!isStringArray(tags)) errors.push(`${label}: tags must be an array of strings.`);
      else for (const t of tags) if (!RECIPE_TAGS.includes(t)) errors.push(`${label}: tag ${JSON.stringify(t)} is not one of ${RECIPE_TAGS.join(', ')}.`);
    }
    const time = entry['time'];
    if (time === undefined) warnings.push(`${label}: no time estimate.`);
    else if (!isRecord(time)) errors.push(`${label}: time must be { active?, total? }.`);
    else {
      for (const k of ['active', 'total']) {
        const v = time[k];
        if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v) || v < 0)) errors.push(`${label}: time.${k} must be a non-negative number of minutes.`);
      }
    }
    const steps = entry['steps'];
    if (!Array.isArray(steps)) errors.push(`${label}: steps must be an array of { en }.`);
    else {
      if (steps.length !== recipe.steps.length) errors.push(`${label}: ${steps.length} steps in the batch, ${recipe.steps.length} in recipes.json (counts must match).`);
      steps.forEach((s: unknown, i: number) => {
        if (!isRecord(s) || !nonEmpty(s['en'])) errors.push(`${label}: steps[${i}].en is required.`);
      });
    }
    const tip = entry['servingTip'];
    if (tip !== undefined && tip !== null) {
      if (!isRecord(tip) || !nonEmpty(tip['en'])) errors.push(`${label}: servingTip must be { en }.`);
      else if (!nonEmpty(recipe.servingTip?.nl)) warnings.push(`${label}: servingTip.en given but the recipe has no Dutch servingTip (ignored).`);
    } else if (nonEmpty(recipe.servingTip?.nl)) {
      warnings.push(`${label}: the recipe has a Dutch servingTip but the batch gives no servingTip.en.`);
    }

    const lines = entry['lines'];
    if (!Array.isArray(lines)) {
      errors.push(`${label}: lines must be an array.`);
      return;
    }
    const seenLines = new Set<number>();
    lines.forEach((l: unknown, k: number) => {
      const w = `${label}: lines[${k}]`;
      if (!isRecord(l)) {
        errors.push(`${w}: not an object.`);
        return;
      }
      const i = l['i'];
      if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= recipe.lines.length) {
        errors.push(`${w}: line index ${JSON.stringify(i)} is out of range (0-${recipe.lines.length - 1}).`);
        return;
      }
      const target = recipe.lines[i] as Line;
      const wi = `${label}: lines[i=${i}]`;
      if (target.kind === 'header') {
        errors.push(`${wi}: points at a header line (${JSON.stringify(target.raw.nl)}).`);
        return;
      }
      if (seenLines.has(i)) errors.push(`${wi}: listed twice.`);
      seenLines.add(i);
      if (l['raw'] !== undefined && l['raw'] !== target.raw.nl) errors.push(`${wi}: raw ${JSON.stringify(l['raw'])} differs from the recipe line ${JSON.stringify(target.raw.nl)}.`);

      const ing = l['ing'];
      if (ing === 'NEW') {
        const e = checkNewEntry(l['new'], wi, dict, errors);
        if (e) {
          const existing = dict.get(e.id);
          const pending = pendingNew.get(e.id);
          if (existing) {
            if (canonical(existing) !== canonical(e)) errors.push(`${wi}: NEW ${JSON.stringify(e.id)} collides with a different existing ingredient.`);
            else if (mode === 'apply') warnings.push(`${wi}: NEW ${JSON.stringify(e.id)} is already in ingredients.json (identical; treated as existing).`);
          } else if (pending) {
            if (canonical(pending) !== canonical(e)) errors.push(`${wi}: NEW ${JSON.stringify(e.id)} is defined twice in this batch with different entries.`);
          } else if (mode === 'replay') {
            errors.push(`${wi}: NEW ${JSON.stringify(e.id)} is not in data/ingredients.json yet — run apply-llm-batch --apply first.`);
          } else {
            const nlHit = dict.ingredientByName(e.nl.one, 'nl');
            if (nlHit) warnings.push(`${wi}: NEW ${JSON.stringify(e.id)} — its Dutch name already resolves to ${JSON.stringify(nlHit.id)}.`);
            pendingNew.set(e.id, e);
            newIngredients.push(e);
          }
        }
      } else if (ing !== undefined && ing !== null) {
        if (typeof ing !== 'string' || (!dict.get(ing) && !pendingNew.has(ing))) errors.push(`${wi}: ing ${JSON.stringify(ing)} is not an ingredient id (use "NEW" + "new" for a new entry).`);
      }
      if (l['new'] !== undefined && ing !== 'NEW') warnings.push(`${wi}: "new" given but ing is not "NEW" (ignored).`);
      const qual = l['qual'];
      if (qual !== undefined) {
        if (!isStringArray(qual)) errors.push(`${wi}: qual must be an array of qualifier ids.`);
        else for (const q of qual) if (!dict.qualifier(q)) errors.push(`${wi}: qualifier ${JSON.stringify(q)} does not exist.`);
      }
      const prep = l['prep'];
      if (prep !== undefined && prep !== null) {
        if (!isRecord(prep) || (prep['en'] !== undefined && typeof prep['en'] !== 'string')) errors.push(`${wi}: prep must be { en }.`);
        else if (nonEmpty(prep['en']) && !nonEmpty(target.prep?.nl)) warnings.push(`${wi}: prep.en given but the line has no Dutch prep note (ignored; put it in the dictionary or the raw line).`);
      }
      const note = l['note'];
      if (note !== undefined && note !== null) {
        if (!isRecord(note) || (note['en'] !== undefined && typeof note['en'] !== 'string')) errors.push(`${wi}: note must be { en }.`);
        else if (nonEmpty(note['en']) && !nonEmpty(target.note?.nl)) warnings.push(`${wi}: note.en given but the line has no Dutch note (ignored).`);
      }
      const confidence = l['confidence'];
      if (confidence !== undefined && (typeof confidence !== 'number' || !(confidence >= 0 && confidence <= 1))) errors.push(`${wi}: confidence must be between 0 and 1.`);
      for (const k of ['qty', 'unit']) if (l[k] !== undefined) warnings.push(`${wi}: "${k}" is ignored — quantities come from the raw line only.`);
    });
    recipe.lines.forEach((l, i) => {
      if (l.kind !== 'header' && !seenLines.has(i)) warnings.push(`${label}: lines[i=${i}] (${JSON.stringify(l.raw.nl)}) is not in the batch.`);
    });
  });

  result.batch = raw as unknown as BatchFile;
  return result;
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

export interface ApplyStats {
  recipes: number;
  linesFromLlm: number;
  linesAgreed: number;
  linesKeptParser: number;
  prepFromLlm: number;
  noteFromLlm: number;
  newIngredients: number;
}

export interface ApplyResult {
  recipes: Recipe[];
  /** The dictionary including the batch's NEW entries. */
  dict: Dictionary;
  newIngredients: Ingredient[];
  stats: ApplyStats;
}

function cleanText(t: Text | undefined | null): Text | null {
  if (!t) return null;
  const out: Text = {};
  if (nonEmpty(t.nl)) out.nl = t.nl.trim();
  if (nonEmpty(t.en)) out.en = t.en.trim();
  return out.nl === undefined && out.en === undefined ? null : out;
}

/** Fresh parse of a recipe's lines from their raw Dutch text (headers stay headers). */
export function parseRecipeLines(recipe: Recipe, dict: Dictionary): Line[] {
  return recipe.lines.map((l) => {
    const raw = l.raw.nl ?? l.raw.en ?? '';
    const lang = l.raw.nl !== undefined ? 'nl' : 'en';
    return parseLine(raw, dict, lang);
  });
}

function mergeLine(line: Line, b: BatchLine, stats: ApplyStats): Line {
  const out: Line = { ...line };
  const llmConf = b.confidence ?? DEFAULT_LLM_CONFIDENCE;
  const parserConf = line.confidence ?? 0;
  const ingId = b.ing === 'NEW' ? (b.new?.id ?? null) : (b.ing ?? null);
  if (ingId) {
    if (!line.ing || (line.ing !== ingId && llmConf > parserConf)) {
      out.ing = ingId;
      const qual = b.qual ?? line.qual ?? [];
      if (qual.length) out.qual = qual;
      else delete out.qual;
      out.confidence = llmConf;
      stats.linesFromLlm++;
    } else if (line.ing === ingId) {
      out.confidence = Math.max(parserConf, llmConf);
      stats.linesAgreed++;
    } else {
      stats.linesKeptParser++;
    }
  }
  const prepEn = b.prep?.en?.trim();
  if (prepEn && nonEmpty(line.prep?.nl) && (!nonEmpty(line.prep?.en) || llmConf > parserConf)) {
    out.prep = { nl: line.prep?.nl as string, en: prepEn };
    stats.prepFromLlm++;
  }
  // The note's Dutch comes from the parser; the batch may only add the English the dictionary lacks.
  const noteEn = b.note?.en?.trim();
  if (noteEn && nonEmpty(line.note?.nl) && !nonEmpty(line.note?.en)) {
    out.note = { nl: line.note?.nl as string, en: noteEn };
    stats.noteFromLlm++;
  }
  return out;
}

/**
 * Merge a checked batch into the recipes (pure: returns new recipe objects, input untouched).
 * Lines of every batch recipe are re-parsed from `raw` with the dictionary plus the NEW entries,
 * then enriched per line. Recipes not in the batch are returned as they are.
 */
export function applyBatch(recipes: readonly Recipe[], batch: BatchFile, dict: Dictionary, newIngredients: readonly Ingredient[]): ApplyResult {
  const fullDict = withUserEntries(dict, newIngredients);
  const stats: ApplyStats = { recipes: 0, linesFromLlm: 0, linesAgreed: 0, linesKeptParser: 0, prepFromLlm: 0, noteFromLlm: 0, newIngredients: newIngredients.length };
  const byId = new Map(batch.recipes.map((r) => [r.id, r]));
  const out = recipes.map((recipe): Recipe => {
    const b = byId.get(recipe.id);
    if (!b) return recipe;
    stats.recipes++;
    const lines = parseRecipeLines(recipe, fullDict);
    for (const bl of b.lines) {
      const target = lines[bl.i];
      if (!target || target.kind === 'header') continue;
      lines[bl.i] = mergeLine(target, bl, stats);
    }
    const merged: Recipe = {
      ...recipe,
      name: { ...recipe.name, en: b.name.en.trim() },
      category: b.category,
      tags: [...new Set(b.tags ?? [])],
      lines,
      steps: recipe.steps.map((s, i) => {
        const en = b.steps[i]?.en?.trim();
        return en ? { ...s, text: { ...s.text, en } } : s;
      }),
      text: { ...(recipe.text ?? {}), en: 'llm' },
    };
    const description = cleanText({ ...(recipe.description ?? {}), ...(b.description ?? {}) });
    if (description) merged.description = description;
    if (b.time && (b.time.active !== undefined || b.time.total !== undefined)) {
      const time: { active?: number; total?: number } = {};
      if (b.time.active !== undefined) time.active = b.time.active;
      if (b.time.total !== undefined) time.total = b.time.total;
      merged.time = time;
    }
    const tipEn = b.servingTip?.en;
    if (nonEmpty(recipe.servingTip?.nl) && nonEmpty(tipEn)) {
      merged.servingTip = { ...recipe.servingTip, en: tipEn.trim() };
    }
    return merged;
  });
  return { recipes: out, dict: fullDict, newIngredients: [...newIngredients], stats };
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/** The committed batch files (data/llm/batch-*.json) in file-name order; [] when the folder is missing. */
export function batchPaths(root: string): string[] {
  const dir = join(root, 'data', 'llm');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^batch-\d+\.json$/i.test(f))
    .sort()
    .map((f) => join(dir, f));
}

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

/** One value per line in the style of data/ingredients.json (`{ "id": "ui", "nl": { "one": "ui" }, ... }`). */
function formatInline(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(formatInline).join(', ')}]`;
  if (isRecord(v)) {
    const keys = Object.keys(v);
    if (keys.length === 0) return '{}';
    return `{ ${keys.map((k) => `${JSON.stringify(k)}: ${formatInline(v[k])}`).join(', ')} }`;
  }
  return JSON.stringify(v);
}

/** data/ingredients.json text: sorted by id, one entry per line, 2-space indent. */
export function formatIngredientsFile(entries: readonly Ingredient[]): string {
  const sorted = [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return `[\n${sorted.map((e) => `  ${formatInline(e)}`).join(',\n')}\n]\n`;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printCheck(file: string, r: CheckResult): void {
  for (const w of r.warnings) console.log(`  warn:  ${w}`);
  for (const e of r.errors) console.log(`  ERROR: ${e}`);
  const n = r.batch?.recipes.length ?? 0;
  console.log(`${file}: ${r.errors.length === 0 ? 'OK' : 'FAIL'} — ${n} recipe(s), ${r.newIngredients.length} new ingredient(s), ${r.errors.length} error(s), ${r.warnings.length} warning(s)`);
}

function main(argv: string[]): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const mode = argv[0];
  const target = argv[1];
  if ((mode !== '--check' && mode !== '--apply') || !target) {
    console.error('usage: apply-llm-batch.ts --check <file> | --apply <file|all>');
    process.exit(2);
  }
  const files = target === 'all' ? batchPaths(root) : [resolve(root, target)];
  if (files.length === 0) {
    console.log('no batch files in data/llm/');
    process.exit(0);
  }
  const recipesPath = join(root, 'data', 'recipes.json');
  const ingredientsPath = join(root, 'data', 'ingredients.json');
  const recipesFile = readJson(recipesPath) as { recipes: Recipe[]; generatedAt: string; [k: string]: unknown };
  let ingredients = existsSync(ingredientsPath) ? (readJson(ingredientsPath) as Ingredient[]) : [];
  let dict = loadDictionary({ ...readDictionaryData(root, false), ingredients });
  let recipes = recipesFile.recipes;
  let failed = false;
  let appended = 0;

  for (const file of files) {
    const rel = file.startsWith(root) ? file.slice(root.length + 1).replace(/\\/g, '/') : file;
    if (!existsSync(file)) {
      console.log(`${rel}: ERROR: file not found`);
      failed = true;
      continue;
    }
    const check = checkBatch(readJson(file), recipes, dict, 'apply');
    printCheck(rel, check);
    if (check.errors.length > 0 || !check.batch) {
      failed = true;
      continue;
    }
    if (mode === '--check') continue;
    const result = applyBatch(recipes, check.batch, dict, check.newIngredients);
    recipes = result.recipes;
    dict = result.dict;
    if (result.newIngredients.length) {
      ingredients = [...ingredients, ...result.newIngredients];
      appended += result.newIngredients.length;
    }
    const s = result.stats;
    console.log(`  merged ${s.recipes} recipe(s): ${s.linesFromLlm} line(s) resolved by the LLM, ${s.linesAgreed} agreed with the parser, ${s.linesKeptParser} kept the parser's id, ${s.prepFromLlm} prep.en and ${s.noteFromLlm} note.en from the LLM, ${s.newIngredients} new ingredient(s)`);
  }

  // The human review layer (data/review/lines.json) wins over the parser and the batches (spec §4).
  if (mode === '--apply' && !failed && target === 'all') {
    const review = readReview(root);
    if (review) {
      const errors = checkReview(review, recipes, dict);
      for (const e of errors) console.log(`  ERROR: data/review/lines.json: ${e}`);
      if (errors.length) failed = true;
      else {
        const r = applyReview(recipes, review);
        recipes = r.recipes;
        console.log(`data/review/lines.json: ${r.applied} reviewed line(s) applied`);
      }
    }
  }

  if (mode === '--apply' && !failed) {
    if (appended > 0) writeFileSync(ingredientsPath, formatIngredientsFile(ingredients), 'utf8');
    writeFileSync(recipesPath, JSON.stringify({ ...recipesFile, generatedAt: new Date().toISOString(), recipes }, null, 2) + '\n', 'utf8');
    console.log(`written: data/recipes.json${appended > 0 ? `, data/ingredients.json (+${appended})` : ''}`);
    console.log('next: npm run migrate (replays all batches from the source), node --experimental-strip-types tools/gen-golden.ts, npm run validate:data, npm test');
  } else if (mode === '--apply') {
    console.log('nothing written (fix the errors above).');
  }
  process.exit(failed ? 1 : 0);
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href && basename(process.argv[1]) === 'apply-llm-batch.ts';
if (invokedDirectly) main(process.argv.slice(2));
