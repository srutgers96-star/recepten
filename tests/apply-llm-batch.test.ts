// tools/apply-llm-batch.ts: the batch validator (every refusal of docs/phase-2-spec.md §4) and the
// merge rules (parser first; LLM ing/prep.en only where the parser returned null or was less
// confident; quantities untouched), run in memory on the real recipes.json + dictionary.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadDictionary, type Ingredient } from '../src/domain/dictionary';
import type { Recipe } from '../src/domain/model';
import { applyBatch, checkBatch, formatIngredientsFile, type BatchFile, type BatchRecipe } from '../tools/apply-llm-batch.ts';
import { readDictionaryData } from '../tools/build-dictionary-seed.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const dictData = readDictionaryData(ROOT);
const dict = loadDictionary(dictData);
const { recipes } = JSON.parse(readFileSync(new URL('../data/recipes.json', import.meta.url), 'utf8')) as { recipes: Recipe[] };
const GRATIN = 'b:aardappel-broccoli-gratin';
const gratin = recipes.find((r) => r.id === GRATIN)!;

const NEW_ENTRY: Ingredient = {
  id: 'gratinkaas-test',
  nl: { one: 'gratinkaas' },
  en: { one: 'gratin cheese' },
  aisle: 'kaas',
  defaultUnit: 'g',
  staple: false,
  veg: true,
};

/** A complete, valid answer for the gratin. */
function gratinBatch(overrides: Partial<BatchRecipe> = {}): BatchFile {
  return {
    batch: 99,
    model: 'test',
    at: '2026-09-29',
    recipes: [
      {
        id: GRATIN,
        name: { en: 'Potato and broccoli gratin' },
        description: { nl: 'Ovenschotel.', en: 'A simple oven dish.' },
        category: 'oven',
        tags: ['oven', 'vegetarisch'],
        time: { active: 20, total: 50 },
        steps: gratin.steps.map((_s, i) => ({ en: `Step ${i + 1} in English.` })),
        lines: gratin.lines.map((l, i) => ({ i, ing: l.ing ?? null, qual: l.qual ?? [], prep: l.prep?.nl ? { en: 'test prep' } : undefined, confidence: 0.9 })),
        ...overrides,
      },
    ],
  };
}

function errorsOf(batch: unknown, mode: 'apply' | 'replay' = 'apply'): string[] {
  return checkBatch(batch, recipes, dict, mode).errors;
}

describe('checkBatch', () => {
  it('accepts a complete answer without errors', () => {
    const r = checkBatch(gratinBatch(), recipes, dict);
    expect(r.errors).toEqual([]);
    expect(r.batch?.recipes).toHaveLength(1);
    expect(r.newIngredients).toEqual([]);
  });

  it('refuses an unknown recipe id', () => {
    expect(errorsOf(gratinBatch({ id: 'b:bestaat-niet' })).join('\n')).toContain('does not exist');
  });

  it('refuses when the step counts differ', () => {
    const b = gratinBatch();
    b.recipes[0]!.steps = [...b.recipes[0]!.steps, { en: 'One too many.' }];
    expect(errorsOf(b).join('\n')).toMatch(/steps in the batch.*counts must match/);
  });

  it('refuses a line index out of range and a raw echo that differs', () => {
    const b = gratinBatch();
    b.recipes[0]!.lines.push({ i: gratin.lines.length, ing: 'ui' });
    expect(errorsOf(b).join('\n')).toContain('out of range');
    const c = gratinBatch();
    c.recipes[0]!.lines[0]!.raw = '999 g iets anders';
    expect(errorsOf(c).join('\n')).toContain('differs from the recipe line');
  });

  it('refuses unknown ingredient, qualifier and category ids and tags outside the vocabulary', () => {
    const b = gratinBatch();
    b.recipes[0]!.lines[0]!.ing = 'geen-ingredient';
    expect(errorsOf(b).join('\n')).toContain('is not an ingredient id');
    const c = gratinBatch();
    c.recipes[0]!.lines[0]!.qual = ['paars'];
    expect(errorsOf(c).join('\n')).toContain('qualifier "paars" does not exist');
    expect(errorsOf(gratinBatch({ category: 'dessert' })).join('\n')).toContain('category "dessert" is unknown');
    expect(errorsOf(gratinBatch({ tags: ['lekker'] })).join('\n')).toContain('tag "lekker"');
  });

  it('collects NEW entries, refuses a NEW id that collides with a different entry, and needs them applied before replay', () => {
    const b = gratinBatch();
    b.recipes[0]!.lines[4] = { i: 4, ing: 'NEW', new: NEW_ENTRY, confidence: 0.95 };
    const r = checkBatch(b, recipes, dict, 'apply');
    expect(r.errors).toEqual([]);
    expect(r.newIngredients).toEqual([NEW_ENTRY]);
    expect(errorsOf(b, 'replay').join('\n')).toContain('not in data/ingredients.json yet');

    const collide = gratinBatch();
    collide.recipes[0]!.lines[4] = { i: 4, ing: 'NEW', new: { ...NEW_ENTRY, id: 'ui' } };
    expect(errorsOf(collide).join('\n')).toContain('collides with a different existing ingredient');

    const identical = gratinBatch();
    identical.recipes[0]!.lines[4] = { i: 4, ing: 'NEW', new: dict.get('ui')! };
    const ri = checkBatch(identical, recipes, dict, 'apply');
    expect(ri.errors).toEqual([]);
    expect(ri.newIngredients).toEqual([]);

    const bad = gratinBatch();
    bad.recipes[0]!.lines[4] = { i: 4, ing: 'NEW', new: { ...NEW_ENTRY, aisle: 'nergens', defaultUnit: 'pondje' } };
    const e = errorsOf(bad).join('\n');
    expect(e).toContain('aisle "nergens" does not exist');
    expect(e).toContain('defaultUnit must be null');
  });

  it('refuses a malformed file and a line on a header', () => {
    expect(errorsOf(null)).toHaveLength(1);
    expect(errorsOf({ batch: 1, recipes: 'no' })).toHaveLength(1);
    const withHeader = recipes.find((r) => r.lines.some((l) => l.kind === 'header'))!;
    const hi = withHeader.lines.findIndex((l) => l.kind === 'header');
    const b: BatchFile = {
      batch: 1,
      recipes: [{ id: withHeader.id, name: { en: 'X' }, category: 'overig', steps: withHeader.steps.map(() => ({ en: 'x' })), lines: [{ i: hi, ing: null }] }],
    };
    expect(errorsOf(b).join('\n')).toContain('points at a header line');
  });
});

describe('applyBatch', () => {
  it('sets the English texts, category, tags, time and text.en = llm; keeps raw lines and quantities', () => {
    const batch = gratinBatch();
    const before = JSON.stringify(gratin);
    const { recipes: out, stats } = applyBatch(recipes, batch, dict, []);
    expect(out).toHaveLength(recipes.length);
    expect(out.filter((r) => r !== recipes[recipes.indexOf(r)])).toHaveLength(1);
    const r = out.find((x) => x.id === GRATIN)!;
    expect(r.name).toEqual({ nl: 'Aardappel-broccoli gratin', en: 'Potato and broccoli gratin' });
    expect(r.description).toEqual({ nl: 'Ovenschotel.', en: 'A simple oven dish.' });
    expect(r.category).toBe('oven');
    expect(r.tags).toEqual(['oven', 'vegetarisch']);
    expect(r.time).toEqual({ active: 20, total: 50 });
    expect(r.text).toEqual({ en: 'llm' });
    r.steps.forEach((s, i) => {
      expect(s.text.nl).toBe(gratin.steps[i]!.text.nl);
      expect(s.text.en).toBe(`Step ${i + 1} in English.`);
      expect(s.timers).toEqual(gratin.steps[i]!.timers);
    });
    r.lines.forEach((l, i) => {
      expect(l.raw).toEqual(gratin.lines[i]!.raw);
      expect(l.qty).toEqual(gratin.lines[i]!.qty);
      expect(l.unit).toEqual(gratin.lines[i]!.unit);
    });
    expect(stats.recipes).toBe(1);
    // The parser resolved every gratin line with confidence 1: the LLM (0.9) agrees but never wins.
    expect(stats.linesAgreed).toBe(gratin.lines.length);
    expect(stats.linesFromLlm).toBe(0);
    expect(stats.prepFromLlm).toBe(0);
    // Input untouched (the committed recipes.json is already translated, so compare a snapshot
    // rather than assuming name.en was absent).
    expect(JSON.stringify(gratin)).toBe(before);
  });

  /** The recipe set with the gratin's line 4 ("50 g geraspte oude kaas") replaced by another raw line. */
  function withLine4(raw: string): Recipe[] {
    const changed: Recipe = { ...gratin, lines: gratin.lines.map((l, i) => (i === 4 ? { ...l, raw: { nl: raw } } : l)) };
    return recipes.map((x) => (x.id === GRATIN ? changed : x));
  }

  it('never lets a less or equally confident LLM id replace the parser\'s id', () => {
    const batch = gratinBatch();
    batch.recipes[0]!.lines[0] = { i: 0, ing: 'ui', confidence: 0.5 }; // parser: aardappel @ 1
    batch.recipes[0]!.lines[4] = { i: 4, ing: 'NEW', new: NEW_ENTRY, confidence: 1 }; // parser: kaas @ 1
    const check = checkBatch(batch, recipes, dict, 'apply');
    expect(check.errors).toEqual([]);
    const { recipes: out, dict: fullDict, stats } = applyBatch(recipes, batch, dict, check.newIngredients);
    const r = out.find((x) => x.id === GRATIN)!;
    expect(r.lines[0]!.ing).toBe('aardappel');
    expect(r.lines[4]!.ing).toBe('kaas');
    expect(stats.linesKeptParser).toBe(2);
    expect(fullDict.get('gratinkaas-test')).toEqual(NEW_ENTRY);
  });

  it('re-parses the lines with the NEW entries, so a line naming the new product resolves by itself', () => {
    const set = withLine4('50 g geraspte gratinkaas');
    const batch = gratinBatch();
    batch.recipes[0]!.lines[4] = { i: 4, ing: 'NEW', new: NEW_ENTRY, confidence: 0.9 };
    const check = checkBatch(batch, set, dict, 'apply');
    expect(check.errors).toEqual([]);
    const { recipes: out, stats } = applyBatch(set, batch, dict, check.newIngredients);
    const r = out.find((x) => x.id === GRATIN)!;
    expect(r.lines[4]).toMatchObject({ ing: 'gratinkaas-test', qual: ['geraspte'], raw: { nl: '50 g geraspte gratinkaas' }, qty: { min: 50 }, unit: 'g' });
    expect(stats.linesAgreed).toBe(gratin.lines.length);
  });

  it('fills a genuinely unresolved line with the LLM id, qualifiers and confidence', () => {
    const set = withLine4('50 g iets onbekends');
    const batch = gratinBatch();
    batch.recipes[0]!.lines[4] = { i: 4, ing: 'kaas', qual: ['oude'], confidence: 0.8 };
    expect(checkBatch(batch, set, dict).errors).toEqual([]);
    const { recipes: out, stats } = applyBatch(set, batch, dict, []);
    const r = out.find((x) => x.id === GRATIN)!;
    expect(r.lines[4]).toMatchObject({ ing: 'kaas', qual: ['oude'], confidence: 0.8, raw: { nl: '50 g iets onbekends' }, qty: { min: 50 }, unit: 'g' });
    expect(stats.linesFromLlm).toBe(1);
  });

  it('takes prep.en only for a Dutch prep note the dictionary could not translate', () => {
    const set = withLine4('50 g kaas [heel fijn gesnipperd op een rare manier]');
    const parsed = set.find((x) => x.id === GRATIN)!;
    const batch = gratinBatch();
    batch.recipes[0]!.lines[4] = { i: 4, ing: 'kaas', prep: { en: 'very finely chopped' }, confidence: 0.9 };
    batch.recipes[0]!.lines[0] = { i: 0, ing: 'aardappel', prep: { en: 'thinly sliced' }, confidence: 0.9 }; // parser has "sliced" @ 1
    expect(checkBatch(batch, set, dict).errors).toEqual([]);
    const { recipes: out, stats } = applyBatch(set, batch, dict, []);
    const r = out.find((x) => x.id === GRATIN)!;
    expect(r.lines[0]!.prep).toEqual({ nl: 'plakjes', en: 'sliced' });
    expect(r.lines[4]!.prep).toEqual({ nl: 'heel fijn gesnipperd op een rare manier', en: 'very finely chopped' });
    expect(stats.prepFromLlm).toBe(1);
    expect(parsed.lines[4]!.raw.nl).toContain('[');
  });

  it('formats ingredients.json exactly like the committed file', () => {
    const text = readFileSync(new URL('../data/ingredients.json', import.meta.url), 'utf8');
    expect(formatIngredientsFile(JSON.parse(text))).toBe(text);
    const withNew = formatIngredientsFile([...dictData.ingredients, NEW_ENTRY]);
    expect(withNew).toContain('\n  { "id": "gratinkaas-test", "nl": { "one": "gratinkaas" }, "en": { "one": "gratin cheese" }, "aisle": "kaas", "defaultUnit": "g", "staple": false, "veg": true }');
    expect(withNew.split('\n').length).toBe(text.split('\n').length + 1);
  });
});
