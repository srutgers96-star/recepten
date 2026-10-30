// Recipe variants (docs/phase-5-spec.md block F.2, src/domain/variants.ts): planVariant over the
// real dictionary + data/swaps.json, the raw-text name replacement (whole word, plural, both
// languages, capital, alternatives), makeVariant (new id, variantOf, tags, name suffix, only ticked
// swaps, original untouched), variantOf travelling in a share token, and validateSwaps. Lactosevrij
// (docs/specs/labels-categorieen.md §2b / §6a): the fourth variant diet with its dairy swaps.
// 13D (docs/specs/varianten-tabs.md §2c, §6): variantView (natural / proposed / approved / stale),
// applyStoredSwap, storedSwapsFrom, variantTabs, tagsWithVariants, versionName, versionAuthor and
// parseVariantParam; makeVariant stays (old copy variants). After block 1 ("Besluiten Fable na blok 1"):
// `swappedAlt` (2), an approved vegan tab also gives 'vega-optie' (3), the diet constants in
// src/domain/diets.ts re-exported by variants.ts (6).
import { describe, expect, it } from 'vitest';
import swapsJson from '../data/swaps.json';
import { defaultDictionary, defaultDictionaryData, ingredientsData } from '../src/domain/data';
import { loadDictionary, type Ingredient } from '../src/domain/dictionary';
import { DIET_TAGS, dietTags } from '../src/domain/diet';
import * as diets from '../src/domain/diets';
import type { Line, Recipe } from '../src/domain/model';
import { parseLine } from '../src/domain/parser';
import { normalizeRecipe } from '../src/domain/recipe-io';
import { renderLine } from '../src/domain/render';
import { buildRecipeEnvelope, parseEnvelope } from '../src/domain/share';
import { decodeToken, encodeToken } from '../src/domain/token';
import {
  activeVariantDiets,
  applyStoredSwap,
  applySwap,
  DIET_SUFFIX,
  DIET_TAGS_FOR,
  lineBreaksDiet,
  makeVariant,
  OPTIE_TAG_FOR,
  OPTIE_TAGS_FOR,
  parseVariantParam,
  planVariant,
  storedSwapsFrom,
  tagsWithVariants,
  VARIANT_DIETS,
  variantDietsFor,
  variantName,
  variantTabs,
  variantTags,
  variantView,
  versionAuthor,
  versionName,
  type RecipeVariant,
  type StoredSwap,
  type Swap,
  type VariantPlan,
} from '../src/domain/variants';
import { validateSwaps } from '../tools/validate-data.ts';

const dict = defaultDictionary();
const swaps = swapsJson as Swap[];
const nl = (...raw: string[]): Line[] => raw.map((r) => parseLine(r, dict, 'nl'));

function recipe(lines: Line[], over: Partial<Recipe> = {}): Recipe {
  return {
    schema: 2,
    id: 'b:spaghettischotel',
    rev: 4,
    createdAt: '2026-09-10T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
    origin: { kind: 'builtin' },
    name: { nl: 'Spaghettischotel uit de oven', en: 'Spaghetti bake' },
    tags: ['oven', 'kids', 'vega-optie'],
    servings: 4,
    lines,
    steps: [{ text: { nl: 'Kook de spaghetti.', en: 'Boil the spaghetti.' }, timers: [{ min: 10, unit: 'min' }] }],
    goesWith: ['b:salade'],
    aliases: ['spaghettischotel'],
    text: { en: 'llm' },
    ...over,
  };
}

const SCHOTEL = nl('400 g spaghetti', '1 groene paprika [reepjes]', '1 ui [gesnipperd]', '400 g gehakt', '125 g geraspte kaas', '2 eieren');

describe('planVariant', () => {
  it('finds the gluten swaps, keeps amount/unit/prep and leaves the other lines alone', () => {
    const plan = planVariant({ lines: SCHOTEL }, 'glutenvrij', swaps, dict);
    expect(plan.diet).toBe('glutenvrij');
    expect(plan.lines).toHaveLength(SCHOTEL.length);
    expect(plan.swaps).toEqual([{ index: 0, fromId: 'spaghetti', toId: 'glutenvrije-pasta', raw: { nl: '400 g glutenvrije pasta' }, name: 'glutenvrije pasta', applies: true, note: expect.any(Object) }]);
    expect(plan.unresolved).toEqual([]);
    const line = applySwap(SCHOTEL[0] as Line, plan.swaps[0]!);
    expect(line).toMatchObject({ ing: 'glutenvrije-pasta', qty: { min: 400 }, unit: 'g', confidence: 1 });
    expect(renderLine(line, dict, 'nl')).toBe('400 g glutenvrije pasta');
    expect(renderLine(line, dict, 'en')).toBe('400 g gluten-free pasta');
    // Re-parsing the new raw resolves the new product (invariant 2: structure next to raw).
    expect(parseLine(line.raw.nl as string, dict, 'nl').ing).toBe('glutenvrije-pasta');
  });

  it('vegetarian: meat gets its vega counterpart; egg and cheese are fine', () => {
    const plan = planVariant({ lines: SCHOTEL }, 'vegetarisch', swaps, dict);
    expect(plan.swaps.map((s) => [s.index, s.toId, s.raw.nl])).toEqual([[3, 'vegagehakt', '400 g vegagehakt']]);
    expect(plan.unresolved).toEqual([]);
  });

  it('vegan: dairy gets swapped; lines without a vegan swap (mince, egg) are "controleer zelf"', () => {
    const plan = planVariant({ lines: SCHOTEL }, 'vegan', swaps, dict);
    expect(plan.swaps.map((s) => [s.index, s.toId, s.raw.nl, s.applies])).toEqual([[4, 'vegan-kaas', '125 g geraspte vegan kaas', true]]);
    expect(plan.unresolved).toEqual([3, 5]);
  });

  it('a prep note, a capital and a plural survive the replacement', () => {
    // A line that starts with the (capitalised) product name, as typed by hand.
    const capital: Line = { raw: { nl: 'Kipfilet naar smaak' }, qty: null, unit: null, ing: 'kipfilet', name: 'Kipfilet', optional: true };
    const lines = [capital, ...nl('2 kipfilets [in blokjes]', '3 uien')];
    const plan = planVariant({ lines }, 'vegetarisch', swaps, dict);
    // counted fillets of a product sold by weight become grams (kipfilet: 200 g a piece)
    expect(plan.swaps.map((s) => s.raw.nl)).toEqual(['Vega kipstukjes naar smaak', '400 g vega kipstukjes [in blokjes]']);
    // vegan: the same lines go to tofu (no plural form -> singular)
    const vegan = planVariant({ lines }, 'vegan', swaps, dict);
    expect(vegan.swaps.map((s) => s.raw.nl)).toEqual(['Tofu naar smaak', '400 g tofu [in blokjes]']);
  });

  it('a counted line of a product sold by weight becomes grams; without a piece weight it is "controleer zelf"', () => {
    const lines = nl('4 kipfilets', '2-3 kipfilets (400 g)', '½ gegrilde kip', '2 stuks kipfilet', '4 gehaktballen');
    // vegan: kipfilet -> tofu (sold by weight; a fillet is 200 g); kip and gehaktbal have no vegan swap
    const plan = planVariant({ lines }, 'vegan', swaps, dict);
    expect(plan.swaps.map((s) => [s.index, s.raw.nl, s.applies])).toEqual([
      [0, '800 g tofu', true],
      [1, '400-600 g tofu', true], // the pack size of the old product is dropped
      [3, '400 g tofu', true], // "stuks" goes with the number
    ]);
    expect(plan.unresolved).toEqual([2, 4]);
    const first = applySwap(lines[0] as Line, plan.swaps[0]!);
    expect(first).toMatchObject({ ing: 'tofu', qty: { min: 800 }, unit: 'g' });
    expect(renderLine(first, dict, 'nl')).toBe('800 g tofu');
    expect(renderLine(first, dict, 'en')).toBe('800 g tofu');
    // re-parsing the new raw agrees with the structure
    expect(parseLine(first.raw.nl as string, dict, 'nl')).toMatchObject({ ing: 'tofu', qty: { min: 800 }, unit: 'g' });
    const second = applySwap(lines[1] as Line, plan.swaps[1]!);
    expect(second).toMatchObject({ qty: { min: 400, max: 600 }, unit: 'g' });
    expect(second.packSize).toBeUndefined();
    // vegetarisch: "½ gegrilde kip" — a whole chicken weighs 1200 g in the dictionary
    const veg = planVariant({ lines }, 'vegetarisch', swaps, dict);
    expect(veg.swaps.find((s) => s.index === 2)).toMatchObject({ raw: { nl: '600 g gegrilde vega kipstukjes' }, grams: { min: 600 }, applies: true });
    // English line typed on the iPhone: the same conversion
    const en = parseLine('2 chicken breasts', dict, 'en');
    expect(planVariant({ lines: [en] }, 'vegan', swaps, dict).swaps[0]).toMatchObject({ raw: { en: '400 g tofu' }, grams: { min: 400 }, applies: true });
    // a counted product WITHOUT a known piece weight going to a weight-only product: not rewritten
    const bare: Ingredient = { id: 'kipding', nl: { one: 'kipding', many: 'kipdingen' }, en: { one: 'chicken thing' }, aisle: 'vlees-vis', defaultUnit: 'stuk', staple: false, veg: false, vegan: false };
    const userDict = loadDictionary({ ...defaultDictionaryData(), ingredients: [...ingredientsData, bare] });
    const odd: Swap[] = [{ from: 'kipding', to: 'tofu', diets: ['vegan'] }];
    const line: Line = { raw: { nl: '3 kipdingen' }, qty: { min: 3 }, unit: null, ing: 'kipding', name: 'kipdingen' };
    expect(planVariant({ lines: [line] }, 'vegan', odd, userDict).swaps[0]).toMatchObject({ raw: { nl: '3 kipdingen' }, applies: false });
    // a counted product going to another COUNTED product is left alone ("4 gehaktballen" -> "4 vegaballetjes")
    expect(veg.swaps.find((s) => s.index === 4)).toMatchObject({ raw: { nl: '4 vegaballetjes' }, applies: true });
    expect(veg.swaps.find((s) => s.index === 4)!.grams).toBeUndefined();
  });

  it('an alias that starts with a unit word never swallows the unit', () => {
    const lines = nl('8 plakken ontbijtspek', '1 sneetje brood', 'Klontje boter', '6 blaadjes gelatine');
    expect(planVariant({ lines }, 'vegetarisch', swaps, dict).swaps.map((s) => s.raw.nl)).toEqual(['8 plakken vega spekjes', '6 blaadjes agar-agar']);
    expect(planVariant({ lines }, 'glutenvrij', swaps, dict).swaps.map((s) => s.raw.nl)).toEqual(['1 sneetje glutenvrij brood']);
    expect(planVariant({ lines }, 'vegan', swaps, dict).swaps.map((s) => s.raw.nl)).toEqual(['Klontje vegan boter', '6 blaadjes agar-agar']);
    // the unit survives a re-parse of the new raw
    expect(parseLine('8 plakken vega spekjes', dict, 'nl')).toMatchObject({ unit: 'plak', ing: 'vega-spekjes' });
    expect(parseLine('1 sneetje glutenvrij brood', dict, 'nl')).toMatchObject({ unit: 'snee', ing: 'glutenvrij-brood' });
    const en = parseLine('2 slices of bacon', dict, 'en');
    expect(en.unit).toBe('plak');
    expect(planVariant({ lines: [en] }, 'vegetarisch', swaps, dict).swaps[0]!.raw.en).toBe('2 slices of vegetarian lardons');
  });

  it('drops a qualifier that described the old product ("half-om-half") from the raw and the structure', () => {
    const lines = nl('500 g half-om-half gehakt');
    expect(lines[0]).toMatchObject({ ing: 'gehakt', qual: ['half-om-half'] });
    const plan = planVariant({ lines }, 'vegetarisch', swaps, dict);
    expect(plan.swaps[0]!.raw.nl).toBe('500 g vegagehakt');
    const line = applySwap(lines[0] as Line, plan.swaps[0]!);
    expect(line.qual).toBeUndefined();
    expect(renderLine(line, dict, 'en')).toBe('500 g vegetarian mince');
  });

  it('an alternative that is not in parentheses makes the line "controleer zelf" instead of staying in the raw', () => {
    const lines = nl('100 g boter of 100 g spekblokjes', '1 el bloem of paneermeel');
    expect(lines[0]!.alt).toHaveLength(1);
    expect(planVariant({ lines }, 'vegan', swaps, dict).swaps[0]).toMatchObject({ toId: 'vegan-boter', raw: { nl: '100 g boter of 100 g spekblokjes' }, applies: false });
    expect(planVariant({ lines }, 'glutenvrij', swaps, dict).swaps.map((s) => [s.raw.nl, s.applies])).toEqual([['1 el bloem of paneermeel', false]]);
  });

  it('uses the dictionary plural of the replacement when the old form was plural', () => {
    const lines: Line[] = [{ raw: { nl: '4 gehaktballen' }, qty: { min: 4 }, unit: null, ing: 'gehaktbal', name: 'gehaktballen' }];
    const plan = planVariant({ lines }, 'vegetarisch', swaps, dict);
    expect(plan.swaps[0]).toMatchObject({ toId: 'vegaballetje', raw: { nl: '4 vegaballetjes' }, name: 'vegaballetjes', applies: true });
  });

  it('replaces whole words only; the parsed name part is a fallback for heuristic forms', () => {
    // "kip" inside "kipspiesjes" is not the word "kip": nothing to replace -> applies false, raw kept.
    const glued: Line = { raw: { nl: '2 kipspiesjes' }, qty: { min: 2 }, ing: 'kip' };
    const p1 = planVariant({ lines: [glued] }, 'vegetarisch', swaps, dict);
    expect(p1.swaps).toEqual([{ index: 0, fromId: 'kip', toId: 'vega-kipstukjes', raw: { nl: '2 kipspiesjes' }, applies: false }]);
    expect(p1.unresolved).toEqual([]);
    // A line linked by hand whose name part is not a dictionary form of the product: `name` finds it.
    const linked: Line = { raw: { nl: '300 g rundergehakt' }, qty: { min: 300 }, unit: 'g', ing: 'gehakt', name: 'rundergehakt' };
    const p2 = planVariant({ lines: [linked] }, 'vegetarisch', swaps, dict);
    expect(p2.swaps[0]).toMatchObject({ raw: { nl: '300 g vegagehakt' }, applies: true });
  });

  it('replaces both languages when both contain the name, drops a second language that does not', () => {
    const both: Line = { raw: { nl: '200 ml room', en: '200 ml cream' }, qty: { min: 200 }, unit: 'ml', ing: 'room', name: 'room' };
    const p1 = planVariant({ lines: [both] }, 'vegan', swaps, dict);
    expect(p1.swaps[0]).toMatchObject({ toId: 'sojaroom', raw: { nl: '200 ml sojaroom', en: '200 ml soya cream' }, applies: true });
    const oddEn: Line = { raw: { nl: '200 ml room', en: '200 ml of that thick white stuff' }, qty: { min: 200 }, unit: 'ml', ing: 'room', name: 'room' };
    const p2 = planVariant({ lines: [oddEn] }, 'vegan', swaps, dict);
    expect(p2.swaps[0]!.raw).toEqual({ nl: '200 ml sojaroom' });
    // English-only line (typed on the iPhone): the English forms decide.
    const en = parseLine('2 chicken breasts', dict, 'en');
    expect(en.ing).toBe('kipfilet');
    const p3 = planVariant({ lines: [en] }, 'vegan', swaps, dict);
    expect(p3.swaps[0]).toMatchObject({ toId: 'tofu', raw: { en: '400 g tofu' }, name: 'tofu', applies: true });
  });

  it('drops the "(of …)" alternative of the old product', () => {
    const lines = nl('300 g kipfilet (of kipdijfilet) [in reepjes]');
    expect(lines[0]!.alt).toHaveLength(1);
    const plan = planVariant({ lines }, 'vegetarisch', swaps, dict);
    expect(plan.swaps[0]!.raw.nl).toBe('300 g vega kipstukjes [in reepjes]');
    const line = applySwap(lines[0] as Line, plan.swaps[0]!);
    expect(line.alt).toBeUndefined();
    expect(renderLine(line, dict, 'nl')).toBe('300 g vega kipstukjes, in reepjes');
  });

  it('follows diet.ts: a "plantaardige" line, an unresolved line and a header are never candidates', () => {
    const lines = nl('Saus:', '200 ml plantaardige room', '1 el mysterieus poeder', '200 ml room');
    expect(lines[2]!.ing).toBeNull();
    const plan = planVariant({ lines }, 'vegan', swaps, dict);
    expect(plan.swaps.map((s) => s.index)).toEqual([3]);
    expect(plan.unresolved).toEqual([]);
    expect(lineBreaksDiet(lines[0] as Line, 'vegan', dict)).toBe(false);
    expect(lineBreaksDiet(lines[3] as Line, 'vegan', dict)).toBe(true);
  });

  it('a replacement that would still break the diet counts as unresolved; an unflagged one is "unsure", not a break', () => {
    const meat: Ingredient = { id: 'huisgehakt', nl: { one: 'huisgehakt' }, en: { one: 'house mince' }, aisle: 'vlees-vis', defaultUnit: 'g', staple: false, veg: false };
    const unflagged: Ingredient = { id: 'tuingehakt', nl: { one: 'tuingehakt' }, en: { one: 'garden mince' }, aisle: 'overig', defaultUnit: 'g', staple: false, veg: true };
    const userDict = loadDictionary({ ...defaultDictionaryData(), ingredients: [...ingredientsData, meat, unflagged] });
    const odd: Swap[] = [{ from: 'gehakt', to: 'huisgehakt', diets: ['vegan'] }];
    const plan = planVariant({ lines: nl('400 g gehakt') }, 'vegan', odd, userDict);
    expect(plan.swaps).toEqual([]);
    expect(plan.unresolved).toEqual([0]);
    // diet.ts: a missing vegan flag is "unsure" (the detail page says "waarschijnlijk"), so the swap goes through
    const unsure: Swap[] = [{ from: 'gehakt', to: 'tuingehakt', diets: ['vegan'] }];
    expect(planVariant({ lines: nl('400 g gehakt') }, 'vegan', unsure, userDict).swaps[0]).toMatchObject({ toId: 'tuingehakt', applies: true });
    // and a swap whose target this dictionary does not know is skipped the same way
    const missing: Swap[] = [{ from: 'gehakt', to: 'niet-bestaand', diets: ['vegan'] }];
    expect(planVariant({ lines: nl('400 g gehakt') }, 'vegan', missing, dict).unresolved).toEqual([0]);
  });
});

describe('variantDietsFor', () => {
  it('offers the diets in the tab order of 13D (VARIANT_DIETS)', () => {
    expect(VARIANT_DIETS).toEqual(['glutenvrij', 'vegetarisch', 'vegan', 'lactosevrij']);
  });

  it('offers only the diets a line contradicts and that are not tagged by hand', () => {
    // the grated cheese contradicts lactosevrij as well
    expect(variantDietsFor({ tags: [] }, SCHOTEL, dict)).toEqual(['glutenvrij', 'vegetarisch', 'vegan', 'lactosevrij']);
    expect(variantDietsFor({ tags: ['vegetarisch'] }, SCHOTEL, dict)).toEqual(['glutenvrij', 'vegan', 'lactosevrij']);
    expect(variantDietsFor({ tags: [] }, nl('400 g glutenvrije pasta', '1 ui', '200 ml sojaroom'), dict)).toEqual([]);
    expect(variantDietsFor({ tags: [] }, nl('1 ui', '1 el mysterieus poeder'), dict)).toEqual([]);
  });

  it('offers lactosevrij for a recipe with cheese, not for one tagged lactosevrij or without dairy', () => {
    const cheese = nl('200 g rijst', '100 g kaas');
    expect(variantDietsFor({ tags: [] }, cheese, dict)).toContain('lactosevrij');
    expect(variantDietsFor({ tags: ['lactosevrij'] }, cheese, dict)).not.toContain('lactosevrij');
    expect(variantDietsFor({ tags: [] }, nl('200 g rijst', '1 ui', '200 ml kokosmelk'), dict)).not.toContain('lactosevrij');
  });
});

describe('lactosevrij variant', () => {
  const LINES = nl('50 g boter', '100 g feta', '1 ui', '200 ml slagroom');
  const plan = planVariant({ lines: LINES }, 'lactosevrij', swaps, dict);

  it('swaps butter and cream; feta has no swap and is "controleer zelf"', () => {
    expect(plan.diet).toBe('lactosevrij');
    expect(plan.swaps.map((s) => [s.index, s.fromId, s.toId, s.raw.nl, s.applies])).toEqual([
      [0, 'boter', 'vegan-boter', '50 g vegan boter', true],
      [3, 'slagroom', 'sojaroom', '200 ml sojaroom', true],
    ]);
    expect(plan.unresolved).toEqual([1]);
    expect(lineBreaksDiet(LINES[1] as Line, 'lactosevrij', dict)).toBe(true);
    expect(lineBreaksDiet(LINES[2] as Line, 'lactosevrij', dict)).toBe(false);
  });

  it('the new lactose-only swaps: ghee -> kokosolie, roomkaas and kwark -> sojayoghurt', () => {
    const p = planVariant({ lines: nl('2 el ghee', '200 g roomkaas', '250 g kwark') }, 'lactosevrij', swaps, dict);
    expect(p.swaps.map((s) => [s.fromId, s.toId, s.applies])).toEqual([
      ['ghee', 'kokosolie', true],
      ['roomkaas', 'sojayoghurt', true],
      ['kwark', 'sojayoghurt', true],
    ]);
    expect(p.swaps[0]!.note?.nl).toBe('Kokosolie bakt net zo heet als ghee; de smaak is iets zoeter.');
    expect(p.unresolved).toEqual([]);
    // margarine is only "maybe lactose" (lactose false + unsure): it never breaks the diet
    expect(planVariant({ lines: nl('50 g margarine') }, 'lactosevrij', swaps, dict)).toMatchObject({ swaps: [], unresolved: [] });
  });

  it('makeVariant: "(lactosevrij)" / "(lactose-free)", tag lactosevrij added, lactosevrij-optie dropped', () => {
    const src = recipe(LINES, { name: { nl: 'Ovenschotel', en: 'Bake' }, tags: ['oven', 'lactosevrij-optie', 'vega-optie'] });
    const v = makeVariant(src, plan, 'lactosevrij', { id: 'u:lactose1', now: '2026-10-23T12:00:00.000Z' });
    expect(v.name).toEqual({ nl: 'Ovenschotel (lactosevrij)', en: 'Bake (lactose-free)' });
    expect(v.tags).toEqual(['oven', 'vega-optie', 'lactosevrij']);
    expect(v.variantOf).toBe(src.id);
    expect(v.metaManual).toBe(true);
    expect(v.lines.map((l) => l.raw.nl)).toEqual(['50 g vegan boter', '100 g feta', '1 ui', '200 ml sojaroom (Sojaroom klopt niet op; voor opgeklopte slagroom gebruik je het vaste deel van gekoelde kokosmelk)']);
    expect(variantName({ en: 'Soup' }, 'lactosevrij')).toEqual({ en: 'Soup (lactose-free)' });
    expect(variantTags(['lactosevrij-optie', 'glutenvrij-optie'], 'lactosevrij')).toEqual(['glutenvrij-optie', 'lactosevrij']);
  });
});

describe('makeVariant', () => {
  const plan = planVariant({ lines: SCHOTEL }, 'vegan', swaps, dict);
  const before = JSON.stringify(recipe(SCHOTEL));

  it('is a new own recipe with variantOf, the diet tags, the suffixed name and the swaps applied', () => {
    const src = recipe(SCHOTEL);
    const v = makeVariant(src, plan, 'vegan', { author: 'Stijn', id: 'u:variant1', now: '2026-10-08T12:00:00.000Z' });
    expect(v.id).toBe('u:variant1');
    expect(v.rev).toBe(1);
    expect(v.createdAt).toBe('2026-10-08T12:00:00.000Z');
    expect(v.origin).toEqual({ kind: 'user', author: 'Stijn' });
    expect(v.variantOf).toBe('b:spaghettischotel');
    expect(v.name).toEqual({ nl: 'Spaghettischotel uit de oven (vegan)', en: 'Spaghetti bake (vegan)' });
    // vegan implies vegetarisch; the "vega-optie" tag is moot now; the rest stays in order
    expect(v.tags).toEqual(['oven', 'kids', 'vegetarisch', 'vegan']);
    expect(v.lines.map((l) => l.raw.nl)).toEqual(['400 g spaghetti', '1 groene paprika [reepjes]', '1 ui [gesnipperd]', '400 g gehakt', '125 g geraspte vegan kaas', '2 eieren']);
    expect(v.lines[3]).toMatchObject({ ing: 'gehakt', qty: { min: 400 }, unit: 'g' });
    expect(v.lines[4]).toMatchObject({ ing: 'vegan-kaas', qual: ['geraspte'], qty: { min: 125 }, unit: 'g' });
    expect(v.aliases).toEqual([]);
    expect(v.goesWith).toEqual(['b:salade']);
    expect(v.steps).toEqual(src.steps);
    expect(v.steps).not.toBe(src.steps);
    // the classic's machine-translation marker does not travel: an own recipe has no "Machine translation" path
    expect(v.text).toBeUndefined();
    // the "controleer zelf" lines (mince, egg) are copied as they were: the facts still say no,
    // the stored tag says what the user asked for, and the detail page shows the stored tag —
    // and `metaManual` keeps "Controleer mijn recepten → Alles overnemen" from removing it again
    expect(dietTags(v.lines, dict)).toMatchObject({ vegetarisch: false, vegan: false, glutenvrij: false });
    expect(v.metaManual).toBe(true);
    // the original is untouched (ids never change; the variant is a copy)
    expect(JSON.stringify(src)).toBe(before);
  });

  it('applies only the ticked swaps and gets a fresh u: id by default', () => {
    const veg = planVariant({ lines: SCHOTEL }, 'vegetarisch', swaps, dict);
    expect(veg.swaps.map((s) => s.toId)).toEqual(['vegagehakt']);
    const reviewed: VariantPlan = { ...veg, swaps: veg.swaps.map((s) => ({ ...s, applies: false })) };
    const v = makeVariant(recipe(SCHOTEL), reviewed, 'vegetarisch');
    expect(v.id).toMatch(/^u:[a-z0-9]{8}$/);
    expect(v.lines[3]!.raw).toEqual({ nl: '400 g gehakt' });
    expect(v.lines[3]!.ing).toBe('gehakt');
    expect(v.tags).toEqual(['oven', 'kids', 'vegetarisch']);
    expect(v.origin).toEqual({ kind: 'user', author: null });
    // ticked: the line is swapped
    const applied = makeVariant(recipe(SCHOTEL), veg, 'vegetarisch');
    expect(applied.lines[3]).toMatchObject({ ing: 'vegagehakt', raw: { nl: '400 g vegagehakt' }, name: 'vegagehakt', confidence: 1 });
    expect(dietTags(applied.lines, dict)).toMatchObject({ vegetarisch: true });
  });

  it("puts the swap's cook's note on the new line: in the raw (re-parse reads it back) and in `note`", () => {
    const plan = planVariant({ lines: SCHOTEL }, 'glutenvrij', swaps, dict);
    expect(plan.swaps[0]!.note).toEqual({ nl: 'Kies glutenvrije spaghetti (maïs of rijst).', en: 'Pick gluten-free spaghetti (corn or rice).' });
    const v = makeVariant(recipe(SCHOTEL), plan, 'glutenvrij', { id: 'u:variant4' });
    const line = v.lines[0]!;
    expect(line.raw).toEqual({ nl: '400 g glutenvrije pasta (Kies glutenvrije spaghetti, maïs of rijst)' });
    expect(line.note).toEqual({ nl: 'Kies glutenvrije spaghetti, maïs of rijst', en: 'Pick gluten-free spaghetti, corn or rice' });
    expect(renderLine(line, dict, 'en')).toBe('400 g gluten-free pasta (Pick gluten-free spaghetti, corn or rice)');
    const back = parseLine(line.raw.nl as string, dict, 'nl');
    expect(back).toMatchObject({ ing: 'glutenvrije-pasta', qty: { min: 400 }, unit: 'g' });
    expect(back.note?.nl).toBe('Kies glutenvrije spaghetti, maïs of rijst');
    // a swap without a note leaves the line's raw alone
    const vegan = makeVariant(recipe(SCHOTEL), planVariant({ lines: SCHOTEL }, 'vegan', swaps, dict), 'vegan', { id: 'u:variant5' });
    expect(vegan.lines[4]!.raw).toEqual({ nl: '125 g geraspte vegan kaas' });
    expect(vegan.lines[4]!.note).toBeUndefined();
    // the sheet's preview (applySwap alone) shows the line without the note; the note sits under it
    expect(renderLine(applySwap(SCHOTEL[0] as Line, plan.swaps[0]!), dict, 'nl')).toBe('400 g glutenvrije pasta');
  });

  it('strips the receiver-side bookkeeping and the override marker of the source', () => {
    const src = recipe(SCHOTEL, { origin: { kind: 'received', receivedFrom: 'Anna' }, sync: { receivedRev: 2 } });
    (src as Record<string, unknown>).override = { baseId: 'x' };
    const v = makeVariant(src, planVariant({ lines: SCHOTEL }, 'glutenvrij', swaps, dict), 'glutenvrij');
    expect(v.sync).toBeUndefined();
    expect((v as Record<string, unknown>).override).toBeUndefined();
    expect(v.origin.kind).toBe('user');
    expect(v.tags).toEqual(['oven', 'kids', 'vega-optie', 'glutenvrij']);
  });

  it('variantName never invents the missing language; variantTags drops only the moot -optie tags', () => {
    expect(variantName({ nl: 'Soep' }, 'glutenvrij')).toEqual({ nl: 'Soep (glutenvrij)' });
    expect(variantName({ en: 'Soup' }, 'vegetarisch')).toEqual({ en: 'Soup (vegetarian)' });
    expect(variantTags(['vega-optie', 'glutenvrij-optie', 'snel'], 'vegetarisch')).toEqual(['glutenvrij-optie', 'snel', 'vegetarisch']);
    expect(variantTags(['vegetarisch', 'vegan-optie'], 'vegan')).toEqual(['vegetarisch', 'vegan']);
    expect(variantTags(['glutenvrij'], 'glutenvrij')).toEqual(['glutenvrij']);
  });
});

describe('variantOf travels', () => {
  it('survives normalizeRecipe and a #r= token round trip', async () => {
    const v = makeVariant(recipe(SCHOTEL), planVariant({ lines: SCHOTEL }, 'glutenvrij', swaps, dict), 'glutenvrij', { id: 'u:variant2' });
    expect(normalizeRecipe(JSON.parse(JSON.stringify(v)))?.variantOf).toBe('b:spaghettischotel');
    const env = buildRecipeEnvelope(v, { by: 'Stijn', userIngredients: [] });
    expect((env.r as Recipe).variantOf).toBe('b:spaghettischotel');
    const back = parseEnvelope(await decodeToken(await encodeToken(env)));
    expect(back.kind).toBe('recipe');
    expect(back.recipes[0]?.variantOf).toBe('b:spaghettischotel');
    expect(back.recipes[0]?.name).toEqual({ nl: 'Spaghettischotel uit de oven (glutenvrij)', en: 'Spaghetti bake (gluten-free)' });
  });

  it('normalizeRecipe keeps null and drops a variantOf that is not a recipe id', () => {
    const v = makeVariant(recipe(SCHOTEL), planVariant({ lines: SCHOTEL }, 'glutenvrij', swaps, dict), 'glutenvrij', { id: 'u:variant3' });
    const raw = JSON.parse(JSON.stringify(v)) as Record<string, unknown>;
    for (const bad of [42, '', '   ', { id: 'x' }, ['b:x']]) {
      const n = normalizeRecipe({ ...raw, variantOf: bad });
      expect(n, String(bad)).not.toBeNull();
      expect(n && 'variantOf' in n, String(bad)).toBe(false);
    }
    expect(normalizeRecipe({ ...raw, variantOf: null })?.variantOf).toBeNull();
    expect(normalizeRecipe(raw)?.variantOf).toBe('b:spaghettischotel');
  });
});

describe('validateSwaps', () => {
  const ings = ingredientsData as unknown as Record<string, unknown>[];

  it('accepts data/swaps.json', () => {
    const r = validateSwaps(swapsJson, ings);
    expect(r.errors).toEqual([]);
    expect(r.stats.lines).toBe(swaps.length);
    expect(swaps.length).toBeGreaterThanOrEqual(40);
    // every swap note is bilingual
    expect(r.warnings.filter((w) => w.includes('only one language'))).toEqual([]);
  });

  it('every swap in the file can actually fire on a line that uses `from`', () => {
    for (const s of swaps) {
      for (const diet of s.diets) {
        const line: Line = { raw: { nl: `2 ${dict.ingredientName(s.from, 'nl')}` }, qty: { min: 2 }, ing: s.from };
        const plan = planVariant({ lines: [line] }, diet, swaps, dict);
        expect(plan.unresolved, `${s.from} -> ${s.to} (${diet})`).toEqual([]);
        expect(plan.swaps[0], `${s.from} -> ${s.to} (${diet})`).toMatchObject({ fromId: s.from, applies: true });
      }
    }
  });

  it('flags unknown ids, wrong flags, bad diets, duplicate pairs and bad notes', () => {
    const r = validateSwaps(
      [
        { from: 'gehakt', to: 'nergens', diets: ['vegetarisch'] },
        { from: 'gehakt', to: 'kipfilet', diets: ['vegetarisch'] },
        { from: 'pasta', to: 'spaghetti', diets: ['glutenvrij'] },
        { from: 'melk', to: 'kaas', diets: ['vegan'] },
        { from: 'melk', to: 'havermelk', diets: ['paleo', 'vegan', 'vegan'] },
        { from: 'melk', to: 'sojamelk', diets: ['vegan'], note: { nl: '' } },
        { from: 'ui', to: 'ui', diets: [] },
        'nope',
      ],
      ings,
    );
    expect(r.errors.some((e) => e.includes('"nergens"'))).toBe(true);
    expect(r.errors.some((e) => e.includes('"kipfilet"') && e.includes('"veg": true'))).toBe(true);
    expect(r.errors.some((e) => e.includes('"spaghetti"') && e.includes('"gluten": false'))).toBe(true);
    expect(r.errors.some((e) => e.includes('"kaas"') && e.includes('"vegan": true'))).toBe(true);
    expect(r.errors.some((e) => e.includes('"paleo"'))).toBe(true);
    expect(r.errors.some((e) => e.includes('listed twice'))).toBe(true);
    expect(r.errors.some((e) => e.includes('already exists'))).toBe(true);
    expect(r.errors.some((e) => e.includes('"note"'))).toBe(true);
    expect(r.errors.some((e) => e.includes('the same ingredient'))).toBe(true);
    expect(r.errors.some((e) => e.includes('non-empty array'))).toBe(true);
    expect(r.errors.some((e) => e.includes('not an object'))).toBe(true);
    expect(validateSwaps({ not: 'an array' }, ings).errors).toEqual(['swaps.json: must be an array of swaps.']);
  });

  it('warns when the target is only probably gluten-free or the source never breaks the diet', () => {
    const r = validateSwaps([{ from: 'sojasaus', to: 'tamari', diets: ['glutenvrij'] }, { from: 'ui', to: 'tofu', diets: ['vegan'] }], ings);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('glutenUnsure'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('can never fire'))).toBe(true);
  });

  it('lactosevrij: the target must be lactose: false; a lactoseUnsure target or a non-dairy source warns', () => {
    const bad = validateSwaps([{ from: 'melk', to: 'yoghurt', diets: ['lactosevrij'] }], ings);
    expect(bad.errors.some((e) => e.includes('"yoghurt"') && e.includes('"lactose": false'))).toBe(true);
    const r = validateSwaps([{ from: 'boter', to: 'margarine', diets: ['lactosevrij'] }, { from: 'margarine', to: 'vegan-boter', diets: ['lactosevrij'] }], ings);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('"margarine"') && w.includes('lactoseUnsure'))).toBe(true);
    // margarine is lactose: false (unsure), so a lactose-free swap FROM it can never fire
    expect(r.warnings.some((w) => w.includes('"margarine" -> "vegan-boter"') && w.includes('can never fire'))).toBe(true);
  });

  it('every lactosevrij swap in data/swaps.json has a target that is lactose: false (no guess) in the real dictionary', () => {
    const lactose = swaps.filter((s) => s.diets.includes('lactosevrij'));
    expect(lactose.length).toBeGreaterThanOrEqual(17);
    for (const s of lactose) {
      const to = dict.get(s.to);
      expect(to?.lactose, `${s.from} -> ${s.to}`).toBe(false);
      expect(to?.lactoseUnsure, `${s.from} -> ${s.to}`).toBeUndefined();
      expect(dict.get(s.from)?.lactose, `${s.from} -> ${s.to}`).toBe(true);
    }
    // margarine -> vegan-boter stays vegan only (margarine is "maybe lactose"; the swap would never fire)
    expect(swaps.find((s) => s.from === 'margarine')?.diets).toEqual(['vegan']);
  });
});

// --- 13D: variants as tabs (docs/specs/varianten-tabs.md §2c, §6) ---------------------------------

/** The glutenvrij approval of SCHOTEL as stored on the recipe (spec §2b). */
const GV_STORED: RecipeVariant = {
  approved: true,
  approvedAt: '2026-10-22T18:40:00.000Z',
  by: 'Stijn',
  swaps: [{ index: 0, fromId: 'spaghetti', toId: 'glutenvrije-pasta', raw: { nl: '400 g glutenvrije pasta' }, name: 'glutenvrije pasta' }],
  checked: [],
};

/** The vegan approval of SCHOTEL: cheese swapped, mince (3) and egg (5) ticked as "controleer zelf". */
function veganStored(checked: number[]): RecipeVariant {
  const plan = planVariant({ lines: SCHOTEL }, 'vegan', swaps, dict);
  return { approved: true, by: 'Stijn', swaps: storedSwapsFrom(plan, new Set()), checked };
}

describe('13D constants', () => {
  it('activeVariantDiets = the VARIANT_DIETS that DIET_TAGS knows, in tab order (four since 6B)', () => {
    expect(activeVariantDiets()).toEqual(VARIANT_DIETS.filter((d) => (DIET_TAGS as readonly string[]).includes(d)));
    expect(activeVariantDiets()).toEqual(['glutenvrij', 'vegetarisch', 'vegan', 'lactosevrij']);
  });

  it('DIET_SUFFIX, OPTIE_TAGS_FOR, DIET_TAGS_FOR and OPTIE_TAG_FOR know lactosevrij; the last two are exported', () => {
    expect(DIET_SUFFIX.lactosevrij).toEqual({ nl: 'lactosevrij', en: 'lactose-free' });
    expect(OPTIE_TAGS_FOR.lactosevrij).toEqual(['lactosevrij-optie']);
    expect(DIET_TAGS_FOR.vegan).toEqual(['vegetarisch', 'vegan']);
    expect(DIET_TAGS_FOR.lactosevrij).toEqual(['lactosevrij']);
    expect(OPTIE_TAG_FOR).toEqual({ glutenvrij: 'glutenvrij-optie', vegetarisch: 'vega-optie', vegan: 'vegan-optie', lactosevrij: 'lactosevrij-optie' });
  });

  it('the diet constants live in diets.ts; variants.ts re-exports the very same objects', () => {
    expect(VARIANT_DIETS).toBe(diets.VARIANT_DIETS);
    expect(DIET_SUFFIX).toBe(diets.DIET_SUFFIX);
    expect(DIET_TAGS_FOR).toBe(diets.DIET_TAGS_FOR);
    expect(OPTIE_TAGS_FOR).toBe(diets.OPTIE_TAGS_FOR);
    expect(diets.VARIANT_DIETS).toEqual(['glutenvrij', 'vegetarisch', 'vegan', 'lactosevrij']);
  });
});

describe('variantView', () => {
  it('natural: no line breaks the diet -> the original lines, nothing marked', () => {
    const noMince = SCHOTEL.filter((_, i) => i !== 3);
    const v = variantView('vegetarisch', noMince, undefined, swaps, dict);
    expect(v.status).toBe('natural');
    expect(v.lines).toEqual(noMince);
    expect(v.swapped).toEqual([]);
    expect(v.unresolved).toEqual([]);
    expect(v.checked).toEqual([]);
    expect(v.plan).toBeUndefined();
    // natural wins over a stored approval (the recipe no longer needs one)
    expect(variantView('vegetarisch', noMince, veganStored([3, 5]), swaps, dict).status).toBe('natural');
  });

  it('proposed: the applying swaps as a preview, with swappedFrom; the plan for the sheet', () => {
    const v = variantView('glutenvrij', SCHOTEL, undefined, swaps, dict);
    expect(v.status).toBe('proposed');
    expect(v.swapped).toEqual([0]);
    expect(v.lines[0]!.raw.nl).toBe('400 g glutenvrije pasta');
    expect(v.lines[0]!.ing).toBe('glutenvrije-pasta');
    expect(v.lines[0]!.swappedFrom).toBe('spaghetti');
    expect(v.lines.slice(1)).toEqual(SCHOTEL.slice(1));
    expect(v.unresolved).toEqual([]);
    expect(v.checked).toEqual([]);
    expect(v.plan).toEqual(planVariant({ lines: SCHOTEL }, 'glutenvrij', swaps, dict));
  });

  it('proposed vegan: cheese swapped, mince and egg "controleer zelf" (the gehakt swap is vegetarian only)', () => {
    const v = variantView('vegan', SCHOTEL, undefined, swaps, dict);
    expect(v.status).toBe('proposed');
    expect(v.swapped).toEqual([4]);
    expect(v.lines[4]).toMatchObject({ ing: 'vegan-kaas', swappedFrom: 'kaas', raw: { nl: '125 g geraspte vegan kaas' } });
    expect(v.unresolved).toEqual([3, 5]);
    expect(v.lines[3]).toBe(SCHOTEL[3]);
  });

  it('proposed: a swap with applies false stays as it is and counts as "controleer zelf"', () => {
    const lines = nl('100 g boter of 100 g spekblokjes', '200 ml room');
    const v = variantView('vegan', lines, undefined, swaps, dict);
    expect(v.swapped).toEqual([1]);
    expect(v.unresolved).toEqual([0]);
    expect(v.lines[0]).toBe(lines[0]);
    expect(v.lines[1]).toMatchObject({ ing: 'sojaroom', swappedFrom: 'room' });
  });

  it('approved: the stored swaps applied, checked empty, no plan', () => {
    const v = variantView('glutenvrij', SCHOTEL, GV_STORED, swaps, dict);
    expect(v.status).toBe('approved');
    expect(v.swapped).toEqual([0]);
    expect(v.lines[0]).toMatchObject({ ing: 'glutenvrije-pasta', raw: { nl: '400 g glutenvrije pasta' }, name: 'glutenvrije pasta', swappedFrom: 'spaghetti' });
    expect(v.unresolved).toEqual([]);
    expect(v.checked).toEqual([]);
    expect(v.plan).toBeUndefined();
  });

  it('stale: the line changed since the approval (spaghetti became penne); the plan is filled again', () => {
    const changed = [{ ...SCHOTEL[0]!, raw: { nl: '400 g penne' }, ing: 'penne', name: 'penne' }, ...SCHOTEL.slice(1)];
    const v = variantView('glutenvrij', changed, GV_STORED, swaps, dict);
    expect(v.status).toBe('stale');
    expect(v.swapped).toEqual([]);
    expect(v.unresolved).toEqual([0]);
    expect(v.lines[0]).toBe(changed[0]);
    expect(v.plan).toBeDefined();
    expect(v.plan!.diet).toBe('glutenvrij');
  });

  it('stale: a line that breaks the diet was not ticked; approved once mince and egg are both ticked', () => {
    const unticked = variantView('vegan', SCHOTEL, veganStored([]), swaps, dict);
    expect(unticked.status).toBe('stale');
    expect(unticked.swapped).toEqual([4]);
    expect(unticked.unresolved).toEqual([3, 5]);
    expect(unticked.checked).toEqual([]);
    expect(unticked.plan?.unresolved).toEqual([3, 5]);
    const both = variantView('vegan', SCHOTEL, veganStored([3, 5]), swaps, dict);
    expect(both.status).toBe('approved');
    expect(both.unresolved).toEqual([3, 5]);
    expect(both.checked).toEqual([3, 5]);
    expect(both.plan).toBeUndefined();
    const onlyEgg = variantView('vegan', SCHOTEL, veganStored([5]), swaps, dict);
    expect(onlyEgg.status).toBe('stale');
    expect(onlyEgg.checked).toEqual([5]);
  });

  it('an unapproved or unusable stored value counts as nothing stored (overrides are not normalised on restore)', () => {
    for (const odd of ['x', 42, null, [], { approved: true }, { approved: true, swaps: 'no' }, { ...GV_STORED, approved: false }]) {
      const v = variantView('glutenvrij', SCHOTEL, odd as unknown as RecipeVariant, swaps, dict);
      expect(v.status, JSON.stringify(odd)).toBe('proposed');
    }
    // a malformed swap inside an approval never applies: the tab asks to be checked again
    const broken: RecipeVariant = { ...GV_STORED, swaps: [{ index: 0, fromId: 'spaghetti' } as unknown as StoredSwap] };
    expect(variantView('glutenvrij', SCHOTEL, broken, swaps, dict).status).toBe('stale');
  });

  it('is derived only: the lines and the stored variant are never changed', () => {
    const before = JSON.stringify(SCHOTEL);
    const stored = JSON.stringify(GV_STORED);
    variantView('glutenvrij', SCHOTEL, GV_STORED, swaps, dict);
    variantView('vegan', SCHOTEL, undefined, swaps, dict);
    expect(JSON.stringify(SCHOTEL)).toBe(before);
    expect(JSON.stringify(GV_STORED)).toBe(stored);
    expect(SCHOTEL.some((l) => 'swappedFrom' in l)).toBe(false);
  });
});

describe('applyStoredSwap and storedSwapsFrom', () => {
  it('applyStoredSwap sets swappedFrom and leaves the source line (and its raw) alone', () => {
    const src = SCHOTEL[0]!;
    const raw = { ...src.raw };
    const out = applyStoredSwap(src, GV_STORED.swaps[0]!);
    expect(out).toMatchObject({ ing: 'glutenvrije-pasta', raw: { nl: '400 g glutenvrije pasta' }, name: 'glutenvrije pasta', swappedFrom: 'spaghetti', qty: { min: 400 }, unit: 'g' });
    expect(src.raw).toEqual(raw);
    expect(src.ing).toBe('spaghetti');
    expect('swappedFrom' in src).toBe(false);
    expect(out.raw).not.toBe(GV_STORED.swaps[0]!.raw);
    // a count turned into grams: the stored grams become the quantity
    const fillets = nl('4 kipfilets');
    const plan = planVariant({ lines: fillets }, 'vegan', swaps, dict);
    const [stored] = storedSwapsFrom(plan, new Set());
    expect(applyStoredSwap(fillets[0]!, stored!)).toMatchObject({ ing: 'tofu', qty: { min: 800 }, unit: 'g', swappedFrom: 'kipfilet' });
    // a line without an alternative gets no swappedAlt
    expect('swappedAlt' in out).toBe(false);
  });

  it('applyStoredSwap sets swappedAlt to the id of the alternative the swap drops (farfalle "of een andere pastasoort")', () => {
    const src = nl('225 g farfalle (of een andere pastasoort)')[0]!;
    expect(src.alt?.[0]?.ing).toBe('pasta');
    const plan = planVariant({ lines: [src] }, 'glutenvrij', swaps, dict);
    const [stored] = storedSwapsFrom(plan, new Set());
    expect(stored).toMatchObject({ fromId: 'farfalle', toId: 'glutenvrije-pasta', raw: { nl: '225 g glutenvrije pasta' } });
    const out = applyStoredSwap(src, stored!);
    expect(out).toMatchObject({ ing: 'glutenvrije-pasta', swappedFrom: 'farfalle', swappedAlt: 'pasta' });
    expect(out.alt).toBeUndefined();
    // the source line keeps its alternative and gets no display-only keys
    expect(src.alt?.[0]?.ing).toBe('pasta');
    expect('swappedAlt' in src).toBe(false);
    // an alternative the dictionary could not resolve gives no swappedAlt
    const unresolvedAlt: Line = { ...src, alt: [{ raw: { nl: 'iets anders' }, ing: null, name: 'iets anders' }] };
    expect('swappedAlt' in applyStoredSwap(unresolvedAlt, stored!)).toBe(false);
  });

  it('the proposed and the approved view both carry swappedAlt (warme pastasalade, gluten-free)', () => {
    const lines = nl('225 g farfalle (of een andere pastasoort)', '50 g rucola');
    const proposed = variantView('glutenvrij', lines, undefined, swaps, dict);
    expect(proposed.status).toBe('proposed');
    expect(proposed.lines[0]).toMatchObject({ swappedFrom: 'farfalle', swappedAlt: 'pasta' });
    const stored: RecipeVariant = { approved: true, by: 'Stijn', swaps: storedSwapsFrom(proposed.plan!, new Set()), checked: [] };
    const approved = variantView('glutenvrij', lines, stored, swaps, dict);
    expect(approved.status).toBe('approved');
    expect(approved.lines[0]).toMatchObject({ swappedFrom: 'farfalle', swappedAlt: 'pasta' });
    // never stored: the StoredSwap has no swappedAlt
    expect(stored.swaps.some((s) => 'swappedAlt' in s)).toBe(false);
  });

  it('storedSwapsFrom leaves out unticked and applies-false swaps and keeps fromId/toId/raw/name/grams', () => {
    const lines = nl('100 g boter of 100 g spekblokjes', '200 ml room', '4 kipfilets');
    const plan = planVariant({ lines }, 'vegan', swaps, dict);
    expect(plan.swaps.map((s) => [s.index, s.applies])).toEqual([
      [0, false],
      [1, true],
      [2, true],
    ]);
    expect(storedSwapsFrom(plan, new Set())).toEqual([
      { index: 1, fromId: 'room', toId: 'sojaroom', raw: { nl: '200 ml sojaroom' }, name: 'sojaroom' },
      { index: 2, fromId: 'kipfilet', toId: 'tofu', raw: { nl: '800 g tofu' }, name: 'tofu', grams: { min: 800 } },
    ]);
    // `off` holds line indexes
    expect(storedSwapsFrom(plan, new Set([1])).map((s) => s.index)).toEqual([2]);
    expect(storedSwapsFrom(plan, new Set([1, 2]))).toEqual([]);
    // no `applies`, no cook's note in storage
    for (const s of storedSwapsFrom(planVariant({ lines: SCHOTEL }, 'glutenvrij', swaps, dict), new Set())) {
      expect('applies' in s).toBe(false);
      expect('note' in s).toBe(false);
    }
  });
});

describe('variantTabs', () => {
  const ALL_NATURAL = nl('400 g glutenvrije pasta', '1 ui', '200 ml sojaroom');

  it('no row when every diet is natural and there are no personal versions; a row with one version', () => {
    const t = variantTabs(ALL_NATURAL, undefined, swaps, dict, 0);
    expect(t.show).toBe(false);
    expect(t.diets).toEqual(activeVariantDiets().map((diet) => ({ diet, status: 'natural' })));
    expect(variantTabs(ALL_NATURAL, null, swaps, dict, 1).show).toBe(true);
  });

  it('the status per active diet in tab order, from the stored variants', () => {
    const t = variantTabs(SCHOTEL, { glutenvrij: GV_STORED, vegan: veganStored([5]), notenvrij: { future: true } }, swaps, dict, 0);
    expect(t.show).toBe(true);
    expect(t.diets).toEqual([
      { diet: 'glutenvrij', status: 'approved' },
      { diet: 'vegetarisch', status: 'proposed' },
      { diet: 'vegan', status: 'stale' },
      { diet: 'lactosevrij', status: 'proposed' },
    ]);
    // the same statuses as variantView
    for (const d of t.diets) expect(variantView(d.diet, SCHOTEL, d.diet === 'glutenvrij' ? GV_STORED : d.diet === 'vegan' ? veganStored([5]) : undefined, swaps, dict).status).toBe(d.status);
  });
});

describe('tagsWithVariants', () => {
  it("adds '<diet>-optie' for every approved diet, without duplicates", () => {
    expect(tagsWithVariants({ tags: ['oven', 'kids'], variants: { glutenvrij: GV_STORED } })).toEqual(['oven', 'kids', 'glutenvrij-optie']);
    expect(tagsWithVariants({ tags: ['glutenvrij-optie', 'oven'], variants: { glutenvrij: GV_STORED } })).toEqual(['glutenvrij-optie', 'oven']);
    // vegan is vegetarian too (DIET_TAGS_FOR): an approved vegan tab also gives 'vega-optie'
    expect(tagsWithVariants({ tags: ['oven'], variants: { vegan: veganStored([3, 5]), lactosevrij: { ...GV_STORED } } })).toEqual(['oven', 'vega-optie', 'vegan-optie', 'lactosevrij-optie']);
    expect(tagsWithVariants({ tags: ['vega-optie'], variants: { vegetarisch: { ...GV_STORED }, vegan: veganStored([3, 5]) } })).toEqual(['vega-optie', 'vegan-optie']);
  });

  it('mirrors DIET_TAGS_FOR: per approved diet the -optie tag of each of its diet tags', () => {
    for (const diet of VARIANT_DIETS) {
      const got = tagsWithVariants({ tags: [], variants: { [diet]: { ...GV_STORED } } });
      expect(got, diet).toEqual(DIET_TAGS_FOR[diet].map((t) => OPTIE_TAG_FOR[t as keyof typeof OPTIE_TAG_FOR]));
    }
    expect(tagsWithVariants({ tags: [], variants: { vegan: { ...GV_STORED } } })).toEqual(['vega-optie', 'vegan-optie']);
  });

  it('a stale approval counts until it is withdrawn', () => {
    const stale = veganStored([]);
    expect(variantView('vegan', SCHOTEL, stale, swaps, dict).status).toBe('stale');
    expect(tagsWithVariants({ tags: ['oven'], variants: { vegan: stale } })).toEqual(['oven', 'vega-optie', 'vegan-optie']);
  });

  it('a variant that is not approved, a future diet key or no variants add nothing', () => {
    expect(tagsWithVariants({ tags: ['oven'], variants: { glutenvrij: { ...GV_STORED, approved: false } } })).toEqual(['oven']);
    expect(tagsWithVariants({ tags: ['oven'], variants: { notenvrij: { ...GV_STORED } } })).toEqual(['oven']);
    expect(tagsWithVariants({ tags: ['oven'], variants: null })).toEqual(['oven']);
    expect(tagsWithVariants({ tags: ['oven'] })).toEqual(['oven']);
  });
});

describe('personal versions and ?v=', () => {
  it('versionName per language that is there (invariant 3)', () => {
    expect(versionName({ nl: 'Goulash', en: 'Goulash' }, 'Dino')).toEqual({ nl: 'Goulash (versie van Dino)', en: "Goulash (Dino's version)" });
    expect(versionName({ nl: 'Goulash' }, 'Dino')).toEqual({ nl: 'Goulash (versie van Dino)' });
    expect(versionName({ en: ' Goulash ' }, 'Dino')).toEqual({ en: "Goulash (Dino's version)" });
  });

  it('versionAuthor: the first name of the author (own) or the sender (received), else null', () => {
    expect(versionAuthor({ origin: { kind: 'user', author: 'Dino Rutgers' } })).toBe('Dino');
    expect(versionAuthor({ origin: { kind: 'received', receivedFrom: 'Gabi', author: 'Stijn' } })).toBe('Gabi');
    expect(versionAuthor({ origin: { kind: 'user', author: null } })).toBeNull();
    expect(versionAuthor({ origin: { kind: 'received', receivedFrom: '  ' } })).toBeNull();
    expect(versionAuthor({ origin: { kind: 'builtin' } })).toBeNull();
  });

  it('parseVariantParam: only an approved diet', () => {
    expect(parseVariantParam('glutenvrij', ['glutenvrij'])).toBe('glutenvrij');
    expect(parseVariantParam('vegan', ['glutenvrij'])).toBeNull();
    expect(parseVariantParam('x', ['glutenvrij'])).toBeNull();
    expect(parseVariantParam(null, ['glutenvrij'])).toBeNull();
    expect(parseVariantParam('', ['glutenvrij'])).toBeNull();
  });
});
