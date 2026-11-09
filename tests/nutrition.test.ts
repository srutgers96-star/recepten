// src/domain/nutrition.ts (docs/specs/verbeterronde-9.md §1a): grams per line for every unit group, the
// midpoint of a range, "klontje boter" = 1 klont, a missing density, unknown and header lines, the pinch
// defaults, rounding and the coverage. A tiny dictionary over the real units.json.
import { describe, expect, it } from 'vitest';
import { loadDictionary, type Ingredient } from '../src/domain/dictionary';
import { defaultDictionaryData } from '../src/domain/data';
import type { Line } from '../src/domain/model';
import {
  KCAL_ROUND,
  lineGrams,
  lineQty,
  NON_FOOD_AISLES,
  NUTRITION_MIN_COVERAGE,
  PINCH_GRAMS,
  recipeNutrition,
  roundNutrients,
  type NutritionTable,
} from '../src/domain/nutrition';

function ing(id: string, defaultUnit: string | null, extra: Partial<Ingredient> = {}): Ingredient {
  return { id, nl: { one: id }, en: { one: id }, aisle: 'overig', defaultUnit, staple: false, veg: true, ...extra };
}

const INGS: Ingredient[] = [
  ing('bloem', 'g', { gramsPerMl: 0.55 }),
  ing('olie', 'el', { gramsPerMl: 0.92 }),
  ing('melk', 'ml'),
  ing('ui', 'stuk', { gramsPer: { stuk: 120 } }),
  ing('prei', 'stuk'),
  ing('kipfilet', 'g', { gramsPer: { stuk: 200 } }),
  ing('knoflook', 'teen', { gramsPer: { teen: 5, bol: 50 } }),
  ing('boter', 'g', { gramsPer: { el: 15, klont: 20 } }),
  ing('mais', 'blik', { gramsPer: { blik: 285 } }),
  ing('tomatenblokjes', 'blik'),
  ing('gember', 'cm'),
  ing('tijm', 'takje'),
  ing('zout', 'tl'),
  ing('cayennepeper', 'tl'),
  ing('bakpapier', 'stuk', { aisle: 'huishoudelijk' }),
];

const dict = loadDictionary({ ...defaultDictionaryData(), ingredients: INGS });

function line(ingId: string | null, qty?: number | [number, number] | null, unit?: string | null, extra: Partial<Line> = {}): Line {
  const q = qty === undefined || qty === null ? null : Array.isArray(qty) ? { min: qty[0], max: qty[1] } : { min: qty };
  return { raw: { nl: 'x', en: '' }, qty: q, unit: unit ?? null, ing: ingId, ...extra };
}

const TABLE: NutritionTable = {
  bloem: { kcal: 364, protein: 10, fat: 1, carbs: 76, fibre: 3, salt: 0 },
  ui: { kcal: 40, protein: 1.1, fat: 0.1, carbs: 9.3, fibre: 1.7, salt: 0 },
  olie: { kcal: 884, protein: 0, fat: 100, carbs: 0, fibre: 0, salt: 0 },
  zout: { kcal: 0, protein: 0, fat: 0, carbs: 0, fibre: 0, salt: 100 },
  melk: { kcal: 64, protein: 3.4, fat: 3.6, carbs: 4.7, fibre: 0, salt: 0.1 },
};

describe('constants', () => {
  it('match the spec', () => {
    expect(NON_FOOD_AISLES.has('huishoudelijk')).toBe(true);
    expect(NON_FOOD_AISLES.has('drogisterij')).toBe(true);
    expect(PINCH_GRAMS).toEqual({ snuf: 0.3, mp: 0.5, scheut: 10, klont: 15, druppel: 0.05 });
    expect(NUTRITION_MIN_COVERAGE).toBe(0.5);
    expect(KCAL_ROUND).toBe(10);
  });
});

describe('lineQty', () => {
  it('takes the number, or the midpoint of a range', () => {
    expect(lineQty(line('ui', 2), dict.get('ui'))).toBe(2);
    expect(lineQty(line('ui', [2, 3]), dict.get('ui'))).toBe(2.5);
  });
  it('counts a unit with a known weight and no number as 1', () => {
    expect(lineQty(line('boter', null, 'klont'), dict.get('boter'))).toBe(1);
    expect(lineQty(line('zout', null, 'snuf'), dict.get('zout'))).toBe(1);
  });
  it('is null without a number and without a known unit weight', () => {
    expect(lineQty(line('zout'), dict.get('zout'))).toBeNull();
    expect(lineQty(line('tijm', null, 'takje'), dict.get('tijm'))).toBeNull();
    expect(lineQty(line('x', null, null, { kind: 'header' }), undefined)).toBeNull();
  });
});

describe('lineGrams per unit group', () => {
  it('mass: qty × unit.g', () => {
    expect(lineGrams(line('bloem', 200, 'g'), dict)).toBe(200);
    expect(lineGrams(line('bloem', 0.5, 'kg'), dict)).toBe(500);
  });
  it('volume: qty × ml × gramsPerMl', () => {
    expect(lineGrams(line('olie', 2, 'el'), dict)).toBeCloseTo(27.6);
    expect(lineGrams(line('bloem', 1, 'dl'), dict)).toBeCloseTo(55);
  });
  it('volume without a density -> null', () => {
    expect(lineGrams(line('melk', 250, 'ml'), dict)).toBeNull();
  });
  it('a number without a unit counts pieces (gramsPer.stuk)', () => {
    expect(lineGrams(line('ui', 2), dict)).toBe(240);
    expect(lineGrams(line('kipfilet', 2), dict)).toBe(400);
    expect(lineGrams(line('prei', 1), dict)).toBeNull();
  });
  it('a number without a unit keeps a count default unit ("2 knoflook" = 2 teentjes)', () => {
    expect(lineGrams(line('knoflook', 2), dict)).toBe(10);
  });
  it('an explicit "stuk" falls back to the weight of a count default unit', () => {
    expect(lineGrams(line('knoflook', 3, 'stuk'), dict)).toBe(15);
  });
  it('gramsPer wins for any unit (spoon, package, count)', () => {
    expect(lineGrams(line('boter', 2, 'el'), dict)).toBe(30);
    expect(lineGrams(line('mais', 1, 'blik'), dict)).toBe(285);
    expect(lineGrams(line('knoflook', 1, 'bol'), dict)).toBe(50);
  });
  it('count / package / length without gramsPer -> null', () => {
    expect(lineGrams(line('tijm', 2, 'takje'), dict)).toBeNull();
    expect(lineGrams(line('tomatenblokjes', 1, 'blik'), dict)).toBeNull();
    expect(lineGrams(line('gember', 2, 'cm'), dict)).toBeNull();
  });
  it('pinch: the PINCH_GRAMS default, unless gramsPer knows the unit', () => {
    expect(lineGrams(line('zout', null, 'snuf'), dict)).toBeCloseTo(0.3);
    expect(lineGrams(line('cayennepeper', 2, 'mp'), dict)).toBeCloseTo(1);
    expect(lineGrams(line('olie', 1, 'scheut'), dict)).toBe(10);
    // "klontje boter" = 1 klont, and the dictionary's 20 g beats the 15 g default.
    expect(lineGrams(line('boter', null, 'klont'), dict)).toBe(20);
  });
  it('the midpoint of a range', () => {
    expect(lineGrams(line('ui', [2, 3]), dict)).toBe(300);
  });
  it('header, unknown ingredient, free text -> null', () => {
    expect(lineGrams(line('bloem', 200, 'g', { kind: 'header' }), dict)).toBeNull();
    expect(lineGrams(line('bestaat-niet', 200, 'g'), dict)).toBeNull();
    expect(lineGrams(line(null, 200, 'g'), dict)).toBeNull();
  });
});

describe('recipeNutrition', () => {
  it('sums grams/100 × item and divides by servings', () => {
    // 200 g bloem + 2 ui (240 g) + 2 el olie (27.6 g), 4 servings.
    const n = recipeNutrition([line('bloem', 200, 'g'), line('ui', 2), line('olie', 2, 'el')], 4, dict, TABLE);
    expect(n.counted).toBe(3);
    expect(n.total).toBe(3);
    expect(n.coverage).toBe(1);
    const kcal = (2 * 364 + 2.4 * 40 + 0.276 * 884) / 4;
    expect(n.perServing?.kcal).toBeCloseTo(kcal);
    expect(n.perServing?.carbs).toBeCloseTo((2 * 76 + 2.4 * 9.3) / 4);
  });
  it('a missing density does not count but stays in total', () => {
    const n = recipeNutrition([line('bloem', 200, 'g'), line('melk', 250, 'ml')], 2, dict, TABLE);
    expect(n.counted).toBe(1);
    expect(n.total).toBe(2);
    expect(n.coverage).toBe(0.5);
  });
  it('a line with an amount but no recognised ingredient counts in total only', () => {
    const n = recipeNutrition([line('bloem', 200, 'g'), line(null, 3, null), line('bestaat-niet', 1, 'el')], 2, dict, TABLE);
    expect(n.total).toBe(3);
    expect(n.counted).toBe(1);
    expect(n.coverage).toBeCloseTo(1 / 3);
  });
  it('grams known but no table item: in total, not counted', () => {
    const n = recipeNutrition([line('bloem', 200, 'g'), line('kipfilet', 2)], 2, dict, TABLE);
    expect(n).toMatchObject({ counted: 1, total: 2, coverage: 0.5 });
  });
  it('headers, lines without an amount and non-food lines count nowhere', () => {
    const lines = [line(null, null, null, { kind: 'header' }), line('bloem', 200, 'g'), line('zout'), line('bakpapier', 1)];
    const n = recipeNutrition(lines, 2, dict, TABLE);
    expect(n).toMatchObject({ counted: 1, total: 1, coverage: 1 });
  });
  it('the pinch default counts ("snufje zout")', () => {
    const n = recipeNutrition([line('zout', null, 'snuf')], 1, dict, TABLE);
    expect(n.counted).toBe(1);
    expect(n.perServing?.salt).toBeCloseTo(0.3);
  });
  it('servings 0 or nothing counted -> perServing null', () => {
    expect(recipeNutrition([line('bloem', 200, 'g')], 0, dict, TABLE).perServing).toBeNull();
    const none = recipeNutrition([line('melk', 250, 'ml')], 4, dict, TABLE);
    expect(none.perServing).toBeNull();
    expect(none.coverage).toBe(0);
  });
  it('an empty recipe has coverage 0', () => {
    expect(recipeNutrition([], 4, dict, TABLE)).toEqual({ perServing: null, counted: 0, total: 0, coverage: 0 });
  });
});

describe('roundNutrients', () => {
  it('kcal to tens, grams whole, salt one decimal', () => {
    expect(roundNutrients({ kcal: 618, protein: 7.24, fat: 23.5, carbs: 61.49, fibre: 0.4, salt: 1.26 })).toEqual({
      kcal: 620,
      protein: 7,
      fat: 24,
      carbs: 61,
      fibre: 0,
      salt: 1.3,
    });
    expect(roundNutrients({ kcal: 614.9, protein: 0, fat: 0, carbs: 0, fibre: 0, salt: 0.04 })).toMatchObject({ kcal: 610, salt: 0 });
  });
});
