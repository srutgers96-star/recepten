// The shopping-list merge (PLAN.md §8 "Merge-algoritme", docs/phase-4-spec.md §1): a pure
// function from the plan + the structured lines + the dictionary to one list of items. One rule
// per step, each with a unit test in tests/aggregate.test.ts. Framework-free.
//
//   1. cooked dishes are skipped; factor = item.servings / recipe.servings
//   2. unresolved lines (ing null / unknown id) -> section 'check': the raw text, never scaled
//      (the factor is shown as "×1,5"); otherwise qty = max ?? min, null = "pm"
//   3. scale, then to a base unit: g (mass; also spoons/pieces of a gram-based ingredient via
//      gramsPer), ml (volume), 'stuk' (counted pieces), the unit id for count units (teen, bos)
//      and package units (blik, pak: per piece, never grams); pinch/length units never sum
//   4. key = ing | variant (qualifier ids with `variant: true`) | base unit; sum per key
//   5. fold across base units towards buyUnit / defaultUnit via gramsPer (500 g + 8 tomaten ->
//      15 tomaten; 2 kipfilets + 500 g -> 900 g)
//   6. rounding for display: pieces ceil; g < 100 -> 5, < 1000 -> 10, >= 1000 -> 100 ("1,3 kg");
//      ml likewise; spoons ½; pinch/pm -> no number; teentjes ceil + "(≈1 bol)" from 5
//   7. routing: pantry -> 'inHouse'; staple under the threshold -> 'staples' at qty 0 (tap = 1);
//      unresolved -> 'check'; the rest -> 'main', grouped by aisle in data order
//   8. regenerate: same key keeps checked / adjusted (while the display unit is unchanged) /
//      pinned; "Heb ik al" comes from the pantry for dictionary items (perishables are never
//      remembered there, so they return to the list) and from the item's own flag for label-only
//      extras; vanished keys drop unless manual or pinned; new keys get `fresh: true`
import type { Aisle, Dictionary, Ingredient, Qualifier, Unit } from './dictionary.ts';
import { pickText, type Lang, type Line, type Recipe, type Text } from './model.ts';
import type { Plan } from './planner.ts';
import { formatQty, renderLine, unitLabel } from './render.ts';

// --- Types --------------------------------------------------------------------------------------

export type ListSection = 'main' | 'inHouse' | 'staples' | 'check';

export interface ListSource {
  recipeId: string;
  name: Text;
  /** The raw line (Dutch when present, else English). */
  raw: string;
  /** The line rendered at the slot's servings ("3 uien"); for unresolved lines the raw text + "×N". */
  scaled: string;
}

export interface ListItem {
  /** 'ing|variant|baseUnit' for dictionary items, 'x|<manual id>' for extras, 'raw|<recipeId>|<index>' for unresolved lines. */
  key: string;
  ing?: string | null;
  /** Variant qualifier ids ("rode"), sorted, '' / absent when none. */
  variant?: string | null;
  /** Non-variant qualifier ids seen on the lines ("grote"), for the "(1 grote)" note. */
  qualifiers?: string[];
  /** Pieces per non-variant size qualifier: { grote: 1 } -> "4 uien (1 grote)". */
  qualCounts?: Record<string, number>;
  /** Display quantity after rounding (0 for a staple at rest; null = "pm"). Add `adjusted` for the effective value. */
  qty?: number | null;
  /** Display unit id: null = counted pieces; 'g' / 'ml' / 'el' / 'tl' / a count or package unit id. */
  unit?: string | null;
  /** The summed amount in the base unit (g / ml / stuk / unit id), unrounded. */
  baseQty?: number | null;
  baseUnit?: 'g' | 'ml' | 'stuk' | string | null;
  aisle: string;
  section: ListSection;
  sources: ListSource[];
  checked?: boolean;
  inHouse?: boolean;
  manual?: boolean;
  pinned?: boolean;
  /** The user's − / + delta in display units (null / absent = none). */
  adjusted?: number | null;
  /** Manual items without a dictionary id, and the raw text of unresolved lines. */
  label?: Text;
  /** Unresolved lines: the servings factor of the dish (shown as "×1,5", never applied). */
  factor?: number;
  /** True when every source measured in spoons, so a staple's hint reads "(≈ 3 el)" rather than ml. */
  spoon?: boolean;
  /** True when the key was not in `previous` (only set when a previous list was given). */
  fresh?: boolean;
}

export interface AggregateInput {
  plan: Plan;
  recipes: Map<string, Recipe>;
  /** The effective lines of a recipe (line overrides applied). */
  lines: (recipeId: string) => Line[];
  dict: Dictionary;
  /** Ingredient ids in the pantry ("Heb ik al"): the single source of `inHouse` for dictionary items. */
  pantry: Set<string>;
  /** Manual items (extras); they are included as they are, with their previous state merged in. */
  extras: ListItem[];
  /** The previous list: checked / adjusted / pinned survive by key; pinned + manual items survive a vanished key. */
  previous?: ListItem[];
}

/** Sum from which a staple leaves "Voorraad" and joins the main list with its amount. */
export const STAPLE_THRESHOLD = { g: 250, ml: 250, count: 5, package: 1 } as const;

const PM_UNIT = 'pm';
const STUK = 'stuk';
const SPOON_IDS = new Set(['el', 'tl', 'kop', 'glas']);
const METRIC_VOLUME = new Set(['ml', 'cl', 'dl', 'l']);
const EPS = 1e-9;

// --- Small helpers ------------------------------------------------------------------------------

function clean(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function ceil(n: number): number {
  return Math.ceil(n - EPS);
}

function roundTo(v: number, step: number): number {
  return Math.round(v / step) * step;
}

function isMassUnit(id: string | null | undefined): boolean {
  return id === 'g' || id === 'kg';
}

function isCountGroup(u: Unit | undefined): boolean {
  return u?.group === 'count';
}

function rawOf(line: Line): string {
  return pickText(line.raw, 'nl') || pickText(line.raw, 'en');
}

function rawLang(line: Line): Lang {
  return typeof line.raw?.nl === 'string' && line.raw.nl.trim() ? 'nl' : 'en';
}

/** "×1,5" / "×2" (a plain decimal, no fraction glyphs: it is a multiplier, not an amount). */
function factorText(factor: number): string {
  return `×${String(Math.round(factor * 100) / 100).replace('.', ',')}`;
}

/** g / ml rounding for the list: < 100 -> 5 (min 5), < 1000 -> 10, >= 1000 -> 100. */
function roundMetric(v: number): number {
  if (v < 100) return Math.max(5, roundTo(v, 5));
  if (v < 1000) return roundTo(v, 10);
  return roundTo(v, 100);
}

/** The effective display quantity: qty + the user's delta (null when neither exists). */
export function effectiveQty(it: Pick<ListItem, 'qty' | 'adjusted'>): number | null {
  const adj = typeof it.adjusted === 'number' && Number.isFinite(it.adjusted) ? it.adjusted : 0;
  if (it.qty === null || it.qty === undefined) return adj !== 0 ? Math.max(0, adj) : null;
  return Math.max(0, clean(it.qty + adj));
}

// --- Rounding & steps (PLAN.md §8 step 5; spec §0 "Proto list") ---------------------------------

/**
 * Rounding for display: pieces / count / package units ceil; mass to 5 g below 100, 10 g below
 * 1000, 100 g above ("1,3 kg"); metric volume likewise; spoons to ½; pinch / length unchanged.
 * `unit` null = counted pieces.
 */
export function roundForDisplay(qty: number, unit: string | null, dict: Dictionary): number {
  if (!(qty > 0)) return 0;
  const u = unit ? dict.unit(unit) : undefined;
  if (!u) return ceil(qty);
  switch (u.group) {
    case 'count':
    case 'package':
      return ceil(qty);
    case 'mass': {
      const g = u.g ?? 1;
      return clean(roundMetric(qty * g) / g);
    }
    case 'volume': {
      if (SPOON_IDS.has(u.id)) return Math.max(0.5, roundTo(qty, 0.5));
      const ml = u.ml ?? 1;
      return clean(roundMetric(qty * ml) / ml);
    }
    default:
      return qty;
  }
}

/**
 * The − / + step of the proto list, in display units: pieces 1; g 10 under 100, 25 under 500,
 * 50 above; ml 10 / 50 / 100 likewise; spoons ½. Unknown units step by 1.
 */
export function adjustStep(unit: string | null, qty: number): number {
  if (!unit) return 1;
  if (isMassUnit(unit)) {
    const g = unit === 'kg' ? qty * 1000 : qty;
    const step = g < 100 ? 10 : g < 500 ? 25 : 50;
    return unit === 'kg' ? step / 1000 : step;
  }
  if (METRIC_VOLUME.has(unit)) {
    const ml = unit === 'l' ? qty * 1000 : unit === 'dl' ? qty * 100 : unit === 'cl' ? qty * 10 : qty;
    const step = ml < 100 ? 10 : ml < 500 ? 50 : 100;
    return unit === 'l' ? step / 1000 : unit === 'dl' ? step / 100 : unit === 'cl' ? step / 10 : step;
  }
  if (SPOON_IDS.has(unit)) return 0.5;
  return 1;
}

// --- Step 2-3: one line -> one contribution ------------------------------------------------------

interface Contribution {
  ing: Ingredient;
  variant: string[];
  /** Non-variant size qualifiers of the line ("grote"). */
  sizeQuals: string[];
  /** Base unit: 'g', 'ml', 'stuk', a count/package unit id, or 'pm' (no numeric amount). */
  baseUnit: string;
  baseQty: number | null;
  /** True when the amount came from a spoon (el/tl): the display may say "3 el". */
  spoon: boolean;
  source: ListSource;
}

function variantOf(line: Line, dict: Dictionary): { variant: string[]; size: string[] } {
  const variant: string[] = [];
  const size: string[] = [];
  for (const id of line.qual ?? []) {
    const q: Qualifier | undefined = dict.qualifier(id);
    if (!q) continue;
    if (q.variant) variant.push(q.id);
    else if (q.kind === 'size') size.push(q.id);
  }
  variant.sort();
  return { variant, size };
}

function contributionOf(line: Line, ing: Ingredient, dict: Dictionary, factor: number, source: ListSource): Contribution {
  const { variant, size } = variantOf(line, dict);
  const base: Contribution = { ing, variant, sizeQuals: size, baseUnit: PM_UNIT, baseQty: null, spoon: false, source };
  // "2 kipfilets" (a number, no unit) counts pieces, whatever the ingredient's default unit is —
  // unless that default is itself a count unit ("2 knoflook" -> 2 teentjes, "1 bleekselderij" -> 1 stengel).
  let unitId = line.unit ?? ing.defaultUnit;
  if (!line.unit && line.qty && !isCountGroup(unitId ? dict.unit(unitId) : undefined)) unitId = STUK;
  const unit = unitId ? dict.unit(unitId) : undefined;
  let qty: number | null = line.qty ? (line.qty.max ?? line.qty.min) : null;
  // "Klontje boter" (unit, no number) counts as one unit when the dictionary knows its weight.
  if (qty === null && unitId && ing.gramsPer?.[unitId]) qty = 1;
  if (qty === null || !(qty > 0)) return base;
  qty *= factor;

  // Counted pieces: no unit, 'stuk', or a unit id the dictionary does not know.
  if (!unitId || unitId === STUK || !unit) {
    // Pieces of a gram-based ingredient (2 kipfilets à 200 g) go straight to grams.
    const gp = ing.gramsPer?.[STUK];
    if (isMassUnit(ing.defaultUnit) && gp) return { ...base, baseUnit: 'g', baseQty: qty * gp };
    return { ...base, baseUnit: STUK, baseQty: qty };
  }
  // Spoons / pinches / pieces of a gram-based ingredient with a known weight: 1 el boter = 15 g.
  const gp = ing.gramsPer?.[unit.id];
  if (isMassUnit(ing.defaultUnit) && gp && unit.group !== 'package' && unit.group !== 'mass') {
    return { ...base, baseUnit: 'g', baseQty: qty * gp, spoon: SPOON_IDS.has(unit.id) };
  }
  switch (unit.group) {
    case 'mass':
      return { ...base, baseUnit: 'g', baseQty: qty * (unit.g ?? 1) };
    case 'volume':
      return { ...base, baseUnit: 'ml', baseQty: qty * (unit.ml ?? 1), spoon: SPOON_IDS.has(unit.id) };
    case 'count':
    case 'package':
      return { ...base, baseUnit: unit.id, baseQty: qty };
    default:
      // pinch / length never sum numerically
      return base;
  }
}

// --- Step 4-5: sum per key and fold across base units ----------------------------------------------

interface Entry {
  ing: Ingredient;
  variant: string[];
  baseUnit: string;
  baseQty: number | null;
  spoon: boolean;
  sources: ListSource[];
  qualCounts: Record<string, number>;
}

function entryFrom(c: Contribution): Entry {
  return { ing: c.ing, variant: c.variant, baseUnit: c.baseUnit, baseQty: c.baseQty, spoon: c.spoon, sources: [c.source], qualCounts: {} };
}

function addSizeQuals(e: Entry, c: Contribution): void {
  if (c.baseUnit !== STUK || c.baseQty === null) return;
  for (const q of c.sizeQuals) e.qualCounts[q] = (e.qualCounts[q] ?? 0) + c.baseQty;
}

function mergeInto(target: Entry, c: Contribution, qty: number | null): void {
  if (qty !== null) target.baseQty = (target.baseQty ?? 0) + qty;
  target.spoon = target.spoon && c.spoon;
  target.sources.push(c.source);
  addSizeQuals(target, c);
}

/** Grams of one `unit` of the ingredient (the dictionary's gramsPer; 'g' itself is 1). */
function gramsOf(ing: Ingredient, unit: string): number | undefined {
  if (unit === 'g') return 1;
  const g = ing.gramsPer?.[unit];
  return typeof g === 'number' && g > 0 ? g : undefined;
}

/**
 * The base unit the numeric entries of one ingredient fold towards: a mass buyUnit -> g; a
 * count buyUnit with a known weight (bol, bos) -> that unit; a counted defaultUnit with a known
 * weight (tomaat: stuk 100 g) -> that unit; else g when there is a mass entry. Package units
 * never fold (a tin is a tin).
 */
function foldTarget(ing: Ingredient, units: readonly string[], dict: Dictionary): string | undefined {
  const buy = ing.buyUnit;
  if (buy && isMassUnit(buy)) return 'g';
  if (buy && isCountGroup(dict.unit(buy)) && gramsOf(ing, buy)) return buy;
  const def = ing.defaultUnit;
  if (def && (def === STUK || isCountGroup(dict.unit(def))) && gramsOf(ing, def)) return def;
  if (units.includes('g')) return 'g';
  return undefined;
}

function convertible(ing: Ingredient, from: string, to: string, dict: Dictionary): number | undefined {
  if (from === to) return 1;
  const fromUnit = dict.unit(from);
  if (fromUnit?.group === 'package' || from === 'ml' || from === PM_UNIT) return undefined;
  const a = gramsOf(ing, from);
  const b = gramsOf(ing, to);
  if (!a || !b) return undefined;
  return a / b;
}

/** All entries of one ingredient+variant, folded towards the target unit where the weights are known. */
function fold(entries: Entry[], dict: Dictionary): Entry[] {
  const numeric = entries.filter((e) => e.baseUnit !== PM_UNIT);
  const pm = entries.filter((e) => e.baseUnit === PM_UNIT);
  const first = entries[0];
  if (!first) return [];
  let out: Entry[] = numeric;
  if (numeric.length > 1) {
    const target = foldTarget(first.ing, numeric.map((e) => e.baseUnit), dict);
    if (target) {
      let merged: Entry | undefined;
      const rest: Entry[] = [];
      for (const e of numeric) {
        const f = convertible(first.ing, e.baseUnit, target, dict);
        if (f === undefined) {
          rest.push(e);
          continue;
        }
        const qty = (e.baseQty ?? 0) * f;
        if (!merged) {
          merged = { ...e, baseUnit: target, baseQty: qty, sources: [...e.sources], qualCounts: { ...e.qualCounts } };
        } else {
          merged.baseQty = (merged.baseQty ?? 0) + qty;
          merged.spoon = merged.spoon && e.spoon;
          merged.sources.push(...e.sources);
          for (const [q, n] of Object.entries(e.qualCounts)) merged.qualCounts[q] = (merged.qualCounts[q] ?? 0) + n;
        }
      }
      out = merged ? [merged, ...rest] : rest;
    }
  }
  // "pm" lines ("boter om in te bakken") ride along with the first numeric entry.
  if (pm.length) {
    const host = out[0];
    if (host) for (const p of pm) host.sources.push(...p.sources);
    else out = [{ ...(pm[0] as Entry), sources: pm.flatMap((p) => p.sources) }];
  }
  return out;
}

// --- Step 6: display unit -------------------------------------------------------------------------

interface Display {
  qty: number | null;
  unit: string | null;
}

/** Display quantity + unit for a base amount: g / ml (kg / l are formatting), spoons when all sources were spoons, pieces, count/package units. */
function displayOf(baseQty: number | null, baseUnit: string | null | undefined, spoon: boolean, dict: Dictionary): Display {
  if (baseQty === null || baseQty === undefined || !baseUnit || baseUnit === PM_UNIT) return { qty: null, unit: null };
  if (baseUnit === 'g') return { qty: roundForDisplay(baseQty, 'g', dict), unit: 'g' };
  if (baseUnit === 'ml') {
    const ml = roundForDisplay(baseQty, 'ml', dict);
    if (spoon) {
      if (Math.abs(ml / 15 - Math.round(ml / 15)) < 1e-6 && ml <= 150) return { qty: ml / 15, unit: 'el' };
      if (ml < 15 && Math.abs(ml / 5 - Math.round(ml / 5)) < 1e-6) return { qty: ml / 5, unit: 'tl' };
    }
    return { qty: ml, unit: 'ml' };
  }
  if (baseUnit === STUK) return { qty: roundForDisplay(baseQty, null, dict), unit: null };
  return { qty: roundForDisplay(baseQty, baseUnit, dict), unit: baseUnit };
}

/**
 * True when a staple's summed amount is large enough to become a real shopping line: 250 g /
 * 250 ml, 5 pieces, one package, or one of the unit it is bought in ("1 bol knoflook").
 */
function aboveStapleThreshold(e: Entry, dict: Dictionary): boolean {
  if (e.baseQty === null || e.baseUnit === PM_UNIT) return false;
  if (e.baseUnit === 'g') return e.baseQty >= STAPLE_THRESHOLD.g;
  if (e.baseUnit === 'ml') return e.baseQty >= STAPLE_THRESHOLD.ml;
  const u = dict.unit(e.baseUnit);
  if (u?.group === 'package' || e.baseUnit === e.ing.buyUnit) return e.baseQty >= STAPLE_THRESHOLD.package;
  return e.baseQty >= STAPLE_THRESHOLD.count;
}

/**
 * The unit a staple is bought in, when it is a count/package unit ("1 pak boter", "1 fles
 * sojasaus"): the buyUnit, else a package unit the dictionary knows a weight for; null -> "1× …".
 */
function stapleUnit(ing: Ingredient, dict: Dictionary): string | null {
  const buy = ing.buyUnit ? dict.unit(ing.buyUnit) : undefined;
  if (buy && (buy.group === 'package' || buy.group === 'count')) return buy.id;
  for (const id of Object.keys(ing.gramsPer ?? {})) {
    if (dict.unit(id)?.group === 'package') return id;
  }
  return null;
}

// --- The merge ------------------------------------------------------------------------------------

function keyOf(e: Entry): string {
  return `${e.ing.id}|${e.variant.join('+')}|${e.baseUnit}`;
}

function sourceFor(recipe: Recipe, line: Line, dict: Dictionary, factor: number, resolved: boolean): ListSource {
  const raw = rawOf(line);
  let scaled = raw;
  if (resolved) {
    try {
      scaled = renderLine(line, dict, rawLang(line), factor) || raw;
    } catch {
      scaled = raw;
    }
  } else if (Math.abs(factor - 1) > EPS) {
    scaled = `${raw} ${factorText(factor)}`;
  }
  return { recipeId: recipe.id, name: { ...recipe.name }, raw, scaled };
}

/**
 * Copies the user's state from the previous item with the same key. `adjusted` is a delta in
 * DISPLAY units, so it only survives while the display unit (and the staple/main class) is the
 * same: a staple tapped to "1 pak boter" that grows into "300 g boter" starts clean instead of
 * becoming "301 g". `inHouse` is not carried here (see `stillInHouse`).
 */
function carry(target: ListItem, prev: ListItem | undefined): void {
  if (!prev) return;
  if (prev.checked) target.checked = true;
  if (prev.pinned) target.pinned = true;
  const sameUnit = (prev.unit ?? null) === (target.unit ?? null) && (prev.section === 'staples') === (target.section === 'staples');
  if (sameUnit && typeof prev.adjusted === 'number' && Number.isFinite(prev.adjusted) && prev.adjusted !== 0) target.adjusted = prev.adjusted;
}

/**
 * Whether "Heb ik al" still holds after a regeneration: for a dictionary item the pantry decides
 * (perishables are never written there, so "de paprika staat weer gewoon op de lijst"); an item
 * the dictionary does not know (a label-only extra) keeps its own flag.
 */
function stillInHouse(ing: string | null | undefined, prevFlag: boolean | undefined, i: AggregateInput): boolean {
  if (ing && i.dict.get(ing)) return i.pantry.has(ing);
  return prevFlag === true;
}

/**
 * The shopping list for a plan (rules 1-8 above). Items come back grouped: main list by aisle in
 * data order (name order within an aisle is the UI's job, see `groupByAisle`), then staples,
 * then in-house, then "Controleer zelf". Never mutates its inputs.
 */
export function aggregate(i: AggregateInput): ListItem[] {
  const { dict } = i;
  const prevByKey = new Map<string, ListItem>();
  for (const p of i.previous ?? []) prevByKey.set(p.key, p);
  const hadPrevious = i.previous !== undefined;

  const check: ListItem[] = [];
  const byIngVariant = new Map<string, Map<string, Entry>>();

  for (const item of i.plan.items) {
    if (item.cooked) continue;
    const recipe = i.recipes.get(item.recipeId);
    if (!recipe) continue;
    const base = recipe.servings > 0 ? recipe.servings : 4;
    const factor = item.servings > 0 ? item.servings / base : 1;
    const lines = i.lines(recipe.id);
    lines.forEach((line, index) => {
      if (!line || line.kind === 'header') return;
      const ing = line.ing ? dict.get(line.ing) : undefined;
      if (!ing) {
        const raw = rawOf(line);
        if (!raw) return;
        const it: ListItem = {
          key: `raw|${recipe.id}|${index}`,
          ing: null,
          aisle: 'overig',
          section: 'check',
          sources: [sourceFor(recipe, line, dict, factor, false)],
          label: { ...line.raw },
          qty: null,
          unit: null,
        };
        if (Math.abs(factor - 1) > EPS) it.factor = clean(factor);
        check.push(it);
        return;
      }
      const c = contributionOf(line, ing, dict, factor, sourceFor(recipe, line, dict, factor, true));
      const groupKey = `${ing.id}|${c.variant.join('+')}`;
      let group = byIngVariant.get(groupKey);
      if (!group) {
        group = new Map();
        byIngVariant.set(groupKey, group);
      }
      const existing = group.get(c.baseUnit);
      if (existing) mergeInto(existing, c, c.baseQty);
      else {
        const e = entryFrom(c);
        addSizeQuals(e, c);
        group.set(c.baseUnit, e);
      }
    });
  }

  const main: ListItem[] = [];
  const staples: ListItem[] = [];
  const inHouse: ListItem[] = [];
  const seen = new Set<string>();

  const route = (it: ListItem): void => {
    if (it.section === 'inHouse') inHouse.push(it);
    else if (it.section === 'staples') staples.push(it);
    else main.push(it);
  };

  for (const group of byIngVariant.values()) {
    for (const e of fold([...group.values()], dict)) {
      const key = keyOf(e);
      const prev = prevByKey.get(key);
      const { qty, unit } = displayOf(e.baseQty, e.baseUnit, e.spoon, dict);
      const it: ListItem = {
        key,
        ing: e.ing.id,
        variant: e.variant.join('+') || null,
        qty,
        unit,
        baseQty: e.baseQty === null ? null : clean(e.baseQty),
        baseUnit: e.baseUnit === PM_UNIT ? null : e.baseUnit,
        aisle: e.ing.aisle || 'overig',
        section: 'main',
        sources: e.sources,
      };
      const quals = Object.keys(e.qualCounts);
      if (quals.length) {
        it.qualifiers = quals;
        it.qualCounts = { ...e.qualCounts };
      }
      if (e.spoon && e.baseUnit === 'ml') it.spoon = true;
      const inPantry = i.pantry.has(e.ing.id);
      if (!inPantry && e.ing.staple && !aboveStapleThreshold(e, dict)) {
        it.section = 'staples';
        it.qty = 0;
        it.unit = stapleUnit(e.ing, dict);
      }
      // The display unit is final here, so `adjusted` can be compared against the previous one.
      carry(it, prev);
      if (inPantry) {
        it.inHouse = true;
        it.section = 'inHouse';
      }
      if (hadPrevious && !prev) it.fresh = true;
      seen.add(key);
      route(it);
    }
  }

  // Extras: manual items as given, with their previous state.
  for (const x of i.extras) {
    if (!x || typeof x.key !== 'string' || seen.has(x.key)) continue;
    const prev = prevByKey.get(x.key);
    const it: ListItem = { ...x, manual: true, sources: [...(x.sources ?? [])], section: 'main' };
    if (x.ing && !it.aisle) it.aisle = dict.get(x.ing)?.aisle ?? 'overig';
    if (!it.aisle) it.aisle = 'overig';
    carry(it, prev);
    if (stillInHouse(x.ing, x.inHouse || prev?.inHouse, i)) {
      it.inHouse = true;
      it.section = 'inHouse';
    } else delete it.inHouse;
    if (hadPrevious && !prev) it.fresh = true;
    seen.add(it.key);
    route(it);
  }

  // Vanished keys drop unless manual or pinned ("elke week"); those stay as they were.
  for (const p of i.previous ?? []) {
    if (seen.has(p.key) || p.section === 'check') continue;
    if (!p.pinned && !p.manual) continue;
    const it: ListItem = { ...p, sources: p.manual ? [...p.sources] : [] };
    if (stillInHouse(p.ing, p.inHouse, i)) it.inHouse = true;
    else delete it.inHouse;
    it.section = it.inHouse ? 'inHouse' : p.section === 'staples' ? 'staples' : 'main';
    seen.add(it.key);
    route(it);
  }

  for (const c of check) {
    carry(c, prevByKey.get(c.key));
    if (hadPrevious && !prevByKey.has(c.key)) c.fresh = true;
  }

  const order = aisleOrder(dict);
  const byAisle = (a: ListItem, b: ListItem) => (order.get(a.aisle) ?? 999) - (order.get(b.aisle) ?? 999) || a.key.localeCompare(b.key);
  main.sort(byAisle);
  staples.sort(byAisle);
  inHouse.sort(byAisle);
  return [...main, ...staples, ...inHouse, ...check];
}

// --- Grouping for the UI -------------------------------------------------------------------------

function aisleOrder(dict: Dictionary): Map<string, number> {
  const m = new Map<string, number>();
  dict.aisles.forEach((a, idx) => m.set(a.id, idx));
  return m;
}

/** The name an item sorts by in a language. */
export function itemName(it: ListItem, dict: Dictionary, lang: Lang): string {
  if (it.ing && dict.get(it.ing)) {
    const q = it.variant ? it.variant.split('+').map((id) => dict.qualifierName(id, lang)).join(' ') + ' ' : '';
    return q + dict.ingredientName(it.ing, lang);
  }
  return pickText(it.label, lang) || it.sources[0]?.raw || it.key;
}

export interface AisleGroup {
  id: string;
  aisle: Aisle | undefined;
  items: ListItem[];
}

/** Items grouped by aisle in data order (aisles without items are left out), names sorted in `lang`. */
export function groupByAisle(items: readonly ListItem[], dict: Dictionary, lang: Lang): AisleGroup[] {
  const order = aisleOrder(dict);
  const groups = new Map<string, ListItem[]>();
  for (const it of items) {
    const list = groups.get(it.aisle) ?? [];
    list.push(it);
    groups.set(it.aisle, list);
  }
  const collator = new Intl.Collator(lang === 'nl' ? 'nl' : 'en', { sensitivity: 'base' });
  return [...groups.entries()]
    .sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999) || a[0].localeCompare(b[0]))
    .map(([id, list]) => ({ id, aisle: dict.aisle(id), items: [...list].sort((a, b) => collator.compare(itemName(a, dict, lang), itemName(b, dict, lang))) }));
}

// --- Rendering ---------------------------------------------------------------------------------

function numberText(n: number, lang: Lang): string {
  return formatQty(clean(n), undefined, lang);
}

/** "1,3 kg" / "500 g", "1½ l" / "250 ml", "3 el", "7 teentjes" (unit label via the dictionary). */
function amountText(qty: number, unit: string | null, dict: Dictionary, lang: Lang, ing?: Ingredient): string {
  if (!unit) return numberText(qty, lang);
  if (unit === 'g' && qty >= 1000) return `${numberText(qty / 1000, lang)} kg`;
  if (unit === 'ml' && qty >= 1000) return `${numberText(qty / 1000, lang)} l`;
  const u = dict.unit(unit);
  if (!u) return `${numberText(qty, lang)} ${unit}`;
  return `${numberText(qty, lang)} ${unitLabel(u, lang, { min: qty }, ing)}`;
}

function nameText(it: ListItem, ing: Ingredient, dict: Dictionary, lang: Lang, qty: number | null, unit: string | null): string {
  const u = unit ? dict.unit(unit) : undefined;
  let plural = false;
  if (qty !== null) {
    if (!unit) plural = qty > 1;
    else if (u && (u.group === 'mass' || u.group === 'volume' || u.group === 'package')) plural = true;
  }
  let name = dict.ingredientName(ing.id, lang, plural);
  if (u?.id === 'blik') name = lang === 'nl' ? name.replace(/\s+(?:uit|in) blik$/iu, '') : name.replace(/^(?:tinned|canned)\s+/iu, '');
  const words: string[] = [];
  for (const id of it.variant ? it.variant.split('+') : []) {
    const w = dict.qualifierName(id, lang);
    if (name.toLowerCase().startsWith(w.toLowerCase() + ' ')) continue;
    words.push(w);
  }
  // "2 grote uien" when every piece is large; otherwise the note "(1 grote)" (see qualNote).
  if (!unit && qty !== null && it.qualCounts) {
    for (const [id, n] of Object.entries(it.qualCounts)) if (n >= qty - EPS) words.push(dict.qualifierName(id, lang));
  }
  words.push(name);
  return words.join(' ');
}

/** "(1 grote)" / "(1 large)": size qualifiers that apply to some of the pieces. */
function qualNote(it: ListItem, dict: Dictionary, lang: Lang, qty: number | null, unit: string | null): string {
  if (unit || qty === null || !it.qualCounts) return '';
  const parts: string[] = [];
  for (const [id, n] of Object.entries(it.qualCounts)) {
    if (n >= qty - EPS) continue;
    parts.push(`${numberText(ceil(n), lang)} ${dict.qualifierName(id, lang)}`);
  }
  return parts.length ? `(${parts.join(', ')})` : '';
}

/** "(≈1 bol)" / "(≈1 bulb)": a count unit with a known weight next to a count buyUnit (teentjes -> bol, from about half a bulb). */
function buyHint(ing: Ingredient, qty: number | null, unit: string | null, dict: Dictionary, lang: Lang): string {
  if (qty === null || !unit || !ing.buyUnit || ing.buyUnit === unit) return '';
  const u = dict.unit(unit);
  const buy = dict.unit(ing.buyUnit);
  if (!u || !buy || u.group !== 'count' || buy.group !== 'count') return '';
  const a = gramsOf(ing, unit);
  const b = gramsOf(ing, ing.buyUnit);
  if (!a || !b) return '';
  const grams = qty * a;
  if (grams < b / 2) return '';
  const n = ceil(grams / b);
  return `(≈${numberText(n, lang)} ${unitLabel(buy, lang, { min: n }, ing)})`;
}

// The few words of the plain-text formats live here as {nl, en} literals rather than in src/i18n:
// the domain layer is framework-free and runs in Node (tests), the same trade-off as message.ts.
const PM = { nl: 'pm', en: 'as needed' } as const;

/**
 * One list line in a language: "4 uien (1 grote)", "7 teentjes knoflook (≈1 bol)", "1,3 kg
 * aardappelen", "boter (≈ 85 g)" for a staple at rest, "1 pak boter" once tapped, "Rookworst en/of
 * braadworst ×1,5" for an unresolved line, "wc-papier" for an extra without a dictionary id, and
 * just "melk" for a manual item without a number (a hand-added item is never "pm").
 */
export function renderListItem(it: ListItem, dict: Dictionary, lang: Lang): string {
  const eff = effectiveQty(it);
  const ing = it.ing ? dict.get(it.ing) : undefined;
  if (!ing) {
    const label = pickText(it.label, lang) || it.sources[0]?.raw || it.key;
    const amount = eff !== null && eff > 0 ? amountText(eff, it.unit ?? null, dict, lang) + ' ' : '';
    const factor = it.factor && Math.abs(it.factor - 1) > EPS ? ` ${factorText(it.factor)}` : '';
    return `${amount}${label}${factor}`;
  }
  const unit = it.unit ?? null;
  const parts: string[] = [];
  if (eff === null) {
    parts.push(nameText(it, ing, dict, lang, null, null));
    if (!it.manual) parts.push(`(${PM[lang]})`);
  } else if (it.section === 'staples' || (it.qty === 0 && (it.baseQty ?? null) !== null)) {
    // A staple: "boter (≈ 85 g)" at rest, "1 pak boter" / "1× boter" once tapped.
    const need = displayOf(it.baseQty ?? null, it.baseUnit, it.spoon === true, dict);
    const hint = need.qty !== null && need.qty > 0 ? `(≈ ${amountText(need.qty, need.unit, dict, lang, ing)})` : '';
    if (eff > 0) {
      const u = unit ? dict.unit(unit) : undefined;
      const count = u ? amountText(eff, unit, dict, lang, ing) : `${numberText(eff, lang)}×`;
      parts.push(count, nameText(it, ing, dict, lang, u ? eff : null, unit));
    } else {
      parts.push(nameText(it, ing, dict, lang, null, null));
    }
    if (hint) parts.push(hint);
  } else {
    parts.push(amountText(eff, unit, dict, lang, ing), nameText(it, ing, dict, lang, eff, unit));
    const note = qualNote(it, dict, lang, eff, unit);
    if (note) parts.push(note);
    const hint = buyHint(ing, eff, unit, dict, lang);
    if (hint) parts.push(hint);
  }
  return parts.filter(Boolean).join(' ');
}

// --- Plain text (PLAN.md §8 "Delen van de lijst") ---------------------------------------------------

// Framework-free literals, like PM above (see the note there).
const CHECK_HEADER = { nl: 'Controleer zelf', en: 'Check yourself' } as const;
const IN_HOUSE = { nl: '(in huis)', en: '(in stock)' } as const;

/**
 * ISO-8601 week number of a date (weeks start on Monday; week 1 holds the first Thursday), for
 * the "Boodschappen wk 39" title.
 */
export function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
}

/**
 * The list as WhatsApp text: title, aisle headers in data order with "☐ " lines, "Controleer zelf"
 * last (raw lines, "(NL)" when the line has no text in `lang`), the dishes on a final "— " line.
 * Checked lines show "☑" unless `hideChecked`; in-house lines are left out with `hideInHouse`
 * (else marked); numeric lines at 0 (staples at rest, an item stepped down to "niet nodig") are
 * always left out.
 */
export function listAsText(items: ListItem[], dict: Dictionary, lang: Lang, opts: { title: string; hideChecked?: boolean; hideInHouse?: boolean }): string {
  const out: string[] = [];
  const title = opts.title.trim();
  if (title) out.push(title);
  const visible = (it: ListItem): boolean => {
    if (it.checked && opts.hideChecked) return false;
    if (it.inHouse && opts.hideInHouse) return false;
    if (typeof it.qty === 'number') {
      const eff = effectiveQty(it);
      return eff !== null && eff > 0;
    }
    return true;
  };
  const box = (it: ListItem) => (it.checked ? '☑' : '☐');
  const listed = items.filter((it) => it.section !== 'check' && visible(it));
  for (const g of groupByAisle(listed, dict, lang)) {
    out.push(g.aisle ? g.aisle[lang] : g.id);
    for (const it of g.items) {
      const suffix = it.inHouse ? ` ${IN_HOUSE[lang]}` : '';
      out.push(`${box(it)} ${renderListItem(it, dict, lang)}${suffix}`);
    }
  }
  const checks = items.filter((it) => it.section === 'check' && visible(it));
  if (checks.length) {
    out.push(CHECK_HEADER[lang]);
    for (const it of checks) {
      const own = typeof it.label?.[lang] === 'string' && (it.label[lang] as string).trim() !== '';
      const marker = own ? '' : lang === 'nl' ? ' (EN)' : ' (NL)';
      out.push(`${box(it)} ${renderListItem(it, dict, lang)}${marker}`);
    }
  }
  const dishes: string[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    for (const s of it.sources) {
      if (seen.has(s.recipeId)) continue;
      seen.add(s.recipeId);
      const name = pickText(s.name, lang);
      if (name) dishes.push(name);
    }
  }
  if (dishes.length) out.push(`— ${dishes.join(', ')}`);
  return out.join('\n');
}
