// tools/validate-data.ts — data guard for CI and for the local dev loop.
//
// Validates the schema-1 source corpus (data/source/recipes-recepten2.json), the dictionary files
// (data/{units,qualifiers,prep-phrases,ingredients,aisles,categories}.json, docs/phase-2-spec.md §1),
// the generated schema-2 file data/recipes.json (tools/migrate-from-recepten2.ts, §2 + §4:
// dictionary references, `name.en` and every `steps[].text.en` when `text.en` is set, categories,
// tags, units and qualifiers) and the badge list data/badges.json (docs/phase-5-spec.md "Block C").
//
// Run:   node --experimental-strip-types tools/validate-data.ts   (or: npm run validate:data)
// Exit:  1 when any error was found, 0 otherwise. Warnings never fail the run.
//
// Node 22 type-stripping rules apply: type-only syntax only, plain ESM, no enums/namespaces.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { normalizeKey, type DictionaryData } from '../src/domain/dictionary.ts';
import { readDictionaryData } from './build-dictionary-seed.ts';

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
 * tags (PLAN.md §0 "Dieet-categorieën": vegan, glutenvrij and their "-optie" variants).
 */
export const RECIPE_TAGS: readonly string[] = [
  'vegetarisch',
  'vega-optie',
  'vegan',
  'vegan-optie',
  'glutenvrij',
  'glutenvrij-optie',
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
 * Ingredient diet flags (docs/phase-5-spec.md A.1). Required on every entry once ANY entry has
 * them: an error when some entries carry the flag and others do not (a half-merged slice).
 */
export const INGREDIENT_DIET_FLAGS: readonly string[] = ['vegan', 'gluten'];

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
  aisles: ReadonlySet<string>;
  tags: ReadonlySet<string>;
}

export function refsFromData(data: DictionaryData): DictionaryRefs {
  return {
    ingredients: new Set(data.ingredients.map((i) => i.id)),
    units: new Set(data.units.map((u) => u.id)),
    qualifiers: new Set(data.qualifiers.map((q) => q.id)),
    categories: new Set(data.categories.map((c) => c.id)),
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
// alt[]), qualifier and category id exists and tags are a subset of RECIPE_TAGS; when `text.en` is
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
// Dictionary: data/{units,qualifiers,prep-phrases,ingredients,aisles,categories}.json (spec §1)
// ---------------------------------------------------------------------------
//
// Errors: unique slug ids per file, required names, unit groups / qualifier kinds known, `{n}`
// balanced in prep templates, ingredient aisle / defaultUnit / buyUnit / gramsPer keys known,
// staple/veg booleans, vegan/gluten booleans on every entry once any entry has them (phase 5),
// a Dutch name or alias claimed by two ingredients (the parser could only pick one). Warnings:
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

/** Validate the six dictionary files together. Pure: takes the loaded data, returns errors/warnings. */
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
    for (const k of [...INGREDIENT_DIET_FLAGS, 'glutenUnsure', 'perishable']) {
      if (ing[k] !== undefined && typeof ing[k] !== 'boolean') errors.push(`${label}: "${k}" must be a boolean.`);
    }
    if (ing['glutenUnsure'] !== undefined && ing['gluten'] === undefined) errors.push(`${label}: "glutenUnsure" needs a "gluten" flag next to it.`);
    // src/domain/diet.ts treats `gluten: true` as a hard fact and never reads `glutenUnsure` then.
    if (ing['gluten'] === true && ing['glutenUnsure'] === true) errors.push(`${label}: "gluten: true" is a fact; drop "glutenUnsure" or use "gluten": false, "glutenUnsure": true.`);
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
      warnings.push(`ingredients.json: no entry has the "${flag}" flag yet (docs/phase-5-spec.md A.1); diet tags stay "unsure".`);
    }
  }

  return { errors, warnings, stats: { recipes: 0, lines: ingredients.length } };
}

// ---------------------------------------------------------------------------
// Badges: data/badges.json (docs/phase-5-spec.md "Block C", src/domain/badges.ts `Badge`)
// ---------------------------------------------------------------------------
//
// Errors: array of badges with unique kebab-case ids, `nl` and `en` each a non-empty name +
// description, a non-empty icon, a rule whose kind is in the fixed list with an integer n >= 1
// where applicable, category/tag/ingredient rule ids that exist in the dictionary (same ref sets
// as validateSchema2), and tier in {1, 2, 3} when present. Warnings: stray rule fields.

/** Rule kinds that carry `{ n }` only (src/domain/badges.ts `BadgeRule`). */
export const BADGE_COUNT_KINDS: readonly string[] = [
  'cookCount',
  'distinctRecipes',
  'ownRecipes',
  'reviews',
  'oneStar',
  'photos',
  'shared',
  'received',
  'streakWeeks',
];
/** Rule kinds that carry `{ id, n }`, checked against the dictionary refs. */
export const BADGE_REF_KINDS: readonly string[] = ['category', 'tag', 'ingredient'];
/** Rule kinds without fields. */
export const BADGE_BARE_KINDS: readonly string[] = ['letters', 'allClassics', 'halfClassics'];

const ALL_BADGE_KINDS: readonly string[] = [...BADGE_COUNT_KINDS, ...BADGE_REF_KINDS, ...BADGE_BARE_KINDS];

/** Which ref set a ref-kind rule id is checked against. */
const BADGE_REF_SET: Readonly<Record<string, keyof DictionaryRefs>> = {
  category: 'categories',
  tag: 'tags',
  ingredient: 'ingredients',
};

/**
 * Validate data/badges.json. Pure: takes the parsed JSON, returns errors/warnings.
 * With `refs` (see `refsFromData`) category/tag/ingredient rule ids are checked as well.
 */
export function validateBadges(data: unknown, refs?: DictionaryRefs): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(data)) {
    errors.push('badges.json: must be an array of badges.');
    return { errors, warnings, stats: { recipes: 0, lines: 0 } };
  }

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

    const rule = badge['rule'];
    if (!isRecord(rule) || typeof rule['kind'] !== 'string' || !ALL_BADGE_KINDS.includes(rule['kind'])) {
      errors.push(`${label}: "rule.kind" must be one of ${ALL_BADGE_KINDS.join(' | ')}.`);
    } else {
      const kind = rule['kind'];
      const needsN = BADGE_COUNT_KINDS.includes(kind) || BADGE_REF_KINDS.includes(kind);
      if (needsN) {
        const n = rule['n'];
        if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) errors.push(`${label}: rule.n must be an integer >= 1 for kind "${kind}".`);
      } else if (rule['n'] !== undefined || rule['id'] !== undefined) {
        warnings.push(`${label}: rule kind "${kind}" takes no fields; "n"/"id" are ignored.`);
      }
      if (BADGE_REF_KINDS.includes(kind)) {
        const refId = rule['id'];
        if (typeof refId !== 'string' || refId === '') {
          errors.push(`${label}: rule.id must be a non-empty id string for kind "${kind}".`);
        } else if (refs) {
          const refSet = BADGE_REF_SET[kind];
          if (refSet && !refs[refSet].has(refId)) {
            errors.push(`${label}: rule.id ${JSON.stringify(refId)} is not a known ${kind} id.`);
          }
        }
      } else if (BADGE_COUNT_KINDS.includes(kind) && rule['id'] !== undefined) {
        warnings.push(`${label}: rule kind "${kind}" takes no "id"; it is ignored.`);
      }
    }

    const tier = badge['tier'];
    if (tier !== undefined && tier !== 1 && tier !== 2 && tier !== 3) errors.push(`${label}: "tier" must be 1, 2 or 3 when present.`);
  });

  return { errors, warnings, stats: { recipes: 0, lines: data.length } };
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
  const dictionary = validateDictionary(dictData);
  print(
    'data/{units,qualifiers,prep-phrases,note-phrases,ingredients,aisles,categories}.json',
    dictionary,
    `${dictData.units.length} units, ${dictData.qualifiers.length} qualifiers, ${dictData.prepPhrases.length} prep phrases, ${dictData.notePhrases?.length ?? 0} note phrases, ${dictData.ingredients.length} ingredients`,
  );
  if (dictionary.errors.length > 0) failed = true;

  const badgesRel = 'data/badges.json';
  const badges = validateBadges(readJson(join(root, badgesRel)), refsFromData(dictData));
  print(badgesRel, badges, `${badges.stats.lines} badges`);
  if (badges.errors.length > 0) failed = true;

  const schema2Rel = 'data/recipes.json';
  const schema2Path = join(root, schema2Rel);
  if (existsSync(schema2Path)) {
    const schema2 = validateSchema2(readJson(schema2Path), refsFromData(dictData));
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
