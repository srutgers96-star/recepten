// tools/validate-data.ts — data guard for CI and for the local dev loop.
//
// Validates the schema-1 source corpus (data/source/recipes-recepten2.json), the 20 side dishes
// (data/source/bijgerechten.json, tools/sides.ts `checkSides`, docs/specs/bijgerechten.md §2d), the dictionary files
// (data/{units,qualifiers,prep-phrases,ingredients,aisles,categories,cuisines}.json, docs/phase-2-spec.md §1,
// cuisines: docs/specs/labels-categorieen.md §2c), the generated schema-2 file data/recipes.json
// (tools/migrate-from-recepten2.ts, §2 + §4: dictionary references, `name.en` and every
// `steps[].text.en` when `text.en` is set, categories, cuisines, tags, units and qualifiers), the badge catalogue
// data/badges.json (docs/phase-5-spec.md "Block C", docs/specs/badges-avatar.md §2e), the avatar library
// data/avatar-parts.json (docs/specs/badges-avatar.md §2f), the level titles data/levels.json, the
// unlocks data/unlocks.json (docs/specs/xp-levels.md §2e), the challenges data/challenges.json (docs/specs/challenges.md §2)
// the diet swaps data/swaps.json (docs/phase-5-spec.md "Block F" item 2) and the handbook
// data/handbook/*.json (docs/specs/handbook.md §3).
//
// Run:   node --experimental-strip-types tools/validate-data.ts   (or: npm run validate:data)
// Exit:  1 when any error was found, 0 otherwise. Warnings never fail the run.
//
// Node 22 type-stripping rules apply: type-only syntax only, plain ESM, no enums/namespaces.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { loadDictionary, normalizeKey, type DictionaryData } from '../src/domain/dictionary.ts';
import { HANDBOOK_SECTION_IDS } from '../src/domain/handbook.ts';
import type { Recipe } from '../src/domain/model.ts';
import { readDictionaryData } from './build-dictionary-seed.ts';
import { checkSides, readSides, SIDES_TIMESTAMP } from './sides.ts';

export interface ValidationResult {
  /** Human-readable problems that must fail CI. */
  errors: string[];
  /** Human-readable oddities worth a look but not a failure. */
  warnings: string[];
  /** Counts for the summary line. */
  stats: { recipes: number; lines: number; resolved?: number; translated?: number };
}

/**
 * The tag vocabulary of docs/phase-2-spec.md §1 (`recipes.json` → `tags`) plus the phase-5 diet
 * tags (PLAN.md §0 "Dieet-categorieën": vegan, glutenvrij and their "-optie" variants) and
 * lactosevrij with its "-optie" (docs/specs/labels-categorieen.md §2b).
 */
export const RECIPE_TAGS: readonly string[] = [
  'vegetarisch',
  'vega-optie',
  'vegan',
  'vegan-optie',
  'glutenvrij',
  'glutenvrij-optie',
  'lactosevrij',
  'lactosevrij-optie',
  'snel',
  'oven',
  'wok',
  'kids',
  'wereld',
  'feest',
  'zomer',
  'winter',
];

/**
 * Ingredient diet flags (docs/phase-5-spec.md A.1; `lactose`: docs/specs/labels-categorieen.md §2a).
 * Required on every entry once ANY entry has them: an error when some entries carry the flag and
 * others do not (a half-merged slice).
 */
export const INGREDIENT_DIET_FLAGS: readonly string[] = ['vegan', 'gluten', 'lactose'];

/** `Line.part` values (src/domain/model.ts `LinePart`). */
export const LINE_PARTS: readonly string[] = ['sap', 'rasp', 'rasp-en-sap', 'wit', 'geel', 'blaadjes'];

const UNIT_GROUPS: ReadonlySet<string> = new Set(['mass', 'volume', 'count', 'package', 'pinch', 'length']);
const QUALIFIER_KINDS: ReadonlySet<string> = new Set(['colour', 'size', 'state', 'variety', 'fat', 'other']);
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The id sets a schema-2 file is validated against (built from the dictionary files). */
export interface DictionaryRefs {
  ingredients: ReadonlySet<string>;
  units: ReadonlySet<string>;
  qualifiers: ReadonlySet<string>;
  categories: ReadonlySet<string>;
  /** data/cuisines.json ids (docs/specs/labels-categorieen.md §2c); empty when the data has none. */
  cuisines: ReadonlySet<string>;
  aisles: ReadonlySet<string>;
  tags: ReadonlySet<string>;
}

export function refsFromData(data: DictionaryData): DictionaryRefs {
  return {
    ingredients: new Set(data.ingredients.map((i) => i.id)),
    units: new Set(data.units.map((u) => u.id)),
    qualifiers: new Set(data.qualifiers.map((q) => q.id)),
    categories: new Set(data.categories.map((c) => c.id)),
    cuisines: new Set((data.cuisines ?? []).map((c) => c.id)),
    aisles: new Set(data.aisles.map((a) => a.id)),
    tags: new Set(RECIPE_TAGS),
  };
}

const SOURCE_KEYS: ReadonlySet<string> = new Set(['name', 'ingredients', 'instructions']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((s) => typeof s === 'string');
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
// Phase-2 rules (docs/phase-2-spec.md §2 + §4), errors: the structured line fields have the right
// shape (qty {min, max?, approx?} | null, unit/ing/qual ids, part, prep/note texts, packSize, alt[]
// lines, altMode, optional, role, confidence 0-1); with `refs` every unit, ingredient (also in
// alt[]), qualifier, category and cuisine id exists and tags are a subset of RECIPE_TAGS; `cuisine`
// is absent, null or a cuisine id (docs/specs/labels-categorieen.md §2c); when `text.en` is
// 'llm' or 'human' the recipe has `name.en` and every step has `text.en` (equal step counts per
// language). Warnings: unresolved lines (ing null) as one count, a Dutch servingTip without English.

const ORIGIN_KINDS: ReadonlySet<string> = new Set(['builtin', 'user', 'received']);
const TIMER_UNITS: ReadonlySet<string> = new Set(['sec', 'min', 'hour']);
const TEXT_SOURCES: ReadonlySet<string> = new Set(['llm', 'human', 'none']);

function hasText(value: unknown, field: 'nl' | 'en'): boolean {
  return isRecord(value) && typeof value[field] === 'string' && (value[field] as string).trim() !== '';
}

/** A Text-like object: {nl?, en?} with string values. */
function isTextLike(value: unknown): boolean {
  if (!isRecord(value)) return false;
  for (const k of ['nl', 'en']) if (value[k] !== undefined && typeof value[k] !== 'string') return false;
  return true;
}

/** Structured-line checks for one line (and, recursively, its alternatives). */
function checkLineStructure(line: Record<string, unknown>, where: string, refs: DictionaryRefs | undefined, errors: string[], depth: number): void {
  const qty = line['qty'];
  if (qty !== undefined && qty !== null) {
    if (!isRecord(qty) || typeof qty['min'] !== 'number' || !Number.isFinite(qty['min']) || (qty['min'] as number) <= 0) {
      errors.push(`${where}.qty must be null or { min > 0, max?, approx? }.`);
    } else {
      if (qty['max'] !== undefined && (typeof qty['max'] !== 'number' || (qty['max'] as number) < (qty['min'] as number))) errors.push(`${where}.qty.max must be a number >= min.`);
      if (qty['approx'] !== undefined && typeof qty['approx'] !== 'boolean') errors.push(`${where}.qty.approx must be a boolean.`);
    }
  }
  for (const field of ['unit', 'ing'] as const) {
    const v = line[field];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'string' || v === '') {
      errors.push(`${where}.${field} must be null or an id string.`);
    } else if (refs && !refs[field === 'unit' ? 'units' : 'ingredients'].has(v)) {
      errors.push(`${where}.${field} ${JSON.stringify(v)} is not a known ${field === 'unit' ? 'unit' : 'ingredient'} id.`);
    }
  }
  const qual = line['qual'];
  if (qual !== undefined) {
    if (!isStringArray(qual)) errors.push(`${where}.qual must be an array of qualifier ids.`);
    else if (refs) for (const q of qual) if (!refs.qualifiers.has(q)) errors.push(`${where}.qual ${JSON.stringify(q)} is not a known qualifier id.`);
  }
  const name = line['name'];
  if (name !== undefined && typeof name !== 'string') errors.push(`${where}.name must be a string.`);
  const part = line['part'];
  if (part !== undefined && part !== null && (typeof part !== 'string' || !LINE_PARTS.includes(part))) errors.push(`${where}.part must be one of ${LINE_PARTS.join(' | ')}.`);
  for (const field of ['prep', 'note']) {
    const v = line[field];
    if (v !== undefined && v !== null && !isTextLike(v)) errors.push(`${where}.${field} must be null or { nl?, en? }.`);
  }
  const packSize = line['packSize'];
  if (packSize !== undefined && packSize !== null && typeof packSize !== 'string') errors.push(`${where}.packSize must be null or a string.`);
  const alt = line['alt'];
  if (alt !== undefined) {
    if (!Array.isArray(alt)) {
      errors.push(`${where}.alt must be an array of lines.`);
    } else if (depth > 2) {
      errors.push(`${where}.alt nests too deep.`);
    } else {
      alt.forEach((a: unknown, j: number) => {
        const w = `${where}.alt[${j}]`;
        if (!isRecord(a) || !(hasText(a['raw'], 'nl') || hasText(a['raw'], 'en'))) {
          errors.push(`${w} has no non-empty raw.nl or raw.en.`);
          return;
        }
        checkLineStructure(a, w, refs, errors, depth + 1);
      });
      const mode = line['altMode'];
      if (mode !== undefined && mode !== 'or' && mode !== 'and-or') errors.push(`${where}.altMode must be or | and-or.`);
    }
  }
  if (line['optional'] !== undefined && typeof line['optional'] !== 'boolean') errors.push(`${where}.optional must be a boolean.`);
  const role = line['role'];
  if (role !== undefined && role !== 'main' && role !== 'garnish') errors.push(`${where}.role must be main | garnish.`);
  const confidence = line['confidence'];
  if (confidence !== undefined && (typeof confidence !== 'number' || !(confidence >= 0 && confidence <= 1))) errors.push(`${where}.confidence must be a number between 0 and 1.`);
}

/**
 * Validate the schema-2 recipes file. Pure: takes the parsed JSON, returns errors/warnings.
 * With `refs` (see `refsFromData`) every dictionary reference is checked as well.
 */
export function validateSchema2(data: unknown, refs?: DictionaryRefs): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let lines = 0;
  let resolved = 0;
  let translated = 0;
  let unresolved = 0;

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
    if (isStringArray(recipe['tags'])) {
      for (const t of recipe['tags']) if (!RECIPE_TAGS.includes(t)) errors.push(`${label}: tag ${JSON.stringify(t)} is not one of ${RECIPE_TAGS.join(', ')}.`);
    }

    // Phase-2 recipe-level fields.
    const category = recipe['category'];
    if (category !== undefined && category !== null) {
      if (typeof category !== 'string' || category === '') errors.push(`${label}: "category" must be null or a category id.`);
      else if (refs && !refs.categories.has(category)) errors.push(`${label}: category ${JSON.stringify(category)} does not exist.`);
    }
    // docs/specs/labels-categorieen.md §2c: ONE cuisine id (data/cuisines.json) or null/absent = none.
    const cuisine = recipe['cuisine'];
    if (cuisine !== undefined && cuisine !== null) {
      if (typeof cuisine !== 'string' || cuisine === '') errors.push(`${label}: "cuisine" must be null or a cuisine id.`);
      else if (refs && !refs.cuisines.has(cuisine)) errors.push(`${label}: cuisine ${JSON.stringify(cuisine)} does not exist.`);
    }
    const time = recipe['time'];
    if (time !== undefined && time !== null) {
      if (!isRecord(time)) errors.push(`${label}: "time" must be null or { active?, total? }.`);
      else {
        for (const k of ['active', 'total']) {
          const v = time[k];
          if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v) || v < 0)) errors.push(`${label}: time.${k} must be a non-negative number of minutes.`);
        }
        if (typeof time['active'] === 'number' && typeof time['total'] === 'number' && time['total'] < time['active']) warnings.push(`${label}: time.total < time.active.`);
      }
    }
    for (const field of ['description', 'servingTip']) {
      const v = recipe[field];
      if (v !== undefined && v !== null && !isTextLike(v)) errors.push(`${label}: "${field}" must be null or { nl?, en? }.`);
    }
    const textMeta = recipe['text'];
    let hasEnglish = false;
    if (textMeta !== undefined && textMeta !== null) {
      if (!isRecord(textMeta) || (textMeta['en'] !== undefined && (typeof textMeta['en'] !== 'string' || !TEXT_SOURCES.has(textMeta['en'])))) {
        errors.push(`${label}: "text" must be null or { en?: llm | human | none, reviewedBy? }.`);
      } else {
        hasEnglish = textMeta['en'] === 'llm' || textMeta['en'] === 'human';
      }
    }
    if (hasEnglish) {
      translated++;
      if (!hasText(name, 'en')) errors.push(`${label}: text.en is set but "name.en" is missing.`);
      if (hasText(recipe['servingTip'], 'nl') && !hasText(recipe['servingTip'], 'en')) warnings.push(`${label}: text.en is set but servingTip.en is missing.`);
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
        if (kind === 'header') return;
        checkLineStructure(line, `${label}: lines[${i}]`, refs, errors, 0);
        if (typeof line['ing'] === 'string') resolved++;
        else if (line['ing'] === null) unresolved++;
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
        if (hasEnglish && !hasText(step['text'], 'en')) errors.push(`${label}: text.en is set but steps[${i}].text.en is missing (step counts must match per language).`);
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

  if (unresolved > 0) warnings.push(`${unresolved} ingredient line(s) are unresolved (ing null); see docs/measure-resolution.md.`);

  return { errors, warnings, stats: { recipes: recipes.length, lines, resolved, translated } };
}

// ---------------------------------------------------------------------------
// Dictionary: data/{units,qualifiers,prep-phrases,ingredients,aisles,categories,cuisines}.json (spec §1)
// ---------------------------------------------------------------------------
//
// Errors: unique slug ids per file, required names, unit groups / qualifier kinds known, `{n}`
// balanced in prep templates, ingredient aisle / defaultUnit / buyUnit / gramsPer keys known,
// staple/veg booleans, vegan/gluten/lactose booleans on every entry once any entry has them
// (phase 5; lactose: docs/specs/labels-categorieen.md §2a), `…Unsure` only next to a `false` flag,
// no vegan entry with lactose (or unsure about it), a Dutch name or alias claimed by two
// ingredients (the parser could only pick one), cuisines (when present) with the category checks
// plus a non-empty `flag` and an optional boolean `rare` (docs/specs/labels-categorieen.md §2c and
// "Blok 6 — keukens wereldwijd"). Warnings:
// an English name claimed twice (English input is best effort), no diet flags at all yet.

function checkIds(items: unknown, file: string, errors: string[]): Record<string, unknown>[] {
  if (!Array.isArray(items)) {
    errors.push(`${file}: must be an array.`);
    return [];
  }
  const seen = new Set<string>();
  const out: Record<string, unknown>[] = [];
  items.forEach((item: unknown, i: number) => {
    if (!isRecord(item)) {
      errors.push(`${file}[${i}]: not an object.`);
      return;
    }
    const id = item['id'];
    if (typeof id !== 'string' || !ID_RE.test(id)) errors.push(`${file}[${i}]: "id" must be a slug (a-z, 0-9, dashes), got ${JSON.stringify(id)}.`);
    else if (seen.has(id)) errors.push(`${file}: duplicate id ${JSON.stringify(id)}.`);
    else seen.add(id);
    out.push(item);
  });
  return out;
}

function hasName(v: unknown): boolean {
  return isRecord(v) && typeof v['one'] === 'string' && (v['one'] as string).trim() !== '';
}

/** Validate the dictionary files together. Pure: takes the loaded data, returns errors/warnings. */
export function validateDictionary(data: DictionaryData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const units = checkIds(data.units, 'units.json', errors);
  const unitIds = new Set(units.map((u) => u['id'] as string));
  for (const u of units) {
    const label = `units.json ${JSON.stringify(u['id'])}`;
    if (typeof u['group'] !== 'string' || !UNIT_GROUPS.has(u['group'])) errors.push(`${label}: "group" must be mass | volume | count | package | pinch | length.`);
    if (!hasName(u['nl'])) errors.push(`${label}: "nl.one" is required.`);
    if (!hasName(u['en'])) errors.push(`${label}: "en.one" is required.`);
    if (u['group'] === 'mass' && typeof u['g'] !== 'number') warnings.push(`${label}: mass unit without "g".`);
    if (u['group'] === 'volume' && typeof u['ml'] !== 'number') warnings.push(`${label}: volume unit without "ml".`);
    const en = u['en'];
    if (isRecord(en) && typeof en['render'] === 'string' && !unitIds.has(en['render'])) errors.push(`${label}: en.render ${JSON.stringify(en['render'])} is not a unit id.`);
  }

  const qualifiers = checkIds(data.qualifiers, 'qualifiers.json', errors);
  for (const q of qualifiers) {
    const label = `qualifiers.json ${JSON.stringify(q['id'])}`;
    if (!isStringArray(q['nl']) || q['nl'].length === 0) errors.push(`${label}: "nl" must be a non-empty array of forms.`);
    if (typeof q['en'] !== 'string' || q['en'].trim() === '') errors.push(`${label}: "en" must be a non-empty string.`);
    if (typeof q['kind'] !== 'string' || !QUALIFIER_KINDS.has(q['kind'])) errors.push(`${label}: "kind" must be colour | size | state | variety | fat | other.`);
    if (typeof q['variant'] !== 'boolean') errors.push(`${label}: "variant" must be a boolean.`);
  }

  if (!Array.isArray(data.prepPhrases)) errors.push('prep-phrases.json: must be an array.');
  else {
    const seenPrep = new Set<string>();
    data.prepPhrases.forEach((p: unknown, i: number) => {
      if (!isRecord(p) || typeof p['nl'] !== 'string' || typeof p['en'] !== 'string' || p['nl'].trim() === '' || p['en'].trim() === '') {
        errors.push(`prep-phrases.json[${i}]: must be { nl, en } with non-empty strings.`);
        return;
      }
      const slots = (s: string) => s.split('{n}').length - 1;
      if (slots(p['nl']) !== slots(p['en'])) errors.push(`prep-phrases.json ${JSON.stringify(p['nl'])}: "{n}" count differs between nl and en.`);
      if (p['enSliced'] !== undefined && (typeof p['enSliced'] !== 'string' || p['enSliced'].trim() === '' || p['nl'].includes('{n}'))) {
        errors.push(`prep-phrases.json ${JSON.stringify(p['nl'])}: "enSliced" must be a non-empty string on a phrase without "{n}".`);
      }
      const key = normalizeKey(p['nl']);
      if (seenPrep.has(key)) warnings.push(`prep-phrases.json: duplicate nl phrase ${JSON.stringify(p['nl'])}.`);
      seenPrep.add(key);
    });
  }

  // data/note-phrases.json (phase 5 A-bis.1): { nl, en, aliases?: { nl?, en? } }, same "{n}" count on both sides.
  if (data.notePhrases !== undefined) {
    if (!Array.isArray(data.notePhrases)) errors.push('note-phrases.json: must be an array.');
    else {
      const seenNote = new Set<string>();
      data.notePhrases.forEach((p: unknown, i: number) => {
        if (!isRecord(p) || typeof p['nl'] !== 'string' || typeof p['en'] !== 'string' || p['nl'].trim() === '' || p['en'].trim() === '') {
          errors.push(`note-phrases.json[${i}]: must be { nl, en } with non-empty strings.`);
          return;
        }
        const slots = (s: string) => s.split('{n}').length - 1;
        if (slots(p['nl']) !== slots(p['en'])) errors.push(`note-phrases.json ${JSON.stringify(p['nl'])}: "{n}" count differs between nl and en.`);
        if (p['aliases'] !== undefined) {
          const a = p['aliases'];
          if (!isRecord(a) || (a['nl'] !== undefined && !isStringArray(a['nl'])) || (a['en'] !== undefined && !isStringArray(a['en']))) {
            errors.push(`note-phrases.json ${JSON.stringify(p['nl'])}: "aliases" must be { nl?: string[], en?: string[] }.`);
          }
        }
        const key = normalizeKey(p['nl']);
        if (seenNote.has(key)) warnings.push(`note-phrases.json: duplicate nl phrase ${JSON.stringify(p['nl'])}.`);
        seenNote.add(key);
      });
    }
  }

  for (const [file, items] of [['aisles.json', data.aisles], ['categories.json', data.categories]] as const) {
    for (const item of checkIds(items, file, errors)) {
      const label = `${file} ${JSON.stringify(item['id'])}`;
      for (const k of ['nl', 'en']) if (typeof item[k] !== 'string' || (item[k] as string).trim() === '') errors.push(`${label}: "${k}" must be a non-empty string.`);
      if (typeof item['order'] !== 'number') errors.push(`${label}: "order" must be a number.`);
    }
  }
  // data/cuisines.json (docs/specs/labels-categorieen.md §2c): the category checks plus a flag emoji;
  // `rare` (a reserve cuisine, "Blok 6 — keukens wereldwijd") is optional and a boolean when present.
  if (data.cuisines !== undefined) {
    for (const item of checkIds(data.cuisines, 'cuisines.json', errors)) {
      const label = `cuisines.json ${JSON.stringify(item['id'])}`;
      for (const k of ['nl', 'en', 'flag']) if (typeof item[k] !== 'string' || (item[k] as string).trim() === '') errors.push(`${label}: "${k}" must be a non-empty string.`);
      if (typeof item['order'] !== 'number') errors.push(`${label}: "order" must be a number.`);
      if (item['rare'] !== undefined && typeof item['rare'] !== 'boolean') errors.push(`${label}: "rare" must be true or false when present.`);
    }
  }
  const aisleIds = new Set((Array.isArray(data.aisles) ? data.aisles : []).map((a) => a.id));

  const ingredients = checkIds(data.ingredients, 'ingredients.json', errors);
  const nlKeys = new Map<string, string>();
  const enKeys = new Map<string, string>();
  const unitOrPiece = (v: unknown) => typeof v === 'string' && (v === 'stuk' || unitIds.has(v));
  for (const ing of ingredients) {
    const id = String(ing['id']);
    const label = `ingredients.json ${JSON.stringify(id)}`;
    if (!hasName(ing['nl'])) errors.push(`${label}: "nl.one" is required.`);
    if (!hasName(ing['en'])) errors.push(`${label}: "en.one" is required.`);
    if (typeof ing['aisle'] !== 'string' || !aisleIds.has(ing['aisle'])) errors.push(`${label}: aisle ${JSON.stringify(ing['aisle'])} does not exist.`);
    if (ing['defaultUnit'] !== null && !unitOrPiece(ing['defaultUnit'])) errors.push(`${label}: defaultUnit must be null, "stuk" or a unit id.`);
    if (ing['buyUnit'] !== undefined && !unitOrPiece(ing['buyUnit'])) errors.push(`${label}: buyUnit must be "stuk" or a unit id.`);
    const gramsPer = ing['gramsPer'];
    if (gramsPer !== undefined) {
      if (!isRecord(gramsPer)) errors.push(`${label}: gramsPer must be an object.`);
      else for (const [k, v] of Object.entries(gramsPer)) if (!unitOrPiece(k) || typeof v !== 'number' || !(v > 0)) errors.push(`${label}: gramsPer.${k} must map a unit id (or "stuk") to a positive number.`);
    }
    for (const k of ['staple', 'veg']) if (typeof ing[k] !== 'boolean') errors.push(`${label}: "${k}" must be a boolean.`);
    for (const k of [...INGREDIENT_DIET_FLAGS, 'glutenUnsure', 'lactoseUnsure', 'perishable']) {
      if (ing[k] !== undefined && typeof ing[k] !== 'boolean') errors.push(`${label}: "${k}" must be a boolean.`);
    }
    if (ing['glutenUnsure'] !== undefined && ing['gluten'] === undefined) errors.push(`${label}: "glutenUnsure" needs a "gluten" flag next to it.`);
    // src/domain/diet.ts treats `gluten: true` as a hard fact and never reads `glutenUnsure` then.
    if (ing['gluten'] === true && ing['glutenUnsure'] === true) errors.push(`${label}: "gluten: true" is a fact; drop "glutenUnsure" or use "gluten": false, "glutenUnsure": true.`);
    // Lactose (STRICT reading, docs/specs/labels-categorieen.md §2a): same pairing rules as gluten,
    // plus rule H1: a plant-based entry (vegan: true) is lactose: false, never unsure.
    if (ing['lactoseUnsure'] !== undefined && ing['lactose'] === undefined) errors.push(`${label}: "lactoseUnsure" needs a "lactose" flag next to it.`);
    if (ing['lactose'] === true && ing['lactoseUnsure'] === true) errors.push(`${label}: "lactose: true" is a fact; drop lactoseUnsure or use lactose: false, lactoseUnsure: true.`);
    if (ing['vegan'] === true && ing['lactose'] === true) errors.push(`${label}: "vegan: true" with "lactose: true": a plant-based product cannot contain lactose.`);
    if (ing['vegan'] === true && ing['lactoseUnsure'] === true) errors.push(`${label}: "vegan: true" with "lactoseUnsure: true": a plant-based product is never unsure about lactose.`);
    const gloss = ing['gloss'];
    if (gloss !== undefined && (!isRecord(gloss) || typeof gloss['en'] !== 'string')) errors.push(`${label}: "gloss" must be { en }.`);
    if (ing['cut'] !== undefined && ing['cut'] !== 'slice' && ing['cut'] !== 'chop') errors.push(`${label}: "cut" must be slice | chop.`);
    const unitNames = ing['unitNames'];
    if (unitNames !== undefined) {
      if (!isRecord(unitNames)) errors.push(`${label}: "unitNames" must be an object keyed by unit id.`);
      else {
        for (const [u, names] of Object.entries(unitNames)) {
          if (!unitOrPiece(u)) errors.push(`${label}: unitNames.${u} is not a unit id.`);
          if (!isRecord(names) || !['nl', 'en'].some((l) => hasName(names[l])) || ['nl', 'en'].some((l) => names[l] !== undefined && !hasName(names[l]))) {
            errors.push(`${label}: unitNames.${u} must be { nl?: { one, many? }, en?: { one, many? } }.`);
          }
        }
      }
    }
    const aliases = ing['aliases'];
    if (aliases !== undefined && (!isRecord(aliases) || (aliases['nl'] !== undefined && !isStringArray(aliases['nl'])) || (aliases['en'] !== undefined && !isStringArray(aliases['en'])))) {
      errors.push(`${label}: "aliases" must be { nl?: string[], en?: string[] }.`);
    }
    const names = (lang: 'nl' | 'en'): string[] => {
      const n = ing[lang];
      const out: string[] = [];
      if (isRecord(n)) for (const k of ['one', 'many']) if (typeof n[k] === 'string') out.push(n[k] as string);
      if (isRecord(aliases) && isStringArray(aliases[lang])) out.push(...aliases[lang]);
      return out;
    };
    for (const n of names('nl')) {
      const key = normalizeKey(n);
      const owner = nlKeys.get(key);
      if (owner !== undefined && owner !== id) errors.push(`${label}: Dutch name ${JSON.stringify(n)} is also claimed by ${JSON.stringify(owner)}.`);
      else nlKeys.set(key, id);
    }
    for (const n of names('en')) {
      const key = normalizeKey(n);
      const owner = enKeys.get(key);
      if (owner !== undefined && owner !== id) warnings.push(`${label}: English name ${JSON.stringify(n)} is also claimed by ${JSON.stringify(owner)}.`);
      else enKeys.set(key, id);
    }
  }

  // Diet flags: all or none. Some entries flagged and others not means a half-merged slice.
  for (const flag of INGREDIENT_DIET_FLAGS) {
    const missing = ingredients.filter((ing) => ing[flag] === undefined);
    if (missing.length > 0 && missing.length < ingredients.length) {
      const ids = missing.slice(0, 10).map((ing) => JSON.stringify(ing['id'])).join(', ');
      errors.push(`ingredients.json: "${flag}" is set on ${ingredients.length - missing.length} entries but missing on ${missing.length}: ${ids}${missing.length > 10 ? ', …' : ''}.`);
    } else if (missing.length === ingredients.length && ingredients.length > 0) {
      warnings.push(`ingredients.json: no entry has the "${flag}" flag yet (docs/phase-5-spec.md A.1, docs/specs/labels-categorieen.md §2a); diet tags stay "unsure".`);
    }
  }

  return { errors, warnings, stats: { recipes: 0, lines: ingredients.length } };
}

// ---------------------------------------------------------------------------
// Badges: data/badges.json (docs/specs/badges-avatar.md §2a, §2b and §2e; src/domain/badges.ts `Badge`)
// ---------------------------------------------------------------------------
//
// Errors (phase 5, unchanged): an array of badges with unique kebab-case ids, `nl` and `en` each a
// non-empty name + description, a non-empty icon, a rule whose kind is known with an integer n >= 1
// where it has one, category/tag/ingredient rule ids that exist in the dictionary (same ref sets as
// validateSchema2), and the old `tier` in {1, 2, 3} when present.
// Errors (6D-2, §2e): `group` missing or not a BADGE_GROUP_IDS value · `tiers` present but not exactly
// 8 strictly increasing integers >= 1 · a count kind with both `tiers` and `rule.n` (or neither) ·
// `tiers` on a plain kind (letters, allClassics, halfClassics, allCategories) · a ladder whose nl or en
// description lacks `{n}`, or a one-off badge whose description has one · group 'geheim' without
// `hidden: true` · `season` without kind 'seasonCooks' or the other way round, `from`/`to` not a valid
// 'MM-DD' · `unlock.part` not in data/avatar-parts.json (when the parts are passed in) · `unlock.tier`
// missing on a ladder, present on a one-off badge, or outside 1..8 · two badges with the same
// `unlock.part` · `xp` not an integer >= 0, or `xp` on a ladder · `retired` without `replacedBy`, or a
// `replacedBy` that is not an existing, non-retired badge · a `cuisine` id that is not in
// data/cuisines.json (a warning instead when that file does not exist) · a `feature` id outside
// BADGE_FEATURE_IDS · `weekdayCooks.days` empty or outside 0..6 · `cookHour` from/to outside 0..23 or
// from > to · an unknown `calendar.when` · `comeback.days` < 1. `sameRecipeDays` always has an `n`
// (src/domain/badges.ts `BadgeRule`: `n: number`), so it is never a ladder.
// Warnings: a ladder cuisine/tag/ingredient id that occurs in 0 classics (only with `classics`), more
// than 150 badges (retired ones not counted), stray rule fields, `replacedBy` without `retired`.

/**
 * The eight badge groups in page order. Mirrors BADGE_GROUPS in src/domain/badges.ts — not imported:
 * the domain modules import each other without `.ts` extensions, which Node's type stripping cannot
 * resolve (tests/validate-badges.test.ts keeps the two lists equal).
 */
export const BADGE_GROUP_IDS: readonly string[] = ['koken', 'ontdekken', 'keukens', 'seizoenen', 'samen', 'foto', 'reeksen', 'geheim'];

/** The 32 feature-event ids (§2c). Mirrors FEATURE_IDS in src/domain/features.ts (not imported, as above). */
export const BADGE_FEATURE_IDS: readonly string[] = [
  'voice', 'print', 'qrShown', 'theme', 'amounts', 'readAloud', 'langToggle', 'fahrenheit', 'pasteRecipe',
  'aiImport', 'backup', 'restore', 'story', 'pick7', 'pantry', 'wordPicker', 'scaled', 'standingList', 'sort',
  'cookSwipe', 'cookMode', 'timer', 'planCook', 'listMade', 'surprise', 'dictEdit', 'variant', 'planShared',
  'listShared', 'deltaShared', 'cardShared', 'feedback',
];

/** Number of thresholds on a ladder badge (yellow, green, blue, red, bronze, silver, gold, platinum). */
export const BADGE_TIER_COUNT = 8;

/** Rule kinds that carry only `{ n? }`: `n` for a one-off badge, `tiers` on the badge for a ladder (§2b `CountKind`). */
export const BADGE_COUNT_KINDS: readonly string[] = [
  'cookCount',
  'distinctRecipes',
  'ownRecipes',
  'reviews',
  'oneStar',
  'fiveStar',
  'photos',
  'photoRecipes',
  'photosOfOneRecipe',
  'shared',
  'received',
  'streakWeeks',
  'streakDays',
  'fullWeeks',
  'classics',
  'cuisines',
  'householdMembers',
  'cooks',
  'donor',
  // 6D-2c "Hele cirkel": own AI-prompt recipes that were shared, bought, cooked and photographed.
  'fullCycle',
  // 6E "Uitdager": finished challenges (docs/specs/challenges.md §2).
  'challenges',
];
/** Rule kinds that carry `{ id, n? }`, checked against the dictionary refs. */
export const BADGE_REF_KINDS: readonly string[] = ['category', 'tag', 'ingredient', 'cuisine'];
/** Rule kinds without fields (and never a ladder). */
export const BADGE_BARE_KINDS: readonly string[] = ['letters', 'allClassics', 'halfClassics', 'allCategories'];
/** Rule kinds with their own fields next to `n?` (§2b); the fields each kind takes besides `kind` and `n`. */
export const BADGE_FIELD_KINDS: Readonly<Record<string, readonly string[]>> = {
  seasonCooks: [],
  weekdayCooks: ['days'],
  cookHour: ['from', 'to'],
  sameRecipeDays: [],
  calendar: ['when'],
  feature: ['id'],
  retryAfterOneStar: [],
  comeback: ['days'],
  overcooked: [],
};
/** `calendar.when` values. */
export const BADGE_CALENDAR_WHEN: readonly string[] = ['friday-13', 'leap-day'];

const ALL_BADGE_KINDS: readonly string[] = [...BADGE_COUNT_KINDS, ...BADGE_REF_KINDS, ...BADGE_BARE_KINDS, ...Object.keys(BADGE_FIELD_KINDS)];

/** Which ref set a ref-kind rule id is checked against. */
const BADGE_REF_SET: Readonly<Record<string, keyof DictionaryRefs>> = {
  category: 'categories',
  tag: 'tags',
  ingredient: 'ingredients',
  cuisine: 'cuisines',
};

/** More badges than this (retired ones not counted) gives a warning (§2e). */
const BADGE_SOFT_MAX = 150;

const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** 'MM-DD' with a real month and day (29 February allowed). */
function isMonthDay(v: unknown): boolean {
  if (typeof v !== 'string' || !/^\d\d-\d\d$/.test(v)) return false;
  const month = Number(v.slice(0, 2));
  const day = Number(v.slice(3));
  return month >= 1 && month <= 12 && day >= 1 && day <= MONTH_DAYS[month - 1]!;
}

function isIntIn(v: unknown, min: number, max = Number.POSITIVE_INFINITY): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

/** Extra inputs for validateBadges, read from other data files by `main()`. */
export interface BadgeCheckInput {
  /** data/avatar-parts.json as parsed; with it every `unlock.part` must name a part. */
  avatarParts?: unknown;
  /** The classics (builtin recipes of data/recipes.json); with them, ladder ids found in none warn. */
  classics?: readonly unknown[];
}

/** How many classics use a cuisine / tag / ingredient id (src/domain/badges.ts counts top-level lines). */
function classicsUsing(kind: string, id: string, classics: readonly unknown[]): number {
  let count = 0;
  for (const r of classics) {
    if (!isRecord(r)) continue;
    if (kind === 'cuisine' && r['cuisine'] === id) count++;
    else if (kind === 'tag' && isStringArray(r['tags']) && r['tags'].includes(id)) count++;
    else if (kind === 'ingredient' && Array.isArray(r['lines']) && r['lines'].some((l: unknown) => isRecord(l) && l['ing'] === id)) count++;
  }
  return count;
}

/**
 * Validate data/badges.json. Pure: takes the parsed JSON, returns errors/warnings.
 * With `refs` (see `refsFromData`) category/tag/ingredient/cuisine rule ids are checked as well; with
 * `input.avatarParts` every `unlock.part`; with `input.classics` the "never reachable" warning.
 */
export function validateBadges(data: unknown, refs?: DictionaryRefs, input: BadgeCheckInput = {}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(data)) {
    errors.push('badges.json: must be an array of badges.');
    return { errors, warnings, stats: { recipes: 0, lines: 0 } };
  }

  const partIds: ReadonlySet<string> | null = Array.isArray(input.avatarParts)
    ? new Set(input.avatarParts.filter(isRecord).map((p) => p['id']).filter((id): id is string => typeof id === 'string'))
    : null;
  const unlockOwners = new Map<string, string>(); // part id -> first badge label that unlocks it
  const replacements: Array<{ label: string; replacedBy: string }> = [];
  const retiredIds = new Set<string>();
  let active = 0;

  const seen = new Map<string, number>();
  data.forEach((badge: unknown, index: number) => {
    const where = `badges.json[${index}]`;
    if (!isRecord(badge)) {
      errors.push(`${where}: not an object.`);
      return;
    }

    const id = badge['id'];
    const label = typeof id === 'string' && id !== '' ? `badges.json ${JSON.stringify(id)}` : where;
    if (typeof id !== 'string' || !ID_RE.test(id)) {
      errors.push(`${where}: "id" must be a kebab-case slug (a-z, 0-9, dashes), got ${JSON.stringify(id)}.`);
    } else {
      const first = seen.get(id);
      if (first !== undefined) errors.push(`${label}: duplicate id (also badge #${first}).`);
      else seen.set(id, index);
    }

    for (const lang of ['nl', 'en'] as const) {
      const text = badge[lang];
      if (!isRecord(text)) {
        errors.push(`${label}: "${lang}" must be { name, description }.`);
        continue;
      }
      for (const field of ['name', 'description'] as const) {
        const v = text[field];
        if (typeof v !== 'string' || v.trim() === '') errors.push(`${label}: "${lang}.${field}" must be a non-empty string.`);
      }
    }

    const icon = badge['icon'];
    if (typeof icon !== 'string' || icon.trim() === '') errors.push(`${label}: "icon" must be a non-empty string.`);

    // Ladder or one-off: a ladder has `tiers` (and then no `rule.n`).
    const tiers = badge['tiers'];
    const ladder = tiers !== undefined;
    if (ladder) {
      const ok = Array.isArray(tiers) && tiers.length === BADGE_TIER_COUNT && tiers.every((t: unknown, i: number) => isIntIn(t, 1) && (i === 0 || t > (tiers[i - 1] as number)));
      if (!ok) errors.push(`${label}: "tiers" must be exactly ${BADGE_TIER_COUNT} strictly increasing integers >= 1.`);
    }

    const rule = badge['rule'];
    let kind: string | null = null;
    if (!isRecord(rule) || typeof rule['kind'] !== 'string' || !ALL_BADGE_KINDS.includes(rule['kind'])) {
      errors.push(`${label}: "rule.kind" must be one of ${ALL_BADGE_KINDS.join(' | ')}.`);
    } else {
      kind = rule['kind'];
      const n = rule['n'];
      if (BADGE_BARE_KINDS.includes(kind)) {
        if (rule['n'] !== undefined || rule['id'] !== undefined) warnings.push(`${label}: rule kind "${kind}" takes no fields; "n"/"id" are ignored.`);
        if (ladder) errors.push(`${label}: rule kind "${kind}" cannot be a ladder; drop "tiers".`);
      } else {
        if (n !== undefined && !isIntIn(n, 1)) errors.push(`${label}: rule.n must be an integer >= 1 for kind "${kind}".`);
        if (kind === 'sameRecipeDays') {
          if (n === undefined) errors.push(`${label}: rule.n must be an integer >= 1 for kind "${kind}".`);
          if (ladder) errors.push(`${label}: rule kind "${kind}" cannot be a ladder; drop "tiers".`);
        } else if (ladder && n !== undefined) {
          errors.push(`${label}: a ladder ("tiers") has no rule.n; drop one of the two.`);
        } else if (!ladder && n === undefined) {
          errors.push(`${label}: rule.n must be an integer >= 1 for kind "${kind}" (or give the badge "tiers").`);
        }
        const allowed = new Set(['kind', 'n', ...(BADGE_REF_KINDS.includes(kind) ? ['id'] : []), ...(BADGE_FIELD_KINDS[kind] ?? [])]);
        for (const key of Object.keys(rule)) if (!allowed.has(key)) warnings.push(`${label}: rule kind "${kind}" takes no ${JSON.stringify(key)}; it is ignored.`);
      }

      if (BADGE_REF_KINDS.includes(kind)) {
        const refId = rule['id'];
        if (typeof refId !== 'string' || refId === '') {
          errors.push(`${label}: rule.id must be a non-empty id string for kind "${kind}".`);
        } else {
          const refSet = BADGE_REF_SET[kind];
          if (refs && refSet) {
            if (kind === 'cuisine' && refs.cuisines.size === 0) {
              warnings.push(`${label}: data/cuisines.json is not present; cuisine id ${JSON.stringify(refId)} is unchecked.`);
            } else if (!refs[refSet].has(refId)) {
              errors.push(`${label}: rule.id ${JSON.stringify(refId)} is not a known ${kind} id.`);
            }
          }
          if (ladder && kind !== 'category' && input.classics && classicsUsing(kind, refId, input.classics) === 0) {
            warnings.push(`${label}: ${kind} ${JSON.stringify(refId)} occurs in no classic; the ladder needs recipes of your own.`);
          }
        }
      }
      if (kind === 'feature' && (typeof rule['id'] !== 'string' || !BADGE_FEATURE_IDS.includes(rule['id']))) {
        errors.push(`${label}: rule.id ${JSON.stringify(rule['id'])} is not a feature id (${BADGE_FEATURE_IDS.join(', ')}).`);
      }
      if (kind === 'weekdayCooks') {
        const days = rule['days'];
        if (!Array.isArray(days) || days.length === 0 || !days.every((d: unknown) => isIntIn(d, 0, 6))) {
          errors.push(`${label}: rule.days must be a non-empty array of weekdays 0..6 (0 = Sunday).`);
        }
      }
      if (kind === 'cookHour') {
        const from = rule['from'];
        const to = rule['to'];
        if (!isIntIn(from, 0, 23) || !isIntIn(to, 0, 23)) errors.push(`${label}: rule.from and rule.to must be hours 0..23.`);
        else if (from > to) errors.push(`${label}: rule.from (${from}) must not be after rule.to (${to}).`);
      }
      if (kind === 'calendar' && (typeof rule['when'] !== 'string' || !BADGE_CALENDAR_WHEN.includes(rule['when']))) {
        errors.push(`${label}: rule.when must be one of ${BADGE_CALENDAR_WHEN.join(' | ')}.`);
      }
      if (kind === 'comeback' && !isIntIn(rule['days'], 1)) errors.push(`${label}: rule.days must be an integer >= 1.`);
    }

    // `{n}` in the descriptions: always on a ladder, never on a one-off badge.
    for (const lang of ['nl', 'en'] as const) {
      const text = badge[lang];
      const description = isRecord(text) ? text['description'] : undefined;
      if (typeof description !== 'string') continue;
      const hasN = description.includes('{n}');
      if (ladder && !hasN) errors.push(`${label}: a ladder needs "{n}" in ${lang}.description.`);
      if (!ladder && hasN) errors.push(`${label}: a one-off badge has no "{n}" in ${lang}.description.`);
    }

    const group = badge['group'];
    if (typeof group !== 'string' || !BADGE_GROUP_IDS.includes(group)) errors.push(`${label}: "group" must be one of ${BADGE_GROUP_IDS.join(' | ')}.`);
    for (const flag of ['hidden', 'retired'] as const) {
      if (badge[flag] !== undefined && typeof badge[flag] !== 'boolean') errors.push(`${label}: "${flag}" must be true or false when present.`);
    }
    if (group === 'geheim' && badge['hidden'] !== true) errors.push(`${label}: a badge in group "geheim" must have "hidden": true.`);

    const season = badge['season'];
    if (season !== undefined) {
      if (kind !== null && kind !== 'seasonCooks') errors.push(`${label}: "season" belongs to rule kind "seasonCooks" only.`);
      if (!isRecord(season) || !isMonthDay(season['from']) || !isMonthDay(season['to'])) errors.push(`${label}: "season" must be { from, to } with valid 'MM-DD' dates.`);
    } else if (kind === 'seasonCooks') {
      errors.push(`${label}: rule kind "seasonCooks" needs a "season" { from, to }.`);
    }

    const unlock = badge['unlock'];
    if (unlock !== undefined) {
      const part = isRecord(unlock) ? unlock['part'] : undefined;
      if (typeof part !== 'string' || part === '') {
        errors.push(`${label}: "unlock" must be { part, tier? } with a non-empty part id.`);
      } else {
        if (partIds && !partIds.has(part)) errors.push(`${label}: unlock.part ${JSON.stringify(part)} is not in avatar-parts.json.`);
        const owner = unlockOwners.get(part);
        if (owner !== undefined) errors.push(`${label}: unlock.part ${JSON.stringify(part)} is already unlocked by ${owner}.`);
        else unlockOwners.set(part, label);
      }
      const tier = isRecord(unlock) ? unlock['tier'] : undefined;
      if (ladder && tier === undefined) errors.push(`${label}: a ladder needs unlock.tier (1..${BADGE_TIER_COUNT}).`);
      else if (!ladder && tier !== undefined) errors.push(`${label}: a one-off badge takes no unlock.tier.`);
      else if (tier !== undefined && !isIntIn(tier, 1, BADGE_TIER_COUNT)) errors.push(`${label}: unlock.tier must be an integer 1..${BADGE_TIER_COUNT}.`);
    }

    const xp = badge['xp'];
    if (xp !== undefined) {
      if (!isIntIn(xp, 0)) errors.push(`${label}: "xp" must be an integer >= 0.`);
      if (ladder) errors.push(`${label}: a ladder takes no "xp" (it earns 50 per level reached).`);
    }

    const replacedBy = badge['replacedBy'];
    if (badge['retired'] === true) {
      if (typeof id === 'string') retiredIds.add(id);
      if (typeof replacedBy !== 'string' || replacedBy === '') errors.push(`${label}: a retired badge needs "replacedBy" (the badge that took over).`);
      else replacements.push({ label, replacedBy });
    } else {
      active++;
      if (replacedBy !== undefined) warnings.push(`${label}: "replacedBy" without "retired": true is ignored.`);
    }

    const oldTier = badge['tier'];
    if (oldTier !== undefined && oldTier !== 1 && oldTier !== 2 && oldTier !== 3) errors.push(`${label}: "tier" must be 1, 2 or 3 when present.`);
  });

  for (const { label, replacedBy } of replacements) {
    if (!seen.has(replacedBy)) errors.push(`${label}: replacedBy ${JSON.stringify(replacedBy)} is not a badge id.`);
    else if (retiredIds.has(replacedBy)) errors.push(`${label}: replacedBy ${JSON.stringify(replacedBy)} is itself retired.`);
  }
  if (active > BADGE_SOFT_MAX) warnings.push(`badges.json: ${active} badges (not counting retired ones); more than ${BADGE_SOFT_MAX} is a lot for one page.`);

  return { errors, warnings, stats: { recipes: 0, lines: data.length } };
}

// ---------------------------------------------------------------------------
// Avatar parts: data/avatar-parts.json (docs/specs/badges-avatar.md §2f, src/domain/avatar.ts `AvatarPart`)
// ---------------------------------------------------------------------------
//
// Errors: an array of { id, layer, nl, en, unlock, rarity?, svg }; ids kebab-case and unique and starting with
// `<layer>-`; layer in AVATAR_LAYERS; nl/en non-empty; unlock exactly one of { level: 3..100 } or
// { badge: <id> } where that badge exists, is not retired and has unlock.part === this id — and, the
// other way round, every badge whose unlock.part names a part is named back by that part's unlock;
// svg a string without `<script`, without `href=` and without `style=` other than the two allowed
// `fill:var(--tone)` / `fill:var(--hair)`, every `id="…"` in it ends with `__u` and every `url(#…)`
// points at such an id in the same svg; every layer in AVATAR_REQUIRED_LAYERS has a level-3 part;
// `rarity`, when present, one of AVATAR_RARITIES (block 6D-R: only a valid value is demanded, never a
// warning when it differs from the level/badge rule — differing is the point; a missing rarity falls
// back to that rule in normalizeAvatarParts).
// Block 6D-F (docs/specs/frames.md §2d): a `frame` needs `clip` (exactly one <circle|ellipse|rect|
// polygon|path …/> with geometry attributes only) and `accent` (#rrggbb), and its svg uses
// `var(--accent)` at least once; `clip`/`accent` on another layer are errors; `covers` only on `bg`,
// only a boolean, and `covers: true` demands a covering first element (a full rect in a fill, or a
// circle r ≥ 50 around the centre); conversely a bg whose first element covers needs `covers: true`. A frame on level 3 is not required (optional layer).
// Warnings: stray keys.

/**
 * The avatar layers in drawing order. Mirrors LAYER_ORDER in src/domain/avatar.ts (6D-3; not imported
 * for the same reason as BADGE_GROUP_IDS, and that module does not exist before 6D-3).
 */
export const AVATAR_LAYERS: readonly string[] = ['bg', 'body', 'pin', 'face', 'facial', 'mouth', 'eyes', 'hair', 'glasses', 'hat', 'prop', 'frame'];
/** Layers an avatar must have. Mirrors REQUIRED_LAYERS in src/domain/avatar.ts (6D-3). */
export const AVATAR_REQUIRED_LAYERS: readonly string[] = ['face', 'eyes', 'mouth', 'body'];
/** Mirrors AVATAR_MAKER_LEVEL in src/domain/avatar.ts: the lowest level a part can unlock at. */
const AVATAR_MIN_LEVEL = 3;
/** Mirrors MAX_LEVEL in src/domain/levels.ts. */
const AVATAR_MAX_LEVEL = 100;
/** The only inline styles a part may carry (the renderer sets --tone and --hair). */
const AVATAR_STYLES: ReadonlySet<string> = new Set(['fill:var(--tone)', 'fill:var(--hair)']);
const AVATAR_PART_KEYS: ReadonlySet<string> = new Set(['id', 'layer', 'nl', 'en', 'unlock', 'rarity', 'svg', 'clip', 'accent', 'covers']);
/** A frame's clip (block 6D-F): one shape element, attributes only, self-closing. */
const AVATAR_CLIP_SHAPE = /^<(circle|ellipse|rect|polygon|path)((?:\s+[a-z-]+="[^"<>]*")*)\s*\/>$/;
/** The only attributes a clip may carry: geometry (no fill, stroke, style, id, transform …). */
const AVATAR_CLIP_ATTRIBUTES: ReadonlySet<string> = new Set(['cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'points', 'd']);
/** Mirrors RARITIES in src/domain/avatar.ts (block 6D-R), in the same order. */
export const AVATAR_RARITIES: readonly string[] = ['common', 'rare', 'epic', 'legendary'];
/** The suffix the renderer replaces with a unique id per drawn avatar. */
const AVATAR_UID = '__u';

/** Problems in one part's SVG fragment (empty list = fine). */
export function checkAvatarSvg(svg: string): string[] {
  const problems: string[] = [];
  if (/<script/i.test(svg)) problems.push('contains "<script"');
  if (/href\s*=/i.test(svg)) problems.push('contains "href="');
  const styles = [...svg.matchAll(/style\s*=\s*(["'])(.*?)\1/gi)];
  const styleCount = (svg.match(/style\s*=/gi) ?? []).length;
  for (const m of styles) if (!AVATAR_STYLES.has(m[2]!)) problems.push(`style=${JSON.stringify(m[2])} is not allowed (only fill:var(--tone) / fill:var(--hair))`);
  if (styleCount !== styles.length) problems.push('has an unquoted style=');
  const ids = new Set<string>();
  for (const m of svg.matchAll(/(?:^|\s)id\s*=\s*(["'])(.*?)\1/g)) {
    const id = m[2]!;
    if (!id.endsWith(AVATAR_UID)) problems.push(`id=${JSON.stringify(id)} does not end with "${AVATAR_UID}"`);
    ids.add(id);
  }
  for (const m of svg.matchAll(/url\(\s*#([^)\s'"]*)\s*\)/g)) {
    const ref = m[1]!;
    if (!ref.endsWith(AVATAR_UID) || !ids.has(ref)) problems.push(`url(#${ref}) does not point at an id="…${AVATAR_UID}" in this svg`);
  }
  return problems;
}

/** Problems in a frame's `clip` (empty list = fine). */
export function checkAvatarClip(clip: string): string[] {
  const m = AVATAR_CLIP_SHAPE.exec(clip);
  if (!m) return ['must be exactly one <circle|ellipse|rect|polygon|path …/> element'];
  const names = [...(m[2] ?? '').matchAll(/([a-z-]+)="/g)].map((a) => a[1]!);
  const problems: string[] = [];
  if (names.length === 0) problems.push('has no geometry attributes');
  for (const name of names) if (!AVATAR_CLIP_ATTRIBUTES.has(name)) problems.push(`attribute ${JSON.stringify(name)} is not allowed (geometry only)`);
  if (new Set(names).size !== names.length) problems.push('repeats an attribute');
  return problems;
}

/**
 * Whether a background's svg starts with an element that covers the whole avatar (block 6D-F §4):
 * `<rect width="100" height="100" fill="…"/>` (x/y absent or 0) or a circle r ≥ 50 around (50, 50),
 * with a fill that is not `none` and no opacity. A simple check on the first element only.
 */
export function coversFirstElement(svg: string): boolean {
  const m = /^\s*<(rect|circle)((?:\s+[a-z-]+="[^"]*")*)\s*\/?>/.exec(svg);
  if (!m) return false;
  const at = new Map([...(m[2] ?? '').matchAll(/([a-z-]+)="([^"]*)"/g)].map((a) => [a[1]!, a[2]!]));
  const fill = at.get('fill');
  if (fill === undefined || fill.trim() === '' || fill.trim() === 'none' || at.has('opacity') || at.has('fill-opacity') || at.has('transform')) return false;
  const num = (k: string, absent: number): number => (at.has(k) ? Number(at.get(k)) : absent);
  if (m[1] === 'rect') return num('x', 0) === 0 && num('y', 0) === 0 && num('width', 0) >= 100 && num('height', 0) >= 100;
  return num('cx', 0) === 50 && num('cy', 0) === 50 && num('r', 0) >= 50;
}

/**
 * Validate data/avatar-parts.json against data/badges.json (both as parsed JSON). Pure: returns
 * errors/warnings. The badge side of the cross-check is here too: a badge's unlock.part that names a
 * part must be named back by that part.
 */
export function validateAvatarParts(data: unknown, badges: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(data)) {
    errors.push('avatar-parts.json: must be an array of parts.');
    return { errors, warnings, stats: { recipes: 0, lines: 0 } };
  }

  const badgeList = Array.isArray(badges) ? badges.filter(isRecord) : [];
  const badgeById = new Map<string, Record<string, unknown>>();
  for (const b of badgeList) if (typeof b['id'] === 'string') badgeById.set(b['id'], b);
  const unlockPart = (b: Record<string, unknown>): unknown => (isRecord(b['unlock']) ? b['unlock']['part'] : undefined);

  const parts = new Map<string, Record<string, unknown>>();
  const level3Layers = new Set<string>();
  data.forEach((part: unknown, index: number) => {
    const where = `avatar-parts.json[${index}]`;
    if (!isRecord(part)) {
      errors.push(`${where}: not an object.`);
      return;
    }
    const id = part['id'];
    const label = typeof id === 'string' && id !== '' ? `avatar-parts.json ${JSON.stringify(id)}` : where;
    if (typeof id !== 'string' || !ID_RE.test(id)) {
      errors.push(`${where}: "id" must be a kebab-case slug (a-z, 0-9, dashes), got ${JSON.stringify(id)}.`);
    } else if (parts.has(id)) {
      errors.push(`${label}: duplicate id.`);
    } else {
      parts.set(id, part);
    }

    const layer = part['layer'];
    if (typeof layer !== 'string' || !AVATAR_LAYERS.includes(layer)) {
      errors.push(`${label}: "layer" must be one of ${AVATAR_LAYERS.join(' | ')}.`);
    } else if (typeof id === 'string' && !id.startsWith(`${layer}-`)) {
      errors.push(`${label}: the id must start with "${layer}-" (its layer).`);
    }

    for (const lang of ['nl', 'en'] as const) {
      const v = part[lang];
      if (typeof v !== 'string' || v.trim() === '') errors.push(`${label}: "${lang}" must be a non-empty string.`);
    }

    const unlock = part['unlock'];
    const hasLevel = isRecord(unlock) && unlock['level'] !== undefined;
    const hasBadge = isRecord(unlock) && unlock['badge'] !== undefined;
    if (!isRecord(unlock) || hasLevel === hasBadge) {
      errors.push(`${label}: "unlock" must be { level } or { badge }.`);
    } else if (hasLevel) {
      const level = unlock['level'];
      if (!isIntIn(level, AVATAR_MIN_LEVEL, AVATAR_MAX_LEVEL)) errors.push(`${label}: unlock.level must be an integer ${AVATAR_MIN_LEVEL}..${AVATAR_MAX_LEVEL}.`);
      else if (level === AVATAR_MIN_LEVEL && typeof layer === 'string') level3Layers.add(layer);
    } else {
      const badgeId = unlock['badge'];
      const badge = typeof badgeId === 'string' ? badgeById.get(badgeId) : undefined;
      if (!badge) errors.push(`${label}: unlock.badge ${JSON.stringify(badgeId)} is not a badge in badges.json.`);
      else if (badge['retired'] === true) errors.push(`${label}: unlock.badge ${JSON.stringify(badgeId)} is retired, so the part could never unlock.`);
      else if (unlockPart(badge) !== id) errors.push(`${label}: badge ${JSON.stringify(badgeId)} does not point back (its unlock.part is ${JSON.stringify(unlockPart(badge))}).`);
    }

    const rarity = part['rarity'];
    if (rarity !== undefined && (typeof rarity !== 'string' || !AVATAR_RARITIES.includes(rarity))) {
      errors.push(`${label}: "rarity" must be one of ${AVATAR_RARITIES.join(' | ')}, got ${JSON.stringify(rarity)}.`);
    }

    const svg = part['svg'];
    if (typeof svg !== 'string') errors.push(`${label}: "svg" must be a string (empty = draws nothing).`);
    else for (const problem of checkAvatarSvg(svg)) errors.push(`${label}: svg ${problem}.`);

    // Block 6D-F: frames (clip, accent, var(--accent)) and covering backgrounds.
    const clip = part['clip'];
    const accent = part['accent'];
    const covers = part['covers'];
    if (layer === 'frame') {
      if (typeof clip !== 'string') errors.push(`${label}: a frame needs "clip" (one SVG shape element).`);
      else for (const problem of checkAvatarClip(clip)) errors.push(`${label}: clip ${problem}.`);
      if (typeof accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(accent)) errors.push(`${label}: a frame needs "accent" as #rrggbb, got ${JSON.stringify(accent)}.`);
      if (typeof svg === 'string' && !svg.includes('var(--accent)')) errors.push(`${label}: a frame's svg must use var(--accent) at least once.`);
    } else {
      if (clip !== undefined) errors.push(`${label}: "clip" is only for layer "frame".`);
      if (accent !== undefined) errors.push(`${label}: "accent" is only for layer "frame".`);
    }
    if (covers !== undefined) {
      if (layer !== 'bg') errors.push(`${label}: "covers" is only for layer "bg".`);
      else if (typeof covers !== 'boolean') errors.push(`${label}: "covers" must be a boolean, got ${JSON.stringify(covers)}.`);
      else if (covers && typeof svg === 'string' && !coversFirstElement(svg)) {
        errors.push(`${label}: "covers": true needs a covering first element (<rect width="100" height="100" fill="…"/> or a circle r 50).`);
      }
    }
    // The reverse rule (decision a): a background whose first element covers the avatar hides the
    // profile colour, so it must say so (the renderer then draws the implicit ring). A covers of the
    // wrong type already has its own error above.
    if (layer === 'bg' && (covers === undefined || covers === false) && typeof svg === 'string' && coversFirstElement(svg)) {
      errors.push(`${label}: its first element covers the profile colour but has no "covers": true.`);
    }

    for (const key of Object.keys(part)) if (!AVATAR_PART_KEYS.has(key)) warnings.push(`${label}: unexpected key ${JSON.stringify(key)}.`);
  });

  // The badge side: a badge that unlocks a known part must be the badge that part names.
  for (const b of badgeList) {
    const partId = unlockPart(b);
    if (typeof partId !== 'string') continue;
    const part = parts.get(partId);
    if (!part) continue; // reported by validateBadges (unlock.part is not in avatar-parts.json)
    const partUnlock = part['unlock'];
    const named = isRecord(partUnlock) ? partUnlock['badge'] : undefined;
    if (named !== b['id']) errors.push(`badges.json ${JSON.stringify(b['id'])}: unlocks part ${JSON.stringify(partId)}, but that part's unlock is ${JSON.stringify(partUnlock)}.`);
  }

  for (const layer of AVATAR_REQUIRED_LAYERS) {
    if (!level3Layers.has(layer)) errors.push(`avatar-parts.json: required layer "${layer}" has no part at level ${AVATAR_MIN_LEVEL}.`);
  }

  return { errors, warnings, stats: { recipes: 0, lines: data.length } };
}

// ---------------------------------------------------------------------------
// Levels: data/levels.json (docs/specs/xp-levels.md §2d, src/domain/levels.ts `LevelTitle`)
// ---------------------------------------------------------------------------
//
// Errors: an array of exactly 100 objects { level, nl: { title, note? }, en: { title, note? } };
// levels 1…100 contiguous and in order; every title a non-empty string, unique per language; a
// `note` when present a non-empty string. Warnings: stray keys.

/** Mirrors MAX_LEVEL in src/domain/levels.ts (not imported: that module imports the JSON itself). */
const LEVELS_COUNT = 100;
const LEVEL_KEYS: ReadonlySet<string> = new Set(['level', 'nl', 'en']);
const LEVEL_TEXT_KEYS: ReadonlySet<string> = new Set(['title', 'note']);

/** Validate data/levels.json. Pure: takes the parsed JSON, returns errors/warnings. */
export function validateLevels(data: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(data)) {
    errors.push('levels.json: must be an array of levels.');
    return { errors, warnings, stats: { recipes: 0, lines: 0 } };
  }
  if (data.length !== LEVELS_COUNT) errors.push(`levels.json: must hold exactly ${LEVELS_COUNT} levels, got ${data.length}.`);

  const seenTitles = { nl: new Map<string, number>(), en: new Map<string, number>() };
  data.forEach((item: unknown, index: number) => {
    const where = `levels.json[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${where}: not an object.`);
      return;
    }
    const level = item['level'];
    const label = typeof level === 'number' ? `levels.json level ${level}` : where;
    if (level !== index + 1) errors.push(`${where}: "level" must be ${index + 1} (levels 1…${LEVELS_COUNT} in order), got ${JSON.stringify(level)}.`);

    for (const lang of ['nl', 'en'] as const) {
      const text = item[lang];
      if (!isRecord(text)) {
        errors.push(`${label}: "${lang}" must be { title, note? }.`);
        continue;
      }
      const title = text['title'];
      if (typeof title !== 'string' || title.trim() === '') {
        errors.push(`${label}: "${lang}.title" must be a non-empty string.`);
      } else {
        const first = seenTitles[lang].get(title.trim());
        if (first !== undefined) errors.push(`${label}: "${lang}.title" ${JSON.stringify(title)} is also the title of level ${first}.`);
        else seenTitles[lang].set(title.trim(), typeof level === 'number' ? level : index + 1);
      }
      const note = text['note'];
      if (note !== undefined && (typeof note !== 'string' || note.trim() === '')) errors.push(`${label}: "${lang}.note" must be a non-empty string when present.`);
      for (const key of Object.keys(text)) if (!LEVEL_TEXT_KEYS.has(key)) warnings.push(`${label}: unexpected key ${JSON.stringify(`${lang}.${key}`)}.`);
    }

    for (const key of Object.keys(item)) if (!LEVEL_KEYS.has(key)) warnings.push(`${label}: unexpected key ${JSON.stringify(key)}.`);
  });

  return { errors, warnings, stats: { recipes: 0, lines: data.length } };
}

// ---------------------------------------------------------------------------
// Unlocks: data/unlocks.json (docs/specs/xp-levels.md §2e, src/domain/unlocks.ts `Unlock`)
// ---------------------------------------------------------------------------
//
// Errors: an array of { id, kind, by, icon, value, nl: { name, description }, en: { name,
// description } }; ids kebab-case and unique; `kind` from UNLOCK_KIND_IDS; `by` either
// { level: integer 2…100 } or { badge: an id from data/badges.json, level?: tier 1…8 }; `icon` and
// `value` non-empty strings; both languages with a non-empty name and description. Warnings: stray
// keys, a badge unlock on a retired badge (it can not be earned any more). Block 6D-S: `rarity`, when
// present, one of common/rare/epic/legendary (an error otherwise).

/** Mirrors UNLOCK_KINDS in src/domain/unlocks.ts (tests/unlocks.test.ts pins that they are equal). */
export const UNLOCK_KIND_IDS: readonly string[] = ['confetti', 'timerSound', 'cookedSound', 'cookFont', 'feature'];
const UNLOCK_KEYS: ReadonlySet<string> = new Set(['id', 'kind', 'by', 'icon', 'value', 'rarity', 'nl', 'en']);
const UNLOCK_TEXT_KEYS: ReadonlySet<string> = new Set(['name', 'description']);
/** A level unlock lies on 2…100: level 1 is where everyone starts, so it would set nothing free. */
const UNLOCK_MIN_LEVEL = 2;

/**
 * Validate data/unlocks.json. Pure: takes the parsed JSON and the badge ids of data/badges.json
 * (`retired` = the ids of retired badges, for a warning), returns errors/warnings.
 */
export function validateUnlocks(data: unknown, badgeIds: Iterable<string>, retired: Iterable<string> = []): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const known = new Set(badgeIds);
  const retiredSet = new Set(retired);

  if (!Array.isArray(data)) {
    errors.push('unlocks.json: must be an array of unlocks.');
    return { errors, warnings, stats: { recipes: 0, lines: 0 } };
  }

  const seen = new Set<string>();
  data.forEach((item: unknown, index: number) => {
    const where = `unlocks.json[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${where}: not an object.`);
      return;
    }
    const id = item['id'];
    const label = typeof id === 'string' && id !== '' ? `unlocks.json "${id}"` : where;
    if (typeof id !== 'string' || !ID_RE.test(id)) {
      errors.push(`${where}: "id" must be a kebab-case string, got ${JSON.stringify(id)}.`);
    } else if (seen.has(id)) {
      errors.push(`${label}: duplicate id.`);
    } else {
      seen.add(id);
    }

    const kind = item['kind'];
    if (typeof kind !== 'string' || !UNLOCK_KIND_IDS.includes(kind)) {
      errors.push(`${label}: "kind" must be one of ${UNLOCK_KIND_IDS.join(', ')}, got ${JSON.stringify(kind)}.`);
    }

    const by = item['by'];
    if (!isRecord(by)) {
      errors.push(`${label}: "by" must be { level } or { badge, level? }.`);
    } else if ('badge' in by) {
      const badge = by['badge'];
      if (typeof badge !== 'string' || !known.has(badge)) {
        errors.push(`${label}: "by.badge" ${JSON.stringify(badge)} is not a badge id in data/badges.json.`);
      } else if (retiredSet.has(badge)) {
        warnings.push(`${label}: "by.badge" "${badge}" is a retired badge (it can not be earned any more).`);
      }
      if (by['level'] !== undefined && !isIntIn(by['level'], 1, BADGE_TIER_COUNT)) {
        errors.push(`${label}: "by.level" on a badge unlock is the badge tier and must be an integer 1…${BADGE_TIER_COUNT}, got ${JSON.stringify(by['level'])}.`);
      }
      for (const key of Object.keys(by)) if (key !== 'badge' && key !== 'level') warnings.push(`${label}: unexpected key ${JSON.stringify(`by.${key}`)}.`);
    } else {
      if (!isIntIn(by['level'], UNLOCK_MIN_LEVEL, LEVELS_COUNT)) {
        errors.push(`${label}: "by.level" must be an integer ${UNLOCK_MIN_LEVEL}…${LEVELS_COUNT}, got ${JSON.stringify(by['level'])}.`);
      }
      for (const key of Object.keys(by)) if (key !== 'level') warnings.push(`${label}: unexpected key ${JSON.stringify(`by.${key}`)}.`);
    }

    for (const field of ['icon', 'value'] as const) {
      const v = item[field];
      if (typeof v !== 'string' || v.trim() === '') errors.push(`${label}: "${field}" must be a non-empty string.`);
    }

    // Block 6D-S (S-B): `rarity`, when present, one of the four (like an avatar part; a missing one
    // falls back to the level/tier rule in src/domain/unlocks.ts `rarityForUnlock`).
    const rarity = item['rarity'];
    if (rarity !== undefined && (typeof rarity !== 'string' || !AVATAR_RARITIES.includes(rarity))) {
      errors.push(`${label}: "rarity" must be one of ${AVATAR_RARITIES.join(' | ')}, got ${JSON.stringify(rarity)}.`);
    }

    for (const lang of ['nl', 'en'] as const) {
      const text = item[lang];
      if (!isRecord(text)) {
        errors.push(`${label}: "${lang}" must be { name, description }.`);
        continue;
      }
      for (const field of ['name', 'description'] as const) {
        const v = text[field];
        if (typeof v !== 'string' || v.trim() === '') errors.push(`${label}: "${lang}.${field}" must be a non-empty string.`);
      }
      for (const key of Object.keys(text)) if (!UNLOCK_TEXT_KEYS.has(key)) warnings.push(`${label}: unexpected key ${JSON.stringify(`${lang}.${key}`)}.`);
    }

    for (const key of Object.keys(item)) if (!UNLOCK_KEYS.has(key)) warnings.push(`${label}: unexpected key ${JSON.stringify(key)}.`);
  });

  return { errors, warnings, stats: { recipes: 0, lines: data.length } };
}

// ---------------------------------------------------------------------------
// Swaps: data/swaps.json (docs/phase-5-spec.md "Block F" item 2, src/domain/variants.ts `Swap`)
// ---------------------------------------------------------------------------
//
// Errors: an array of { from, to, diets, note? }; `from` and `to` are existing ingredient ids and
// differ; `diets` is a non-empty list from SWAP_DIETS without duplicates; the same (from, diet)
// pair occurs once (planVariant takes the first swap it finds, so a second one would be dead data);
// `note` is { nl?, en? } with at least one language; and `to` satisfies every diet it is listed for:
// glutenvrij -> gluten false, vegetarisch -> veg true, vegan -> vegan true, lactosevrij -> lactose
// false. Warnings: a `to` whose gluten / lactose flag is a guess (glutenUnsure / lactoseUnsure) for
// a gluten-free / lactose-free swap, a `from` that does not actually break the diet (the swap can
// never fire), stray keys.

/** The diets a swap may serve (src/domain/variants.ts `VariantDiet`). */
export const SWAP_DIETS: readonly string[] = ['glutenvrij', 'vegetarisch', 'vegan', 'lactosevrij'];

/** The flag on `to` that each diet needs, and the flag on `from` that makes the swap meaningful. */
const SWAP_RULES: Readonly<Record<string, { flag: string; toValue: boolean; fromBreaks: (ing: Record<string, unknown>) => boolean }>> = {
  glutenvrij: { flag: 'gluten', toValue: false, fromBreaks: (ing) => ing['gluten'] === true },
  vegetarisch: { flag: 'veg', toValue: true, fromBreaks: (ing) => ing['veg'] === false },
  vegan: { flag: 'vegan', toValue: true, fromBreaks: (ing) => ing['vegan'] === false || ing['veg'] === false },
  lactosevrij: { flag: 'lactose', toValue: false, fromBreaks: (ing) => ing['lactose'] === true },
};

const SWAP_KEYS: ReadonlySet<string> = new Set(['from', 'to', 'diets', 'note']);

// ---------------------------------------------------------------------------
// data/challenges.json (docs/specs/challenges.md §2 + §3 "Bouwer A", block 6E)
// ---------------------------------------------------------------------------

/** Exactly this many challenges (§2). */
export const CHALLENGE_COUNT = 30;
/** Terms (src/domain/challenges.ts `ChallengeTerm`; mirrored, not imported, like the badge lists). */
export const CHALLENGE_TERMS: readonly string[] = ['week', 'month', 'season'];
/** Rule kinds and the fields each takes besides `kind` (src/domain/challenges.ts `ChallengeRule`). */
export const CHALLENGE_RULE_FIELDS: Readonly<Record<string, readonly string[]>> = {
  cooks: ['n'],
  cooksWithTag: ['tag', 'n'],
  cooksInCategory: ['category', 'n'],
  newCuisines: ['n'],
  newRecipes: ['n'],
  photos: ['n'],
  distinctDays: ['n'],
  categories: ['categories'],
  plannedCooks: ['n'],
};
const CHALLENGE_XP_MIN = 100;
const CHALLENGE_XP_MAX = 2000;
const CHALLENGE_KEYS: ReadonlySet<string> = new Set(['id', 'nl', 'en', 'rule', 'term', 'xp', 'weight', 'icon']);

/**
 * Validate data/challenges.json. Pure: takes the parsed JSON, returns errors/warnings. Errors: not
 * exactly 30, a non-kebab or duplicate id, missing NL/EN name or description, a missing icon, an unknown
 * term or rule kind, a rule field that is missing or wrong (n an integer >= 1, a non-empty categories
 * list, `distinctDays` n >= 2), xp outside 100–2000, weight not 1/2/3; with `refs` also an
 * unknown tag or category id. Warnings: unknown keys, and a rule with `n` whose description lacks `{n}`
 * (§2: "met {n} waar het doel staat").
 */
export function validateChallenges(data: unknown, refs?: DictionaryRefs): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!Array.isArray(data)) {
    errors.push('challenges.json: must be an array of challenges.');
    return { errors, warnings, stats: { recipes: 0, lines: 0 } };
  }
  if (data.length !== CHALLENGE_COUNT) errors.push(`challenges.json: must hold exactly ${CHALLENGE_COUNT} challenges, found ${data.length}.`);

  const seen = new Map<string, number>();
  data.forEach((item: unknown, index: number) => {
    const where = `challenges.json[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${where}: not an object.`);
      return;
    }
    const id = item['id'];
    const label = typeof id === 'string' && id !== '' ? `challenges.json ${JSON.stringify(id)}` : where;
    if (typeof id !== 'string' || !ID_RE.test(id)) {
      errors.push(`${where}: "id" must be a kebab-case slug (a-z, 0-9, dashes), got ${JSON.stringify(id)}.`);
    } else {
      const first = seen.get(id);
      if (first !== undefined) errors.push(`${label}: duplicate id (also challenge #${first}).`);
      else seen.set(id, index);
    }
    for (const key of Object.keys(item)) if (!CHALLENGE_KEYS.has(key)) warnings.push(`${label}: unknown key ${JSON.stringify(key)} is ignored.`);

    for (const lang of ['nl', 'en'] as const) {
      const text = item[lang];
      if (!isRecord(text)) {
        errors.push(`${label}: "${lang}" must be { name, description }.`);
        continue;
      }
      for (const field of ['name', 'description'] as const) {
        const v = text[field];
        if (typeof v !== 'string' || v.trim() === '') errors.push(`${label}: "${lang}.${field}" must be a non-empty string.`);
      }
    }

    const icon = item['icon'];
    if (typeof icon !== 'string' || icon.trim() === '') errors.push(`${label}: "icon" must be a non-empty string.`);

    const term = item['term'];
    if (typeof term !== 'string' || !CHALLENGE_TERMS.includes(term)) errors.push(`${label}: "term" must be one of ${CHALLENGE_TERMS.join(' | ')}.`);

    const xp = item['xp'];
    if (!isIntIn(xp, CHALLENGE_XP_MIN, CHALLENGE_XP_MAX)) errors.push(`${label}: "xp" must be an integer ${CHALLENGE_XP_MIN}..${CHALLENGE_XP_MAX}, got ${JSON.stringify(xp)}.`);
    const weight = item['weight'];
    if (!isIntIn(weight, 1, 3)) errors.push(`${label}: "weight" must be 1, 2 or 3, got ${JSON.stringify(weight)}.`);

    const rule = item['rule'];
    const kinds = Object.keys(CHALLENGE_RULE_FIELDS);
    if (!isRecord(rule) || typeof rule['kind'] !== 'string' || !kinds.includes(rule['kind'])) {
      errors.push(`${label}: "rule.kind" must be one of ${kinds.join(' | ')}.`);
      return;
    }
    const kind = rule['kind'];
    const fields = CHALLENGE_RULE_FIELDS[kind]!;
    for (const key of Object.keys(rule)) if (key !== 'kind' && !fields.includes(key)) warnings.push(`${label}: rule kind "${kind}" takes no ${JSON.stringify(key)}; it is ignored.`);
    if (fields.includes('n') && !isIntIn(rule['n'], 1)) errors.push(`${label}: rule.n must be an integer >= 1 for kind "${kind}".`);
    if (kind === 'distinctDays' && isIntIn(rule['n'], 1) && !isIntIn(rule['n'], 2)) errors.push(`${label}: rule.n must be an integer >= 2 for kind "distinctDays".`);
    if (kind === 'cooksWithTag') {
      const tag = rule['tag'];
      if (typeof tag !== 'string' || tag === '') errors.push(`${label}: rule.tag must be a non-empty tag id.`);
      else if (refs && !refs.tags.has(tag)) errors.push(`${label}: rule.tag ${JSON.stringify(tag)} is not a known tag id.`);
    }
    const categoryIds: unknown[] = [];
    if (kind === 'cooksInCategory') categoryIds.push(rule['category']);
    if (kind === 'categories') {
      const list = rule['categories'];
      if (!Array.isArray(list) || list.length === 0) {
        errors.push(`${label}: rule.categories must be a non-empty array of category ids.`);
      } else {
        if (new Set(list).size !== list.length) errors.push(`${label}: rule.categories has a duplicate id.`);
        categoryIds.push(...list);
      }
    }
    for (const c of categoryIds) {
      if (typeof c !== 'string' || c === '') errors.push(`${label}: a category id must be a non-empty string, got ${JSON.stringify(c)}.`);
      else if (refs && !refs.categories.has(c)) errors.push(`${label}: category ${JSON.stringify(c)} is not a known category id.`);
    }
    if (fields.includes('n')) {
      for (const lang of ['nl', 'en'] as const) {
        const text = item[lang];
        const description = isRecord(text) ? text['description'] : undefined;
        if (typeof description === 'string' && !description.includes('{n}')) warnings.push(`${label}: ${lang}.description has no "{n}" for the goal.`);
      }
    }
  });

  return { errors, warnings, stats: { recipes: 0, lines: data.length } };
}

/**
 * Validate data/swaps.json against the ingredient entries. Pure: takes the parsed JSON and the
 * ingredient list (data/ingredients.json), returns errors/warnings.
 */
export function validateSwaps(data: unknown, ingredients: readonly Record<string, unknown>[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(data)) {
    errors.push('swaps.json: must be an array of swaps.');
    return { errors, warnings, stats: { recipes: 0, lines: 0 } };
  }

  const byId = new Map<string, Record<string, unknown>>();
  for (const ing of ingredients) if (typeof ing['id'] === 'string') byId.set(ing['id'], ing);

  const seenPairs = new Map<string, number>();
  data.forEach((swap: unknown, index: number) => {
    const where = `swaps.json[${index}]`;
    if (!isRecord(swap)) {
      errors.push(`${where}: not an object.`);
      return;
    }
    const from = swap['from'];
    const to = swap['to'];
    const label = typeof from === 'string' && typeof to === 'string' ? `swaps.json ${JSON.stringify(from)} -> ${JSON.stringify(to)}` : where;

    const fromIng = typeof from === 'string' ? byId.get(from) : undefined;
    const toIng = typeof to === 'string' ? byId.get(to) : undefined;
    if (typeof from !== 'string' || from === '') errors.push(`${where}: "from" must be an ingredient id.`);
    else if (!fromIng) errors.push(`${label}: "from" ${JSON.stringify(from)} is not a known ingredient id.`);
    if (typeof to !== 'string' || to === '') errors.push(`${where}: "to" must be an ingredient id.`);
    else if (!toIng) errors.push(`${label}: "to" ${JSON.stringify(to)} is not a known ingredient id.`);
    if (typeof from === 'string' && from === to) errors.push(`${label}: "from" and "to" are the same ingredient.`);

    const diets = swap['diets'];
    if (!isStringArray(diets) || diets.length === 0) {
      errors.push(`${label}: "diets" must be a non-empty array of ${SWAP_DIETS.join(' | ')}.`);
    } else {
      const seenDiet = new Set<string>();
      for (const diet of diets) {
        if (!SWAP_DIETS.includes(diet)) {
          errors.push(`${label}: diet ${JSON.stringify(diet)} is not one of ${SWAP_DIETS.join(', ')}.`);
          continue;
        }
        if (seenDiet.has(diet)) errors.push(`${label}: diet ${JSON.stringify(diet)} is listed twice.`);
        seenDiet.add(diet);
        if (typeof from === 'string') {
          const pairKey = `${from}\u0000${diet}`;
          const first = seenPairs.get(pairKey);
          if (first !== undefined) errors.push(`${label}: a ${diet} swap for ${JSON.stringify(from)} already exists (swaps.json[${first}]); planVariant would never reach this one.`);
          else seenPairs.set(pairKey, index);
        }
        const rule = SWAP_RULES[diet];
        if (!rule) continue;
        if (toIng && toIng[rule.flag] !== rule.toValue) {
          errors.push(`${label}: "to" must have "${rule.flag}": ${rule.toValue} for a ${diet} swap (has ${JSON.stringify(toIng[rule.flag])}).`);
        }
        if (toIng && diet === 'glutenvrij' && toIng['glutenUnsure'] === true) {
          warnings.push(`${label}: "to" is only probably gluten-free (glutenUnsure); the swap note should say "controleer het etiket".`);
        }
        if (toIng && diet === 'lactosevrij' && toIng['lactoseUnsure'] === true) {
          warnings.push(`${label}: "to" is only probably lactose-free (lactoseUnsure); the swap note should say "controleer het etiket".`);
        }
        if (fromIng && !rule.fromBreaks(fromIng)) {
          warnings.push(`${label}: "from" does not break the ${diet} diet by its flags, so this swap can never fire.`);
        }
      }
    }

    const note = swap['note'];
    if (note !== undefined) {
      if (!isTextLike(note) || !(hasText(note, 'nl') || hasText(note, 'en'))) errors.push(`${label}: "note" must be { nl?, en? } with at least one non-empty text.`);
      else if (!(hasText(note, 'nl') && hasText(note, 'en'))) warnings.push(`${label}: "note" has only one language.`);
    }

    for (const key of Object.keys(swap)) if (!SWAP_KEYS.has(key)) warnings.push(`${label}: unexpected key ${JSON.stringify(key)}.`);
  });

  return { errors, warnings, stats: { recipes: 0, lines: data.length } };
}

// ---------------------------------------------------------------------------
// Handbook: data/handbook/<nn>-<id>.json (docs/specs/handbook.md §3, block Z)
// ---------------------------------------------------------------------------
//
// Errors: a file that is not a topic object; a topic id outside the ten fixed topics (§2) or a file
// name that is not `<nn>-<id>.json` with nn = order; `order` not unique or outside 1..10; an empty
// title/intro; an entry id that is not `<topic id>.<kebab-case>` or not unique over all files;
// `title`/`what`/`see` empty in nl or en; `where` not 1–8 steps per language or a different number
// of steps in nl and en; `know` present in one language only; `route` outside HANDBOOK_ROUTES;
// `platform` outside all | android | ios; `keywords` not 3–8 per language; a word from the jargon
// list (§3, both languages). Warnings: a `**name**` that is not literally part of an i18n value of
// that language (src/i18n/*.ts); an unexpected key. The "Markdown older than the data" warning is
// a file-time check in `main()`.

/** The routes a handbook row may open (the Feitencheck routes of the spec without `<id>`). */
export const HANDBOOK_ROUTES: readonly string[] = [
  '/',
  '/recipes',
  '/add',
  '/share',
  '/inbox',
  '/week',
  '/shopping',
  '/more',
  '/more/profiles',
  '/more/profile',
  '/more/storage',
  '/more/check-recipes',
  '/more/household',
  '/more/dictionary',
  '/more/badges',
  '/more/style',
  '/more/calendar',
  '/story',
  '/check',
  '/onboarding',
];

/** Forbidden jargon (§3), checked case-insensitively in both languages. */
export const HANDBOOK_JARGON: readonly string[] = ['service worker', 'standalone', 'token', 'bundle', 'override', 'sheet', 'cache', 'IndexedDB', 'manifest'];

const HANDBOOK_PLATFORMS: ReadonlySet<string> = new Set(['all', 'android', 'ios']);
const HANDBOOK_SECTION_KEYS: ReadonlySet<string> = new Set(['id', 'order', 'title', 'intro', 'entries']);
const HANDBOOK_ENTRY_KEYS: ReadonlySet<string> = new Set(['id', 'title', 'what', 'where', 'see', 'know', 'route', 'platform', 'keywords']);
const HANDBOOK_LANGS = ['nl', 'en'] as const;

function jargonRe(term: string): RegExp {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // "sheet" only as a whole word ("sheet"/"sheets"); the rest anywhere (also inside compounds).
  return term === 'sheet' ? new RegExp('(?<!\\p{L})sheets?(?!\\p{L})', 'iu') : new RegExp(esc, 'i');
}
const JARGON_RES: readonly { term: string; re: RegExp }[] = HANDBOOK_JARGON.map((term) => ({ term, re: jargonRe(term) }));

/** The UI texts per language, for the bold-name check (`readI18nValues` reads them from src/i18n). */
export interface I18nValues {
  nl: readonly string[];
  en: readonly string[];
}

/** One quoted string literal: '…', "…" or a template without interpolation. */
const I18N_VALUE_RE = /\b(nl|en):\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)/g;

/**
 * Every `nl: '…'` / `en: '…'` string literal of the i18n dictionaries (src/i18n/*.ts minus index.ts),
 * read as text: the dictionaries cannot be imported here (index.ts pulls in the signal library).
 */
export function readI18nValues(root: string): I18nValues {
  const dir = join(root, 'src', 'i18n');
  const out = { nl: [] as string[], en: [] as string[] };
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.ts') || name === 'index.ts') continue;
    const src = readFileSync(join(dir, name), 'utf8');
    for (const m of src.matchAll(I18N_VALUE_RE)) {
      const raw = m[2]!.slice(1, -1).replace(/\\(.)/g, (_all, c: string) => (c === 'n' ? '\n' : c));
      out[m[1] as 'nl' | 'en'].push(raw);
    }
  }
  return out;
}

/** The `**…**` names in a text. */
function boldNames(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/\*\*(.+?)\*\*/g)) out.push(m[1]!);
  return out;
}

export interface HandbookFile {
  /** File name, e.g. '02-recepten.json'. */
  file: string;
  data: unknown;
}

/**
 * Validate the handbook files together. Pure: takes the parsed files (and optionally the i18n values
 * for the bold-name warnings), returns errors/warnings. `stats.recipes` = topics, `stats.lines` = rows.
 */
export function validateHandbook(files: readonly HandbookFile[], i18n?: I18nValues): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const entryIds = new Map<string, string>();
  const orders = new Map<number, string>();
  const sectionIds = new Set<string>();
  const warnedNames = new Set<string>();
  let rows = 0;

  const checkJargon = (where: string, lang: string, s: string) => {
    for (const { term, re } of JARGON_RES) if (re.test(s)) errors.push(`${where}.${lang}: forbidden word ${JSON.stringify(term)} (say it in everyday words).`);
  };
  const checkBold = (where: string, lang: 'nl' | 'en', s: string) => {
    if (!i18n) return;
    for (const name of boldNames(s)) {
      const key = `${lang}\u0000${name}`;
      if (warnedNames.has(key)) continue;
      if (i18n[lang].some((v) => v.includes(name))) continue;
      warnedNames.add(key);
      warnings.push(`${where}.${lang}: bold name ${JSON.stringify(name)} is not literally in any ${lang} UI text (src/i18n).`);
    }
  };
  /** A {nl, en} text: both non-empty when present (always required unless `optional`). */
  const checkText = (v: unknown, where: string, optional = false) => {
    if (v === undefined && optional) return;
    if (!isRecord(v)) {
      errors.push(`${where} must be { nl, en }.`);
      return;
    }
    for (const lang of HANDBOOK_LANGS) {
      const s = v[lang];
      if (typeof s !== 'string' || s.trim() === '') errors.push(`${where}.${lang} is missing or empty.`);
      else {
        checkJargon(where, lang, s);
        checkBold(where, lang, s);
      }
    }
  };
  /** A {nl: string[], en: string[]} list with min..max non-empty items per language; returns the counts (-1 = not a list). */
  const checkList = (v: unknown, where: string, min: number, max: number, bold: boolean): number[] => {
    if (!isRecord(v)) {
      errors.push(`${where} must be { nl: [...], en: [...] }.`);
      return [];
    }
    return HANDBOOK_LANGS.map((lang) => {
      const items = v[lang];
      if (!isStringArray(items)) {
        errors.push(`${where}.${lang} must be an array of strings.`);
        return -1;
      }
      if (items.length < min || items.length > max) errors.push(`${where}.${lang} has ${items.length} item(s); ${min}–${max} expected.`);
      items.forEach((s, i) => {
        if (s.trim() === '') errors.push(`${where}.${lang}[${i}] is empty.`);
        checkJargon(`${where}[${i}]`, lang, s);
        if (bold) checkBold(`${where}[${i}]`, lang, s);
      });
      return items.length;
    });
  };

  for (const { file, data } of files) {
    if (!isRecord(data)) {
      errors.push(`${file}: not a topic object.`);
      continue;
    }
    const id = data['id'];
    const order = data['order'];
    if (typeof id !== 'string' || !HANDBOOK_SECTION_IDS.includes(id)) {
      errors.push(`${file}: "id" ${JSON.stringify(id)} is not one of the ten topics (${HANDBOOK_SECTION_IDS.join(', ')}).`);
    } else {
      if (sectionIds.has(id)) errors.push(`${file}: topic id ${JSON.stringify(id)} appears in more than one file.`);
      sectionIds.add(id);
      const expectedOrder = HANDBOOK_SECTION_IDS.indexOf(id) + 1;
      if (order !== expectedOrder) errors.push(`${file}: "order" must be ${expectedOrder} for topic ${JSON.stringify(id)} (has ${JSON.stringify(order)}).`);
      const expectedFile = `${String(expectedOrder).padStart(2, '0')}-${id}.json`;
      if (file !== expectedFile) errors.push(`${file}: file name must be ${expectedFile}.`);
    }
    if (typeof order !== 'number' || !Number.isInteger(order) || order < 1 || order > 10) {
      errors.push(`${file}: "order" must be an integer 1..10.`);
    } else {
      const first = orders.get(order);
      if (first !== undefined) errors.push(`${file}: "order" ${order} is also used by ${first}.`);
      else orders.set(order, file);
    }
    checkText(data['title'], `${file} title`);
    checkText(data['intro'], `${file} intro`);
    for (const key of Object.keys(data)) if (!HANDBOOK_SECTION_KEYS.has(key)) warnings.push(`${file}: unexpected key ${JSON.stringify(key)}.`);

    const entries = data['entries'];
    if (!Array.isArray(entries) || entries.length === 0) {
      errors.push(`${file}: "entries" must be a non-empty array.`);
      continue;
    }
    entries.forEach((entry, i) => {
      rows++;
      if (!isRecord(entry)) {
        errors.push(`${file} entries[${i}]: not an object.`);
        return;
      }
      const eid = entry['id'];
      const at = typeof eid === 'string' ? `${file} ${eid}` : `${file} entries[${i}]`;
      const prefix = typeof id === 'string' ? `${id}.` : '';
      if (typeof eid !== 'string' || !prefix || !eid.startsWith(prefix) || !ID_RE.test(eid.slice(prefix.length))) {
        errors.push(`${at}: "id" must be "${prefix || '<topic>.'}<kebab-case>".`);
      }
      if (typeof eid === 'string') {
        const first = entryIds.get(eid);
        if (first !== undefined) errors.push(`${at}: duplicate id (also in ${first}).`);
        else entryIds.set(eid, file);
      }
      checkText(entry['title'], `${at} title`);
      checkText(entry['what'], `${at} what`);
      checkText(entry['see'], `${at} see`);
      checkText(entry['know'], `${at} know`, true);
      const steps = checkList(entry['where'], `${at} where`, 1, 8, true);
      if (steps.length === 2 && steps[0]! >= 0 && steps[1]! >= 0 && steps[0] !== steps[1]) {
        errors.push(`${at}: "where" has ${steps[0]} step(s) in nl and ${steps[1]} in en; they must be equal.`);
      }
      checkList(entry['keywords'], `${at} keywords`, 3, 8, false);
      const route = entry['route'];
      if (route !== undefined && (typeof route !== 'string' || !HANDBOOK_ROUTES.includes(route))) {
        errors.push(`${at}: "route" ${JSON.stringify(route)} is not one of ${HANDBOOK_ROUTES.join(' ')}.`);
      }
      const platform = entry['platform'];
      if (platform !== undefined && (typeof platform !== 'string' || !HANDBOOK_PLATFORMS.has(platform))) {
        errors.push(`${at}: "platform" must be all | android | ios.`);
      }
      for (const key of Object.keys(entry)) if (!HANDBOOK_ENTRY_KEYS.has(key)) warnings.push(`${at}: unexpected key ${JSON.stringify(key)}.`);
    });
  }

  return { errors, warnings, stats: { recipes: files.length, lines: rows } };
}

/** The topic files of data/handbook (sorted by name), parsed; a file that is not JSON gives a parse error. */
export function readHandbookFiles(root: string): { files: HandbookFile[]; parseErrors: string[] } {
  const dir = join(root, 'data', 'handbook');
  const files: HandbookFile[] = [];
  const parseErrors: string[] = [];
  if (!existsSync(dir)) return { files, parseErrors };
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
    try {
      files.push({ file: name, data: JSON.parse(readFileSync(join(dir, name), 'utf8')) as unknown });
    } catch (e) {
      parseErrors.push(`${name}: not valid JSON (${String(e)}).`);
    }
  }
  return { files, parseErrors };
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function print(title: string, result: ValidationResult, summary: string): void {
  for (const w of result.warnings) console.log(`  warn:  ${w}`);
  for (const e of result.errors) console.log(`  ERROR: ${e}`);
  const status = result.errors.length === 0 ? 'OK' : 'FAIL';
  console.log(`${title}: ${status} — ${summary}, ${result.errors.length} error(s), ${result.warnings.length} warning(s)`);
}

function main(): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  let failed = false;

  const sourceRel = 'data/source/recipes-recepten2.json';
  const source = validateSource(readJson(join(root, sourceRel)));
  print(sourceRel, source, `${source.stats.recipes} recipes, ${source.stats.lines} ingredient lines`);
  if (source.errors.length > 0) failed = true;

  const dictData = readDictionaryData(root);
  const schema2Rel = 'data/recipes.json';
  const schema2Path = join(root, schema2Rel);
  // Parsed once: the side dishes, the badge warnings and the schema-2 check all read it.
  const schema2Data: unknown = existsSync(schema2Path) ? readJson(schema2Path) : undefined;

  // The side dishes (docs/specs/bijgerechten.md §2d). The committed recipes.json already holds the 20
  // after `npm run migrate`, so they are left out of the classics (else every id would "collide").
  // Only the generated side dishes (createdAt SIDES_TIMESTAMP) are dropped, not every recipe whose id is
  // in the sides file: a classic that shares an id with a side dish must stay, so the collision rule fires.
  const sidesRel = 'data/source/bijgerechten.json';
  const sides = readSides(root);
  if (!sides) {
    console.log(`${sidesRel}: not present (side-dish checks skipped).`);
  } else if (schema2Data === undefined) {
    console.log(`${sidesRel}: ${schema2Rel} not present yet (side-dish checks skipped).`);
  } else {
    // Unchecked JSON: count defensively, `checkSides` reports the shape problems.
    const sideList = Array.isArray(sides.recipes) ? sides.recipes : [];
    const committed = (schema2Data as { recipes?: Recipe[] }).recipes ?? [];
    const classics = committed.filter((r) => r.createdAt !== SIDES_TIMESTAMP);
    const errors = checkSides(sides, classics, loadDictionary(dictData));
    const lineCount = sideList.reduce((n, s) => n + (Array.isArray(s?.lines) ? s.lines.length : 0), 0);
    print(sidesRel, { errors, warnings: [], stats: { recipes: sideList.length, lines: lineCount } }, `${sideList.length} side dishes, ${lineCount} lines`);
    if (errors.length > 0) failed = true;
  }

  const dictionary = validateDictionary(dictData);
  print(
    'data/{units,qualifiers,prep-phrases,note-phrases,ingredients,aisles,categories,cuisines}.json',
    dictionary,
    `${dictData.units.length} units, ${dictData.qualifiers.length} qualifiers, ${dictData.prepPhrases.length} prep phrases, ${dictData.notePhrases?.length ?? 0} note phrases, ${dictData.ingredients.length} ingredients, ${dictData.cuisines?.length ?? 0} cuisines`,
  );
  if (dictionary.errors.length > 0) failed = true;

  // Badges (docs/specs/badges-avatar.md §2e) read the avatar library and the classics alongside, the
  // avatar parts (§2f) read the badges back (the unlock cross-check runs both ways).
  const badgesRel = 'data/badges.json';
  const partsRel = 'data/avatar-parts.json';
  const badgesData = readJson(join(root, badgesRel));
  const partsPath = join(root, partsRel);
  const partsData: unknown = existsSync(partsPath) ? readJson(partsPath) : undefined;
  const recipeList = isRecord(schema2Data) && Array.isArray(schema2Data['recipes']) ? (schema2Data['recipes'] as unknown[]) : undefined;
  const classics = recipeList?.filter((r) => isRecord(r) && typeof r['id'] === 'string' && r['id'].startsWith('b:'));
  const badges = validateBadges(badgesData, refsFromData(dictData), { avatarParts: partsData, classics });
  const badgeRows = Array.isArray(badgesData) ? badgesData : [];
  const retiredCount = badgeRows.filter((b) => isRecord(b) && b['retired'] === true).length;
  const hiddenCount = badgeRows.filter((b) => isRecord(b) && b['hidden'] === true && b['retired'] !== true).length;
  print(badgesRel, badges, `${badgeRows.length - retiredCount} badges (${hiddenCount} hidden) + ${retiredCount} retired`);
  if (badges.errors.length > 0) failed = true;

  if (partsData === undefined) {
    console.log(`${partsRel}: not present (avatar checks skipped).`);
  } else {
    const parts = validateAvatarParts(partsData, badgesData);
    print(partsRel, parts, `${parts.stats.lines} avatar parts`);
    if (parts.errors.length > 0) failed = true;
  }

  const levelsRel = 'data/levels.json';
  const levels = validateLevels(readJson(join(root, levelsRel)));
  print(levelsRel, levels, `${levels.stats.lines} levels`);
  if (levels.errors.length > 0) failed = true;

  // Unlocks (docs/specs/xp-levels.md §2e): a badge unlock must name a badge of data/badges.json.
  const unlocksRel = 'data/unlocks.json';
  const badgeIds = badgeRows.filter(isRecord).map((b) => b['id']).filter((id): id is string => typeof id === 'string');
  const retiredIds = badgeRows.filter((b) => isRecord(b) && b['retired'] === true).map((b) => (b as Record<string, unknown>)['id']).filter((id): id is string => typeof id === 'string');
  const unlocks = validateUnlocks(readJson(join(root, unlocksRel)), badgeIds, retiredIds);
  print(unlocksRel, unlocks, `${unlocks.stats.lines} unlocks`);
  if (unlocks.errors.length > 0) failed = true;

  // Challenges (docs/specs/challenges.md §2, 6E): tag and category ids against the dictionary refs.
  const challengesRel = 'data/challenges.json';
  const challengesPath = join(root, challengesRel);
  if (!existsSync(challengesPath)) {
    console.log(`${challengesRel}: not present (challenge checks skipped).`);
  } else {
    const challenges = validateChallenges(readJson(challengesPath), refsFromData(dictData));
    print(challengesRel, challenges, `${challenges.stats.lines} challenges`);
    if (challenges.errors.length > 0) failed = true;
  }

  const swapsRel = 'data/swaps.json';
  const swaps = validateSwaps(readJson(join(root, swapsRel)), dictData.ingredients as unknown as Record<string, unknown>[]);
  print(swapsRel, swaps, `${swaps.stats.lines} swaps`);
  if (swaps.errors.length > 0) failed = true;

  // The handbook (docs/specs/handbook.md §3): the topic files, the bold names against src/i18n, and
  // docs/HANDLEIDING.md + docs/HANDBOOK.md (tools/handbook-md.ts) not older than the newest data file.
  const handbookRel = 'data/handbook/*.json';
  const hb = readHandbookFiles(root);
  if (hb.files.length === 0 && hb.parseErrors.length === 0) {
    console.log(`${handbookRel}: not present (handbook checks skipped).`);
  } else {
    const handbook = validateHandbook(hb.files, readI18nValues(root));
    handbook.errors.unshift(...hb.parseErrors);
    const dataNames = readdirSync(join(root, 'data', 'handbook')).filter((n) => n.endsWith('.json'));
    const newestData = Math.max(...dataNames.map((n) => statSync(join(root, 'data', 'handbook', n)).mtimeMs));
    for (const md of ['docs/HANDLEIDING.md', 'docs/HANDBOOK.md']) {
      const mdPath = join(root, md);
      if (!existsSync(mdPath)) handbook.warnings.push(`${md} is not present; run node --experimental-strip-types tools/handbook-md.ts.`);
      else if (statSync(mdPath).mtimeMs < newestData) handbook.warnings.push(`${md} is older than the newest data/handbook file; run node --experimental-strip-types tools/handbook-md.ts.`);
    }
    print(handbookRel, handbook, `${handbook.stats.recipes} topics, ${handbook.stats.lines} rows`);
    if (handbook.errors.length > 0) failed = true;
  }

  if (schema2Data !== undefined) {
    const schema2 = validateSchema2(schema2Data, refsFromData(dictData));
    const s = schema2.stats;
    print(schema2Rel, schema2, `${s.recipes} recipes (${s.translated ?? 0} with English), ${s.lines} ingredient lines (${s.resolved ?? 0} resolved)`);
    if (schema2.errors.length > 0) failed = true;
  } else {
    console.log(`${schema2Rel}: not present yet (schema-2 checks skipped).`);
  }

  process.exit(failed ? 1 : 0);
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
