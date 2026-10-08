// Recipe variants (docs/phase-5-spec.md block F.2, src/domain/variants.ts): planVariant over the
// real dictionary + data/swaps.json, the raw-text name replacement (whole word, plural, both
// languages, capital, alternatives), makeVariant (new id, variantOf, tags, name suffix, only ticked
// swaps, original untouched), variantOf travelling in a share token, and validateSwaps.
import { describe, expect, it } from 'vitest';
import swapsJson from '../data/swaps.json';
import { defaultDictionary, defaultDictionaryData, ingredientsData } from '../src/domain/data';
import { loadDictionary, type Ingredient } from '../src/domain/dictionary';
import { dietTags } from '../src/domain/diet';
import type { Line, Recipe } from '../src/domain/model';
import { parseLine } from '../src/domain/parser';
import { normalizeRecipe } from '../src/domain/recipe-io';
import { renderLine } from '../src/domain/render';
import { buildRecipeEnvelope, parseEnvelope } from '../src/domain/share';
import { decodeToken, encodeToken } from '../src/domain/token';
import {
  applySwap,
  lineBreaksDiet,
  makeVariant,
  planVariant,
  variantDietsFor,
  variantName,
  variantTags,
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
  it('offers only the diets a line contradicts and that are not tagged by hand', () => {
    expect(variantDietsFor({ tags: [] }, SCHOTEL, dict)).toEqual(['glutenvrij', 'vegetarisch', 'vegan']);
    expect(variantDietsFor({ tags: ['vegetarisch'] }, SCHOTEL, dict)).toEqual(['glutenvrij', 'vegan']);
    expect(variantDietsFor({ tags: [] }, nl('400 g glutenvrije pasta', '1 ui', '200 ml sojaroom'), dict)).toEqual([]);
    expect(variantDietsFor({ tags: [] }, nl('1 ui', '1 el mysterieus poeder'), dict)).toEqual([]);
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
    // the classic's curator marker does not travel: an own recipe has no "Machine translation" path
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
});
