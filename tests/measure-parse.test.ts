// tests/measure-parse.test.ts — classifyLine on real lines from data/source/recipes-recepten2.json.
import { describe, expect, it } from 'vitest';
import { classifyLine, evenSample, measure } from '../tools/measure-parse.ts';

describe('classifyLine', () => {
  it('400 g aardappelen [plakjes] -> qty + known unit, with prep', () => {
    expect(classifyLine('400 g aardappelen [plakjes]')).toEqual({
      kind: 'qty-known-unit', unit: 'g', qty: '400', hasPrep: true, hasParen: false,
    });
  });

  it('1 rode ui [gesnipperd] -> qty + count/name (no unit)', () => {
    expect(classifyLine('1 rode ui [gesnipperd]')).toEqual({
      kind: 'qty-count-or-name', qty: '1', hasPrep: true, hasParen: false,
    });
  });

  it('sap van ½ limoen -> no leading qty', () => {
    expect(classifyLine('sap van ½ limoen')).toEqual({ kind: 'no-qty', hasPrep: false, hasParen: false });
  });

  it('zout en peper naar smaak -> no-qty', () => {
    expect(classifyLine('zout en peper naar smaak').kind).toBe('no-qty');
  });

  it('1 1/2 el mayonaise -> mixed fraction + el', () => {
    expect(classifyLine('1 1/2 el mayonaise')).toEqual({
      kind: 'qty-known-unit', unit: 'el', qty: '1 1/2', hasPrep: false, hasParen: false,
    });
  });

  it('2-3 verse rode pepers [fijngesneden zonder zaadjes] -> range + name', () => {
    expect(classifyLine('2-3 verse rode pepers [fijngesneden zonder zaadjes]')).toEqual({
      kind: 'qty-count-or-name', qty: '2-3', hasPrep: true, hasParen: false,
    });
  });

  it('Rookworst en/of braadworst -> no-qty', () => {
    expect(classifyLine('Rookworst en/of braadworst').kind).toBe('no-qty');
  });

  it('Dressing: -> header', () => {
    expect(classifyLine('Dressing:')).toEqual({ kind: 'header', hasPrep: false, hasParen: false });
  });

  it('ca. 500 g rundergehakt -> approx prefix kept in qty, unit g', () => {
    expect(classifyLine('ca. 500 g rundergehakt')).toEqual({
      kind: 'qty-known-unit', unit: 'g', qty: 'ca. 500', hasPrep: false, hasParen: false,
    });
  });

  it('1 teentje knoflook [geperst] -> unit teentje', () => {
    expect(classifyLine('1 teentje knoflook [geperst]')).toEqual({
      kind: 'qty-known-unit', unit: 'teentje', qty: '1', hasPrep: true, hasParen: false,
    });
  });

  it('250 g schelvisfilet (of kabeljauw) [stukken van 2-3 cm] -> g, paren and prep', () => {
    expect(classifyLine('250 g schelvisfilet (of kabeljauw) [stukken van 2-3 cm]')).toEqual({
      kind: 'qty-known-unit', unit: 'g', qty: '250', hasPrep: true, hasParen: true,
    });
  });

  it('Blikje balti kooksaus (285 g) -> no leading qty, has paren', () => {
    expect(classifyLine('Blikje balti kooksaus (285 g)')).toEqual({
      kind: 'no-qty', hasPrep: false, hasParen: true,
    });
  });

  it('4 zalmfilets van 150 g -> count/name (pack size is not the unit)', () => {
    expect(classifyLine('4 zalmfilets van 150 g')).toEqual({
      kind: 'qty-count-or-name', qty: '4', hasPrep: false, hasParen: false,
    });
  });

  it('1½ kg aardappelen -> vulgar fraction glued to the integer, unit kg', () => {
    expect(classifyLine('1½ kg aardappelen')).toEqual({
      kind: 'qty-known-unit', unit: 'kg', qty: '1½', hasPrep: false, hasParen: false,
    });
  });

  it('Maizena -> no-qty', () => {
    expect(classifyLine('Maizena')).toEqual({ kind: 'no-qty', hasPrep: false, hasParen: false });
  });

  it('empty and whitespace-only lines -> empty', () => {
    expect(classifyLine('').kind).toBe('empty');
    expect(classifyLine('   ').kind).toBe('empty');
  });

  it('more corpus forms: bare fraction, en dash range, "of" range, ltr, ± and 1 of 2', () => {
    expect(classifyLine('1/2 tl zout')).toMatchObject({ kind: 'qty-known-unit', unit: 'tl', qty: '1/2' });
    expect(classifyLine('2–3 el koriander [gesnipperd]')).toMatchObject({ kind: 'qty-known-unit', unit: 'el', qty: '2–3' });
    expect(classifyLine('1 of 2 zure bommen')).toMatchObject({ kind: 'qty-count-or-name', qty: '1 of 2' });
    expect(classifyLine('1/4 ltr yoghurt')).toMatchObject({ kind: 'qty-known-unit', unit: 'ltr' });
    expect(classifyLine('± 200 g spekjes')).toMatchObject({ kind: 'qty-known-unit', unit: 'g', qty: '± 200' });
    expect(classifyLine('ca. ½ ltr kippenbouillon (blokje)')).toMatchObject({
      kind: 'qty-known-unit', unit: 'ltr', qty: 'ca. ½', hasParen: true,
    });
  });

  it('unit matching is case-insensitive and tolerates a trailing dot', () => {
    expect(classifyLine('2 El. olijfolie')).toMatchObject({ kind: 'qty-known-unit', unit: 'el' });
    expect(classifyLine('400g aardappelen')).toMatchObject({ kind: 'qty-known-unit', unit: 'g' });
  });
});

describe('measure', () => {
  it('counts totals, uniques, kinds, units and notes', () => {
    const t = measure(['400 g bloem', '400 g bloem ', '2 eieren', 'Dressing:', 'zout (naar smaak)', '']);
    expect(t.total).toBe(6);
    expect(t.unique).toBe(5);
    expect(t.kindsAll['qty-known-unit']).toBe(2);
    expect(t.kindsUnique['qty-known-unit']).toBe(1);
    expect(t.kindsUnique['qty-count-or-name']).toBe(1);
    expect(t.kindsUnique['no-qty']).toBe(1);
    expect(t.kindsUnique.header).toBe(1);
    expect(t.kindsUnique.empty).toBe(1);
    expect(t.unitsUnique.get('g')).toBe(1);
    expect(t.unitsAll.get('g')).toBe(2);
    expect(t.parenUnique).toBe(1);
    expect(t.samplesNoQty).toEqual(['zout (naar smaak)']);
  });

  it('evenSample is deterministic and spans the list', () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const sample = evenSample(items, 25);
    expect(sample).toHaveLength(25);
    expect(sample[0]).toBe(0);
    expect(sample[24]).toBe(96);
    expect(evenSample([1, 2, 3], 25)).toEqual([1, 2, 3]);
  });
});
