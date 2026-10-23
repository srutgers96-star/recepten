// The 20 built-in side dishes (docs/specs/bijgerechten.md §2b/§2c, §6b): the hand-written source
// file data/source/bijgerechten.json, parsed with the real dictionary, turned into recipes by
// tools/sides.ts and guarded by `checkSides`. The source file itself is the fixture.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DIET_TAGS } from '../src/domain/diet';
import { loadDictionary } from '../src/domain/dictionary';
import { builtinId, type Recipe } from '../src/domain/model';
import { parseLine } from '../src/domain/parser';
import { normalizeRecipe, recipeFingerprint } from '../src/domain/recipe-io';
import { findTimers } from '../src/domain/timers';
import { readDictionaryData } from '../tools/build-dictionary-seed.ts';
import { applyDerivedTags } from '../tools/derive-tags.ts';
import { BUILTIN_TIMESTAMP, type RecipesFile } from '../tools/migrate-from-recepten2.ts';
import { checkSides, readSides, SIDE_CATEGORY, SIDES_TIMESTAMP, sideToRecipe, sidesToRecipes, type SidesFile } from '../tools/sides.ts';
import { RECIPE_TAGS } from '../tools/validate-data.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const dict = loadDictionary(readDictionaryData(ROOT));
const FILE = readSides(ROOT) as SidesFile;
/** The 196 classics (the committed file minus anything added later, such as the side dishes themselves). */
const committed = JSON.parse(readFileSync(new URL('../data/recipes.json', import.meta.url), 'utf8')) as RecipesFile;
const CLASSICS: Recipe[] = committed.recipes.filter((r) => r.createdAt === BUILTIN_TIMESTAMP);
const CLASSIC_IDS = new Set(CLASSICS.map((r) => r.id));

/** Ids whose name was changed after the id was fixed (invariant 1: the id stays). Empty now. */
const RENAMED_OK: string[] = [];
/** "<recipe id>: <nl line>" lines the parser may leave unresolved. Empty now; a last resort, each with a `// why`. */
const UNRESOLVED_OK: string[] = [];
/** "<recipe id>: <nl line>" lines whose English parse may resolve to another ingredient. Empty now; each with a `// why`. */
const EN_DIFFERS_OK: string[] = [];
/** Names that are the same in both languages on purpose (§5 point 12). */
const SAME_NAME_OK = ['Coleslaw', 'Tzatziki', 'Guacamole', 'Couscous'];
const NO_TIMER = ['b:groene-salade', 'b:guacamole'];

/**
 * What `applyDerivedTags` sets (§2g "Afgeleide dieetlabels"). §2g was written before the fourth diet
 * (lactosevrij, docs/specs/labels-categorieen.md §2b): that one is derived the same way, so it is in
 * the table too (§5: when the derivation changes, update this table, never the data).
 */
const DERIVED: Record<string, string[]> = {
  'b:stokbrood-met-kruidenboter': ['vegetarisch'],
  'b:knoflookbrood': ['vegetarisch'],
  'b:groene-salade': ['vegetarisch', 'glutenvrij', 'lactosevrij'],
  'b:komkommersalade': ['vegetarisch', 'vegan', 'glutenvrij', 'lactosevrij'],
  'b:tomatensalade': ['vegetarisch', 'vegan', 'glutenvrij', 'lactosevrij'],
  'b:coleslaw': ['vegetarisch', 'glutenvrij'],
  'b:romige-aardappelpuree': ['vegetarisch', 'glutenvrij'],
  'b:gebakken-krieltjes': ['vegetarisch', 'glutenvrij'],
  'b:ovenfrietjes': ['vegetarisch', 'vegan', 'glutenvrij', 'lactosevrij'],
  'b:aardappelpartjes-uit-de-oven': ['vegetarisch', 'vegan', 'glutenvrij', 'lactosevrij'],
  'b:witte-rijst': ['vegetarisch', 'vegan', 'glutenvrij', 'lactosevrij'],
  'b:couscous': ['vegetarisch', 'vegan', 'lactosevrij'],
  'b:gestoomde-broccoli': ['vegetarisch', 'vegan', 'glutenvrij', 'lactosevrij'],
  'b:sperziebonen-met-knoflook': ['vegetarisch', 'vegan', 'glutenvrij', 'lactosevrij'],
  'b:gegrilde-groenten': ['vegetarisch', 'vegan', 'glutenvrij', 'lactosevrij'],
  'b:worteltjes-met-honing': ['vegetarisch', 'glutenvrij'],
  'b:rode-kool-met-appel': ['vegetarisch', 'glutenvrij'],
  'b:tzatziki': ['vegetarisch', 'glutenvrij'],
  'b:guacamole': ['vegetarisch', 'vegan', 'glutenvrij', 'lactosevrij'],
  'b:focaccia-met-rozemarijn': ['vegetarisch', 'vegan', 'lactosevrij'],
};

function isDietTag(t: string): boolean {
  return (DIET_TAGS as readonly string[]).includes(t) || t.endsWith('-optie');
}

/** A deep copy of the real file, changed by `edit`. */
function mutated(edit: (f: SidesFile) => void): SidesFile {
  const copy = JSON.parse(JSON.stringify(FILE)) as SidesFile;
  edit(copy);
  return copy;
}

describe('data/source/bijgerechten.json', () => {
  it('bestand: schema sides-1, 20 recipes with unique, stable b: ids that are not classics', () => {
    expect(FILE).not.toBeNull();
    expect(FILE.schema).toBe('sides-1');
    expect(FILE.recipes).toHaveLength(20);
    const ids = FILE.recipes.map((s) => s.id);
    expect(new Set(ids).size).toBe(20);
    expect(CLASSICS).toHaveLength(196);
    for (const s of FILE.recipes) {
      expect(s.id).toMatch(/^b:[a-z0-9-]+$/);
      expect(CLASSIC_IDS.has(s.id), s.id).toBe(false);
      if (!RENAMED_OK.includes(s.id)) expect(s.id, s.name.nl).toBe(builtinId(s.name.nl));
    }
    // The counts of §6a: 127 ingredient lines (no headers), 66 steps.
    expect(FILE.recipes.reduce((n, s) => n + s.lines.length, 0)).toBe(127);
    expect(FILE.recipes.reduce((n, s) => n + s.steps.length, 0)).toBe(66);
    for (const s of FILE.recipes) for (const l of s.lines) expect(l.nl.trim().endsWith(':'), l.nl).toBe(false);
  });

  it('regels resolven: every line resolves in Dutch with confidence 1, and in English to the same ingredient', () => {
    const unresolved: string[] = [];
    const unsure: string[] = [];
    const differs: string[] = [];
    for (const s of FILE.recipes) {
      for (const l of s.lines) {
        const key = `${s.id}: ${l.nl}`;
        const nl = parseLine(l.nl, dict, 'nl');
        if (nl.ing === null || nl.ing === undefined) {
          if (!UNRESOLVED_OK.includes(key)) unresolved.push(key);
          continue;
        }
        if (nl.confidence !== 1) unsure.push(`${key} (${nl.confidence})`);
        const en = parseLine(l.en, dict, 'en');
        if (en.ing !== nl.ing && !EN_DIFFERS_OK.includes(key)) differs.push(`${key} -> nl ${nl.ing}, en "${l.en}" -> ${en.ing}`);
      }
    }
    expect(unresolved, 'look at the dictionary first; UNRESOLVED_OK is the last resort').toEqual([]);
    expect(unsure).toEqual([]);
    expect(differs, 'look at the dictionary first; EN_DIFFERS_OK is the last resort').toEqual([]);
  });

  it('vorm: goesWith, tags, steps, time and names', () => {
    for (const s of FILE.recipes) {
      expect(s.goesWith.length, s.id).toBeGreaterThanOrEqual(1);
      expect(s.goesWith.length, s.id).toBeLessThanOrEqual(3);
      for (const g of s.goesWith) {
        expect(g, s.id).not.toBe(s.id);
        expect(CLASSIC_IDS.has(g), `${s.id} -> ${g}`).toBe(true);
      }
      for (const t of s.tags) {
        expect(RECIPE_TAGS, `${s.id} tag ${t}`).toContain(t);
        expect(isDietTag(t), `${s.id} tag ${t}`).toBe(false);
      }
      expect(s.steps.length, s.id).toBeGreaterThanOrEqual(3);
      expect(s.steps.length, s.id).toBeLessThanOrEqual(6);
      for (const st of s.steps) {
        expect(st.nl.trim().length, s.id).toBeGreaterThan(0);
        expect(st.en.trim().length, s.id).toBeGreaterThan(0);
      }
      expect(s.time.active, s.id).toBeGreaterThan(0);
      expect(s.time.total, s.id).toBeGreaterThan(0);
      expect(s.time.active, s.id).toBeLessThanOrEqual(s.time.total);
      if (!SAME_NAME_OK.includes(s.name.nl)) expect(s.name.en, s.id).not.toBe(s.name.nl);
    }
    expect(FILE.recipes.filter((s) => s.name.en === s.name.nl).map((s) => s.name.nl).sort()).toEqual([...SAME_NAME_OK].sort());
  });

  it('timers: 18 recipes have a timer, every label is in the Dutch text, the English names the same durations', () => {
    const withTimer: string[] = [];
    for (const s of FILE.recipes) {
      let any = false;
      for (const st of s.steps) {
        const nl = findTimers(st.nl);
        if (nl.length > 0) any = true;
        for (const t of nl) expect(st.nl, s.id).toContain(t.label as string);
        expect(findTimers(st.en).length, `${s.id}: "${st.en}"`).toBe(nl.length);
      }
      if (any) withTimer.push(s.id);
    }
    expect(FILE.recipes.map((s) => s.id).filter((id) => !withTimer.includes(id)).sort()).toEqual([...NO_TIMER].sort());
    expect(withTimer).toHaveLength(18);
  });
});

describe('sidesToRecipes', () => {
  const recipes = sidesToRecipes(FILE, dict);
  const byId = new Map(FILE.recipes.map((s) => [s.id, s]));

  it('gives 20 builtin side dishes, written by a person, without a description', () => {
    expect(recipes).toHaveLength(20);
    expect(recipes.map((r) => r.id)).toEqual(FILE.recipes.map((s) => s.id));
    for (const r of recipes) {
      expect(r.category).toBe('bijgerecht');
      expect(SIDE_CATEGORY).toBe('bijgerecht');
      expect(r.servings).toBe(4);
      expect(r.rev).toBe(1);
      expect(r.origin).toEqual({ kind: 'builtin' });
      expect(r.text).toEqual({ en: 'human' });
      expect(r.createdAt).toBe(SIDES_TIMESTAMP);
      expect(r.updatedAt).toBe(SIDES_TIMESTAMP);
      expect(SIDES_TIMESTAMP).toBe('2026-10-22T00:00:00.000Z');
      expect(r).not.toHaveProperty('description');
      expect(r).not.toHaveProperty('servingTip');
      expect(r.aliases).toEqual([]);
      const s = byId.get(r.id)!;
      expect(r.name).toEqual({ nl: s.name.nl, en: s.name.en });
      expect(r.time).toEqual(s.time);
      expect(r.goesWith).toEqual(s.goesWith);
      expect(r.lines).toHaveLength(s.lines.length);
      r.lines.forEach((l, i) => {
        expect(l.raw).toEqual({ nl: s.lines[i]!.nl, en: s.lines[i]!.en });
        expect(l.kind).toBe('line');
      });
      r.steps.forEach((st, i) => expect(st.text).toEqual({ nl: s.steps[i]!.nl, en: s.steps[i]!.en }));
    }
  });

  it('keeps the key order of §2c', () => {
    expect(Object.keys(recipes[0] as object)).toEqual([
      'schema', 'id', 'rev', 'createdAt', 'updatedAt', 'origin', 'name', 'tags', 'servings', 'time',
      'category', 'lines', 'steps', 'goesWith', 'aliases', 'text',
    ]);
  });

  it('applyDerivedTags adds exactly the diet labels of the table and keeps the tags of the file', () => {
    expect(Object.keys(DERIVED).sort()).toEqual(FILE.recipes.map((s) => s.id).sort());
    for (const r of recipes) {
      const s = byId.get(r.id)!;
      expect(r.tags).toEqual(s.tags);
      const derived = applyDerivedTags(r, dict).tags;
      const want = DERIVED[r.id]!;
      expect(derived, r.id).toEqual([...s.tags, ...DIET_TAGS.filter((t) => want.includes(t))]);
    }
  });

  it('sideToRecipe is the per-recipe step and does not touch the source', () => {
    const before = JSON.stringify(FILE);
    expect(sideToRecipe(FILE.recipes[1]!, dict)).toEqual(recipes[1]);
    expect(JSON.stringify(FILE)).toBe(before);
  });

  it('normalizeRecipe gives every generated recipe back unchanged, with a stable fingerprint', () => {
    for (const r of recipes) {
      const n = normalizeRecipe(JSON.parse(JSON.stringify(r)))!;
      expect(n, r.id).toEqual(r);
      expect(recipeFingerprint(n)).toBe(recipeFingerprint(r));
    }
  });
});

describe('checkSides', () => {
  it('accepts the real file against the classics', () => {
    expect(checkSides(FILE, CLASSICS, dict)).toEqual([]);
  });

  it('refuses each broken case of §2c with an error that names the recipe', () => {
    const first = FILE.recipes[0]!.id;
    const second = FILE.recipes[1]!.id;
    const cases: [string, string, (f: SidesFile) => void][] = [
      ['duplicate id', first, (f) => { f.recipes[1]!.id = first; }],
      ['id of a classic', 'b:erwtensoep', (f) => { f.recipes[1]!.id = 'b:erwtensoep'; }],
      ['id not b:slug', 'B:Knoflook brood', (f) => { f.recipes[1]!.id = 'B:Knoflook brood'; }],
      ['empty name.en', second, (f) => { f.recipes[1]!.name.en = ' '; }],
      ['goesWith empty', second, (f) => { f.recipes[1]!.goesWith = []; }],
      ['goesWith > 3', second, (f) => { f.recipes[1]!.goesWith = [...CLASSICS.slice(0, 4).map((r) => r.id)]; }],
      ['goesWith unknown', second, (f) => { f.recipes[1]!.goesWith = ['b:nope']; }],
      ['goesWith itself', second, (f) => { f.recipes[1]!.goesWith = [second]; }],
      ['diet tag', second, (f) => { f.recipes[1]!.tags = ['snel', 'vegan']; }],
      ['-optie tag', second, (f) => { f.recipes[1]!.tags = ['vega-optie']; }],
      ['unknown tag', second, (f) => { f.recipes[1]!.tags = ['lekker']; }],
      ['line without en', second, (f) => { delete (f.recipes[1]!.lines[0] as Partial<{ en: string }>).en; }],
      ['no lines', second, (f) => { f.recipes[1]!.lines = []; }],
      ['2 steps', second, (f) => { f.recipes[1]!.steps = f.recipes[1]!.steps.slice(0, 2); }],
      ['7 steps', second, (f) => { const st = f.recipes[1]!.steps; f.recipes[1]!.steps = [...st, ...st, ...st].slice(0, 7); }],
      ['step without nl', second, (f) => { f.recipes[1]!.steps[0]!.nl = ''; }],
      ['active > total', second, (f) => { f.recipes[1]!.time = { active: 40, total: 30 }; }],
      ['time 0', second, (f) => { f.recipes[1]!.time = { active: 0, total: 30 }; }],
    ];
    for (const [what, id, edit] of cases) {
      const errors = checkSides(mutated(edit), CLASSICS, dict);
      expect(errors.length, what).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes(id)), `${what}: ${errors.join(' | ')}`).toBe(true);
    }
  });

  it('refuses another schema and a file that is not a sides file', () => {
    const errors = checkSides(mutated((f) => { (f as { schema: string }).schema = 'sides-2'; }), CLASSICS, dict);
    expect(errors).toEqual(['schema must be "sides-1", got "sides-2".']);
    expect(checkSides(null, CLASSICS, dict)).toHaveLength(1);
    expect(checkSides({ schema: 'sides-1' }, CLASSICS, dict)).toEqual(['"recipes" must be an array.']);
  });

  it('with the side dishes themselves among the classics every id collides (why validate-data leaves them out)', () => {
    const withSides = [...CLASSICS, ...sidesToRecipes(FILE, dict)];
    const errors = checkSides(FILE, withSides, dict);
    for (const s of FILE.recipes) expect(errors).toContain(`${s.id}: id is already a classic.`);
  });
});
