// The shopping-list merge (PLAN.md §8 "Merge-algoritme", src/domain/aggregate.ts): one test per
// rule, the four worked examples from the plan, rendering, the plain-text share format and the
// rounding / step tables. Uses the REAL dictionary (data/ingredients.json) and the real parser,
// so the expectations follow the data: the plan's "Klontje boter (15 g)" is 20 g in the data.
import { describe, expect, it } from 'vitest';
import {
  adjustStep,
  aggregate,
  effectiveQty,
  groupByAisle,
  isoWeekNumber,
  listAsText,
  renderListItem,
  roundForDisplay,
  STAPLE_THRESHOLD,
  type AggregateInput,
  type ListItem,
} from '../src/domain/aggregate';
import { defaultDictionary } from '../src/domain/data';
import type { Line, Recipe } from '../src/domain/model';
import { parseLine } from '../src/domain/parser';
import type { Plan, PlanItem } from '../src/domain/planner';

const dict = defaultDictionary();

function rec(id: string, nameNl: string, raws: string[], servings = 4, nameEn?: string): Recipe {
  return {
    schema: 2,
    id,
    rev: 1,
    createdAt: 'x',
    updatedAt: 'x',
    origin: { kind: 'builtin' },
    name: nameEn ? { nl: nameNl, en: nameEn } : { nl: nameNl },
    tags: [],
    servings,
    lines: raws.map((raw) => parseLine(raw, dict, 'nl')),
    steps: [],
    goesWith: [],
    aliases: [],
  };
}

function slot(recipeId: string, servings = 4, extra: Partial<PlanItem> = {}): PlanItem {
  return { id: `pi:${recipeId}`, recipeId, servings, addedAt: 'x', ...extra };
}

function run(recipes: Recipe[], items?: PlanItem[], over: Partial<AggregateInput> = {}): ListItem[] {
  const plan: Plan = { id: 'current', items: items ?? recipes.map((r) => slot(r.id)), updatedAt: 'x' };
  const map = new Map(recipes.map((r) => [r.id, r]));
  return aggregate({
    plan,
    recipes: map,
    lines: (id) => map.get(id)?.lines ?? [],
    dict,
    pantry: new Set(),
    extras: [],
    ...over,
  });
}

const byIng = (items: ListItem[], ing: string, variant: string | null = null) => items.filter((it) => it.ing === ing && (it.variant ?? null) === variant);
const one = (items: ListItem[], ing: string, variant: string | null = null): ListItem => {
  const hits = byIng(items, ing, variant);
  if (hits.length !== 1) throw new Error(`expected one item for ${ing}|${variant ?? ''}, got ${hits.length}: ${hits.map((h) => h.key).join(', ')}`);
  return hits[0] as ListItem;
};
const nl = (it: ListItem) => renderListItem(it, dict, 'nl');
const en = (it: ListItem) => renderListItem(it, dict, 'en');

// --- The four worked examples (PLAN.md §8) ------------------------------------------------------

describe('worked examples from PLAN.md §8', () => {
  it('knoflook: 1 teentje + 4 teentjes + 1 teen + ½ teentje -> "7 teentjes knoflook (≈1 bol)" / "7 cloves garlic (≈1 bulb)"', () => {
    const items = run([rec('b:a', 'A', ['1 teentje knoflook']), rec('b:b', 'B', ['4 teentjes knoflook', '1 teen knoflook']), rec('b:c', 'C', ['½ teentje knoflook'])]);
    const it = one(items, 'knoflook');
    expect(it.key).toBe('knoflook||teen');
    expect(it.baseQty).toBe(6.5);
    expect(it.baseUnit).toBe('teen');
    expect(it.qty).toBe(7);
    expect(it.unit).toBe('teen');
    // 6½ teentjes ≥ the count threshold: a staple that became a real shopping line.
    expect(it.section).toBe('main');
    expect(it.aisle).toBe('groente-fruit');
    expect(nl(it)).toBe('7 teentjes knoflook (≈1 bol)');
    expect(en(it)).toBe('7 cloves garlic (≈1 bulb)');
    expect(it.sources.map((s) => s.recipeId)).toEqual(['b:a', 'b:b', 'b:b', 'b:c']);
  });

  it('uien: 1 ui + 1 grote ui + 2 uien -> "4 uien (1 grote)"; 1 rode ui stays apart', () => {
    const items = run([rec('b:a', 'A', ['1 ui', '1 rode ui']), rec('b:b', 'B', ['1 grote ui', '2 uien'])]);
    const ui = one(items, 'ui');
    expect(ui.key).toBe('ui||stuk');
    expect(ui.qty).toBe(4);
    expect(ui.unit).toBeNull();
    expect(nl(ui)).toBe('4 uien (1 grote)');
    expect(en(ui)).toBe('4 onions (1 large)');
    const rode = one(items, 'ui', 'rode');
    expect(rode.key).toBe('ui|rode|stuk');
    expect(nl(rode)).toBe('1 rode ui');
    expect(en(rode)).toBe('1 red onion');
  });

  it('tomaten: 8 + 500 g + 2 -> "15 tomaten" (fold g -> stuk via gramsPer); tinned tomatoes are other ids', () => {
    const items = run([rec('b:a', 'A', ['8 tomaten', '600 g stukjes tomaat uit blik']), rec('b:b', 'B', ['500 g tomaten', '2 tomaten', '1 pak (500 g) gezeefde tomaten'])]);
    const tomaat = one(items, 'tomaat');
    expect(tomaat.key).toBe('tomaat||stuk');
    expect(tomaat.baseQty).toBe(15);
    expect(nl(tomaat)).toBe('15 tomaten');
    expect(en(tomaat)).toBe('15 tomatoes');
    expect(one(items, 'tomatenblokjes').aisle).toBe('blik-pot');
    expect(nl(one(items, 'tomatenblokjes'))).toBe('600 g tomatenblokjes');
    expect(one(items, 'tomatensaus').unit).toBe('pak');
  });

  it('boter: 50 g + 1 el + Klontje + "boter om in te bakken" -> Voorraadcheck "boter (≈ 85 g)" (data: el 15 g, klontje 20 g; the plan estimated 80)', () => {
    const items = run([rec('b:a', 'A', ['50 g boter', '1 el boter']), rec('b:b', 'B', ['Klontje boter', 'boter om in te bakken'])]);
    const boter = one(items, 'boter');
    expect(boter.section).toBe('staples');
    expect(boter.qty).toBe(0);
    expect(boter.baseQty).toBe(85);
    expect(boter.baseUnit).toBe('g');
    expect(boter.sources).toHaveLength(4);
    expect(nl(boter)).toBe('boter (≈ 85 g)');
    expect(en(boter)).toBe('butter (≈ 85 g)');
    // Below the 100 g threshold it stays a staple; from 100 g it is a real line.
    expect(one(run([rec('b:c', 'C', ['300 g boter'])]), 'boter').section).toBe('main');
    expect(one(run([rec('b:d', 'D', ['100 g boter'])]), 'boter').section).toBe('main');
    expect(STAPLE_THRESHOLD).toEqual({ g: 100, ml: 100, count: 5, package: 1 });
  });

  it('V1b threshold: "200 g bloem" in one recipe -> main list with its amount; "2 el bloem" -> Voorraad at 0', () => {
    const big = one(run([rec('b:a', 'A', ['200 g bloem'])]), 'bloem');
    expect(big.section).toBe('main');
    expect(big.qty).toBe(200);
    expect(nl(big)).toBe('200 g bloem');
    const small = one(run([rec('b:b', 'B', ['2 el bloem'])]), 'bloem');
    expect(small.section).toBe('staples');
    expect(small.qty).toBe(0);
  });

  it('rode peper: ½ rode peper + 1 Spaanse peper are chillies in groente-fruit, never black pepper', () => {
    const items = run([rec('b:a', 'A', ['½ rode peper', 'zout en peper']), rec('b:b', 'B', ['1 Spaanse peper'])]);
    const rode = one(items, 'rode-peper');
    expect(rode.aisle).toBe('groente-fruit');
    expect(rode.section).toBe('main');
    expect(nl(rode)).toBe('1 rode peper');
    expect(en(rode)).toBe('1 red chilli');
    expect(nl(one(items, 'spaanse-peper'))).toBe('1 Spaanse peper');
    expect(byIng(items, 'peper')).toEqual([]);
    expect(byIng(items, 'zwarte-peper')).toEqual([]);
    expect(one(items, 'zout-en-peper').section).toBe('staples');
  });
});

// --- One test per rule ---------------------------------------------------------------------------

describe('rule 1: factor and cooked dishes', () => {
  it('scales by item.servings / recipe.servings and skips cooked dishes', () => {
    const pasta = rec('b:p', 'Pasta', ['400 g pasta', '2 uien']);
    const soep = rec('b:s', 'Soep', ['3 uien'], 2);
    const items = run([pasta, soep], [slot('b:p', 2), slot('b:s', 4)]);
    expect(one(items, 'pasta').qty).toBe(200);
    // 2 uien × ½ + 3 uien × 2 = 7
    expect(one(items, 'ui').baseQty).toBe(7);
    const cooked = run([pasta, soep], [slot('b:p', 4), slot('b:s', 2, { cooked: true })]);
    expect(one(cooked, 'ui').baseQty).toBe(2);
    expect(one(cooked, 'ui').sources.map((s) => s.recipeId)).toEqual(['b:p']);
    // Unknown recipe ids are ignored.
    expect(run([pasta], [slot('b:nope')])).toEqual([]);
  });
});

describe('rule 2: unresolved lines and pm', () => {
  it('ing null -> section check with the raw text, never scaled, the factor shown as ×N', () => {
    const r = rec('b:a', 'Erwtensoep', ['Iets lekkers voor erbij', '1 ui'], 4, 'Pea soup');
    const line = r.lines[0] as Line;
    expect(line.ing).toBeNull();
    const items = run([r], [slot('b:a', 6)]);
    const check = items.find((it) => it.section === 'check');
    expect(check).toBeDefined();
    expect(check?.key).toBe('raw|b:a|0');
    expect(check?.qty).toBeNull();
    expect(check?.factor).toBe(1.5);
    expect(check?.sources[0]?.scaled).toBe('Iets lekkers voor erbij ×1,5');
    expect(nl(check as ListItem)).toBe('Iets lekkers voor erbij ×1,5');
    // Check items come last.
    expect(items[items.length - 1]).toBe(check);
    // An `ing` the dictionary does not know (a user entry from the other phone) counts as unresolved.
    const foreign = rec('b:f', 'F', ['1 pot pesto']);
    (foreign.lines[0] as Line).ing = 'pesto-van-oma';
    expect(run([foreign])[0]?.section).toBe('check');
  });

  it('qty = max ?? min ("2-3" -> 3); no quantity -> "pm" without a number', () => {
    const items = run([rec('b:a', 'A', ['2-3 uien', 'rookworst'])]);
    expect(one(items, 'ui').qty).toBe(3);
    const worst = one(items, 'rookworst');
    expect(worst.qty).toBeNull();
    expect(worst.baseQty).toBeNull();
    expect(worst.section).toBe('main');
    expect(nl(worst)).toBe('rookworst (pm)');
    expect(en(worst)).toBe('smoked sausage (as needed)');
  });
});

describe('rule 3: base units', () => {
  it('mass -> g, volume -> ml, spoons of a gram-based ingredient -> g via gramsPer, pieces -> stuk', () => {
    const items = run([rec('b:a', 'A', ['1 kg aardappelen', '1 dl melk', '2 el suiker', '3 courgettes'])]);
    expect(one(items, 'aardappel')).toMatchObject({ baseQty: 1000, baseUnit: 'g', qty: 1000, unit: 'g' });
    expect(nl(one(items, 'aardappel'))).toBe('1 kg aardappelen');
    expect(one(items, 'melk')).toMatchObject({ baseQty: 100, baseUnit: 'ml' });
    expect(one(items, 'suiker')).toMatchObject({ baseQty: 24, baseUnit: 'g' });
    expect(one(items, 'courgette')).toMatchObject({ baseQty: 3, baseUnit: 'stuk', unit: null });
  });

  it('package units count per piece and never fold to grams', () => {
    const items = run([rec('b:a', 'A', ['1 blik tomatenblokjes']), rec('b:b', 'B', ['400 g tomatenblokjes', '2 blikken tomatenblokjes'])]);
    const hits = byIng(items, 'tomatenblokjes');
    expect(hits.map((h) => h.key).sort()).toEqual(['tomatenblokjes||blik', 'tomatenblokjes||g']);
    const tins = hits.find((h) => h.unit === 'blik') as ListItem;
    expect(tins.qty).toBe(3);
    expect(nl(tins)).toBe('3 blikken tomatenblokjes');
    expect(en(tins)).toBe('3 tins chopped tomatoes');
  });

  it('pinch units never sum: "1 mp nootmuskaat" twice is still pm', () => {
    const items = run([rec('b:a', 'A', ['1 mp nootmuskaat']), rec('b:b', 'B', ['1 mp nootmuskaat'])]);
    const it = one(items, 'nootmuskaat');
    expect(it.baseQty).toBeNull();
    expect(it.section).toBe('staples');
    expect(it.sources).toHaveLength(2);
    expect(nl(it)).toBe('nootmuskaat');
  });
});

describe('rule 4-5: keys and folding', () => {
  it('the key is ing | variant | base unit; only qualifiers with variant: true split it', () => {
    const items = run([rec('b:a', 'A', ['1 grote ui', '1 kleine ui', '1 rode ui', '2 verse rode pepers'])]);
    expect(one(items, 'ui').key).toBe('ui||stuk');
    expect(one(items, 'ui').qualCounts).toEqual({ grote: 1, kleine: 1 });
    expect(one(items, 'ui', 'rode').key).toBe('ui|rode|stuk');
    expect(one(items, 'rode-peper').key).toBe('rode-peper||stuk');
    expect(nl(one(items, 'rode-peper'))).toBe('2 rode pepers');
  });

  it('pieces of a gram-based ingredient join the grams: 2 kipfilets + 500 g -> 900 g', () => {
    const items = run([rec('b:a', 'A', ['2 kipfilets']), rec('b:b', 'B', ['500 g kipfilet'])]);
    const kip = one(items, 'kipfilet');
    expect(kip.key).toBe('kipfilet||g');
    expect(kip.baseQty).toBe(900);
    expect(nl(kip)).toBe('900 g kipfilets');
  });

  it('a mass buyUnit folds pieces to grams: 4 aardappelen + 500 g -> 1,1 kg', () => {
    const items = run([rec('b:a', 'A', ['4 aardappelen']), rec('b:b', 'B', ['500 g aardappelen'])]);
    const a = one(items, 'aardappel');
    expect(a.key).toBe('aardappel||g');
    expect(a.baseQty).toBe(1100);
    expect(nl(a)).toBe('1,1 kg aardappelen');
    expect(en(a)).toBe('1.1 kg potatoes');
    // Pieces alone stay pieces.
    expect(nl(one(run([rec('b:c', 'C', ['4 aardappelen'])]), 'aardappel'))).toBe('4 aardappelen');
  });

  it('a count buyUnit with a known weight folds towards it: 6 teentjes + 1 bol knoflook -> 2 bollen', () => {
    const items = run([rec('b:a', 'A', ['6 teentjes knoflook', '1 bol knoflook'])]);
    const k = one(items, 'knoflook');
    expect(k.key).toBe('knoflook||bol');
    expect(k.baseQty).toBeCloseTo(1.6);
    expect(nl(k)).toBe('2 bollen knoflook');
  });

  it('spoons keep their spoon when every source was a spoon: 2 el + 1 el sojasaus -> "(≈ 3 el)"', () => {
    const items = run([rec('b:a', 'A', ['2 el sojasaus']), rec('b:b', 'B', ['1 el sojasaus'])]);
    const s = one(items, 'sojasaus');
    expect(s.baseQty).toBe(45);
    expect(s.baseUnit).toBe('ml');
    expect(nl(s)).toBe('sojasaus (≈ 3 el)');
    expect(en(s)).toBe('soy sauce (≈ 3 tbsp)');
    // A pinned staple, once tapped to 1, reads as one bottle.
    expect(nl({ ...s, adjusted: 1 })).toBe('1 fles sojasaus (≈ 3 el)');
  });
});

describe('rule 6: rounding for display', () => {
  it('roundForDisplay: pieces ceil; g 5 / 10 / 100; ml likewise; spoons ½; pinch unchanged', () => {
    expect(roundForDisplay(6.5, null, dict)).toBe(7);
    expect(roundForDisplay(0.5, null, dict)).toBe(1);
    expect(roundForDisplay(1.2, 'teen', dict)).toBe(2);
    expect(roundForDisplay(1.6, 'blik', dict)).toBe(2);
    expect(roundForDisplay(2, 'g', dict)).toBe(5);
    expect(roundForDisplay(62.25, 'g', dict)).toBe(60);
    expect(roundForDisplay(85, 'g', dict)).toBe(85);
    expect(roundForDisplay(437, 'g', dict)).toBe(440);
    expect(roundForDisplay(1260, 'g', dict)).toBe(1300);
    expect(roundForDisplay(1.26, 'kg', dict)).toBe(1.3);
    expect(roundForDisplay(437, 'ml', dict)).toBe(440);
    expect(roundForDisplay(1.3, 'el', dict)).toBe(1.5);
    expect(roundForDisplay(0.1, 'tl', dict)).toBe(0.5);
    expect(roundForDisplay(1, 'mp', dict)).toBe(1);
    expect(roundForDisplay(0, 'g', dict)).toBe(0);
  });

  it('adjustStep: pieces 1; g 10 / 25 / 50; ml 10 / 50 / 100; spoons ½', () => {
    expect(adjustStep(null, 3)).toBe(1);
    expect(adjustStep('blik', 3)).toBe(1);
    expect(adjustStep('g', 50)).toBe(10);
    expect(adjustStep('g', 100)).toBe(25);
    expect(adjustStep('g', 499)).toBe(25);
    expect(adjustStep('g', 500)).toBe(50);
    expect(adjustStep('ml', 50)).toBe(10);
    expect(adjustStep('ml', 250)).toBe(50);
    expect(adjustStep('ml', 900)).toBe(100);
    expect(adjustStep('el', 2)).toBe(0.5);
    expect(adjustStep('tl', 1)).toBe(0.5);
  });

  it('effectiveQty adds the user delta and never goes below 0; "1,3 kg" and "1,5 l" formatting (phase 5: decimals for kg/l)', () => {
    expect(effectiveQty({ qty: 4, adjusted: -1 })).toBe(3);
    expect(effectiveQty({ qty: 1, adjusted: -5 })).toBe(0);
    expect(effectiveQty({ qty: null })).toBeNull();
    expect(effectiveQty({ qty: null, adjusted: 1 })).toBe(1);
    const items = run([rec('b:a', 'A', ['1,5 l melk', '1,3 kg aardappelen'])]);
    // melk is a staple, but 1,5 l is far over the 100 ml threshold: a real line.
    expect(one(items, 'melk').section).toBe('main');
    expect(nl(one(items, 'melk'))).toBe('1,5 l melk');
    // g/ml totals are whole numbers (PLAN §0 "Kleine wensen"): never "62¼ g" (boter is a staple: "(≈ 60 g)").
    expect(nl(one(run([rec('b:b', 'B', ['62,25 g boter'])]), 'boter'))).toBe('boter (≈ 60 g)');
    expect(nl(one(items, 'aardappel'))).toBe('1,3 kg aardappelen');
    expect(nl({ ...one(items, 'aardappel'), adjusted: 50 })).toBe('1,35 kg aardappelen');
  });
});

describe('rule 7: routing and aisle order', () => {
  it('pantry -> inHouse; staple -> staples at 0; unresolved -> check; rest -> main, grouped by aisle in data order', () => {
    const items = run([rec('b:a', 'A', ['400 g pasta', '2 uien', '1 el olijfolie', '200 g feta', 'iets vaags'])], undefined, { pantry: new Set(['pasta']) });
    expect(items.map((it) => it.section)).toEqual(['main', 'main', 'staples', 'inHouse', 'check']);
    expect(items.map((it) => it.aisle)).toEqual(['groente-fruit', 'kaas', 'sauzen-olie-azijn', 'droog', 'overig']);
    expect(one(items, 'pasta').inHouse).toBe(true);
    // olijfolie has no buyUnit in the data: "1× olijfolie" once tapped (sojasaus, with buyUnit fles, reads "1 fles").
    expect(one(items, 'olijfolie')).toMatchObject({ qty: 0, unit: null, baseQty: 15, baseUnit: 'ml', spoon: true });
    expect(nl(one(items, 'olijfolie'))).toBe('olijfolie (≈ 1 el)');
    expect(nl({ ...one(items, 'olijfolie'), adjusted: 1 })).toBe('1× olijfolie (≈ 1 el)');
    // A staple without a count/package buyUnit reads "1× …" once tapped.
    const zp = one(run([rec('b:z', 'Z', ['zout en peper'])]), 'zout-en-peper');
    expect(nl({ ...zp, adjusted: 1 })).toBe('1× zout en peper');
    expect(en({ ...zp, adjusted: 1 })).toBe('1× salt and pepper');
  });

  it('groupByAisle sorts names in the UI language within an aisle', () => {
    const items = run([rec('b:a', 'A', ['2 uien', '1 courgette', '3 tomaten', '200 g kaas'])]);
    const groups = groupByAisle(items, dict, 'nl');
    expect(groups.map((g) => g.id)).toEqual(['groente-fruit', 'kaas']);
    expect(groups[0]?.aisle?.nl).toBe('Groente & fruit');
    expect(groups[0]?.items.map((it) => it.ing)).toEqual(['courgette', 'tomaat', 'ui']);
    expect(groupByAisle(items, dict, 'en')[0]?.items.map((it) => it.ing)).toEqual(['courgette', 'ui', 'tomaat']);
  });
});

describe('rule 8: regenerating against the previous list', () => {
  const base = [rec('b:a', 'A', ['2 uien', '400 g pasta', '1 courgette'])];

  it('keeps checked / adjusted / pinned by key, drops vanished keys and flags new ones', () => {
    const first = run(base);
    expect(first.every((it) => it.fresh === undefined)).toBe(true);
    const previous = first.map((it) => {
      if (it.ing === 'ui') return { ...it, checked: true, adjusted: 1 };
      if (it.ing === 'pasta') return { ...it, inHouse: true };
      if (it.ing === 'courgette') return { ...it, pinned: true };
      return it;
    });
    const next = run([rec('b:a', 'A', ['3 uien', '1 paprika'])], undefined, { previous });
    const ui = one(next, 'ui');
    expect(ui).toMatchObject({ qty: 3, checked: true, adjusted: 1 });
    expect(ui.fresh).toBeUndefined();
    expect(byIng(next, 'pasta')).toEqual([]); // vanished, not pinned
    const courgette = one(next, 'courgette'); // vanished but pinned: kept as it was, without sources
    expect(courgette.pinned).toBe(true);
    expect(courgette.sources).toEqual([]);
    expect(one(next, 'paprika').fresh).toBe(true);
  });

  it('"Heb ik al" comes from the pantry, not from the previous list: a perishable returns, a pantry row keeps an item in house', () => {
    const first = run([rec('b:a', 'A', ['1 paprika', '2 el sojasaus', '400 g pasta'])]);
    // The user held "Heb ik al" on all three; the repo only wrote the non-perishables to the pantry.
    const previous = first.map((it) => ({ ...it, inHouse: true }));
    const pantry = new Set(['sojasaus']);
    const next = run([rec('b:a', 'A', ['1 paprika', '2 el sojasaus', '400 g pasta'])], undefined, { previous, pantry });
    expect(one(next, 'paprika').section).toBe('main'); // perishable: back on the list (DEVICE-TEST row 29)
    expect(one(next, 'paprika').inHouse).toBeUndefined();
    expect(one(next, 'sojasaus').section).toBe('inHouse');
    expect(one(next, 'pasta').section).toBe('main'); // pantry row expired / never written: the list follows the pantry
    // A label-only extra has no pantry row: its own flag is the memory.
    const extras: ListItem[] = [{ key: 'x|1', label: { nl: 'wc-papier', en: 'loo roll' }, aisle: 'huishoudelijk', section: 'main', sources: [], inHouse: true }];
    expect(run([], [], { extras, pantry }).find((it) => it.key === 'x|1')?.section).toBe('inHouse');
    // A pinned item that vanished from the plan follows the pantry too.
    const pinnedPrev = first.map((it) => (it.ing === 'paprika' ? { ...it, pinned: true, inHouse: true } : it));
    expect(one(run([], [], { previous: pinnedPrev, pantry }), 'paprika').inHouse).toBeUndefined();
  });

  it('drops a previous adjustment when the display unit changed (a staple tapped to "1 pak" that became a real line)', () => {
    const boter = one(run([rec('b:a', 'A', ['50 g boter'])]), 'boter');
    expect(boter.section).toBe('staples');
    const previous = [{ ...boter, adjusted: 1 }];
    expect(nl(previous[0] as ListItem)).toBe('1 pak boter (≈ 50 g)');
    const grown = one(run([rec('b:a', 'A', ['300 g boter'])], undefined, { previous }), 'boter');
    expect(grown.section).toBe('main');
    expect(grown.adjusted).toBeUndefined();
    expect(nl(grown)).toBe('300 g boter');
    // Same unit, same class: the delta survives.
    const same = one(run([rec('b:a', 'A', ['60 g boter'])], undefined, { previous }), 'boter');
    expect(same.adjusted).toBe(1);
  });

  it('extras are included with their aisle and state, and survive a regeneration', () => {
    const extras: ListItem[] = [
      { key: 'x|1', label: { nl: 'wc-papier', en: 'toilet paper' }, aisle: 'huishoudelijk', section: 'main', sources: [], qty: 2, unit: null },
      { key: 'x|2', ing: 'melk', aisle: '', section: 'main', sources: [], qty: 1, unit: 'l' },
    ];
    const first = run(base, undefined, { extras });
    expect(first.find((it) => it.key === 'x|1')).toMatchObject({ manual: true, aisle: 'huishoudelijk', section: 'main' });
    expect(nl(first.find((it) => it.key === 'x|1') as ListItem)).toBe('2 wc-papier');
    expect(first.find((it) => it.key === 'x|2')).toMatchObject({ manual: true, aisle: 'zuivel-eieren' });
    expect(nl(first.find((it) => it.key === 'x|2') as ListItem)).toBe('1 l melk');
    // A hand-added dictionary item without a number is just its name, never "(pm)" (screen and shared text agree).
    const plain = run([], [], { extras: [{ key: 'x|3', ing: 'melk', aisle: '', section: 'main', sources: [], qty: null, unit: null }] });
    expect(nl(plain[0] as ListItem)).toBe('melk');
    expect(en(plain[0] as ListItem)).toBe('milk');
    expect(listAsText(plain, dict, 'nl', { title: 'T' })).toBe('T\nZuivel & eieren\n☐ melk');
    const previous = first.map((it) => (it.key === 'x|1' ? { ...it, checked: true } : it));
    const next = run([], [], { extras, previous });
    expect(next.map((it) => it.key)).toEqual(['x|2', 'x|1']); // aisle order: zuivel before huishoudelijk
    expect(next.find((it) => it.key === 'x|1')?.checked).toBe(true);
    expect(next.find((it) => it.key === 'x|2')?.fresh).toBeUndefined();
  });

  it('does not mutate its inputs', () => {
    const r = rec('b:a', 'A', ['2 uien']);
    const before = JSON.stringify(r);
    const prev: ListItem[] = [{ key: 'ui||stuk', ing: 'ui', aisle: 'groente-fruit', section: 'main', sources: [], checked: true }];
    const prevJson = JSON.stringify(prev);
    run([r], undefined, { previous: prev });
    expect(JSON.stringify(r)).toBe(before);
    expect(JSON.stringify(prev)).toBe(prevJson);
  });
});

// --- Plain text --------------------------------------------------------------------------------

describe('listAsText (PLAN.md §8 "Delen van de lijst")', () => {
  const recipes = [
    rec('b:dahl', 'Dahl', ['1 ui', '1 grote ui', '2 uien', '4 teentjes knoflook', '50 g boter', 'Iets lekkers voor erbij'], 4, 'Dahl'),
    rec('b:lasagne', 'Klassieke lasagne', ['500 g kipfilet', '3 teentjes knoflook', '2 el olijfolie'], 4, 'Classic lasagne'),
  ];

  it('title, aisle headers in data order, ☐ lines, "Controleer zelf" last with (NL), dishes at the bottom; staples at 0 left out', () => {
    const items = run(recipes);
    const text = listAsText(items, dict, 'nl', { title: 'Boodschappen wk 39 · 2 gerechten · 4 pers.' });
    // "500 g kipfilets": mass units take the dictionary plural, like the recipe pages (render.ts).
    expect(text).toBe(
      [
        'Boodschappen wk 39 · 2 gerechten · 4 pers.',
        'Groente & fruit',
        '☐ 7 teentjes knoflook (≈1 bol)',
        '☐ 4 uien (1 grote)',
        'Vlees & vis',
        '☐ 500 g kipfilets',
        'Controleer zelf',
        '☐ Iets lekkers voor erbij',
        '— Dahl, Klassieke lasagne',
      ].join('\n'),
    );
    const english = listAsText(items, dict, 'en', { title: 'Shopping wk 39' });
    expect(english.split('\n')).toEqual([
      'Shopping wk 39',
      'Fruit & vegetables',
      '☐ 7 cloves garlic (≈1 bulb)',
      '☐ 4 onions (1 large)',
      'Meat & fish',
      '☐ 500 g chicken breasts',
      'Check yourself',
      '☐ Iets lekkers voor erbij (NL)',
      '— Dahl, Classic lasagne',
    ]);
  });

  it('hides checked / in-house lines on request, marks them otherwise, and includes a tapped staple in its aisle', () => {
    const items = run(recipes).map((it) => {
      if (it.ing === 'ui') return { ...it, checked: true };
      if (it.ing === 'kipfilet') return { ...it, inHouse: true };
      if (it.ing === 'boter') return { ...it, adjusted: 1 };
      return it;
    });
    const full = listAsText(items, dict, 'nl', { title: 'T' });
    expect(full).toContain('☑ 4 uien (1 grote)');
    expect(full).toContain('☐ 500 g kipfilets (in huis)');
    expect(full).toContain('Zuivel & eieren\n☐ 1 pak boter (≈ 50 g)');
    const hidden = listAsText(items, dict, 'nl', { title: 'T', hideChecked: true, hideInHouse: true });
    expect(hidden).not.toContain('uien');
    expect(hidden).not.toContain('kipfilet');
    expect(hidden).not.toContain('Vlees & vis');
    expect(hidden).toContain('— Dahl, Klassieke lasagne');
  });

  it('leaves out a line stepped down to 0 ("niet nodig"), like a staple at rest', () => {
    const items = run(recipes).map((it) => (it.ing === 'ui' ? { ...it, adjusted: -(it.qty ?? 0) } : it));
    const text = listAsText(items, dict, 'nl', { title: 'T' });
    expect(text).not.toContain('uien');
    expect(text).not.toContain('☐ 0 ');
    expect(text).toContain('☐ 7 teentjes knoflook (≈1 bol)');
  });

  it('an empty list is just the title', () => {
    expect(listAsText([], dict, 'nl', { title: 'Boodschappen' })).toBe('Boodschappen');
  });

  it('isoWeekNumber: ISO-8601 weeks (Monday first, week 1 holds the first Thursday)', () => {
    expect(isoWeekNumber(new Date(2026, 8, 29))).toBe(40); // Tue 29 Sep 2026
    expect(isoWeekNumber(new Date(2026, 0, 1))).toBe(1); // Thu 1 Jan 2026
    expect(isoWeekNumber(new Date(2027, 0, 1))).toBe(53); // Fri 1 Jan 2027 belongs to 2026-W53
    expect(isoWeekNumber(new Date(2024, 11, 30))).toBe(1); // Mon 30 Dec 2024 is 2025-W01
  });
});

// Typed extras with a unit (src/domain/shopinput.ts, 17 Oct 2026): rendered like generated items.
describe('typed extras with a unit', () => {
  const extra = (over: Partial<ListItem>): ListItem => ({ key: 'x|t', aisle: 'zuivel-eieren', section: 'main', sources: [], manual: true, ...over });

  it('"200 gram boter" -> "200 g boter" / "200 g butter"', () => {
    const it = extra({ ing: 'boter', qty: 200, unit: 'g' });
    expect(nl(it)).toBe('200 g boter');
    expect(en(it)).toBe('200 g butter');
  });

  it('a unit English shows as another one converts the number too: 2 dl -> 200 ml', () => {
    const it = extra({ ing: 'room', qty: 2, unit: 'dl' });
    expect(nl(it)).toMatch(/^2 dl /u);
    expect(en(it)).toMatch(/^200 ml /u);
  });
});

// 13D (docs/specs/varianten-tabs.md §3 blok 1, §6): `lines(recipeId, item)` gets the slot, so the repo
// can hand over the lines of the slot's approved diet version; each source carries that version as
// `diet` for "Waarvoor is dit?" ("(glutenvrije versie)").
describe('diet versions per slot (13D)', () => {
  const schotel = rec('b:schotel', 'Spaghettischotel', ['400 g spaghetti', '400 g gehakt']);
  const glutenvrij = rec('b:schotel', 'Spaghettischotel', ['400 g glutenvrije pasta', '400 g gehakt']).lines;
  const byVersion = (id: string, item: PlanItem): Line[] => (item.variant === 'glutenvrij' ? glutenvrij : (id === schotel.id ? schotel.lines : []));

  it('lines(recipeId, item) gets the slot itself (cooked slots are never asked)', () => {
    const seen: Array<[string, PlanItem]> = [];
    const open = slot('b:schotel', 4, { variant: 'glutenvrij' });
    run([schotel], [open, slot('b:schotel', 2, { id: 'pi:cooked', cooked: true })], {
      lines: (id, item) => {
        seen.push([id, item]);
        return schotel.lines;
      },
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.[0]).toBe('b:schotel');
    expect(seen[0]?.[1]).toEqual(open);
  });

  it('a slot with variant glutenvrij and the version lines -> glutenvrije pasta, sources[0].diet "glutenvrij", no spaghetti', () => {
    const items = run([schotel], [slot('b:schotel', 4, { variant: 'glutenvrij' })], { lines: byVersion });
    const pasta = one(items, 'glutenvrije-pasta');
    expect(pasta.ing).toBe('glutenvrije-pasta');
    expect(pasta.qty).toBe(400);
    expect(pasta.sources[0]?.diet).toBe('glutenvrij');
    expect(pasta.sources[0]?.raw).toBe('400 g glutenvrije pasta');
    expect(one(items, 'gehakt').sources[0]?.diet).toBe('glutenvrij');
    expect(byIng(items, 'spaghetti')).toEqual([]);
  });

  it('without a variant the source has no diet key (unchanged list)', () => {
    const items = run([schotel], [slot('b:schotel', 4)], { lines: byVersion });
    const spaghetti = one(items, 'spaghetti');
    expect(spaghetti.sources[0]).not.toHaveProperty('diet');
    expect(byIng(items, 'glutenvrije-pasta')).toEqual([]);
  });

  it('the lines follow each slot: the same dish as original and as version in one plan', () => {
    const items = run([schotel], [slot('b:schotel', 4), slot('b:schotel', 2, { id: 'pi:gv', variant: 'glutenvrij' })], { lines: byVersion });
    expect(one(items, 'spaghetti').qty).toBe(400);
    expect(one(items, 'glutenvrije-pasta').qty).toBe(200);
    const gehakt = one(items, 'gehakt');
    expect(gehakt.baseQty).toBe(600);
    expect(gehakt.sources.map((s) => s.diet ?? null)).toEqual([null, 'glutenvrij']);
  });

  it('an unresolved line of a version slot carries the diet on its "Controleer zelf" source too', () => {
    const r = rec('b:a', 'A', ['Iets lekkers voor erbij']);
    const items = run([r], [slot('b:a', 4, { variant: 'vegan' })]);
    const check = items.find((it) => it.section === 'check');
    expect(check?.sources[0]?.diet).toBe('vegan');
  });

  it('a one-parameter lines function still fits (additive change)', () => {
    const items = run([schotel], [slot('b:schotel', 4)], { lines: (id) => (id === schotel.id ? schotel.lines : []) });
    expect(one(items, 'spaghetti').qty).toBe(400);
  });
});

// 6C (docs/specs/vaste-lijst.md §3 "src/domain/aggregate.ts", §6): standing-list lines ("Vaste lijst")
// come in as given, key 's|<id>', never summed with recipe lines, and "Heb ik al" is their own flag.
// Built by hand here (the shape `standingToListItem` gives), so this file does not depend on standing.ts.
describe('standing lines', () => {
  const st = (id: string, over: Partial<ListItem>): ListItem => ({ key: `s|${id}`, ing: null, qty: null, unit: null, aisle: 'overig', section: 'main', sources: [], standing: true, ...over });
  const melk = st('k3m9x2ab', { ing: 'melk', qty: 3, unit: 'l', aisle: 'zuivel-eieren' });
  const mayo = st('q7p1zz0c', { ing: 'mayonaise', qty: 1, unit: 'pot', aisle: 'sauzen-olie-azijn' });
  const zegels = st('e5f6g7h8', { label: { nl: 'postzegels', en: '' } });
  const pasta = rec('b:pasta', 'Pasta', ['400 g pasta', '2 uien']);
  const byKey = (items: ListItem[], key: string) => items.find((it) => it.key === key);

  it('a standing line lands in main with standing: true, no sources, in aisle order among the rest', () => {
    const items = run([pasta], undefined, { standing: [zegels, mayo, melk] });
    const m = byKey(items, 's|k3m9x2ab') as ListItem;
    expect(m).toMatchObject({ standing: true, section: 'main', sources: [], qty: 3, unit: 'l', aisle: 'zuivel-eieren' });
    expect(m.manual).toBeUndefined();
    expect(nl(m)).toBe('3 l melk');
    expect(en(m)).toBe('3 l milk');
    // groente-fruit (ui) · droog (pasta) · zuivel-eieren (melk) · sauzen-olie-azijn (mayo) · overig (postzegels)
    const main = items.filter((it) => it.section === 'main').map((it) => it.aisle);
    const order = new Map(dict.aisles.map((a, idx) => [a.id, idx]));
    const idx = main.map((a) => order.get(a) ?? 999);
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
    expect(main.indexOf('zuivel-eieren')).toBeLessThan(main.indexOf('sauzen-olie-azijn'));
    expect(main[main.length - 1]).toBe('overig');
  });

  it('a recipe line and a standing line of the same ingredient stay two lines (never summed)', () => {
    const items = run([rec('b:pap', 'Pap', ['250 ml melk'])], undefined, { standing: [melk] });
    const melks = byIng(items, 'melk');
    expect(melks).toHaveLength(2);
    expect(melks.filter((it) => it.standing).map((it) => it.key)).toEqual(['s|k3m9x2ab']);
    expect(byKey(items, 's|k3m9x2ab')?.qty).toBe(3);
  });

  it('carries checked / adjusted / inHouse from the previous list on the s| key', () => {
    const previous: ListItem[] = [
      { ...melk, checked: true },
      { ...mayo, adjusted: 1 },
      { ...zegels, inHouse: true, section: 'inHouse' },
    ];
    const items = run([], [], { standing: [melk, mayo, zegels], previous });
    expect(byKey(items, 's|k3m9x2ab')).toMatchObject({ checked: true, section: 'main' });
    const m = byKey(items, 's|q7p1zz0c') as ListItem;
    expect(m.adjusted).toBe(1);
    expect(nl(m)).toBe('2 potten mayonaise');
    expect(en(m)).toBe('2 jars mayonnaise');
    expect(byKey(items, 's|e5f6g7h8')).toMatchObject({ inHouse: true, section: 'inHouse' });
    expect(items.some((it) => it.fresh)).toBe(false);
    // A key that was not in the previous list is fresh.
    expect(byKey(run([], [], { standing: [melk], previous: [] }), 's|k3m9x2ab')?.fresh).toBe(true);
  });

  it('the pantry never makes a standing line "in huis" (its own flag only)', () => {
    const items = run([], [], { standing: [mayo, melk], pantry: new Set(['mayonaise', 'melk']) });
    expect(byKey(items, 's|q7p1zz0c')).toMatchObject({ section: 'main' });
    expect(byKey(items, 's|q7p1zz0c')?.inHouse).toBeUndefined();
    expect(byKey(items, 's|k3m9x2ab')?.inHouse).toBeUndefined();
    // ... and a previous "Heb ik al" survives without a pantry row.
    const kept = run([], [], { standing: [mayo], previous: [{ ...mayo, inHouse: true, section: 'inHouse' }], pantry: new Set() });
    expect(byKey(kept, 's|q7p1zz0c')).toMatchObject({ inHouse: true, section: 'inHouse' });
  });

  it('a standing line that is no longer given drops (vanished, not manual, not pinned)', () => {
    const previous = run([], [], { standing: [melk, mayo] });
    const next = run([], [], { standing: [melk], previous });
    expect(next.map((it) => it.key)).toEqual(['s|k3m9x2ab']);
    expect(run([], [], { previous }).length).toBe(0);
  });

  it('an extra with the same key wins; the standing loop skips a key already seen', () => {
    const items = run([], [], { extras: [{ key: 's|k3m9x2ab', ing: 'melk', qty: 1, unit: 'l', aisle: '', section: 'main', sources: [] }], standing: [melk] });
    expect(items).toHaveLength(1);
    expect(items[0]?.qty).toBe(1);
  });

  it('renderListItem: a standing line without a number never says "(pm)"', () => {
    const plain = st('a1', { ing: 'melk', aisle: 'zuivel-eieren' });
    expect(nl(plain)).toBe('melk');
    expect(en(plain)).toBe('milk');
    expect(nl(zegels)).toBe('postzegels');
    // The same line without `standing` (and not manual) is "pm".
    expect(nl({ ...plain, standing: undefined })).toBe('melk (pm)');
  });

  it('listAsText takes standing lines along, hides in-house ones on request, and has no "— …" line without dishes', () => {
    const items = run([], [], { standing: [melk, mayo, zegels], previous: [{ ...mayo, inHouse: true, section: 'inHouse' }] });
    const text = listAsText(items, dict, 'nl', { title: 'T' });
    expect(text).toContain('☐ 3 l melk');
    expect(text).toContain('☐ 1 pot mayonaise (in huis)');
    expect(text).toContain('☐ postzegels');
    expect(text.split('\n').some((l) => l.startsWith('—'))).toBe(false);
    const hidden = listAsText(items, dict, 'nl', { title: 'T', hideInHouse: true });
    expect(hidden).not.toContain('mayonaise');
    expect(hidden).toContain('☐ 3 l melk');
    const english = listAsText(items, dict, 'en', { title: 'T' });
    expect(english).toContain('☐ 3 l milk');
    expect(english).toContain('☐ 1 jar mayonnaise');
  });
});

// 6C blok 3 (docs/specs/vaste-lijst.md §1d, §4 "Blok 3", §6): the week list with standing lines.
// "Klaar" (`clearChecks` in src/db/repo.ts) clears the ticks and, on standing lines only, also
// `inHouse` and `adjusted` (section back to 'main'). That function writes Dexie, so its effect is
// spelled out here as `klaar()` (the rule of §1d) and the tests check what aggregate and listAsText
// make of a list in that state: the next list starts with the usual amounts.
describe('standing lines: Klaar and sharing without a week plan (6C blok 3)', () => {
  const st = (id: string, over: Partial<ListItem>): ListItem => ({ key: `s|${id}`, ing: null, qty: null, unit: null, aisle: 'overig', section: 'main', sources: [], standing: true, ...over });
  const melk = st('k3m9x2ab', { ing: 'melk', qty: 3, unit: 'l', aisle: 'zuivel-eieren' });
  const mayo = st('q7p1zz0c', { ing: 'mayonaise', qty: 1, unit: 'pot', aisle: 'sauzen-olie-azijn' });
  const zegels = st('e5f6g7h8', { label: { nl: 'postzegels', en: 'stamps' } });
  const byKey = (items: ListItem[], key: string) => items.find((it) => it.key === key);
  const extra = (key: string, over: Partial<ListItem>): ListItem => ({ key, aisle: 'overig', section: 'main', sources: [], manual: true, ...over });
  const aisleName = (id: string) => dict.aisle(id)?.nl;

  /** The rule of §1d for "Klaar": ticks go; on standing lines also inHouse and adjusted. */
  const klaar = (items: ListItem[]): ListItem[] =>
    items.map((it) => {
      const next = { ...it };
      delete next.checked;
      if (it.standing) {
        delete next.inHouse;
        delete next.adjusted;
        if (next.section === 'inHouse') next.section = 'main';
      }
      return next;
    });

  const marked = (): ListItem[] =>
    run([], [], {
      standing: [melk, mayo],
      previous: [
        { ...melk, inHouse: true, section: 'inHouse' },
        { ...mayo, adjusted: 1, checked: true },
      ],
    });

  it('after Klaar a standing line is back in main with its usual amount, not in house', () => {
    const before = marked();
    expect(byKey(before, 's|k3m9x2ab')).toMatchObject({ inHouse: true, section: 'inHouse' });
    expect(nl(byKey(before, 's|q7p1zz0c') as ListItem)).toBe('2 potten mayonaise');

    const after = run([], [], { standing: [melk, mayo], previous: klaar(before) });
    const m = byKey(after, 's|k3m9x2ab') as ListItem;
    expect(m.section).toBe('main');
    expect(m.inHouse).toBeUndefined();
    expect(nl(m)).toBe('3 l melk');
    const p = byKey(after, 's|q7p1zz0c') as ListItem;
    expect(p.adjusted).toBeUndefined();
    expect(p.checked).toBeUndefined();
    expect(nl(p)).toBe('1 pot mayonaise');
    expect(after.some((it) => it.fresh)).toBe(false);
  });

  it('Klaar keeps the in-house state of a recipe line (that is the pantry, not a standing flag)', () => {
    const r = rec('b:pasta', 'Pasta', ['400 g pasta', '2 uien']);
    const before = run([r], undefined, { standing: [melk], pantry: new Set(['ui']) });
    expect(one(before, 'ui').section).toBe('inHouse');
    const after = run([r], undefined, { standing: [melk], pantry: new Set(['ui']), previous: klaar(before) });
    expect(one(after, 'ui').section).toBe('inHouse');
  });

  it('undo of Klaar (the old lines back) carries the ticks, "Heb ik al" and the adjusted amount again', () => {
    const again = run([], [], { standing: [melk, mayo], previous: marked() });
    expect(byKey(again, 's|k3m9x2ab')).toMatchObject({ inHouse: true, section: 'inHouse' });
    expect(byKey(again, 's|q7p1zz0c')).toMatchObject({ adjusted: 1, checked: true });
  });

  it('without a week plan the shared text has the extras and the standing lines per aisle, and no "— …" line', () => {
    const items = run([], [], {
      extras: [extra('x|wc', { ing: 'wc-papier', qty: 1, unit: null, aisle: '' })],
      standing: [zegels, mayo, melk],
    });
    const text = listAsText(items, dict, 'nl', { title: '🛒 Boodschappen wk 45' });
    const lines = text.split('\n');
    expect(lines[0]).toBe('🛒 Boodschappen wk 45');
    expect(lines.some((l) => l.startsWith('—'))).toBe(false);
    expect(text).not.toContain('(pm)');
    expect(text).not.toContain('Controleer zelf');
    for (const want of ['☐ 3 l melk', '☐ 1 pot mayonaise', '☐ postzegels']) expect(lines).toContain(want);
    // Aisle order: dairy before sauces before "overig"; each line under its own aisle heading.
    const iMelk = lines.indexOf('☐ 3 l melk');
    const iMayo = lines.indexOf('☐ 1 pot mayonaise');
    const iZegels = lines.indexOf('☐ postzegels');
    expect(iMelk).toBeLessThan(iMayo);
    expect(iMayo).toBeLessThan(iZegels);
    expect(lines[iMelk - 1]).toBe(aisleName('zuivel-eieren'));
    expect(lines[iMayo - 1]).toBe(aisleName('sauzen-olie-azijn'));

    const english = listAsText(items, dict, 'en', { title: '🛒 Shopping wk 45' }).split('\n');
    for (const want of ['☐ 3 l milk', '☐ 1 jar mayonnaise', '☐ stamps']) expect(english).toContain(want);
    expect(english.some((l) => l.startsWith('—'))).toBe(false);
  });

  it('a list with only standing lines (no plan, no extras) shares as title + aisle + line', () => {
    const items = run([], [], { standing: [melk] });
    expect(listAsText(items, dict, 'nl', { title: 'T' }).split('\n')).toEqual(['T', aisleName('zuivel-eieren'), '☐ 3 l melk']);
  });

  it('sharing: hideInHouse drops a standing line marked "Heb ik al", hideChecked a ticked one, amount 0 always', () => {
    const items = run([], [], {
      standing: [melk, mayo, zegels],
      previous: [
        { ...melk, inHouse: true, section: 'inHouse' },
        { ...mayo, checked: true },
        { ...zegels },
      ],
    });
    const all = listAsText(items, dict, 'nl', { title: 'T' });
    expect(all).toContain('☐ 3 l melk (in huis)');
    expect(all).toContain('☑ 1 pot mayonaise');
    const shop = listAsText(items, dict, 'nl', { title: 'T', hideInHouse: true, hideChecked: true });
    expect(shop).not.toContain('melk');
    expect(shop).not.toContain('mayonaise');
    expect(shop).toContain('☐ postzegels');
    // An amount brought down to 0 for this week never shows.
    const zero = run([], [], { standing: [melk], previous: [{ ...melk, adjusted: -3 }] });
    expect(listAsText(zero, dict, 'nl', { title: 'T' })).not.toContain('melk');
  });

  it('with a week plan the standing lines join the dishes; the "— …" line names only the dishes', () => {
    const items = run([rec('b:pap', 'Pap', ['250 ml melk'])], undefined, { standing: [melk, zegels] });
    const lines = listAsText(items, dict, 'nl', { title: 'T' }).split('\n');
    expect(lines.filter((l) => l.startsWith('—'))).toEqual(['— Pap']);
    expect(lines).toContain('☐ 3 l melk');
    expect(lines).toContain('☐ postzegels');
  });
});
