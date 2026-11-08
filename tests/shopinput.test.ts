import { describe, expect, it } from 'vitest';
import { defaultDictionary, defaultDictionaryData } from '../src/domain/data';
import { loadDictionary, type Ingredient } from '../src/domain/dictionary';
import { isShopList, parseShopInput, shopMatchScore, splitShopList, suggestShopLines } from '../src/domain/shopinput';

const dict = defaultDictionary();
const nl = (s: string) => parseShopInput(s, dict, 'nl');
const en = (s: string) => parseShopInput(s, dict, 'en');

describe('parseShopInput', () => {
  it('reads a unit after the number (Stijn 17 Oct: "200 gram boter" went to Overig)', () => {
    expect(nl('200 gram boter')).toEqual({ qty: 200, unit: 'g', name: 'boter' });
    expect(nl('200g boter')).toEqual({ qty: 200, unit: 'g', name: 'boter' });
    expect(nl('1 kg aardappelen')).toEqual({ qty: 1, unit: 'kg', name: 'aardappelen' });
    expect(nl('1,5 kilo kip')).toEqual({ qty: 1.5, unit: 'kg', name: 'kip' });
    expect(nl('500 ml room')).toEqual({ qty: 500, unit: 'ml', name: 'room' });
    expect(nl('2 pakken melk')).toEqual({ qty: 2, unit: 'pak', name: 'melk' });
    expect(en('200 g butter')).toEqual({ qty: 200, unit: 'g', name: 'butter' });
  });

  it('the name after the unit is a dictionary ingredient', () => {
    const p = nl('200 gram boter');
    expect(dict.ingredientByName(p.name, 'nl')?.id).toBe('boter');
    expect(dict.ingredientByName(nl('1 kg aardappelen').name, 'nl')?.id).toBe('aardappel');
  });

  it('keeps the old forms: a bare count, "3x", "3 ×", no amount', () => {
    expect(nl('3 melk')).toEqual({ qty: 3, unit: null, name: 'melk' });
    expect(nl('3x melk')).toEqual({ qty: 3, unit: null, name: 'melk' });
    expect(nl('3 x melk')).toEqual({ qty: 3, unit: null, name: 'melk' });
    expect(nl('3 × melk')).toEqual({ qty: 3, unit: null, name: 'melk' });
    expect(nl('melk')).toEqual({ qty: null, unit: null, name: 'melk' });
    expect(nl('  wc-papier  ')).toEqual({ qty: null, unit: null, name: 'wc-papier' });
  });

  it('articles, fractions and ranges', () => {
    expect(nl('een zak chips')).toEqual({ qty: 1, unit: 'zak', name: 'chips' });
    expect(en('a bag of crisps').qty).toBe(1);
    expect(nl('½ kilo gehakt')).toEqual({ qty: 0.5, unit: 'kg', name: 'gehakt' });
    expect(nl('2-3 uien')).toEqual({ qty: 3, unit: null, name: 'uien' });
  });

  it('a number glued to a word that is not a unit stays part of the name', () => {
    expect(nl('7up')).toEqual({ qty: null, unit: null, name: '7up' });
    expect(nl('7up light')).toEqual({ qty: null, unit: null, name: '7up light' });
  });

  it('an amount without a name is kept as typed', () => {
    expect(nl('200 gram')).toEqual({ qty: null, unit: null, name: '200 gram' });
    expect(nl('2 kg')).toEqual({ qty: null, unit: null, name: '2 kg' });
    expect(nl('200')).toEqual({ qty: null, unit: null, name: '200' });
    expect(nl('')).toEqual({ qty: null, unit: null, name: '' });
  });

  it('a word that is no unit stays in the name', () => {
    // "rollen" is not in data/units.json, "grote" is a qualifier: both stay part of the name.
    expect(nl('2 rollen keukenpapier')).toEqual({ qty: 2, unit: null, name: 'rollen keukenpapier' });
    expect(nl('3 grote uien')).toEqual({ qty: 3, unit: null, name: 'grote uien' });
  });

  it('an unknown item with a unit keeps the unit and the rest as its name', () => {
    expect(nl('2 pakken havermelk barista')).toEqual({ qty: 2, unit: 'pak', name: 'havermelk barista' });
  });
});

// Review of 17 Oct 2026 (workflow: two reviewers + a verifier): every confirmed case pinned here.
describe('parseShopInput — review cases', () => {
  const ing = (name: string, l: 'nl' | 'en' = 'nl') => dict.ingredientByName(name, l)?.id;

  it('a product whose own name starts with a unit word keeps that word', () => {
    expect(nl('2 blik tomaten')).toEqual({ qty: 2, unit: null, name: 'blik tomaten' });
    expect(ing(nl('2 blik tomaten').name)).toBe(ing('tomaten uit blik'));
    expect(nl('1 pak choi').unit).toBeNull();
    expect(ing(nl('1 pak choi').name)).toBe(ing('paksoi'));
    expect(en('1 hand cream').unit).toBeNull();
    expect(en('1 tin foil').unit).toBeNull();
    // ... while a unit before the same product stays a unit.
    expect(nl('2 plakjes ham').unit).not.toBeNull();
    expect(nl('2 teentjes knoflook').unit).not.toBeNull();
    expect(nl('2 pakken melk').unit).toBe('pak');
  });

  it('a known product beats a unit with the same name', () => {
    expect(nl('1 drop')).toEqual({ qty: 1, unit: null, name: 'drop' });
    expect(en('10 cloves')).toEqual({ qty: 10, unit: null, name: 'cloves' });
  });

  it('English "<unit> of <item>"', () => {
    expect(en('a pint of milk')).toMatchObject({ qty: 1, name: 'milk' });
    expect(en('a pint of milk').unit).not.toBeNull();
    expect(en('500 g of mince')).toEqual({ qty: 500, unit: 'g', name: 'mince' });
    expect(en('2 cans of chickpeas')).toMatchObject({ qty: 2, unit: 'blik', name: 'chickpeas' });
    expect(ing(en('2 cans of chickpeas').name, 'en')).toBeDefined();
    // Dutch "of" means "or" and is left alone.
    expect(nl('2 blikken of potten').name).toContain('of');
  });

  it('an article is 1 only before a unit or a known product', () => {
    expect(nl('een zak chips')).toEqual({ qty: 1, unit: 'zak', name: 'chips' });
    expect(en('an apple')).toEqual({ qty: 1, unit: null, name: 'apple' });
    expect(nl('een paar bananen')).toEqual({ qty: null, unit: null, name: 'een paar bananen' });
    expect(en('a few apples')).toEqual({ qty: null, unit: null, name: 'a few apples' });
    expect(nl('een stuk of 5 appels')).toEqual({ qty: 5, unit: null, name: 'appels' });
    expect(nl('een halve kilo gehakt')).toEqual({ qty: 0.5, unit: 'kg', name: 'gehakt' });
  });

  it('a multiple of an amount: "3 x 200 gram boter"', () => {
    expect(nl('3 x 200 gram boter')).toEqual({ qty: 600, unit: 'g', name: 'boter' });
    expect(nl('3x200 gram boter')).toEqual({ qty: 600, unit: 'g', name: 'boter' });
    expect(nl('2× brood')).toEqual({ qty: 2, unit: null, name: 'brood' });
  });

  it('Dutch deli weights and thousands', () => {
    expect(nl('2 ons ham')).toEqual({ qty: 200, unit: 'g', name: 'ham' });
    expect(nl('een pond gehakt')).toEqual({ qty: 500, unit: 'g', name: 'gehakt' });
    expect(nl('1.000 gram suiker')).toEqual({ qty: 1000, unit: 'g', name: 'suiker' });
    expect(nl('1.5 kg kip')).toEqual({ qty: 1.5, unit: 'kg', name: 'kip' });
  });

  it('unit words are read in the typing language; ambiguous ones stay in the name', () => {
    expect(nl('1 strip paracetamol').unit).toBeNull();
    expect(nl('1 blok kaas').unit).toBeNull();
  });

  it('"1 bos bloemen" is flowers, not flour', () => {
    const p = nl('1 bos bloemen');
    expect(p).toEqual({ qty: 1, unit: 'bos', name: 'bloemen' });
    expect(ing(p.name)).toBe('bloemen');
    expect(ing('bloem')).toBe('bloem');
  });
});

describe('splitShopList', () => {
  it('a decimal comma is no separator', () => {
    expect(splitShopList('1,5 liter melk')).toEqual(['1,5 liter melk']);
    expect(splitShopList('melk, 2 eieren')).toEqual(['melk', '2 eieren']);
    expect(splitShopList('melk,2 eieren')).toEqual(['melk', '2 eieren']);
    expect(splitShopList('2 pakken melk, 3 x wc-papier')).toEqual(['2 pakken melk', '3 x wc-papier']);
    expect(isShopList('1,5 liter melk')).toBe(false);
    expect(isShopList('melk, eieren')).toBe(true);
  });
});

describe('splitShopList on line breaks and " · " (spec V6 §1a)', () => {
  it('splits a WhatsApp list', () => {
    expect(splitShopList('Coco acqua\nBeetroot\r\nCheck ketchup')).toEqual(['Coco acqua', 'Beetroot', 'Check ketchup']);
    expect(splitShopList('Coco acqua · Beetroot · Check ketchup · Pickles · Bread for breakfast')).toEqual([
      'Coco acqua', 'Beetroot', 'Check ketchup', 'Pickles', 'Bread for breakfast',
    ]);
    expect(splitShopList('melk\n\n1,5 liter room, eieren')).toEqual(['melk', '1,5 liter room', 'eieren']);
    expect(isShopList('melk\neieren')).toBe(true);
    expect(isShopList('melk · eieren')).toBe(true);
    expect(isShopList('melk')).toBe(false);
  });
});

describe('suggestShopLines (spec V6 §1a)', () => {
  const gabi = 'Coco acqua\nBeetroot\nCheck ketchup\nPickles\nBread for breakfast';

  it("Gabi's list, literally", () => {
    const s = suggestShopLines(gabi, dict, 'nl');
    expect(s.map((l) => l.raw)).toEqual(['Coco acqua', 'Beetroot', 'Check ketchup', 'Pickles', 'Bread for breakfast']);
    const [coco, beet, ketchup, pickles, bread] = s;
    // Unknown until the word list knows "coco acqua" (builder C adds it as an alias of kokoswater).
    if (coco?.status === 'sure') expect(coco.match).toBe('kokoswater');
    else expect(coco).toMatchObject({ status: 'unknown', match: null });
    expect(['sure', 'maybe']).toContain(beet?.status);
    expect(beet?.match).toBe('biet');
    expect(ketchup).toMatchObject({ status: 'sure', match: 'ketchup', note: 'check', name: 'ketchup', alternatives: [] });
    expect(pickles?.match).toBe('augurk');
    expect(['sure', 'maybe']).toContain(bread?.status);
    expect(bread).toMatchObject({ match: 'brood', note: 'for breakfast', name: 'Bread' });
  });

  it('"Coco acqua" is sure once the device learned it', () => {
    const [coco] = suggestShopLines(gabi, dict, 'nl', { 'coco acqua': 'kokoswater' });
    expect(coco).toMatchObject({ raw: 'Coco acqua', status: 'sure', match: 'kokoswater', note: null });
  });

  it('a learned id that no longer exists is ignored', () => {
    const [s] = suggestShopLines('ketchup', dict, 'nl', { ketchup: 'bestaat-niet' });
    expect(s).toMatchObject({ status: 'sure', match: 'ketchup' });
  });

  it('Dutch note words, front and back', () => {
    const lines = suggestShopLines(
      'check melk\ncontroleer eieren\nkijken of er kaas is\nmisschien boter\nevt. room\nketchup eventueel\nmelk als het kan',
      dict,
      'nl',
    );
    expect(lines.map((l) => l.note)).toEqual(['check', 'controleer', 'kijken of', 'misschien', 'evt.', 'eventueel', 'als het kan']);
    expect(lines.map((l) => l.name)).toEqual(['melk', 'eieren', 'er kaas is', 'boter', 'room', 'ketchup', 'melk']);
    expect(lines[0]?.match).toBe('melk');
    expect(lines[3]?.match).toBe('boter');
  });

  it('English note words, and a note never empties the name', () => {
    const lines = suggestShopLines('maybe milk\nmilk if possible\noptional: cheese\nbread for lunch\neggs for dinner\nCheck', dict, 'nl');
    expect(lines.map((l) => l.note)).toEqual(['maybe', 'if possible', 'optional', 'for lunch', 'for dinner', null]);
    expect(lines[5]).toMatchObject({ name: 'Check', note: null });
  });

  it('amounts: in the list language, else the other language', () => {
    const [a, b] = suggestShopLines('200 gram boter\n2 cans of chickpeas', dict, 'nl');
    expect(a).toMatchObject({ qty: 200, unit: 'g', name: 'boter', status: 'sure', match: 'boter' });
    expect(b).toMatchObject({ qty: 2, unit: 'blik', name: 'chickpeas', status: 'sure' });
  });

  it('words of one or two letters stay unknown', () => {
    for (const s of suggestShopLines('x\nab\nq · zz', dict, 'nl')) {
      expect(s).toMatchObject({ status: 'unknown', match: null, alternatives: [] });
    }
  });

  it('a search hit: maybe with at most two alternatives, unknown with at most three', () => {
    for (const s of suggestShopLines('ketchu\nkokoswat\ntomaat blik groot\nkaas', dict, 'nl')) {
      if (s.status === 'maybe') {
        expect(s.match).not.toBeNull();
        expect(s.alternatives.length).toBeLessThanOrEqual(2);
      } else if (s.status === 'unknown') {
        expect(s.match).toBeNull();
        expect(s.alternatives.length).toBeLessThanOrEqual(3);
      }
      expect(s.alternatives).not.toContain(s.match);
    }
    const [kokos] = suggestShopLines('kokoswat', dict, 'nl');
    expect(kokos).toMatchObject({ status: 'maybe', match: 'kokoswater' });
  });

  it('shopMatchScore: 1 for a name or alias, 0.9 for a word start, otherwise the ratio capped at 0.8', () => {
    const ing = dict.get('kokoswater');
    expect(ing).toBeDefined();
    if (ing) {
      expect(shopMatchScore('kokoswater', ing, 'nl')).toBe(1);
      expect(shopMatchScore('coconut water', ing, 'nl')).toBe(1);
      expect(shopMatchScore('kokos', ing, 'nl')).toBe(0.9);
      expect(shopMatchScore('water', ing, 'nl')).toBe(0.9);
      expect(shopMatchScore('oswat', ing, 'nl')).toBeCloseTo(0.5);
      expect(shopMatchScore('appel', ing, 'nl')).toBe(0);
    }
    const kip = dict.get('kipfilet');
    if (kip) expect(shopMatchScore('kip', kip, 'nl')).toBe(0.9);
    // The ratio never reaches the word-start score.
    const x = { id: 'xabcdefghij', nl: { one: 'xabcdefghij' }, en: { one: '' } } as unknown as Ingredient;
    expect(shopMatchScore('abcdefghij', x, 'nl')).toBe(0.8);
  });

  // A small dictionary of chosen ingredients, so a case does not hang on the word list.
  const tiny = (ings: Ingredient[]) => loadDictionary({ ...defaultDictionaryData(), ingredients: ings });
  const realBiet = defaultDictionaryData().ingredients.find((i) => i.id === 'biet') as Ingredient;

  it('"beet" is a maybe on biet with 0.9 (a word of "beetroot" starts with it)', () => {
    // The real word list has "beet" as an alias (sure), so the alias is left out here.
    const biet = { ...realBiet, aliases: { nl: realBiet.aliases?.nl ?? [], en: [] } } as Ingredient;
    const d = tiny([biet]);
    expect(shopMatchScore('beet', biet, 'nl')).toBe(0.9);
    const [s] = suggestShopLines('beet', d, 'nl');
    expect(s).toMatchObject({ status: 'maybe', match: 'biet', alternatives: [] });
    // On the real word list a word start that is no alias is a maybe as well.
    const [r] = suggestShopLines('beetr', dict, 'nl');
    expect(r).toMatchObject({ status: 'maybe', match: 'biet' });
  });

  it('"melkk" is unknown (no name contains it)', () => {
    const d = tiny([dict.get('melk') as Ingredient, dict.get('karnemelk') as Ingredient].filter(Boolean));
    const [s] = suggestShopLines('melkk', d, 'nl');
    expect(s).toMatchObject({ status: 'unknown', match: null });
  });

  it('a single weak hit (score under 0.5) is unknown with that hit as its one alternative', () => {
    const stamp = { ...realBiet, id: 'boerenkoolstamppot', nl: { one: 'boerenkoolstamppot' }, en: { one: 'kale mash' }, aliases: {} } as Ingredient;
    const d = tiny([stamp]);
    expect(shopMatchScore('kool', stamp, 'nl')).toBeLessThan(0.5);
    const [s] = suggestShopLines('kool', d, 'nl');
    expect(s).toMatchObject({ status: 'unknown', match: null, alternatives: ['boerenkoolstamppot'] });
  });

  it('keeps the raw line, also with an amount', () => {
    const [s] = suggestShopLines('  2 pakken melk  ', dict, 'nl');
    expect(s).toMatchObject({ raw: '2 pakken melk', qty: 2, unit: 'pak', name: 'melk', match: 'melk', status: 'sure' });
  });
});
