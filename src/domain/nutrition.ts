// Nutrition per serving (docs/specs/verbeterronde-9.md §1a). Framework-free: runs in Node and in the app.
//
// The table (data/nutrition.json) holds ESTIMATES per 100 g of the product as it appears in a recipe
// (pasta and rice dry). A line counts when its grams can be known: a mass unit, a volume unit with the
// ingredient's density (`Ingredient.gramsPerMl`, deliberately NOT `gramsPer.ml`, which would fold the
// shopping list to grams), a piece or unit weight in `gramsPer`, or a pinch default from PINCH_GRAMS.
// The unit is resolved exactly like `aggregate.contributionOf`: a number without a unit counts pieces
// unless the ingredient's default unit is itself a count unit ("2 knoflook" -> 2 teentjes).
import type { Dictionary, Ingredient } from './dictionary.ts';
import type { Line } from './model.ts';

export interface Nutrients {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fibre: number;
  salt: number;
}

export interface NutritionItem extends Nutrients {
  alcohol?: number;
  source?: 'estimate' | 'nevo' | 'usda';
}

export type NutritionTable = Readonly<Record<string, NutritionItem>>;

/** Aisles of non-food entries: no nutrition values, and their lines do not count in the coverage. */
export const NON_FOOD_AISLES: ReadonlySet<string> = new Set(['huishoudelijk', 'drogisterij']);

/** Grams of one pinch unit when the dictionary has no gramsPer for it. */
export const PINCH_GRAMS: Readonly<Record<string, number>> = { snuf: 0.3, mp: 0.5, scheut: 10, klont: 15, druppel: 0.05 };

/** Below this share of counted lines no nutrition line is shown at all. */
export const NUTRITION_MIN_COVERAGE = 0.5;

/** kcal are shown to the nearest ten. */
export const KCAL_ROUND = 10;

const STUK = 'stuk';
const NUTRIENT_KEYS = ['kcal', 'protein', 'fat', 'carbs', 'fibre', 'salt'] as const;

/** The unit a line with a number is counted in when it has no unit of its own (as aggregate.contributionOf). */
function resolvedUnitId(line: Line, ing: Ingredient, dict: Dictionary): string | null {
  const unitId = line.unit ?? ing.defaultUnit;
  if (!line.unit && line.qty && (unitId ? dict.unit(unitId) : undefined)?.group !== 'count') return STUK;
  return unitId;
}

/**
 * The quantity a line counts with: the midpoint of a range ("2-3" → 2.5); a unit with a known weight
 * and no number → 1 ("klontje boter" = 1 klont; a known weight is a `gramsPer` entry for the unit or a
 * pinch default from PINCH_GRAMS); else null.
 */
export function lineQty(line: Line, ing: Ingredient | undefined): number | null {
  if (line.kind === 'header') return null;
  const q = line.qty;
  if (q) {
    const min = q.min;
    const max = q.max ?? q.min;
    const mid = (min + max) / 2;
    return Number.isFinite(mid) && mid > 0 ? mid : null;
  }
  if (!ing) return null;
  const unitId = line.unit ?? ing.defaultUnit;
  if (!unitId) return null;
  if (ing.gramsPer?.[unitId] || PINCH_GRAMS[unitId] !== undefined) return 1;
  return null;
}

/** Grams of a line, or null when they cannot be known. */
export function lineGrams(line: Line, dict: Dictionary): number | null {
  if (line.kind === 'header') return null;
  const ing = line.ing ? dict.get(line.ing) : undefined;
  if (!ing) return null;
  const qty = lineQty(line, ing);
  if (qty === null) return null;
  const unitId = resolvedUnitId(line, ing, dict);
  if (!unitId) return null;
  const gp = ing.gramsPer?.[unitId];
  if (gp) return qty * gp;
  const unit = dict.unit(unitId);
  if (unitId === STUK) {
    // A piece of an ingredient counted in another count unit with a known weight (1 stuk knoflook = 1 teen).
    const def = ing.defaultUnit;
    const defUnit = def ? dict.unit(def) : undefined;
    const defGrams = def ? ing.gramsPer?.[def] : undefined;
    if (defUnit?.group === 'count' && defGrams) return qty * defGrams;
    return null;
  }
  if (!unit) return null;
  switch (unit.group) {
    case 'mass':
      return unit.g ? qty * unit.g : null;
    case 'volume': {
      const density = typeof ing.gramsPerMl === 'number' ? ing.gramsPerMl : undefined;
      return unit.ml && density ? qty * unit.ml * density : null;
    }
    case 'pinch': {
      const g = PINCH_GRAMS[unitId];
      return g !== undefined ? qty * g : null;
    }
    default:
      // count / package / length without a weight in gramsPer
      return null;
  }
}

export interface RecipeNutrition {
  perServing: Nutrients | null;
  counted: number;
  total: number;
  coverage: number;
}

function isNonFood(ing: Ingredient | undefined): boolean {
  return !!ing && NON_FOOD_AISLES.has(ing.aisle);
}

export function recipeNutrition(lines: readonly Line[], servings: number, dict: Dictionary, table: NutritionTable): RecipeNutrition {
  const sum: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0, fibre: 0, salt: 0 };
  let counted = 0;
  let total = 0;
  for (const line of lines) {
    if (line.kind === 'header') continue;
    const ing = line.ing ? dict.get(line.ing) : undefined;
    if (isNonFood(ing)) continue;
    const hasQty = lineQty(line, ing) !== null;
    // A line with an amount but no (known) ingredient counts as unknown.
    if (!hasQty && !(line.qty && !ing)) continue;
    total++;
    const grams = lineGrams(line, dict);
    const item = line.ing ? table[line.ing] : undefined;
    if (grams === null || !item) continue;
    counted++;
    for (const k of NUTRIENT_KEYS) sum[k] += (grams / 100) * (item[k] ?? 0);
  }
  let perServing: Nutrients | null = null;
  if (servings >= 1 && counted > 0) {
    perServing = { kcal: 0, protein: 0, fat: 0, carbs: 0, fibre: 0, salt: 0 };
    for (const k of NUTRIENT_KEYS) perServing[k] = sum[k] / servings;
  }
  return { perServing, counted, total, coverage: total ? counted / total : 0 };
}

const EPS = 1e-9;

/** kcal to the nearest KCAL_ROUND, grams to whole grams, salt to one decimal. */
export function roundNutrients(n: Nutrients): Nutrients {
  const whole = (v: number) => Math.round(v + EPS);
  return {
    kcal: Math.round(n.kcal / KCAL_ROUND + EPS) * KCAL_ROUND,
    protein: whole(n.protein),
    fat: whole(n.fat),
    carbs: whole(n.carbs),
    fibre: whole(n.fibre),
    salt: Math.round(n.salt * 10 + EPS) / 10,
  };
}
