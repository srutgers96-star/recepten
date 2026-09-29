// renderLine / renderLineParts / formatQty (docs/phase-2-spec.md §3): NL and EN rendering plus the
// scaling and rounding rules of PLAN.md §8 step 5.
import { describe, expect, it } from 'vitest';
import { parseLine } from '../src/domain/parser';
import { formatQty, renderLine, renderLineParts } from '../src/domain/render';
import { testDictionary } from './fixtures/test-dictionary';

const dict = testDictionary();
const line = (raw: string) => parseLine(raw, dict, 'nl');
const both = (raw: string, factor = 1) => [renderLine(line(raw), dict, 'nl', factor), renderLine(line(raw), dict, 'en', factor)];

describe('formatQty', () => {
  it('uses fractions, ranges and language-specific decimals', () => {
    expect(formatQty(0.5)).toBe('½');
    expect(formatQty(1.5)).toBe('1½');
    expect(formatQty(0.25)).toBe('¼');
    expect(formatQty(2, 3)).toBe('2-3');
    expect(formatQty(1.25, undefined, 'nl')).toBe('1¼');
    expect(formatQty(1.3, undefined, 'nl')).toBe('1,3');
    expect(formatQty(1.3, undefined, 'en')).toBe('1.3');
    expect(formatQty(400, undefined, 'nl', true)).toBe('ca. 400');
    expect(formatQty(400, undefined, 'en', true)).toBe('approx. 400');
    expect(formatQty(1 / 3)).toBe('⅓');
  });
});

describe('renderLine: the worked examples', () => {
  it('renders NL and EN from the dictionary', () => {
    expect(both('250 g schelvisfilet (of kabeljauw) [stukken van 2-3 cm]')).toEqual([
      '250 g schelvisfilet (of kabeljauw), stukken van 2-3 cm',
      '250 g haddock fillet (or cod), 2-3 cm pieces',
    ]);
    expect(both('sap van ½ limoen')).toEqual(['sap van ½ limoen', 'juice of ½ lime']);
    expect(both('1 1/2 el mayonaise')).toEqual(['1½ el mayonaise', '1½ tbsp mayonnaise']);
    expect(both('1 rode ui [gesnipperd]')).toEqual(['1 rode ui, gesnipperd', '1 red onion, finely diced']);
    expect(both('Rookworst en/of braadworst')).toEqual(['Rookworst en/of braadworst', 'Smoked sausage and/or frying sausage']);
    expect(both('zout en peper')).toEqual(['zout en peper', 'salt and pepper']);
    expect(both('zout en peper naar smaak')).toEqual(['zout en peper (naar smaak)', 'salt and pepper (to taste)']);
  });

  it('renders parts, plurals, packs, garnish and unit names', () => {
    expect(both('het wit van 1 prei [fijngesneden]')).toEqual(['het wit van 1 prei, fijngesneden', 'the white of 1 leek, finely sliced']);
    expect(both('rasp en sap van 1 citroen')).toEqual(['rasp en sap van 1 citroen', 'zest and juice of 1 lemon']);
    expect(both('2 teentjes knoflook [geperst]')).toEqual(['2 teentjes knoflook, geperst', '2 cloves garlic, crushed']);
    expect(both('4 grote, rijpe tomaten [ontveld; blokjes]')).toEqual(['4 grote rijpe tomaten, ontveld; blokjes', '4 large ripe tomatoes, skinned; diced']);
    expect(both('400 g aardappelen')).toEqual(['400 g aardappelen', '400 g potatoes']);
    expect(both('1 blik kidneybonen, afgegoten')).toEqual(['1 blik kidneybonen, afgegoten', '1 tin kidney beans, drained']);
    expect(both('Parmezaanse kaas [vers geraspt] (garnering)')).toEqual(['Parmezaanse kaas, vers geraspt (garnering)', 'Parmesan, freshly grated (garnish)']);
    expect(both('4 dunne preien of 2 dikke preien [smalle ringen]')).toEqual([
      '4 dunne preien (of 2 dikke preien), smalle ringen',
      '4 thin leeks (or 2 thick leeks), thin rings',
    ]);
    expect(both('1 rode of gele paprika [reepjes]')).toEqual(['1 rode paprika (of gele paprika), reepjes', '1 red pepper (or yellow pepper), strips']);
    expect(both('boter om in te bakken')).toEqual(['boter (om in te bakken)', 'butter (for frying)']);
  });

  it('renders dl as ml in English and keeps grams', () => {
    expect(both('2 dl kippenbouillon (blokje)')).toEqual(['2 dl kippenbouillon (blokje)', '200 ml chicken stock (cube)']);
    expect(both('3 dl kippenbouillon')).toEqual(['3 dl kippenbouillon', '300 ml chicken stock']);
  });

  it('unresolved lines render their raw text', () => {
    expect(both('4 blikjes tonijn op water')).toEqual(['4 blikjes tonijn op water', '4 blikjes tonijn op water']);
    expect(both('Dressing:')).toEqual(['Dressing:', 'Dressing:']);
  });
});

describe('renderLine: scaling', () => {
  it('halves pieces to fractions and grams to 125', () => {
    expect(both('1 ui', 0.5)).toEqual(['½ ui', '½ onion']);
    expect(both('250 g schelvisfilet', 0.5)).toEqual(['125 g schelvisfilet', '125 g haddock fillet']);
    expect(both('1½ el mayonaise', 0.5)).toEqual(['¾ el mayonaise', '¾ tbsp mayonnaise']);
    expect(both('sap van ½ limoen', 0.5)).toEqual(['sap van ¼ limoen', 'juice of ¼ lime']);
    expect(both('2 uien', 0.5)).toEqual(['1 ui', '1 onion']);
    expect(both('3 tomaten', 0.5)).toEqual(['1½ tomaten', '1½ tomatoes']);
  });

  it('scales up with sensible rounding', () => {
    expect(both('250 g schelvisfilet', 1.5)).toEqual(['375 g schelvisfilet', '375 g haddock fillet']);
    expect(both('250 g schelvisfilet', 2)).toEqual(['500 g schelvisfilet', '500 g haddock fillet']);
    expect(both('1 ui', 1.5)).toEqual(['1½ uien', '1½ onions']);
    expect(both('2-3 el olijfolie', 2)).toEqual(['4-6 el olijfolie', '4-6 tbsp olive oil']);
    expect(both('2 dl kippenbouillon', 1.5)).toEqual(['3 dl kippenbouillon', '300 ml chicken stock']);
    expect(both('ca. 400 g aardappelen', 0.75)).toEqual(['ca. 300 g aardappelen', 'approx. 300 g potatoes']);
  });

  it('never scales a pinch', () => {
    expect(both('1 mp cayennepeper', 2)).toEqual(['1 mespunt cayennepeper', '1 pinch cayenne pepper']);
    expect(both('snufje nootmuskaat', 0.5)).toEqual(['snufje nootmuskaat', 'pinch nutmeg']);
  });

  it('shows sub-1 metric amounts in the base unit', () => {
    expect(both('1 kg aardappelen', 0.5)).toEqual(['500 g aardappelen', '500 g potatoes']);
    expect(both('1,25 dl kippenbouillon', 0.5)).toEqual(['65 ml kippenbouillon', '65 ml chicken stock']);
    expect(both('1,25 dl kippenbouillon', 2)).toEqual(['2½ dl kippenbouillon', '250 ml chicken stock']);
    // unresolved lines only get the number replaced inside the raw text
    expect(both('1,25 dl water', 0.5)[0]).toBe('0,65 dl water');
  });

  it('scales the quantity inside unresolved raw text, and only then', () => {
    expect(both('4 zalmfilets van 150 g', 0.5)).toEqual(['2 zalmfilets van 150 g', '2 zalmfilets van 150 g']);
    expect(both('1 blik (400 g) tomatenblokjes', 2)[0]).toBe('2 blik (400 g) tomatenblokjes');
    expect(both('Ketjap manis', 2)).toEqual(['Ketjap manis', 'Ketjap manis']);
    expect(both('1,25 dl water', 1)[1]).toBe('1,25 dl water');
  });
});

describe('renderLineParts', () => {
  it('returns the chips of a resolved line', () => {
    const p = renderLineParts(line('2 el olijfolie [voor het bakken]'), dict, 'nl');
    expect(p).toMatchObject({ qty: '2', unit: 'el', name: 'olijfolie', resolved: true });
    const en = renderLineParts(line('1 rode ui [gesnipperd]'), dict, 'en', 0.5);
    expect(en).toMatchObject({ qty: '½', unit: '', name: 'red onion', prep: 'finely diced', text: '½ red onion, finely diced', resolved: true });
    const alt = renderLineParts(line('250 g schelvisfilet (of kabeljauw)'), dict, 'en');
    expect(alt.alt).toBe('(or cod)');
    const sausage = renderLineParts(line('Rookworst'), dict, 'en');
    expect(sausage.gloss).toBe('Dutch smoked sausage');
  });

  it('returns what was parsed for an unresolved line, with the raw text', () => {
    const p = renderLineParts(line('4 blikjes tonijn op water'), dict, 'en', 0.5);
    expect(p).toMatchObject({ qty: '2', unit: 'tins', name: 'tonijn op water', resolved: false, text: '2 blikjes tonijn op water' });
  });
});
