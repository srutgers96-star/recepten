// tools/sides.ts — the 20 built-in side dishes (docs/specs/bijgerechten.md §2b/§2c).
//
// data/source/bijgerechten.json is a hand-written source file (bilingual, written by a person:
// `text.en = 'human'`). `migrate()` (tools/migrate-from-recepten2.ts) reads it as an extra input,
// checks it with `checkSides` (a problem stops the migration, like a broken batch) and appends
// `sidesToRecipes` behind the classics after the review layer and before the recipe labels
// (tools/apply-meta.ts) and the derived diet tags (tools/derive-tags.ts). `npm run migrate` stays
// the only way into data/recipes.json.
//
// Per side dish: the id is an explicit field in the file (never re-derived: CLAUDE.md invariant 1),
// every line is `parseLine(nl, dict, 'nl')` with `raw` holding BOTH languages, every step gets
// `findTimers(nl)`, servings 4, category 'bijgerecht', created at SIDES_TIMESTAMP (deterministic).
// No description, servingTip or author (§5 points 2-3); diet tags are derived, never in `tags`.
// Node 22 type-stripping rules apply: type-only syntax only, plain ESM, no enums/namespaces.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DIET_TAGS } from '../src/domain/diet.ts';
import type { Dictionary } from '../src/domain/dictionary.ts';
import type { Recipe, Step } from '../src/domain/model.ts';
import { parseLine } from '../src/domain/parser.ts';
import { findTimers } from '../src/domain/timers.ts';
// validate-data.ts imports this module, and this module reaches validate-data.ts again (directly and
// through apply-llm-batch.ts): an ESM cycle that is safe because RECIPE_TAGS and readJson are only
// read inside functions, never at load time (checked with migrate, validate:data and vitest).
import { readJson } from './apply-llm-batch.ts';
import { RECIPE_TAGS } from './validate-data.ts';

export interface SideSourceText { nl: string; en: string }           // both required, not empty
export interface SideSource {
  /** 'b:' + slugId(name.nl) at the time of writing. NEVER change it afterwards (invariant 1). */
  id: string;
  name: SideSourceText;
  time: { active: number; total: number };                          // minutes, > 0, active <= total
  /** Subset of RECIPE_TAGS WITHOUT the diet tags: derive-tags sets those. */
  tags: string[];
  /** 1..3 ids of existing classics (main dishes this side dish goes with). */
  goesWith: string[];
  /** Ingredient lines in app format "quantity unit name [prep] (note)"; en = translation. */
  lines: SideSourceText[];
  /** 3..6 short steps; durations like "Kook 12 minuten" (timer detection via findTimers on nl). */
  steps: SideSourceText[];
}
export interface SidesFile { schema: 'sides-1'; author: string; written: string; recipes: SideSource[] }

export const SIDE_CATEGORY = 'bijgerecht';
/** "Second edition": creation date of the 20 (deterministic, like BUILTIN_TIMESTAMP). */
export const SIDES_TIMESTAMP = '2026-10-22T00:00:00.000Z';

const SIDES_REL = ['data', 'source', 'bijgerechten.json'];
const ID_RE = /^b:[a-z0-9-]+$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function filled(v: unknown): boolean {
  return typeof v === 'string' && v.trim() !== '';
}

/** Both languages present and non-empty. */
function isBilingual(v: unknown): boolean {
  return isRecord(v) && filled(v['nl']) && filled(v['en']);
}

/** A diet tag (derived by tools/derive-tags.ts, never written by hand) or any '-optie' tag. */
function isDietTag(tag: string): boolean {
  return (DIET_TAGS as readonly string[]).includes(tag) || tag.endsWith('-optie');
}

/** data/source/bijgerechten.json under `root` (the project folder), null when the file is absent. Throws on malformed JSON. */
export function readSides(root: string): SidesFile | null {
  const path = join(root, ...SIDES_REL);
  if (!existsSync(path)) return null;
  return readJson(path) as SidesFile;
}

/**
 * Validate a sides file against the classics it is added to (`classics` must NOT contain the side
 * dishes themselves, or every id would collide). Pure; returns the errors (empty = the migration may
 * append the side dishes). A line the parser does not resolve is NOT an error here (tests/sides.test.ts
 * guards that, with an exception list), so `dict` is part of the contract of §2c but not consulted.
 */
export function checkSides(file: unknown, classics: readonly Recipe[], dict: Dictionary): string[] {
  void dict;
  const errors: string[] = [];
  if (!isRecord(file)) return ['must be { schema: "sides-1", author, written, recipes }.'];
  if (file['schema'] !== 'sides-1') errors.push(`schema must be "sides-1", got ${JSON.stringify(file['schema'])}.`);
  const recipes = file['recipes'];
  if (!Array.isArray(recipes)) {
    errors.push('"recipes" must be an array.');
    return errors;
  }
  const classicIds = new Set(classics.map((r) => r.id));
  const seen = new Set<string>();
  recipes.forEach((s: unknown, index: number) => {
    if (!isRecord(s)) {
      errors.push(`recipes[${index}]: not an object.`);
      return;
    }
    const id = s['id'];
    const label = typeof id === 'string' && id !== '' ? id : `recipes[${index}]`;

    if (typeof id !== 'string' || !ID_RE.test(id)) errors.push(`${label}: id ${JSON.stringify(id)} must match /^b:[a-z0-9-]+$/.`);
    if (typeof id === 'string') {
      if (seen.has(id)) errors.push(`${label}: duplicate id.`);
      seen.add(id);
      if (classicIds.has(id)) errors.push(`${label}: id is already a classic.`);
    }

    const name = s['name'];
    if (!isRecord(name) || !filled(name['nl'])) errors.push(`${label}: name.nl is empty.`);
    if (!isRecord(name) || !filled(name['en'])) errors.push(`${label}: name.en is empty.`);

    const time = s['time'];
    if (!isRecord(time) || typeof time['active'] !== 'number' || typeof time['total'] !== 'number') {
      errors.push(`${label}: time must be { active, total } in minutes.`);
    } else {
      const { active, total } = time as { active: number; total: number };
      if (!(active > 0) || !(total > 0)) errors.push(`${label}: time.active and time.total must be > 0.`);
      if (active > total) errors.push(`${label}: time.active ${active} > time.total ${total}.`);
    }

    const tags = s['tags'];
    if (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string')) {
      errors.push(`${label}: tags must be an array of strings.`);
    } else {
      for (const t of tags as string[]) {
        if (!RECIPE_TAGS.includes(t)) errors.push(`${label}: tag ${JSON.stringify(t)} is not one of ${RECIPE_TAGS.join(', ')}.`);
        else if (isDietTag(t)) errors.push(`${label}: tag ${JSON.stringify(t)} is a diet tag (derived by tools/derive-tags.ts, never in the source).`);
      }
    }

    const goesWith = s['goesWith'];
    if (!Array.isArray(goesWith) || goesWith.some((g) => typeof g !== 'string')) {
      errors.push(`${label}: goesWith must be an array of recipe ids.`);
    } else {
      if (goesWith.length < 1 || goesWith.length > 3) errors.push(`${label}: goesWith must list 1 to 3 classics, got ${goesWith.length}.`);
      for (const g of goesWith as string[]) {
        if (g === id) errors.push(`${label}: goesWith names the side dish itself.`);
        else if (!classicIds.has(g)) errors.push(`${label}: goesWith id ${JSON.stringify(g)} is not a classic.`);
      }
    }

    const lines = s['lines'];
    if (!Array.isArray(lines) || lines.length < 1) errors.push(`${label}: needs at least 1 ingredient line.`);
    else lines.forEach((l: unknown, i: number) => {
      if (!isBilingual(l)) errors.push(`${label}: lines[${i}] needs a non-empty nl and en.`);
    });

    const steps = s['steps'];
    if (!Array.isArray(steps) || steps.length < 3 || steps.length > 6) {
      errors.push(`${label}: needs 3 to 6 steps, got ${Array.isArray(steps) ? steps.length : JSON.stringify(steps)}.`);
    }
    if (Array.isArray(steps)) steps.forEach((st: unknown, i: number) => {
      if (!isBilingual(st)) errors.push(`${label}: steps[${i}] needs a non-empty nl and en.`);
    });
  });
  return errors;
}

/** One side dish as a schema-2 builtin recipe (§2c, in this key order). */
export function sideToRecipe(s: SideSource, dict: Dictionary): Recipe {
  return {
    schema: 2,
    id: s.id,
    rev: 1,
    createdAt: SIDES_TIMESTAMP,
    updatedAt: SIDES_TIMESTAMP,
    origin: { kind: 'builtin' },
    name: { nl: s.name.nl, en: s.name.en },
    tags: [...s.tags],
    servings: 4,
    time: { active: s.time.active, total: s.time.total },
    category: SIDE_CATEGORY,
    lines: s.lines.map((l) => ({ ...parseLine(l.nl, dict, 'nl'), raw: { nl: l.nl, en: l.en } })),
    steps: s.steps.map((st): Step => {
      const timers = findTimers(st.nl);
      return timers.length ? { text: { nl: st.nl, en: st.en }, timers } : { text: { nl: st.nl, en: st.en } };
    }),
    goesWith: [...s.goesWith],
    aliases: [],
    text: { en: 'human' },
  };
}

/** All side dishes of a (checked) file, in file order. */
export function sidesToRecipes(file: SidesFile, dict: Dictionary): Recipe[] {
  return file.recipes.map((s) => sideToRecipe(s, dict));
}
