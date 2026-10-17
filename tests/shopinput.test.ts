import { describe, expect, it } from 'vitest';
import { defaultDictionary } from '../src/domain/data';
import { isShopList, parseShopInput, splitShopList } from '../src/domain/shopinput';

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
