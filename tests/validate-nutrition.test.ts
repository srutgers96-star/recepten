// tools/validate-data.ts `validateNutrition` + the gramsPer / gramsPerMl ranges, and tools/apply-nutrition.ts
// (docs/specs/verbeterronde-9.md §1a; the V9b table sources and --from-tables: verbeterronde-9b.md §1a): pure
// calls on small inputs, plus the real data/nutrition.json.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DictionaryData, Ingredient } from '../src/domain/dictionary';
import { readDictionaryData } from '../tools/build-dictionary-seed.ts';
import type { NutritionItem } from '../src/domain/nutrition';
import {
  applyNutritionItems,
  applyTableItems,
  checkMatchFile,
  checkNutritionBatch,
  formatNutritionFile,
  NUTRITION_NOTE,
  sourceRank,
  tableNutritionItem,
  type NutritionBatchItem,
  type NutritionFile,
} from '../tools/apply-nutrition.ts';
import type { TableRow } from '../tools/nutrition-match.ts';
import { checkNutritionItem, isNutritionWarning, nutritionRefs, validateDictionary, validateNutrition } from '../tools/validate-data.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REAL: DictionaryData = readDictionaryData(ROOT);

function ing(id: string, extra: Partial<Ingredient> = {}): Ingredient {
  return { id, nl: { one: id }, en: { one: `${id} (en)` }, aisle: 'overig', defaultUnit: 'stuk', staple: false, veg: true, vegan: true, gluten: false, lactose: false, ...extra };
}

const IDS = new Set(['bloem', 'olijfolie', 'ui', 'wijn', 'wc-papier']);
const NON_FOOD = new Set(['wc-papier']);
const OK_ITEM = { kcal: 364, protein: 10, fat: 1, carbs: 76, fibre: 3, salt: 0 };

function file(items: Record<string, unknown>, extra: Record<string, unknown> = {}): unknown {
  return { schema: 1, per: '100 g', note: { nl: 'n', en: 'e' }, items, ...extra };
}

describe('validateNutrition', () => {
  it('accepts a valid file', () => {
    const r = validateNutrition(file({ bloem: { ...OK_ITEM, source: 'estimate' }, olijfolie: { kcal: 884, protein: 0, fat: 100, carbs: 0, fibre: 0, salt: 0 } }), IDS, NON_FOOD);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.stats.lines).toBe(2);
  });
  it('requires schema 1 and an items object', () => {
    expect(validateNutrition(file({}, { schema: 2 }), IDS, NON_FOOD).errors.join()).toMatch(/schema/);
    expect(validateNutrition({ schema: 1 }, IDS, NON_FOOD).errors.join()).toMatch(/items/);
    expect(validateNutrition([], IDS, NON_FOOD).errors.length).toBe(1);
  });
  it('refuses an unknown id and a non-food id', () => {
    expect(validateNutrition(file({ bestaat: OK_ITEM }), IDS, NON_FOOD).errors.join()).toMatch(/not an ingredient id/);
    expect(validateNutrition(file({ 'wc-papier': OK_ITEM }), IDS, NON_FOOD).errors.join()).toMatch(/non-food/);
  });
  it('requires the six numbers ≥ 0; alcohol optional', () => {
    const { fibre: _f, ...noFibre } = OK_ITEM;
    expect(validateNutrition(file({ bloem: noFibre }), IDS, NON_FOOD).errors.join()).toMatch(/"fibre"/);
    expect(validateNutrition(file({ bloem: { ...OK_ITEM, salt: -1 } }), IDS, NON_FOOD).errors.join()).toMatch(/"salt"/);
    expect(validateNutrition(file({ bloem: { ...OK_ITEM, protein: '10' } }), IDS, NON_FOOD).errors.join()).toMatch(/"protein"/);
    expect(validateNutrition(file({ bloem: { ...OK_ITEM, alcohol: -2 } }), IDS, NON_FOOD).errors.join()).toMatch(/"alcohol"/);
  });
  it('protein + fat + carbs + fibre ≤ 101 and salt ≤ 100', () => {
    expect(checkNutritionItem({ kcal: 420, protein: 30, fat: 0, carbs: 75, fibre: 0, salt: 0 }).join()).toMatch(/more than 101/);
    expect(checkNutritionItem({ kcal: 0, protein: 0, fat: 0, carbs: 0, fibre: 0, salt: 100 })).toEqual([]);
    expect(checkNutritionItem({ kcal: 0, protein: 0, fat: 0, carbs: 0, fibre: 0, salt: 101 }).join()).toMatch(/salt/);
  });
  it('kcal within max(15 %, 20 kcal) of 4·protein + 4·carbs + 9·fat + 7·alcohol', () => {
    // expected 353: 15 % = 52.95
    expect(checkNutritionItem({ ...OK_ITEM, kcal: 405 })).toEqual([]);
    expect(checkNutritionItem({ ...OK_ITEM, kcal: 406 }).join()).toMatch(/kcal 406/);
    expect(checkNutritionItem({ ...OK_ITEM, kcal: 3640 }).join()).toMatch(/kcal/);
    // small values: 20 kcal floor (expected 4)
    expect(checkNutritionItem({ kcal: 24, protein: 1, fat: 0, carbs: 0, fibre: 0, salt: 0 })).toEqual([]);
    expect(checkNutritionItem({ kcal: 25, protein: 1, fat: 0, carbs: 0, fibre: 0, salt: 0 }).join()).toMatch(/kcal/);
    // alcohol counts 7 kcal/g (wine: 10 g alcohol, 2.6 g carbs -> 80.4)
    expect(checkNutritionItem({ kcal: 83, protein: 0.1, fat: 0, carbs: 2.6, fibre: 0, salt: 0, alcohol: 10 })).toEqual([]);
    expect(checkNutritionItem({ kcal: 83, protein: 0.1, fat: 0, carbs: 2.6, fibre: 0, salt: 0 }).join()).toMatch(/kcal/);
  });
  it('source is estimate | nevo | usda', () => {
    for (const source of ['estimate', 'nevo', 'usda']) expect(checkNutritionItem({ ...OK_ITEM, source })).toEqual([]);
    expect(checkNutritionItem({ ...OK_ITEM, source: 'ah' }).join()).toMatch(/source/);
  });
  it('warns when the items are not sorted by id', () => {
    const r = validateNutrition(file({ ui: { kcal: 40, protein: 1.1, fat: 0.1, carbs: 9.3, fibre: 1.7, salt: 0 }, bloem: OK_ITEM }), IDS, NON_FOOD);
    expect(r.errors).toEqual([]);
    expect(r.warnings.join()).toMatch(/sorted/);
  });
  it('the real data/nutrition.json is valid', () => {
    const refs = nutritionRefs(REAL);
    const r = validateNutrition(JSON.parse(readFileSync(`${ROOT}data/nutrition.json`, 'utf8')), refs.ingredientIds, refs.nonFoodIds);
    expect(r.errors).toEqual([]);
  });
});

describe('validateDictionary: gramsPer and gramsPerMl ranges', () => {
  const data = (ingredients: Ingredient[]): DictionaryData => ({ ...REAL, ingredients });
  it('gramsPer in [0.05, 5000]', () => {
    expect(validateDictionary(data([ing('laurier', { gramsPer: { stuk: 0.2 } }), ing('pompoen', { gramsPer: { stuk: 1500 } })])).errors).toEqual([]);
    expect(validateDictionary(data([ing('a', { gramsPer: { stuk: 0.01 } })])).errors.join()).toMatch(/outside/);
    expect(validateDictionary(data([ing('a', { gramsPer: { stuk: 6000 } })])).errors.join()).toMatch(/outside/);
  });
  it('gramsPerMl in [0.05, 2.0]', () => {
    expect(validateDictionary(data([ing('olie', { gramsPerMl: 0.92 }), ing('honing', { gramsPerMl: 1.42 })])).errors).toEqual([]);
    expect(validateDictionary(data([ing('a', { gramsPerMl: 0.04 })])).errors.join()).toMatch(/gramsPerMl/);
    expect(validateDictionary(data([ing('a', { gramsPerMl: 2.5 })])).errors.join()).toMatch(/gramsPerMl/);
    expect(validateDictionary(data([ing('a', { gramsPerMl: '1' as unknown as number })])).errors.join()).toMatch(/gramsPerMl/);
  });
  it('the real dictionary passes', () => {
    expect(validateDictionary(REAL).errors).toEqual([]);
  });
});

describe('apply-nutrition', () => {
  const INGS: Ingredient[] = [
    ing('bloem', { defaultUnit: 'g' }),
    ing('olie', { defaultUnit: 'el', gramsPerMl: 0.9 }),
    ing('prei', { defaultUnit: 'stuk' }),
    ing('knoflook', { defaultUnit: 'teen', buyUnit: 'bol', gramsPer: { bol: 50 } }),
    ing('tijm', { defaultUnit: 'takje', gramsPer: { takje: 1 } }),
    ing('laurier', { defaultUnit: null }),
    ing('kip', { defaultUnit: 'g' }),
    ing('wc-papier', { aisle: 'huishoudelijk' }),
  ];
  const byId = new Map(INGS.map((i) => [i.id, i]));
  const unitIds = new Set(REAL.units.map((u) => u.id));
  const item = (id: string, extra: Partial<NutritionBatchItem> = {}): NutritionBatchItem => ({ id, ...OK_ITEM, ...extra });

  it('refuses unknown, non-food, bad numbers, out-of-range grams and unknown units; the rest goes on', () => {
    const raw = {
      batch: '01',
      items: [
        item('bloem', { gramsPerMl: 0.55 }),
        item('bestaat-niet'),
        item('wc-papier'),
        item('prei', { kcal: 3640 }),
        item('olie', { gramsPerMl: 3 }),
        item('laurier', { pieceGrams: 0.01 }),
        item('tijm', { unitGrams: { tak: 1 } }),
        item('kip', { protein: -1 }),
      ],
    };
    const r = checkNutritionBatch(raw, 'batch-01.json', byId, unitIds);
    expect(r.errors).toEqual([]);
    expect(r.items.map((i) => i.id)).toEqual(['bloem']);
    expect(r.refused.map((x) => x.id)).toEqual(['bestaat-niet', 'wc-papier', 'prei', 'olie', 'laurier', 'tijm', 'kip']);
    expect(r.refused.every((x) => x.file === 'batch-01.json' && x.reason.length > 0)).toBe(true);
  });
  it('refuses a repeated id within one run and a file of the wrong shape', () => {
    const seen = new Map<string, string>();
    checkNutritionBatch({ batch: '01', items: [item('bloem')] }, 'b1', byId, unitIds, seen);
    const r = checkNutritionBatch({ batch: '02', items: [item('bloem')] }, 'b2', byId, unitIds, seen);
    expect(r.refused[0]?.reason).toMatch(/duplicate/);
    expect(checkNutritionBatch({ batch: '03' }, 'b3', byId, unitIds).errors.length).toBe(1);
  });
  it('refuses unitGrams.ml (a density goes in gramsPerMl) and never writes gramsPer.ml when applied directly', () => {
    const r = checkNutritionBatch({ batch: '01', items: [item('bloem', { unitGrams: { ml: 0.55, el: 8 } })] }, 'b1', byId, unitIds);
    expect(r.items).toEqual([]);
    expect(r.refused[0]?.reason).toMatch(/unitGrams\.ml/);
    const nutrition: NutritionFile = { schema: 1, per: '100 g', items: {} };
    const applied = applyNutritionItems(nutrition, INGS, REAL.units, [item('bloem', { unitGrams: { ml: 0.55, el: 8 } })]);
    const bloem = applied.ingredients.find((i) => i.id === 'bloem') as Ingredient;
    expect(bloem.gramsPer).toEqual({ el: 8 });
    expect(applied.stats).toMatchObject({ unitGrams: 1, gramsSkipped: 1 });
  });
  it('applies numbers and gram fields only where missing; replaces only estimates', () => {
    const nutrition: NutritionFile = {
      schema: 1,
      per: '100 g',
      items: { bloem: { ...OK_ITEM, kcal: 350, source: 'estimate' }, olie: { kcal: 884, protein: 0, fat: 100, carbs: 0, fibre: 0, salt: 0, source: 'nevo' } },
    };
    const r = applyNutritionItems(nutrition, INGS, REAL.units, [
      item('bloem', { gramsPerMl: 0.55, protein: 10.04 }),
      item('olie', { gramsPerMl: 0.92 }),
      item('prei', { pieceGrams: 150 }),
      item('knoflook', { pieceGrams: 5, unitGrams: { bol: 60, snuf: 0.5 } }),
      item('tijm', { pieceGrams: 2 }),
      item('laurier', { pieceGrams: 0.2 }),
      item('kip', { pieceGrams: 200 }),
    ]);
    const get = (id: string) => r.ingredients.find((i) => i.id === id) as Ingredient;
    expect(r.nutrition.items['bloem']).toEqual({ ...OK_ITEM, protein: 10, source: 'estimate' });
    expect(r.nutrition.items['olie']?.source).toBe('nevo');
    expect(r.nutrition.items['prei']?.source).toBe('estimate');
    expect(Object.keys(r.nutrition.items)).toEqual([...Object.keys(r.nutrition.items)].sort());
    expect(get('bloem').gramsPerMl).toBe(0.55);
    expect(get('bloem').gramsPer).toBeUndefined();
    expect(get('olie').gramsPerMl).toBe(0.9); // existing density kept
    expect(get('prei').gramsPer).toEqual({ stuk: 150 });
    expect(get('knoflook').gramsPer).toEqual({ bol: 50, teen: 5, snuf: 0.5 }); // bol kept
    expect(get('tijm').gramsPer).toEqual({ takje: 1 }); // takje kept
    expect(get('laurier').gramsPer).toEqual({ stuk: 0.2 }); // defaultUnit null -> stuk
    expect(get('kip').gramsPer).toBeUndefined(); // defaultUnit g is not a count unit
    expect(r.stats).toMatchObject({ nutritionAdded: 5, nutritionReplaced: 1, nutritionKept: 1, gramsPerMl: 1, pieceGrams: 3, unitGrams: 1 });
    // gramsPerMl sits next to the other unit fields, not at the end of the entry
    expect(Object.keys(get('bloem')).indexOf('gramsPerMl')).toBe(Object.keys(get('bloem')).indexOf('defaultUnit') + 1);
    expect(Object.keys(get('prei')).indexOf('gramsPer')).toBe(Object.keys(get('prei')).indexOf('defaultUnit') + 1);
    // never gramsPer.ml
    for (const i of r.ingredients) expect(i.gramsPer?.['ml']).toBeUndefined();
  });
  it('writes data/nutrition.json one item per line, and round-trips the committed file', () => {
    const text = formatNutritionFile({ schema: 1, per: '100 g', items: { ui: { kcal: 40, protein: 1.1, fat: 0.1, carbs: 9.3, fibre: 1.7, salt: 0, source: 'estimate' }, bloem: { ...OK_ITEM } } });
    expect(text).toBe(
      '{\n  "schema": 1,\n  "per": "100 g",\n  "items": {\n' +
        '    "bloem": { "kcal": 364, "protein": 10, "fat": 1, "carbs": 76, "fibre": 3, "salt": 0 },\n' +
        '    "ui": { "kcal": 40, "protein": 1.1, "fat": 0.1, "carbs": 9.3, "fibre": 1.7, "salt": 0, "source": "estimate" }\n  }\n}\n',
    );
    const committed = readFileSync(`${ROOT}data/nutrition.json`, 'utf8').replace(/\r\n/g, '\n');
    expect(formatNutritionFile(JSON.parse(committed) as NutritionFile)).toBe(committed);
  });
});

describe('V9b: table sources (docs/specs/verbeterronde-9b.md §1a)', () => {
  const USDA_ITEM = { kcal: 40, protein: 1.1, fat: 0.1, carbs: 7.6, fibre: 1.7, salt: 0, source: 'usda', ref: '170000' };
  it('kcal deviation: warning for usda / nevo, error for estimate or no source', () => {
    const off = { ...OK_ITEM, kcal: 450 };
    const usda = checkNutritionItem({ ...off, source: 'usda', ref: '1' });
    expect(usda).toHaveLength(1);
    expect(isNutritionWarning(usda[0] as string)).toBe(true);
    expect(isNutritionWarning(checkNutritionItem({ ...off, source: 'nevo', ref: '1' })[0] as string)).toBe(true);
    for (const p of [checkNutritionItem({ ...off, source: 'estimate' }), checkNutritionItem(off)]) {
      expect(p).toHaveLength(1);
      expect(isNutritionWarning(p[0] as string)).toBe(false);
    }
    const r = validateNutrition(file({ bloem: { ...off, source: 'usda', ref: '1' }, ui: { ...off, source: 'estimate' } }), IDS, NON_FOOD);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/"ui".*kcal/);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/"bloem".*kcal 450/);
    expect(r.warnings[0]).not.toMatch(/warn:/);
  });
  it('ref: a string of 1–16 characters, only with a table source', () => {
    expect(checkNutritionItem(USDA_ITEM)).toEqual([]);
    expect(checkNutritionItem({ ...USDA_ITEM, source: 'nevo', ref: '1234' })).toEqual([]);
    expect(checkNutritionItem({ ...USDA_ITEM, ref: '' }).join()).toMatch(/ref/);
    expect(checkNutritionItem({ ...USDA_ITEM, ref: 'x'.repeat(17) }).join()).toMatch(/ref/);
    expect(checkNutritionItem({ ...USDA_ITEM, ref: 170000 }).join()).toMatch(/ref/);
    expect(checkNutritionItem({ ...USDA_ITEM, source: 'estimate' }).join()).toMatch(/ref.*table source/);
    const { source: _s, ...noSource } = USDA_ITEM;
    expect(checkNutritionItem(noSource).join()).toMatch(/ref.*table source/);
    // the other rules stay errors for a table source
    const heavy = checkNutritionItem({ ...USDA_ITEM, protein: 60, carbs: 60 }).find((p) => /101/.test(p));
    expect(heavy).toBeDefined();
    expect(isNutritionWarning(heavy as string)).toBe(false);
  });
});

describe('V9b: apply-nutrition --from-tables', () => {
  const INGS = new Map(
    [ing('ui'), ing('bloem'), ing('olijfolie'), ing('wijn'), ing('rookworst'), ing('wc-papier', { aisle: 'huishoudelijk' })].map((i) => [i.id, i] as const),
  );
  const row = (code: string, extra: Partial<TableRow> = {}): TableRow => ({
    code,
    name: `row ${code}`,
    name2: '',
    category: 'c',
    kcal: 40,
    protein: 1.1,
    fat: 0.1,
    carbs: 9.34,
    fibre: 1.7,
    sodium_mg: 4,
    alcohol: null,
    state: 'raw',
    ...extra,
  });

  it('USDA carbs minus fibre, salt from sodium × 2.5 / 1000, one decimal, source and ref', () => {
    const r = tableNutritionItem(row('170000', { sodium_mg: 393 }), 'usda');
    expect(r.reasons).toEqual([]);
    expect(r.notes).toEqual([]);
    expect(r.item).toEqual({ kcal: 40, protein: 1.1, fat: 0.1, carbs: 7.6, fibre: 1.7, salt: 1, source: 'usda', ref: '170000' });
    expect(tableNutritionItem(row('1', { sodium_mg: 1000 }), 'usda').item?.salt).toBe(2.5);
    // carbs never below 0
    expect(tableNutritionItem(row('1', { carbs: 1, fibre: 3 }), 'usda').item?.carbs).toBe(0);
    // NEVO is taken as it is (its carbs already exclude fibre)
    expect(tableNutritionItem(row('1'), 'nevo').item).toMatchObject({ carbs: 9.3, fibre: 1.7, source: 'nevo', ref: '1' });
  });
  it('kcal from the macros when the table has none; missing fibre or sodium -> 0 with a note', () => {
    const r = tableNutritionItem(row('9', { kcal: null, protein: 10, fat: 1, carbs: 76, fibre: null, sodium_mg: null, alcohol: 0 }), 'usda');
    // 4·10 + 4·76 + 9·1 = 353
    expect(r.item).toMatchObject({ kcal: 353, carbs: 76, fibre: 0, salt: 0 });
    expect(r.notes.join()).toMatch(/fibre/);
    expect(r.notes.join()).toMatch(/sodium/);
    expect(r.notes.join()).toMatch(/kcal/);
    // alcohol counts 7 kcal/g and is kept
    expect(tableNutritionItem(row('w', { kcal: null, protein: 0, fat: 0, carbs: 2.6, fibre: 0, alcohol: 10 }), 'usda').item).toMatchObject({ kcal: 80.4, alcohol: 10 });
  });
  it('a table kcal that deviates from the macros is kept (only a validator warning)', () => {
    expect(tableNutritionItem(row('1', { kcal: 80 }), 'usda').item?.kcal).toBe(80);
  });
  it('refuses a negative value and more than 101 g after the conversion', () => {
    expect(tableNutritionItem(row('1', { fat: -1 }), 'usda').reasons.join()).toMatch(/negative/);
    expect(tableNutritionItem(row('1', { protein: 50, fat: 40, carbs: 20, fibre: 0 }), 'nevo').reasons.join()).toMatch(/101/);
  });
  it('checks the answers: code not in the table, unknown or non-food id, none, sure/close without choice, duplicates', () => {
    const table = new Map([row('170000'), row('2')].map((r) => [r.code, r] as const));
    const raw = {
      batch: '01',
      source: 'usda',
      items: [
        { id: 'ui', choice: '170000', confidence: 'sure', why: 'same' },
        { id: 'bloem', choice: '2', confidence: 'close', why: 'family' },
        { id: 'rookworst', choice: null, confidence: 'none', why: 'no smoked sausage' },
        { id: 'wijn', choice: '999', confidence: 'sure', why: '' },
        { id: 'bestaat-niet', choice: '2', confidence: 'sure', why: '' },
        { id: 'wc-papier', choice: '2', confidence: 'sure', why: '' },
        { id: 'olijfolie', choice: null, confidence: 'close', why: '' },
        { id: 'ui', choice: '2', confidence: 'sure', why: 'again' },
      ],
    };
    const r = checkMatchFile(raw, 'match-usda-01.json', 'usda', table, INGS);
    expect(r.errors).toEqual([]);
    expect(r.items.map((i) => [i.id, i.confidence, i.item.ref])).toEqual([
      ['ui', 'sure', '170000'],
      ['bloem', 'close', '2'],
    ]);
    expect(r.none).toBe(1);
    expect(r.refused.map((x) => x.id)).toEqual(['wijn', 'bestaat-niet', 'wc-papier', 'olijfolie', 'ui']);
    expect(r.refused[0]?.reason).toMatch(/not in the usda table/);
    expect(checkMatchFile({ batch: '01', source: 'nevo', items: [] }, 'f', 'usda', table, INGS).errors.length).toBe(1);
  });
  it('rank: estimate -> usda replaces, usda -> estimate does not, nevo over usda does; repeating changes nothing', () => {
    const est: NutritionItem = { ...OK_ITEM, source: 'estimate' };
    const usda = tableNutritionItem(row('170000'), 'usda').item as NutritionItem;
    const nevo = tableNutritionItem(row('1234'), 'nevo').item as NutritionItem;
    const start: NutritionFile = { schema: 1, per: '100 g', note: { nl: 'oud', en: 'old' }, items: { ui: est, bloem: usda, olijfolie: nevo } };
    const r = applyTableItems(start, [
      { id: 'ui', item: usda },
      { id: 'bloem', item: nevo },
      { id: 'olijfolie', item: usda },
      { id: 'wijn', item: usda },
    ]);
    expect(r.nutrition.items['ui']).toEqual(usda);
    expect(r.nutrition.items['bloem']).toEqual(nevo);
    expect(r.nutrition.items['olijfolie']).toEqual(nevo); // nevo kept over usda
    expect(r.stats).toMatchObject({ replaced: 2, added: 1, kept: 1, perSource: { usda: 2, nevo: 2 } });
    expect(sourceRank('estimate')).toBeLessThan(sourceRank('usda'));
    expect(sourceRank(undefined)).toBe(sourceRank('estimate'));
    expect(sourceRank('usda')).toBeLessThan(sourceRank('nevo'));
    // an estimate does not replace a usda item
    expect(applyTableItems(r.nutrition, [{ id: 'ui', item: est }]).nutrition.items['ui']).toEqual(usda);
    // the note becomes the V9b text; the same run again changes nothing
    expect(r.nutrition.note).toEqual(NUTRITION_NOTE);
    const again = applyTableItems(r.nutrition, [{ id: 'ui', item: usda }]);
    expect(formatNutritionFile(again.nutrition)).toBe(formatNutritionFile(r.nutrition));
    // ref is written after source, one item per line; the result passes the validator
    expect(formatNutritionFile(r.nutrition)).toContain(
      '"ui": { "kcal": 40, "protein": 1.1, "fat": 0.1, "carbs": 7.6, "fibre": 1.7, "salt": 0, "source": "usda", "ref": "170000" }',
    );
    expect(validateNutrition(r.nutrition, IDS, NON_FOOD).errors).toEqual([]);
  });
});
