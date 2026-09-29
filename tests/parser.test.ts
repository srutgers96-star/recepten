// parseLine (docs/phase-2-spec.md §3): the five worked examples of PLAN.md §5 plus real corpus lines.
import { describe, expect, it } from 'vitest';
import { defaultDictionaryData } from '../src/domain/data';
import { loadDictionary } from '../src/domain/dictionary';
import type { Recipe } from '../src/domain/model';
import { parseLine, parseQty, reparseLine } from '../src/domain/parser';
import { searchRecipes } from '../src/domain/search';
import { testDictionary } from './fixtures/test-dictionary';

const dict = testDictionary();
const nl = (raw: string) => parseLine(raw, dict, 'nl');
const en = (raw: string) => parseLine(raw, dict, 'en');

describe('parseLine: the five worked examples from PLAN.md §5', () => {
  it('250 g schelvisfilet (of kabeljauw) [stukken van 2-3 cm]', () => {
    const line = nl('250 g schelvisfilet (of kabeljauw) [stukken van 2-3 cm]');
    expect(line).toMatchObject({
      raw: { nl: '250 g schelvisfilet (of kabeljauw) [stukken van 2-3 cm]' },
      kind: 'line',
      qty: { min: 250 },
      unit: 'g',
      ing: 'schelvisfilet',
      altMode: 'or',
      prep: { nl: 'stukken van 2-3 cm', en: '2-3 cm pieces' },
    });
    expect(line.alt).toHaveLength(1);
    expect(line.alt?.[0]).toMatchObject({ ing: 'kabeljauw', qty: null, unit: null });
    expect(line.confidence).toBe(1);
  });

  it('sap van ½ limoen', () => {
    expect(nl('sap van ½ limoen')).toMatchObject({ qty: { min: 0.5 }, unit: null, ing: 'limoen', part: 'sap' });
  });

  it('1 1/2 el mayonaise', () => {
    expect(nl('1 1/2 el mayonaise')).toMatchObject({ qty: { min: 1.5 }, unit: 'el', ing: 'mayonaise' });
  });

  it('1 rode ui [gesnipperd]', () => {
    expect(nl('1 rode ui [gesnipperd]')).toMatchObject({
      qty: { min: 1 },
      unit: null,
      ing: 'ui',
      qual: ['rode'],
      prep: { nl: 'gesnipperd', en: 'finely diced' },
    });
  });

  it('Rookworst en/of braadworst', () => {
    const line = nl('Rookworst en/of braadworst');
    expect(line).toMatchObject({ qty: null, ing: 'rookworst', altMode: 'and-or' });
    expect(line.alt?.[0]).toMatchObject({ ing: 'braadworst' });
  });

  it('bonus: zout en peper and Dressing:', () => {
    expect(nl('zout en peper')).toMatchObject({ qty: null, unit: null, ing: 'zout-en-peper' });
    expect(nl('Dressing:')).toEqual({ raw: { nl: 'Dressing:' }, kind: 'header' });
  });
});

describe('parseQty', () => {
  it('reads every quantity form of the corpus', () => {
    expect(parseQty('2 el')?.qty).toEqual({ min: 2 });
    expect(parseQty('2-3 el')?.qty).toEqual({ min: 2, max: 3 });
    expect(parseQty('2–3 el')?.qty).toEqual({ min: 2, max: 3 });
    expect(parseQty('2 à 3 tomaten')?.qty).toEqual({ min: 2, max: 3 });
    expect(parseQty('1 of 2 meloenen')?.qty).toEqual({ min: 1, max: 2 });
    expect(parseQty('8-12 drumsticks')?.qty).toEqual({ min: 8, max: 12 });
    expect(parseQty('1 1/2 el')?.qty).toEqual({ min: 1.5 });
    expect(parseQty('1½ kg')?.qty).toEqual({ min: 1.5 });
    expect(parseQty('2 ½ el')?.qty).toEqual({ min: 2.5 });
    expect(parseQty('1/2 tl')?.qty).toEqual({ min: 0.5 });
    expect(parseQty('¼ aubergine')?.qty).toEqual({ min: 0.25 });
    expect(parseQty('⅓ kop')?.qty).toEqual({ min: 0.333 });
    expect(parseQty('1,25 dl')?.qty).toEqual({ min: 1.25 });
    expect(parseQty('1.5 tbsp', 'en')?.qty).toEqual({ min: 1.5 });
    expect(parseQty('ca. 400 g')?.qty).toEqual({ min: 400, approx: true });
    expect(parseQty('± 200 g')?.qty).toEqual({ min: 200, approx: true });
    expect(parseQty('2+1 el')?.qty).toEqual({ min: 3 });
    expect(parseQty('400g bloem')?.length).toBe(3);
    expect(parseQty('a pinch of salt', 'en')?.qty).toEqual({ min: 1 });
  });

  it('returns null when the text does not start with a quantity', () => {
    expect(parseQty('zout en peper')).toBeNull();
    expect(parseQty('sap van ½ limoen')).toBeNull();
    expect(parseQty('Parmezaanse kaas')).toBeNull();
  });
});

describe('parseLine: corpus lines', () => {
  it('quantity forms, approx and units', () => {
    expect(nl('2-3 el olijfolie')).toMatchObject({ qty: { min: 2, max: 3 }, unit: 'el', ing: 'olijfolie' });
    expect(nl('2 à 3 tomaten')).toMatchObject({ qty: { min: 2, max: 3 }, unit: null, ing: 'tomaat' });
    expect(nl('1½ kg aardappelen')).toMatchObject({ qty: { min: 1.5 }, unit: 'kg', ing: 'aardappel' });
    expect(nl('ca. 400 g aardappelen')).toMatchObject({ qty: { min: 400, approx: true }, unit: 'g', ing: 'aardappel' });
    expect(nl('1,25 dl water')).toMatchObject({ qty: { min: 1.25 }, unit: 'dl', ing: null, name: 'water' });
    expect(nl('¼ aubergine [plakjes van 1 cm]')).toMatchObject({ qty: { min: 0.25 }, ing: 'aubergine', prep: { nl: 'plakjes van 1 cm', en: '1 cm slices' } });
    expect(nl('2+1 el olijfolie')).toMatchObject({ qty: { min: 3 }, unit: 'el', ing: 'olijfolie' });
    expect(nl('3 cm gember')).toMatchObject({ qty: { min: 3 }, unit: 'cm', ing: 'gember' });
    expect(nl('2 teentjes knoflook [geperst]')).toMatchObject({ qty: { min: 2 }, unit: 'teen', ing: 'knoflook', prep: { en: 'crushed' } });
    expect(nl('4 stengels bleekselderij [boogjes]')).toMatchObject({ unit: 'stengel', ing: 'bleekselderij', prep: { en: 'crescents' } });
    expect(nl('4 blikjes tonijn op water')).toMatchObject({ qty: { min: 4 }, unit: 'blik', ing: null, name: 'tonijn op water' });
  });

  it('parts: het wit van, rasp en sap van', () => {
    expect(nl('het wit van 1 prei [fijngesneden]')).toMatchObject({ qty: { min: 1 }, ing: 'prei', part: 'wit', prep: { nl: 'fijngesneden', en: 'finely sliced' } });
    expect(nl('rasp en sap van 1 citroen')).toMatchObject({ qty: { min: 1 }, ing: 'citroen', part: 'rasp-en-sap' });
    expect(nl('rasp van 1/2 citroen')).toMatchObject({ qty: { min: 0.5 }, ing: 'citroen', part: 'rasp' });
  });

  it('parentheses: pack size, alternative, garnish, note', () => {
    expect(nl('Blikje balti kooksaus (285 g)')).toMatchObject({ qty: null, unit: 'blik', ing: null, name: 'balti kooksaus', packSize: '285 g' });
    expect(nl('(285 g)')).toMatchObject({ qty: null, ing: null, name: '', packSize: '285 g' });
    expect(nl('1 blik (400 g) tomatenblokjes')).toMatchObject({ qty: { min: 1 }, unit: 'blik', packSize: '400 g', name: 'tomatenblokjes' });
    expect(nl('4 zalmfilets van 150 g')).toMatchObject({ qty: { min: 4 }, unit: null, packSize: '150 g', name: 'zalmfilets' });
    expect(nl('1 braadkip (ca. 1,2 kg)')).toMatchObject({ packSize: 'ca. 1,2 kg', name: 'braadkip' });
    const kip = nl('500 g kipfilet (of kalkoen) [blokjes van 2-3 cm]');
    expect(kip).toMatchObject({ qty: { min: 500 }, unit: 'g', ing: 'kipfilet', altMode: 'or', prep: { en: '2-3 cm dice' } });
    expect(kip.alt?.[0]).toMatchObject({ ing: 'kalkoen' });
    expect(nl('Parmezaanse kaas [vers geraspt] (garnering)')).toMatchObject({
      qty: null,
      ing: 'parmezaanse-kaas',
      prep: { nl: 'vers geraspt', en: 'freshly grated' },
      optional: true,
      role: 'garnish',
    });
    expect(nl('2 dl kippenbouillon (blokje)')).toMatchObject({ qty: { min: 2 }, unit: 'dl', ing: 'kippenbouillon', note: { nl: 'blokje', en: 'cube' } });
    expect(nl('1 klein blik mais')).toMatchObject({ qty: { min: 1 }, unit: 'blik', qual: ['kleine'], ing: 'mais' });
  });

  it('optional, purpose and free-text tails', () => {
    expect(nl('zout en peper naar smaak')).toMatchObject({ ing: 'zout-en-peper', optional: true, note: { nl: 'naar smaak', en: 'to taste' } });
    expect(nl('boter om in te bakken')).toMatchObject({ qty: null, ing: 'boter', note: { nl: 'om in te bakken', en: 'for frying' } });
    const meloen = nl('1 of 2 meloenen, Galia, honing, suiker of Cantaloupe [stukjes]');
    expect(meloen).toMatchObject({
      qty: { min: 1, max: 2 },
      ing: 'meloen',
      name: 'meloenen',
      prep: { nl: 'stukjes', en: 'small pieces' },
      note: { nl: 'Galia, honing, suiker of Cantaloupe' },
    });
    expect(meloen.alt).toBeUndefined();
    expect(nl('Optioneel: kroepoek, atjar en seroendeng')).toMatchObject({ optional: true, ing: null, name: 'kroepoek, atjar en seroendeng' });
    expect(nl('1 blik kidneybonen, afgegoten')).toMatchObject({ unit: 'blik', ing: 'kidneyboon', prep: { nl: 'afgegoten', en: 'drained' } });
  });

  it('qualifiers: leading words, comma lists, whole-name products first', () => {
    expect(nl('4 grote, rijpe tomaten [ontveld; blokjes]')).toMatchObject({
      qty: { min: 4 },
      ing: 'tomaat',
      qual: ['grote', 'rijpe'],
      prep: { nl: 'ontveld; blokjes', en: 'skinned; diced' },
    });
    expect(nl('3 hardgekookte eieren [in vieren]')).toMatchObject({ ing: 'ei', qual: ['hardgekookte'], prep: { en: 'quartered' } });
    expect(nl('1 kg kruimige aardappelen [blokjes van 2 cm]')).toMatchObject({ unit: 'kg', ing: 'aardappel', qual: ['kruimige'], prep: { en: '2 cm dice' } });
    // "zwarte peper" is its own product, not peper + zwarte
    expect(nl('zwarte peper')).toMatchObject({ ing: 'zwarte-peper', name: 'zwarte peper' });
    expect(nl('zwarte peper').qual).toBeUndefined();
  });

  it('inline alternatives', () => {
    const prei = nl('4 dunne preien of 2 dikke preien [smalle ringen]');
    expect(prei).toMatchObject({ qty: { min: 4 }, ing: 'prei', qual: ['dunne'], altMode: 'or', prep: { en: 'thin rings' } });
    expect(prei.alt?.[0]).toMatchObject({ qty: { min: 2 }, ing: 'prei', qual: ['dikke'] });
    const paprika = nl('1 rode of gele paprika [reepjes]');
    expect(paprika).toMatchObject({ qty: { min: 1 }, ing: 'paprika', qual: ['rode'], altMode: 'or' });
    expect(paprika.alt?.[0]).toMatchObject({ ing: 'paprika', qual: ['gele'] });
    // a suspended compound is not split
    expect(nl('600 g kippen- of kalfsgehakt')).toMatchObject({ qty: { min: 600 }, unit: 'g', ing: null, name: 'kippen- of kalfsgehakt' });
  });

  it('plurals and diminutives resolve without an alias', () => {
    expect(nl('2 uien')).toMatchObject({ ing: 'ui', name: 'uien' });
    expect(nl('1 sjalotje [gesnipperd]')).toMatchObject({ ing: 'sjalot' });
    expect(nl('3 sjalotjes')).toMatchObject({ ing: 'sjalot' });
    expect(nl('8 tomaten [blokjes]')).toMatchObject({ qty: { min: 8 }, ing: 'tomaat', prep: { en: 'diced' } });
    expect(nl('2 rode uien')).toMatchObject({ ing: 'ui', qual: ['rode'] });
  });

  it('English input uses the English tables', () => {
    expect(en('2 large red onions [finely chopped]')).toMatchObject({ raw: { en: '2 large red onions [finely chopped]' }, qty: { min: 2 }, ing: 'ui', qual: ['grote', 'rode'], prep: { nl: 'fijngehakt', en: 'finely chopped' } });
    expect(en('1.5 tbsp mayonnaise')).toMatchObject({ qty: { min: 1.5 }, unit: 'el', ing: 'mayonaise' });
    expect(en('juice of ½ lime')).toMatchObject({ qty: { min: 0.5 }, ing: 'limoen', part: 'sap' });
    expect(en('salt and pepper to taste')).toMatchObject({ ing: 'zout-en-peper', optional: true, note: { en: 'to taste' } });
    expect(en('1 tin (400 g) chopped tomatoes')).toMatchObject({ qty: { min: 1 }, unit: 'blik', ing: 'tomaat', packSize: '400 g' });
    expect(en('2 cloves garlic, crushed')).toMatchObject({ unit: 'teen', ing: 'knoflook', prep: { en: 'crushed', nl: 'geperst' } });
  });

  it('confidence: resolved lines ≥ 0.6, unresolved < 0.6', () => {
    expect(nl('1 rode ui [gesnipperd]').confidence).toBeGreaterThanOrEqual(0.6);
    expect(nl('600 g kippen- of kalfsgehakt').confidence).toBeLessThan(0.6);
    expect(nl('1 ui [op een manier die niemand kent]').confidence).toBeLessThan(1);
  });

  it('works with an empty ingredient list: ing null, name kept', () => {
    const empty = loadDictionary({ ...defaultDictionaryData(), ingredients: [] });
    expect(empty.ingredients).toHaveLength(0);
    expect(parseLine('1 rode ui [gesnipperd]', empty, 'nl')).toMatchObject({ qty: { min: 1 }, unit: null, ing: null, name: 'ui', qual: ['rode'], prep: { en: 'finely diced' } });
    expect(parseLine('2 el olijfolie', empty, 'nl')).toMatchObject({ qty: { min: 2 }, unit: 'el', ing: null, name: 'olijfolie' });
    expect(parseLine('', empty, 'nl')).toMatchObject({ ing: null, name: '', confidence: 0 });
  });

  it('dictionary lookups: aliases, search and user entries', () => {
    expect(dict.ingredientByName('Uitje', 'nl')?.id).toBe('ui');
    expect(dict.ingredientByName('yellow onions', 'en')?.id).toBe('ui');
    expect(dict.ingredientByName('Tomaten', 'nl')?.id).toBe('tomaat');
    expect(dict.unitByAlias('Eetlepels', 'nl')?.id).toBe('el');
    expect(dict.unitByAlias('tablespoons', 'en')?.id).toBe('el');
    expect(dict.qualifierByWord('Rood', 'nl')?.id).toBe('rode');
    expect(dict.search('onion', 'en').map((i) => i.id)).toEqual(['ui']);
    expect(dict.search('ui', 'nl').map((i) => i.id)[0]).toBe('ui');
    expect(dict.search('citroen', 'en').map((i) => i.id)).toContain('citroen');
    expect(dict.prepFor('blokjes van 1½ cm')).toEqual({ nl: 'blokjes van 1½ cm', en: '1½ cm dice' });
    expect(dict.prepFor('5 in plakjes, 1 in reepjes')).toEqual({ nl: '5 in plakjes, 1 in reepjes', en: '5 sliced, 1 in strips' });
    expect(dict.prepFor('iets onbekends')).toEqual({ nl: 'iets onbekends' });
  });

  it('searchRecipes groups by name, then ingredient, bilingually', () => {
    const recipe = (id: string, name: string, lines: string[], extra: Partial<Recipe> = {}): Recipe => ({
      schema: 2, id, rev: 1, createdAt: '2025-12-01T00:00:00.000Z', updatedAt: '2025-12-01T00:00:00.000Z', origin: { kind: 'builtin' },
      name: { nl: name }, tags: [], servings: 4, lines: lines.map((l) => parseLine(l, dict, 'nl')), steps: [{ text: { nl: 'Kook.' } }], goesWith: [], aliases: [], ...extra,
    });
    const recipes = [
      recipe('b:uiensoep', 'Uiensoep', ['4 uien', '1 l kippenbouillon']),
      recipe('b:pasta', 'Pasta met tomaat', ['8 tomaten', '1 rode ui'], { category: 'pasta', tags: ['snel'] }),
      recipe('b:vis', 'Schelvis', ['250 g schelvisfilet (of kabeljauw)', 'Ketjap manis']),
    ];
    const onion = searchRecipes(recipes, 'onion', dict, 'en');
    expect(onion.map((g) => [g.kind, g.recipes.map((r) => r.id)])).toEqual([['ingredient', ['b:uiensoep', 'b:pasta']]]);
    const ui = searchRecipes(recipes, 'ui', dict, 'nl');
    expect(ui[0]).toMatchObject({ kind: 'name', recipes: [recipes[0]] });
    expect(ui[1]?.kind).toBe('ingredient');
    expect(searchRecipes(recipes, 'cod', dict, 'en')[0]?.recipes.map((r) => r.id)).toEqual(['b:vis']);
    expect(searchRecipes(recipes, 'ketjap', dict, 'en')[0]?.recipes.map((r) => r.id)).toEqual(['b:vis']);
    expect(searchRecipes(recipes, 'pasta', dict, 'en')[0]?.kind).toBe('name');
    expect(searchRecipes(recipes, 'snel', dict, 'nl')[0]?.kind).toBe('tag');
    expect(searchRecipes(recipes, '', dict, 'nl')[0]?.recipes).toHaveLength(3);
    expect(searchRecipes(recipes, 'xyz', dict, 'nl')).toEqual([]);
  });

  it('reparseLine re-reads raw and keeps a manual ing when the parser cannot resolve', () => {
    const manual = { ...nl('4 blikjes tonijn op water'), ing: 'tonijn' };
    const again = reparseLine(manual, dict, 'nl');
    expect(again.ing).toBe('tonijn');
    expect(again.raw).toEqual({ nl: '4 blikjes tonijn op water' });
    expect(again.unit).toBe('blik');
    const auto = reparseLine({ raw: { nl: '2 uien' }, ing: 'tomaat' }, dict, 'nl');
    expect(auto.ing).toBe('ui');
  });
});
