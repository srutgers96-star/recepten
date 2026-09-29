// A small ingredient list for the parser/render/scale tests: data/ingredients.json does not exist
// yet (the dictionary agents write it), so the tests layer these entries over the bundled vocab
// with `withUserEntries`, which also exercises that path.
import { defaultDictionary } from '../../src/domain/data';
import { withUserEntries, type Dictionary, type Ingredient } from '../../src/domain/dictionary';

type Names = { one: string; many?: string };

function ing(id: string, nl: string | Names, en: string | Names, extra: Partial<Ingredient> = {}): Ingredient {
  return {
    id,
    nl: typeof nl === 'string' ? { one: nl } : nl,
    en: typeof en === 'string' ? { one: en } : en,
    aisle: 'overig',
    defaultUnit: 'stuk',
    staple: false,
    veg: true,
    ...extra,
  };
}

export const TEST_INGREDIENTS: Ingredient[] = [
  ing('aardappel', { one: 'aardappel', many: 'aardappelen' }, { one: 'potato', many: 'potatoes' }, { aisle: 'groente-fruit', aliases: { nl: ['aardappels'] }, gramsPer: { stuk: 150 } }),
  ing('aubergine', { one: 'aubergine', many: 'aubergines' }, { one: 'aubergine', many: 'aubergines' }, { aisle: 'groente-fruit' }),
  ing('bleekselderij', 'bleekselderij', 'celery', { aisle: 'groente-fruit', defaultUnit: 'stengel' }),
  ing('boter', 'boter', 'butter', { aisle: 'zuivel-eieren', defaultUnit: 'g', staple: true }),
  ing('braadworst', { one: 'braadworst', many: 'braadworsten' }, { one: 'frying sausage', many: 'frying sausages' }, { aisle: 'vlees-vis', veg: false }),
  ing('cayennepeper', 'cayennepeper', 'cayenne pepper', { aisle: 'kruiden-specerijen', defaultUnit: 'mp', staple: true }),
  ing('citroen', { one: 'citroen', many: 'citroenen' }, { one: 'lemon', many: 'lemons' }, { aisle: 'groente-fruit' }),
  ing('ei', { one: 'ei', many: 'eieren' }, { one: 'egg', many: 'eggs' }, { aisle: 'zuivel-eieren' }),
  ing('gember', 'gember', 'ginger', { aisle: 'groente-fruit', defaultUnit: 'cm' }),
  ing('kabeljauw', 'kabeljauw', 'cod', { aisle: 'vlees-vis', defaultUnit: 'g', veg: false, aliases: { nl: ['kabeljauwfilet'] } }),
  ing('kalkoen', 'kalkoen', 'turkey', { aisle: 'vlees-vis', defaultUnit: 'g', veg: false }),
  ing('kidneyboon', { one: 'kidneyboon', many: 'kidneybonen' }, { one: 'kidney bean', many: 'kidney beans' }, { aisle: 'blik-pot', defaultUnit: 'blik' }),
  ing('kipfilet', { one: 'kipfilet', many: 'kipfilets' }, { one: 'chicken breast', many: 'chicken breasts' }, { aisle: 'vlees-vis', defaultUnit: 'g', veg: false }),
  ing('kippenbouillon', 'kippenbouillon', 'chicken stock', { aisle: 'kruiden-specerijen', defaultUnit: 'ml', veg: false, staple: true }),
  ing('knoflook', 'knoflook', 'garlic', { aisle: 'groente-fruit', defaultUnit: 'teen', buyUnit: 'bol' }),
  ing('limoen', { one: 'limoen', many: 'limoenen' }, { one: 'lime', many: 'limes' }, { aisle: 'groente-fruit' }),
  ing('mais', 'mais', 'sweetcorn', { aisle: 'blik-pot', defaultUnit: 'blik', aliases: { nl: ['maïs'] } }),
  ing('mayonaise', 'mayonaise', 'mayonnaise', { aisle: 'sauzen-olie-azijn', defaultUnit: 'el', staple: true }),
  ing('meloen', { one: 'meloen', many: 'meloenen' }, { one: 'melon', many: 'melons' }, { aisle: 'groente-fruit' }),
  ing('nootmuskaat', 'nootmuskaat', 'nutmeg', { aisle: 'kruiden-specerijen', defaultUnit: 'snuf', staple: true }),
  ing('olijfolie', 'olijfolie', 'olive oil', { aisle: 'sauzen-olie-azijn', defaultUnit: 'el', staple: true }),
  ing('paprika', { one: 'paprika', many: "paprika's" }, { one: 'pepper', many: 'peppers' }, { aisle: 'groente-fruit' }),
  ing('parmezaanse-kaas', 'Parmezaanse kaas', 'Parmesan', { aisle: 'kaas', defaultUnit: 'g' }),
  ing('peterselie', 'peterselie', 'parsley', { aisle: 'groente-fruit', defaultUnit: 'el' }),
  ing('prei', { one: 'prei', many: 'preien' }, { one: 'leek', many: 'leeks' }, { aisle: 'groente-fruit', cut: 'slice' }),
  ing('rookworst', { one: 'rookworst', many: 'rookworsten' }, { one: 'smoked sausage', many: 'smoked sausages' }, { aisle: 'vlees-vis', veg: false, gloss: { en: 'Dutch smoked sausage' } }),
  ing('schelvisfilet', 'schelvisfilet', 'haddock fillet', { aisle: 'vlees-vis', defaultUnit: 'g', veg: false }),
  ing('sjalot', { one: 'sjalot', many: 'sjalotten' }, { one: 'shallot', many: 'shallots' }, { aisle: 'groente-fruit' }),
  ing('tomaat', { one: 'tomaat', many: 'tomaten' }, { one: 'tomato', many: 'tomatoes' }, { aisle: 'groente-fruit', gramsPer: { stuk: 100 } }),
  ing('tonijn', 'tonijn', 'tuna', { aisle: 'blik-pot', defaultUnit: 'blik', veg: false }),
  ing('ui', { one: 'ui', many: 'uien' }, { one: 'onion', many: 'onions' }, { aisle: 'groente-fruit', aliases: { nl: ['uitje'], en: ['yellow onion'] }, gramsPer: { stuk: 120 }, cut: 'slice' }),
  ing('zout-en-peper', 'zout en peper', 'salt and pepper', { aisle: 'kruiden-specerijen', defaultUnit: null, staple: true }),
  ing('zwarte-peper', 'zwarte peper', 'black pepper', { aisle: 'kruiden-specerijen', defaultUnit: null, staple: true }),
];

let cached: Dictionary | undefined;

/** The bundled vocab plus TEST_INGREDIENTS. */
export function testDictionary(): Dictionary {
  if (!cached) cached = withUserEntries(defaultDictionary(), TEST_INGREDIENTS);
  return cached;
}
